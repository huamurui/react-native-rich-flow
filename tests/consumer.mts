import {
  getRichTextSelectionText,
  isValidTextRange,
  mapRichTextSelection,
  type RichTextFlow,
  type RichTextSelectionMapping,
} from 'react-native-rich-flow';

const flow: RichTextFlow = {
  id: 'sample', textVersion: '1', text: 'Hello',
  spans: [], paragraphs: [], decorations: [], attachments: [],
  sourceMap: [{ start: 0, end: 5, sourceStart: 0, sourceEnd: 5, nodeId: 'p1', kind: 'text' }],
};
const valid: boolean = isValidTextRange(flow.text, 0, 5);
const text: string = getRichTextSelectionText(flow, 0, 5);
const selection: RichTextSelectionMapping | null = mapRichTextSelection(flow, 0, 5);
void [valid, text, selection];

// @ts-expect-error String offsets are not part of the public API.
isValidTextRange(flow.text, '0', 5);
