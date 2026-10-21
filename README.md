# RichFlow

Native rich-text foundations for React Native content renderers.

**Version 0.0.1 contains the framework-independent data model and selection utilities only.** It does not yet include a React component, Android/iOS renderer, Markdown or HTML parser, or document compiler. Installing this version will not make React Native text selectable across views.

The initial release provides useful building blocks for content adapters: UTF-16 range validation, semantic copying of inline attachments, and mapping selections back to source text nodes. There are no runtime dependencies. The package includes ESM, CommonJS, and TypeScript declarations.

## Install

```bash
npm install react-native-rich-flow
```

## Copy text with inline attachments

```ts
import {
  getRichTextSelectionText,
  isValidTextRange,
  type RichTextAttachment,
} from 'react-native-rich-flow';

const text = 'Energy: \uFFFC.';
const attachments: readonly RichTextAttachment[] = [
  {
    id: 'energy-formula',
    nodeId: 'formula-1',
    kind: 'formula',
    start: 8,
    end: 9,
    copyText: 'E = mc^2',
  },
];

const flow = { text, attachments };

isValidTextRange(text, 0, text.length); // true
getRichTextSelectionText(flow, 0, text.length);
// 'Energy: E = mc^2.'

isValidTextRange('A😀B', 1, 3); // true
isValidTextRange('A😀B', 1, 2); // false: splits a surrogate pair
```

The attachment occupies one `U+FFFC` character in the layout text. Its `copyText` replaces that character only in the copied result; offsets in the original text remain unchanged.

## API

### `isValidTextRange(text, start, end)`

Checks a nonempty, half-open range `[start, end)` in a string. Offsets must be safe integers within the string and must not split a UTF-16 surrogate pair. Empty, reversed, fractional, and out-of-bounds ranges return `false`.

Offsets use JavaScript UTF-16 code units, not bytes, Unicode code points, or visual glyphs. Validation does **not** enforce complete grapheme clusters: combining characters and joined emoji may span more than one valid boundary.

### `getRichTextSelectionText(flow, start, end)`

Accepts an object with `text` and `attachments`. Returns the selected text, replacing valid inline attachment slots with their `copyText`. An invalid selection returns an empty string.

Attachments are processed in text order without modifying the input array. Only valid one-character ranges containing `U+FFFC` are replaced. Invalid attachments are ignored; for duplicate or overlapping slots, the first accepted slot is used. Unmatched placeholder characters remain in the copied text.

### `mapRichTextSelection(flow, start, end)`

Accepts an object with `text`, `attachments`, and `sourceMap`. Returns a mapping with this shape, or `null` when a selection cannot be mapped:

```ts
{
  text: string;
  start: { nodeId: string; paragraphId?: string; offset: number };
  end: { nodeId: string; paragraphId?: string; offset: number };
}
```

Source maps describe rendered ranges using three kinds:

- `text`: a one-to-one mapping to a source text range of the same UTF-16 length.
- `synthetic`: generated content, such as list markers or paragraph separators, with no source text selection endpoint.
- `attachment`: a placeholder mapped to a source range; its boundaries map to `sourceStart` and `sourceEnd`.

Provide valid, ordered, nonoverlapping source ranges. Selection endpoints inside synthetic content move inward to the selected source content. A selection containing only synthetic content has no mapping. The returned `text` follows the same semantic-copy rules as `getRichTextSelectionText`.

Source offsets refer to the text nodes or paragraphs identified by your adapter. They are **not automatically offsets into raw Markdown or HTML source**. Markup delimiters, HTML entities, and other transformations require an additional source mapping in the adapter.

## Data model

`RichTextFlow` describes one continuous UTF-16 text buffer together with its identity/version, inline spans, paragraph styles, decorations, attachments, and source map. Related types include `RichTextSpan`, `RichTextParagraph`, `RichTextDecoration`, `RichTextAttachment`, `RichTextSourceRange`, and `RichTextSelectionMapping`.

The model has no dependency on a particular content format or application. Version 0.0.1 exposes the schema for integrations; it does not render these styles or attachments itself. The API is early and may change before a stable release.

## Direction

Future releases are intended to add a native continuous-text view and general-purpose document compilation tools. Markdown, HTML, and application-specific content can then be adapted to a shared model.

These are planned capabilities, not features of 0.0.1. Cross-view selection, arbitrary embedded React components, full browser CSS support, and a TeX typesetting engine are not part of this release.

## Development

```bash
npm ci
npm run check
npm pack --dry-run
```

`check` builds both module formats, checks TypeScript consumer examples, and runs the Node.js test suite. `prepack` builds the package; `prepublishOnly` runs the full check. Publishing instructions are in `PUBLISHING.md` in the source checkout.

The published archive also includes the TypeScript source, build script, tests, configuration, and `npm-shrinkwrap.json`, so it can be rebuilt with the same commands after extraction. TypeScript is a development dependency only; the lockfile adds no runtime dependencies.

## Origin and license

Extracted and generalized from the rich-content model and selection utilities in [zhihu-minus-minus](https://github.com/huamurui/zhihu-minus-minus), based on commit [`15ae86618d6e93b78ed90fef1dc5d3029821e235`](https://github.com/huamurui/zhihu-minus-minus/commit/15ae86618d6e93b78ed90fef1dc5d3029821e235).

This package is distributed under the MIT License. See [LICENSE](./LICENSE).
