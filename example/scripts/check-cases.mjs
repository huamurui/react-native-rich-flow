import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const coreUrl = new URL('../../dist/esm/index.js', import.meta.url);
const adapterUrl = new URL('../../dist/esm/adapters/index.js', import.meta.url);
const core = await import(coreUrl.href);
const { parseHtml, parseMarkdown } = await import(adapterUrl.href);
const directory = await mkdtemp(join(tmpdir(), 'rich-flow-example-'));
after(() => rm(directory, { recursive: true, force: true }));
await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'module' }));

// Execute the same TypeScript fixtures used by the app, without an RN runtime.
for (const file of ['i18n', 'sources', 'assets', 'typography', 'cases']) {
  const source = await readFile(new URL(`../src/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  });
  await writeFile(join(directory, `${file}.js`), outputText
    .replaceAll("from 'react-native-rich-flow'", `from '${coreUrl.href}'`)
    .replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
}
const { LOCALES, translations, resolveLocale, format } = await import(pathToFileURL(join(directory, 'i18n.js')).href);
const { CASE_IDS, createCaseFlow, getCases } = await import(pathToFileURL(join(directory, 'cases.js')).href);
const { INITIAL_SOURCES, createInitialSources, updateSource } = await import(pathToFileURL(join(directory, 'sources.js')).href);
const { TYPOGRAPHY_PRESETS, TYPOGRAPHY_CONFIG } = await import(pathToFileURL(join(directory, 'typography.js')).href);

function strings(value, prefix = '') {
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof item === 'string' ? [[name, item]] : Object.entries(strings(item, name));
  }));
}

function assertFlow(flow) {
  assert.ok(flow.text.length > 0);
  for (const range of [...flow.spans, ...flow.paragraphs, ...flow.decorations, ...(flow.annotations ?? []), ...flow.attachments, ...flow.sourceMap]) {
    assert.ok(core.isValidTextRange(flow.text, range.start, range.end), `Invalid range in ${flow.id}`);
  }
  assert.ok(core.mapRichTextSelection(flow, 0, flow.text.length));
  const copied = core.getRichTextSelectionText(flow, 0, flow.text.length);
  for (const attachment of flow.attachments) assert.ok(copied.includes(attachment.copyText));
  assert.ok(!copied.includes('\ufffc'));
}

test('translation keys and interpolation parameters match in both languages', () => {
  const reference = strings(translations.en);
  const parameters = (message) => [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const locale of LOCALES) {
    const translated = strings(translations[locale]);
    assert.deepEqual(Object.keys(translated).sort(), Object.keys(reference).sort());
    for (const [key, value] of Object.entries(translated)) {
      assert.ok(value.trim(), `${locale}: missing ${key}`);
      assert.deepEqual(parameters(value), parameters(reference[key]), `${locale}: ${key}`);
    }
    assert.deepEqual(getCases(locale).map((item) => item.id), CASE_IDS);
  }
  assert.equal(format(translations.en.ui.fontSizeLabel, { size: 20 }), 'Font size 20');
});

test('device language detection has a deterministic English fallback', () => {
  for (const input of ['zh', 'zh-CN', 'zh-TW', 'zh_Hans_CN']) assert.equal(resolveLocale(input), 'zh-CN');
  for (const input of ['en-US', 'fr-FR', '', null, undefined, 7]) assert.equal(resolveLocale(input), 'en');
});

test('switching language keeps edited Markdown and HTML independent', () => {
  const original = createInitialSources();
  const edited = updateSource(original, 'en', 'markdown', '# My draft');
  const bothEdited = updateSource(edited, 'zh-CN', 'html', '<p>我的草稿</p>');
  assert.equal(bothEdited.en.markdown, '# My draft');
  assert.equal(bothEdited['zh-CN'].html, '<p>我的草稿</p>');
  assert.equal(bothEdited.en.html, INITIAL_SOURCES.en.html);
  assert.equal(bothEdited['zh-CN'].markdown, INITIAL_SOURCES['zh-CN'].markdown);
  assert.equal(original.en.markdown, INITIAL_SOURCES.en.markdown);
});

for (const locale of LOCALES) {
  test(`${locale}: all native examples compile with valid ranges and semantic copying`, () => {
    for (const id of CASE_IDS.filter((item) => item !== 'markdown' && item !== 'html')) {
      assertFlow(createCaseFlow(id, 2, 17, false, locale));
      assertFlow(createCaseFlow(id, 1, 24, true, locale));
    }
    const attachments = createCaseFlow('attachments', 0, 17, false, locale);
    assert.ok(core.getRichTextSelectionText(attachments, 0, attachments.text.length).includes(translations[locale].body.imageCopy));
    const selection = createCaseFlow('selection', 0, 17, false, locale);
    for (const writing of ['中文', 'English', '日本語', '한국어', '😀']) assert.ok(selection.text.includes(writing));
    assert.notEqual(createCaseFlow('updates', 0, 17, false, locale).textVersion, createCaseFlow('updates', 1, 17, false, locale).textVersion);
  });

  test(`${locale}: default Markdown and HTML pass through the production adapters`, () => {
    assertFlow(core.compileDocument(parseMarkdown(INITIAL_SOURCES[locale].markdown)));
    assertFlow(core.compileDocument(parseHtml(INITIAL_SOURCES[locale].html)));
  });

  test(`${locale}: language-specific typography preserves base text and valid annotation ranges`, () => {
    for (const preset of TYPOGRAPHY_PRESETS) {
      const flow = createCaseFlow('locales', 0, 20, false, locale, preset);
      assertFlow(flow);
      assert.equal(core.getRichTextSelectionText(flow, 0, flow.text.length), flow.text);
      for (const annotation of flow.annotations ?? []) {
        assert.equal(core.getRichTextSelectionText(flow, annotation.start, annotation.end), flow.text.slice(annotation.start, annotation.end));
      }
      if (['chinese', 'japanese', 'zhuyin'].includes(preset)) assert.ok(flow.annotations.some((item) => item.kind === 'ruby'));
      if (preset === 'chinese') {
        assert.ok(flow.text.includes('汉字注音'));
        assert.deepEqual(flow.annotations.filter((item) => item.kind === 'emphasis').map((item) => item.mark), ['dot', 'circle', 'sesame']);
      }
      if (preset === 'french') {
        assert.ok(flow.text.includes('\u00a0'));
        assert.ok(flow.text.includes('\u202f'));
      }
    }
    assert.equal(TYPOGRAPHY_CONFIG.arabic.writingDirection, 'rtl');
    assert.equal(TYPOGRAPHY_CONFIG.english.hyphenation, 'full');
  });
}

test('changing language changes displayed document content and its revision', () => {
  for (const id of ['selection', 'styles', 'decorations', 'attachments', 'updates', 'scroll']) {
    const english = createCaseFlow(id, 0, 17, false, 'en');
    const chinese = createCaseFlow(id, 0, 17, false, 'zh-CN');
    assert.notEqual(english.text, chinese.text);
    assert.notEqual(english.textVersion, chinese.textVersion);
  }
});
