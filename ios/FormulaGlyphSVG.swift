import Foundation

/// Apple's SVG rasterizer applies transformations to groups reliably. MathJax
/// places them on glyph references instead. Only used for validated formula SVG.
final class FormulaGlyphSVG: NSObject, XMLParserDelegate {
  private var output = ""
  private var closingGroups: [String] = []

  static func groupTransforms(in validatedMarkup: String) -> String? {
    let writer = FormulaGlyphSVG()
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

  private func wrapperTransform(for attributes: [String: String]) -> String? {
    let box = attributes["transform-box"]?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard let transform = attributes["transform"],
          attributes["style"]?.range(of: "transform", options: .caseInsensitive) == nil,
          box == nil || box == "view-box" else { return nil }
    guard let origin = attributes["transform-origin"] else { return transform }
    let axes = origin.split(whereSeparator: { $0.isWhitespace })
    // A single value defaults the other axis to center. Relative lengths,
    // keywords and other reference boxes need layout information.
    guard axes.count == 2, let x = absoluteLength(axes[0]), let y = absoluteLength(axes[1]) else { return nil }
    if x == 0 && y == 0 { return transform }
    // CoreSVG also ignores transform-origin on a group. Compose the actual
    // pivot in user coordinates, preserving the order of the original list.
    return "translate(\(x) \(y)) \(transform) translate(\(-x) \(-y))"
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
        output += " id=\"\(escaped(id, attribute: true))\"><\(group)"
        closing += "</\(group)>"
      }
      output += " transform=\"\(escaped(transform, attribute: true))\">"
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
