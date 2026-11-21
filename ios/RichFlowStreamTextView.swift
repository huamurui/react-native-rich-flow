import UIKit

struct RichFlowStreamUpdate: Decodable {
  enum Kind: String, Decodable { case snapshot, append }
  let documentId: String
  let version: Int
  let kind: Kind
  let baseVersion: Int?
  let text: String
}

enum RichFlowStreamResult { case applied, ignored, needsSnapshot }

/// One TextKit storage and one system selection for the lifetime of the view.
final class RichFlowStreamTextView: UITextView {
  private(set) var documentId: String?
  private(set) var version = 0
  private var attributes: [NSAttributedString.Key: Any] = [:]

  init() {
    // Explicit TextKit 1 on all deployment targets. Appending to this storage
    // invalidates the affected layout without recreating the view or its text.
    let storage = NSTextStorage()
    let manager = NSLayoutManager()
    let container = NSTextContainer(size: .zero)
    storage.addLayoutManager(manager)
    manager.addTextContainer(container)
    super.init(frame: .zero, textContainer: container)
    isEditable = false
    isSelectable = true
    isScrollEnabled = false
    backgroundColor = .clear
    contentInsetAdjustmentBehavior = .never
    textContainerInset = .zero
    container.lineFragmentPadding = 0
    container.widthTracksTextView = false
    container.heightTracksTextView = false
    dataDetectorTypes = []
    configure(fontSize: 17, lineHeight: 26, color: UIColor(red: 24/255, green: 33/255, blue: 47/255, alpha: 1))
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  func configure(fontSize: CGFloat, lineHeight: CGFloat, color: UIColor) {
    let selection = selectedRange
    let font = UIFontMetrics(forTextStyle: .body).scaledFont(for: .systemFont(ofSize: fontSize), compatibleWith: traitCollection)
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight * font.pointSize / fontSize
    attributes = [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]
    if textStorage.length > 0 {
      textStorage.setAttributes(attributes, range: NSRange(location: 0, length: textStorage.length))
    }
    typingAttributes = attributes
    if selectedRange != selection { selectedRange = selection }
  }

  func apply(_ update: RichFlowStreamUpdate) -> RichFlowStreamResult {
    guard !update.documentId.isEmpty, update.version > 0, update.version <= 9_007_199_254_740_991,
          update.version >= version else { return .ignored }
    let sameDocument = documentId == update.documentId
    let oldLength = textStorage.length
    let selection = selectedRange
    var preserveSelection = sameDocument
    switch update.kind {
    case .append:
      if update.version == version && sameDocument { return .ignored }
      guard sameDocument, update.baseVersion == version, update.version > version else { return .needsSnapshot }
      textStorage.append(NSAttributedString(string: update.text, attributes: attributes))
    case .snapshot:
      guard update.version > version || sameDocument else { return .ignored }
      let previous = textStorage.mutableString
      let next = update.text as NSString
      // Full comparison only on recovery or replacement. The normal append
      // path does no prefix scan and never constructs a full-document string.
      var prefix = 0
      if sameDocument {
        let commonLength = min(oldLength, next.length)
        while prefix < commonLength && previous.character(at: prefix) == next.character(at: prefix) { prefix += 1 }
        if !validRichTextBoundary(prefix, in: previous) || !validRichTextBoundary(prefix, in: next) { prefix -= 1 }
      }
      preserveSelection = sameDocument && selection.location != NSNotFound && NSMaxRange(selection) <= prefix
      if prefix < oldLength || prefix < next.length {
        let suffix = NSAttributedString(string: next.substring(from: prefix), attributes: attributes)
        textStorage.replaceCharacters(in: NSRange(location: prefix, length: oldLength - prefix), with: suffix)
      }
    }
    documentId = update.documentId
    version = update.version
    let target = preserveSelection && selection.location != NSNotFound ? selection : NSRange(location: 0, length: 0)
    if selectedRange != target { selectedRange = target }
    return .applied
  }

  func height(for width: CGFloat) -> CGFloat {
    guard width > 0, textStorage.length > 0 else { return 0 }
    // UIKit resets the container to the fitted frame height after layout.
    // Reopen it vertically even when the width is unchanged, or later text
    // is measured only up to the height reported by the previous update.
    let fittingSize = CGSize(width: width, height: .greatestFiniteMagnitude)
    if textContainer.size != fittingSize { textContainer.size = fittingSize }
    layoutManager.ensureLayout(for: textContainer)
    // The extra fragment is the visible empty line after a trailing newline.
    let bottom = max(layoutManager.usedRect(for: textContainer).maxY, layoutManager.extraLineFragmentRect.maxY)
    let scale = max(1, traitCollection.displayScale)
    return ceil(bottom * scale) / scale
  }
}
