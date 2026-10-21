package com.richflow.text

import org.junit.Assert.*
import org.junit.Test

class AnnotationGeometryTest {
  @Test fun emphasisKeepsWholeVisibleGraphemesAndSkipsPunctuationAndAttachments() {
    for (grapheme in listOf("汉", "あ", "한", "é", "e\u0301", "😀", "👩‍💻", "🇯🇵", "بِ")) {
      assertTrue(grapheme, acceptsEmphasisGrapheme(grapheme))
    }
    for (grapheme in listOf("", " ", "\n", "\t", "\u00a0", "。", "，", "؟", "-", "（", "）", "\ufffc", "\u0301", "\u200d")) {
      assertFalse(grapheme, acceptsEmphasisGrapheme(grapheme))
    }
  }

  @Test fun rubySlicesUseGraphemeBoundariesAndPreserveAllReadingAcrossWrappedFragments() {
    // The second ruby grapheme is a surrogate pair; no split can bisect it.
    val reading = "に😀ほん"
    val boundaries = listOf(0, 1, 3, 4, 5)
    val ranges = listOf(
      rubySliceRange(3, 0, 1, boundaries),
      rubySliceRange(3, 1, 2, boundaries),
      rubySliceRange(3, 2, 3, boundaries)
    )
    assertEquals(listOf(TextRange(0, 1), TextRange(1, 3), TextRange(3, 5)), ranges)
    assertEquals(reading, ranges.filterNotNull().joinToString("") { reading.substring(it.start, it.end) })
    assertEquals(TextRange(0, 5), rubySliceRange(3, 0, 3, boundaries))
  }

  @Test fun rubyBaseCountsExcludeLineBreaksAttachmentsAndStandaloneDirectionControls() {
    assertTrue(acceptsRubyGrapheme("汉"))
    assertTrue(acceptsRubyGrapheme(" "))
    assertTrue(acceptsRubyGrapheme("e\u0301"))
    assertFalse(acceptsRubyGrapheme("\ufffc"))
    assertFalse(acceptsRubyGrapheme("\n"))
    assertFalse(acceptsRubyGrapheme("\u200f"))
  }

  @Test fun rubyRejectsAnEntireBaseRangeThatCrossesStructuralBoundaries() {
    assertTrue(acceptsRubyBase("東京都"))
    assertTrue(acceptsRubyBase("مرحبا بالعالم"))
    for (separator in listOf("\n", "\r", "\r\n", "\u2028", "\u2029", "\ufffc")) {
      assertFalse(separator, acceptsRubyBase("前${separator}后"))
    }
    assertFalse(acceptsRubyBase(""))
  }

  @Test fun annotationRangesMustIncludeWholeGraphemes() {
    // e + combining accent, emoji surrogate pair, then one CJK character.
    val boundaries = listOf(0, 2, 4, 5)
    assertTrue(hasGraphemeBoundaries(TextRange(0, 5), boundaries))
    assertTrue(hasGraphemeBoundaries(TextRange(2, 4), boundaries))
    assertFalse(hasGraphemeBoundaries(TextRange(1, 5), boundaries))
    assertFalse(hasGraphemeBoundaries(TextRange(0, 3), boundaries))
  }

  @Test fun shortRubyDoesNotDuplicateSyllablesAcrossFragments() {
    assertNull(rubySliceRange(3, 0, 1, listOf(0, 1)))
    assertNull(rubySliceRange(3, 1, 2, listOf(0, 1)))
    assertEquals(TextRange(0, 1), rubySliceRange(3, 2, 3, listOf(0, 1)))
    assertNull(rubySliceRange(0, 0, 1, listOf(0, 1)))
    assertNull(rubySliceRange(3, 0, 4, listOf(0, 1)))
  }

  @Test fun simultaneousRubyAndEmphasisReserveSeparateBandsWithoutAccumulatingDuplicates() {
    val band = AnnotationBand().include("ruby", 8).include("emphasis", 3).include("ruby", 5)
    assertEquals(8, band.ruby)
    assertEquals(3, band.emphasis)
    assertEquals(11, band.total)
    assertEquals("under", annotationPosition("emphasis", null))
    assertEquals("over", annotationPosition("ruby", null))
    assertEquals("over", annotationPosition("emphasis", "over"))
  }

  @Test fun localeAndDirectionInputsRespectSystemConventionsWithoutChangingText() {
    assertEquals("zh-Hans-CN", normalizedLanguageTag("zh-hans-cn"))
    assertEquals("ar", normalizedLanguageTag("ar"))
    assertEquals("fr-FR", normalizedLanguageTag("fr-FR"))
    assertNull(normalizedLanguageTag("en_US"))
    assertNull(normalizedLanguageTag("not a locale"))
    assertEquals("start", normalizedTextAlign("start"))
    assertEquals("end", normalizedTextAlign("end"))
    assertEquals("left", normalizedTextAlign("invalid"))
    assertEquals("auto", normalizedWritingDirection("invalid"))
    assertEquals("rtl", normalizedWritingDirection("rtl"))
    assertEquals("full", normalizedHyphenation("full"))
    assertEquals("none", normalizedHyphenation("invalid"))
  }

  @Test fun justificationOnlyAppliesToLeadingAlignment() {
    assertTrue(shouldJustify(true, "left"))
    assertTrue(shouldJustify(true, "start"))
    for (alignment in listOf("center", "right", "end")) assertFalse(shouldJustify(true, alignment))
    assertFalse(shouldJustify(false, "start"))
  }
}
