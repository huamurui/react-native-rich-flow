import Foundation

/** Preserve geometry while dropping pixels and invalidating late callbacks. */
final class RichTextAttachmentVisibility {
  private(set) var active = false
  private(set) var revision = 0
  var hasAsset = false
  private var attempted = false

  @discardableResult
  func setActive(_ value: Bool) -> Bool {
    guard active != value else { return false }
    active = value
    if !value { revision += 1; hasAsset = false; attempted = false }
    return true
  }

  func beginLoad() -> Int? {
    guard active, !hasAsset, !attempted else { return nil }
    attempted = true
    return revision
  }

  func accepts(_ value: Int) -> Bool { active && revision == value }
}

func intersectsRichTextAttachmentViewport(top: Double, bottom: Double, viewportTop: Double, viewportBottom: Double) -> Bool {
  top.isFinite && bottom.isFinite && viewportTop.isFinite && viewportBottom.isFinite &&
    bottom > top && viewportBottom > viewportTop && bottom > viewportTop && top < viewportBottom
}
