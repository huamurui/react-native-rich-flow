# RichFlow Playground

English · [简体中文](./README.zh-CN.md)

An interactive example of RichFlow’s native capabilities. Android and iOS need a development build containing the library; Expo Go does not include this module.

Install and build from the repository root, then run the example:

```bash
npm ci
npm run build
npm run example:ios
# or npm run example:android
```

Once a development build is installed, start only Metro:

```bash
npm run example:start
```

iOS requires Xcode and CocoaPods. Android requires JDK 17, the Android SDK, and a device or emulator. Rerun the platform build after changing native code; Fast Refresh updates JavaScript only.

## Languages

The **English / 中文** button in the header switches the UI, accessibility labels, case descriptions, rendered content, and default Markdown/HTML examples. On first launch, the device’s `Intl` locale selects Simplified Chinese for `zh` locales; all other locales, or unavailable locale detection, fall back to English. Switching lasts for the current app session and does not change the system language.

Markdown and HTML drafts and applied content are kept separately for each language in memory. Switching languages preserves the other language’s edits. **Reset example** resets only the current language and current format. Restarting the app restores defaults. The mixed-script case includes Chinese, English, Japanese, Korean and emoji; complete RTL and bidirectional behavior still need platform validation.

## Cases and interactions

| Case | Try this | Check |
| --- | --- | --- |
| Selection | Drag from one paragraph into the next; select an emoji | One flow supports selection across paragraphs; events use UTF-16; source mapping matches selected nodes |
| Typography | Change font size, alignment and theme | Nested styles, headings, quotes, lists and code remain visible without clipping |
| Decorations | Tap each decoration, then select across wrapped lines | Decoration action ids; solid, dashed, dotted and wavy lines follow layout |
| Attachments | Copy images and SVG formulas, then paste into the check field | U+FFFC becomes copyText; images retain color; formulas follow the theme; decode failures leave surrounding text usable |
| Live updates | Select text, update content, then remount | Revisions and ranges match the new content; measured height follows paragraph count |
| Long document | Scroll to the end, then return | Attachments recover; the text remains in one selection context |
| Local typography | Switch Chinese/Pinyin, Japanese/Furigana, horizontal Zhuyin, Korean, Arabic/RTL, French or English | Emphasis/ruby keep base text copyable; Start/End alignment follows direction; language and hyphenation are platform hints |
| Markdown / HTML | Edit the input and apply it | Adapters produce a neutral document rendered by the same native component |

The bottom event panel never covers the document. Expand it to inspect selected text, source mapping, content versions and recent actions. Link actions are recorded without opening a browser automatically; real host apps choose how to handle them.

Attachment examples use embedded data URIs and require no third-party image downloads. Formula SVGs are pre-rendered resources. LaTeX-only formulas keep a placeholder because the library has no built-in TeX typesetting engine.

The HTML/Markdown adapters support a semantic subset, not a browser layout engine. Selection spans paragraphs inside one flow; separate native views do not share a system selection. Before release, repeat the interaction checks on real devices for both platforms.

## Language-specific typography

The **Local typography** case contains seven presets. Its controls and explanations follow the UI language, while sample paragraphs stay in the chosen writing system. Arabic has its own RTL configuration and defaults to logical Start alignment; selecting it does not change the direction of other cases.

Chinese examples use dots below the text and per-character pinyin. Japanese uses per-character furigana and sesame marks above emphasis. Zhuyin is horizontal ruby above the characters, not traditional vertical side annotation. Ruby fits within its base range. On each side, emphasis uses the inner band and ruby the outer band. Overlapping annotations of the same kind do not get additional rows; avoid overlapping ruby on the same side. Copying returns the base text only.

Korean line breaks and English hyphenation use system language hints. French samples explicitly contain U+00A0 and U+202F nonbreaking spaces; the renderer does not add them automatically. Complete bidirectional decoration behavior still needs device validation. Vertical text, punctuation compression and hanging punctuation are not implemented.

## Validate the example

From the repository root:

```bash
npm run typecheck --workspace rich-flow-example
npm test --workspace rich-flow-example
npm run export:ios --workspace rich-flow-example
npm run export:android --workspace rich-flow-example
```

Example tests check translation keys and interpolation parameters, device-locale fallback, independent editing state, and valid ranges, source mappings and semantic attachment copying in both languages. Type checking and Metro exports verify JavaScript integration; they do not replace native compilation or device interaction checks. `example/ios` and `example/android` are generated by Expo and are not committed.
