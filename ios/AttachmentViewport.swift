import Foundation

/** Preserve geometry while dropping pixels and invalidating late callbacks. */
final class RichTextAttachmentVisibility {
  private static let retryDelays = [1, 4] // Seconds after consecutive failures during one visit.
  private(set) var active = false
  private var revision = 0
  var hasAsset = false
  private var attempts = 0
  private var retryAt: DispatchTime?

  @discardableResult
  func setActive(_ value: Bool) -> Bool {
    guard active != value else { return false }
    active = value
    if !value {
      revision += 1
      hasAsset = false
      attempts = 0
      retryAt = nil
    }
    return true
  }

  func beginLoad(now: DispatchTime = .now()) -> Int? {
    guard active, !hasAsset else { return nil }
    if attempts > 0 {
      guard let retryAt, now >= retryAt else { return nil }
    }
    retryAt = nil
    attempts += 1
    revision += 1
    return revision
  }

  func retryDeadline(afterFailure value: Int, now: DispatchTime = .now()) -> DispatchTime? {
    guard accepts(value), !hasAsset, retryAt == nil,
          Self.retryDelays.indices.contains(attempts - 1) else { return nil }
    let deadline = now + .seconds(Self.retryDelays[attempts - 1])
    retryAt = deadline
    return deadline
  }

  func accepts(_ value: Int) -> Bool { active && revision == value }
}

func intersectsRichTextAttachmentViewport(top: Double, bottom: Double, viewportTop: Double, viewportBottom: Double) -> Bool {
  top.isFinite && bottom.isFinite && viewportTop.isFinite && viewportBottom.isFinite &&
    bottom > top && viewportBottom > viewportTop && bottom > viewportTop && top < viewportBottom
}
