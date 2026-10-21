import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { parseHtml, parseMarkdown } from '../dist/esm/adapters/index.js';
import { compileDocument } from '../dist/esm/compiler.js';
import { getRichTextSelectionText, mapRichTextSelection } from '../dist/esm/selection.js';

const flowFromHtml = (html, options) => compileDocument(parseHtml(html, options));

test('HTML ruby pairs readings with bases without leaking rt/rp into selection', () => {
  const flow = flowFromHtml('<p><ruby><rb>漢</rb><rp>(</rp><rt>かん</rt><rp>)</rp>字<rt>じ</rt></ruby> <ruby data-ruby-position="under">语<rt>yǔ &amp; yù</rt></ruby><rt>orphan</rt></p>');
  assert.equal(flow.text, '漢字 语');
  assert.deepEqual(flow.annotations.map(({ start, end, text, position }) => ({ start, end, text, position })), [
    { start: 0, end: 1, text: 'かん', position: 'over' },
    { start: 1, end: 2, text: 'じ', position: 'over' },
    { start: 3, end: 4, text: 'yǔ & yù', position: 'under' },
  ]);
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), '漢字 语');
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('HTML grouped ruby pairs every explicit base and preserves unannotated bases', () => {
  const flow = flowFromHtml(`<p><ruby data-ruby-position="under">
    <rb><strong>東</strong></rb>
    <rb>京</rb>
    <rt>とう</rt>
    <rt>きょう</rt>
    <rtc><rt>ignored second level</rt></rtc>
    <rb>都</rb><rb>市</rb><rt>と</rt>
  </ruby><ruby><rb></rb><rb>語</rb><rt>empty base</rt><rt>ご</rt><rt>orphan</rt></ruby></p>`);
  assert.equal(flow.text, '東京都市語');
  assert.deepEqual(flow.annotations.map(({ start, end, text, position }) => ({ start, end, text, position })), [
    { start: 0, end: 1, text: 'とう', position: 'under' },
    { start: 1, end: 2, text: 'きょう', position: 'under' },
    { start: 2, end: 3, text: 'と', position: 'under' },
    { start: 4, end: 5, text: 'ご', position: 'over' },
  ]);
  assert.equal(flow.spans[0].kind, 'strong');
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), '東京都市語');
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('HTML ruby readings collapse ASCII whitespace without changing nonbreaking spaces or code', () => {
  const flow = flowFromHtml('<p><ruby>漢字<rt> \tかん\n  <span>じ</span>\r\f </rt></ruby><ruby>語<rt>&nbsp;ご&#8239; &amp;\tよみ&nbsp;</rt></ruby></p><pre><code> \tcode\n  line\r\f </code></pre>');
  assert.deepEqual(flow.annotations.map((annotation) => annotation.text), [
    'かん じ', '\u00a0ご\u202f & よみ\u00a0',
  ]);
  assert.equal(flow.text, '漢字語\n \tcode\n  line\r\f ');
  assert.equal(getRichTextSelectionText(flow, 0, 3), '漢字語');
});

test('Markdown HTML supports character emphasis and ruby through the shared adapter', () => {
  const flow = compileDocument(parseMarkdown('<span data-text-emphasis="sesame" data-emphasis-position="over">強調</span> <ruby>中<rt>zhōng</rt></ruby> *italic*'));
  assert.equal(flow.text, '強調 中 italic');
  assert.equal(flow.annotations[0].kind, 'emphasis');
  assert.equal(flow.annotations[0].mark, 'sesame');
  assert.equal(flow.annotations[1].text, 'zhōng');
  assert.equal(flow.spans[0].kind, 'emphasis');
});

test('HTML character emphasis composes with styles, links and line decorations', () => {
  const flow = flowFromHtml('<p><strong data-text-emphasis="dot">重点</strong><a href="https://example.com" data-text-emphasis="circle" data-decoration="wavy">链接</a></p>');
  assert.equal(flow.text, '重点链接');
  assert.deepEqual(flow.annotations.map((annotation) => annotation.mark), ['dot', 'circle']);
  assert.deepEqual(flow.spans.map((span) => span.kind), ['strong', 'link']);
  assert.equal(flow.decorations[0].kind, 'wavy');
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), flow.text);
});

