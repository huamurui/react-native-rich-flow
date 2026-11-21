import Foundation

/// Apple's SVG rasterizer applies transformations to groups reliably. MathJax
/// places them on glyph references instead. Only used for validated formula SVG.
final class FormulaGlyphSVG: NSObject, XMLParserDelegate {
  private var output = ""
  private var closingGroups: [String] = []
  private let stylesheet: FormulaGlyphStylesheet?

  private init(stylesheet: FormulaGlyphStylesheet?) {
    self.stylesheet = stylesheet
  }

  static func groupTransforms(in validatedMarkup: String) -> String? {
    let writer = FormulaGlyphSVG(stylesheet: FormulaGlyphStylesheet.read(from: validatedMarkup))
    let parser = XMLParser(data: Data(validatedMarkup.utf8))
    // Preserve qualified names and explicit xmlns attributes when writing.
    parser.shouldProcessNamespaces = false
    parser.shouldResolveExternalEntities = false
    parser.delegate = writer
    return parser.parse() ? writer.output : nil
  }

  private func absoluteLength(_ token: Substring) -> Double? {
    let number = token.lowercased().hasSuffix("px") ? token.dropLast(2) : token
    guard number.allSatisfy({ "0123456789.eE+-".contains($0) }),
          let value = Double(number), value.isFinite else { return nil }
    return value
  }

  private struct WrapperTransform {
    let value: String
    let fromCSS: Bool
    var pivot: (x: Double, y: Double)?
  }

  private func wrapperTransform(for attributes: [String: String]) -> WrapperTransform? {
    let box = attributes["transform-box"]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard let attribute = attributes["transform"],
          attributes["style"]?.range(of: "transform", options: .caseInsensitive) == nil,
          box == nil || box == "view-box" else { return nil }

    let transform: String
    let fromCSS: Bool
    switch stylesheet?.transform(for: attributes) ?? .attribute {
    case .attribute: (transform, fromCSS) = (attribute, false)
    case .stylesheet(let value): (transform, fromCSS) = (value, true)
    case .preserve: return nil
    }
    let wrapper = WrapperTransform(value: transform, fromCSS: fromCSS)
    guard let origin = attributes["transform-origin"] else { return wrapper }
    let axes = origin.split(whereSeparator: { $0.isWhitespace })
    // Relative origins need layout information from the SVG renderer.
    guard axes.count == 2, let x = absoluteLength(axes[0]), let y = absoluteLength(axes[1]) else { return nil }
    if (x == 0 && y == 0) || (fromCSS && transform.lowercased() == "none") { return wrapper }
    if fromCSS { return WrapperTransform(value: transform, fromCSS: true, pivot: (x, y)) }
    return WrapperTransform(value: "translate(\(x) \(y)) \(transform) translate(\(-x) \(-y))", fromCSS: false)
  }

  private func escaped(_ text: String, attribute: Bool = false) -> String {
    let value = text.replacingOccurrences(of: "&", with: "&amp;")
      .replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: ">", with: "&gt;")
    guard attribute else { return value }
    return value.replacingOccurrences(of: "\"", with: "&quot;")
      .replacingOccurrences(of: "\t", with: "&#9;").replacingOccurrences(of: "\n", with: "&#10;")
      .replacingOccurrences(of: "\r", with: "&#13;")
  }

  func parser(_ parser: XMLParser, didStartElement element: String, namespaceURI: String?,
              qualifiedName: String?, attributes: [String: String]) {
    var attributes = attributes
    let name = element.split(separator: ":").last
    var closing = ""
    if name == "use", let transform = wrapperTransform(for: attributes) {
      attributes.removeValue(forKey: "transform")
      attributes.removeValue(forKey: "transform-origin")
      let prefix = element.dropLast(3)
      let group = "\(prefix)g"
      // Put declarations on the wrapper too when this element defines its prefix.
      let declaration = prefix.isEmpty ? "xmlns" : "xmlns:\(prefix.dropLast())"
      let namespace = attributes[declaration].map { " \(declaration)=\"\(escaped($0, attribute: true))\"" } ?? ""
      output += "<\(group)\(namespace)"
      closing = "</\(group)>"
      // CoreSVG can skip the transform on the referenced element itself too.
      // Keep the transform inside the named group for nested references.
      if let id = attributes.removeValue(forKey: "id") {
        if transform.fromCSS { output += " style=\"transform:none!important\"" }
        output += " id=\"\(escaped(id, attribute: true))\"><\(group)"
        closing += "</\(group)>"
      }
      if transform.fromCSS {
        // Keep pivot translations in SVG user units on separate groups. CoreSVG
        // drops the glyph when they are mixed into the CSS transform list.
        if let (x, y) = transform.pivot {
          output += " transform=\"translate(\(x) \(y))\"><\(group)"
          closing += "</\(group)>"
        }
        // The child still matches its original selectors for fill and other styles.
        // Keep the reset first: CoreSVG stops at a leading empty CSS declaration.
        attributes["style"] = "transform:none!important;" + (attributes["style"] ?? "")
        output += " style=\"transform:\(escaped(transform.value, attribute: true))!important\">"
        if let (x, y) = transform.pivot {
          output += "<\(group) transform=\"translate(\(-x) \(-y))\">"
          closing += "</\(group)>"
        }
      } else {
        output += " transform=\"\(escaped(transform.value, attribute: true))\">"
      }
    }
    closingGroups.append(closing)
    output += "<\(element)"
    for (key, value) in attributes { output += " \(key)=\"\(escaped(value, attribute: true))\"" }
    output += ">"
  }

  func parser(_ parser: XMLParser, didEndElement element: String, namespaceURI: String?, qualifiedName: String?) {
    output += "</\(element)>"
    output += closingGroups.removeLast()
  }

  func parser(_ parser: XMLParser, foundCharacters string: String) { output += escaped(string) }
  func parser(_ parser: XMLParser, foundIgnorableWhitespace string: String) { output += escaped(string) }
  func parser(_ parser: XMLParser, foundCDATA data: Data) { output += escaped(String(decoding: data, as: UTF8.self)) }
}
