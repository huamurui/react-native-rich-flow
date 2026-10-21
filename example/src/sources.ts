import type { Locale } from './i18n';

export type EditorKind = 'markdown' | 'html';
export type EditorSources = Record<EditorKind, string>;
export type LocalizedSources = Record<Locale, EditorSources>;

export const INITIAL_SOURCES: Readonly<Record<Locale, Readonly<EditorSources>>> = {
  en: {
    markdown: `## One continuous text flow

Write in **Markdown**, then long-press to select in the native view. This paragraph includes *emphasis*, ~~strikethrough~~ and \`inline code\`.

Drag a selection from the previous paragraph into this one. Mixed scripts — 中文, English, 日本語, 한국어 and 😀 — share UTF-16 offsets.

> A quote can be selected together with the surrounding paragraphs.

1. Parse Markdown into a neutral document
2. Compile it into one RichTextFlow
3. Render with the Android / iOS native view

[RichFlow source](https://github.com/huamurui/react-native-rich-flow)

\`\`\`ts
const flow = compileDocument(document);
\`\`\``,
    html: `<h2>HTML adapter example</h2>
<p>Use <strong>semantic tags</strong> for content: <em>emphasis</em>, <u>underline</u>, <s>strikethrough</s> and <mark>highlight</mark>.</p>
<p>This paragraph shares a native selection context with the previous one. Water is H<sub>2</sub>O; a square is x<sup>2</sup>.</p>
<blockquote><p>Format parsing and native interaction belong to separate layers.</p></blockquote>
<ul><li>A list item</li><li>An item with <strong>formatting</strong></li></ul>
<p><a href="https://github.com/huamurui/react-native-rich-flow">Tap a link and inspect the event panel</a></p>`,
  },
  'zh-CN': {
    markdown: `## 一份连续的文字流

在 **Markdown** 中写内容，在原生视图中长按选择。这里有 *斜体*、~~删除线~~ 和 \`inline code\`。

拖动选区，从上一段来到这一段。混合文字：中文、English、日本語、한국어 和 😀，统一使用 UTF-16 偏移。

> 引用也可以和正文一起选择。

1. 解析 Markdown 为中立文档
2. 编译为一个 RichTextFlow
3. 交给 Android / iOS 原生视图

[RichFlow 源码](https://github.com/huamurui/react-native-rich-flow)

\`\`\`ts
const flow = compileDocument(document);
\`\`\``,
    html: `<h2>HTML 接入示例</h2>
<p>使用 <strong>语义标签</strong> 表达内容：<em>强调</em>、<u>下划线</u>、<s>删除线</s>和 <mark>高亮</mark>。</p>
<p>这个段落和上一段共享原生选择上下文。水分子是 H<sub>2</sub>O，平方写作 x<sup>2</sup>。</p>
<blockquote><p>格式解析和原生交互由不同层负责。</p></blockquote>
<ul><li>普通列表项</li><li><strong>包含格式</strong>的列表项</li></ul>
<p><a href="https://github.com/huamurui/react-native-rich-flow">点击链接，查看事件面板</a></p>`,
  },
};

export function createInitialSources(): LocalizedSources {
  return { en: { ...INITIAL_SOURCES.en }, 'zh-CN': { ...INITIAL_SOURCES['zh-CN'] } };
}

/** Update one draft without discarding another format or another language. */
export function updateSource(
  previous: LocalizedSources,
  locale: Locale,
  kind: EditorKind,
  value: string,
): LocalizedSources {
  return { ...previous, [locale]: { ...previous[locale], [kind]: value } };
}
