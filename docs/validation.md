# Local validation — 2026-10-21

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
- Real iOS hardware, VoiceOver/TalkBack, long-document memory and scrolling performance.
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
