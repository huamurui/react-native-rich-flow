# Local validation

The November 21, 2026 checks cover [streaming Markdown](#streaming-markdown--2026-11-21) and the [plain-text stream and native fixes](#plain-text-stream-and-native-fixes--2026-11-21).

## Expo SDK 54 compatibility

The SDK 54 check installed a tarball in an independent New Architecture consumer with Expo 54.0.38, Expo Modules Core 3.0.30, React Native 0.81.5 and React 19.1.0. npm resolved peers without overrides. The published alpha's peer ranges reject the same host. The SDK 55 example stays on its existing lockfile versions.

- Both native modules autolinked on each platform. Android compiled the Kotlin library, passed all 39 JVM tests and exported a Metro/Hermes bundle importing both native components. Run `bash scripts/check-sdk54-android.sh` after `npm ci` to repeat the Android consumer check.
- Strict TypeScript checks passed for the library's native source and a consumer importing the core, adapters and native package entries. The RN 0.81.5 Hermes VM replayed the English and Chinese fixtures with Expo 54's UTF-8 decoder. Splitting multibyte text across chunks preserved the original text. Each final Markdown flow matched a one-shot compile.
- CocoaPods generated the Expo module provider. Xcode 27 compiled and linked the complete arm64 iOS simulator host in Release using the checked npm tarball, including the embedded Metro bundle. On an iPhone 15 Pro / iOS 18.4 simulator, XCTest read the expected text from both native views and measured both at 393 × 26.67 pt. SDWebImage 5.21.7's generated privacy resource bundle targets iOS 9, which Xcode 27 rejects. The build used the host minimum of 15.1 for that single bundle, as in the [playground Podfile hook](../example/plugins/withPlaygroundScene.cjs).
- The SDK 54 checks do not cover device selection handles, system Copy/Paste, the Legacy Architecture or earlier Expo patches. The iPhone SE interaction results below were recorded on SDK 55.

An npm registry audit on 2026-11-21 reported zero advisories in a clean install of the packed library alone. In the SDK 54 consumer, Metro's `image-size` and `postcss` dependencies each had high-severity findings. The SDK 55 consumer also reported a high-severity `zod` finding under Expo CLI. These legacy combinations are intended for existing apps. Choose a maintained Expo/RN pair for a new host. [image-size advisory](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) · [PostCSS advisory](https://github.com/advisories/GHSA-6g55-p6wh-862q) · [Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)

## Alpha baseline — 2026-10-21

This records local checks of the 0.1.0-alpha.0 implementation. It is not a claim of
cross-device production acceptance or a report of hosted CI results.

| Check | Result |
| --- | --- |
| Clean workspace `npm ci` and prepare build | Passed |
| `npm run check` | ESM/CJS builds, TypeScript checks, 44 library tests, 10 example tests passed |
| `npm run check:package` | Actual tarball installation and ESM/CJS core/adapter consumer checks passed; native sources and MIT metadata included |
| Example `export:android` / `export:ios` | Both Metro/Hermes exports passed |
| Android `testDebugUnitTest` | 34 JVM tests passed |
| `npm run test:native:android-layout` | 9 real Layout/Canvas instrumentation tests passed on V2509A / Android 16 |
| Android `:app:assembleDebug` | arm64 development APK built and installed on a connected device |
| CocoaPods + iOS simulator `xcodebuild` | Debug arm64 build succeeded; app installed and launched on iPhone 17 Pro / iOS 26.5 simulator |
| `npm run test:native:ios` | 44 Foundation model/annotation/viewport checks passed |
| `npm run test:native:ios-layout` | 77 actual simulator TextKit geometry checks passed |

Native app screenshots confirmed rendered text and multiline decorations on both
platforms. Android bitmap regressions verify that paragraph gaps, annotation bands,
and tall attachments do not stretch inline highlights. They also cover font sizes,
superscripts, fallback glyphs, soft wraps, trailing spaces, disjoint bidi selections,
translucent spans, and text drawing above the background.

TextKit screenshots and geometry checks cover wrapped reading allocation,
first/last-line space, under/over annotations, combined ruby/emphasis, width changes,
and removing annotations. Additional checks verify that ruby reuses existing line
leading, preserves paragraph spacing, follows actual CJK fallback metrics, and stays
visible after partial attachment/font relayout. Kana, horizontal Zhuyin, and accented
pinyin readings were checked at five font sizes. In the 17 pt / 28 pt line-height
fixture, ruby's extra top allocation decreased from 12.700 pt to 4.987 pt without
clipping. Model tests also check semantic copying and UTF-16 ranges.

## Still requires device acceptance

- Selection handle dragging and system copy/paste across every fixture and OS version.
- Android API 24–32 fallback-background metrics need an older device; the connected
  Android 16 device exercises the API 33+ text-run metrics branch.
- Android annotation appearance across devices/font scales; complete RTL decoration
  geometry remains a documented limitation.
- Devices and OS versions beyond the iPhone SE and simulator checks recorded below, VoiceOver/TalkBack, and long-document memory and scrolling performance.
- Network attachments under changing connectivity, and fonts/languages beyond the presets.

The example guides include a manual interaction checklist. A build or model test
does not replace those checks. Use the feature tab “Local typography” to compare
the seven writing-system presets; its UI language switch is independent of the
language being demonstrated.

## Reproduce

Run `npm ci`, `npm run check`, and `npm run check:package` from the repository root.
`npm run example:android` / `npm run example:ios` generate and build a native host.
After prebuild, run `npm run test:native:android` and, with an Android device or
emulator connected, `npm run test:native:android-layout`; on macOS run the two iOS
test commands above. The UIKit layout script requires an already booted iOS simulator
and does not create or erase one. Generated native hosts and build artifacts are
ignored by Git.

## Plain-text stream and native fixes — 2026-11-21

The original Release build crashed on an iPhone SE (3rd generation) running iOS 27.2 during UIKit scene creation. The example now starts its React Native window through a scene delegate. The replacement build was cold-launched on the same phone. A debugger activated the example's Start accessibility action, selected the first word through the native text view, and performed UIKit Copy and Paste. In that process the actual text storage grew from 25 through 41 and 52 to 175 UTF-16 units. The selected range [0, 4) stayed on “Copy” across appends, the paste field contained “Copy”, and the text view grew from 29 to 87 to 203 pt. The debugger detached after verification.

On an iPhone 15 Pro simulator running iOS 18.4, the Release UI test selected the word “Copy” in the first sentence, used the system Copy action, and pasted it into the sample's text field during generation. The text card grew from 61.67 to 148.67 to 293.67 pt. The captured reading area visibly included the two later paragraphs. This also verifies that measurement expands the TextKit container after UIKit fits it to the previous frame.

The JavaScript and example checks passed (48 library tests and 10 example tests), as did package installation checks. Swift model and TextKit regressions covered the selection at the previous end of the buffer, resynchronization, and explicit empty paragraphs. The iOS attachment-loader regression compared the rendered pixels of transformed MathJax-style glyph references with a reference drawing.

Android passed 35 JVM tests. On an Android 16 / API 36 ARM64 emulator, 11 of 12 instrumentation tests passed, including system long-press selection after premeasurement, streaming-buffer selection, and blank-line height. The existing ruby background geometry test measured 46 px against its expected 39 px. The same test failed identically on the baseline commit `1abb1cc` on this emulator.

## Streaming Markdown — 2026-11-21

On a physical iPhone SE (3rd generation) running iOS 27.2, the offline Release example completed all 56 events. A debugger selected “Group bird sightings” in the first sentence of the native text view. At events 38 and 43, the native selection still contained those same 20 UTF-16 units while later text had acquired semibold and monospaced fonts. At event 43 the text view’s Copy action wrote exactly that selection to the system pasteboard. The example’s own input received the same string through UIKit Paste. Native storage grew from 41 to 385, 458 and finally 634 UTF-16 units, and the text view grew from 25 to 649 pt. Screen captures confirmed the visible selection handles and the pasted value. The debugger detached after the run.

On an iPhone 15 Pro simulator running iOS 18.4, UI tests used a long press, kept the system Copy menu open while the Markdown changed, and tapped Copy and Paste in both English and Chinese. The pasted words were “Group” and “观测” respectively. The tests observed the code block growing after selection and before Copy.

In the static attachments example, a UI test long-pressed the first paragraph, dragged the system end handle through the third paragraph, and copied the selection. The native range was [0, 161). The pasted text covered three paragraphs and included “[mountains and sun]” and “E = mc^2” in place of attachment slots.

The same simulator kept the event count and text card height stable during a pause, resumed receiving events, and restarted at the first event of a new answer. In the static updates case, adding text and an emoji increased the measured height from 242 to 396 pt. Remounting preserved the displayed content, and changing the font size to 24 increased the height to 708 pt. The HTML editor applied a two-paragraph replacement, dispatched the new link target on tap, and restored the original source with Reset. On the first run, the full text updated but UIKit still exposed the old paragraph labels to accessibility queries. The full-replacement path now assigns the new attributed text through UITextView. The rerun found the new paragraph label and link, and the cross-paragraph copy test still passed. The decoration test tapped three ranges, checked their action IDs in the event history, and cleared that history. The Chinese streaming Copy and Paste gesture test also passed on the rebuilt app.

Both language fixtures replay 54 output-text deltas in 50 batches plus the completion batch. Their final flows match a one-shot Markdown compile. The package passed the JavaScript and example checks (49 + 12 tests) and the packed-consumer check. The iOS runs passed 88 TextKit layout checks, 24 plain-text stream checks and 49 model checks.

From a generated `example/android` project, the following command runs the Android code-level checks and builds the artifacts used for later UI testing.

```sh
./gradlew :react-native-rich-flow:testDebugUnitTest :react-native-rich-flow:assembleDebugAndroidTest :app:assembleDebug -PreactNativeArchitectures=arm64-v8a
```

Android source review covered prop batching, UTF-16 boundaries, reverse selections, attachment copy substitutions and the synthetic last-paragraph anchor. The implementation accounts for Android ending its text action mode when a styled buffer is replaced. The JVM suite passed all 39 tests. The instrumentation APK, arm64 example Debug APK and Android Hermes export built successfully. Window-level tests cover system Copy after four consecutive formatted updates and after plain-text appends interleaved with snapshot corrections. The plain-text test also checks that the same Editable buffer survives. Both tests were compiled in this round. Runtime acceptance of the Markdown selection handles, contextual menu and clipboard on Android is pending.

[Chinese system-menu recording](./images/streaming-markdown-ios.gif) · [SE3 selection](./images/streaming-markdown-se3-selection.png) · [SE3 paste](./images/streaming-markdown-se3-paste.png)
