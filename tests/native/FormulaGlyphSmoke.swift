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
    #if canImport(UIKit)
    let normalized = source // The iOS smoke goes through the production attachment loader.
    #else
    guard let normalized = FormulaGlyphSVG.groupTransforms(in: source) else { fatalError("Formula rewrite failed") }
    #endif
    let expected = mask(reference)
    precondition(expected.contains(255))
    precondition(mask(normalized) == expected, "Rendered glyph positions or dimensions changed")
    print("Formula glyph raster geometry passed")
  }
}
