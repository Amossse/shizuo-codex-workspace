# 连接本地 Codex

拾作的收集和画布默认离线可用。只有执行 AI 任务时，才需要连接本机已登录的 Codex CLI。

## 一次配置

1. 先在 chrome://extensions 加载拾作，并复制它显示的扩展 ID。
2. 在解压后的拾作目录打开终端，运行：

    PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --core

3. 回到 chrome://extensions，点击拾作的重新加载。
4. 打开拾作，点击交给 AI；绿色的本地已连接表示准备完成。

安装器只注册本机 Native Messaging Host 和本机 MCP，不会把 Codex 凭据交给扩展。

## 如果任务提示未连接

不要先重试任务。打开任务前置的连接引导，或者重新执行上面的安装命令，再重新加载扩展。原来的任务内容会被保留，连接成功后可以直接继续。

## 健康检查

    sh "$HOME/.codex/skills/shizuo/scripts/shizuo.sh" health

如果 Native Host 已就绪但 Codex CLI 不可用，请在终端运行 codex 并按提示完成登录，然后回到拾作点击检查连接。

## 可选安装档位

    PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --core
    PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --terminal
    PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --video

core 是日常任务所需的最小配置。terminal 和 video 属于可选能力。
