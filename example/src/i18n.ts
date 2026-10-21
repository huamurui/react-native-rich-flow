export const LOCALES = ['en', 'zh-CN'] as const;
export type Locale = (typeof LOCALES)[number];

const english = {
  ui: {
    title: 'Text Flow Lab', languageTarget: '中文', languageLabel: 'Switch language to Simplified Chinese',
    light: 'Light', dark: 'Dark', switchLight: 'Switch to light theme', switchDark: 'Switch to dark theme',
    missingTitle: 'RichFlow native module is not available',
    missingBody: 'This example needs a development build. Expo Go cannot demonstrate native selection. From the repository root, run npm run example:ios or npm run example:android.',
    controls: 'Interaction & layout', nativeReady: 'Native ready', nativeRequired: 'Native build required',
    fontSize: 'Size', fontSizeLabel: 'Font size {size}', alignment: 'Align', left: 'Left', center: 'Center', right: 'Right', start: 'Start', end: 'End',
    selectable: 'Allow native selection', justify: 'Justify', justifyHint: ' (left/start alignment only)',
    input: '{format} input', sourceLabel: '{format} source',
    editorLanguageNote: 'Drafts are kept separately for each language during this session. Reset restores only this language’s example.',
    apply: 'Apply', restore: 'Reset example', update: 'Update content', remount: 'Remount view',
    parseError: 'Could not compile this content. Check the input and try again.',
    flowMeta: '{paragraphs} paragraphs · {length} UTF-16 · {attachments} attachments', oneFlow: 'ONE FLOW',
    notLoaded: 'The native view is unavailable. You can still inspect the adapter and compiler output with “View model”.',
    waitingMeasure: 'Waiting for native layout', measuredHeight: 'Measured height: {height} pt / dp',
    showModel: 'View model', hideModel: 'Hide model', pasteTitle: 'Paste check', clear: 'Clear',
    pasteLabel: 'Paste verification input', pasteHint: 'Copy from the text above, then paste here. Attachments should become their copyText.',
    limits: 'Selection within one flow · No selection across separate views · No TeX engine · Markdown/HTML semantic subset',
    events: 'Events', expand: 'Expand', collapse: 'Collapse', expandEvents: 'Expand event panel', collapseEvents: 'Collapse event panel',
    selection: 'Selection', noEvents: 'Long-press to select, or tap a link or decoration to inspect native events.', clearEvents: 'Clear event history',
    linkAction: 'Link', decorationAction: 'Decoration', attachmentAction: 'Attachment', attachmentLongPressAction: 'Attachment long press',
  },
  cases: {
    selection: { title: 'Selection', hint: 'Long-press and drag across paragraphs. The panel below shows UTF-16 ranges and source nodes.' },
    styles: { title: 'Typography', hint: 'Explore nested styles, headings, quotes, lists and code. Then change size, alignment and theme.' },
    decorations: { title: 'Decorations', hint: 'Tap decorated text to inspect its actionId, then drag a selection across wrapped lines.' },
    attachments: { title: 'Attachments', hint: 'Copy an image or formula, then paste into the field below to check copyText. All resources are embedded.' },
    updates: { title: 'Live updates', hint: 'Select some text, update the content, or remount the view. Events should match the current textVersion.' },
    scroll: { title: 'Long document', hint: 'Scroll away and back to check attachment recovery. The whole document stays in one selection context.' },
    markdown: { title: 'Markdown', hint: 'Edit Markdown and apply it. The adapter handles semantics; the same native view handles layout and selection.' },
    html: { title: 'HTML', hint: 'Edit semantic HTML and apply it. Scripts are not executed, and browser CSS is not applied.' },
    locales: { title: 'Local typography', hint: 'Explore CJK emphasis and pronunciation, language-aware line breaking, RTL text and explicit nonbreaking spaces. Sample text stays in the selected writing system.' },
  },
  typography: {
    choose: 'Writing system',
    chinese: 'Chinese / Pinyin', japanese: 'Japanese / Furigana', zhuyin: 'Zhuyin', korean: 'Korean', arabic: 'Arabic / RTL', french: 'French / spacing', english: 'English / hyphenation',
    chineseHint: 'Dots below Chinese text mark emphasis. Pinyin is assigned per character. Circle and sesame marks demonstrate the other supported shapes.',
    japaneseHint: 'Pronunciation is assigned per character; sesame marks sit above the emphasized text. This is horizontal layout, not vertical Japanese typography.',
    zhuyinHint: 'Zhuyin is shown horizontally above the base characters. Traditional vertical side annotation is not implemented.',
    koreanHint: 'The ko-KR language hint lets the system lay out Hangul. Line breaking follows the platform; no custom Korean spacing solver is used.',
    arabicHint: 'This flow uses RTL direction and logical Start alignment. Try Start/End and select across Latin text and numbers. Offsets remain logical UTF-16; complete bidirectional decoration behavior still requires device validation.',
    frenchHint: 'The source explicitly contains U+00A0 and U+202F nonbreaking spaces around punctuation and numbers. The renderer preserves these characters; it does not insert French spacing automatically.',
    englishHint: 'The en-US language hint and full hyphenation request use platform line-breaking behavior. Available break points and visible hyphens depend on width, OS and font.',
    annotationCopy: 'Copying uses only the base text. Pronunciation and emphasis marks are visual annotations, not extra text in the selection.',
    annotationLimits: 'Ruby is fitted horizontally to its base width. On each side, emphasis uses the inner band and ruby the outer band. Overlapping annotations of the same kind do not get additional rows; avoid overlapping ruby on the same side. Punctuation compression, hanging punctuation and vertical text are not implemented.',
  },
  body: {
    selectionHeading: 'Select from this paragraph to the next',
    selectionOne: 'These paragraphs are not separate Text views. RichFlow stores text, styling and paragraph ranges in one buffer, so the system selection can cross paragraph boundaries.',
    selectionTwo: 'Try dragging from “text” in the first paragraph to the emoji 😀 here. JavaScript and native events both use UTF-16, so that emoji occupies two code units.',
    selectionBeforeBold: 'A selection can pass through ', selectionBold: 'bold text', selectionBeforeLink: ' and continue through ', selectionLink: 'a regular link', selectionAfterLink: '. Tap a link for an action; long-press to select.',
    selectionBoundary: 'The selection context is one flow. Two independent native views do not share a global selection.',
    multilingual: 'Mixed writing systems: 中文 · English · 日本語 · 한국어 · 😀. Full bidirectional layout and decoration behavior still need platform validation; this example does not promise complete RTL support.',
    stylesHeading: 'Give semantics a native layout', stylesSubheading: 'Inline styles can be nested',
    boldAnd: 'Bold and ', boldItalic: 'bold italic', italic: 'italic', underline: 'underline', strike: 'strikethrough', highlight: 'highlight', separator: ', ', sentenceEnd: '.',
    subPrefix: 'H', superPrefix: 'O and x', scriptsEnd: ' use subscripts and superscripts without changing the underlying copyable text.',
    quoteOne: 'A quote has its own indentation and vertical rule.', quoteTwo: 'Multiple quote paragraphs still belong to one continuous text buffer.',
    listOne: 'An ordered list can start at a specified number.', listTwo: 'Markers are generated content; the source mapping skips them.', nestedList: 'A nested list item.',
    codeBlock: 'const flow = compileDocument(document);\n// One document, one continuous text flow.',
    decorationHeading: 'Decorations follow actual visual lines', solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted', wavy: 'Wavy',
    decorationText: '{label} ({kind}): this paragraph is deliberately long enough to wrap. Tap the text to send an action to the host, or long-press to enter native selection.',
    crossDecorationOne: 'This decoration starts in one paragraph and crosses the paragraph separator.', crossDecorationTwo: 'It ends in this paragraph, with one continuous range and one action.',
    attachmentHeading: 'Images and formulas are part of the flow',
    imageBefore: 'An inline illustration ', imageAlt: 'Mountains and sun', imageCopy: '[mountains and sun]', imageAfter: ' keeps the surrounding text selectable. Regular images preserve their own colors.',
    formulaBefore: 'The relation ', formulaAfter: ' uses a pre-rendered SVG. Copying produces the semantic formula text. Switch themes to check its foreground color.',
    repeatBefore: 'The same image can be reused: ', repeatAlt: 'Another mountain', repeatCopy: '[repeated landscape]', repeatAfter: ', while each attachment keeps an independent id and copyText.',
    brokenBefore: 'This local image is deliberately invalid ', brokenAlt: 'Image decode failure example', brokenCopy: '[unavailable image]', brokenAfter: '. The surrounding text remains readable, selectable and copyable.',
    latexBefore: 'A formula with only LaTeX ', latexAfter: ' keeps a placeholder. RichFlow does not include a TeX typesetting engine.',
    updateHeading: 'Content version {version}', updateOne: 'This is the first text variant. Select some text, then press “Update content”.', updateTwo: 'This is the second text variant 😀. The flow id stays the same; textVersion changes with the content.',
    updateDetail: 'The event panel must match the current content version. Height is measured again; stale asynchronous results must not overwrite the new document.',
    updateExtra: 'This paragraph was added by a content update. Updating again changes the paragraph count, exercising automatic height and the selection context together.',
    scrollHeading: 'A long flow and its attachment lifecycle',
    scrollParagraph: 'Paragraph {number}. Scroll down and return here. Offscreen attachments may release image references and restore them on re-entry; text and selection offsets stay unchanged.',
    scrollImageAlt: 'Landscape in paragraph {number}', scrollImageCopy: '[landscape {number}]',
  },
};

