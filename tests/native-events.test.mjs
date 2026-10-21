import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLayoutKey, readActionEvent, readHeightEvent, readSelectionEvent, serializeNativeFlow,
} from '../dist/esm/native/events.js';

const flow = {
  id: 'demo', textVersion: '1', text: 'A😀\ufffc link', paragraphs: [],
  attachments: [{ id: 'photo', nodeId: 'photo', kind: 'image', start: 3, end: 4, copyText: '[photo]', url: 'https://example.com/image.png' }],
  decorations: [{ id: 'line', nodeId: 'label', actionId: 'inspect', kind: 'wavy', start: 0, end: 3 }],
  spans: [{ kind: 'link', nodeId: 'link', start: 5, end: 9, url: 'https://example.com' }],
  sourceMap: [
    { start: 0, end: 3, nodeId: 'label', sourceStart: 0, sourceEnd: 3, kind: 'text' },
    { start: 3, end: 4, nodeId: 'photo', sourceStart: 0, sourceEnd: 7, kind: 'attachment' },
    { start: 4, end: 9, nodeId: 'rest', sourceStart: 0, sourceEnd: 5, kind: 'text' },
  ],
};
const identity = { flowId: flow.id, textVersion: flow.textVersion };

test('selection bridge maps semantic copies and handles nativeEvent envelopes', () => {
  const result = readSelectionEvent({ nativeEvent: { ...identity, start: 0, end: 4 } }, flow);
  assert.equal(result.text, 'A😀[photo]');
  assert.deepEqual(result.mapping.end, { nodeId: 'photo', offset: 7 });
  assert.deepEqual(readSelectionEvent({ ...identity, start: -1, end: -1 }, flow), {
    ...identity, start: -1, end: -1, text: '', mapping: null,
  });
});

test('selection bridge rejects stale documents, invalid envelopes and surrogate splits', () => {
  for (const input of [null, 'event', { ...identity, start: 1, end: 2 },
    { ...identity, start: 0, end: 4, textVersion: 'old' }, { ...identity, start: 0, end: '4' }]) {
    assert.equal(readSelectionEvent(input, flow), null);
  }
});

test('action bridge only exposes current model actions and their trusted URL', () => {
  const link = readActionEvent({ ...identity, kind: 'link', id: 'link', start: 5, end: 9, url: 'javascript:wrong' }, flow);
  assert.equal(link.url, 'https://example.com');
  assert.equal(readActionEvent({ ...identity, kind: 'decoration', id: 'inspect', start: 0, end: 3 }, flow).kind, 'decoration');
  assert.equal(readActionEvent({ ...identity, kind: 'attachmentLongPress', id: 'photo', start: 3, end: 4 }, flow).url, 'https://example.com/image.png');
  for (const changes of [{ id: 'missing' }, { start: 0 }, { kind: 'unknown' }, { textVersion: 'old' }]) {
    assert.equal(readActionEvent({ ...identity, kind: 'link', id: 'link', start: 5, end: 9, ...changes }, flow), null);
  }
});

test('height bridge rejects stale measurement keys and invalid sizes', () => {
  assert.equal(readHeightEvent({ ...identity, layoutKey: 'current', height: 120 }, flow, 'current'), 120);
  assert.equal(readHeightEvent({ ...identity, layoutKey: 'current', height: 0 }, { ...flow, text: '' }, 'current'), 0);
  for (const changes of [{ layoutKey: 'old' }, { textVersion: 'old' }, { height: 0 }, { height: NaN }, { height: Infinity }, { height: '120' }]) {
    assert.equal(readHeightEvent({ ...identity, layoutKey: 'current', height: 120, ...changes }, flow, 'current'), null);
  }
});

test('native payload omits source maps and measurement identity changes with input', () => {
  const serialized = serializeNativeFlow(flow);
  assert.equal('sourceMap' in JSON.parse(serialized), false);
  const key = createLayoutKey(serialized, '{}', 320);
  assert.notEqual(key, createLayoutKey(serialized, '{}', 480));
  assert.notEqual(key, createLayoutKey(serialized, '{"fontSize":24}', 320));
  assert.notEqual(key, createLayoutKey(serializeNativeFlow({ ...flow, textVersion: '2' }), '{}', 320));
  assert.equal(key, createLayoutKey(serialized, '{}', 320));
});
