import CoreText
import UIKit

/** Run as an iOS simulator executable; this exercises actual TextKit line layout. */
@main
struct UIKitAnnotationsSmoke {
  static var checks = 0
  static func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
    precondition(condition(), message)
    checks += 1
  }

  static func layout(_ text: String, width: CGFloat, annotations: [RichTextSpec],
                     fontSize: CGFloat = 20, lineHeight: CGFloat = 28, bold: Bool = false,
                     paragraphSpacingBefore: CGFloat = 0, paragraphSpacing: CGFloat = 0) -> (NSTextStorage, RichTextLayoutManager, NSTextContainer) {
    let storage = NSTextStorage()
    let manager = RichTextLayoutManager()
    let container = NSTextContainer(size: CGSize(width: width, height: .greatestFiniteMagnitude))
    container.lineFragmentPadding = 0
    storage.addLayoutManager(manager)
    manager.addTextContainer(container)
    let font = bold ? UIFont.boldSystemFont(ofSize: fontSize) : UIFont.systemFont(ofSize: fontSize)
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.paragraphSpacingBefore = paragraphSpacingBefore
    paragraph.paragraphSpacing = paragraphSpacing
    let content = NSAttributedString(string: text, attributes: [.font: font, .foregroundColor: UIColor.black, .paragraphStyle: paragraph])
    manager.annotations = annotations.compactMap {
      RichTextDrawAnnotation.make($0, content: content, fallback: font, color: .black, language: "ja")
    }
    storage.setAttributedString(content)
    manager.ensureLayout(for: container)
    return (storage, manager, container)
  }

  static func lineRects(_ manager: RichTextLayoutManager, _ container: NSTextContainer) -> [(fragment: CGRect, used: CGRect)] {
    var lines: [(CGRect, CGRect)] = []
    manager.enumerateLineFragments(forGlyphRange: manager.glyphRange(for: container)) { fragment, used, _, _, _ in
      lines.append((fragment, used))
    }
    return lines
  }

  static func verifyReusableLineSpace() {
    let text = "汉字注音"
    let notes: [RichTextSpec] = [["start": 0, "end": 4, "kind": "ruby", "text": "hàn zì zhù yīn"]]
    // Compiler-sized body and heading styles, including a line with enough
    // existing leading to contain ruby without increasing its height at all.
    let cases: [(CGFloat, CGFloat, Bool)] = [(14, 28, false), (17, 28, false), (20, 28, false), (24, 40, false), (28.05, 46.2, true)]
    for (fontSize, lineHeight, bold) in cases {
      let (plainStorage, plain, plainContainer) = layout(text, width: 240, annotations: [], fontSize: fontSize, lineHeight: lineHeight, bold: bold)
      let (storage, manager, container) = layout(text, width: 240, annotations: notes, fontSize: fontSize, lineHeight: lineHeight, bold: bold)
      let fullBand = manager.annotations[0].band
      for (reading, language) in [("かん", "ja"), ("ㄓㄨˋ", "zh-Hant"), ("hǎn pīnyīn a\u{304}", "zh-Hans")] {
        let note = RichTextDrawAnnotation.make(["start": 0, "end": 4, "kind": "ruby", "text": reading],
          content: storage, fallback: UIFont.systemFont(ofSize: fontSize), color: .black, language: language)!
        let actual = NSAttributedString(string: reading, attributes: [.font: note.rubyFont,
          NSAttributedString.Key(kCTLanguageAttributeName as String): language]).size()
        expect(actual.height <= note.height + 0.01,
          "The reserved ruby band must fit actual \(reading) at body font size \(fontSize)")
      }
      let extra = manager.usedRect(for: container).height - plain.usedRect(for: plainContainer).height
      expect(plain.annotationGlyphMetrics.isEmpty, "Documents without annotations must not cache per-glyph annotation metrics")
      expect(extra >= -0.01 && extra < fullBand - 1, "Existing minimum-line-height leading must be reused instead of adding an entire ruby band")
      let placements = manager.annotationPlacements(forGlyphRange: manager.glyphRange(for: container))
      expect(placements.count == 1 && placements[0].rect.minY >= -0.01, "Reused first-line leading cannot clip the reading")
      expect(storage.string == text, "Line-space reuse cannot modify the source buffer")
      if fontSize == 14 {
        expect(abs(extra) < 0.01, "Ruby that fits entirely inside existing leading must add no height")
        expect(abs(manager.location(forGlyphAt: 0).y - plain.location(forGlyphAt: 0).y) < 0.01, "A fitting annotation must leave the original baseline unchanged")
      }
      if fontSize == 17 {
        print(String(format: "17/28 ruby top increment: full band %.3f pt -> necessary %.3f pt", fullBand, extra))
      }
      withExtendedLifetime([plainStorage, storage]) {}
    }

    let paragraphs = "汉字\n注音"
    let paragraphNotes: [RichTextSpec] = [
      ["start": 0, "end": 2, "kind": "ruby", "text": "hàn zì"],
      ["start": 3, "end": 5, "kind": "ruby", "text": "zhù yīn", "position": "under"]
    ]
    let (plainStorage, plain, plainContainer) = layout(paragraphs, width: 240, annotations: [], fontSize: 17,
      paragraphSpacingBefore: 11, paragraphSpacing: 15)
    let (storage, manager, container) = layout(paragraphs, width: 240, annotations: paragraphNotes, fontSize: 17,
      paragraphSpacingBefore: 11, paragraphSpacing: 15)
    let before = lineRects(plain, plainContainer)
    let after = lineRects(manager, container)
    expect(before.count == 2 && after.count == 2, "Paragraph spacing regression uses two actual TextKit paragraphs")
    for (original, annotated) in zip(before, after) {
      expect(abs((original.used.minY - original.fragment.minY) - (annotated.used.minY - annotated.fragment.minY)) < 0.01,
        "Paragraph spacing before a line must not be consumed as annotation leading")
      expect(abs((original.fragment.maxY - original.used.maxY) - (annotated.fragment.maxY - annotated.used.maxY)) < 0.01,
        "Paragraph spacing after a line must not be consumed as annotation leading")
    }
    let placements = manager.annotationPlacements(forGlyphRange: manager.glyphRange(for: container))
    expect(placements[0].rect.minY >= after[0].used.minY && placements[1].rect.maxY <= after[1].used.maxY,
      "Annotations stay inside text used rectangles, outside dedicated paragraph gaps")
    withExtendedLifetime([plainStorage, storage]) {}

    let (updateStorage, updateManager, updateContainer) = layout(text, width: 240, annotations: notes, fontSize: 17)
    for (size, height): (CGFloat, CGFloat) in [(24, 40), (17, 28)] {
      let font = UIFont.systemFont(ofSize: size)
      let style = NSMutableParagraphStyle(); style.minimumLineHeight = height
      let content = NSAttributedString(string: text, attributes: [.font: font, .paragraphStyle: style])
      updateManager.resetAnnotationGeometry()
      updateManager.annotations = notes.compactMap { RichTextDrawAnnotation.make($0, content: content, fallback: font, color: .black, language: "zh") }
      updateStorage.setAttributedString(content)
      updateManager.ensureLayout(for: updateContainer)
      let (freshStorage, fresh, freshContainer) = layout(text, width: 240, annotations: notes, fontSize: size, lineHeight: height)
      expect(abs(updateManager.usedRect(for: updateContainer).height - fresh.usedRect(for: freshContainer).height) < 0.01,
        "Same-length font updates must discard old fallback metrics")
      let updatedNote = updateManager.annotationPlacements(forGlyphRange: updateManager.glyphRange(for: updateContainer))[0]
      let freshNote = fresh.annotationPlacements(forGlyphRange: fresh.glyphRange(for: freshContainer))[0]
      expect(abs(updatedNote.rect.minY - freshNote.rect.minY) < 0.01 && abs(updatedNote.rect.height - freshNote.rect.height) < 0.01,
        "24-to-17 font changes must recreate the same annotation geometry as fresh layout")
      withExtendedLifetime(freshStorage) {}
    }
    withExtendedLifetime(updateStorage) {}

    let attachmentText = "汉字\n附件\u{fffc}后段"
    let (partialStorage, partial, partialContainer) = layout(attachmentText, width: 240, annotations: [
      ["start": 0, "end": 2, "kind": "ruby", "text": "hàn zì"],
      ["start": 3, "end": 5, "kind": "ruby", "text": "fù jiàn"]
    ], fontSize: 17)
    let attachment = NSTextAttachment()
    attachment.bounds = CGRect(x: 0, y: 0, width: 20, height: 20)
    let slot = NSRange(location: 5, length: 1)
    partialStorage.addAttribute(.attachment, value: attachment, range: slot)
    partial.ensureLayout(for: partialContainer)
    let firstBefore = partial.annotationPlacements(forGlyphRange: partial.glyphRange(for: partialContainer))[0].rect
    let heightBefore = partial.usedRect(for: partialContainer).height
    attachment.bounds.size.height = 60
    partial.invalidateLayout(forCharacterRange: slot, actualCharacterRange: nil)
    partial.ensureLayout(for: partialContainer)
    let afterAttachment = partial.annotationPlacements(forGlyphRange: partial.glyphRange(for: partialContainer))
    expect(partial.usedRect(for: partialContainer).height > heightBefore, "The partial invalidation test changes actual attachment line geometry")
    expect(afterAttachment.count == 2 && afterAttachment[0].rect == firstBefore,
      "Relayout of a later attachment must keep earlier valid ruby visible and in place")
    partialStorage.addAttribute(.font, value: UIFont.systemFont(ofSize: 24), range: NSRange(location: 3, length: 2))
    partial.ensureLayout(for: partialContainer)
    let afterFontEdit = partial.annotationPlacements(forGlyphRange: partial.glyphRange(for: partialContainer))
    expect(afterFontEdit.count == 2 && afterFontEdit[0].rect == firstBefore,
      "Editing a later paragraph's font must not erase annotation geometry in an unchanged earlier paragraph")
    withExtendedLifetime(partialStorage) {}

    let (raisedStorage, raised, raisedContainer) = layout("汉字", width: 240, annotations: [
      ["start": 0, "end": 2, "kind": "ruby", "text": "hàn zì"]
    ], fontSize: 17)
    raisedStorage.addAttribute(.baselineOffset, value: 5, range: NSRange(location: 0, length: 1))
    raised.ensureLayout(for: raisedContainer)
    let raisedNote = raised.annotationPlacements(forGlyphRange: raised.glyphRange(for: raisedContainer))[0]
    let raisedTextTop = raised.location(forGlyphAt: 0).y - raised.annotationGlyphMetrics[0]!.ascent
    expect(raisedNote.rect.maxY < raisedTextTop, "Ruby drawing must account for the actual glyph baseline of a raised first character")
    expect(raisedNote.rect.minY >= 0, "Raised-character ruby must still fit the first measured line")
    withExtendedLifetime(raisedStorage) {}
  }

  static func main() throws {
    verifyReusableLineSpace()
    let text = "漢字仮名交錯文章"
    let range: RichTextSpec = ["start": 0, "end": (text as NSString).length]
    func spec(_ values: RichTextSpec) -> RichTextSpec { range.merging(values) { _, new in new } }
    let (plainStorage, plainManager, plainContainer) = layout(text, width: 70, annotations: [])
    let plainHeight = plainManager.usedRect(for: plainContainer).height
    let (storage, manager, container) = layout(text, width: 70, annotations: [
      spec(["kind": "ruby", "text": "かんじかなこうさくぶんしょう", "position": "over"]),
      spec(["kind": "emphasis", "position": "over", "mark": "circle"]),
      spec(["kind": "emphasis", "position": "under", "mark": "sesame"])
    ])
    let glyphs = manager.glyphRange(for: container)
    let used = manager.usedRect(for: container)
    let placements = manager.annotationPlacements(forGlyphRange: glyphs)
    expect(storage.string == text, "Native annotation layout must not insert source characters")
    expect(used.height > plainHeight, "The measured text container includes reserved annotation bands")
    expect(placements.allSatisfy { $0.rect.minY >= 0 && $0.rect.maxY <= used.maxY + 0.01 }, "First and last annotation lines fit the measured height")
    let ruby = placements.filter { $0.annotation.model.kind == "ruby" }
    expect(ruby.count > 1, "The test exercises soft-wrapped ruby")
    expect(ruby.map(\.text).joined() == "かんじかなこうさくぶんしょう", "All ruby graphemes survive visual wrapping exactly once")
    expect(placements.filter { $0.annotation.model.kind == "emphasis" }.count == 16, "Every base grapheme gets one mark per requested side")
    var lineRects: [CGRect] = []
    manager.enumerateLineFragments(forGlyphRange: glyphs) { rect, _, _, _, _ in lineRects.append(rect) }
    expect(zip(lineRects, lineRects.dropFirst()).allSatisfy { $0.maxY <= $1.minY + 0.01 }, "Reserved bands cannot overlap adjacent line fragments")
    for note in ruby {
      let otherMarks = placements.filter { $0.annotation.model.kind == "emphasis" }
      expect(otherMarks.allSatisfy { !$0.rect.intersects(note.rect) }, "Ruby and emphasis occupy distinct bands")
      expect(note.rect.minX >= -0.01 && note.rect.maxX <= container.size.width + 0.01, "Ruby stays inside its base visual fragment")
    }
    let clusterText = "汉e\u{301}👨‍👩‍👧‍👦， \u{fffc}"
    let (clusterStorage, clusterManager, clusterContainer) = layout(clusterText, width: 300, annotations: [
      ["start": 0, "end": (clusterText as NSString).length, "kind": "emphasis"]
    ])
    expect(clusterManager.annotationPlacements(forGlyphRange: clusterManager.glyphRange(for: clusterContainer)).count == 3,
      "Actual glyph geometry keeps ZWJ emoji and combining letters together and skips punctuation/attachments")
    let (underStorage, underManager, underContainer) = layout("漢字", width: 100, annotations: [
      ["start": 0, "end": 2, "kind": "ruby", "position": "under", "text": "かんじ"],
      ["start": 0, "end": 2, "kind": "emphasis", "position": "under"]
    ])
    let underPlacements = underManager.annotationPlacements(forGlyphRange: underManager.glyphRange(for: underContainer))
    let underRuby = underPlacements.first { $0.annotation.model.kind == "ruby" }!
    expect(underPlacements.filter { $0.annotation.model.kind == "emphasis" }.allSatisfy { $0.rect.maxY < underRuby.rect.minY },
      "Below-line ruby stays outside below-line emphasis")
    expect(underRuby.rect.maxY <= underManager.usedRect(for: underContainer).maxY, "Below-line ruby participates in the final measured height")

    let (resizeStorage, resizeManager, resizeContainer) = layout(text, width: 70, annotations: [
      spec(["kind": "ruby", "text": "かんじかなこうさくぶんしょう"])
    ])
    let originalResizeHeight = resizeManager.usedRect(for: resizeContainer).height
    resizeContainer.size.width = 140
    resizeManager.ensureLayout(for: resizeContainer)
    expect(resizeManager.usedRect(for: resizeContainer).height < originalResizeHeight, "A wider container recalculates annotation bands without stale line heights")
    expect(resizeManager.annotationPlacements(forGlyphRange: resizeManager.glyphRange(for: resizeContainer)).map(\.text).joined() == "かんじかなこうさくぶんしょう",
      "Reflow preserves the complete reading after width changes")
    resizeManager.annotations = []
    resizeContainer.size.width = 70
    resizeManager.invalidateLayout(forCharacterRange: NSRange(location: 0, length: resizeStorage.length), actualCharacterRange: nil)
    resizeManager.ensureLayout(for: resizeContainer)
    expect(abs(resizeManager.usedRect(for: resizeContainer).height - plainHeight) < 0.01, "Removing annotations removes their reserved line height")

    let end = RichTextConfig.parse("{\"textAlign\":\"end\",\"writingDirection\":\"auto\",\"language\":\"ar\"}")
    expect(end.alignment(for: "العربية") == .left && end.alignment(for: "English") == .right, "Logical end follows each paragraph's first strong direction")
    let style = NSMutableParagraphStyle()
    RichTextConfig.parse("{\"writingDirection\":\"rtl\",\"textAlign\":\"start\",\"language\":\"ko-KR\",\"hyphenation\":\"normal\"}").configure(style, text: "한국어")
    expect(style.baseWritingDirection == .rightToLeft && style.alignment == .right, "Explicit RTL direction and start alignment agree")
    expect(style.lineBreakStrategy.contains(.hangulWordPriority), "Korean language opts into the system Hangul word strategy")
    expect(style.usesDefaultHyphenation, "Normal hyphenation delegates to the system")
    RichTextConfig.parse("{\"hyphenation\":\"full\"}").configure(style, text: "Donaudampfschifffahrt")
    expect(style.hyphenationFactor == 1 && !style.usesDefaultHyphenation, "Full hyphenation uses the system's maximum factor")
    RichTextConfig.parse("{\"hyphenation\":\"none\"}").configure(style, text: "Donaudampfschifffahrt")
    expect(style.hyphenationFactor == 0 && !style.usesDefaultHyphenation, "Disabled hyphenation clears both paragraph controls")

    let image = UIGraphicsImageRenderer(size: CGSize(width: 90, height: used.height + 20)).image { context in
      UIColor.white.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 90, height: used.height + 20))
      manager.drawGlyphs(forGlyphRange: glyphs, at: CGPoint(x: 10, y: 10))
      if ProcessInfo.processInfo.environment["RICH_FLOW_SMOKE_GUIDES"] == "1" {
        context.cgContext.setStrokeColor(UIColor.red.cgColor)
        context.cgContext.setLineWidth(0.5)
        for placement in placements { context.cgContext.stroke(placement.rect.offsetBy(dx: 10, dy: 10)) }
      }
    }
    if let path = ProcessInfo.processInfo.environment["RICH_FLOW_SMOKE_IMAGE"], let png = image.pngData() {
      try png.write(to: URL(fileURLWithPath: path))
    }
    withExtendedLifetime([plainStorage, clusterStorage, storage, underStorage, resizeStorage]) {}
    print("iOS TextKit annotation geometry smoke: \(checks) checks passed")
  }
}
