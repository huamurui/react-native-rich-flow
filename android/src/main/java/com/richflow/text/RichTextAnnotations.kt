package com.richflow.text

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.icu.text.BreakIterator
import android.text.Layout
import android.text.Spanned
import android.text.TextPaint
import android.text.style.LineHeightSpan
import android.text.style.MetricAffectingSpan
import java.util.Locale
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

internal data class AnnotationGlyph(
  val range: TextRange,
  val fontSize: Float,
  val ascent: Float,
  val descent: Float
)

internal data class RichTextAnnotation(
  val kind: String,
  val position: String,
  val mark: String,
  val color: Int,
  val locale: Locale,
  val text: String,
  val rubyBoundaries: List<Int>,
  val glyphs: List<AnnotationGlyph>
)

private fun graphemeBoundaries(text: String, locale: Locale): List<Int> {
  val iterator = BreakIterator.getCharacterInstance(locale)
  iterator.setText(text)
  val result = mutableListOf<Int>()
  var offset = iterator.first()
  while (offset != BreakIterator.DONE) {
    result.add(offset)
    offset = iterator.next()
  }
  return result
}

internal fun prepareAnnotations(flow: FlowData, content: Spanned, basePaint: TextPaint, config: TextConfig): List<RichTextAnnotation> {
  if (flow.annotations.isEmpty()) return emptyList()
  val locale = config.language?.let(Locale::forLanguageTag) ?: Locale.getDefault()
  val boundaries = graphemeBoundaries(flow.text, locale)
  val ranges = boundaries.zipWithNext { start, end -> TextRange(start, end) }
  return flow.annotations.mapNotNull { spec ->
    val range = spec.range(flow.text) ?: return@mapNotNull null
    if (!hasGraphemeBoundaries(range, boundaries)) return@mapNotNull null
    val kind = spec.optString("kind")
    if (kind != "emphasis" && kind != "ruby") return@mapNotNull null
    val ruby = spec.opt("text") as? String ?: ""
    if (kind == "ruby" && (ruby.isEmpty() || ruby.any { it == '\n' || it == '\r' || it == '\u2028' || it == '\u2029' })) return@mapNotNull null
    if (kind == "ruby" && !acceptsRubyBase(flow.text.substring(range.start, range.end))) return@mapNotNull null
    val glyphs = ranges.filter { glyph ->
      if (glyph.start < range.start || glyph.end > range.end) return@filter false
      val value = flow.text.substring(glyph.start, glyph.end)
      if (kind == "emphasis") acceptsEmphasisGrapheme(value)
      else acceptsRubyGrapheme(value)
    }.map { glyph ->
      val paint = TextPaint(basePaint)
      content.getSpans(glyph.start, glyph.end, MetricAffectingSpan::class.java)
        .forEach { it.updateMeasureState(paint) }
      val metrics = paint.fontMetrics
      AnnotationGlyph(glyph, paint.textSize, metrics.ascent + paint.baselineShift, metrics.descent + paint.baselineShift)
    }
    if (glyphs.isEmpty()) return@mapNotNull null
    RichTextAnnotation(
      kind, annotationPosition(kind, spec.opt("position") as? String),
      spec.optString("mark").takeIf { it == "circle" || it == "sesame" } ?: "dot",
      parseColor(spec.optString("color"), config.textColor), locale, ruby,
      if (kind == "ruby") graphemeBoundaries(ruby, locale) else emptyList(), glyphs
    )
  }
}

private fun annotationHeight(kind: String, fontSize: Float, paint: Paint): Int {
  val gap = max(1f, fontSize * 0.1f)
  val height = if (kind == "ruby") {
    paint.textSize = fontSize * 0.5f
    val metrics = paint.fontMetrics
    metrics.descent - metrics.ascent
  } else max(2f, fontSize * 0.16f)
  return ceil(height + gap).toInt()
}

private data class LineBands(val over: AnnotationBand, val under: AnnotationBand)

private fun lineBands(annotations: List<RichTextAnnotation>, start: Int, end: Int, paint: Paint): LineBands {
  var over = AnnotationBand()
  var under = AnnotationBand()
  for (annotation in annotations) {
    val size = annotation.glyphs.filter { it.range.start < end && it.range.end > start }
      .maxOfOrNull { it.fontSize } ?: continue
    paint.textLocale = annotation.locale
    val height = annotationHeight(annotation.kind, size, paint)
    if (annotation.position == "over") over = over.include(annotation.kind, height)
    else under = under.include(annotation.kind, height)
  }
  return LineBands(over, under)
}

/** Extra ascent/descent preserves ordinary selection, copying and glyph offsets. */
internal class AnnotationHeightSpan(private val annotations: List<RichTextAnnotation>) : LineHeightSpan {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  override fun chooseHeight(text: CharSequence, start: Int, end: Int, spanstartv: Int, v: Int, fm: Paint.FontMetricsInt) {
    val bands = lineBands(annotations, start, end, paint)
    fm.ascent -= bands.over.total
    fm.top = min(fm.top, fm.ascent)
    fm.descent += bands.under.total
    fm.bottom = max(fm.bottom, fm.descent)
  }
}

private data class RubyFragment(
  val line: Int,
  val first: Int,
  var end: Int,
  var left: Float,
  var right: Float,
  var fontSize: Float,
  var ascent: Float,
  var descent: Float
)

