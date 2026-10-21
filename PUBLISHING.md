# 发布 0.0.1

包名：`react-native-rich-flow`。本次发布只包含文字流模型与选区工具，不包含原生视图。版本固定为 `0.0.1`，按普通版本发布到 `latest`，不用 `next` 标签。

以下命令在独立包目录执行，不要在知乎应用的根目录执行：

```bash
cd react-native-rich-flow
npm ci
npm run check
npm pack --dry-run
```

核对打包清单中的 ESM/CommonJS 运行时代码、TypeScript 声明、`package.json`、README、CHANGELOG 和 LICENSE；以命令实际列出的文件为准。确认版本为 `0.0.1`，并检查 README 如实描述当前功能。本独立库采用 MIT 许可。

先在 npm 官网注册、验证邮箱并开启账号 2FA，然后登录：

```bash
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

确认输出为自己的 npm 用户名后，执行发布并按提示完成验证：

```bash
npm publish --access public --registry=https://registry.npmjs.org/
```

发布过程中会通过 `prepublishOnly` 再次运行检查，并通过 `prepack` 构建产物。若检查失败，先修复问题再发布。

发布后确认：

```bash
npm view react-native-rich-flow@0.0.1 version --registry=https://registry.npmjs.org/
npm view react-native-rich-flow dist-tags --registry=https://registry.npmjs.org/
```

应看到版本 `0.0.1` 和 `latest: '0.0.1'`。用户之后可以通过 `npm install react-native-rich-flow` 安装。

本次目录准备和本地验证不会登录 npm，也不会自动发布。包名是否可用以实际发布时 npm 的检查为准；如果遇到名称冲突，先处理名称，不要重复尝试上传。
