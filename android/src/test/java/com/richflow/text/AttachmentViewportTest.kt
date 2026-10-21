package com.richflow.text
import org.junit.Assert.*
import org.junit.Test

class AttachmentViewportTest {
  @Test fun canceledViewportRequestCannotApplyAfterReentry() {
    val state = AttachmentVisibilityState()
    assertNull(state.beginLoad())
    state.setActive(true)
    val first = state.beginLoad()!!
    assertNull(state.beginLoad())
    state.setActive(false)
    assertFalse(state.accepts(first))
    state.setActive(true)
    val second = state.beginLoad()!!
    assertFalse(state.accepts(first))
    assertTrue(state.accepts(second))
    state.hasAsset = true
    assertNull(state.beginLoad())
    state.setActive(false)
    assertFalse(state.hasAsset)
  }
  @Test fun viewportRejectsInvalidGeometryAndRequiresIntersection() {
    assertTrue(intersectsAttachmentViewport(100f, 140f, 120f, 200f))
    assertFalse(intersectsAttachmentViewport(100f, 120f, 120f, 200f))
    assertFalse(intersectsAttachmentViewport(100f, 140f, Float.NaN, 200f))
    assertFalse(intersectsAttachmentViewport(100f, 140f, 200f, 120f))
  }
}
