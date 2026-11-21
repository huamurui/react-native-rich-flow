package com.richflow.text

import android.text.Editable
import android.text.Selection
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class StreamTextBufferTest {
  @Test fun systemCopySurvivesInPlaceAppendsAndCorrectedSnapshots() {
    lateinit var model: StreamTextBuffer
    lateinit var original: Editable
    assertSystemCopyAfterUpdates { view, n ->
      if (n == 1) model = StreamTextBuffer(view)
      val (kind, text) = when (n) {
        1 -> "snapshot" to "copy prefix"
        2 -> "append" to " provisional"
        3 -> "snapshot" to "copy prefix corrected"
        4 -> "append" to " again"
        else -> "snapshot" to "copy prefix final"
      }
      val update = JSONObject().put("kind", kind).put("version", n).put("documentId", "message")
        .put("text", text).put("baseVersion", n - 1)
      model.apply(update) { _, _ -> fail("Unexpected resync") }
      if (n == 1) original = view.editableText else assertSame(original, view.editableText)
    }
  }

  @Test fun appendingTheLowHalfOfASurrogatePairClearsOnlyTheSplitSelection() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      for (end in 1..2) {
        val view = FlowTextView(instrumentation.targetContext)
        val model = StreamTextBuffer(view)
        val first = JSONObject().put("kind", "snapshot").put("version", 1)
          .put("documentId", "message").put("text", "x\ud83d")
        model.apply(first) { _, _ -> fail() }
        val original = view.editableText
        Selection.setSelection(original, end, 0)
        val next = JSONObject().put("kind", "append").put("version", 2).put("baseVersion", 1)
          .put("documentId", "message").put("text", "\ude00")
        model.apply(next) { _, _ -> fail() }
        assertSame(original, view.editableText)
        assertEquals("x😀", original.toString())
        if (end == 1) {
          assertEquals(1, view.selectionStart)
          assertEquals(0, view.selectionEnd)
        } else {
          assertFalse(view.hasSelection())
        }
      }
    }
  }

  @Test fun keepsSelectionAtPreviousEndAndRecoversMissedAppends() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      val view = FlowTextView(instrumentation.targetContext)
      val model = StreamTextBuffer(view)
      var missing = 0L
      fun send(kind: String, version: Long, text: String, base: Long = 0, id: String = "message") {
        val update = JSONObject().put("kind", kind).put("version", version).put("documentId", id)
          .put("text", text).put("baseVersion", base)
        model.apply(update) { _, wanted -> missing = wanted }
      }
      send("snapshot", 1, "a😀中")
      val original = view.editableText
      Selection.setSelection(original, 1, 4)
      send("append", 2, "\nnext", 1)
      assertSame(original, view.editableText)
      assertEquals("😀中", view.text.subSequence(view.selectionStart, view.selectionEnd).toString())
      send("append", 4, "lost", 3)
      assertEquals(4L, missing)
      assertEquals(2L, model.version)
      send("snapshot", 4, "a😀中\nnext and more")
      assertSame(original, view.editableText)
      assertEquals(1, view.selectionStart)
      assertEquals(4, view.selectionEnd)
      assertEquals("😀中", view.text.subSequence(view.selectionStart, view.selectionEnd).toString())
      send("append", 2, "stale", 1)
      assertEquals("a😀中\nnext and more", view.text.toString())
      model.apply(JSONObject().put("kind", "snapshot").put("version", "99").put("documentId", "message").put("text", "wrong")) { _, _ -> fail() }
      assertEquals(4L, model.version)
      send("snapshot", 4, "a😁")
      assertEquals("a😁", view.text.toString())
      assertFalse("A selection crossing a corrected emoji must clear", view.hasSelection())
      Selection.setSelection(original, 0, 1)
      send("snapshot", 5, "another answer", id = "other")
      assertFalse(view.hasSelection())
    }
  }
}