test('HTML decodes entities and normalizes whitespace across nested inline styles', () => {
  const flow = flowFromHtml('<p>  Hello <strong> bold <em> and italic </em></strong> world &amp; 😀 </p><p>Next<br>line</p>');
  assert.equal(flow.text, 'Hello bold and italic world & 😀\nNext\nline');
  assert.ok(flow.spans.some((span) => span.kind === 'strong'));
  assert.ok(flow.spans.some((span) => span.kind === 'emphasis'));
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('HTML preserves headings, quotes, multi-paragraph lists and code whitespace', () => {
  const flow = flowFromHtml('<h2>Title</h2><blockquote><p>Quote</p></blockquote><ol start="4"><li><p>One</p><p>Again</p></li><li>Two</li></ol><pre><code class="language-js">  x\n y</code></pre>');
  assert.equal(flow.text, 'Title\nQuote\n4. One\nAgain\n5. Two\n  x\n y');
  assert.deepEqual(flow.paragraphs.map((p) => p.kind), ['heading', 'quote', 'listItem', 'listItem', 'listItem', 'code']);
});

test('markup removes executable containers and disables unsafe links without losing their labels', () => {
  const flow = flowFromHtml('<script>alert(1)</script><style>bad</style><iframe>bad</iframe><p onclick="bad()"><a href="javascript:alert(1)">Label</a> <a href="java&#10;script:bad()">Other</a> <a href="https://example.com">Good</a></p>');
  assert.equal(flow.text, 'Label Other Good');
  assert.equal(flow.spans.filter((span) => span.kind === 'link').length, 1);
  assert.equal(flow.spans.find((span) => span.kind === 'link').url, 'https://example.com/');
  assert.equal(JSON.stringify(flow).includes('onclick'), false);
});

test('HTML resolves allowed relative links/resources and rejects file and credential URLs', () => {
  const flow = flowFromHtml('<p><a href="../guide">Guide</a><img src="image.png" alt="Photo"><img src="file:///private/image.png" alt="Missing"><a href="https://name:secret@example.com">Secret link</a></p>', { id: 'resources', baseUrl: 'https://example.com/docs/' });
  assert.equal(flow.attachments[0].url, 'https://example.com/docs/image.png');
  assert.equal(flow.spans[0].url, 'https://example.com/guide');
  assert.equal(flow.attachments.length, 1);
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), 'GuidePhotoMissingSecret link');
});

test('HTML inline image/formula/decorations become native semantic ranges', () => {
  const flow = flowFromHtml('<p>A<span data-decoration="wavy" data-action-id="note">note</span><img data-latex="x^2" width="40" height="20" src="data:image/png;base64,aA=="><img src="https://example.com/photo.png" alt="photo"></p>');
  assert.equal(flow.text, 'Anote\ufffc\ufffc');
  assert.equal(flow.decorations[0].kind, 'wavy');
  assert.equal(flow.decorations[0].actionId, 'note');
  assert.equal(flow.attachments[0].kind, 'formula');
  assert.equal(flow.attachments[0].width, 40);
  assert.equal(getRichTextSelectionText(flow, 0, flow.text.length), 'Anotex^2photo');
});

test('Markdown supports common blocks, styles, links and attachments through the same compiler', () => {
  const document = parseMarkdown('# Title\n\n**Bold** and *italic* with [link](https://example.com).\n\n> Quote\n\n- First\n- Second\n\n![image](https://example.com/a.png)\n\n```js\n  const n = 1;\n```', { id: 'markdown-example' });
  const flow = compileDocument(document);
  assert.equal(flow.id, 'markdown-example');
  assert.ok(flow.text.includes('• First\n• Second'));
  assert.ok(flow.text.includes('  const n = 1;'));
  assert.ok(flow.spans.some((span) => span.kind === 'strong'));
  assert.ok(flow.spans.some((span) => span.kind === 'link'));
  assert.equal(flow.attachments[0].copyText, 'image');
  assert.ok(mapRichTextSelection(flow, 0, flow.text.length));
});

test('Markdown raw HTML uses the same filtering; table cells degrade into readable rows', () => {
  const flow = compileDocument(parseMarkdown('<script>bad()</script>\n\n| A | B |\n| - | - |\n| 1 | 2 |'));
  assert.equal(flow.text, 'A | B\n1 | 2');
  assert.equal(flow.text.includes('bad'), false);
});

test('adapters are deterministic, support CommonJS, and bound malicious HTML nesting', () => {
  assert.deepEqual(parseHtml('<p>Same</p>'), parseHtml('<p>Same</p>'));
  const require = createRequire(import.meta.url);
  const cjs = require('../dist/cjs/adapters/index.js');
  assert.equal(compileDocument(cjs.parseMarkdown('**CommonJS**')).text, 'CommonJS');
  assert.throws(() => parseHtml('<span>'.repeat(140) + 'deep' + '</span>'.repeat(140)), /nesting/);
});
