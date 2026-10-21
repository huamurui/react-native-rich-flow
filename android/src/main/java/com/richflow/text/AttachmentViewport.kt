package com.richflow.text

/** Preserve geometry while dropping pixels and invalidating late callbacks. */
internal class AttachmentVisibilityState {
  var active = false; private set
  var revision = 0; private set
  var hasAsset = false
  private var attempted = false

  fun setActive(value: Boolean): Boolean {
    if (active == value) return false
    active = value
    if (!value) { revision += 1; hasAsset = false; attempted = false }
    return true
  }

  fun beginLoad(): Int? {
    if (!active || hasAsset || attempted) return null
    attempted = true
    return revision
  }

  fun accepts(value: Int) = active && revision == value
}

internal fun intersectsAttachmentViewport(top: Float, bottom: Float, viewportTop: Float, viewportBottom: Float): Boolean =
  top.isFinite() && bottom.isFinite() && viewportTop.isFinite() && viewportBottom.isFinite() &&
    bottom > top && viewportBottom > viewportTop && bottom > viewportTop && top < viewportBottom
