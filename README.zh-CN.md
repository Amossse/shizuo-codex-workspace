# 拾作 · Shizuo

> **Codex 的本地优先视觉工作区。** 收集网页上下文，在无限画布上整理关系，让本地 Agent 执行任务并留下可见、可追溯的结果。

[English](README.md) · [下载最新版本](https://github.com/Amossse/shizuo-codex-workspace/releases/latest) · [快速开始](#快速开始) · [隐私](PRIVACY.md)

![拾作画布：素材、任务和结果保持连线](docs/product-canvas-real.jpg)

## 为什么是拾作

当素材、提示词、执行过程和结果散落在不同窗口时，AI 工作很难继续和复用。拾作把它们留在一起：

- **收集**选中文字、网页、图片、链接和本地文件，并保留来源。
- **组织**画布中的卡片和关系，支持搜索与版本历史。
- **执行**选中的上下文，让本地 Codex 在素材旁显示实时状态和结果。
- **沉淀**回答、图片、知识卡和可复用工作流，随时继续。

所有画布数据默认保存在浏览器本地；只有你主动执行任务时，内容才会交给本地 AI CLI。

## 快速开始

### 1. 安装扩展

1. 下载并解压[最新发布包](https://github.com/Amossse/shizuo-codex-workspace/releases/latest)。
2. 打开 `chrome://extensions` 或 `edge://extensions`，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择解压目录，并固定拾作。

现在就可以收集和整理内容，不依赖 Codex。

### 2. 放入第一条内容

打开新标签页，粘贴一段文字、链接或图片，然后点击“开始整理”。拾作会把内容放进白板并提示下一步。

![拾作首次使用页面](docs/product-home-real.jpg)

### 3. 连接本地 Codex（可选）

安装并登录 [Codex CLI](https://developers.openai.com/codex/cli)，然后在解压后的拾作目录运行一次：

```sh
./install.sh --core
```

回到 `chrome://extensions` 重新加载拾作。安装器会自动识别扩展 ID、注册本地 Native Host 和 MCP，并验证桥接。识别失败时查看[连接本地 Codex](docs/local-codex-setup.zh-CN.md)。

## 日常使用

| 想做什么 | 从哪里开始 |
| --- | --- |
| 保存页面或选区 | 扩展按钮或选区菜单 |
| 打开画布 | 新标签页或“打开拾作” |
| 让 Codex 处理素材 | 选中卡片后点击“交给 AI” |
| 在当前网页提问 | 选中文字后点击“问问 Codex” |
| 找回以前内容 | 在首页搜索白板、卡片和来源 |

## 开发

项目没有构建步骤。把仓库加载为未打包扩展，修改代码后在 `chrome://extensions` 重新加载即可。

```sh
npm test
```

运行时代码位于 `app/`，受限的本地桥接位于 `native-host/`。更多信息见[架构](docs/architecture.md)、[能力说明](docs/capabilities.md)与[贡献指南](CONTRIBUTING.md)。

## License

[MIT](LICENSE) © 拾作 Contributors
