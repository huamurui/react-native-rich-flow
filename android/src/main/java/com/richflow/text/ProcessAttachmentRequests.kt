package com.richflow.text

import android.util.LruCache
import android.content.ComponentCallbacks2
import android.content.Context
import android.content.res.Configuration
import org.json.JSONObject
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.ThreadFactory
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** One process-wide loading budget, independent of the number of mounted flows. */
internal object ProcessAttachmentRequests {
  private val cache = object : LruCache<String, AttachmentAsset>(24 * 1024 * 1024) {
    override fun sizeOf(key: String, value: AttachmentAsset): Int = value.bitmap.byteCount.coerceAtLeast(1)
  }
  private var callbacksRegistered = false

  @Synchronized
  fun observeMemory(context: Context) {
    if (callbacksRegistered) return
    callbacksRegistered = true
    context.applicationContext.registerComponentCallbacks(object : ComponentCallbacks2 {
      override fun onConfigurationChanged(configuration: Configuration) { }
      override fun onLowMemory() { cache.evictAll() }
      override fun onTrimMemory(level: Int) {
        if (level >= ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW) cache.evictAll()
      }
    })
  }

  private val threadSequence = AtomicInteger()
  private val executor = ThreadPoolExecutor(
    2, 2, 30, TimeUnit.SECONDS, LinkedBlockingQueue(),
    ThreadFactory { task ->
      Thread(task, "RichFlowAssets-${threadSequence.incrementAndGet()}").apply { isDaemon = true }
    }
  ).apply { allowCoreThreadTimeOut(true) }
  private val coordinator = AttachmentRequestCoordinator<String, AttachmentAsset>(
    executor,
    { key -> cache.get(key) },
    { key, value -> cache.put(key, value) }
  )

  fun cached(key: String): AttachmentAsset? = coordinator.cached(key)

  fun subscribe(
    key: String,
    spec: JSONObject,
    scale: Float,
    fontPx: Float,
    maxWidth: Float,
    callback: (AttachmentAsset?) -> Unit
  ): AttachmentSubscription = coordinator.subscribe(
    key,
    { AttachmentLoader.load(spec, scale, fontPx, maxWidth) },
    callback
  )
}
