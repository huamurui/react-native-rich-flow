package com.richflow.text

/** A color-independent glyph mask for the occasional formula with a near-white canvas. */
internal object FormulaForegroundMask {
  fun hasLightBackground(corners: IntArray): Boolean =
    corners.size == 4 && corners.count { color ->
      (color ushr 24) >= 250 &&
        ((color ushr 16) and 255) >= 240 &&
        ((color ushr 8) and 255) >= 240 &&
        (color and 255) >= 240
    } >= 3

  fun pixel(color: Int): Int {
    val alpha = color ushr 24
    val red = (color ushr 16) and 255
    val green = (color ushr 8) and 255
    val blue = color and 255
    val luminance = (54 * red + 183 * green + 19 * blue + 128) ushr 8
    // Preserve dark glyphs, remove the light canvas and retain intermediate edge coverage.
    val coverage = ((240 - luminance).coerceIn(0, 176) * 255 + 88) / 176
    return ((alpha * coverage + 127) / 255) shl 24
  }
}
