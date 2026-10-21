package com.richflow.text

import java.util.concurrent.Executor
import java.util.concurrent.FutureTask
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.atomic.AtomicReference

/** Cancellation belongs to a subscriber, never to a view's shared executor. */
internal interface AttachmentSubscription {
  fun cancel()
}

/** Pure JVM coordination; cache access and in-flight identity share one lock. */
internal class AttachmentRequestCoordinator<K : Any, V : Any>(
  private val executor: Executor,
  private val readCache: (K) -> V?,
  private val writeCache: (K, V) -> Unit
) {
  private class Subscriber<V>(
    callback: (V?) -> Unit,
    private val cancelOperation: (Subscriber<V>) -> Unit
  ) : AttachmentSubscription {
    private val callback = AtomicReference<((V?) -> Unit)?>(callback)

    override fun cancel() {
      if (callback.getAndSet(null) != null) cancelOperation(this)
    }

    fun deliver(value: V?) {
      callback.getAndSet(null)?.invoke(value)
    }
  }

  private class Entry<V>(val load: () -> V?) {
    val subscribers = mutableListOf<Subscriber<V>>()
    var task: FutureTask<Unit>? = null
  }

  private val lock = Any()
  private val inFlight = mutableMapOf<K, Entry<V>>()

  fun cached(key: K): V? = synchronized(lock) { readCache(key) }

  fun subscribe(key: K, load: () -> V?, callback: (V?) -> Unit): AttachmentSubscription {
    var cached: V? = null
    var scheduled: Pair<Entry<V>, FutureTask<Unit>>? = null
    val subscriber = synchronized(lock) {
      // Recheck here: a view's earlier cache miss may already have completed.
      cached = readCache(key)
      if (cached != null) {
        Subscriber<V>(callback) { }
      } else {
        val entry = inFlight[key] ?: Entry<V>(load).also { entry ->
          inFlight[key] = entry
          val task = FutureTask(Runnable { runLoad(key, entry) }, Unit)
          entry.task = task
          scheduled = entry to task
        }
        Subscriber<V>(callback) { cancel(key, entry, it) }.also { entry.subscribers.add(it) }
      }
    }
    cached?.let { subscriber.deliver(it) }
    scheduled?.let { (entry, task) ->
      try {
        executor.execute(task)
      } catch (_: RejectedExecutionException) {
        complete(key, entry, null)
      }
    }
    return subscriber
  }

  private fun cancel(key: K, entry: Entry<V>, subscriber: Subscriber<V>) {
    val task = synchronized(lock) {
      entry.subscribers.remove(subscriber)
      if (inFlight[key] === entry && entry.subscribers.isEmpty()) {
        inFlight.remove(key)
        entry.task
      } else null
    }
    task?.let {
      it.cancel(true)
      // Remove abandoned queued work as well as interrupting an active load.
      (executor as? ThreadPoolExecutor)?.remove(it)
    }
  }

  private fun runLoad(key: K, entry: Entry<V>) {
    val active = synchronized(lock) { inFlight[key] === entry && entry.subscribers.isNotEmpty() }
    if (!active) return
    var result: V? = null
    try {
      result = entry.load()
    } catch (_: Exception) {
      // A failed resource remains retryable rather than becoming a cache hit.
    } finally {
      complete(key, entry, result)
    }
  }

  private fun complete(key: K, entry: Entry<V>, value: V?) {
    val subscribers = synchronized(lock) {
      // A canceled load can finish after a fresh request for the same key.
      if (inFlight[key] !== entry) return
      if (value != null) writeCache(key, value)
      inFlight.remove(key)
      entry.subscribers.toList().also { entry.subscribers.clear() }
    }
    // Never call consumers under the registry lock. Each claim is independent,
    // so cancellation after this snapshot still suppresses undelivered results.
    for (subscriber in subscribers) {
      try {
        subscriber.deliver(value)
      } catch (_: Exception) {
        // One detached consumer cannot prevent delivery to another subscriber.
      }
    }
  }
}
