package com.richflow.text

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.os.SystemClock
import android.text.Selection
import android.text.Spannable
import android.text.SpannableString
import android.text.Spanned
import android.text.style.RelativeSizeSpan
import android.text.style.StyleSpan
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class RichFlowSnapshotTest {
  private fun flow(version: String, text: String, id: String = "message", slots: List<JSONObject> = emptyList()) =
    FlowData(id, version, text, emptyList(), emptyList(), emptyList(), slots)

  @Test fun replacesHeadingBoldAndCodeStylesWhileKeepingTheRangeInTheExistingView() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      val view = FlowTextView(instrumentation.targetContext)
      val text = "Title\nbold\ncode"
      view.setStyledSnapshot(flow("plain", text), SpannableString(text), false)
      Selection.setSelection(view.text as Spannable, 10, 6)
      val styled = SpannableString(text).apply {
        setSpan(RelativeSizeSpan(1.6f), 0, 5, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        setSpan(StyleSpan(Typeface.BOLD), 6, 10, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        setSpan(MonoSpan(), 11, 15, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      view.setStyledSnapshot(flow("formatted", text), styled, true)
      val displayed = view.text as Spanned
      assertEquals(1, displayed.getSpans(0, 5, RelativeSizeSpan::class.java).size)
      assertEquals(Typeface.BOLD, displayed.getSpans(6, 10, StyleSpan::class.java).single().style)
      assertEquals(1, displayed.getSpans(11, 15, MonoSpan::class.java).size)
      assertEquals(10, view.selectionStart)
      assertEquals(6, view.selectionEnd)
      val edited = "Title\nnew word\ncode"
      view.setStyledSnapshot(flow("rewrite", edited), SpannableString(edited), true)
      assertFalse(view.hasSelection())
    }
  }

  @Test fun requiresOptInSameDocumentAndIdenticalAttachmentCopyText() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      val view = FlowTextView(instrumentation.targetContext)
      fun show(version: String, text: String, copy: String, preserve: Boolean, id: String = "message") {
        val slot = JSONObject().put("start", 1).put("end", 2).put("copyText", copy)
        view.setStyledSnapshot(flow(version, text, id, listOf(slot)), SpannableString(text), preserve)
      }
      show("1", "A\ufffcB", "x²", false)
      Selection.setSelection(view.text as Spannable, 0, 3)
      show("2", "A\ufffcB!", "x²", true)
      assertEquals(0, view.selectionStart)
      assertEquals(3, view.selectionEnd)
      show("3", "A\ufffcB!", "x³", true)
      assertFalse(view.hasSelection())
      Selection.setSelection(view.text as Spannable, 0, 1)
      show("4", "A\ufffcB!!", "x³", false)
      assertFalse(view.hasSelection())
      Selection.setSelection(view.text as Spannable, 0, 1)
      show("4", "A\ufffcB!!", "x³", true, "other")
      assertFalse(view.hasSelection())
    }
  }

  @Test fun systemCopyActionStillCopiesTheSelectedPrefixAfterStyledAppends() {
    assertSystemCopyAfterUpdates { view, n ->
      val text = "copy prefix" + "!".repeat(n - 1)
      val styled = SpannableString(text).apply {
        if (n > 1) setSpan(StyleSpan(Typeface.BOLD), 5, 11, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
      }
      view.setStyledSnapshot(flow("$n", text), styled, true)
      view.copyResolver = { start, end -> view.text.subSequence(start, end).toString() }
    }
  }
}

/** Open Android's native selection once, then invoke Copy on its menu after four updates. */
internal fun assertSystemCopyAfterUpdates(update: (FlowTextView, Int) -> Unit) {
  val instrumentation = InstrumentationRegistry.getInstrumentation()
  val activity = instrumentation.startActivitySync(
    Intent(instrumentation.targetContext, SelectionHostActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  ) as SelectionHostActivity
  lateinit var view: FlowTextView
  fun awaitUi(description: String, condition: () -> Boolean) {
    val deadline = SystemClock.uptimeMillis() + 5000
    do {
      var ready = false
      instrumentation.runOnMainSync { ready = condition() }
      if (ready) return
      SystemClock.sleep(25)
    } while (SystemClock.uptimeMillis() < deadline)
    fail(description)
  }
  try {
    instrumentation.runOnMainSync {
      view = FlowTextView(activity)
      activity.setContentView(view)
      update(view, 1)
    }
    awaitUi("Test window must have focus") { view.hasWindowFocus() && view.layout != null }
    instrumentation.runOnMainSync {
      val range = Bundle().apply {
        putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, 5)
        putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, 11)
      }
      assertTrue(view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, range))
    }
    fun hasCopy() = activity.currentMode?.menu?.findItem(android.R.id.copy)?.isEnabled == true
    awaitUi("System Copy must be available before receiving more content", ::hasCopy)
    for (n in 2..5) {
      instrumentation.runOnMainSync { update(view, n) }
      SystemClock.sleep(16)
    }
    awaitUi("System Copy must return after the final update", ::hasCopy)
    instrumentation.runOnMainSync {
      assertEquals(5, view.selectionStart)
      assertEquals(11, view.selectionEnd)
      val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
      clipboard.setPrimaryClip(ClipData.newPlainText("", "before Copy"))
      assertTrue(activity.currentMode!!.menu.performIdentifierAction(android.R.id.copy, 0))
      assertEquals("prefix", clipboard.primaryClip?.getItemAt(0)?.text?.toString())
    }
  } finally {
    instrumentation.runOnMainSync {
      activity.currentMode?.finish()
      activity.finish()
    }
    instrumentation.waitForIdleSync()
  }
}
