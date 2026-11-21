# Playground captures / 示例实录

## Android screenshots / Android 截图

These are unedited Android screen captures of the repository's native playground,
not browser renderings or design mockups. Both README translations use the same
assets. The native selection toolbar follows the device's Simplified Chinese
system language; the playground UI is in English.

这些图片来自仓库原生示例的 Android 实机截屏，未修改正文或选区效果。中英文 README 共用图片；示例界面为英文，系统选择菜单随设备显示中文。

- Captured: 2026-10-22, from checkout `25c9f94` (`0.1.0-alpha.0`).
- Device: vivo V2509A, Android 16, 1216 × 2640 pixels.
- Appearance: light theme; the development tools button and status-bar icons were temporarily hidden.
- Scope: these images illustrate Android behavior. They do not stand in for iOS screenshots or a cross-device acceptance report.

| Asset | Playground case | Capture action |
| --- | --- | --- |
| `android-selection.png` | Selection | Long-press a word, then drag the native end handle into the next paragraph. |
| `android-decorations.png` | Decorations | Use size 14 and scroll to show all four decoration styles. |
| `android-html.png` | HTML | Keep the bundled English source and scroll to the rendered text. |
| `android-attachments.png` | Attachments | Show the embedded illustration and pre-rendered formula SVG. |
| `android-cjk-pinyin.png` | Local typography → Chinese / Pinyin | Use size 20 and show the complete annotated sample. |
| `android-cjk-furigana.png` | Local typography → Japanese / Furigana | Use size 20 and show the complete annotated sample. |

To refresh, run the [playground](../../example/README.md), navigate to the matching
case, and capture the device with `adb exec-out screencap -p > image.png`.
Keep the real text layout, annotation positions, and native selection handles
intact. Restore any temporary device UI settings after capturing.

## iOS streaming Markdown / iOS 流式 Markdown

The November 21, 2026 captures use the Release build of the offline example. Both languages replay the same sequence of formatting changes.

| Material | Device and interaction |
| --- | --- |
| [中文手势动图](./streaming-markdown-ios.gif) | iPhone 15 Pro simulator, iOS 18.4. A UI test long-presses “观测”, waits for the code block to grow, then taps the system Copy and Paste commands. The GIF holds the final paste result briefly before looping. |
| [SE3 选区](./streaming-markdown-se3-selection.png) | Physical iPhone SE (3rd generation), iOS 27.2. At event 38 the screen shows the native selection handles, bold text and the Python block in progress. |
| [SE3 粘贴结果](./streaming-markdown-se3-paste.png) | Same phone and run. UIKit copied “Group bird sightings” at event 43. The text field shows the pasted value above the finished code block. |

这段动图展示模拟器里的系统长按菜单。两张原始截图来自 SE3，分别记录生成中的原生选区，以及复制后在示例输入框中的粘贴结果。完整测量见[验证记录](../validation.md)。
