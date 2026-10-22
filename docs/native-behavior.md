# Native behavior and limits

RichFlow registers one Expo Modules view named `RichFlow` on Android and iOS.
It requires a development or production build that includes the native module;
Expo Go cannot load it. The native layer consumes a compiled `RichTextFlow`, not
Markdown, HTML, CSS, or an application-specific document format.

## Text and selection

- Android uses a single `TextView` with a `Spannable`; iOS uses a noneditable,
  non-scrolling `UITextView` with TextKit. Scrolling belongs to the host.
- Selection can cross paragraphs in one flow. Separate RichFlow views do not
  share a selection context, even when they are visually adjacent.
- All ranges are half-open UTF-16 offsets. Both platforms reject malformed,
  out-of-bounds, empty, and surrogate-splitting ranges. This is not a promise
  of grapheme-cluster validation.
- System copy substitutes selected `U+FFFC` attachment slots with `copyText`.
  Source-node mapping stays in JavaScript and is not sent to the native view.
- Selection events carry `flowId`, `textVersion`, `start`, and `end`. A cleared
  or collapsed selection uses `start: -1, end: -1`; disabling selection also
  reports the cleared state.

## Formatting and interaction

Both platforms support bold, emphasis, underline, strikethrough, background
highlight, subscript, superscript, inline code, links, headings, quotes, list
indentation, code paragraphs, and paragraph spacing. Minimum line heights can
grow to accommodate attachments. Text metrics follow platform font scaling.
In this alpha, span-level `color` is honored for highlight backgrounds and link
text only; other style spans, including `strong`, ignore that field.

Android inline highlight and code backgrounds follow the styled text run’s font
metrics and visual selection path. They are drawn separately from the line box,
so paragraph spacing, ruby space, and a tall neighboring attachment do not extend
the background below the text. System selection is drawn above these backgrounds.

Decorations use native visual-line geometry to draw solid, dashed, dotted, or
wavy lines. An interactive decoration emits `kind: 'decoration'` with its
`actionId`; links use `nodeId`, and attachment actions use the attachment `id`.
The event range is the complete matching span, decoration, or attachment range.
Attachments can additionally emit `attachmentLongPress`. Ordinary long-press
selection remains a system gesture.

Android decoration geometry currently uses each line's start/end carets rather
than every bidirectional visual run. iOS uses TextKit enclosing rectangles.
Complex mixed-direction content and touch interactions require platform testing.
Justification and line-breaking behavior depend on the operating system; the
library does not implement browser layout or a custom CJK typesetting engine.

## Annotations and language

Optional `annotations` ranges hold character emphasis or ruby independently from
the original text. They never add characters, change selection offsets, or enter
system copy. Emphasis uses system extended grapheme boundaries and skips
whitespace, punctuation, controls, and attachment slots. Marks can be solid dots,
open circles, or sesame shapes; the default is under. Ruby defaults to over.

Both renderers reserve ascent/descent space on affected lines, including the first
and last lines. On iOS, annotations are anchored to the actual generated glyph
fonts and baseline. Existing space inside the line is used first; only annotation
overflow expands the line fragment. Paragraph spacing remains separate, and the
same geometry drives drawing and height measurement. Drawing uses completed glyph
positions, so partial attachment/font relayout does not depend on cached line
coordinates. When emphasis and ruby share a side, emphasis occupies the inner band
and ruby the outer band. Multiple overlapping annotations of the same kind
and side do not create additional tiers; callers should avoid those overlaps.

Ruby is horizontal at half the base font size and fitted to its base fragment's
width. Supply one node per character or reading unit for reliable pronunciation
alignment. When a group wraps, reading graphemes are divided proportionally using
the cumulative base-grapheme counts; this is a geometric split, not a phonetic
analysis. Very long readings over short bases can become hard to read. Ruby is
single-line text; native readers ignore annotations containing line separators.
Ruby bases containing a hard line break or an attachment slot are also ignored;
use separate ruby nodes around those boundaries.
Vertical text, traditional Zhuyin side annotation, automatic readings, and multiple
reading tiers are not provided. Screen readers receive the base text; there is
currently no separate accessibility channel for reading annotations.

`language` is a BCP 47 hint for system layout. `writingDirection` sets auto/LTR/RTL
base direction, and `start`/`end` alignment follows that direction. Hyphenation is
none/normal/full, but actual breaks depend on platform dictionaries and OS version.
Korean word wrapping uses platform behavior. French NBSP/NNBSP must be supplied in
the source; punctuation spacing is not automatically rewritten. The multilingual
playground keeps these source samples separate from the UI language.

## Attachments and measurement

Inline image and formula attachments occupy one `U+FFFC` code unit. Their assets
can use HTTP(S) or image data URLs. SVG decoding uses AndroidSVG on Android and
SDWebImageSVGCoder on iOS. Formula images are tinted with the current text color;
ordinary images retain their colors. LaTeX text without an image URL is a
placeholder, not locally typeset mathematics.

The iOS podspec declares both `SDWebImage` and `SDWebImageSVGCoder` directly.
Swift imports SDWebImage, and Expo autolinking enables modular headers for direct
dependencies. This supports the default CocoaPods static-library setup without
requiring the host app to enable `use_frameworks!` globally.

Attachments load asynchronously, with a 4 MiB resource limit and a shared
24 MiB decoded-resource cache on each platform. Visible views prefetch nearby
attachments and release their own offscreen subscriptions and image references.
The shared cache may retain decoded images. Failed resources retain their
attachment slots; the first layout does not wait for every image to finish loading.

Height events include `flowId`, `textVersion`, `layoutKey`, and a height in React
Native layout units. A valid empty flow reports zero height on both platforms.
Loading an attachment with previously unknown dimensions can produce a new
height. Native generation and layout checks prevent superseded measurements
and attachment results from being applied to a different flow.

## Verification

From the repository root:

```bash
# Foundation-only range, copy, and viewport checks; requires Xcode on macOS.
bash scripts/test-native-ios.sh

# Generate the example Android host, then run the native JVM tests.
cd example
npx expo prebuild --platform android
cd ..
bash scripts/test-native-android.sh
```

The Android tests cover UTF-16 validation, semantic copying, paragraph/quote
geometry, prop batching, and attachment request/viewport coordination. The Swift
checks cover parsing, ranges, semantic copying, and viewport state.

These model tests do not establish UIKit or Android rendering correctness,
selection-handle behavior, accessibility, or performance. Record native build
and device results separately from model tests in this repository's
[validation notes](./validation.md).

### Background and annotation layout regressions

```bash
# Requires an already connected Android device/emulator and the generated host.
npm run test:native:android-layout
# Requires an already booted iOS simulator.
npm run test:native:ios-layout
```

The Android suite renders real StaticLayout bitmaps to check background pixels,
including paragraph spacing and mixed text geometry. The iOS suite checks both
annotation containment and unnecessary line growth; checking only clipping would
miss excess blank space.

Platform references: Android’s [TextLine background drawing](https://android.googlesource.com/platform/frameworks/base/+/8b4a6981fdd7849a57de2f56203cfd81e9eb6e99/core/java/android/text/TextLine.java)
uses line top/bottom, while Apple’s [line fragment delegate](https://developer.apple.com/documentation/uikit/nslayoutmanagerdelegate/layoutmanager(_:shouldsetlinefragmentrect:linefragmentusedrect:baselineoffset:in:forglyphrange:))
provides line rectangles and the baseline for layout adjustments.
