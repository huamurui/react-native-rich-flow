import assert from 'node:assert/strict';
import test from 'node:test';
import { compileDocument } from '../dist/esm/compiler.js';
import { getRichTextSelectionText, isValidTextRange, mapRichTextSelection } from '../dist/esm/selection.js';

const text = (id, value) => ({ id, type: 'text', text: value });
const paragraph = (id, children) => ({ id, type: 'paragraph', children });
const document = (blocks) => ({ id: 'test', blocks });

test('ruby and character emphasis preserve base text, UTF-16 ranges and semantic copying', () => {
  const source = document([paragraph('p', [
    { id: 'dots', type: 'textEmphasis', children: [
      { id: 'reading', type: 'ruby', annotation: 'hàn', children: [text('han', '漢')] },
      text('rest', '👩🏽‍💻e\u0301'),
    ] },
  ])]);
  const flow = compileDocument(source);
  assert.equal(flow.text, '漢👩🏽‍💻e\u0301');
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), flow.text);
  assert.deepEqual(flow.annotations, [
    { id: 'dots', nodeId: 'dots', start: 0, end: flow.text.length, position: 'under', kind: 'emphasis', mark: 'dot' },
    { id: 'reading', nodeId: 'reading', start: 0, end: 1, position: 'over', kind: 'ruby', text: 'hàn' },
  ]);
  assert.deepEqual(mapRichTextSelection(flow, 0, 1).start, { nodeId: 'han', paragraphId: 'p', offset: 0 });
  const changed = structuredClone(source);
  changed.blocks[0].children[0].children[0].annotation = 'kan';
  assert.notEqual(compileDocument(changed).textVersion, flow.textVersion);
  assert.equal(compileDocument(changed).text, flow.text);
});

test('empty bases/readings do not create annotations; italic emphasis stays distinct', () => {
  const flow = compileDocument(document([paragraph('p', [
    { id: 'empty', type: 'textEmphasis', children: [] },
    { id: 'silent', type: 'ruby', annotation: '  ', children: [text('base', '字')] },
    { id: 'italic', type: 'emphasis', children: [text('i', 'italic')] },
    { id: 'sesame', type: 'textEmphasis', position: 'over', mark: 'sesame', children: [text('j', '強調')] },
  ])]));
  assert.equal(flow.text, '字italic強調');
  assert.equal(flow.annotations.length, 1);
  assert.equal(flow.annotations[0].position, 'over');
  assert.equal(flow.annotations[0].mark, 'sesame');
  assert.equal(flow.spans[0].kind, 'emphasis');
});

test('compiler preserves a continuous UTF-16 flow with exact semantic source endpoints', () => {
  const flow = compileDocument(document([
    paragraph('p1', [text('t1', '你好😀')]),
    paragraph('p2', [text('t2', 'Second paragraph')]),
  ]));
  assert.equal(flow.text, '你好😀\nSecond paragraph');
  assert.equal(flow.paragraphs.length, 2);
  assert.equal(flow.paragraphs[0].end, 5);
  assert.deepEqual(mapRichTextSelection(flow, 0, flow.text.length), {
    text: flow.text,
    start: { nodeId: 't1', paragraphId: 'p1', offset: 0 },
    end: { nodeId: 't2', paragraphId: 'p2', offset: 16 },
  });
  assert.ok(flow.sourceMap.every((range) => isValidTextRange(flow.text, range.start, range.end)));
});

test('compiler retains nested styles, decoration actions and attachment semantic copying', () => {
  const flow = compileDocument(document([paragraph('p', [
    { id: 'bold', type: 'strong', children: [text('a', 'Hello '), { id: 'italic', type: 'emphasis', children: [text('b', 'world')] }] },
    { id: 'wave', type: 'decoration', kind: 'wavy', actionId: 'explain', color: '#ff0000', children: [text('c', ' important')] },
    { id: 'formula', type: 'formula', latex: 'E = mc²', width: 80, height: 25 },
    { id: 'image', type: 'image', url: 'https://example.com/image.png', alt: 'diagram' },
  ])]));
  assert.equal(flow.text, 'Hello world important\ufffc\ufffc');
  assert.equal(flow.spans.find((span) => span.kind === 'strong').end, 11);
  assert.deepEqual(flow.spans.find((span) => span.kind === 'emphasis'), { nodeId: 'italic', kind: 'emphasis', start: 6, end: 11 });
  assert.equal(flow.decorations[0].actionId, 'explain');
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), 'Hello world importantE = mc²diagram');
  assert.deepEqual(mapRichTextSelection(flow, 21, 22).end, { nodeId: 'formula', paragraphId: 'p', offset: 7 });
});

