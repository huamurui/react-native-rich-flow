# RichFlow

[English](./README.md)

React Native 原生连续富文本组件：用一份文字缓冲区承载段落、样式、装饰和行内附件，让系统选区可以跨越段落。

RichFlow 面向阅读器和内容渲染器的底层能力。应用提供中立文档或编译后的 flow，再自行处理链接、菜单和业务动作。仓库也提供 Markdown / HTML 适配器，它们输出同一份文档模型。

**0.1.0-alpha.0 是原生渲染器的早期预览版。** 0.0.1 只有数据模型和选区工具，不包含下文的原生组件。此 alpha 用于接入试用，稳定版前 API 与平台行为仍可能调整。仓库不会自动发布 npm。

## 运行完整示例

```bash
git clone https://github.com/huamurui/react-native-rich-flow.git
cd react-native-rich-flow
npm ci
npm run check
npm run example:android
# macOS 也可以运行：
npm run example:ios
```

`npm ci` 会安装整个 npm workspace，并通过 `prepare` 构建库。原生运行命令会生成并构建示例 App；安装过 development build 后，可用 `npm run example:start` 单独启动 Metro。Android 需要 JDK 17、Android SDK 和设备或模拟器；iOS 需要 macOS、Xcode 和 CocoaPods。

**Expo Go 不能加载本库。** 需要包含 RichFlow 原生模块的[开发构建](https://docs.expo.dev/develop/development-builds/introduction/)。Web 和缺少模块的客户端只显示 `fallback` 或安装提示，不提供等价的浏览器渲染器。

示例有九个入口：跨段选择、文字排版、装饰与点击、内联附件、动态更新、长文滚动、Markdown、HTML、当地排版。支持中英界面和正文切换；可以调整字号、对齐、主题和选择开关，查看 UTF-16 选区、源节点映射与动作事件，并把系统复制的内容粘贴到检查框。图片与预渲染公式 SVG 均为内置 data URL。操作清单见[示例指南](./example/README.zh-CN.md)。

## 已实现的能力

下表描述代码能力，不代表已经完成所有设备的交互验收。平台细节见[原生行为与边界](./docs/native-behavior.md)。

| 能力 | Android | iOS | 范围 |
| --- | --- | --- | --- |
| 连续文本、跨段落系统选择 | TextView / Spannable | UITextView / TextKit | 限于同一个 flow |
| 粗体、斜体、下划线、删除线、高亮、上下标、代码、链接 | 已实现 | 已实现 | 语义样式，不支持任意 CSS |
| 标题、引用、列表、代码块、段落间距 | 已实现 | 已实现 | 共享一个文字布局 |
| 实线、虚线、点线、波浪线装饰 | 已实现 | 已实现 | 复杂双向文字仍需平台测试 |
| 行内图片与公式图片 | 已实现 | 已实现 | 每个附件占一个 U+FFFC |
| 语义复制、源节点映射 | 原生复制 + JS 映射 | 原生复制 + JS 映射 | UTF-16 语义偏移 |
| 异步附件加载与高度更新 | 已实现 | 已实现 | 首次加载后可能重新布局 |
| Markdown / HTML 输入 | 共享适配器 | 共享适配器 | 常用语义子集 |

以下为仓库示例在 Android 16（vivo V2509A）上的浅色主题实机截图，点击可查看原图。[截图说明](./docs/images/README.md)。

| 跨段落选择 | 随文字换行的装饰线 |
| --- | --- |
| <a href="./docs/images/android-selection.png"><img src="./docs/images/android-selection.png" width="320" alt="同一个文字流内，原生选区可以跨越段落。"></a> | <a href="./docs/images/android-decorations.png"><img src="./docs/images/android-decorations.png" width="320" alt="实线、虚线、点线和波浪线跟随文字换行。"></a> |
| 同一个文字流内，原生选区可以跨越段落。 | 实线、虚线、点线和波浪线跟随文字换行。 |

## 接入自己的应用

开发基线为 Expo SDK 55、Expo Modules Core 55、React 19.2 和 React Native 0.83.10。peer 版本范围不等于所有版本都经过验证。Node.js 版本以包的 `engines` 为准。

已有的裸 React Native 工程需要先按对应 RN / Expo 版本[安装并配置 Expo Modules](https://docs.expo.dev/bare/installing-expo-modules/)。安装时使用 `npm install react-native-rich-flow@0.1.0-alpha.0`，或用 `react-native-rich-flow@alpha` 跟随 alpha 渠道。测试本地改动时可以使用压缩包：

```bash
# 在库仓库中：
npm pack

# 在已经配置 Expo Modules 的同级应用中：
npm install ../react-native-rich-flow/react-native-rich-flow-0.1.0-alpha.0.tgz
npx expo run:android
# 或 npx expo run:ios
```

包内包含双端原生源码和 Expo 自动链接配置。安装或修改原生代码后需要重新构建 App；Fast Refresh 无法向旧安装包添加原生模块。

## 最小示例：文档 → 编译 → 原生视图

```tsx
import { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { compileDocument, type RichFlowDocument } from 'react-native-rich-flow';
import { RichFlow } from 'react-native-rich-flow/native';

const typography = { fontSize: 17, lineHeight: 28, paragraphSpacing: 12 };
const document: RichFlowDocument = {
  id: 'article',
  blocks: [
    {
      id: 'p1', type: 'paragraph',
      children: [
        { id: 't1', type: 'text', text: '从这一段开始选择，' },
        {
          id: 'bold', type: 'strong',
          children: [{ id: 't2', type: 'text', text: '拖到下一段。' }],
        },
      ],
    },
    {
      id: 'p2', type: 'paragraph',
      children: [{ id: 't3', type: 'text', text: '同一个选区也可以包含 emoji 😀。' }],
    },
  ],
};

export default function Reader() {
  const [selectedText, setSelectedText] = useState('');
  const flow = useMemo(() => compileDocument(document, typography), []);
  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <RichFlow
        flow={flow}
        config={typography}
        selectable
        onSelectionChange={(event) => setSelectedText(event.text)}
      />
      <Text>选中文字：{selectedText || '长按上方正文开始选择'}</Text>
    </ScrollView>
  );
}
```

每个文档节点都需要唯一且非空的 `id`。文档与 flow 按不可变数据处理。编译器默认根据内容生成 `textVersion`；如果自行传入版本，内容变化时必须更新。

调整字号、行高或段距时，**同时重新编译文档并更新 `RichFlow.config`**。编译后的段落包含明确指标，只改原生配置会使标题、段落与正文指标不一致。

组件自动测量可用宽度和正文高度，需要放在具有确定可用宽度的容器中。空 flow 的正文高度为零。组件不内部滚动，示例由外层 `ScrollView` 承担滚动。

## Markdown / HTML

```ts
import { compileDocument } from 'react-native-rich-flow';
import { parseHtml, parseMarkdown } from 'react-native-rich-flow/adapters';

const options = { fontSize: 17, lineHeight: 28, paragraphSpacing: 12 };
const markdownFlow = compileDocument(
  parseMarkdown('# 标题\n\n第一段。\n\n**第二段。**', { id: 'md' }),
  options,
);
const htmlFlow = compileDocument(
  parseHtml('<p>阅读<a href="/guide">使用指南</a>。</p>', {
    id: 'html', baseUrl: 'https://example.com',
  }),
  options,
);
```

结果都交给 `<RichFlow flow={...} config={options} />`。适配器保留常见文字样式、段落、标题、列表、引用、代码、链接与图片。表格降级为文本行，不提供表格网格布局；HTML 的 `data-latex` 可表达公式，但视觉公式仍需预渲染图源。Markdown 数学语法不会自动变成排版公式。

适配器丢弃脚本、样式、表单、嵌入文档和内联 SVG / MathML 等不支持的活动节点，筛选链接与图片协议，并支持通过 `baseUrl` 解析相对地址。它不执行 HTML、不实现 CSS，也不是供浏览器使用的 HTML 清洗器。链接点击只产生事件，跳转由宿主决定。

| HTML → 原生文字 | 行内图片与公式 |
| --- | --- |
| <a href="./docs/images/android-html.png"><img src="./docs/images/android-html.png" width="320" alt="HTML 语义映射为原生标题、强调、高亮和上下标。"></a> | <a href="./docs/images/android-attachments.png"><img src="./docs/images/android-attachments.png" width="320" alt="图片和预渲染公式 SVG 作为行内附件，与正文共同排版。"></a> |
| HTML 语义映射为原生标题、强调、高亮和上下标。 | 图片和预渲染公式 SVG 作为行内附件，与正文共同排版。 |

## 入口与事件

| 导入路径 | 导出 |
| --- | --- |
| `react-native-rich-flow` | `compileDocument`、文档/flow 类型、`isValidTextRange`、`getRichTextSelectionText`、`mapRichTextSelection` |
| `react-native-rich-flow/native` | `RichFlow`、`isRichFlowAvailable`、组件/配置/事件类型 |
| `react-native-rich-flow/adapters` | `parseMarkdown`、`parseHtml`、`ParseOptions` |

根入口不导入 React Native 或解析器；原生入口需要 React Native 与 Expo Modules，解析器依赖由适配器入口使用。包提供 ESM、CommonJS 与 TypeScript 声明。

`RichFlow` 接收 `flow`、`config`、`selectable`、`suppressDoubleTapSelection`、`fallback`、普通 `ViewProps` 和以下回调：

- `onSelectionChange`：包含 flow 身份、UTF-16 `start/end`、语义 `text` 和源节点 `mapping`。清空选区时为 `-1/-1`、空文本、`null` 映射。
- `onAction`：包含 `kind`（`link`、`decoration`、`attachment`、`attachmentLongPress`）、`id`、范围、flow 身份与可选 URL。
- `onHeightChange`：正文高度，单位与 React Native 布局单位一致。

配置支持字号、最小行高、段距、正文/次要文字/链接颜色、两端对齐，以及 `left/center/right/start/end` 对齐；还可指定 BCP 47 `language`、`writingDirection: auto/ltr/rtl` 和 `hyphenation: none/normal/full`。自定义装饰范围与动作由 flow 的 `decorations` 数组表达。

## 着重号与注音

`textEmphasis` 用于逐字着重号，区别于斜体样式 `emphasis`；可选 `dot/circle/sesame`（圆点、空心圈、芝麻点），位置 `over/under`，默认在下方。`ruby` 保存调用方提供的 `annotation` 读音，默认在上方，可表达拼音、振假名和横排注音符号：

```ts
const annotated = compileDocument({
  id: 'reading',
  blocks: [{ id: 'p', type: 'paragraph', children: [{
    id: 'dots', type: 'textEmphasis', mark: 'dot', position: 'under',
    children: [{
      id: 'reading-han', type: 'ruby', annotation: 'hàn',
      children: [{ id: 'han', type: 'text', text: '汉' }],
    }],
  }] }],
});
// annotated.text 是“汉”，复制不会混入 hàn。
```

HTML `<ruby>漢<rt>かん</rt>字<rt>じ</rt></ruby>` 使用同一模型，`rt/rp` 不进入正文或复制结果。`data-ruby-position="under"` 控制注音位置，`data-text-emphasis="sesame" data-emphasis-position="over"` 表达上方芝麻点。

编译后的标注独立保存在 `flow.annotations`，双端原生排版预留上下空间。读音压缩在对应正文宽度内；建议按单字或读音单位建 ruby 节点。整组跨行时，只按正文字素数量比例分配读音，不推断语言学对应关系。暂不支持竖排、传统注音侧排、多层同侧 ruby，也不自动生成读音。

示例提供中英界面和正文切换，并有中文、日文、横排注音、韩文、阿拉伯文、法文和英文的排版预设。语言、方向和断词按 flow 配置；法文不换行空格来自源文，系统换行和字形处理以平台结果为准。

| 中文：拼音与着重号 | 日文：振假名与傍点 |
| --- | --- |
| <a href="./docs/images/android-cjk-pinyin.png"><img src="./docs/images/android-cjk-pinyin.png" width="320" alt="逐字拼音位于上方，圆点、空心圈和芝麻点位于下方。"></a> | <a href="./docs/images/android-cjk-furigana.png"><img src="./docs/images/android-cjk-furigana.png" width="320" alt="横排振假名与上方芝麻点着重号。"></a> |
| 逐字拼音位于上方，圆点、空心圈和芝麻点位于下方。 | 横排振假名与上方芝麻点着重号。 |

`isValidTextRange` 验证非空半开 UTF-16 范围，拒绝非法数值及拆开的代理对；它不承诺完整字素簇边界。`getRichTextSelectionText` 用附件的 `copyText` 替换选中的 U+FFFC，不改变原文偏移。`mapRichTextSelection` 返回源节点端点，生成的段落分隔符和列表编号不占真实源偏移。这里的源位置是解码后的语义节点位置，**不是原始 Markdown / HTML 字符串偏移**。

公式附件的 `latex` 保存语义；想显示公式，需提供预渲染图片 URL 或 data URL。库不包含 TeX 引擎。

本 alpha 仅对高亮背景和链接文字应用 span 的 `color`；`strong` 等其他样式上的颜色会被忽略。

## 当前边界

不支持跨独立原生视图选择、任意内嵌 React 组件、编辑器、浏览器 CSS、完整表格布局和 TeX 排版。连续文字流没有做文本虚拟化。长文性能、无障碍、复杂双向文字及选区拖柄应在应用支持的设备上验证；模型测试和原生编译不能替代这些交互检查。

## 开发与验证

```bash
npm ci
npm run check
npm run check:package
npm run test:native:ios        # macOS + Xcode，Foundation 模型检查
npm run test:native:ios-layout # TextKit 布局检查，需已启动的 iOS 模拟器
npm run example:prebuild      # 生成示例原生工程
npm run test:native:android    # 在生成的 Android 工程中运行 JVM 测试
npm run test:native:android-layout # 真实位图回归，需连接 Android 设备或模拟器
```

命令均在仓库根目录执行。仓库使用 npm workspaces 和一份 `package-lock.json`，不要在 `example/` 独立安装一套依赖。`example/android`、`example/ios` 和构建产物不提交。更多说明见[示例指南](./example/README.md)、[原生行为](./docs/native-behavior.md)、[变更记录](./CHANGELOG.md)与[发布说明](./PUBLISHING.md)。

本次本地检查结果与待完成的设备验收见[验证记录](./docs/validation.md)。

## 来源与许可

RichFlow 从 [zhihu-minus-minus](https://github.com/huamurui/zhihu-minus-minus) 的连续富文本实现中提取并通用化，移除了应用路由、认证及业务动作。来源记录见 [NOTICE](./NOTICE)。本库采用 [MIT 许可](./LICENSE)，Copyright (c) 2026 huamurui；依赖保留各自许可证。
