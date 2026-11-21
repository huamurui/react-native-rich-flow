# 发布 RichFlow

包名为 `react-native-rich-flow`，仓库为 [huamurui/react-native-rich-flow](https://github.com/huamurui/react-native-rich-flow)。已发布的首个原生预览版是 **0.1.0-alpha.0**；0.0.1 的模型/选区工具与本版原生组件能力不同。采用 MIT 许可，版权署名见 `LICENSE`。

## GitHub Actions 发布预览版

在 GitHub Actions 中打开 **Prepare npm alpha**，选择 `main` 后手动运行。默认只执行检查，并把通过干净安装验证的同一份 `richflow.tgz` 上传为该次运行的 artifact。运行摘要给出 SHA-512，可用于核对下载的包。普通 push、PR 或创建 Git tag 都不会触发发布工作流。

首次使用暂存功能时，由 npm 包维护者在 **react-native-rich-flow → Settings → Trusted Publishers** 添加 GitHub Actions，填写用户 `huamurui`、仓库 `react-native-rich-flow`、工作流文件名 `publish.yml`、环境 `npm-alpha`。仅授权暂存，关闭直接发布和管理 dist-tag 的权限。在 GitHub 将 `npm-alpha` 环境的部署分支限制为 `main`。流水线使用 GitHub 托管 runner 与 OIDC，不需要保存 npm token。[npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

准备提交候选版时：

1. 在版本 PR 里同步更新根包、示例包、锁文件版本和 CHANGELOG。等合入 `main` 的该提交通过 **Checks**，将 `v<包版本>` 标签指向这一提交并推送。预览版沿用 `X.Y.Z-alpha.N` 格式。
2. 在同一 `main` 提交上运行 **Prepare npm alpha** 并勾选暂存。工作流检查版本、标签和该提交的 CI 状态，随后核对 tarball 摘要，用 `npm stage publish --tag alpha` 向 npm 暂存。只有这一 job 拥有 OIDC 权限，且不会签出源码或执行包内的脚本。
3. 在 npm 的 **Staged Packages** 查看候选版本、仓库来源和 `alpha` 标签。维护者核对后用 2FA 批准才会上线，也可拒绝该候选。已有版本不能覆盖。发布作业使用 Node 24.22.3 或同一主版本的后续补丁，暂存命令要求 npm 11.15.0 或以上。[npm 暂存与批准](https://docs.npmjs.com/staged-publishing/)

以下命令也可由维护者在本地检查或手动发布。

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
