package com.richflow.text

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import android.text.style.ReplacementSpan
import android.util.Base64
import com.caverock.androidsvg.SVG
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLDecoder
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

internal data class AttachmentAsset(
  val bitmap: Bitmap,
  val width: Float,
  val height: Float,
  val baselineOffset: Float?
)

internal class InlineAttachmentSpan(
  private val spec: JSONObject,
  private val scale: Float,
  private val fontPx: Float,
  private val maxWidth: Float,
  private val placeholderColor: Int,
  textColor: Int
) : ReplacementSpan() {
  private var asset: AttachmentAsset? = null
  private var widthPx = initialSize("width", fontPx * if (spec.optString("kind") == "formula") 2f else 1.5f)
  private var heightPx = initialSize("height", fontPx * 1.3f)
  private var baselinePx = (spec.number("baselineOffset", 0.0).toFloat() * scale).coerceIn(-2048f, 2048f)
  private val rect = RectF()
  private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  // Keep the TextView's paint and cached asset free of theme-specific colors.
  private val formulaPaint = if (spec.optString("kind") == "formula") {
    Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
      colorFilter = PorterDuffColorFilter(textColor, PorterDuff.Mode.SRC_IN)
    }
  } else null

  init {
    val fit = min(1f, min(maxWidth / widthPx, 2048f / max(widthPx, heightPx)))
    widthPx = max(1f, widthPx * fit); heightPx = max(1f, heightPx * fit); baselinePx *= fit
  }

  fun releaseAsset() { asset = null }

  fun setAsset(value: AttachmentAsset) {
    asset = value
    val ratio = if (value.width > maxWidth) maxWidth / value.width else 1f
    widthPx = value.width * ratio
    heightPx = value.height * ratio
    val baseline = spec.number("baselineOffset").toFloat().takeIf { it.isFinite() }?.times(scale) ?: value.baselineOffset ?: 0f
    baselinePx = (baseline * ratio).coerceIn(-2048f, 2048f)
  }

  override fun getSize(paint: Paint, text: CharSequence, start: Int, end: Int, fm: Paint.FontMetricsInt?): Int {
    if (fm != null) {
      val metrics = paint.fontMetricsInt
      fm.ascent = min(metrics.ascent, (-heightPx - baselinePx).toInt())
      fm.top = min(metrics.top, fm.ascent)
      fm.descent = max(metrics.descent, (-baselinePx).toInt())
      fm.bottom = max(metrics.bottom, fm.descent)
    }
    return ceil(widthPx).toInt().coerceAtLeast(1)
  }

  override fun draw(canvas: Canvas, text: CharSequence, start: Int, end: Int, x: Float, top: Int, y: Int, bottom: Int, paint: Paint) {
    rect.set(x, y - baselinePx - heightPx, x + widthPx, y - baselinePx)
    val image = asset?.bitmap
    if (image != null) {
      canvas.drawBitmap(image, null, rect, formulaPaint ?: paint)
      return
    }
    labelPaint.color = placeholderColor
    labelPaint.alpha = 28
    canvas.drawRoundRect(rect, 3f * scale, 3f * scale, labelPaint)
    labelPaint.alpha = 190
    labelPaint.textSize = min(fontPx * 0.68f, heightPx * 0.65f)
    labelPaint.textAlign = Paint.Align.CENTER
    val label = if (spec.optString("kind") == "formula") "公式" else "图片"
    canvas.drawText(label, rect.centerX(), rect.centerY() - (labelPaint.ascent() + labelPaint.descent()) / 2f, labelPaint)
  }

  private fun initialSize(key: String, fallback: Float): Float =
    (spec.number(key).toFloat() * scale).takeIf { it.isFinite() && it > 0 } ?: fallback
}

/** Asset loading deliberately has no request logging, cookies, or auth headers. */
internal object AttachmentLoader {
  private const val MAX_BYTES = 4 * 1024 * 1024
  private const val MAX_BITMAP_SIDE = 2048

