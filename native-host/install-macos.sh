#!/bin/zsh

set -euo pipefail

script_dir="${0:A:h}"
profile="${1:---core}"
if [[ "$profile" == "--help" || "$profile" == "-h" ]]; then
  print "用法：install-macos.sh {--core|--terminal|--video}"
  exit 0
fi
if [[ "$profile" != "--core" && "$profile" != "--terminal" && "$profile" != "--video" ]]; then
  print -u2 "未知安装档位：$profile"
  exit 1
fi
extension_id="${PAGEDOCK_EXTENSION_ID:-}"
install_root="${PAGEDOCK_INSTALL_DIR:-$HOME/Library/Application Support/PageDock}"
host_manifest_dir="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
host_name="com.pagedock.codex"
host_script="$install_root/pagedock-codex-host.mjs"
bridge_configurator="$install_root/configure-bridge.mjs"
mcp_server="$install_root/shizuo-mcp-server.mjs"
bridge_config="$install_root/codex-bridge.json"
install_profile="$install_root/install-profile"
skill_source="$script_dir/../skills/shizuo"
skill_install_root="${SHIZUO_SKILL_DIR:-$HOME/.codex/skills/shizuo}"
pty_helper="$install_root/pagedock-pty.py"
host_launcher="$install_root/pagedock-codex-host"
hyperframes_python_launcher="$install_root/pagedock-hyperframes-python"
python_compat_dir="$install_root/python-compat"
workspace_dir="$install_root/codex-workspace"
coding_workspace_dir="${PAGEDOCK_CODING_WORKSPACE:-}"
manifest_path="$host_manifest_dir/$host_name.json"
allowed_origin="chrome-extension://$extension_id/"
node_bin="$(command -v node || true)"
codex_bin="$(command -v codex || true)"
agy_bin="$(command -v agy || true)"
hyperframes_bin="$(command -v hyperframes || true)"
npm_bin="$(command -v npm || true)"
remotion_runtime="$install_root/remotion-runtime"
bundled_remotion_bin="$remotion_runtime/node_modules/.bin/remotion"
remotion_bin="${PAGEDOCK_REMOTION_BIN:-$(command -v remotion || true)}"
if [[ -z "$remotion_bin" && -x "$bundled_remotion_bin" ]]; then
  remotion_bin="$bundled_remotion_bin"
fi
ffmpeg_bin="$(command -v ffmpeg || true)"
terminal_shell="${PAGEDOCK_TERMINAL_SHELL:-/bin/zsh}"
python_bin="${PAGEDOCK_PYTHON_BIN:-$(command -v python3 || true)}"
hyperframes_browser_path="${HYPERFRAMES_BROWSER_PATH:-}"

# 编码任务默认只授权常见的 ~/code 根目录；没有该目录时继续使用隔离工作区，避免默认开放整个 HOME。
if [[ -z "$coding_workspace_dir" ]]; then
  if [[ -d "$HOME/code" ]]; then
    coding_workspace_dir="$HOME/code"
  else
    coding_workspace_dir="$workspace_dir"
  fi
fi

# Chrome Native Messaging 只允许明确列出的扩展来源。开发者模式的扩展 ID 由 Chrome 分配，
# 因此必须先加载扩展，再把当前 ID 传给安装器；这样不会改变用户已经保存的本地白板数据。
if [[ -z "$extension_id" ]]; then
  print -u2 "请先在 chrome://extensions 加载拾作，复制其扩展 ID，再运行："
  print -u2 "PAGEDOCK_EXTENSION_ID=你的扩展ID ./install.sh $profile"
  exit 1
fi
if [[ ! "$extension_id" =~ '^[a-p]{32}$' ]]; then
  print -u2 "无效的 Chrome 扩展 ID：$extension_id"
  exit 1
fi

if [[ -z "$node_bin" || ! -x "$node_bin" ]]; then
  print -u2 "找不到可执行的 Node.js"
  exit 1
fi
if [[ "$profile" != "--core" && ( -z "$python_bin" || ! -x "$python_bin" ) ]]; then
  print -u2 "找不到可执行的 Python，交互终端组件无法运行"
  exit 1
fi
if [[ -z "$codex_bin" || ! -x "$codex_bin" ]]; then
  print -u2 "找不到可执行的 Codex CLI"
  exit 1
fi
if [[ "$profile" == "--video" && ( -z "$ffmpeg_bin" || ! -x "$ffmpeg_bin" ) ]]; then
  print -u2 "找不到可执行的 FFmpeg"
  exit 1
