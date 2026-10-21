package com.richflow.text

internal data class TextRange(val start: Int, val end: Int) {
  fun intersects(startOffset: Int, endOffset: Int) = start < endOffset && end > startOffset
}

/** JSONObject.optInt coerces strings and truncates fractions; bridge offsets must not. */
internal fun richTextNumber(value: Any?, fallback: Double): Double =
  (value as? Number)?.toDouble()?.takeIf { it.isFinite() } ?: fallback

internal fun richTextOffset(value: Any?): Int? {
  val number = richTextNumber(value, Double.NaN)
  return number.takeIf { it.isFinite() && it >= 0 && it <= Int.MAX_VALUE && it % 1.0 == 0.0 }?.toInt()
}

internal fun validRichTextBoundary(offset: Int, text: String): Boolean =
  offset >= 0 && offset <= text.length &&
    (offset == 0 || offset == text.length || !Character.isHighSurrogate(text[offset - 1]) || !Character.isLowSurrogate(text[offset]))

internal fun richTextRange(start: Any?, end: Any?, text: String): TextRange? {
  val lower = richTextOffset(start) ?: return null
  val upper = richTextOffset(end) ?: return null
  return if (upper > lower && validRichTextBoundary(lower, text) && validRichTextBoundary(upper, text)) TextRange(lower, upper) else null
}

internal data class RichTextCopySlot(val range: TextRange, val text: String)

internal fun richTextSelectionText(text: String, start: Int, end: Int, slots: List<RichTextCopySlot>): String? {
  val selection = richTextRange(start, end, text) ?: return null
  val result = StringBuilder()
  var cursor = selection.start
  for (slot in slots.sortedBy { it.range.start }) {
    val range = richTextRange(slot.range.start, slot.range.end, text) ?: continue
    if (range.end - range.start != 1 || text[range.start] != '\ufffc' || range.start < cursor || range.end > selection.end) continue
    result.append(text.substring(cursor, range.start)).append(slot.text)
    cursor = range.end
  }
  return result.append(text.substring(cursor, selection.end)).toString()
}
