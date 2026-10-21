package com.richflow.text

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.text.Layout
import android.text.TextPaint
import android.text.style.LeadingMarginSpan
import android.text.style.LineHeightSpan
import android.text.style.MetricAffectingSpan
import kotlin.math.ceil
import kotlin.math.max

/** Minimum line height: tall replacement spans retain their natural metrics. */
internal class ParagraphHeightSpan(
  private val range: TextRange,
  private val minimumHeight: Int,
  private val marginTop: Int,
  private val marginBottom: Int
) : LineHeightSpan {
  override fun chooseHeight(
    text: CharSequence, start: Int, end: Int, spanstartv: Int, v: Int, fm: Paint.FontMetricsInt
  ) {
    val extra = max(0, minimumHeight - (fm.descent - fm.ascent))
    val above = ceil(extra / 2f).toInt()
    fm.ascent -= above
    fm.top = minOf(fm.top, fm.ascent)
    fm.descent += extra - above
    if (start <= range.start) {
      fm.ascent -= marginTop
      fm.top -= marginTop
    }
    if (end >= range.end) {
      fm.descent += marginBottom
    }
    fm.bottom = max(fm.bottom, fm.descent)
  }
}

internal class ScriptSpan(private val superscript: Boolean) : MetricAffectingSpan() {
  override fun updateDrawState(paint: TextPaint) = apply(paint)
  override fun updateMeasureState(paint: TextPaint) = apply(paint)

  private fun apply(paint: TextPaint) {
    paint.baselineShift += (paint.ascent() * if (superscript) 0.35f else -0.2f).toInt()
    paint.textSize *= 0.75f
  }
}

internal class MonoSpan : MetricAffectingSpan() {
  override fun updateDrawState(paint: TextPaint) { paint.typeface = Typeface.MONOSPACE }
  override fun updateMeasureState(paint: TextPaint) { paint.typeface = Typeface.MONOSPACE }
}

internal class QuoteMarginSpan(
  private val range: TextRange,
  private val color: Int,
  private val stripeWidth: Int,
  private val gapWidth: Int,
  private val trailingSpacing: Int
) : LeadingMarginSpan {
  override fun getLeadingMargin(first: Boolean) = stripeWidth + gapWidth

  override fun drawLeadingMargin(
    canvas: Canvas, paint: Paint, x: Int, dir: Int, top: Int, baseline: Int, bottom: Int,
    text: CharSequence, start: Int, end: Int, first: Boolean, layout: Layout
  ) {
    val previousColor = paint.color
    val previousStyle = paint.style
    paint.color = color
    paint.style = Paint.Style.FILL
    val other = x + dir * stripeWidth
    // The callback's visible end excludes the paragraph newline and trailing
    // spaces. Use the full layout line end to identify the paragraph's last
    // visual line, then exclude its external gap from the quote stripe.
    val fullLineEnd = layout.getLineEnd(layout.getLineForOffset(start))
    val stripeBottom = quoteStripeBottom(top, bottom, fullLineEnd, range.end, trailingSpacing)
    canvas.drawRect(minOf(x, other).toFloat(), top.toFloat(), max(x, other).toFloat(), stripeBottom.toFloat(), paint)
    paint.color = previousColor
    paint.style = previousStyle
  }
}
