import UIKit

struct RichTextDrawDecoration {
  let range: NSRange
  let kind: String
  let color: UIColor
  let thickness: CGFloat
  let offset: CGFloat
}

/** TextKit 1 uses the same visual line geometry for text, selection and range decorations. */
final class RichTextLayoutManager: NSLayoutManager, NSLayoutManagerDelegate {
  var decorations: [RichTextDrawDecoration] = []
  var annotations: [RichTextDrawAnnotation] = []
  var annotationGlyphMetrics: [Int: RichTextAnnotationGlyphMetrics] = [:]
  var quotes: [NSRange] = []
  var quoteColor = UIColor.gray
  var scale: CGFloat = 1

  override init() {
    super.init()
    delegate = self
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    delegate = self
  }

  /** Rebuilds replace the entire buffer, including same-length font changes. */
  func resetAnnotationGeometry() {
    annotationGlyphMetrics.removeAll(keepingCapacity: true)
    if let storage = textStorage, storage.length > 0 {
      invalidateGlyphs(forCharacterRange: NSRange(location: 0, length: storage.length), changeInLength: 0, actualCharacterRange: nil)
    }
  }

  func layoutManager(_ layoutManager: NSLayoutManager,
                     shouldGenerateGlyphs glyphs: UnsafePointer<CGGlyph>,
                     properties: UnsafePointer<NSLayoutManager.GlyphProperty>,
                     characterIndexes: UnsafePointer<Int>, font: UIFont,
                     forGlyphRange glyphRange: NSRange) -> Int {
    guard !annotations.isEmpty else { return 0 }
    // This is the font TextKit actually selected, including CJK fallback fonts.
    // Reading glyph metrics here never asks TextKit to lay out an unfinished line.
    for offset in 0..<glyphRange.length {
      annotationGlyphMetrics[glyphRange.location + offset] = RichTextAnnotationGlyphMetrics(
        characterIndex: characterIndexes[offset], ascent: font.ascender, descent: -font.descender,
        isControl: properties[offset].contains(.controlCharacter) || properties[offset].contains(.null))
    }
    return 0 // Let TextKit generate and position every glyph normally.
  }

  func layoutManager(_ layoutManager: NSLayoutManager,
                     shouldSetLineFragmentRect lineFragmentRect: UnsafeMutablePointer<CGRect>,
                     lineFragmentUsedRect: UnsafeMutablePointer<CGRect>,
                     baselineOffset: UnsafeMutablePointer<CGFloat>,
                     in textContainer: NSTextContainer, forGlyphRange glyphRange: NSRange) -> Bool {
    guard !annotations.isEmpty else { return false }
    let characters = characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil)
    let bands = annotationBands(for: characters)
    guard bands.over + bands.under > 0 else { return false }
    let metrics = annotationTextMetrics(forGlyphRange: glyphRange)
    let baseline = lineFragmentRect.pointee.minY + baselineOffset.pointee
    let textTop = baseline - metrics.ascent
    let textBottom = baseline + metrics.descent
    // The used rect contains minimumLineHeight's reusable leading, but excludes
    // paragraphSpacingBefore/paragraphSpacing that belong between paragraphs.
    let over = max(0, lineFragmentUsedRect.pointee.minY - (textTop - bands.over))
    let under = max(0, textBottom + bands.under - lineFragmentUsedRect.pointee.maxY)
    baselineOffset.pointee += over
    lineFragmentRect.pointee.size.height += over + under
    lineFragmentUsedRect.pointee.size.height += over + under
    return over + under > 0
  }

  override func drawGlyphs(forGlyphRange glyphsToShow: NSRange, at origin: CGPoint) {
    super.drawGlyphs(forGlyphRange: glyphsToShow, at: origin)
    guard let container = textContainers.first,
          let storage = textStorage, let context = UIGraphicsGetCurrentContext() else { return }
    let source = storage.string as NSString
    context.saveGState()
    context.translateBy(x: origin.x, y: origin.y)
    drawAnnotations(forGlyphRange: glyphsToShow, context: context)
    for decoration in decorations {
      let glyphs = glyphRange(forCharacterRange: decoration.range, actualCharacterRange: nil)
      let visible = NSIntersectionRange(glyphs, glyphsToShow)
      guard visible.length > 0 else { continue }
      enumerateLineFragments(forGlyphRange: visible) { lineRect, _, _, lineGlyphs, _ in
        var part = NSIntersectionRange(glyphs, lineGlyphs)
        guard part.length > 0 else { return }
        var characters = self.characterRange(forGlyphRange: part, actualGlyphRange: nil)
        while characters.length > 0 && source.character(at: NSMaxRange(characters) - 1) == 10 {
          characters.length -= 1
        }
        guard characters.length > 0 else { return }
        part = self.glyphRange(forCharacterRange: characters, actualCharacterRange: nil)
        let baseline = lineRect.minY + self.location(forGlyphAt: part.location).y + decoration.offset
        self.enumerateEnclosingRects(forGlyphRange: part, withinSelectedGlyphRange: NSRange(location: NSNotFound, length: 0), in: container) { rect, _ in
          self.drawDecoration(decoration, from: rect.minX, to: rect.maxX, baseline: baseline, context: context)
        }
      }
    }
    context.setStrokeColor(quoteColor.cgColor)
    context.setLineWidth(max(1, 2 * scale))
    context.setLineDash(phase: 0, lengths: [])
    for quote in quotes {
      let glyphs = NSIntersectionRange(glyphRange(forCharacterRange: quote, actualCharacterRange: nil), glyphsToShow)
      guard glyphs.length > 0 else { continue }
      let rect = boundingRect(forGlyphRange: glyphs, in: container)
      context.move(to: CGPoint(x: 2 * scale, y: rect.minY))
      context.addLine(to: CGPoint(x: 2 * scale, y: rect.maxY))
      context.strokePath()
    }
    context.restoreGState()
  }

  private func drawDecoration(_ decoration: RichTextDrawDecoration, from left: CGFloat, to right: CGFloat, baseline: CGFloat, context: CGContext) {
    guard right > left else { return }
    context.saveGState()
    context.setStrokeColor(decoration.color.cgColor)
    context.setLineWidth(decoration.thickness)
    context.setLineCap(decoration.kind == "dotted" ? .round : .butt)
    switch decoration.kind {
    case "dashed": context.setLineDash(phase: 0, lengths: [4 * scale, 3 * scale])
    case "dotted": context.setLineDash(phase: 0, lengths: [max(0.1, 0.1 * scale), 2.5 * scale])
    default: context.setLineDash(phase: 0, lengths: [])
    }
    context.move(to: CGPoint(x: left, y: baseline))
    if decoration.kind == "wavy" {
      var x = left
      var direction: CGFloat = -1
      let halfWave = max(2, 2.8 * scale)
      while x < right {
        let next = min(right, x + halfWave)
        context.addQuadCurve(to: CGPoint(x: next, y: baseline), control: CGPoint(x: (x + next) / 2, y: baseline + direction * 2 * scale))
        x = next
        direction *= -1
      }
    } else {
      context.addLine(to: CGPoint(x: right, y: baseline))
    }
    context.strokePath()
    context.restoreGState()
  }
}

