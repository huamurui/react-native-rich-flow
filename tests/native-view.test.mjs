import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Exercise the actual component and its event lifecycle without a device runtime.
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
const platform = { OS: 'ios' };
let nativeAvailable = true;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: platform, View: 'View', Text: 'Text' };
  if (name === 'expo-modules-core') return {
    requireOptionalNativeModule: () => nativeAvailable ? {} : null,
    requireNativeViewManager: () => 'NativeFlow',
  };
  return originalLoad.call(this, name, ...args);
};
const { RichFlow, isRichFlowAvailable } = require('../dist/cjs/native/index.js');
Module._load = originalLoad;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const makeFlow = (textVersion = '1') => ({
  id: 'demo', textVersion, text: 'one\ntwo', paragraphs: [], spans: [], decorations: [], attachments: [],
  sourceMap: [{ start: 0, end: 7, sourceStart: 0, sourceEnd: 7, nodeId: 'p', kind: 'text' }],
});
const identity = { flowId: 'demo', textVersion: '1' };
const selection = { ...identity, start: 0, end: 7 };

async function mount(props) {
  let renderer;
  await act(() => { renderer = TestRenderer.create(React.createElement(RichFlow, props)); });
  await act(() => renderer.root.findAllByType('View').find((node) => node.props.onLayout).props.onLayout({
    nativeEvent: { layout: { width: 300, height: 0, x: 0, y: 0 } },
  }));
  return renderer;
}

test('RichFlow measures itself and rejects obsolete layout events', async () => {
  const heights = [];
  const renderer = await mount({ flow: makeFlow(), onHeightChange: (height) => heights.push(height) });
  const before = renderer.root.findByType('NativeFlow').props;
  await act(() => before.onHeightChange({ ...identity, layoutKey: before.layoutKey, height: 82 }));
  assert.equal(renderer.root.findByType('NativeFlow').props.style.height, 82);
  await act(() => renderer.update(React.createElement(RichFlow, { flow: makeFlow(), config: { fontSize: 24 }, onHeightChange: (h) => heights.push(h) })));
  await act(() => before.onHeightChange({ ...identity, layoutKey: before.layoutKey, height: 999 }));
  assert.notEqual(renderer.root.findByType('NativeFlow').props.style.height, 999);
  assert.deepEqual(heights, [82]);
  await act(() => renderer.unmount());
});

test('RichFlow rejects late selection events after document changes or unmount', async () => {
  const selections = [];
  const onSelectionChange = (event) => selections.push(event);
  const renderer = await mount({ flow: makeFlow(), onSelectionChange });
  const before = renderer.root.findByType('NativeFlow').props;
  await act(() => before.onSelectionChange(selection));
  assert.equal(selections[0].text, 'one\ntwo');
  await act(() => renderer.update(React.createElement(RichFlow, { flow: makeFlow('2'), onSelectionChange })));
  await act(() => before.onSelectionChange(selection));
  assert.equal(selections.length, 1);
  const current = renderer.root.findByType('NativeFlow').props;
  await act(() => renderer.unmount());
  current.onSelectionChange({ ...selection, textVersion: '2' });
  assert.equal(selections.length, 1);
});

test('RichFlow disables ordinary selection events but forwards cleared selections', async () => {
  const selections = [];
  const renderer = await mount({ flow: makeFlow(), selectable: false, onSelectionChange: (event) => selections.push(event) });
  const props = renderer.root.findByType('NativeFlow').props;
  props.onSelectionChange(selection);
  props.onSelectionChange({ ...identity, start: -1, end: -1 });
  assert.equal(selections.length, 1);
  assert.equal(selections[0].text, '');
  await act(() => renderer.unmount());
});

test('RichFlow honors a caller fallback on unsupported platforms', async () => {
  platform.OS = 'web';
  assert.equal(isRichFlowAvailable(), false);
  let renderer;
  await act(() => { renderer = TestRenderer.create(React.createElement(RichFlow, { flow: makeFlow(), fallback: React.createElement('Text', {}, 'Use a native build') })); });
  assert.equal(renderer.root.findByType('Text').children[0], 'Use a native build');
  assert.equal(renderer.root.findAllByType('NativeFlow').length, 0);
  await act(() => renderer.unmount());
  platform.OS = 'ios';
});