  fun load(spec: JSONObject, scale: Float, fontPx: Float, maxWidth: Float): AttachmentAsset? = runCatching {
    if (Thread.currentThread().isInterrupted || !scale.isFinite() || scale <= 0 || !fontPx.isFinite() || fontPx <= 0 || !maxWidth.isFinite() || maxWidth <= 0) return null
    val source = spec.opt("url") as? String ?: return null
    if (source.isBlank() || source.toByteArray(Charsets.UTF_8).size > MAX_BYTES * 3 + 256) return null
    val bytes = read(source) ?: return null
    if (Thread.currentThread().isInterrupted) return null
    val prefix = bytes.take(200).toByteArray().toString(Charsets.UTF_8).trimStart()
    if (source.startsWith("data:image/svg+xml", true) || prefix.startsWith("<svg") || prefix.startsWith("<?xml")) {
      val markup = bytes.toString(Charsets.UTF_8)
      val svg = SVG.getFromString(markup)
      val widthAttr = rootAttribute(markup, "width")
      val heightAttr = rootAttribute(markup, "height")
      val intrinsicWidth = svgLength(widthAttr, fontPx) ?: svg.documentWidth.takeIf { it > 0 }
      val intrinsicHeight = svgLength(heightAttr, fontPx) ?: svg.documentHeight.takeIf { it > 0 }
      var width = optionalSize(spec, "width", scale) ?: intrinsicWidth ?: fontPx * 2f
      var height = optionalSize(spec, "height", scale) ?: intrinsicHeight ?: fontPx * 1.3f
      val fit = min(1f, min(maxWidth / width, MAX_BITMAP_SIDE / max(width, height)))
      width = max(1f, width * fit)
      height = max(1f, height * fit)
      val bitmap = Bitmap.createBitmap(ceil(width).toInt(), ceil(height).toInt(), Bitmap.Config.ARGB_8888)
      svg.setDocumentWidth(width)
      svg.setDocumentHeight(height)
      svg.renderToCanvas(Canvas(bitmap))
      val style = rootAttribute(markup, "style") ?: ""
      val align = Regex("vertical-align\\s*:\\s*([^;]+)").find(style)?.groupValues?.get(1)
      AttachmentAsset(formulaBitmap(spec, bitmap), width, height, svgLength(align, fontPx)?.times(fit))
    } else {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
      val decode = BitmapFactory.Options()
      while (max(bounds.outWidth, bounds.outHeight) / max(1, decode.inSampleSize) > MAX_BITMAP_SIDE) {
        decode.inSampleSize = max(1, decode.inSampleSize) * 2
      }
      val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, decode) ?: return null
      val naturalRatio = bounds.outHeight.toFloat() / bounds.outWidth
      val explicitWidth = optionalSize(spec, "width", scale)
      val explicitHeight = optionalSize(spec, "height", scale)
      val width = explicitWidth ?: explicitHeight?.div(naturalRatio) ?: min(maxWidth, fontPx * 3f)
      val height = explicitHeight ?: width * naturalRatio
      AttachmentAsset(formulaBitmap(spec, bitmap), width, height, null)
    }
  }.getOrNull()

  /** Normalize only formula resources with a clear light background, once before caching. */
  private fun formulaBitmap(spec: JSONObject, source: Bitmap): Bitmap {
    if (spec.optString("kind") != "formula" || source.width < 3 || source.height < 3) return source
    // Inspect four inset corners so rounded, full-canvas backgrounds are detected.
    // A bright glyph somewhere in a transparent formula is not a background.
    val insetX = ((source.width - 1) * 0.05f).toInt()
    val insetY = ((source.height - 1) * 0.05f).toInt()
    val corners = intArrayOf(
      source.getPixel(insetX, insetY),
      source.getPixel(source.width - 1 - insetX, insetY),
      source.getPixel(insetX, source.height - 1 - insetY),
      source.getPixel(source.width - 1 - insetX, source.height - 1 - insetY)
    )
    if (!FormulaForegroundMask.hasLightBackground(corners)) return source
    val output = if (source.isMutable) source else source.copy(Bitmap.Config.ARGB_8888, true) ?: return source
    val pixels = IntArray(output.width * output.height)
    output.getPixels(pixels, 0, output.width, 0, 0, output.width, output.height)
    for (index in pixels.indices) pixels[index] = FormulaForegroundMask.pixel(pixels[index])
    output.setPixels(pixels, 0, output.width, 0, 0, output.width, output.height)
    if (output !== source) source.recycle()
    return output
  }

  private fun read(source: String): ByteArray? {
    if (source.startsWith("data:image/", true)) {
      val comma = source.indexOf(',')
      if (comma < 0 || source.length > MAX_BYTES * 2) return null
      val header = source.substring(0, comma)
      val payload = source.substring(comma + 1)
      val bytes = if (header.endsWith(";base64", true)) Base64.decode(payload, Base64.DEFAULT)
      else URLDecoder.decode(payload.replace("+", "%2B"), "UTF-8").toByteArray(Charsets.UTF_8)
      return bytes.takeIf { it.size <= MAX_BYTES }
    }
    val uri = URI(source)
    if (uri.scheme != "https" && uri.scheme != "http") return null
    if (uri.userInfo != null) return null
    val connection = uri.toURL().openConnection() as? HttpURLConnection ?: return null
    return try {
      connection.connectTimeout = 8000
      connection.readTimeout = 8000
      connection.instanceFollowRedirects = true
      if (connection.responseCode !in 200..299) return null
      connection.inputStream.use { input ->
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
          if (Thread.currentThread().isInterrupted) return null
          val length = input.read(buffer)
          if (length < 0) break
          if (output.size() + length > MAX_BYTES) return null
          output.write(buffer, 0, length)
        }
        output.toByteArray()
      }
    } finally {
      connection.disconnect()
    }
  }

  private fun rootAttribute(markup: String, name: String): String? {
    val root = Regex("<svg\\b[^>]*>", RegexOption.IGNORE_CASE).find(markup)?.value ?: return null
    return Regex("\\b$name\\s*=\\s*['\"]([^'\"]*)['\"]", RegexOption.IGNORE_CASE).find(root)?.groupValues?.get(1)
  }

  private fun svgLength(value: String?, fontPx: Float): Float? {
    if (value == null) return null
    val match = Regex("^\\s*(-?[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)\\s*(ex|em|px|pt)?\\s*$").find(value) ?: return null
    val number = match.groupValues[1].toFloatOrNull() ?: return null
    return number * when (match.groupValues[2]) {
      "ex" -> fontPx * 0.5f
      "em" -> fontPx
      "pt" -> 4f / 3f
      else -> 1f
    }
  }

  private fun optionalSize(spec: JSONObject, key: String, scale: Float): Float? =
    if (spec.has(key)) (spec.number(key).toFloat() * scale).takeIf { it.isFinite() && it > 0 } else null
}
