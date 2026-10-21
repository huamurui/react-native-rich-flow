package com.richflow.text

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class QuoteStripeGeometryTest {
  @Test fun finalLineBeforeAnotherParagraphIncludesItsNewline() {
    val text = "引用\n后文"
    val paragraphEnd = text.indexOf('\n') + 1
    val visibleLineEnd = paragraphEnd - 1
    assertTrue(visibleLineEnd < paragraphEnd)
    assertEquals(30, quoteStripeBottom(0, 44, paragraphEnd, paragraphEnd, 14))
  }

  @Test fun wrappedLinesRetainTheirHeightUntilTheFinalLine() {
    val paragraphEnd = 15
    assertEquals(30, quoteStripeBottom(0, 30, 5, paragraphEnd, 14))
    assertEquals(60, quoteStripeBottom(30, 60, 10, paragraphEnd, 14))
    assertEquals(90, quoteStripeBottom(60, 104, paragraphEnd, paragraphEnd, 14))
  }

  @Test fun explicitBreakWithinQuoteDoesNotEndTheStripe() {
    val text = "首行\n末行\n后文"
    val firstLineEnd = text.indexOf('\n') + 1
    val paragraphEnd = text.indexOf('\n', firstLineEnd) + 1
    assertEquals(30, quoteStripeBottom(0, 30, firstLineEnd, paragraphEnd, 14))
    assertEquals(60, quoteStripeBottom(30, 74, paragraphEnd, paragraphEnd, 14))
  }

  @Test fun trailingWhitespaceDoesNotHideTheParagraphBoundary() {
    val text = "引用  \n后文"
    val paragraphEnd = text.indexOf('\n') + 1
    val visibleLineEnd = 2 // Layout trims the spaces together with the newline.
    assertTrue(visibleLineEnd < paragraphEnd)
    assertEquals(30, quoteStripeBottom(0, 44, paragraphEnd, paragraphEnd, 14))
  }

  @Test fun quoteContinuationKeepsTheStripeAcrossItsInternalGap() {
    assertEquals(44, quoteStripeBottom(0, 44, 3, 3, 0))
    assertEquals(74, quoteStripeBottom(44, 88, 6, 6, 14))
  }

  @Test fun finalFlowParagraphNeedsNoSeparatorToEndTheStripe() {
    val text = "引用"
    assertEquals(30, quoteStripeBottom(0, 44, text.length, text.length, 14))
    assertEquals(30, quoteStripeBottom(0, 30, text.length, text.length, 0))
  }

  @Test fun attachmentHeightIsRetainedAndOnlyTheParagraphGapIsRemoved() {
    assertEquals(200, quoteStripeBottom(30, 214, 7, 7, 14))
  }

  @Test fun oversizedSpacingCannotDrawAboveTheLineTop() {
    assertEquals(30, quoteStripeBottom(30, 44, 3, 3, 100))
  }
}
