import CoreText
import UIKit

struct RichTextDrawAnnotation {
  let model: RichTextAnnotation
  let color: UIColor
  let font: UIFont
  let language: String?

  var gap: CGFloat { max(1, font.pointSize * 0.1) }
  var markSize: CGFloat { max(2, font.pointSize * 0.16) }
  var rubyFont: UIFont { font.withSize(font.pointSize * 0.5) }
  var height: CGFloat { model.kind == "ruby" ? ceil(rubyFont.lineHeight) : markSize }
  var band: CGFloat { height + gap }

  static func make(_ spec: RichTextSpec, content: NSAttributedString, fallback: UIFont,
                   color: UIColor, language: String?) -> RichTextDrawAnnotation? {
    guard let model = RichTextAnnotation.parse(spec, in: content.string as NSString) else { return nil }
    var largestFont: UIFont?
    content.enumerateAttribute(.font, in: model.range) { value, _, _ in
      if let candidate = value as? UIFont, candidate.pointSize > (largestFont?.pointSize ?? 0) { largestFont = candidate }
    }
    return RichTextDrawAnnotation(model: model, color: richTextColor(spec["color"], fallback: color), font: largestFont ?? fallback, language: language)
  }
}

struct RichTextAnnotationBands {
  var overEmphasis: CGFloat = 0
  var overRuby: CGFloat = 0
  var underEmphasis: CGFloat = 0
  var underRuby: CGFloat = 0
  var over: CGFloat { overEmphasis + overRuby }
  var under: CGFloat { underEmphasis + underRuby }
}

struct RichTextAnnotationPlacement {
  let annotation: RichTextDrawAnnotation
  let rect: CGRect
  let text: String
}

struct RichTextAnnotationGlyphMetrics {
  let characterIndex: Int
  let ascent: CGFloat
  let descent: CGFloat
  let isControl: Bool
}

extension RichTextLayoutManager {
  private func annotationMetrics(forGlyphAt index: Int) -> (ascent: CGFloat, descent: CGFloat, baselineOffset: CGFloat)? {
    guard let storage = textStorage else { return nil }
    let source = storage.string as NSString
    let characterIndex = self.characterIndexForGlyph(at: index)
    guard characterIndex < source.length else { return nil }
    let cluster = source.substring(with: source.rangeOfComposedCharacterSequence(at: characterIndex))
    // Invisible whitespace has no text edge to place an annotation against.
    guard cluster.rangeOfCharacter(from: .whitespacesAndNewlines.inverted) != nil,
          cluster != "\u{fffc}" else { return nil }
    let metric = annotationGlyphMetrics[index]
    let offset = CGFloat((storage.attribute(.baselineOffset, at: characterIndex, effectiveRange: nil) as? NSNumber)?.doubleValue ?? 0)
    if let metric, metric.characterIndex == characterIndex {
      guard !metric.isControl else { return nil }
      return (metric.ascent, metric.descent, offset)
    }
    // Normal view rebuilds reset glyph metrics and populate them before line
    // layout. Resolve the font again for externally edited/reused glyph storage.
    let font = storage.attribute(.font, at: characterIndex, effectiveRange: nil) as? UIFont ?? .systemFont(ofSize: 17)
    let resolved = CTFontCreateForString(font, cluster as CFString, CFRange(location: 0, length: (cluster as NSString).length))
    return (CTFontGetAscent(resolved), CTFontGetDescent(resolved), offset)
  }

  func annotationTextMetrics(forGlyphRange glyphs: NSRange) -> (ascent: CGFloat, descent: CGFloat) {
    var ascent: CGFloat = 0
    var descent: CGFloat = 0
    for index in glyphs.location..<NSMaxRange(glyphs) {
      guard let metric = annotationMetrics(forGlyphAt: index) else { continue }
      ascent = max(ascent, metric.ascent + metric.baselineOffset)
      descent = max(descent, metric.descent - metric.baselineOffset)
    }
    return (ascent, descent)
  }

  /** Called only after layout, so glyph locations include baseline offsets and
      current attachment geometry. Partial relayout needs no line-position cache. */
  func annotationTextBounds(forGlyphRange glyphs: NSRange, lineOriginY: CGFloat) -> (top: CGFloat, bottom: CGFloat)? {
    var top = CGFloat.greatestFiniteMagnitude
    var bottom = -CGFloat.greatestFiniteMagnitude
    for index in glyphs.location..<NSMaxRange(glyphs) {
      guard let metric = annotationMetrics(forGlyphAt: index) else { continue }
      let baseline = lineOriginY + location(forGlyphAt: index).y
      top = min(top, baseline - metric.ascent)
      bottom = max(bottom, baseline + metric.descent)
    }
    return bottom >= top ? (top, bottom) : nil
  }

