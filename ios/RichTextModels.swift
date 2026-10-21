import CoreFoundation
import Foundation

typealias RichTextSpec = [String: Any]

struct RichTextFlow {
  let id: String
  let textVersion: String
  let text: NSString
  let spans: [RichTextSpec]
  let paragraphs: [RichTextSpec]
  let decorations: [RichTextSpec]
  let annotations: [RichTextSpec]
  let attachments: [RichTextSpec]

  static func parse(_ json: String) -> RichTextFlow? {
    guard let data = json.data(using: .utf8),
          let value = try? JSONSerialization.jsonObject(with: data),
          let object = value as? RichTextSpec,
          let id = object["id"] as? String,
          let version = object["textVersion"] as? String,
          let text = object["text"] as? String else { return nil }
    return RichTextFlow(
      id: id, textVersion: version, text: text as NSString,
      spans: object["spans"] as? [RichTextSpec] ?? [],
      paragraphs: object["paragraphs"] as? [RichTextSpec] ?? [],
      decorations: object["decorations"] as? [RichTextSpec] ?? [],
      annotations: object["annotations"] as? [RichTextSpec] ?? [],
      attachments: object["attachments"] as? [RichTextSpec] ?? []
    )
  }

  func selectionText(_ range: NSRange) -> String? {
    guard validRichTextRange(range, in: text) else { return nil }
    var result = ""
    var cursor = range.location
    let end = NSMaxRange(range)
    let slots = attachments.compactMap { spec -> (NSRange, String)? in
      guard let slot = richTextRange(spec, in: text), slot.length == 1,
            text.character(at: slot.location) == 0xfffc,
            slot.location >= range.location, NSMaxRange(slot) <= end else { return nil }
      return (slot, spec["copyText"] as? String ?? spec["latex"] as? String ?? spec["alt"] as? String ?? "[图片]")
    }.sorted { $0.0.location < $1.0.location }
    for (slot, replacement) in slots where slot.location >= cursor {
      result += text.substring(with: NSRange(location: cursor, length: slot.location - cursor))
      result += replacement
      cursor = NSMaxRange(slot)
    }
    result += text.substring(with: NSRange(location: cursor, length: end - cursor))
    return result
  }
}

func richTextNumber(_ value: Any?, fallback: Double) -> Double {
  guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID(),
        number.doubleValue.isFinite else { return fallback }
  return number.doubleValue
}

private func richTextInteger(_ value: Any?) -> Int? {
  let number = richTextNumber(value, fallback: .nan)
  guard number.isFinite, number.rounded(.towardZero) == number,
        number >= 0, number < Double(Int.max) else { return nil }
  return Int(number)
}

func validRichTextBoundary(_ offset: Int, in text: NSString) -> Bool {
  guard offset >= 0, offset <= text.length else { return false }
  guard offset > 0, offset < text.length else { return true }
  let previous = text.character(at: offset - 1)
  let next = text.character(at: offset)
  return !(0xd800...0xdbff).contains(previous) || !(0xdc00...0xdfff).contains(next)
}

func validRichTextRange(_ range: NSRange, in text: NSString) -> Bool {
  guard range.location != NSNotFound, range.location >= 0, range.length > 0,
        range.location <= text.length, range.length <= text.length - range.location else { return false }
  return validRichTextBoundary(range.location, in: text) && validRichTextBoundary(NSMaxRange(range), in: text)
}

func richTextRange(_ spec: RichTextSpec, in text: NSString) -> NSRange? {
  guard let start = richTextInteger(spec["start"]), let end = richTextInteger(spec["end"]),
        end > start, end <= text.length else { return nil }
  let range = NSRange(location: start, length: end - start)
  return validRichTextRange(range, in: text) ? range : nil
}

/** Drawing metadata only: annotation characters never enter the selectable buffer. */
struct RichTextAnnotation {
  let range: NSRange
  let kind: String
  let position: String
  let mark: String
  let graphemes: [NSRange]
  let reading: [String]

  static func parse(_ spec: RichTextSpec, in text: NSString) -> RichTextAnnotation? {
    guard let range = richTextRange(spec, in: text),
          let kind = spec["kind"] as? String, ["emphasis", "ruby"].contains(kind) else { return nil }
    let expanded = text.rangeOfComposedCharacterSequences(for: range)
    guard expanded == range else { return nil }
    let source = text.substring(with: range)
    let reading = Array((spec["text"] as? String ?? "").map(String.init))
    if kind == "ruby" && (reading.isEmpty || source.contains("\u{fffc}") ||
      source.rangeOfCharacter(from: .newlines) != nil || reading.joined().rangeOfCharacter(from: .newlines) != nil) { return nil }
    var graphemes: [NSRange] = []
    var offset = range.location
    while offset < NSMaxRange(range) {
      let cluster = text.rangeOfComposedCharacterSequence(at: offset)
      let value = text.substring(with: cluster)
      if kind == "ruby" ? richTextRubyBaseEligible(value) : richTextEmphasisEligible(value) { graphemes.append(cluster) }
      offset = NSMaxRange(cluster)
    }
    guard !graphemes.isEmpty else { return nil }
    let position = spec["position"] as? String
    let mark = spec["mark"] as? String ?? "dot"
    return RichTextAnnotation(range: range, kind: kind,
      position: ["over", "under"].contains(position ?? "") ? position! : (kind == "ruby" ? "over" : "under"),
      mark: ["dot", "circle", "sesame"].contains(mark) ? mark : "dot", graphemes: graphemes, reading: reading)
  }

  /** A visual split, not a pronunciation parser. Per-character ruby supplies exact alignment. */
  func reading(forBaseIndices indices: Range<Int>) -> String {
    guard !graphemes.isEmpty, indices.lowerBound >= 0, indices.upperBound <= graphemes.count else { return "" }
    let start = indices.lowerBound * reading.count / graphemes.count
    let end = indices.upperBound * reading.count / graphemes.count
    return reading[start..<end].joined()
  }
}

func richTextEmphasisEligible(_ grapheme: String) -> Bool {
  guard !grapheme.contains("\u{fffc}") else { return false }
  return grapheme.unicodeScalars.contains { scalar in
    switch scalar.properties.generalCategory {
    case .uppercaseLetter, .lowercaseLetter, .titlecaseLetter, .modifierLetter, .otherLetter,
      .decimalNumber, .letterNumber, .otherNumber, .mathSymbol, .currencySymbol, .modifierSymbol, .otherSymbol:
      return true
    default: return false
    }
  }
}

func richTextRubyBaseEligible(_ grapheme: String) -> Bool {
  guard !grapheme.contains("\u{fffc}"), grapheme.rangeOfCharacter(from: .newlines) == nil else { return false }
  return grapheme.unicodeScalars.contains { scalar in
    switch scalar.properties.generalCategory {
    case .format, .control, .nonspacingMark, .spacingMark, .enclosingMark: return false
    default: return true
    }
  }
}

private let richTextStrongDirection = try! NSRegularExpression(pattern: "[\\p{bc=L}\\p{bc=R}\\p{bc=AL}]")
private let richTextRTLDirection = try! NSRegularExpression(pattern: "[\\p{bc=R}\\p{bc=AL}]")

/** ICU Unicode bidi properties resolve logical end alignment; TextKit shapes and orders the text. */
func richTextFirstStrongIsRTL(_ text: String) -> Bool? {
  let range = NSRange(location: 0, length: (text as NSString).length)
  guard let first = richTextStrongDirection.firstMatch(in: text, range: range) else { return nil }
  return richTextRTLDirection.firstMatch(in: text, range: first.range) != nil
}