fi
if [[ "$profile" != "--core" && ! -x "$terminal_shell" ]]; then
  print -u2 "找不到可执行的控制台 Shell：$terminal_shell"
  exit 1
fi

# HyperFrames 自带的旧版 Headless Shell 可能在较新的 macOS 上崩溃。所有安装档位都记录一个
# 可用浏览器，避免后续 --core/--terminal 更新把已配置的视频浏览器清空。
browser_candidates=()
if [[ -n "$hyperframes_browser_path" ]]; then
  browser_candidates+=("$hyperframes_browser_path")
fi
browser_candidates+=(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
)
if [[ -n "$hyperframes_bin" && -x "$hyperframes_bin" ]]; then
  managed_browser_path="$("$hyperframes_bin" browser path 2>/dev/null | tail -n 1 || true)"
  if [[ -n "$managed_browser_path" ]]; then
    browser_candidates+=("$managed_browser_path")
  fi
fi
hyperframes_browser_path=""
for candidate in "${browser_candidates[@]}"; do
  if [[ -x "$candidate" ]]; then
    if [[ "$profile" != "--video" ]] || "$candidate" --headless --no-sandbox --disable-gpu --dump-dom about:blank >/dev/null 2>&1; then
      hyperframes_browser_path="$candidate"
      break
    fi
  fi
done
if [[ "$profile" == "--video" && -z "$hyperframes_browser_path" ]]; then
  print -u2 "HyperFrames 浏览器启动失败。请更新 Chrome 后重新运行安装器。"
  exit 1
fi

mkdir -p "$install_root" "$workspace_dir" "$host_manifest_dir" "$python_compat_dir"
if [[ "$profile" == "--video" && ( -z "$remotion_bin" || ! -x "$remotion_bin" ) ]]; then
  if [[ -z "$npm_bin" || ! -x "$npm_bin" ]]; then
    print -u2 "找不到 npm，无法安装 Remotion runtime"
    exit 1
  fi
  mkdir -p "$remotion_runtime"
  "$npm_bin" install --prefix "$remotion_runtime" --no-audit --no-fund remotion@latest @remotion/cli@latest react@latest react-dom@latest
  remotion_bin="$bundled_remotion_bin"
fi
if [[ "$profile" == "--video" && ! -x "$remotion_bin" ]]; then
  print -u2 "Remotion CLI 安装失败：$remotion_bin"
  exit 1
fi
if [[ "$profile" == "--video" && ( -z "$hyperframes_bin" || ! -x "$hyperframes_bin" ) && ! -x "$remotion_bin" ]]; then
  print -u2 "HyperFrames 与 Remotion 均不可用，至少需要一个视频引擎"
  exit 1
fi
mkdir -p "$skill_install_root/scripts"
if [[ ! -d "$coding_workspace_dir" ]]; then
  print -u2 "Codex 编码工作区不存在：$coding_workspace_dir"
  exit 1
