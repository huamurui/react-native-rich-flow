package com.richflow.text

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.text.Layout
import android.text.SpannableString
import android.text.Spanned
import android.text.StaticLayout
import android.text.TextPaint
import android.text.style.BackgroundColorSpan
import android.text.style.RelativeSizeSpan
import android.text.style.ReplacementSpan
import android.view.Gravity
import android.view.View
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/** Real Android Layout/Canvas regressions, not mocked font metrics or snapshots. */
class InlineBackgroundRenderingTest {
  private val highlight = Color.rgb(255, 220, 40)
  private fun paint(size: Float = 32f) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = size
    color = Color.BLACK
  }
  private fun SpannableString.span(value: Any, start: Int, end: Int) {
    setSpan(value, start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
  }
  private fun layout(text: SpannableString, width: Int = 480, paint: TextPaint = paint()): StaticLayout =
    StaticLayout.Builder.obtain(text, 0, text.length, paint, width).setIncludePad(false).build()

  private fun backgrounds(layout: Layout): Bitmap = Bitmap.createBitmap(layout.width, max(1, layout.height), Bitmap.Config.ARGB_8888).also {
    InlineBackgroundRenderer().draw(Canvas(it), layout)
  }

  private fun filledBounds(bitmap: Bitmap, xStart: Int = 0, xEnd: Int = bitmap.width): Rect {
    val result = Rect(bitmap.width, bitmap.height, -1, -1)
    for (y in 0 until bitmap.height) for (x in max(0, xStart) until min(bitmap.width, xEnd)) {
      if (Color.alpha(bitmap.getPixel(x, y)) != 0) {
        result.left = min(result.left, x); result.top = min(result.top, y)
        result.right = max(result.right, x + 1); result.bottom = max(result.bottom, y + 1)
      }
    }
    return result
  }

  private fun paragraph(gap: Int, nativeBackground: Boolean = false): StaticLayout {
    val text = SpannableString("Highlight 汉字\nThe following paragraph.")
    val end = text.indexOf('\n') + 1
    text.span(ParagraphHeightSpan(TextRange(0, text.length), 52, 0, 0), 0, text.length)
    text.span(ParagraphHeightSpan(TextRange(0, end), 52, 0, gap), 0, end)
    text.span(if (nativeBackground) BackgroundColorSpan(highlight) else InlineBackgroundSpan(highlight), 0, end - 1)
    return layout(text)
  }

  @Test fun paragraphGapMovesTheNextParagraphWithoutExtendingCharacterBackground() {
    val ordinary = paragraph(0)
    val spaced = paragraph(80)
    val first = filledBounds(backgrounds(ordinary))
    val second = filledBounds(backgrounds(spaced))
    assertEquals(first.top - ordinary.getLineBaseline(0), second.top - spaced.getLineBaseline(0))
    assertEquals(first.bottom - ordinary.getLineBaseline(0), second.bottom - spaced.getLineBaseline(0))
    assertEquals(80, spaced.getLineBaseline(1) - ordinary.getLineBaseline(1))
    assertTrue("Paragraph spacing must remain outside the background", second.bottom < spaced.getLineBottom(0))

    // Retain a visual before/after pair in the test APK files for inspection.
    val beforeLayout = paragraph(80, nativeBackground = true)
    val before = Bitmap.createBitmap(beforeLayout.width, beforeLayout.height, Bitmap.Config.ARGB_8888)
    Canvas(before).apply { drawColor(Color.WHITE); beforeLayout.draw(this) }
    val after = Bitmap.createBitmap(spaced.width, spaced.height, Bitmap.Config.ARGB_8888)
    Canvas(after).apply { drawColor(Color.WHITE); InlineBackgroundRenderer().draw(this, spaced); spaced.draw(this) }
    save("rich-flow-background-before.png", before)
    save("rich-flow-background-after.png", after)
    assertEquals("The fix must not change text flow height", beforeLayout.height, spaced.height)
    assertEquals("The fix must preserve selectable text", beforeLayout.text.toString(), spaced.text.toString())
  }

  @Test fun tallAttachmentDoesNotStretchTheTextBackgroundOrAcquireAHighlight() {
    fun content(tall: Boolean): StaticLayout {
      val text = SpannableString("word \ufffc\nnext")
      text.span(InlineBackgroundSpan(highlight), 0, 6)
      text.span(TestAttachment(if (tall) 160 else 35), 5, 6)
      return layout(text)
    }
    val normal = content(false)
    val tall = content(true)
    val ordinaryBounds = filledBounds(backgrounds(normal))
    val tallBitmap = backgrounds(tall)
    val tallBounds = filledBounds(tallBitmap)
    assertEquals(ordinaryBounds.height(), tallBounds.height())
    assertEquals(ordinaryBounds.top - normal.getLineBaseline(0), tallBounds.top - tall.getLineBaseline(0))
    assertTrue(tall.height > normal.height)
    val attachmentX = ((tall.getPrimaryHorizontal(5) + tall.getPrimaryHorizontal(6)) / 2).toInt()
    for (y in 0 until tallBitmap.height) assertEquals("Attachment slot remains owned by ReplacementSpan", 0, Color.alpha(tallBitmap.getPixel(attachmentX, y)))
  }

  @Test fun rubyAndEmphasisReserveSpaceWithoutChangingTheBaseBackground() {
    fun content(annotated: Boolean): StaticLayout {
      val text = SpannableString("漢字\nnext")
      text.span(InlineBackgroundSpan(highlight), 0, 2)
      if (annotated) {
        val specs = listOf(
          JSONObject().put("kind", "ruby").put("start", 0).put("end", 2).put("text", "かんじ"),
          JSONObject().put("kind", "emphasis").put("start", 0).put("end", 2)
        )
        val flow = FlowData("annotations", "1", text.toString(), emptyList(), emptyList(), emptyList(), emptyList(), specs)
        val annotations = prepareAnnotations(flow, text, paint(), TextConfig(language = "ja"))
        text.span(AnnotationHeightSpan(annotations), 0, text.length)
      }
      return layout(text)
    }
    val plain = content(false)
    val annotated = content(true)
    val plainBounds = filledBounds(backgrounds(plain))
    val annotationBounds = filledBounds(backgrounds(annotated))
    assertEquals(plainBounds.height(), annotationBounds.height())
    assertEquals(plainBounds.top - plain.getLineBaseline(0), annotationBounds.top - annotated.getLineBaseline(0))
    assertTrue(annotated.height > plain.height)
  }

  @Test fun fontSizeAndSuperscriptDetermineTheirOwnBackgroundMetrics() {
    val text = SpannableString("BIG small2")
    text.span(InlineBackgroundSpan(highlight), 0, text.length)
    text.span(RelativeSizeSpan(1.8f), 0, 3)
    text.span(ScriptSpan(true), text.length - 1, text.length)
    val content = layout(text)
    val bitmap = backgrounds(content)
    fun column(offset: Int): Rect {
      val x = ((content.getPrimaryHorizontal(offset) + content.getPrimaryHorizontal(offset + 1)) / 2).toInt()
      return filledBounds(bitmap, x, x + 1)
    }
    val large = column(1)
    val normal = column(6)
    val superscript = column(text.length - 1)
    assertTrue(large.height() > normal.height())
    assertTrue(superscript.height() < normal.height())
    assertTrue(superscript.centerY() < normal.centerY())
  }

  @Test fun fallbackGlyphInkIsContainedByTheCharacterBackground() {
    val text = SpannableString("汉語かな ภาษาไทย 😀")
    text.span(InlineBackgroundSpan(highlight), 0, text.length)
    val content = layout(text, width = 700)
    val fill = backgrounds(content)
    val ink = Bitmap.createBitmap(content.width, content.height, Bitmap.Config.ARGB_8888)
    content.draw(Canvas(ink))
    var glyphPixels = 0
    for (y in 0 until ink.height) for (x in 0 until ink.width) {
      if (Color.alpha(ink.getPixel(x, y)) > 32) {
        glyphPixels++
        assertTrue("Fallback glyph ink at ($x,$y) must be covered", Color.alpha(fill.getPixel(x, y)) > 0)
      }
    }
    assertTrue(glyphPixels > 0)
  }

  @Test fun softWrapDoesNotFillTheContinuationAndTrailingSpacesRemainHighlighted() {
    val text = SpannableString("one two  three four  five  ")
    text.span(InlineBackgroundSpan(highlight), 0, text.length)
    val content = layout(text, width = 180, paint = paint(24f))
    val bitmap = backgrounds(content)
    assertTrue(content.lineCount > 1)
    for (line in 0 until content.lineCount) {
      val right = content.getLineRight(line) + max(0f, content.getLineWidth(line) - content.getLineMax(line))
      val row = content.getLineBaseline(line)
      for (x in ceil(right).toInt() until content.width) assertEquals("Soft wrap must not paint the remainder of the viewport", 0, Color.alpha(bitmap.getPixel(x, row)))
    }
    val lastNonSpace = text.toString().trimEnd().length
    val lastSpaceCenter = ((content.getPrimaryHorizontal(lastNonSpace) + content.getPrimaryHorizontal(text.length)) / 2).toInt()
    val baseline = content.getLineBaseline(content.lineCount - 1)
    assertTrue("Source trailing spaces remain part of inline code/highlight", Color.alpha(bitmap.getPixel(lastSpaceCenter, baseline)) > 0)
  }

  @Test fun mixedBidiPreservesTheDisjointVisualSelection() {
    val text = SpannableString("abc אבגד xyz")
    text.span(InlineBackgroundSpan(highlight), 1, 6)
    val content = layout(text)
    val bitmap = backgrounds(content)
    val path = Path().also { content.getSelectionPath(1, 6, it) }
    // Use the same Canvas rasterizer as the renderer. Region.setPath rounds
    // fractional path edges differently (for example 131.40625 on Android 16)
    // and is not a pixel-accurate reference for Canvas.drawPath.
    val selected = Bitmap.createBitmap(content.width, content.height, Bitmap.Config.ARGB_8888)
    Canvas(selected).drawPath(path, Paint().apply { color = highlight })
    val row = content.getLineBaseline(0)
    save("rich-flow-bidi-reference.png", selected)
    save("rich-flow-bidi-background.png", bitmap)
    var segments = 0
    var previous = false
    for (x in 0 until content.width) {
      val expected = Color.alpha(selected.getPixel(x, row)) > 0
      if (expected && !previous) segments++
      assertEquals("Bidi background at x=$x must follow the real selection path", expected, Color.alpha(bitmap.getPixel(x, row)) > 0)
      previous = expected
    }
    assertTrue("Fixture must exercise separate visual fragments", segments > 1)
  }

  @Test fun nestedTranslucentBackgroundUsesTheEffectiveSpanOnce() {
    val text = SpannableString("outer inner outer")
    text.span(InlineBackgroundSpan(0x80ff0000.toInt()), 0, text.length)
    text.span(InlineBackgroundSpan(0x800000ff.toInt()), 6, 11)
    val content = layout(text)
    val bitmap = backgrounds(content)
    val x = ((content.getPrimaryHorizontal(7) + content.getPrimaryHorizontal(8)) / 2).toInt()
    val pixel = bitmap.getPixel(x, content.getLineBaseline(0))
    assertEquals("Overlapping spans replace the effective background instead of stacking alpha", 128, Color.alpha(pixel))
    assertTrue(Color.blue(pixel) > Color.red(pixel))
  }

  @Test fun flowTextViewDrawsForegroundOverTheCharacterBackground() {
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    instrumentation.runOnMainSync {
      val text = SpannableString("Readable")
      text.span(InlineBackgroundSpan(Color.RED), 0, text.length)
      val view = FlowTextView(instrumentation.targetContext).apply {
        setTextColor(Color.WHITE)
        textSize = 28f
        gravity = Gravity.TOP or Gravity.LEFT
        setText(text, android.widget.TextView.BufferType.SPANNABLE)
      }
      view.measure(View.MeasureSpec.makeMeasureSpec(600, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
      view.layout(0, 0, view.measuredWidth, view.measuredHeight)
      val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
      view.draw(Canvas(bitmap))
      var white = 0
      var red = 0
      for (y in 0 until bitmap.height) for (x in 0 until bitmap.width) {
        val pixel = bitmap.getPixel(x, y)
        if (pixel == Color.WHITE) white++
        if (pixel == Color.RED) red++
      }
      assertTrue("The background is rendered", red > 0)
      assertTrue("TextView foreground is rendered above it", white > 0)
    }
  }

  private fun save(name: String, bitmap: Bitmap) {
    val context = InstrumentationRegistry.getInstrumentation().context
    val cache = context.getExternalFilesDir(null) ?: context.cacheDir
    File(cache, name).outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
  }

  private class TestAttachment(private val height: Int) : ReplacementSpan() {
    override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
      fm?.apply { ascent = -height; top = ascent; descent = 0; bottom = 0 }
      return 60
    }
    override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) = Unit
  }
}
