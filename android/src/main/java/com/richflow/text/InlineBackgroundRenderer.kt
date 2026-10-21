package com.richflow.text

import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.os.Build
import android.text.Layout
import android.text.Spanned
import android.text.TextPaint
import android.text.style.CharacterStyle
import android.text.style.MetricAffectingSpan
import android.text.style.ReplacementSpan
import kotlin.math.max
import kotlin.math.min

/** A character background, independent of the line's paragraph/annotation space. */
internal class InlineBackgroundSpan(val color: Int) : CharacterStyle() {
  // BackgroundColorSpan writes TextPaint.bgColor, which TextLine paints across
  // the entire line box, including spacing supplied by LineHeightSpan.
  override fun updateDrawState(paint: TextPaint) = Unit
}

/** Draws character backgrounds before TextView draws selection and foreground. */
internal class InlineBackgroundRenderer {
  private val fillPaint = Paint()
  private val runPaint = TextPaint()
  private val metrics = Paint.FontMetricsInt()
  private val inkBounds = Rect()
  private val selection = Path()
  private val lineClip = Path()
  private val bounds = RectF()
  private val transform = Matrix()
  private val visible = Rect()

  fun draw(canvas: Canvas, layout: Layout) {
    val text = layout.text as? Spanned ?: return
    if (text.isEmpty() || text.getSpans(0, text.length, InlineBackgroundSpan::class.java).isEmpty()) return
    canvas.getClipBounds(visible)
    val firstLine = layout.getLineForVertical(max(0, visible.top))
    val lastLine = layout.getLineForVertical(min(layout.height, visible.bottom))
    for (line in firstLine..lastLine) {
      val lineStart = layout.getLineStart(line)
      var lineEnd = layout.getLineEnd(line)
      while (lineEnd > lineStart && isLineSeparator(text[lineEnd - 1])) lineEnd--
      var start = lineStart
      while (start < lineEnd) {
        val backgroundEnd = text.nextSpanTransition(start, lineEnd, InlineBackgroundSpan::class.java)
        val metricEnd = text.nextSpanTransition(start, lineEnd, MetricAffectingSpan::class.java)
        val end = min(backgroundEnd, metricEnd)
        val background = text.getSpans(start, end, InlineBackgroundSpan::class.java).lastOrNull()
        if (background != null && background.color != 0) {
          val styles = text.getSpans(start, end, MetricAffectingSpan::class.java)
          // ReplacementSpan owns its slot's appearance. A text highlight must
          // not start painting images just because they share a styled range.
          if (styles.none { it is ReplacementSpan }) {
            runPaint.set(layout.paint)
            for (style in styles) style.updateDrawState(runPaint)
            fillPaint.color = background.color
            // Each direction uses its own shaping context; never split UTF-16
            // surrogate pairs or replace a bidi selection by its bounding box.
            var runStart = start
            while (runStart < end) {
              val rtl = layout.isRtlCharAt(runStart)
              var runEnd = runStart + Character.charCount(Character.codePointAt(text, runStart))
              while (runEnd < end && layout.isRtlCharAt(runEnd) == rtl) {
                runEnd += Character.charCount(Character.codePointAt(text, runEnd))
              }
              drawRun(canvas, layout, text, line, runStart, min(runEnd, end), start, end, rtl)
              runStart = runEnd
            }
          }
        }
        start = end
      }
    }
  }

  private fun drawRun(
    canvas: Canvas, layout: Layout, text: Spanned, line: Int,
    start: Int, end: Int, contextStart: Int, contextEnd: Int, rtl: Boolean
  ) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      // Unlike Paint.fontMetrics, this includes the fonts actually selected
      // for CJK, emoji, and other fallback characters in this text run.
      runPaint.getFontMetricsInt(text, start, end - start, contextStart, contextEnd - contextStart, rtl, metrics)
    } else {
      runPaint.getFontMetricsInt(metrics)
      // Older Android exposes no fallback-aware run metrics. Include the
      // actual glyph ink so fallback/combining glyphs remain inside the fill.
      runPaint.getTextBounds(text.toString(), start, end, inkBounds)
      metrics.ascent = min(metrics.ascent, inkBounds.top)
      metrics.descent = max(metrics.descent, inkBounds.bottom)
    }
    val baseline = layout.getLineBaseline(line) + runPaint.baselineShift
    val top = (baseline + metrics.ascent).toFloat()
    val bottom = (baseline + metrics.descent).toFloat()
    if (bottom <= top) return

    layout.getSelectionPath(start, end, selection)
    // A soft-wrap endpoint belongs to the next line. Selection adds a full
    // continuation rectangle; keep only this line's actual text advance.
    // getLineLeft/Right omit trailing whitespace, while code backgrounds must
    // retain spaces that are part of the source.
    val trailingAdvance = max(0f, layout.getLineWidth(line) - layout.getLineMax(line))
    val paragraphRtl = layout.getParagraphDirection(line) < 0
    val left = layout.getLineLeft(line) - if (paragraphRtl) trailingAdvance else 0f
    val right = layout.getLineRight(line) + if (paragraphRtl) 0f else trailingAdvance
    lineClip.reset()
    lineClip.addRect(left, layout.getLineTop(line).toFloat(), right, layout.getLineBottom(line).toFloat(), Path.Direction.CW)
    if (!selection.op(lineClip, Path.Op.INTERSECT) || selection.isEmpty) return
    selection.computeBounds(bounds, true)
    if (bounds.height() <= 0f) return
    // Preserve every horizontal path segment. Only map the selection's line
    // height to the run's typographic box; no paragraph padding is subtracted.
    val scale = (bottom - top) / bounds.height()
    transform.setScale(1f, scale)
    transform.postTranslate(0f, top - bounds.top * scale)
    selection.transform(transform)
    canvas.drawPath(selection, fillPaint)
  }
}

private fun isLineSeparator(value: Char): Boolean =
  value == '\n' || value == '\r' || value == '\u2028' || value == '\u2029'
