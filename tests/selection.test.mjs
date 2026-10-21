import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  getRichTextSelectionText,
  isValidTextRange,
  mapRichTextSelection,
} from 'react-native-rich-flow';

test('ESM and CommonJS expose the same working public utilities', () => {
  const commonjs = createRequire(import.meta.url)('react-native-rich-flow');
  for (const name of ['getRichTextSelectionText', 'isValidTextRange', 'mapRichTextSelection']) {
    assert.equal(typeof commonjs[name], 'function');
  }
  assert.equal(commonjs.getRichTextSelectionText({ text: '甲😀乙', attachments: [] }, 1, 3), '😀');
});

test('validates UTF-16 selection boundaries for CJK and emoji', () => {
  for (const [start, end] of [[0, 4], [1, 3], [3, 4]]) {
    assert.equal(isValidTextRange('甲😀乙', start, end), true);
  }
  for (const [start, end] of [[1, 2], [2, 3], [0, 0], [-1, 2], [0, 5], [3, 1], [0.5, 2], [0, NaN], [0, Infinity], ['0', 1], [false, 1]]) {
    assert.equal(isValidTextRange('甲😀乙', start, end), false);
  }
  assert.equal(isValidTextRange('', 0, 0), false);
});

test('UTF-16 validation does not claim grapheme-cluster validation', () => {
  assert.equal(isValidTextRange('e\u0301', 0, 1), true);
});

test('copies multiple paragraphs without changing their whitespace', () => {
  const text = '第一段😀\n\n second\tparagraph';
  assert.equal(getRichTextSelectionText({ text, attachments: [] }, 0, text.length), text);
  assert.equal(getRichTextSelectionText({ text, attachments: [] }, 0, 4), '');
});

test('copies genuine attachments in document order without mutating input', () => {
  const attachments = Object.freeze([
    Object.freeze({ start: 4, end: 5, copyText: '[photo]' }),
    Object.freeze({ start: 1, end: 2, copyText: 'x^2' }),
  ]);
  const flow = { text: 'A\ufffc B\ufffc!', attachments };
  assert.equal(getRichTextSelectionText(flow, 0, 6), 'Ax^2 B[photo]!');
  assert.equal(getRichTextSelectionText(flow, 2, 4), ' B');
  assert.equal(attachments[0].start, 4);
});

test('ignores invalid slots, keeps the first duplicate, and allows empty copyText', () => {
  const flow = {
    text: 'A\ufffcB\ufffcC',
    attachments: [
      { start: 0, end: 1, copyText: 'replace normal text' },
      { start: 1, end: 3, copyText: 'multi-character' },
      { start: '1', end: 2, copyText: 'coercion' },
      { start: 1, end: 2, copyText: 'ok' },
      { start: 1, end: 2, copyText: 'duplicate' },
      { start: 3, end: 4, copyText: '' },
      { start: 9, end: 10, copyText: 'out of bounds' },
    ],
  };
  assert.equal(getRichTextSelectionText(flow, 0, 5), 'AokBC');
});

const flow = {
  text: '• 甲😀\n乙\ufffc!',
  attachments: [{ start: 7, end: 8, copyText: 'x^2' }],
  sourceMap: [
    { start: 0, end: 2, nodeId: 'marker', sourceStart: 0, sourceEnd: 0, kind: 'synthetic' },
    { start: 2, end: 5, nodeId: 'one', paragraphId: 'p1', sourceStart: 10, sourceEnd: 13, kind: 'text' },
    { start: 5, end: 6, nodeId: 'break', sourceStart: 13, sourceEnd: 13, kind: 'synthetic' },
    { start: 6, end: 7, nodeId: 'two', paragraphId: 'p2', sourceStart: 0, sourceEnd: 1, kind: 'text' },
    { start: 7, end: 8, nodeId: 'math', paragraphId: 'p2', sourceStart: 1, sourceEnd: 4, kind: 'attachment' },
    { start: 8, end: 9, nodeId: 'end', paragraphId: 'p2', sourceStart: 4, sourceEnd: 5, kind: 'text' },
  ],
};

test('maps a cross-paragraph selection to semantic source offsets', () => {
  assert.deepEqual(mapRichTextSelection(flow, 3, 7), {
    text: '😀\n乙',
    start: { nodeId: 'one', paragraphId: 'p1', offset: 11 },
    end: { nodeId: 'two', paragraphId: 'p2', offset: 1 },
  });
});

test('snaps endpoints past synthetic list markers and paragraph separators', () => {
  assert.deepEqual(mapRichTextSelection(flow, 0, 6), {
    text: '• 甲😀\n',
    start: { nodeId: 'one', paragraphId: 'p1', offset: 10 },
    end: { nodeId: 'one', paragraphId: 'p1', offset: 13 },
  });
  assert.equal(mapRichTextSelection(flow, 0, 2), null);
  assert.equal(mapRichTextSelection(flow, 5, 6), null);
});

test('maps both attachment endpoints to the complete semantic source range', () => {
  assert.deepEqual(mapRichTextSelection(flow, 7, 8), {
    text: 'x^2',
    start: { nodeId: 'math', paragraphId: 'p2', offset: 1 },
    end: { nodeId: 'math', paragraphId: 'p2', offset: 4 },
  });
});

test('adjacent text runs resolve start forward and end backward', () => {
  const adjacent = {
    text: 'abcd', attachments: [],
    sourceMap: [
      { start: 0, end: 2, nodeId: 'a', sourceStart: 0, sourceEnd: 2, kind: 'text' },
      { start: 2, end: 4, nodeId: 'b', sourceStart: 0, sourceEnd: 2, kind: 'text' },
    ],
  };
  assert.equal(mapRichTextSelection(adjacent, 0, 2).end.nodeId, 'a');
  assert.equal(mapRichTextSelection(adjacent, 2, 4).start.nodeId, 'b');
});

test('rejects invalid selections and ambiguous or malformed source maps', () => {
  assert.equal(mapRichTextSelection(flow, 3, 4), null);
  assert.equal(mapRichTextSelection({ ...flow, sourceMap: [] }, 0, 9), null);
  for (const sourceMap of [
    [...flow.sourceMap].reverse(),
    [flow.sourceMap[1], flow.sourceMap[1]],
    [{ ...flow.sourceMap[1], sourceEnd: 14 }],
    [{ ...flow.sourceMap[1], sourceStart: -1 }],
    [{ ...flow.sourceMap[1], sourceStart: true }],
    [{ ...flow.sourceMap[1], start: 4 }],
    [{ ...flow.sourceMap[1], kind: 'unknown' }],
    [{ ...flow.sourceMap[0], sourceEnd: 2 }],
    [{ ...flow.sourceMap[4], start: 6, end: 7 }],
  ]) {
    assert.equal(mapRichTextSelection({ ...flow, sourceMap }, 0, 9), null);
  }
});
