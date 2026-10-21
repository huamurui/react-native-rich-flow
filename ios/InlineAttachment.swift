import UIKit

/** A single U+FFFC in the TextKit surface, retaining system selection and copying. */
internal final class RichTextAttachment: NSTextAttachment {
  private let spec: [String: Any]
  private let font: UIFont
  private let maxWidth: CGFloat
  private let textColor: UIColor
  private let scale: CGFloat

  init(
    spec: [String: Any],
    font: UIFont,
    maxWidth: CGFloat,
    textColor: UIColor,
    secondaryColor: UIColor,
    scale: CGFloat = 1
  ) {
    self.spec = spec
    self.font = font
    self.maxWidth = max(1, maxWidth)
    self.textColor = textColor
    self.scale = scale
    super.init(data: nil, ofType: nil)
    let formula = spec["kind"] as? String == "formula"
    let width = Self.positive(spec["width"], scale: scale) ?? font.pointSize * (formula ? 2 : 1.5)
    let height = Self.positive(spec["height"], scale: scale) ?? font.pointSize * 1.3
    let screenScale = min(3, max(1, UIScreen.main.scale))
    let fit = min(1, min(self.maxWidth / width, (2048 / screenScale) / max(width, height)))
    let size = CGSize(width: max(1, width * fit), height: max(1, height * fit))
    let baseline = Self.baseline(spec["baselineOffset"], scale: scale).map { min(2048, max(-2048, $0 * fit)) } ?? 0
    bounds = CGRect(origin: CGPoint(x: 0, y: baseline), size: size)
    image = Self.placeholder(size: size, label: formula ? "公式" : "图片", color: secondaryColor, fontSize: font.pointSize)
  }

  required init?(coder: NSCoder) {
    return nil
  }

  /** Retain bounds so scrolling offscreen never changes text layout. */
  func releaseAsset() { image = nil }

  /** Main-thread only; the owner invalidates layout and restores its current selection. */
  func update(asset: RichTextAttachmentAsset) {
    assert(Thread.isMainThread)
    let ratio = min(1, maxWidth / max(1, asset.width))
    // The loader includes the resource fit in both CSS and explicit baselines.
    let rawBaseline = (asset.baselineOffset ?? Self.baseline(spec["baselineOffset"], scale: scale) ?? 0) * ratio
    let baseline = min(2048, max(-2048, rawBaseline))
    bounds = CGRect(x: 0, y: baseline, width: max(1, asset.width * ratio), height: max(1, asset.height * ratio))
    image = spec["kind"] as? String == "formula"
      ? asset.image.withTintColor(textColor, renderingMode: .alwaysOriginal)
      : asset.image
  }

  private static func positive(_ value: Any?, scale: CGFloat) -> CGFloat? {
    let result = CGFloat(richTextNumber(value, fallback: .nan)) * scale
    return result.isFinite && result > 0 ? result : nil
  }

  private static func baseline(_ value: Any?, scale: CGFloat) -> CGFloat? {
    let result = CGFloat(richTextNumber(value, fallback: .nan)) * scale
    return result.isFinite ? result : nil
  }

  private static func placeholder(size: CGSize, label: String, color: UIColor, fontSize: CGFloat) -> UIImage {
    let format = UIGraphicsImageRendererFormat()
    format.opaque = false
    format.scale = min(3, max(1, UIScreen.main.scale))
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in
      color.withAlphaComponent(0.1).setFill()
      UIBezierPath(roundedRect: CGRect(origin: .zero, size: size), cornerRadius: 3).fill()
      let attributes: [NSAttributedString.Key: Any] = [
        .foregroundColor: color.withAlphaComponent(0.75),
        .font: UIFont.systemFont(ofSize: min(fontSize * 0.68, size.height * 0.65)),
      ]
      let text = label as NSString
      let textSize = text.size(withAttributes: attributes)
      text.draw(at: CGPoint(x: (size.width - textSize.width) / 2, y: (size.height - textSize.height) / 2), withAttributes: attributes)
    }
  }
}
