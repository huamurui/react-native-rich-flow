import UIKit

struct RichTextConfig {
  var fontSize: CGFloat = 17
  var lineHeight: CGFloat = 28
  var paragraphSpacing: CGFloat = 12
  var textColor = UIColor(red: 35 / 255, green: 39 / 255, blue: 43 / 255, alpha: 1)
  var secondaryColor = UIColor(red: 112 / 255, green: 117 / 255, blue: 123 / 255, alpha: 1)
  var linkColor = UIColor(red: 23 / 255, green: 91 / 255, blue: 199 / 255, alpha: 1)
  var justify = false
  var textAlign = "left"
  var language: String?
  var writingDirection = "auto"
  var hyphenation = "none"

  static func parse(_ json: String) -> RichTextConfig {
    var config = RichTextConfig()
    guard let data = json.data(using: .utf8),
          let object = (try? JSONSerialization.jsonObject(with: data)) as? RichTextSpec else { return config }
    config.fontSize = CGFloat(richTextNumber(object["fontSize"], fallback: 17)).clamped(8, 64)
    config.lineHeight = CGFloat(richTextNumber(object["lineHeight"], fallback: 28)).clamped(8, 120)
    config.paragraphSpacing = CGFloat(richTextNumber(object["paragraphSpacing"], fallback: 12)).clamped(0, 120)
    config.textColor = richTextColor(object["textColor"], fallback: config.textColor)
    config.secondaryColor = richTextColor(object["secondaryColor"], fallback: config.secondaryColor)
    config.linkColor = richTextColor(object["linkColor"], fallback: config.linkColor)
    config.justify = object["justify"] as? Bool ?? false
    let align = object["textAlign"] as? String ?? "left"
    config.textAlign = ["center", "right", "start", "end"].contains(align) ? align : "left"
    if let language = object["language"] as? String, !language.isEmpty { config.language = language }
    if let direction = object["writingDirection"] as? String, ["auto", "ltr", "rtl"].contains(direction) { config.writingDirection = direction }
    if let hyphenation = object["hyphenation"] as? String, ["none", "normal", "full"].contains(hyphenation) { config.hyphenation = hyphenation }
    return config
  }

  func alignment(for text: String) -> NSTextAlignment {
    if textAlign == "center" { return .center }
    if textAlign == "right" { return .right }
    if justify && ["left", "start"].contains(textAlign) { return .justified }
    if textAlign == "start" { return writingDirection == "rtl" ? .right : writingDirection == "ltr" ? .left : .natural }
    if textAlign == "end" {
      let rtl = writingDirection == "rtl" || (writingDirection == "auto" &&
        (richTextFirstStrongIsRTL(text) ?? (NSParagraphStyle.defaultWritingDirection(forLanguage: language) == .rightToLeft)))
      return rtl ? .left : .right
    }
    return .left
  }

  func configure(_ style: NSMutableParagraphStyle, text: String) {
    style.alignment = alignment(for: text)
    style.baseWritingDirection = writingDirection == "rtl" ? .rightToLeft : writingDirection == "ltr" ? .leftToRight : .natural
    style.usesDefaultHyphenation = hyphenation == "normal"
    style.hyphenationFactor = hyphenation == "full" ? 1 : 0
    let effectiveLanguage = language ?? Locale.preferredLanguages.first ?? ""
    style.lineBreakStrategy = effectiveLanguage.lowercased().hasPrefix("ko") ? .hangulWordPriority : []
  }
}

extension CGFloat {
  fileprivate func clamped(_ lower: CGFloat, _ upper: CGFloat) -> CGFloat {
    Swift.min(upper, Swift.max(lower, self))
  }
}

func richTextColor(_ value: Any?, fallback: UIColor) -> UIColor {
  guard let raw = value as? String else { return fallback }
  let color = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  if color.hasPrefix("#") {
    let hex = String(color.dropFirst())
    guard let number = UInt64(hex, radix: 16) else { return fallback }
    switch hex.count {
    case 3:
      return UIColor(red: CGFloat((number >> 8) & 15) / 15, green: CGFloat((number >> 4) & 15) / 15, blue: CGFloat(number & 15) / 15, alpha: 1)
    case 6:
      return UIColor(red: CGFloat((number >> 16) & 255) / 255, green: CGFloat((number >> 8) & 255) / 255, blue: CGFloat(number & 255) / 255, alpha: 1)
    case 8:
      // The bridge follows Android Color.parseColor's #AARRGGBB convention.
      return UIColor(red: CGFloat((number >> 16) & 255) / 255, green: CGFloat((number >> 8) & 255) / 255, blue: CGFloat(number & 255) / 255, alpha: CGFloat((number >> 24) & 255) / 255)
    default: return fallback
    }
  }
  if (color.hasPrefix("rgb(") || color.hasPrefix("rgba(")), color.hasSuffix(")"),
     let opening = color.firstIndex(of: "(") {
    let components = color[color.index(after: opening)..<color.index(before: color.endIndex)]
      .split(separator: ",", omittingEmptySubsequences: false)
    let fields = components.compactMap { Double($0.trimmingCharacters(in: .whitespaces)) }
    if components.count == (color.hasPrefix("rgba") ? 4 : 3), fields.count == components.count,
       fields.allSatisfy({ $0.isFinite }) {
      return UIColor(red: CGFloat(fields[0] / 255).clamped(0, 1), green: CGFloat(fields[1] / 255).clamped(0, 1), blue: CGFloat(fields[2] / 255).clamped(0, 1), alpha: fields.count == 4 ? CGFloat(fields[3]).clamped(0, 1) : 1)
    }
  }
  switch color {
  case "black": return .black
  case "white": return .white
  case "red": return .red
  case "blue": return .blue
  case "gray", "grey": return .gray
  case "transparent", "clear": return .clear
  default: return fallback
  }
}