fi
# Native Host modules are installed together so the executable entry and its adapters cannot drift.
for module in "$script_dir"/*.mjs; do
  install -m 644 "$module" "$install_root/${module:t}"
done
install -m 755 "$script_dir/pagedock-pty.py" "$pty_helper"
install -m 755 "$script_dir/pagedock-hyperframes-python" "$hyperframes_python_launcher"
install -m 644 "$script_dir/python-compat/sitecustomize.py" "$python_compat_dir/sitecustomize.py"
install -m 644 "$skill_source/SKILL.md" "$skill_install_root/SKILL.md"
install -m 644 "$skill_source/REFERENCE.md" "$skill_install_root/REFERENCE.md"
install -m 755 "$skill_source/scripts/shizuo.sh" "$skill_install_root/scripts/shizuo.sh"
install -m 755 "$skill_source/scripts/bridge-status.mjs" "$skill_install_root/scripts/bridge-status.mjs"
install -m 755 "$skill_source/scripts/health-check.mjs" "$skill_install_root/scripts/health-check.mjs"
install -m 644 "$skill_source/scripts/shizuo-mcp-server.mjs" "$skill_install_root/scripts/shizuo-mcp-server.mjs"
print -r -- "${profile#--}" > "$install_profile"
chmod 644 "$install_profile"

print -r -- '#!/bin/zsh' > "$host_launcher"
print -r -- "export PAGEDOCK_CODEX_BIN=${(q)codex_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_AGY_BIN=${(q)agy_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_HYPERFRAMES_BIN=${(q)hyperframes_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_REMOTION_BIN=${(q)remotion_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_HYPERFRAMES_BROWSER_PATH=${(q)hyperframes_browser_path}" >> "$host_launcher"
print -r -- "export PAGEDOCK_FFMPEG_BIN=${(q)ffmpeg_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_TERMINAL_SHELL=${(q)terminal_shell}" >> "$host_launcher"
print -r -- "export PAGEDOCK_REAL_PYTHON=${(q)python_bin}" >> "$host_launcher"
print -r -- "export PAGEDOCK_PTY_HELPER=${(q)pty_helper}" >> "$host_launcher"
print -r -- "export HYPERFRAMES_PYTHON=${(q)hyperframes_python_launcher}" >> "$host_launcher"
print -r -- "export PAGEDOCK_CODEX_WORKSPACE=${(q)workspace_dir}" >> "$host_launcher"
print -r -- "export PAGEDOCK_CODING_WORKSPACE=${(q)coding_workspace_dir}" >> "$host_launcher"
print -r -- "export PAGEDOCK_ALLOWED_ORIGIN=${(q)allowed_origin}" >> "$host_launcher"
print -r -- "exec ${(q)node_bin} ${(q)host_script} \"\$@\"" >> "$host_launcher"
chmod 755 "$host_launcher"

"$node_bin" - "$host_name" "$host_launcher" "$extension_id" > "$manifest_path" <<'EOF'
const [name, hostPath, extensionId] = process.argv.slice(2);
process.stdout.write(JSON.stringify({
  name,
  description: "拾作 local task bridge",
  path: hostPath,
  type: "stdio",
  allowed_origins: [`chrome-extension://${extensionId}/`]
}, null, 2));
EOF
chmod 644 "$manifest_path"

# 首次安装只开放本机回环地址；已存在的内网开关和令牌必须原样保留。
if [[ ! -f "$bridge_config" ]]; then
  SHIZUO_BRIDGE_CONFIG="$bridge_config" "$node_bin" "$bridge_configurator" --local
else
  SHIZUO_BRIDGE_CONFIG="$bridge_config" "$node_bin" "$bridge_configurator"
fi

# 首次安装直接注册本机 MCP；已有配置保持不动，避免覆盖用户自定义参数。
if ! "$codex_bin" mcp get shizuo >/dev/null 2>&1; then
  "$codex_bin" mcp add shizuo -- "$node_bin" "$mcp_server"
fi

# 使用接近 Chrome 的精简环境自检；核心档位不被终端和视频可选依赖阻塞。
/usr/bin/env -i \
  HOME="$HOME" \
  PAGEDOCK_CODEX_BIN="$codex_bin" \
  PAGEDOCK_AGY_BIN="$agy_bin" \
  PAGEDOCK_HYPERFRAMES_BIN="$hyperframes_bin" \
  PAGEDOCK_REMOTION_BIN="$remotion_bin" \
  PAGEDOCK_HYPERFRAMES_BROWSER_PATH="$hyperframes_browser_path" \
  PAGEDOCK_FFMPEG_BIN="$ffmpeg_bin" \
  PAGEDOCK_TERMINAL_SHELL="$terminal_shell" \
  PAGEDOCK_REAL_PYTHON="$python_bin" \
  PAGEDOCK_PTY_HELPER="$pty_helper" \
  HYPERFRAMES_PYTHON="$hyperframes_python_launcher" \
  PAGEDOCK_CODEX_WORKSPACE="$workspace_dir" \
  PAGEDOCK_CODING_WORKSPACE="$coding_workspace_dir" \
  PAGEDOCK_SELF_TEST_PROFILE="${profile#--}" \
  "$node_bin" "$host_script" --self-test
print
print "拾作 Codex Host 已安装：$manifest_path"
print "安装档位：${profile#--}"
print "Codex 编码工作区：$coding_workspace_dir"
print "AGY CLI：${agy_bin:-未安装（可选）}"
print "控制台 Shell：$terminal_shell"
print "HyperFrames 浏览器：${hyperframes_browser_path:-未配置（可稍后运行 ./install.sh --video）}"
if [[ "$profile" == "--video" ]]; then
  print "视频引擎：HyperFrames / Remotion（至少一个可用，纯画面）+ Kokoro 后置口播与字幕"
else
  print "视频引擎：未启用（可稍后运行 ./install.sh --video）"
fi
print "终端 Python：${python_bin:-未配置（可稍后运行 ./install.sh --terminal）}"
print "Codex MCP：$mcp_server"
print "Codex Skill：$skill_install_root"
print "请在 chrome://extensions 重新加载拾作，然后运行："
print "sh ${(q)skill_install_root}/scripts/shizuo.sh health"
