# 发布 RichFlow

包名为 `react-native-rich-flow`，仓库为 [huamurui/react-native-rich-flow](https://github.com/huamurui/react-native-rich-flow)。当前发布目标是 **0.1.0-alpha.0**；0.0.1 的模型/选区工具与本版原生组件能力不同。采用 MIT 许可，版权署名见 `LICENSE`。

本文件提供手动发布步骤。构建、检查、提交 Git 或推送 GitHub 都不会自动发布 npm。

## 准备发布内容

在仓库根目录执行：

```bash
cd react-native-rich-flow
npm ci
npm run check
npm run check:package
npm pack --dry-run
```

检查打包清单中有 ESM / CommonJS 代码、TypeScript 声明、Android / iOS 原生源码、`expo-module.config.json`、README、CHANGELOG、NOTICE 和 LICENSE；不应包含 `node_modules`、示例 App 的生成工程、构建缓存或本地凭据。以命令实际结果为准。

`npm ci` 使用根 `package-lock.json` 安装库与示例 workspace，并通过 `prepare` 构建库。发布前运行双端示例并按 `example/README.md` 检查选择、复制、装饰、附件、内容替换和高度更新。平台构建或交互存在未验证项时，应在发布说明中写明，不能把模型测试当成设备验收。

发布前先通过 `npm view react-native-rich-flow versions --json --registry=https://registry.npmjs.org/` 确认目标版本尚不存在。发布成功后，同一个版本不能再上传不同内容；后续更改需要新版本。更新版本时同步根包、示例包和根锁文件，并维护 CHANGELOG；原生 Gradle / podspec 从根 `package.json` 读取版本。示例 `app.json` 的平台应用版本保持数字形式 `0.1.0`，与 npm 预发布标识分开。后续预发布可以递增为 `0.1.0-alpha.1`、`0.1.0-alpha.2`。

## 账号与 2FA

先确认 npm 邮箱已验证，再在 npm 网站的头像 → **Account → Two-Factor Authentication → Enable 2FA** 开启双重验证，按提示配置验证方式并保存恢复码。登录成功不代表已开启 2FA；反复执行 `npm login` 不会自动满足发布验证。[npm 官方设置说明](https://docs.npmjs.com/configuring-two-factor-authentication/)

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

确认输出是自己的 npm 用户名后，在确定要公开发布时执行：

```bash
npm publish --tag alpha --access public --registry=https://registry.npmjs.org/
```

按提示完成浏览器中的身份验证。`prepublishOnly` 会运行完整 JS / TS 检查，`prepack` 会构建分发代码；任一步失败都应先修复。当前 `publishConfig.tag` 为 `alpha`，命令中也显式指定 `--tag alpha`，以免把预发布设为默认安装版本。版本后缀和 dist-tag 是两回事；普通发布默认使用 `latest`，详见 [npm dist-tags 文档](https://docs.npmjs.com/adding-dist-tags-to-packages/)。正式版发布时再调整版本与标签。

## 确认发布结果

```bash
npm view react-native-rich-flow@0.1.0-alpha.0 version license repository.url --registry=https://registry.npmjs.org/
npm view react-native-rich-flow dist-tags --registry=https://registry.npmjs.org/
```

确认版本、MIT 许可、仓库地址和 `alpha` 标签符合预期，且 `latest` 未被本次预发布移动，再在干净的宿主应用中安装已发布包并重新构建原生 App。npm 包内不含完整示例开发环境；贡献和重建请使用 GitHub 仓库。
