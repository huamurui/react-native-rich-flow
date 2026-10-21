package com.richflow.text

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class AttachmentRequestCoordinatorTest {
  private data class Asset(val label: String)
  private val executors = mutableListOf<ThreadPoolExecutor>()

  private fun executor(afterTask: () -> Unit = {}): ThreadPoolExecutor {
    return object : ThreadPoolExecutor(2, 2, 30, TimeUnit.SECONDS, LinkedBlockingQueue()) {
      override fun afterExecute(task: Runnable, failure: Throwable?) {
        super.afterExecute(task, failure)
        afterTask()
      }
    }.also { executors.add(it) }
  }

  private fun coordinator(executor: ThreadPoolExecutor): AttachmentRequestCoordinator<String, Asset> {
    val cache = mutableMapOf<String, Asset>()
    return AttachmentRequestCoordinator(executor, { cache[it] }, { key, value -> cache[key] = value })
  }

  private fun await(latch: CountDownLatch) {
    assertTrue("The expected worker/callback must complete", latch.await(5, TimeUnit.SECONDS))
  }

  @After
  fun shutdown() {
    executors.forEach { it.shutdownNow() }
    executors.forEach { assertTrue(it.awaitTermination(5, TimeUnit.SECONDS)) }
  }

  @Test
  fun distinctKeysRespectTheSharedTwoWorkerBudget() {
    val coordinator = coordinator(executor())
    val release = CountDownLatch(1)
    val running = CountDownLatch(2)
    val completed = CountDownLatch(8)
    val active = AtomicInteger()
    val peak = AtomicInteger()
    val started = AtomicInteger()
    try {
      repeat(8) { index ->
        coordinator.subscribe("asset-$index", {
          started.incrementAndGet()
          val count = active.incrementAndGet()
          peak.updateAndGet { maxOf(it, count) }
          running.countDown()
          try {
            release.await()
            Asset("asset-$index")
          } finally {
            active.decrementAndGet()
          }
        }) { completed.countDown() }
      }
      await(running)
      assertEquals(2, started.get())
      release.countDown()
      await(completed)
      assertEquals(8, started.get())
      assertEquals(2, peak.get())
    } finally {
      release.countDown()
    }
  }

  @Test
  fun identicalKeysShareOneLoadAndAnEarlierCacheMissIsRechecked() {
    val coordinator = coordinator(executor())
    val release = CountDownLatch(1)
    val started = CountDownLatch(1)
    val completed = CountDownLatch(2)
    val loads = AtomicInteger()
    val results = Collections.synchronizedList(mutableListOf<Asset?>())
    val asset = Asset("decoded")
    try {
      assertNull(coordinator.cached("same"))
      coordinator.subscribe("same", {
        loads.incrementAndGet()
        started.countDown()
        release.await()
        asset
      }) { results.add(it); completed.countDown() }
      await(started)
      coordinator.subscribe("same", { loads.incrementAndGet(); Asset("duplicate") }) {
        results.add(it); completed.countDown()
      }
      assertEquals(1, loads.get())
      release.countDown()
      await(completed)
      assertEquals(2, results.size)
      results.forEach { assertSame(asset, it) }

      // A view that observed the earlier miss subscribes after completion.
      val late = CountDownLatch(1)
      coordinator.subscribe("same", { loads.incrementAndGet(); Asset("late-duplicate") }) {
        results.add(it); late.countDown()
      }
      await(late)
      assertEquals(1, loads.get())
      assertSame(asset, results.last())
    } finally {
      release.countDown()
    }
  }

  @Test
  fun cancelingOneSubscriberKeepsTheOtherSubscriberAndItsLoadAlive() {
    val coordinator = coordinator(executor())
    val started = CountDownLatch(1)
    val release = CountDownLatch(1)
    val completed = CountDownLatch(1)
    val interrupted = AtomicBoolean()
    val canceledCallbacks = AtomicInteger()
    val otherResults = Collections.synchronizedList(mutableListOf<Asset?>())
    val asset = Asset("shared")
    try {
      val first = coordinator.subscribe("shared", {
        started.countDown()
        try {
          release.await()
          asset
        } catch (failure: InterruptedException) {
          interrupted.set(true)
          throw failure
        }
      }) { canceledCallbacks.incrementAndGet() }
      await(started)
      coordinator.subscribe("shared", { Asset("unexpected-second-load") }) {
        otherResults.add(it); completed.countDown()
      }
      first.cancel()
      first.cancel()
      release.countDown()
      await(completed)
      assertFalse(interrupted.get())
      assertEquals(0, canceledCallbacks.get())
      assertSame(asset, otherResults.single())
    } finally {
      release.countDown()
    }
  }

  @Test
  fun cancelingEverySubscriberRemovesQueuedWorkAndAllowsRetry() {
    val pool = executor()
    val coordinator = coordinator(pool)
    val occupied = CountDownLatch(2)
    val release = CountDownLatch(1)
    val completed = CountDownLatch(3)
    val canceledLoads = AtomicInteger()
    val canceledCallbacks = AtomicInteger()
    val retriedLoads = AtomicInteger()
    try {
      repeat(2) { index ->
        coordinator.subscribe("block-$index", {
          occupied.countDown()
          release.await()
          Asset("block-$index")
        }) { completed.countDown() }
      }
      await(occupied)
      val first = coordinator.subscribe("queued", { canceledLoads.incrementAndGet(); Asset("old") }) {
        canceledCallbacks.incrementAndGet()
      }
      val second = coordinator.subscribe("queued", { canceledLoads.incrementAndGet(); Asset("duplicate-old") }) {
        canceledCallbacks.incrementAndGet()
      }
      first.cancel()
      second.cancel()
      assertTrue(pool.queue.isEmpty())
      coordinator.subscribe("queued", { retriedLoads.incrementAndGet(); Asset("retry") }) {
        completed.countDown()
      }
      release.countDown()
      await(completed)
      assertEquals(0, canceledLoads.get())
      assertEquals(0, canceledCallbacks.get())
      assertEquals(1, retriedLoads.get())
      assertEquals("retry", coordinator.cached("queued")?.label)
    } finally {
      release.countDown()
    }
  }

  @Test
  fun canceledNonCooperativeLoadCannotOverwriteAFreshRetry() {
    val tasksFinished = CountDownLatch(2)
    val coordinator = coordinator(executor { tasksFinished.countDown() })
    val started = CountDownLatch(1)
    val releaseOld = CountDownLatch(1)
    val interrupted = CountDownLatch(1)
    val retryCompleted = CountDownLatch(1)
    val canceledCallbacks = AtomicInteger()
    val fresh = Asset("fresh")
    try {
      val old = coordinator.subscribe("retry", {
        started.countDown()
        // Model a network read that continues despite Future.cancel(true).
        var released = false
        while (!released) {
          try {
            releaseOld.await()
            released = true
          } catch (_: InterruptedException) {
            interrupted.countDown()
          }
        }
        Asset("stale")
      }) { canceledCallbacks.incrementAndGet() }
      await(started)
      old.cancel()
      await(interrupted)
      coordinator.subscribe("retry", { fresh }) { retryCompleted.countDown() }
      await(retryCompleted)
      releaseOld.countDown()
      await(tasksFinished)
      assertEquals(0, canceledCallbacks.get())
      assertSame(fresh, coordinator.cached("retry"))
    } finally {
      releaseOld.countDown()
    }
  }

  @Test
  fun nullAndThrownFailuresRemainRetryable() {
    val coordinator = coordinator(executor())
    val results = Collections.synchronizedList(mutableListOf<Asset?>())
    val first = CountDownLatch(1)
    coordinator.subscribe("failure", { null }) { results.add(it); first.countDown() }
    await(first)
    assertNull(coordinator.cached("failure"))
    val second = CountDownLatch(1)
    coordinator.subscribe("failure", { throw IllegalStateException("decode-failed") }) {
      results.add(it); second.countDown()
    }
    await(second)
    assertNull(coordinator.cached("failure"))
    val asset = Asset("retry-success")
    val third = CountDownLatch(1)
    coordinator.subscribe("failure", { asset }) { results.add(it); third.countDown() }
    await(third)
    assertEquals(listOf(null, null, asset), results)
    assertSame(asset, coordinator.cached("failure"))
  }

  @Test
  fun cancelAfterCompletionSnapshotSuppressesAnUndeliveredCallback() {
    val finished = CountDownLatch(1)
    val coordinator = coordinator(executor { finished.countDown() })
    val releaseLoad = CountDownLatch(1)
    val deliveringFirst = CountDownLatch(1)
    val releaseFirst = CountDownLatch(1)
    val canceledCallbacks = AtomicInteger()
    try {
      coordinator.subscribe("snapshot", { releaseLoad.await(); Asset("decoded") }) {
        deliveringFirst.countDown()
        releaseFirst.await()
      }
      val second = coordinator.subscribe("snapshot", { Asset("unexpected-load") }) {
        canceledCallbacks.incrementAndGet()
      }
      releaseLoad.countDown()
      await(deliveringFirst)
      second.cancel()
      releaseFirst.countDown()
      await(finished)
      assertEquals(0, canceledCallbacks.get())
    } finally {
      releaseLoad.countDown()
      releaseFirst.countDown()
    }
  }

  @Test
  fun oneCallbackFailureDoesNotPreventDeliveryToAnotherSubscriber() {
    val coordinator = coordinator(executor())
    val release = CountDownLatch(1)
    val completed = CountDownLatch(1)
    val results = Collections.synchronizedList(mutableListOf<Asset?>())
    val asset = Asset("decoded")
    try {
      coordinator.subscribe("consumers", { release.await(); asset }) {
        throw IllegalStateException("detached-consumer")
      }
      coordinator.subscribe("consumers", { Asset("unexpected-load") }) {
        results.add(it); completed.countDown()
      }
      release.countDown()
      await(completed)
      assertSame(asset, results.single())
    } finally {
      release.countDown()
    }
  }
}
