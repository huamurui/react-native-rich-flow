import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const original = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'ios' }, View: 'View', Text: 'Text' };
  if (name === 'expo-modules-core') return {
    requireOptionalNativeModule: () => ({}), requireNativeViewManager: () => 'Stream',
  };
  return original.call(this, name, ...args);
};
const { PlainTextStream } = require('../dist/cjs/native/index.js');
Module._load = original;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('stream coalesces appends, retains height, resynchronizes and verifies selection revisions', async () => {
  let pending;
  globalThis.requestAnimationFrame = fn => { pending = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { pending = undefined; };
  const selection = [];
  let renderer;
  const render = (text, documentId = 'a') => React.createElement(PlainTextStream, { documentId, text, onSelectionChange: e => selection.push(e.text) });
  try {
    await act(() => { renderer = TestRenderer.create(render('前')); });
    const layout = renderer.root.findAllByType('View').find(n => n.props.onLayout);
    await act(() => layout.props.onLayout({ nativeEvent: { layout: { width: 280 } } }));
    const props = () => renderer.root.findByType('Stream').props;
    const update = () => JSON.parse(props().updateJson);
    const event = (version, data) => ({ nativeEvent: { documentId: 'a', version, ...data } });
    assert.deepEqual(update(), { kind: 'snapshot', documentId: 'a', version: 1, text: '前' });
    await act(() => props().onHeightChange(event(1, { contentWidth: 280, height: 73 })));
    await act(() => renderer.update(render('前半')));
    await act(() => renderer.update(render('前半\ud83d')));
    await act(() => pending());
    assert.deepEqual(update(), { kind: 'append', documentId: 'a', version: 2, baseVersion: 1, text: '半' });
    await act(() => renderer.update(render('前半😀')));
    await act(() => pending());
    assert.equal(update().text, '😀');
    assert.equal(props().style.height, 73);
    await act(() => props().onResync(event(3, {})));
    assert.deepEqual(update(), { kind: 'snapshot', documentId: 'a', version: 3, text: '前半😀' });
    props().onSelectionChange(event(2, { start: 0, end: 1 }));
    props().onSelectionChange(event(3, { start: 2, end: 3 }));
    props().onSelectionChange(event(3, { start: 0, end: 2 }));
    assert.deepEqual(selection, ['前半']);
    await act(() => renderer.update(render('new', 'b')));
    assert.equal(update().kind, 'snapshot');
    assert.equal(update().documentId, 'b');
    assert.equal(update().version, 4);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
});

test('stream repairs malformed UTF-16, snapshots new views, and rejects stale events across layout changes', async () => {
  let nextFrame;
  globalThis.requestAnimationFrame = fn => { nextFrame = fn; return 1; };
  globalThis.cancelAnimationFrame = () => { nextFrame = undefined; };
  const selections = [];
  let renderer;
  const render = (text, config, selectable = true, documentId = 'A') => React.createElement(PlainTextStream, {
    documentId, text, config, selectable, onSelectionChange: e => selections.push(e.text),
  });
  try {
    await act(() => { renderer = TestRenderer.create(render('a\ud800b\udfff\ud83d')); });
    const layout = renderer.root.findAllByType('View').find(n => n.props.onLayout);
    const setWidth = width => act(() => layout.props.onLayout({ nativeEvent: { layout: { width } } }));
    const props = () => renderer.root.findByType('Stream').props;
    const packet = () => JSON.parse(props().updateJson);
    const event = (version, data) => ({ nativeEvent: { documentId: 'A', version, ...data } });
    await setWidth(240);
    assert.equal(packet().text, 'a\ufffdb\ufffd');
    await act(() => renderer.update(render('a\ud800b\udfff😀')));
    await act(() => nextFrame());
    assert.equal(packet().kind, 'append');
    assert.equal(packet().text, '😀');
    const detached = props();
    await setWidth(0);
    await setWidth(240);
    assert.deepEqual(packet(), { kind: 'snapshot', documentId: 'A', version: 2, text: 'a\ufffdb\ufffd😀' });
    detached.onSelectionChange(event(2, { start: 0, end: 1 }));
    props().onSelectionChange(event(2, { start: 4, end: 6 }));
    assert.deepEqual(selections, ['😀']);

    const previous = props();
    await act(() => renderer.update(render('a\ud800b\udfff😀', { fontSize: 30 }, false)));
    const revision = packet().version;
    assert.equal(revision, 3);
    await act(() => props().onHeightChange(event(revision, { contentWidth: 240, height: 94 })));
    await act(() => previous.onHeightChange(event(2, { contentWidth: 240, height: 15 })));
    await act(() => props().onHeightChange(event(revision, { contentWidth: 240, height: 0 })));
    await act(() => props().onResync(event(2, {})));
    assert.equal(props().style.height, 94);
    assert.equal(packet().kind, 'append');
    props().onSelectionChange(event(revision, { start: 0, end: 1 }));
    assert.deepEqual(selections, ['😀']);

    // An outstanding A callback sees the committed B input when it runs.
    await act(() => renderer.update(render('queued text', { fontSize: 30 })));
    await act(() => renderer.update(render('new', undefined, true, 'B')));
    await act(() => nextFrame());
    assert.equal(packet().documentId, 'B');
    assert.equal(packet().text, 'new');
    const retired = props();
    const version = packet().version;
    await act(() => renderer.unmount());
    renderer = undefined;
    retired.onSelectionChange({ nativeEvent: { documentId: 'B', version, start: 0, end: 1 } });
    assert.deepEqual(selections, ['😀']);
  } finally {
    if (renderer) await act(() => renderer.unmount());
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  }
});
