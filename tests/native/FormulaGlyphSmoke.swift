import CoreGraphics
import Foundation
#if canImport(UIKit)
import UIKit
#else
import AppKit
#endif

@main struct FormulaGlyphSmoke {
  static func mask(_ svg: String) -> [UInt8] {
    let data = Data(svg.utf8)
    #if canImport(UIKit)
    var image: CGImage?
    var finished = false
    RichTextAttachmentLoader.load(spec: ["kind": "formula", "url": "data:image/svg+xml;base64," + data.base64EncodedString()],
                                  fontSize: 16, maxWidth: 64) { asset in
      image = asset?.image.cgImage
      finished = true
    }
    let deadline = Date().addingTimeInterval(10)
    while !finished && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.01)) }
    #else
    let image = NSImage(data: data)?.cgImage(forProposedRect: nil, context: nil, hints: nil)
    #endif
    guard let image else { fatalError("System SVG decoder could not read the fixture") }
    var pixels = [UInt8](repeating: 0, count: 64 * 32 * 4)
    pixels.withUnsafeMutableBytes { bytes in
      let context = CGContext(data: bytes.baseAddress, width: 64, height: 32, bitsPerComponent: 8,
                              bytesPerRow: 64 * 4, space: CGColorSpaceCreateDeviceRGB(),
                              bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      context.draw(image, in: CGRect(x: 0, y: 0, width: 64, height: 32))
    }
    return pixels
  }

  static func expectSamePixels(_ source: String, _ reference: String) {
    #if canImport(UIKit)
    let normalized = source // The iOS smoke goes through the production attachment loader.
    #else
    guard let normalized = FormulaGlyphSVG.groupTransforms(in: source) else { fatalError("Formula rewrite failed") }
    #endif
    let expected = mask(reference)
    precondition(expected.contains(255))
    precondition(mask(normalized) == expected, "Rendered glyph positions or dimensions changed")
  }

  static func main() {
    let root = #"<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="32" viewBox="0 0 64 32">"#
    let source = root + ##"""
      <title>Testing &amp; glyphs</title>
      <defs>
        <path id="tile" d="M0 0h8v8H0z"/>
      </defs>
      <use xlink:href="#tile" x="2" y="1" transform="translate(5 4) scale(2)"/>
      <g transform="translate(45 10)">
        <use x="4" y="2" xlink:href="#tile" transform="scale(.5)"></use>
      </g>
      <use xlink:href="#tile" x="30" y="18"/>
      </svg>
      """##
    let reference = root + #"<path d="M9 6h16v16H9z M47 11h4v4h-4z M30 18h8v8h-8z"/></svg>"#
    expectSamePixels(source, reference)

    // Both styled 2×2 glyphs must occupy 6×6 pixels, including the offset use.
    // The unstyled sibling keeps its independent translation and 2× scale.
    let styled = root + ##"""
      <defs><path id="tile" d="M1 1h2v2H1z"/></defs>
      <use class="glyph" xlink:href="#tile" transform="scale(2)"/>
      <g transform="translate(13 0)"><use class="glyph" x="2" y="1" xlink:href="#tile" transform="scale(2)"/></g>
      <use x="2" y="1" xlink:href="#tile" transform="translate(34 5) scale(2)"/>
      <style>.glyph { transform: scale(3) }</style>
      </svg>
      """##
    let scaledTiles = root + #"<path d="M3 3h6v6H3z M22 6h6v6h-6z M40 9h4v4h-4z"/></svg>"#
    expectSamePixels(styled, scaledTiles)
    let cascade = styled
      .replacingOccurrences(of: #"<use class="glyph" xlink"#, with: #"<use id="named" style="opacity:0.5;" class="glyph" xlink"#)
      .replacingOccurrences(of: ".glyph { transform: scale(3) }", with: """
        use.glyph { transform: scale(4) !important }
        use.glyph { transform: scale(3) !important }
        .glyph { transform: scale(5) !important }
        #named { transform: scale(7) }
        """)
    let paintedTiles = root + #"<path d="M3 3h6v6H3z" opacity="0.5"/><path d="M22 6h6v6h-6z M40 9h4v4h-4z"/></svg>"#
    precondition(mask(paintedTiles) != mask(scaledTiles), "The opacity reference must change the rendered pixels")
    expectSamePixels(cascade, paintedTiles)

    let pivoted = root + ##"""
      <defs><path id="tile" d="M1 1h2v2H1z"/></defs>
      <style>.glyph { transform: scale(3) }</style>
      <use class="glyph" x="10" y="10" transform-origin="10px 10px" transform="scale(2)" xlink:href="#tile"/>
      </svg>
      """##
    expectSamePixels(pivoted, root + #"<path d="M13 13h6v6h-6z"/></svg>"#)
    for css in ["@media (min-width: 1px) { .glyph { transform: scale(3) } }", ".glyph { transform: var(--zoom) }"] {
      guard let rules = FormulaGlyphStylesheet.read(from: root + "<style>\(css)</style></svg>"),
            case .preserve = rules.transform(for: ["class": "glyph"]),
            case .attribute = rules.transform(for: [:]) else { fatalError("Only the dependent glyph must retain its native CSS") }
    }

    let shifted = root.replacingOccurrences(of: "0 0 64 32", with: "-8 -3 64 32")
    let origins = shifted + ##"""
      <defs>
        <path id="tile" d="M0 0h4v4H0z"/>
      </defs>
      <use id="scaled" xlink:href="#tile" x="10" y="10" transform="scale(2)" transform-origin="10px 10px"/>
      <use xlink:href="#tile" x="23" y="8" transform="translate(3 1) scale(2)" transform-origin="23 8"/>
      </svg>
      """##
    expectSamePixels(origins, shifted + #"<path d="M10 10h8v8h-8z M26 9h8v8h-8z"/></svg>"#)
    let referenced = origins.replacingOccurrences(of: "</svg>", with: ##"<use xlink:href="#scaled" x="12"/></svg>"##)
    guard let rewritten = FormulaGlyphSVG.groupTransforms(in: referenced) else { fatalError("Formula rewrite failed") }
    precondition(rewritten.contains(#"<g id="scaled"><g transform=""#) && rewritten.contains(##"xlink:href="#scaled""##),
                 "References must still resolve to the group containing the pivoted transform")

    let transform = #"transform="scale(2)""#
    for attributes in [#"transform-origin="10px""#, #"transform-origin="center 50%""#,
                       #"transform-box="fill-box" transform-origin="10px 10px""#,
                       #"style="transform-origin:var(--pivot)""#] {
      let raw = root + "<use \(transform) \(attributes)/><use transform=\"scale(3)\"/></svg>"
      guard let rewritten = FormulaGlyphSVG.groupTransforms(in: raw),
            let use = rewritten.split(separator: "<").first(where: { $0.hasPrefix("use ") }) else { fatalError("Missing use") }
      precondition(use.contains(transform) && use.contains("transform-origin"), "Keep unresolved transforms with their origin")
      precondition(rewritten.contains(#"<g transform="scale(3)">"#), "Independent glyph transforms must still be normalized")
    }
    print("Formula glyph raster geometry passed")
  }
}
