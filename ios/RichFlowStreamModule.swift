import ExpoModulesCore
import UIKit

public final class RichFlowStreamModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RichFlowStream")
    View(RichFlowStreamView.self) {
      Events("onHeightChange", "onSelectionChange", "onResync")
      Prop("updateJson") { (view: RichFlowStreamView, value: String) in view.pendingUpdate = value }
      Prop("contentWidth") { (view: RichFlowStreamView, value: Double) in view.contentWidth = value.isFinite ? max(0, value) : 0 }
      Prop("configJson") { (view: RichFlowStreamView, value: String) in view.configJson = value }
      Prop("selectable") { (view: RichFlowStreamView, value: Bool) in view.selectable = value }
      OnViewDidUpdateProps { (view: RichFlowStreamView) in view.commit() }
    }
  }
}

public final class RichFlowStreamView: ExpoView, UITextViewDelegate {
  private let onHeightChange = EventDispatcher()
  private let onSelectionChange = EventDispatcher()
  private let onResync = EventDispatcher()
  private let content = RichFlowStreamTextView()
  fileprivate var pendingUpdate: String?
  fileprivate var contentWidth: CGFloat = 0
  fileprivate var selectable = true
  fileprivate var configJson = ""
  private var appliedConfig: String?
  private var measuredWidth: CGFloat = 0
  private var heightDirty = true
  private var committing = false
  private var lastSelection: (id: String, version: Int, start: Int, end: Int)?

  public required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    content.delegate = self
    addSubview(content)
  }

  fileprivate func commit() {
    committing = true
    if appliedConfig != configJson {
      appliedConfig = configJson
      let config = RichTextConfig.parse(configJson)
      content.configure(fontSize: config.fontSize, lineHeight: config.lineHeight, color: config.textColor)
      heightDirty = true
    }
    if content.isSelectable != selectable {
      if !selectable { content.selectedRange = NSRange(location: 0, length: 0) }
      content.isSelectable = selectable
    }
    if let json = pendingUpdate {
      pendingUpdate = nil
      if let update = try? JSONDecoder().decode(RichFlowStreamUpdate.self, from: Data(json.utf8)) {
        switch content.apply(update) {
        case .applied: heightDirty = true
        case .needsSnapshot: onResync(["documentId": update.documentId, "version": update.version])
        case .ignored: break
        }
      }
    }
    committing = false
    emitSelection()
    measure()
  }

  public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
    super.traitCollectionDidChange(previousTraitCollection)
    if previousTraitCollection?.preferredContentSizeCategory != traitCollection.preferredContentSizeCategory {
      appliedConfig = nil
      commit()
    }
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    measure()
  }

  private func measure() {
    let width = contentWidth > 0 ? contentWidth : bounds.width
    guard width > 0, let id = content.documentId, heightDirty || measuredWidth != width else { return }
    heightDirty = false
    measuredWidth = width
    let height = content.height(for: width)
    content.frame = CGRect(x: 0, y: 0, width: width, height: height)
    onHeightChange(["documentId": id, "version": content.version, "contentWidth": Double(width), "height": Double(height)])
  }

  public func textViewDidChangeSelection(_ textView: UITextView) { emitSelection() }

  private func emitSelection() {
    guard !committing, let id = content.documentId else { return }
    let range = content.selectedRange
    let valid = selectable && validRichTextRange(range, in: content.textStorage.mutableString)
    // JS discards events from superseded versions. Reissue the current range
    // on revision changes so a selection made during an append is not lost.
    let current = (id: id, version: content.version, start: valid ? range.location : -1, end: valid ? NSMaxRange(range) : -1)
    if let old = lastSelection, old == current { return }
    lastSelection = current
    onSelectionChange(["documentId": id, "version": content.version, "start": current.start, "end": current.end])
  }
}
