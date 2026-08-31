# 拾作 · Shizuo

> **The visual workspace for Codex.** Capture context, think on an infinite canvas, and let local agents act with visible, traceable results.

把网页、选区、图片和本地文件放进同一块画布。拾作帮助你看清关系，再让本地 Codex 在原始素材旁完成任务并留下结果。

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License MIT](https://img.shields.io/badge/License-MIT-green)
![Chrome and Edge](https://img.shields.io/badge/Chrome%20%7C%20Edge-supported-brightgreen)
![No telemetry](https://img.shields.io/badge/telemetry-none-success)

[下载最新版本](https://github.com/Amossse/shizuo-codex-workspace/releases/latest) · [快速开始](#快速开始) · [隐私](PRIVACY.md) · [贡献](CONTRIBUTING.md)

![拾作画布：素材、任务和结果保持连线](docs/product-canvas-real.jpg)

## 你可以用它做什么

- **收集**：保存网页、选中文字、图片、链接和本地文件，并保留来源。
- **组织**：在无限画布上摆放卡片、建立连接、搜索和回溯历史。
- **执行**：把选中的上下文交给本地 Codex，看到状态、过程和结果。
- **复用**：把结论、图片、知识卡和工作流留在素材旁边，随时继续。

所有画布数据默认保存在本机；只有你点击执行时，内容才会通过本地 CLI 交给已登录的 AI。

## 快速开始

### 1. 安装扩展

1. 下载并解压 [最新发布包](https://github.com/Amossse/shizuo-codex-workspace/releases/latest)。
2. 打开 chrome://extensions 或 edge://extensions，开启开发者模式。
3. 点击 Load unpacked，选择解压后的文件夹，再固定拾作。

现在就可以收集网页内容、创建白板、组织素材、搜索和导出；这些能力不依赖 Codex。

### 2. 放入第一条内容

打开一个新标签页，粘贴一段文字、链接或图片，然后点击 **开始整理**。拾作会把内容放入白板，并提示下一步。

![拾作首页：从一条内容开始](docs/product-home-real.jpg)

### 3. 可选：连接本地 Codex

第一次点击 **交给 AI** 时，拾作会检测连接状态并给出一步一步的引导。连接完成后会自动继续原任务，无需重新输入。

若希望提前配置，查看 [连接本地 Codex](docs/local-codex-setup.md)。

## 日常使用

| 想做什么 | 从哪里开始 |
| --- | --- |
| 收集当前页面 | 点击扩展图标，或右键选中文字、图片、链接 |
| 打开画布 | 新标签页，或点击扩展图标中的打开拾作 |
| 让 AI 处理素材 | 圈选卡片后点击交给 AI |
| 在网页直接提问 | 选中文字后使用问问 Codex，或打开右下角入口 |
| 找回以前内容 | 在首页搜索白板、卡片和来源 |

## 工程结构

    manifest.json       Chrome 扩展入口
    app/
      core/             数据库、领域模型和卡片协议
      content/          网页采集与页面助手
      background/       Service Worker、桥接和调度
      pages/            白板、弹窗、侧栏、编辑器和离屏页面
      styles/           全局设计令牌与主题
    native-host/        受限的本地 Codex / MCP / PTY 桥接
    docs/               使用、排障与架构文档
    scripts/            验证与发布脚本
    vendor/             固定版本的前端依赖

没有构建步骤：加载目录后即可开发。

## 文档

- [连接本地 Codex](docs/local-codex-setup.md)：安装、登录与常见连接问题
- [能力说明](docs/capabilities.md)：画布、工作流、协作和实验能力
- [架构](docs/architecture.md)：运行边界、数据与本地桥接
- [隐私与权限](PRIVACY.md)
- [安全策略](SECURITY.md)
- [贡献指南](CONTRIBUTING.md)

## 开发

加载扩展后，修改代码并在 chrome://extensions 点击重新加载。提交前运行：

    npm test

欢迎提交 Issue 和 PR。安全问题请按 [安全策略](SECURITY.md) 私下报告。

## License

[MIT](LICENSE) © 拾作 Contributors
