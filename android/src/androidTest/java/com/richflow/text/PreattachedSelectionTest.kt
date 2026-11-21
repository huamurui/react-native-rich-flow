package com.richflow.text

import android.app.Activity
import android.content.Intent
import android.os.SystemClock
import android.text.Layout
import android.text.Selection
import android.text.Spannable
import android.view.ActionMode
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View.MeasureSpec
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.TextView
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

class SelectionHostActivity : Activity() {
  var currentMode: ActionMode? = null
  override fun onActionModeStarted(mode: ActionMode) {
    super.onActionModeStarted(mode)
    currentMode = mode
  }
  override fun onActionModeFinished(mode: ActionMode) {
    super.onActionModeFinished(mode)
    if (currentMode === mode) currentMode = null
  }
}

class PreattachedSelectionTest {
  @Test fun firstLongPressSelectsAfterDetachedMeasurementAndReattachmentPreservesTheRange() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val activity = instrumentation.startActivitySync(
      Intent(instrumentation.targetContext, SelectionHostActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    ) as SelectionHostActivity
    val location = IntArray(2)
    lateinit var view: FlowTextView
    lateinit var host: FrameLayout
    lateinit var detachedLayout: Layout
    try {
      instrumentation.runOnMainSync {
        host = FrameLayout(activity)
        activity.setContentView(host)
        view = FlowTextView(activity).apply {
          setText("alpha beta", TextView.BufferType.SPANNABLE)
          isCursorVisible = false
          layoutParams = FrameLayout.LayoutParams(400, 120)
          measure(MeasureSpec.makeMeasureSpec(400, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(120, MeasureSpec.EXACTLY))
          layout(0, 0, 400, 120)
        }
        assertFalse(view.isAttachedToWindow)
        assertNotNull(view.layout)
        detachedLayout = view.layout
        host.addView(view)
      }
      instrumentation.waitForIdleSync()
      instrumentation.runOnMainSync {
        assertSame("Mount must reuse the precomputed layout", detachedLayout, view.layout)
        location[0] = view.layout.getPrimaryHorizontal(2).toInt() + view.totalPaddingLeft
        location[1] = (view.layout.getLineTop(0) + view.layout.getLineBottom(0)) / 2 + view.totalPaddingTop
        assertFalse(view.isCursorVisible)
      }
      val down = SystemClock.uptimeMillis()
      fun touch(action: Int) {
        val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, location[0].toFloat(), location[1].toFloat(), 0)
        try {
          event.source = InputDevice.SOURCE_TOUCHSCREEN
          instrumentation.runOnMainSync { view.dispatchTouchEvent(event) }
        } finally { event.recycle() }
      }
      touch(MotionEvent.ACTION_DOWN)
      SystemClock.sleep(ViewConfiguration.getLongPressTimeout().toLong() + 200)
      touch(MotionEvent.ACTION_UP)
      instrumentation.waitForIdleSync()
      instrumentation.runOnMainSync {
        assertTrue("Long press must create a real system selection", view.selectionEnd > view.selectionStart && view.selectionStart >= 0)
        activity.currentMode?.finish()
        view.clearFocus()
      }
      instrumentation.waitForIdleSync()
      instrumentation.runOnMainSync {
        host.removeView(view)
        val buffer = view.text as Spannable
        Selection.setSelection(buffer, 1, 4)
        host.addView(view)
        assertSame(buffer, view.text)
        assertEquals(1, view.selectionStart)
        assertEquals(4, view.selectionEnd)
        assertFalse(view.isCursorVisible)
        Selection.removeSelection(buffer)
        view.setTextIsSelectable(false)
      }
    } finally {
      instrumentation.runOnMainSync {
        activity.currentMode?.finish()
        activity.finish()
      }
      instrumentation.waitForIdleSync()
    }
  }
}
