package com.richflow.text

import android.graphics.Color
import org.json.JSONArray
import org.json.JSONObject

internal data class FlowData(
  val id: String,
  val textVersion: String,
  val text: String,
  val spans: List<JSONObject>,
  val paragraphs: List<JSONObject>,
  val decorations: List<JSONObject>,
  val attachments: List<JSONObject>,
  val annotations: List<JSONObject> = emptyList()
) {
  val copySemantics: RichTextCopySemantics by lazy(LazyThreadSafetyMode.NONE) {
    val slots = attachments.mapNotNull { attachment ->
      val range = attachment.range(text) ?: return@mapNotNull null
      if (range.end != range.start + 1 || text[range.start] != '\ufffc') return@mapNotNull null
      RichTextCopySlot(range, attachment.opt("copyText") as? String ?: attachment.opt("latex") as? String ?: attachment.opt("alt") as? String ?: "[图片]")
    }.sortedBy { it.range.start }.distinctBy { it.range.start }
    val terminalAnchor = if (text.endsWith('\u200b')) paragraphs.lastOrNull()?.emptyParagraphRange(text) else null
    RichTextCopySemantics(slots, terminalAnchor?.takeIf { it.end == text.length })
  }

  fun hasSameSelectionPrefix(next: FlowData, anchor: Int, focus: Int): Boolean {
    val end = maxOf(anchor, focus)
    val start = minOf(anchor, focus)
    if (richTextRange(start, end, text) == null || richTextRange(start, end, next.text) == null ||
      !text.regionMatches(0, next.text, 0, end)) return false
    return copySemantics.matchesThrough(end, next.copySemantics)
  }

  companion object {
    fun parse(value: String): FlowData? = runCatching {
      val json = JSONObject(value)
      FlowData(
        json.opt("id") as? String ?: return@runCatching null, json.opt("textVersion") as? String ?: return@runCatching null, json.opt("text") as? String ?: return@runCatching null,
        json.optJSONArray("spans").objects(), json.optJSONArray("paragraphs").objects(),
        json.optJSONArray("decorations").objects(), json.optJSONArray("attachments").objects(),
        json.optJSONArray("annotations").objects()
      )
    }.getOrNull()
  }
}

internal data class TextConfig(
  val fontSize: Float = 17f,
  val lineHeight: Float = 28f,
  val paragraphSpacing: Float = 12f,
  val textColor: Int = Color.rgb(35, 39, 43),
  val secondaryColor: Int = Color.rgb(112, 117, 123),
  val linkColor: Int = Color.rgb(23, 91, 199),
  val justify: Boolean = false,
  val textAlign: String = "left",
  val language: String? = null,
  val writingDirection: String = "auto",
  val hyphenation: String = "none"
) {
  companion object {
    fun parse(value: String): TextConfig = runCatching {
      val json = JSONObject(value)
      TextConfig(
        json.number("fontSize", 17.0).toFloat().coerceIn(8f, 64f),
        json.number("lineHeight", 28.0).toFloat().coerceIn(8f, 120f),
        json.number("paragraphSpacing", 12.0).toFloat().coerceIn(0f, 120f),
        parseColor(json.optString("textColor"), Color.rgb(35, 39, 43)),
        parseColor(json.optString("secondaryColor"), Color.rgb(112, 117, 123)),
        parseColor(json.optString("linkColor"), Color.rgb(23, 91, 199)),
        json.optBoolean("justify", false),
        normalizedTextAlign(json.opt("textAlign") as? String),
        normalizedLanguageTag(json.opt("language") as? String),
        normalizedWritingDirection(json.opt("writingDirection") as? String),
        normalizedHyphenation(json.opt("hyphenation") as? String)
      )
    }.getOrDefault(TextConfig())
  }
}

internal fun JSONObject.range(text: String): TextRange? = richTextRange(opt("start"), opt("end"), text)

internal fun JSONObject.emptyParagraphRange(text: String): TextRange? =
  if (opt("emptyLine") == true) range(text)?.takeIf { isEmptyParagraphRange(text, it) } else null

internal fun JSONObject.number(key: String, fallback: Double = Double.NaN): Double = richTextNumber(opt(key), fallback)

internal fun JSONArray?.objects(): List<JSONObject> =
  if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

internal fun parseColor(value: String?, fallback: Int): Int =
  if (value.isNullOrBlank()) fallback else runCatching { Color.parseColor(value) }.getOrDefault(fallback)
