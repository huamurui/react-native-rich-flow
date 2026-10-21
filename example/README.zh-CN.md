# RichFlow Playground

[English](./README.md) · 简体中文

这是 RichFlow 原生能力的交互示例。Android 和 iOS 都需要包含本库的 development build；Expo Go 不包含该模块。

从仓库根目录安装和构建，再运行示例：

```bash
npm ci
npm run build
npm run example:ios
# 或 npm run example:android
```

安装过 development build 之后，可以只启动 Metro：

```bash
npm run example:start
```

iOS 需要 Xcode 与 CocoaPods，Android 需要 JDK 17、Android SDK 和设备或模拟器。原生文件变化后重新执行对应 `example:ios` / `example:android`，Fast Refresh 只更新 JavaScript。

## 语言

页头的 **English / 中文** 按钮切换应用界面、无障碍标签、案例说明、展示正文及 Markdown/HTML 默认内容。首次启动通过设备的 `Intl` locale 选择语言：`zh` 系列使用简体中文，其他语言或读取失败时使用 English。切换只影响当前运行，不修改系统语言。

Markdown 和 HTML 的草稿与已应用内容按语言分别保存于内存。切换语言不会丢失另一种语言的编辑；“恢复示例”只重置当前语言、当前格式。重启应用恢复默认案例。混合文字案例包含中文、English、日本語、한국어 和 emoji；完整 RTL / 双向文字行为仍需平台验收。

## 案例和操作

| 案例 | 建议操作 | 检查点 |
| --- | --- | --- |
| 跨段选择 | 从第一段拖动到第二、三段；选中 emoji | 同一个 flow 内跨段选择；回调范围为 UTF-16；源节点映射对应选区 |
| 文字排版 | 调整字号、对齐、主题 | 嵌套格式、标题、引用、列表和代码；正文不被高度裁切 |
| 装饰与点击 | 点四种装饰文字，再长按跨行选择 | `decoration` action 的 id；实线、虚线、点线、波浪线跟随换行 |
| 内联附件 | 选中图片、SVG 公式并系统复制，粘贴到检查框 | U+FFFC 被 `copyText` 替换；普通图片保留颜色，公式随主题变化；失败图源保留可用正文 |
| 动态更新 | 选中文字后更新内容，再重新挂载 | 版本和范围对应新正文；高度随段落数量改变 |
| 长文滚动 | 滚到末尾再返回上方 | 附件恢复；选区仍属于一个 flow，文本没有被分成独立选择视图 |
| 当地排版 | 切换中文/拼音、日文/假名、横排注音、韩文、阿拉伯文/RTL、法文或英文 | 着重与注音不改变复制正文；起端/末端随文字方向变化；语言与断词交给平台 |
| Markdown / HTML | 编辑输入后应用内容 | 格式适配为中立文档，再交给同一个原生组件 |

事件面板位于页面底部，可以展开查看选区文本、源映射、版本和最近的动作。它不覆盖正文。应用只记录链接动作，不自动打开链接；宿主可以在真实应用中决定如何处理。

附件案例完全使用内置的 data URI，不下载第三方图片。公式 SVG 是预渲染资源；仅有 LaTeX 字符串时显示占位符，此库没有内置 TeX 排版引擎。

这里的 HTML/Markdown 是语义子集，不是浏览器。一个 flow 可以跨段落选择，两个独立的原生视图之间不能共享系统选区。模拟器的触摸行为与真机可能不同；发布前应在两端真机重复上表操作。

## 各地文字排版

“当地排版”页包含七种预设。控制与说明跟随界面语言，样本文字保留所选语言。阿拉伯文使用独立 RTL 配置，默认逻辑起端对齐；不会改变其他案例的文字方向。

中文演示下方圆点和逐字拼音；日文演示逐字假名与上方芝麻点；注音符号以横排 ruby 显示在汉字上方，不是传统竖排侧注。Ruby 横向适配基础文字宽度；同侧着重号位于内带、ruby 位于外带。同种注释重叠不会额外分层，应避免重复同侧 ruby。复制只包含基础正文。

韩文换行和英文断词使用系统语言提示。法文样本显式包含 U+00A0 与 U+202F 不换行空格，渲染器不会自动插入。完整双向文字装饰仍需真机验收；尚未实现竖排、标点压缩和悬挂标点。

## 验证示例

从仓库根目录运行：

```bash
npm run typecheck --workspace rich-flow-example
npm test --workspace rich-flow-example
npm run export:ios --workspace rich-flow-example
npm run export:android --workspace rich-flow-example
```

类型检查和 Metro 导出检查 JavaScript 接入，不能代替原生编译和交互验收。`example/ios`、`example/android` 为 Expo 生成目录，不提交到仓库。

示例测试核对中英翻译键和占位参数、设备语言回退、草稿隔离，以及两种语言的全部案例范围、源映射和附件语义复制。
