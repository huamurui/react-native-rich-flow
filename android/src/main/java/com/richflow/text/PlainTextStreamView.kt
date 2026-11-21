package com.richflow.text

import android.annotation.SuppressLint
import android.content.Context
import android.text.Selection
import android.util.TypedValue
import android.view.View.MeasureSpec
import android.widget.TextView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

private fun JSONObject.streamVersion(key: String): Long? {
  val number = (opt(key) as? Number)?.toDouble() ?: return null
  return number.takeIf { it >= 1 && it <= 9_007_199_254_740_991.0 && it % 1 == 0.0 }?.toLong()
}

/** Keeps the same Android text buffer and selection spans across append operations. */
internal class StreamTextBuffer(private val view: FlowTextView) {
  var documentId = ""
    private set
  var version = 0L
    private set

  fun apply(json: JSONObject, resync: (String, Long) -> Unit) {
    val id = json.opt("documentId") as? String ?: return
    val next = json.streamVersion("version") ?: return
    val text = json.opt("text") as? String ?: return
    val kind = json.optString("kind")
    if (id.isEmpty() || next < version) return
    if (kind == "append" && next == version && id == documentId) return
    if (kind == "snapshot" && next == version && id != documentId) return
    if (kind == "append" && (id != documentId || json.streamVersion("baseVersion") != version || next == version)) {
      resync(id, next)
      return
    }
    if (kind != "append" && kind != "snapshot") return
    val buffer = view.editableText ?: run {
      view.setText(view.text, TextView.BufferType.EDITABLE)
      view.editableText
    }
    var unchanged = buffer.length
    if (kind == "snapshot") {
      unchanged = 0
      if (id == documentId) {
        val limit = min(text.length, buffer.length)
        while (unchanged < limit && text[unchanged] == buffer[unchanged]) unchanged++
        if (!validRichTextBoundary(unchanged, text) || !validRichTextBoundary(unchanged, buffer)) unchanged--
      }
    }
    val sourceStart = if (kind == "append") 0 else unchanged
    if (unchanged != buffer.length || sourceStart != text.length || id != documentId) {
      view.updateTextSelection(preserveMenu = true) { anchor, focus ->
        val retained = id == documentId && hasSelectionInPrefix(buffer, anchor, focus, unchanged)
        buffer.replace(unchanged, buffer.length, text, sourceStart, text.length)
        // The old EOF can fall inside a surrogate pair when the next chunk supplies its low half.
        retained && hasSelectionInPrefix(buffer, anchor, focus, unchanged)
      }
    }
    documentId = id
    version = next
  }
}

@SuppressLint("ViewConstructor")
class PlainTextStreamView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  override val shouldUseAndroidLayout = true
  private val onSelectionChange by EventDispatcher()
  private val onHeightChange by EventDispatcher()
  private val onResync by EventDispatcher()
  private val label = FlowTextView(context)
  private val buffer = StreamTextBuffer(label)
  private var updating = false
  private var selectionKey = ""
  private var lastMeasurement = ""
  private var textHeight = 0
  private var metrics = TextConfig()
  private var styleChanged = true
  var contentWidth = 0.0
  var selectable = true
  var pendingUpdate: String? = null

  init {
    label.setText("", TextView.BufferType.EDITABLE)
    label.selectionListener = { _, _ -> if (!updating) reportSelection() }
    addView(label)
  }

  fun setConfig(value: String) {
    val next = TextConfig.parse(value)
    if (next != metrics) { metrics = next; styleChanged = true }
  }

  fun commit() {
    updating = true
    if (label.isTextSelectable != selectable) {
      if (!selectable) label.editableText?.let(Selection::removeSelection)
      label.setTextIsSelectable(selectable)
      label.setText(label.text, TextView.BufferType.EDITABLE)
    }
    if (styleChanged) {
      label.setTextSize(TypedValue.COMPLEX_UNIT_SP, metrics.fontSize)
      val line = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, metrics.lineHeight, resources.displayMetrics)
      val leading = max(0f, line - label.paint.getFontMetricsInt(null))
      label.setLineSpacing(leading, 1f)
      // Android excludes line-spacing extra from the final line.
      label.setPadding(0, 0, 0, leading.roundToInt())
      label.setTextColor(metrics.textColor)
      styleChanged = false
    }
    pendingUpdate?.let { input ->
      val message = runCatching { JSONObject(input) }.getOrNull()
      if (message != null) buffer.apply(message) { id, wanted ->
        onResync(mapOf("documentId" to id, "version" to wanted.toDouble()))
      }
      pendingUpdate = null
    }
    updating = false
    reportSelection()
    measureContent()
    requestLayout()
  }

  private fun reportSelection() {
    if (buffer.version == 0L) return
    val lo = min(label.selectionStart, label.selectionEnd)
    val hi = max(label.selectionStart, label.selectionEnd)
    val text = label.text
    val active = selectable && hi > lo && validRichTextBoundary(lo, text) && validRichTextBoundary(hi, text)
    val start = if (active) lo else -1
    val end = if (active) hi else -1
    val key = "${buffer.version}/$start/$end"
    if (key == selectionKey) return
    selectionKey = key
    onSelectionChange(mapOf("documentId" to buffer.documentId, "version" to buffer.version.toDouble(), "start" to start, "end" to end))
  }

  private fun measureContent() {
    if (!contentWidth.isFinite() || contentWidth <= 0 || buffer.version == 0L) return
    val px = (contentWidth * resources.displayMetrics.density).roundToInt()
    label.measure(MeasureSpec.makeMeasureSpec(px, MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED))
    textHeight = if (label.length() == 0) 0 else label.measuredHeight
    val key = "${buffer.version}/$contentWidth/$textHeight"
    if (lastMeasurement == key) return
    lastMeasurement = key
    onHeightChange(mapOf("documentId" to buffer.documentId, "version" to buffer.version.toDouble(),
      "height" to textHeight / resources.displayMetrics.density.toDouble(), "contentWidth" to contentWidth))
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    measureContent()
  }

  override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
    label.layout(0, 0, r - l, textHeight)
  }
}
