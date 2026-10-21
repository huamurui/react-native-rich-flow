package com.richflow.text

import java.util.Locale
import kotlin.math.max

/** Filters entire graphemes; UTF-16 code units are never treated as glyphs. */
internal fun acceptsEmphasisGrapheme(text: String): Boolean {
  if (text.isEmpty()) return false
  var offset = 0
  var visible = false
  while (offset < text.length) {
    val point = text.codePointAt(offset)
    if (point == 0xfffc || Character.isWhitespace(point) || Character.isSpaceChar(point)) return false
    when (Character.getType(point)) {
      Character.CONNECTOR_PUNCTUATION.toInt(), Character.DASH_PUNCTUATION.toInt(),
      Character.START_PUNCTUATION.toInt(), Character.END_PUNCTUATION.toInt(),
      Character.INITIAL_QUOTE_PUNCTUATION.toInt(), Character.FINAL_QUOTE_PUNCTUATION.toInt(),
      Character.OTHER_PUNCTUATION.toInt() -> return false
      Character.FORMAT.toInt(), Character.CONTROL.toInt(), Character.NON_SPACING_MARK.toInt(),
      Character.COMBINING_SPACING_MARK.toInt(), Character.ENCLOSING_MARK.toInt() -> Unit
      else -> visible = true
    }
    offset += Character.charCount(point)
  }
  return visible
}

internal fun acceptsRubyGrapheme(text: String): Boolean {
  if (text.isEmpty()) return false
  var offset = 0
  var visible = false
  while (offset < text.length) {
    val point = text.codePointAt(offset)
    if (point == 0xfffc || point == 0x0a || point == 0x0d || point == 0x2028 || point == 0x2029) return false
    when (Character.getType(point)) {
      Character.FORMAT.toInt(), Character.CONTROL.toInt(), Character.NON_SPACING_MARK.toInt(),
      Character.COMBINING_SPACING_MARK.toInt(), Character.ENCLOSING_MARK.toInt() -> Unit
      else -> visible = true
    }
    offset += Character.charCount(point)
  }
  return visible
}

/** An inline reading must not cross a structural break or replace an attachment. */
internal fun acceptsRubyBase(text: String): Boolean = text.isNotEmpty() &&
  text.none { it == '\ufffc' || it == '\n' || it == '\r' || it == '\u2028' || it == '\u2029' }

internal fun hasGraphemeBoundaries(range: TextRange, boundaries: List<Int>): Boolean =
  boundaries.binarySearch(range.start) >= 0 && boundaries.binarySearch(range.end) >= 0

/** Split a group annotation deterministically when the base wraps across lines. */
internal fun rubySliceRange(baseCount: Int, start: Int, end: Int, rubyBoundaries: List<Int>): TextRange? {
  if (baseCount <= 0 || start < 0 || end <= start || end > baseCount || rubyBoundaries.size < 2) return null
  val count = rubyBoundaries.size - 1
  val first = (start.toLong() * count / baseCount).toInt()
  val last = (end.toLong() * count / baseCount).toInt()
  if (first == last) return null
  return TextRange(rubyBoundaries[first], rubyBoundaries[last])
}

internal data class AnnotationBand(val ruby: Int = 0, val emphasis: Int = 0) {
  val total: Int get() = ruby + emphasis
  fun include(kind: String, height: Int): AnnotationBand = if (kind == "ruby") {
    copy(ruby = max(ruby, height))
  } else {
    copy(emphasis = max(emphasis, height))
  }
}

internal fun annotationPosition(kind: String, position: String?): String = when (position) {
  "over", "under" -> position
  else -> if (kind == "ruby") "over" else "under"
}

internal fun normalizedLanguageTag(value: String?): String? {
  if (value.isNullOrBlank() || value.length > 100) return null
  return runCatching { Locale.Builder().setLanguageTag(value).build().toLanguageTag() }.getOrNull()
}

internal fun normalizedTextAlign(value: String?): String =
  value?.takeIf { it in setOf("left", "center", "right", "start", "end") } ?: "left"

internal fun normalizedWritingDirection(value: String?): String =
  value?.takeIf { it == "ltr" || it == "rtl" } ?: "auto"

internal fun normalizedHyphenation(value: String?): String =
  value?.takeIf { it == "normal" || it == "full" } ?: "none"

internal fun shouldJustify(justify: Boolean, alignment: String): Boolean =
  justify && alignment != "center" && alignment != "right" && alignment != "end"
