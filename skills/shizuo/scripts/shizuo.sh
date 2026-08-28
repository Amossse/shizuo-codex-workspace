#!/bin/sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
support_root=${SHIZUO_SUPPORT_ROOT:-"$HOME/Library/Application Support/PageDock"}
configurator="$support_root/configure-bridge.mjs"
installed_mcp="$support_root/shizuo-mcp-server.mjs"
bundled_mcp="$script_dir/shizuo-mcp-server.mjs"
node_bin=$(command -v node || true)
codex_bin=$(command -v codex || true)
action=${1:-status}

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ -n "$node_bin" ] && [ -x "$node_bin" ] || fail "找不到 Node.js"

redact_token() {
  sed -E 's/^(令牌：).*/\1[已写入本地受保护配置]/'
}

require_host() {
  [ -f "$configurator" ] || fail "未安装拾作 Native Host，请先在插件项目运行 ./install.sh"
}

register_mcp() {
  name=$1
  mcp_path=$2
  [ -n "$codex_bin" ] && [ -x "$codex_bin" ] || fail "找不到 Codex CLI"
  if "$codex_bin" mcp get "$name" >/dev/null 2>&1; then
    printf 'Codex MCP 已存在：%s\n' "$name"
    return
  fi
  "$codex_bin" mcp add "$name" -- "$node_bin" "$mcp_path"
}

preferred_mcp() {
  if [ -f "$installed_mcp" ]; then
    printf '%s\n' "$installed_mcp"
  else
    printf '%s\n' "$bundled_mcp"
  fi
}

usage() {
  printf '%s\n' \
    '用法：shizuo.sh {status|health|local|lan-host|lan-client|delete-on|delete-off|disable|help}' \
    '  status      检查当前桥接是否在线' \
    '  health      检查安装、Native Host、MCP 与可选创作依赖' \
    '  local       配置仅本机 MCP' \
    '  lan-host    开启可信内网共享（优先使用画布一次性邀请）'
}

case "$action" in
  status)
    "$node_bin" "$script_dir/bridge-status.mjs"
    ;;
  health)
    "$node_bin" "$script_dir/health-check.mjs"
    ;;
  local)
    require_host
    "$node_bin" "$configurator" --local --deny-delete | redact_token
    register_mcp shizuo "$(preferred_mcp)"
    printf '%s\n' "请重新加载拾作并重启 Codex。"
    ;;
  lan-host)
    require_host
    "$node_bin" "$configurator" --lan --deny-delete | redact_token
    register_mcp shizuo "$installed_mcp"
    printf '%s\n' "请重新加载拾作，并从目标白板生成一次性邀请。"
    ;;
  lan-client)
    [ -n "${SHIZUO_BRIDGE_URL:-}" ] && [ -n "${SHIZUO_BRIDGE_TOKEN:-}" ] || fail "请设置 SHIZUO_BRIDGE_URL 与 SHIZUO_BRIDGE_TOKEN"
    [ -n "$codex_bin" ] && [ -x "$codex_bin" ] || fail "找不到 Codex CLI"
    if "$codex_bin" mcp get shizuo-lan >/dev/null 2>&1; then
      [ "${SHIZUO_REPLACE:-0}" = "1" ] || fail "shizuo-lan 已存在；如需替换，请显式设置 SHIZUO_REPLACE=1"
      "$codex_bin" mcp remove shizuo-lan
    fi
    "$codex_bin" mcp add shizuo-lan \
      --env "SHIZUO_BRIDGE_URL=$SHIZUO_BRIDGE_URL" \
      --env "SHIZUO_BRIDGE_TOKEN=$SHIZUO_BRIDGE_TOKEN" \
      -- "$node_bin" "$bundled_mcp"
    printf '%s\n' "内网 MCP 已配置；请重启 Codex 后验证 shizuo_* 工具。"
    ;;
  delete-on)
    require_host
    "$node_bin" "$configurator" --allow-delete | redact_token
    printf '%s\n' "删除权限已开启；请重新加载拾作。"
    ;;
  delete-off)
    require_host
    "$node_bin" "$configurator" --deny-delete | redact_token
    printf '%s\n' "删除权限已关闭；请重新加载拾作。"
    ;;
  disable)
    require_host
    "$node_bin" "$configurator" --disable | redact_token
    printf '%s\n' "外部桥接已停用；请重新加载拾作。"
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