private final class FlowSelectionDoubleTapDelegate: NSObject, UIGestureRecognizerDelegate {
  private weak var textView: FlowTextView?
  private let selectionGestures: NSHashTable<UIGestureRecognizer>

  init(textView: FlowTextView, selectionGestures: NSHashTable<UIGestureRecognizer>) {
    self.textView = textView
    self.selectionGestures = selectionGestures
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    guard let textView else { return false }
    return textView.suppressDoubleTapSelection && textView.isSelectable && textView.selectedRange.length == 0 &&
      touch.type == .direct && !UIAccessibility.isVoiceOverRunning
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
    !selectionGestures.contains(otherGestureRecognizer)
  }
}

final class FlowTextView: UITextView {
  var copyResolver: ((NSRange) -> String?)?
  var suppressDoubleTapSelection = false {
    didSet { synchronizeSelectionGestures() }
  }
  private var doubleTapGuardInstalled = false
  private let selectionGestures = NSHashTable<UIGestureRecognizer>.weakObjects()
  private let guardedSelectionGestures = NSHashTable<UIGestureRecognizer>.weakObjects()
  private lazy var doubleTapDelegate = FlowSelectionDoubleTapDelegate(textView: self, selectionGestures: selectionGestures)
  private lazy var doubleTapGuard: UITapGestureRecognizer = {
    let gesture = UITapGestureRecognizer(target: self, action: #selector(reservedDoubleTap))
    gesture.numberOfTapsRequired = 2
    gesture.cancelsTouchesInView = false
    gesture.delaysTouchesBegan = false
    gesture.delaysTouchesEnded = false
    gesture.delegate = doubleTapDelegate
    return gesture
  }()

  override func layoutSubviews() {
    super.layoutSubviews()
    synchronizeSelectionGestures()
  }

  /** UIKit may recreate its text interactions when selectability or layout changes. */
  func synchronizeSelectionGestures() {
    guard suppressDoubleTapSelection || doubleTapGuardInstalled else { return }
    if !doubleTapGuardInstalled {
      doubleTapGuardInstalled = true
      addGestureRecognizer(doubleTapGuard)
    }
    let enabled = suppressDoubleTapSelection && isSelectable
    if doubleTapGuard.isEnabled != enabled { doubleTapGuard.isEnabled = enabled }
    selectionGestures.removeAllObjects()
    var views: [UIView] = [self]
    while let view = views.popLast() {
      views.append(contentsOf: view.subviews)
      for interaction in view.interactions.compactMap({ $0 as? UITextInteraction }) {
        for gesture in interaction.gesturesForFailureRequirements {
          selectionGestures.add(gesture)
          // A plain hold still starts native selection immediately at UIKit's
          // normal threshold; other selection gestures wait for the host tap.
          if let press = gesture as? UILongPressGestureRecognizer, press.numberOfTapsRequired == 0 { continue }
          if !guardedSelectionGestures.contains(gesture) {
            gesture.require(toFail: doubleTapGuard)
            guardedSelectionGestures.add(gesture)
          }
        }
      }
    }
  }

  // The ancestor recognizer owns the action. This recognizer only establishes
  // UIKit failure requirements, so one double tap never dispatches two actions.
  @objc private func reservedDoubleTap() {}

  override func copy(_ sender: Any?) {
    if let text = copyResolver?(selectedRange) {
      UIPasteboard.general.string = text
    } else {
      super.copy(sender)
    }
  }
}
