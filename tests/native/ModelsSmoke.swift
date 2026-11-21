import Foundation

@main
struct ModelsSmoke {
  static var checks = 0
  static func expect(_ condition: @autoclosure () -> Bool, _ description: String) {
    precondition(condition(), description)
    checks += 1
  }

  static func main() throws {
    let text = "甲😀\u{fffc}\n乙" as NSString
    expect(text.length == 6, "The bridge must use UTF-16 offsets")
    expect(validRichTextBoundary(1, in: text), "The emoji start is valid")
    expect(!validRichTextBoundary(2, in: text), "A surrogate pair cannot be split")
    expect(validRichTextBoundary(3, in: text), "The emoji end is valid")
    expect(richTextRange(["start": 1, "end": 3], in: text) == NSRange(location: 1, length: 2), "Emoji ranges use both UTF-16 units")
    expect(richTextRange(["start": 1, "end": 2], in: text) == nil, "Malformed UTF-16 ranges are rejected")
    expect(richTextRange(["start": true, "end": 3], in: text) == nil, "JSON booleans are not numeric offsets")
    expect(richTextRange(["start": -1, "end": 3], in: text) == nil, "Negative offsets are rejected")
    expect(richTextRange(["start": 0, "end": 7], in: text) == nil, "Out-of-bounds offsets are rejected")
    expect(!validRichTextRange(NSRange(location: NSNotFound, length: 1), in: text), "NSNotFound is rejected without overflow")
    expect(!validRichTextRange(NSRange(location: 1, length: Int.max), in: text), "Oversized ranges are rejected without overflow")

    let payload: [String: Any] = [
      "id": "smoke-flow", "textVersion": "one", "text": text as String,
      "annotations": [["start": 0, "end": 1, "kind": "ruby", "text": "jiǎ"]],
      "attachments": [
        ["start": 3, "end": 4, "kind": "formula", "copyText": "x²"],
        ["start": 0, "end": 1, "kind": "image", "copyText": "incorrect replacement"],
        ["start": 99, "end": 100, "kind": "image", "copyText": "out of bounds"]
      ]
    ]
    let json = String(decoding: try JSONSerialization.data(withJSONObject: payload), as: UTF8.self)
    guard let flow = RichTextFlow.parse(json) else { fatalError("Valid flow did not parse") }
    expect(flow.selectionText(NSRange(location: 0, length: 6)) == "甲😀x²\n乙", "Cross-paragraph copy replaces only real attachments")
    expect(flow.annotations.count == 1, "Annotations remain separate from copied body text")
    expect(flow.selectionText(NSRange(location: 1, length: 2)) == "😀", "Partial selection preserves supplementary characters")
    expect(flow.selectionText(NSRange(location: 3, length: 1)) == "x²", "Attachment copy uses semantic text")
    expect(flow.selectionText(NSRange(location: 2, length: 2)) == nil, "Invalid native selections cannot produce a source string")
    expect(RichTextFlow.parse("{") == nil, "Malformed JSON is rejected")
    let blankText = "\n😀\u{200b}\n\u{200b}" as NSString
    let lastBlank: RichTextSpec = ["start": 5, "end": 6, "emptyLine": true]
    let blanks = RichTextFlow(id: "blanks", textVersion: "1", text: blankText, spans: [], paragraphs: [lastBlank],
                              decorations: [], annotations: [], attachments: [])
    expect(blanks.selectionText(NSRange(location: 0, length: 6)) == "\n😀\u{200b}\n", "Only the marked terminal placeholder is omitted")
    expect(blanks.selectionText(NSRange(location: 5, length: 1)) == "", "A lone terminal placeholder copies as an empty string")
    expect(richTextEmptyParagraphRange(["start": 0, "end": 1, "emptyLine": true], in: blankText) != nil, "A leading blank owns its newline")
    expect(richTextEmptyParagraphRange(["start": 3, "end": 4, "emptyLine": true], in: blankText) == nil, "Interior zero-width text is not a blank paragraph")
    expect(richTextEmptyParagraphRange(["start": 5, "end": 6, "emptyLine": 1], in: blankText) == nil, "Only a boolean marks an authored layout slot")
    expect(RichTextFlow.parse("{\"id\":\"missing-fields\"}") == nil, "Flow identity and text are mandatory")
    for offset: Any in ["1", 1.5, Double.infinity, Double.nan] {
      expect(richTextRange(["start": offset, "end": 3], in: text) == nil, "Offsets cannot be coerced or truncated")
    }
    let clusters = "汉e\u{301}👨‍👩‍👧‍👦， \u{fffc}" as NSString
    let marks = RichTextAnnotation.parse(["start": 0, "end": clusters.length, "kind": "emphasis"], in: clusters)!
    expect(marks.graphemes.count == 3, "Emphasis uses extended graphemes and skips punctuation, whitespace and attachments")
    expect(marks.position == "under" && marks.mark == "dot", "Chinese emphasis defaults to dots below")
    expect(RichTextAnnotation.parse(["start": 1, "end": 2, "kind": "emphasis"], in: clusters) == nil, "Annotations cannot split combining sequences")
    expect(!richTextEmphasisEligible("。") && !richTextEmphasisEligible("\n") && !richTextEmphasisEligible("\u{fffc}"), "Non-text slots receive no emphasis marks")
    let base = "漢字仮名" as NSString
    let ruby = RichTextAnnotation.parse(["start": 0, "end": 4, "kind": "ruby", "text": "かんじかな"], in: base)!
    expect(ruby.position == "over", "Ruby defaults above the text")
    let pieces = [ruby.reading(forBaseIndices: 0..<1), ruby.reading(forBaseIndices: 1..<3), ruby.reading(forBaseIndices: 3..<4)]
    expect(pieces == ["か", "んじ", "かな"], "Soft wraps divide the reading at proportional grapheme boundaries")
    expect(pieces.joined() == ruby.reading.joined(), "Soft wraps neither drop nor duplicate reading characters")
    let combiningRuby = RichTextAnnotation.parse(["start": 0, "end": 2, "kind": "ruby", "text": "ha\u{304}n"], in: base)!
    expect(combiningRuby.reading(forBaseIndices: 1..<2) == "a\u{304}n", "Ruby slices never split a combining accent")
    expect(RichTextAnnotation.parse(["start": 0, "end": 1, "kind": "ruby"], in: base) == nil, "Ruby needs nonempty reading text")
    expect(RichTextAnnotation.parse(["start": 0, "end": 2, "kind": "ruby", "text": "a"], in: "甲\n" as NSString) == nil, "Ruby does not span a hard paragraph break")
    expect(richTextFirstStrongIsRTL("123 العربية") == true, "Arabic auto direction ignores leading neutral digits")
    expect(richTextFirstStrongIsRTL("  עברית") == true, "Hebrew is a strong RTL script")
    expect(richTextFirstStrongIsRTL("123 English العربية") == false, "The first strong script controls logical end alignment")
    expect(richTextFirstStrongIsRTL("123 …") == nil, "Neutral-only paragraphs can use the language fallback")
    let directionRuby = RichTextAnnotation.parse(["start": 0, "end": 3, "kind": "ruby", "text": "かんじ"], in: "漢\u{200e}字" as NSString)!
    expect(directionRuby.graphemes.count == 2 && directionRuby.reading(forBaseIndices: 1..<2) == "んじ", "Invisible direction marks do not consume ruby readings")
    let visibility = RichTextAttachmentVisibility()
    let now = DispatchTime.now()
    expect(visibility.beginLoad() == nil, "Offscreen attachments do not load")
    visibility.setActive(true)
    let first = visibility.beginLoad(now: now)!
    expect(visibility.beginLoad(now: now + .seconds(60)) == nil, "An in-flight request is not duplicated by layout")
    let retryAt = visibility.retryDeadline(afterFailure: first, now: now)!
    expect(visibility.retryDeadline(afterFailure: first, now: now) == nil, "One failure schedules only one retry")
    visibility.setActive(true)
    expect(visibility.beginLoad(now: retryAt - .milliseconds(1)) == nil, "Snapshots reusing a visible slot respect backoff")
    let second = visibility.beginLoad(now: retryAt)!
    expect(!visibility.accepts(first) && visibility.accepts(second), "A retry rejects the earlier attempt's callbacks")
    expect(visibility.retryDeadline(afterFailure: first, now: retryAt) == nil, "A late failure cannot schedule another retry")
    let lastRetryAt = visibility.retryDeadline(afterFailure: second, now: retryAt)!
    expect(lastRetryAt > retryAt, "Consecutive failures back off")
    let third = visibility.beginLoad(now: lastRetryAt)!
    expect(visibility.retryDeadline(afterFailure: third, now: lastRetryAt) == nil, "A persistent failure exhausts its retry budget")
    expect(visibility.beginLoad(now: lastRetryAt + .seconds(60)) == nil, "A visible slot cannot bypass its retry budget on another snapshot")
    visibility.setActive(false)
    visibility.setActive(true)
    let nextVisit = visibility.beginLoad()!
    expect(!visibility.accepts(third), "A new viewport visit invalidates old attempts")
    let cancelledRetryAt = visibility.retryDeadline(afterFailure: nextVisit, now: now)!
    visibility.setActive(false)
    expect(!visibility.accepts(nextVisit) && visibility.beginLoad(now: cancelledRetryAt) == nil, "A retry cannot restart a retired or offscreen slot")
    visibility.setActive(true)
    let fresh = visibility.beginLoad()!
    expect(!visibility.accepts(nextVisit) && visibility.accepts(fresh), "A timer from a previous visit cannot affect the new request")
    let recovery = visibility.retryDeadline(afterFailure: fresh, now: now)!
    let recovered = visibility.beginLoad(now: recovery)!
    visibility.hasAsset = true
    expect(visibility.retryDeadline(afterFailure: recovered, now: recovery) == nil && visibility.beginLoad() == nil,
           "A recovered attachment stays loaded across snapshots")
    visibility.setActive(false)
    expect(!visibility.hasAsset, "Offscreen attachments release their asset state")
    expect(intersectsRichTextAttachmentViewport(top: 100, bottom: 140, viewportTop: 120, viewportBottom: 200), "Intersecting attachments activate")
    expect(!intersectsRichTextAttachmentViewport(top: 100, bottom: 120, viewportTop: 120, viewportBottom: 200), "Touching ranges are offscreen")
    expect(!intersectsRichTextAttachmentViewport(top: 100, bottom: 140, viewportTop: .nan, viewportBottom: 200), "Invalid viewport geometry is rejected")
    print("iOS rich text model/annotation/viewport smoke: \(checks) checks passed")
  }
}