/** Draw annotation geometry from system selection rectangles, including bidi runs. */
internal class AnnotationRenderer {
  private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val spacingPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val selectionPath = Path()
  private val clipPath = Path()
  private val bounds = RectF()

  private fun glyphRect(layout: Layout, glyph: AnnotationGlyph, line: Int): RectF? {
    selectionPath.reset()
    layout.getSelectionPath(glyph.range.start, glyph.range.end, selectionPath)
    // At a soft wrap the end caret belongs to the next line. Clip selection
    // continuation rectangles to this line's real visual content extent.
    clipPath.reset()
    clipPath.addRect(layout.getLineLeft(line), layout.getLineTop(line).toFloat(), layout.getLineRight(line), layout.getLineBottom(line).toFloat(), Path.Direction.CW)
    selectionPath.op(clipPath, Path.Op.INTERSECT)
    selectionPath.computeBounds(bounds, true)
    return if (bounds.width() > 0 && bounds.left.isFinite() && bounds.right.isFinite()) RectF(bounds) else null
  }

  fun draw(canvas: Canvas, layout: Layout, annotations: List<RichTextAnnotation>) {
    if (annotations.isEmpty()) return
    val bands = mutableMapOf<Int, LineBands>()
    fun band(line: Int): LineBands = bands.getOrPut(line) {
      lineBands(annotations, layout.getLineStart(line), layout.getLineEnd(line), spacingPaint)
    }
    for (annotation in annotations) {
      paint.color = annotation.color
      paint.textLocale = annotation.locale
      paint.pathEffect = null
      paint.textScaleX = 1f
      paint.style = Paint.Style.FILL
      if (annotation.kind == "emphasis") {
        for (glyph in annotation.glyphs) {
          val line = layout.getLineForOffset(glyph.range.start)
          val rect = glyphRect(layout, glyph, line) ?: continue
          val size = max(2f, glyph.fontSize * 0.16f)
          val gap = max(1f, glyph.fontSize * 0.1f)
          val baseline = layout.getLineBaseline(line)
          val centerY = if (annotation.position == "over") baseline + glyph.ascent - gap / 2 - size / 2
            else baseline + glyph.descent + gap / 2 + size / 2
          val centerX = rect.centerX()
          paint.strokeWidth = max(1f, size * 0.2f)
          paint.style = if (annotation.mark == "circle") Paint.Style.STROKE else Paint.Style.FILL
          if (annotation.mark == "sesame") {
            canvas.save()
            canvas.rotate(-30f, centerX, centerY)
            canvas.drawOval(centerX - size * 0.28f, centerY - size * 0.5f, centerX + size * 0.28f, centerY + size * 0.5f, paint)
            canvas.restore()
          } else {
            val radius = if (annotation.mark == "circle") max(0.5f, (size - paint.strokeWidth) / 2) else size / 2
            canvas.drawCircle(centerX, centerY, radius, paint)
          }
        }
      } else {
        val fragments = mutableListOf<RubyFragment>()
        annotation.glyphs.forEachIndexed { index, glyph ->
          val line = layout.getLineForOffset(glyph.range.start)
          val rect = glyphRect(layout, glyph, line) ?: return@forEachIndexed
          val previous = fragments.lastOrNull()
          val contiguous = previous != null && previous.line == line && previous.end == index &&
            (rect.left <= previous.right && rect.right >= previous.left ||
              abs(rect.left - previous.right) <= glyph.fontSize * 0.25f || abs(rect.right - previous.left) <= glyph.fontSize * 0.25f)
          if (previous != null && contiguous) {
            previous.end = index + 1
            previous.left = min(previous.left, rect.left)
            previous.right = max(previous.right, rect.right)
            previous.fontSize = max(previous.fontSize, glyph.fontSize)
            previous.ascent = min(previous.ascent, glyph.ascent)
            previous.descent = max(previous.descent, glyph.descent)
          } else fragments.add(RubyFragment(line, index, index + 1, rect.left, rect.right, glyph.fontSize, glyph.ascent, glyph.descent))
        }
        for (fragment in fragments) {
          val slice = rubySliceRange(annotation.glyphs.size, fragment.first, fragment.end, annotation.rubyBoundaries) ?: continue
          val reading = annotation.text.substring(slice.start, slice.end)
          paint.textSize = fragment.fontSize * 0.5f
          paint.textScaleX = 1f
          paint.style = Paint.Style.FILL
          paint.textAlign = Paint.Align.CENTER
          val naturalWidth = paint.measureText(reading)
          if (naturalWidth <= 0) continue
          paint.textScaleX = min(1f, (fragment.right - fragment.left) / naturalWidth)
          val metrics = paint.fontMetrics
          val gap = max(1f, fragment.fontSize * 0.1f)
          val lineBand = band(fragment.line)
          val baseline = layout.getLineBaseline(fragment.line)
          val y = if (annotation.position == "over") baseline + fragment.ascent - gap / 2 - lineBand.over.emphasis - metrics.descent
            else baseline + fragment.descent + gap / 2 + lineBand.under.emphasis - metrics.ascent
          canvas.drawText(reading, (fragment.left + fragment.right) / 2, y, paint)
        }
      }
    }
    paint.textScaleX = 1f
    paint.textAlign = Paint.Align.LEFT
  }
}
