# Changelog

## 0.1.0-alpha.0 — 2026-10-21

- Add the Android TextView / Spannable and iOS UITextView / TextKit native module.
- Add `RichFlow` and `isRichFlowAvailable` from the `/native` entry, including automatic height updates and typed selection/action callbacks.
- Add a framework-independent semantic document model and `compileDocument`.
- Add `/adapters` with common Markdown and HTML semantic conversion.
- Support continuous selection, four decoration styles, inline images/formula images, semantic attachment copying, and source-node mapping.
- Add character emphasis marks, horizontal ruby, and language/direction/hyphenation configuration on both native platforms.
- Add an Expo SDK 55 example workspace with nine interactive feature cases, English/Chinese UI and content, and seven language-specific typography presets.
- Keep Android inline highlight/code backgrounds independent of paragraph spacing, annotation bands, and attachment height.
- Reuse existing iOS line leading for ruby/emphasis, using actual fallback glyph metrics and preserving annotations through partial relayout.
- Add native model tests, real Android bitmap and iOS TextKit geometry regressions, component/event checks, and package verification.
- Use a root workspace `package-lock.json` in place of the initial npm shrinkwrap.
- Retain MIT licensing and the original core selection utility exports.

This version requires an app build containing the native module for rendering.
Expo Go and web do not provide the native renderer. Platform behavior and remaining
limits are documented in `docs/native-behavior.md`; this entry does not imply
completed cross-device interaction or performance acceptance.

## 0.0.1 — 2026-10-21

Initial standalone release of the RichFlow data model and selection utilities.

- Release under the MIT License.
- Export framework-independent rich-text flow types.
- Validate nonempty UTF-16 ranges without splitting surrogate pairs.
- Copy inline attachment slots as semantic text.
- Map selections back to source nodes and paragraph offsets.
- Provide ESM, CommonJS, and TypeScript declarations without runtime dependencies.

This release does not include a native renderer, React component, Markdown/HTML parser, or document compiler.
