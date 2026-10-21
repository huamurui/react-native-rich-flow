package com.richflow.text

/**
 * [fullLineEnd] must be Layout.getLineEnd, which includes paragraph separators.
 * LeadingMarginSpan's visible end excludes newlines and may trim trailing spaces.
 */
internal fun quoteStripeBottom(
  top: Int,
  bottom: Int,
  fullLineEnd: Int,
  paragraphEnd: Int,
  trailingSpacing: Int
): Int = if (fullLineEnd >= paragraphEnd) {
  (bottom - trailingSpacing.coerceAtLeast(0)).coerceAtLeast(top)
} else {
  bottom
}
