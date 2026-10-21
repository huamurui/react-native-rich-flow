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

  @Test fun copyReplacesOnlySelectedObjectReplacementCharacters() {
    val text = "甲😀\ufffc\n乙"
    val slots = listOf(RichTextCopySlot(TextRange(3, 4), "x²"), RichTextCopySlot(TextRange(0, 1), "bad"), RichTextCopySlot(TextRange(99, 100), "bad"))
    assertEquals("甲😀x²\n乙", richTextSelectionText(text, 0, 6, slots))
    assertEquals("😀", richTextSelectionText(text, 1, 3, slots))
    assertEquals("x²", richTextSelectionText(text, 3, 4, slots))
    assertNull(richTextSelectionText(text, 2, 4, slots))
    assertNull(richTextSelectionText(text, -1, 4, slots))
  }
}
