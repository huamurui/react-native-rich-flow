package com.richflow.text

import org.junit.Assert.*
import org.junit.Test

class TextRangeValidationTest {
  @Test fun offsetsRejectCoercionAndSurrogateSplits() {
    val text = "甲😀\ufffc\n乙"
    assertEquals(TextRange(1, 3), richTextRange(1, 3, text))
    for (offset in listOf<Any?>(null, "1", true, 1.5, -1, Double.NaN, Double.POSITIVE_INFINITY, Long.MAX_VALUE)) {
      assertNull(richTextRange(offset, 3, text))
    }
    assertNull(richTextRange(1, 2, text))
    assertNull(richTextRange(2, 3, text))
    assertNull(richTextRange(0, 7, text))
    assertNull(richTextRange(3, 3, text))
    assertEquals(TextRange(1, 3), richTextRange(1.0, 3.0, text))
  }

  @Test fun appendingToAnEditableBufferCanInvalidateItsOldUtf16End() {
    val text = StringBuilder("x\ud83d")
    val previousEnd = text.length
    assertTrue(hasSelectionInPrefix(text, previousEnd, 0, previousEnd))
    text.append('\ude00').append(" tail")
    assertFalse(hasSelectionInPrefix(text, previousEnd, 0, previousEnd))
    assertFalse(hasSelectionInPrefix(text, 0, previousEnd, previousEnd))
    assertTrue(hasSelectionInPrefix(text, 1, 0, previousEnd))
    assertFalse(hasSelectionInPrefix(text, 0, 3, previousEnd))
  }

  @Test fun copyReplacesOnlySelectedObjectReplacementCharacters() {
    val text = "甲😀\ufffc\n乙"
    val slots = listOf(RichTextCopySlot(TextRange(3, 4), "x²"), RichTextCopySlot(TextRange(0, 1), "bad"), RichTextCopySlot(TextRange(99, 100), "bad"))
    assertEquals("甲😀x²\n乙", richTextSelectionText(text, 0, 6, slots))
    assertEquals("😀", richTextSelectionText(text, 1, 3, slots))
    assertEquals("x²", richTextSelectionText(text, 3, 4, slots))
    assertNull(richTextSelectionText(text, 2, 4, slots))
    assertNull(richTextSelectionText(text, -1, 4, slots))
  }

  @Test fun blankParagraphCopyPreservesNewlinesAndAuthoredZeroWidthCharacters() {
    val text = "\n😀\u200b\n\u200b"
    val last = TextRange(5, 6)
    assertTrue(isEmptyParagraphRange(text, TextRange(0, 1)))
    assertTrue(isEmptyParagraphRange(text, last))
    assertFalse(isEmptyParagraphRange(text, TextRange(3, 4)))
    assertEquals("\n😀\u200b\n", richTextSelectionText(text, 0, 6, emptyList(), last))
    assertEquals("", richTextSelectionText(text, 5, 6, emptyList(), last))
    assertNull(richTextSelectionText(text, 2, 6, emptyList(), last))
    assertEquals("\u200b", richTextSelectionText("\u200b", 0, 1, emptyList()))
    assertEquals("A\u200b", richTextSelectionText("A\u200b", 0, 2, emptyList(), TextRange(1, 2)))
  }

  @Test fun updatedSnapshotsRequireTheWholePrefixAndBothUtf16Boundaries() {
    fun flow(text: String) = FlowData("message", "rev", text, emptyList(), emptyList(), emptyList(), emptyList())
    val first = flow("A😀 selected tail")
    assertTrue(first.hasSameSelectionPrefix(flow("A😀 selected revised"), 12, 4))
    assertFalse(first.hasSameSelectionPrefix(flow("B😀 selected revised"), 4, 12))
    assertFalse(first.hasSameSelectionPrefix(flow("A😀 select"), 4, 12))
    assertFalse(first.hasSameSelectionPrefix(first, 2, 4))
    assertFalse(flow("x\ud83d").hasSameSelectionPrefix(flow("x😀"), 0, 2))
  }

  @Test fun copySemanticsMustMatchAtEachPrefixSlotIncludingHiddenBlankAnchors() {
    fun slot(start: Int, text: String) = RichTextCopySlot(TextRange(start, start + 1), text)
    val original = RichTextCopySemantics(listOf(slot(1, "ab"), slot(2, "c")), null)
    val redistributed = RichTextCopySemantics(listOf(slot(1, "a"), slot(2, "bc")), null)
    assertFalse(original.matchesThrough(3, redistributed))
    assertTrue(original.matchesThrough(1, redistributed))
    val addedLater = original.copy(slots = original.slots + slot(5, "new image"))
    assertTrue(original.matchesThrough(5, addedLater))
    val generatedBlank = original.copy(terminalAnchor = TextRange(3, 4))
    assertFalse(original.matchesThrough(4, generatedBlank))
    assertTrue(original.matchesThrough(3, generatedBlank))
  }
}
