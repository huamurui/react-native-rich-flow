import Foundation

/// Resolve static transform rules on glyph references before moving them onto groups.
/// Rules requiring CSS layout or a richer selector stay with the original element.
final class FormulaGlyphStylesheet: NSObject, XMLParserDelegate {
  enum Decision { case attribute, stylesheet(String), preserve }

  private struct Selector {
    var ids: [String] = []
    var classes: [String] = []
    var type = false
    var specificity: (Int, Int, Int) { (ids.count, classes.count, type ? 1 : 0) }
  }

  private struct Rule {
    let selector: Selector
    // A conditional or partial selector match can affect which rule wins.
    let decision: Decision?
    let important: Bool
  }

  private var rules: [Rule] = []
  private var uncertain = false
  private var text: String?
  private var conditional = false
  private var byteCount = 0

  static func read(from markup: String) -> FormulaGlyphStylesheet? {
    guard markup.contains("<style") || markup.contains(":style") else { return nil }
    let result = FormulaGlyphStylesheet()
    let parser = XMLParser(data: Data(markup.utf8))
    parser.shouldProcessNamespaces = true
    parser.shouldResolveExternalEntities = false
    parser.delegate = result
    guard parser.parse() else { return result.uncertain ? result : nil }
    return result.uncertain || !result.rules.isEmpty ? result : nil
  }

  func transform(for attributes: [String: String]) -> Decision {
    if uncertain { return .preserve }
    let id = attributes["id"]
    let classes = Set((attributes["class"] ?? "").split(whereSeparator: { $0.isWhitespace }).map(String.init))
    var winner: Rule?
    for rule in rules where rule.selector.ids.allSatisfy({ $0 == id }) && rule.selector.classes.allSatisfy(classes.contains) {
      // Unknown selectors, conditional rules or a style controlling the pivot need the native cascade.
      guard rule.decision != nil else { return .preserve }
      if let old = winner {
        if old.important != rule.important {
          if !rule.important { continue }
        } else if old.selector.specificity > rule.selector.specificity { continue }
      }
      winner = rule
    }
    return winner?.decision ?? .attribute
  }