  func annotationBands(for characters: NSRange) -> RichTextAnnotationBands {
    var bands = RichTextAnnotationBands()
    for item in annotations where item.model.graphemes.contains(where: { NSIntersectionRange($0, characters).length > 0 }) {
      switch (item.model.position, item.model.kind) {
      case ("over", "ruby"): bands.overRuby = max(bands.overRuby, item.band)
      case ("over", _): bands.overEmphasis = max(bands.overEmphasis, item.band)
      case (_, "ruby"): bands.underRuby = max(bands.underRuby, item.band)
      default: bands.underEmphasis = max(bands.underEmphasis, item.band)
      }
    }
    return bands
  }

  /** These rects occupy reserved line bands, never the selectable text buffer. */
  func annotationPlacements(forGlyphRange visibleGlyphs: NSRange) -> [RichTextAnnotationPlacement] {
    guard !annotations.isEmpty, let container = textContainers.first, visibleGlyphs.length > 0 else { return [] }
    var placements: [RichTextAnnotationPlacement] = []
    enumerateLineFragments(forGlyphRange: visibleGlyphs) { lineRect, _, _, lineGlyphs, _ in
      let characters = self.characterRange(forGlyphRange: lineGlyphs, actualGlyphRange: nil)
      let bands = self.annotationBands(for: characters)
      guard let textBounds = self.annotationTextBounds(forGlyphRange: lineGlyphs, lineOriginY: lineRect.minY) else { return }
      let textTop = textBounds.top
      let textBottom = textBounds.bottom
      for item in self.annotations {
        let model = item.model
        let indices = model.graphemes.indices.filter { NSIntersectionRange(model.graphemes[$0], characters).length > 0 }
        guard let first = indices.first, let last = indices.last else { continue }
        let emphasisBand = model.position == "over" ? bands.overEmphasis : bands.underEmphasis
        let innerBand = model.kind == "ruby" ? emphasisBand : 0
        // Share the gap between the inner and outer edges; adjacent lines then
        // have separation even when both have annotations on the facing sides.
        let y = model.position == "over" ? textTop - innerBand - item.gap / 2 - item.height : textBottom + innerBand + item.gap / 2
        if model.kind == "ruby" {
          let text = model.reading(forBaseIndices: first..<(last + 1))
          guard !text.isEmpty else { continue }
          var baseRect = CGRect.null
          for index in indices {
            let glyphs = NSIntersectionRange(self.glyphRange(forCharacterRange: model.graphemes[index], actualCharacterRange: nil), lineGlyphs)
            if glyphs.length > 0 { baseRect = baseRect.union(self.boundingRect(forGlyphRange: glyphs, in: container)) }
          }
          guard !baseRect.isNull, baseRect.width > 0 else { continue }
          placements.append(RichTextAnnotationPlacement(annotation: item,
            rect: CGRect(x: baseRect.minX, y: y, width: baseRect.width, height: item.height), text: text))
        } else {
          for index in indices {
            let glyphs = NSIntersectionRange(self.glyphRange(forCharacterRange: model.graphemes[index], actualCharacterRange: nil), lineGlyphs)
            guard glyphs.length > 0 else { continue }
            let baseRect = self.boundingRect(forGlyphRange: glyphs, in: container)
            guard baseRect.width > 0 else { continue }
            placements.append(RichTextAnnotationPlacement(annotation: item,
              rect: CGRect(x: baseRect.midX - item.markSize / 2, y: y, width: item.markSize, height: item.markSize), text: ""))
          }
        }
      }
    }
    return placements
  }

  func drawAnnotations(forGlyphRange glyphs: NSRange, context: CGContext) {
    for placement in annotationPlacements(forGlyphRange: glyphs) {
      let item = placement.annotation
      let rect = placement.rect
      context.saveGState()
      if item.model.kind == "ruby" {
        var attributes: [NSAttributedString.Key: Any] = [.font: item.rubyFont, .foregroundColor: item.color]
        if let language = item.language { attributes[NSAttributedString.Key(kCTLanguageAttributeName as String)] = language }
        let reading = NSAttributedString(string: placement.text, attributes: attributes)
        let size = reading.size()
        let horizontalScale = min(1, rect.width / max(1, size.width))
        context.translateBy(x: rect.midX - size.width * horizontalScale / 2, y: rect.minY)
        context.scaleBy(x: horizontalScale, y: 1)
        reading.draw(at: .zero)
      } else {
        context.setFillColor(item.color.cgColor)
        context.setStrokeColor(item.color.cgColor)
        if item.model.mark == "circle" {
          context.setLineWidth(max(0.75, rect.width * 0.2))
          context.strokeEllipse(in: rect.insetBy(dx: rect.width * 0.1, dy: rect.height * 0.1))
        } else if item.model.mark == "sesame" {
          context.translateBy(x: rect.midX, y: rect.midY)
          context.rotate(by: -.pi / 5)
          context.fillEllipse(in: CGRect(x: -rect.width * 0.28, y: -rect.height * 0.45, width: rect.width * 0.56, height: rect.height * 0.9))
        } else { context.fillEllipse(in: rect) }
      }
      context.restoreGState()
    }
  }
}
