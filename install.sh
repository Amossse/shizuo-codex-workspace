#!/bin/sh

set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

usage() {
  cat <<'EOF'
拾作一键安装

用法：
  ./install.sh --core       安装白板、Codex 与 MCP（默认）
  ./install.sh --terminal   额外要求 Python 3，启用交互终端
  ./install.sh --video      安装全部能力，并确保 HyperFrames 或 Remotion 至少一个可用
  ./install.sh --help

安装完成后运行：
  sh "$HOME/.codex/skills/shizuo/scripts/shizuo.sh" health

先在 chrome://extensions 加载拾作并复制扩展 ID，再运行：
  PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh --core
EOF
}

case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  ""|--core|--terminal|--video)
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

[ "$(uname -s)" = "Darwin" ] || {
  printf '%s\n' "拾作 Native Host 当前只支持 macOS。" >&2
  exit 1
}
command -v zsh >/dev/null 2>&1 || {
  printf '%s\n' "找不到 zsh，无法运行 macOS 安装器。" >&2
  exit 1
}

exec zsh "$project_root/native-host/install-macos.sh" "${1:---core}"