export type Translation = typeof english;

const chinese: Translation = {
  ui: {
    title: '文字流实验室', languageTarget: 'English', languageLabel: '切换为英语',
    light: '浅色', dark: '深色', switchLight: '切换到浅色主题', switchDark: '切换到深色主题',
    missingTitle: '当前客户端没有 RichFlow 原生模块',
    missingBody: '此示例需要 development build，不能在 Expo Go 中演示原生选择。请从仓库根目录运行 npm run example:ios 或 npm run example:android。',
    controls: '交互与排版', nativeReady: '原生已就绪', nativeRequired: '需要原生构建',
    fontSize: '字号', fontSizeLabel: '字号 {size}', alignment: '对齐', left: '左', center: '中', right: '右', start: '起端', end: '末端',
    selectable: '允许系统选择', justify: '两端对齐', justifyHint: '（左对齐或起端对齐时生效）',
    input: '输入 {format}', sourceLabel: '{format} 源内容',
    editorLanguageNote: '本次运行中，每种语言的草稿分别保留；恢复示例只重置当前语言的内容。',
    apply: '应用内容', restore: '恢复示例', update: '更新内容', remount: '重新挂载',
    parseError: '内容编译失败，请检查输入后重试。',
    flowMeta: '{paragraphs} 段 · {length} UTF-16 · {attachments} 附件', oneFlow: '一个文字流',
    notLoaded: '原生视图尚未加载。下方“查看模型”仍可检查适配器和编译结果。',
    waitingMeasure: '等待原生测量', measuredHeight: '实测高度 {height} pt / dp',
    showModel: '查看模型', hideModel: '收起模型', pasteTitle: '粘贴检查', clear: '清空',
    pasteLabel: '粘贴检查输入框', pasteHint: '在正文中系统复制，再长按这里粘贴。附件应变成 copyText。',
    limits: '同一 flow 内跨段选择 · 不跨独立视图 · 无 TeX 引擎 · Markdown/HTML 为语义子集',
    events: '事件面板', expand: '展开', collapse: '收起', expandEvents: '展开事件面板', collapseEvents: '收起事件面板',
    selection: '选区', noEvents: '长按选择、轻点链接或装饰，观察原生回调。', clearEvents: '清空事件记录',
    linkAction: '链接', decorationAction: '装饰', attachmentAction: '附件', attachmentLongPressAction: '附件长按',
  },
  cases: {
    selection: { title: '跨段选择', hint: '长按正文，拖动选区跨过两个段落；下面会显示 UTF-16 范围和源节点。' },
    styles: { title: '文字排版', hint: '查看嵌套格式、标题、引用、列表与代码，再调整字号、对齐和主题。' },
    decorations: { title: '装饰与点击', hint: '轻点装饰文字查看 actionId；长按后跨行拖动，检查装饰和系统选区共存。' },
    attachments: { title: '内联附件', hint: '选择并复制图片和公式，粘贴到下方输入框，检查 copyText。图源全部内置。' },
    updates: { title: '动态更新', hint: '先选择文字，再更新内容或重新挂载；选区事件应只对应当前 textVersion。' },
    scroll: { title: '长文滚动', hint: '上下滚动再返回，观察重复附件恢复；连续文本仍属于同一个选择范围。' },
    markdown: { title: 'Markdown', hint: '编辑 Markdown，点击应用内容。适配器只负责语义，排版和选择由同一个原生视图完成。' },
    html: { title: 'HTML', hint: '编辑语义 HTML，点击应用内容；不执行脚本、不应用浏览器 CSS。' },
    locales: { title: '当地排版', hint: '查看 CJK 着重与注音、语言换行、RTL 方向及显式不换行空格。正文样本保留所选语言的文字。' },
  },
  typography: {
    choose: '语言与文字',
    chinese: '中文 / 拼音', japanese: '日文 / 假名', zhuyin: '注音符号', korean: '韩文', arabic: '阿拉伯文 / RTL', french: '法文 / 间距', english: '英文 / 断词',
    chineseHint: '中文下方圆点表示着重，拼音按字分配；空心圆和芝麻点用于演示其他支持的标记形状。',
    japaneseHint: '假名按字分配，着重文字上方使用芝麻点。这是横排示例，不是日文竖排。',
    zhuyinHint: '注音符号横向显示在汉字上方；尚未实现传统竖排的侧边注音。',
    koreanHint: 'ko-KR 语言提示交给系统排版韩文。换行由平台决定，没有自定义韩文空隙求解。',
    arabicHint: '此文字流使用 RTL 方向和逻辑起端对齐。可切换起端/末端，并跨拉丁文与数字选择。偏移仍为逻辑 UTF-16；完整双向文字装饰还需真机验证。',
    frenchHint: '源文本在标点与数字间显式使用 U+00A0 和 U+202F 不换行空格。渲染器保留这些字符，不会自动插入法文间距。',
    englishHint: 'en-US 语言提示和 full 断词请求使用平台换行能力。可断位置、是否出现连字符取决于宽度、系统与字体。',
    annotationCopy: '复制只包含基础正文。注音和着重标记是视觉注释，不会增加选区中的文字。',
    annotationLimits: 'Ruby 横向适配基础文字宽度。同侧着重号在内带、ruby 在外带；同种注释重叠不会额外分层，应避免重复同侧 ruby。尚未实现标点压缩、悬挂标点或竖排。',
  },
  body: {
    selectionHeading: '从这一段，选到下一段',
    selectionOne: '这不是多个 Text 拼成的段落。RichFlow 把文字、样式和段落范围放进同一份文本缓冲区，让系统选区自然跨过段落边界。',
    selectionTwo: '试着从上一段的“文字”开始，一直拖到这一段的 emoji 😀。JavaScript 和原生事件都使用 UTF-16，所以这个 emoji 占两个代码单元。',
    selectionBeforeBold: '选择仍然可以经过 ', selectionBold: '粗体文字', selectionBeforeLink: '，也可以穿过 ', selectionLink: '普通链接', selectionAfterLink: '。轻点链接触发动作，长按保留系统选择。',
    selectionBoundary: '这里演示的是同一个 flow 内的选择；两个独立原生视图之间没有全局选区。',
    multilingual: '混合文字：中文 · English · 日本語 · 한국어 · 😀。完整双向排版和装饰仍需平台验收；此例不承诺完整 RTL 支持。',
    stylesHeading: '把语义交给排版', stylesSubheading: '行内样式可以嵌套',
    boldAnd: '粗体与 ', boldItalic: '粗斜体', italic: '斜体', underline: '下划线', strike: '删除线', highlight: '背景高亮', separator: '，', sentenceEnd: '。',
    subPrefix: 'H', superPrefix: 'O 与 x', scriptsEnd: ' 使用上下标，不修改可复制的正文内容。',
    quoteOne: '引用保留自己的缩进与竖线。', quoteTwo: '多段引用也属于同一份连续文本。',
    listOne: '从指定编号开始的列表。', listTwo: '编号是生成内容，源映射会跳过它。', nestedList: '嵌套列表。',
    codeBlock: 'const flow = compileDocument(document);\n// 一个文档，一份连续文字流。',
    decorationHeading: '装饰沿着真实的视觉行绘制', solid: '实线', dashed: '虚线', dotted: '点线', wavy: '波浪线',
    decorationText: '{label} {kind}：这一段故意写得长一些，让装饰经过软换行。轻点文字会把动作交给宿主，长按则进入系统选择。',
    crossDecorationOne: '这条装饰从这个段落开始，穿过段落分隔符。', crossDecorationTwo: '直到这个段落结束，仍然是同一个范围与动作。',
    attachmentHeading: '图片和公式也是文字流的一部分',
    imageBefore: '一张行内插图 ', imageAlt: '山与太阳', imageCopy: '[山与太阳]', imageAfter: ' 的前后仍然可以连续选择。图片保留自身颜色。',
    formulaBefore: '质能关系 ', formulaAfter: ' 由预渲染 SVG 展示，复制时得到公式语义文字。切换主题观察公式前景色。',
    repeatBefore: '相同图源可以重复使用：', repeatAlt: '另一座山', repeatCopy: '[重复的山景]', repeatAfter: '，每个附件仍有独立 id 和 copyText。',
    brokenBefore: '这是故意损坏的本地图源 ', brokenAlt: '加载失败示例', brokenCopy: '[不可用图片]', brokenAfter: '。解码失败后正文仍可阅读、选择和复制。',
    latexBefore: '只有 LaTeX 的公式 ', latexAfter: ' 保留占位符。库不内置 TeX 排版引擎。',
    updateHeading: '内容版本 {version}', updateOne: '这是第一组正文。先选择这段文字，再点击“更新内容”。', updateTwo: '现在换成第二组正文 😀。flow id 保持不变，textVersion 随内容变化。',
    updateDetail: '事件面板中的版本必须与当前正文一致。高度会重新测量；旧内容的异步结果不会覆盖新正文。',
    updateExtra: '这一段由内容更新追加。再次更新会改变段落数量，让自动高度和选择上下文一起接受检查。',
    scrollHeading: '一个 flow 的长文与附件生命周期',
    scrollParagraph: '第 {number} 段。往下滚动后再回到这里。离屏附件可以释放图像引用，重新进入可见区域后恢复；文本和选区使用的偏移保持不变。',
    scrollImageAlt: '第 {number} 段山景', scrollImageCopy: '[山景 {number}]',
  },
};

export const translations: Readonly<Record<Locale, Translation>> = { en: english, 'zh-CN': chinese };

export function resolveLocale(value: unknown): Locale {
  return typeof value === 'string' && /^zh(?:[-_]|$)/i.test(value) ? 'zh-CN' : 'en';
}

/** Device locale is only used for the initial value; switching is session-local. */
export function getInitialLocale(): Locale {
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

export function format(message: string, values: Readonly<Record<string, string | number>>): string {
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}
