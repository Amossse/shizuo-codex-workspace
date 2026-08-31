# 连接本地 Codex

拾作的收集和画布默认离线可用。只有执行 AI 任务时，才需要连接本机已登录的 Codex CLI。

## 一次配置

1. 先在 `chrome://extensions` 加载解压后的拾作文件夹。
2. 在同一个文件夹打开终端，运行：

```sh
./install.sh --core
```

3. 回到 `chrome://extensions`，重新加载拾作。
4. 打开拾作并点击“交给 AI”；绿色的本地连接状态表示准备完成。

安装器会按当前文件夹自动识别扩展 ID、注册本地 Native Messaging Host 和 MCP，并验证桥接。它不会把 Codex 凭据交给扩展。

若浏览器里加载了多份拾作，或自动识别失败，复制目标扩展 ID 后运行：

```sh
PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --core
```

## 健康检查

```sh
sh "$HOME/.codex/skills/shizuo/scripts/shizuo.sh" health
```

如果 Native Host 已就绪但 Codex CLI 不可用，请在终端运行 `codex` 并完成登录，然后回到拾作检查连接。

## 可选安装档位

```sh
./install.sh --core
./install.sh --terminal
./install.sh --video
```

`core` 是日常任务所需的最小配置，terminal 和 video 属于可选能力。

[English](local-codex-setup.md)