  func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?,
              qualifiedName: String?, attributes: [String: String]) {
    guard name == "style", (attributes["type"] ?? "text/css").lowercased() == "text/css" else { return }
    text = ""
    let media = (attributes["media"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    conditional = !media.isEmpty && media != "all"
  }

  func parser(_ parser: XMLParser, foundCharacters string: String) {
    guard text != nil else { return }
    // The attachment loader already bounds the SVG. Also bound the work per glyph.
    byteCount += string.utf8.count
    if byteCount > 64 * 1024 { uncertain = true; parser.abortParsing(); return }
    text?.append(string)
  }

  func parser(_ parser: XMLParser, foundCDATA data: Data) {
    self.parser(parser, foundCharacters: String(decoding: data, as: UTF8.self))
  }

  func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
    guard name == "style", let css = text else { return }
    text = nil
    guard css.range(of: "transform", options: .caseInsensitive) != nil
            || css.range(of: "all", options: .caseInsensitive) != nil || css.contains("\\") else { return }
    // Braces and delimiters inside comments and strings are not CSS syntax.
    let cleaned = css.replacingOccurrences(of: #"/\*[\s\S]*?(?:\*/|$)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'"#, with: " ", options: .regularExpression)
    if cleaned.contains("\\") { uncertain = true; return }
    collect(cleaned[...], conditional: conditional, depth: 0)
  }

  private func collect(_ sheet: Substring, conditional: Bool, depth: Int) {
    guard depth < 8 else { uncertain = true; return }
    var rest = sheet
    while !uncertain, let open = rest.firstIndex(of: "{") {
      var nesting = 1
      let bodyStart = rest.index(after: open)
      var end = bodyStart
      while end < rest.endIndex {
        if rest[end] == "{" { nesting += 1 }
        if rest[end] == "}" { nesting -= 1; if nesting == 0 { break } }
        end = rest.index(after: end)
      }
      guard end < rest.endIndex else { uncertain = true; return }
      let head = rest[..<open].split(separator: ";").last?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
      let body = rest[bodyStart..<end]
      if head.hasPrefix("@") && body.contains("{") {
        collect(body, conditional: true, depth: depth + 1)
      } else if body.contains("{") {
        uncertain = true // Nested selectors need their parent to be resolved.
      } else {
        for declaration in body.split(separator: ";") {
          guard let colon = declaration.firstIndex(of: ":") else { continue }
          let property = declaration[..<colon].trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
          guard ["transform", "transform-origin", "transform-box", "-webkit-transform", "all"].contains(property) else { continue }
          let raw = declaration[declaration.index(after: colon)...].trimmingCharacters(in: .whitespacesAndNewlines)
          let priority = raw.range(of: #"!\s*important\s*$"#, options: [.regularExpression, .caseInsensitive])
          let value = String(raw[..<(priority?.lowerBound ?? raw.endIndex)]).trimmingCharacters(in: .whitespacesAndNewlines)
          let decision: Decision? = conditional || property != "transform" ? nil : Self.movableTransform(value)
          for selector in head.split(separator: ",") {
            add(selector.trimmingCharacters(in: .whitespacesAndNewlines), decision: decision, important: priority != nil)
          }
        }
      }
      rest = rest[rest.index(after: end)...]
    }
  }

  // Moving a relative unit or var()/attr() to a new element can change its value.
  private static func movableTransform(_ value: String) -> Decision {
    let lower = value.lowercased()
    if lower == "none" { return .stylesheet(value) }
    let functions = lower.split(separator: ")", omittingEmptySubsequences: false)
    guard functions.count > 1, functions.last?.trimmingCharacters(in: .whitespacesAndNewlines) == "" else { return .preserve }
    let names = ["matrix", "scale", "scalex", "scaley", "translate", "translatex", "translatey", "rotate", "skew", "skewx", "skewy"]
    for function in functions.dropLast() {
      let parts = function.split(separator: "(", omittingEmptySubsequences: false)
      guard parts.count == 2, names.contains(parts[0].trimmingCharacters(in: .whitespacesAndNewlines)) else { return .preserve }
      let args = parts[1].split(whereSeparator: { $0.isWhitespace || $0 == "," })
      guard !args.isEmpty, args.allSatisfy({ arg in
        let unit = ["px", "deg", "grad", "rad", "turn"].first(where: { arg.hasSuffix($0) })
        return Double(arg.dropLast(unit?.count ?? 0))?.isFinite == true
      }) else { return .preserve }
    }
    return .stylesheet(value)
  }

  private func add(_ source: String, decision: Decision?, important: Bool) {
    // Static type, ID and class selectors, optionally compounded. A complex selector can
    // still be ruled out when its final simple subject could never match this use.
    let compounds = source.split(whereSeparator: { $0.isWhitespace || ">+~".contains($0) })
    guard let subject = compounds.last else { return }
    var s = subject[...]
    var selector = Selector()
    func isName(_ c: Character) -> Bool { c.isLetter || c.isNumber || c == "_" || c == "-" }
    if s.first == "*" { s = s.dropFirst() }
    else if let first = s.first, isName(first) {
      let type = s.prefix(while: isName)
      // Namespaces and functional selectors can change what the apparent type matches.
      if type != "use", !s.contains("|"), !source.contains("("), !source.contains("[") { return }
      selector.type = type == "use"
      s = s.dropFirst(type.count)
    }
    while let marker = s.first, marker == "#" || marker == "." {
      let name = s.dropFirst().prefix(while: isName)
      guard !name.isEmpty else { break }
      if marker == "#" { selector.ids.append(String(name)) } else { selector.classes.append(String(name)) }
      s = s.dropFirst(1 + name.count)
    }
    if rules.count >= 128 || selector.classes.count + selector.ids.count >= 64 { uncertain = true; return }
    let simple = compounds.count == 1 && s.isEmpty
    if source.contains("[") || source.contains("(") || source.contains("|") {
      selector = Selector() // The rightmost token may itself be inside a selector argument.
    }
    rules.append(Rule(selector: selector, decision: simple ? decision : nil, important: important))
  }
}
