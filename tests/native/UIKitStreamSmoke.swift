import UIKit

@main
struct UIKitStreamSmoke {
  @MainActor static func main() {
    var checks = 0
    func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
      precondition(condition(), message)
      checks += 1
    }
    func update(_ id: String, _ version: Int, _ text: String, base: Int? = nil) -> RichFlowStreamUpdate {
      RichFlowStreamUpdate(documentId: id, version: version, kind: base == nil ? .snapshot : .append, baseVersion: base, text: text)
    }
    let view = RichFlowStreamTextView()
    let storage = view.textStorage
    expect(view.apply(update("first", 2, "late", base: 1)) == .needsSnapshot, "Delta before initial mount requests recovery")
    expect(storage.length == 0, "A missing base never displays partial text")
    expect(view.apply(update("first", 1, "一🙂二\nsecond")) == .applied, "Initial snapshot")
    let narrow = view.height(for: 60)
    // The real Expo host gives its text view each reported frame height.
    // UIKit then constrains the text container before the next append.
    view.frame = CGRect(x: 0, y: 0, width: 60, height: narrow)
    view.layoutIfNeeded()
    let selected = NSRange(location: 1, length: 2)
    view.selectedRange = selected
    let sentinel = NSAttributedString.Key("retained-prefix")
    storage.addAttribute(sentinel, value: "old", range: selected)
    expect(view.apply(update("first", 2, "\n三", base: 1)) == .applied, "Sequential append")
    expect(storage === view.textStorage, "The system selection remains in the original text storage")
    expect(storage.attribute(sentinel, at: 1, effectiveRange: nil) as? String == "old", "Appending preserves attributes on the unchanged prefix")
    expect(view.selectedRange == selected && view.selectedTextRange.flatMap { view.text(in: $0) } == "🙂", "System selection retains the same UTF-16 characters")
    expect(storage.string == "一🙂二\nsecond\n三", "The storage contains both chunks")
    let grown = view.height(for: 60)
    expect(grown > narrow, "A new line increases the fitted height after UIKit has adopted the previous frame")
    view.frame.size.height = grown
    view.layoutIfNeeded()
    expect(NSMaxRange(view.layoutManager.glyphRange(for: view.textContainer)) == view.layoutManager.numberOfGlyphs, "The final appended glyph is inside the fitted container")
    expect(view.height(for: 30) > view.height(for: 300) && view.selectedRange == selected, "Rewrapping at a different width preserves the selection")
    expect(view.apply(update("first", 2, "\n三", base: 1)) == .ignored, "Replayed delta does not duplicate text")
    expect(view.apply(update("first", 4, "lost prefix", base: 3)) == .needsSnapshot, "A coalesced commit requests the missing baseline")
    expect(view.version == 2 && view.selectedRange == selected, "Rejected updates leave content, identity and selection intact")
    expect(view.apply(update("first", 4, "一🙂二\nsecond\n三四五")) == .applied, "Snapshot recovers a missing update")
    expect(view.selectedRange == selected && storage.attribute(sentinel, at: 1, effectiveRange: nil) != nil, "Recovery preserves the common selected prefix")
    expect(view.apply(update("first", 3, "stale")) == .ignored, "A late snapshot cannot roll back the text")
    expect(view.apply(update("first", 5, "一🙃二")) == .applied, "Replacement repairs a split-surrogate common prefix")
    expect(storage.string == "一🙃二" && view.selectedRange.length == 0, "Changed selected text is cleared")
    view.selectedRange = NSRange(location: 0, length: 1)
    let oldHeight = view.height(for: 280)
    view.configure(fontSize: 32, lineHeight: 48, color: .purple)
    expect(view.height(for: 280) > oldHeight && view.selectedRange == NSRange(location: 0, length: 1), "Resizing the font preserves the selection and updates measured height")
    let beforeNewline = view.height(for: 280)
    expect(view.apply(update("first", 6, "\n", base: 5)) == .applied && view.height(for: 280) > beforeNewline, "Trailing newline participates in layout")
    expect(view.apply(update("other", 7, "")) == .applied, "A new message can start empty")
    expect(storage.length == 0 && view.height(for: 280) == 0 && view.selectedRange.length == 0, "Changing messages clears selection and empty height")
    expect(view.apply(update("first", 6, "previous document")) == .ignored && view.documentId == "other", "Older-message snapshots cannot supersede the new message")
    print("\(checks) UIKit stream checks passed")
  }
}