test('list markers are synthetic and each item consumes its marker only once', () => {
  const flow = compileDocument(document([{
    id: 'list', type: 'list', ordered: true, start: 3,
    items: [
      { id: 'item1', blocks: [paragraph('p1', [text('t1', 'First')]), paragraph('p2', [text('t2', 'Continued')])] },
      { id: 'item2', blocks: [paragraph('p3', [text('t3', 'Second')])] },
    ],
  }]));
  assert.equal(flow.text, '3. First\nContinued\n4. Second');
  assert.equal(mapRichTextSelection(flow, 0, 3), null);
  assert.deepEqual(mapRichTextSelection(flow, 0, 8).start, { nodeId: 't1', paragraphId: 'p1', offset: 0 });
  assert.equal(flow.paragraphs[0].kind, 'listItem');
});

test('nested lists keep parent markers when the nested list precedes parent text', () => {
  const flow = compileDocument(document([{
    id: 'outer', type: 'list', items: [{ id: 'outer-item', blocks: [
      { id: 'inner', type: 'list', ordered: true, items: [{ id: 'inner-item', blocks: [paragraph('p', [text('t', 'Nested')])] }] },
      paragraph('tail', [text('tail-text', 'Parent continuation')]),
    ] }],
  }]));
  assert.equal(flow.text, '• \n1. Nested\nParent continuation');
  assert.equal(flow.paragraphs[1].indent, 40);
  assert.equal(flow.paragraphs[2].indent, 20);
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('empty list items and empty paragraphs keep intentional line boundaries', () => {
  const flow = compileDocument(document([
    paragraph('empty-before', []),
    paragraph('p', [text('t', 'Body')]),
    paragraph('empty-between', []),
    { id: 'list', type: 'list', items: [{ id: 'empty-item', blocks: [] }] },
  ]));
  assert.equal(flow.text, '\nBody\n\n• ');
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), flow.text);
});

test('headings, quotes, code and explicit breaks share a continuous selectable flow', () => {
  const flow = compileDocument(document([
    { id: 'heading', type: 'heading', level: 2, children: [text('h', 'Heading')] },
    { id: 'quote', type: 'quote', blocks: [paragraph('quoted', [text('q1', 'Quote'), { id: 'break', type: 'break' }, text('q2', 'line')])] },
    { id: 'code', type: 'code', language: 'ts', text: 'const n = 1;\n  n + 1;' },
  ]), { fontSize: 20, lineHeight: 30, paragraphSpacing: 8 });
  assert.equal(flow.text, 'Heading\nQuote\nline\nconst n = 1;\n  n + 1;');
  assert.equal(flow.paragraphs[0].fontSize, 33);
  assert.equal(flow.paragraphs[1].kind, 'quote');
  assert.equal(flow.paragraphs[2].kind, 'code');
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('compiler identity is stable and changes with text, styles and typography', () => {
  const source = document([paragraph('p', [text('t', 'A')])]);
  const initial = compileDocument(source);
  assert.equal(initial.textVersion, compileDocument(source).textVersion);
  assert.notEqual(initial.textVersion, compileDocument(document([paragraph('p', [text('t', 'B')])])).textVersion);
  assert.notEqual(initial.textVersion, compileDocument(source, { fontSize: 22 }).textVersion);
  assert.notEqual(initial.textVersion, compileDocument(document([paragraph('p', [{ id: 'strong', type: 'strong', children: [text('t', 'A')] }])])).textVersion);
  assert.equal(compileDocument(source, { textVersion: 'caller-42' }).textVersion, 'caller-42');
});

test('compiler does not mutate caller data and rejects ambiguous duplicate node identities', () => {
  const source = Object.freeze({ id: 'frozen', blocks: Object.freeze([
    Object.freeze({ id: 'p', type: 'paragraph', children: Object.freeze([Object.freeze(text('t', 'Original'))]) }),
  ]) });
  assert.equal(compileDocument(source).text, 'Original');
  assert.throws(() => compileDocument(document([paragraph('p', [text('same', 'A'), text('same', 'B')])])), /unique/);
  assert.throws(() => compileDocument({ id: '', blocks: [] }), /nonempty/);
  assert.equal(compileDocument(document([])).text, '');
});

test('nested style precedence is outer-first and split UTF-16 source nodes are rejected', () => {
  const flow = compileDocument(document([paragraph('p', [{
    id: 'outer', type: 'highlight', color: '#ffff00', children: [{
      id: 'inner', type: 'highlight', color: '#00ff00', children: [text('t', 'Nested')],
    }],
  }])]));
  assert.deepEqual(flow.spans.map((span) => span.nodeId), ['outer', 'inner']);
  assert.throws(() => compileDocument(document([paragraph('p', [text('high', '\ud83d'), text('low', '\ude00')])])), /surrogate pair/);
});
