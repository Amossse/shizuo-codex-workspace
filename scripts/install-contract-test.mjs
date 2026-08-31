import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const command = path.join(root, "skills/shizuo/scripts/shizuo.sh");
const installer = path.join(root, "install.sh");

const help = spawnSync("bash", [command, "help"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env }
});
assert.equal(help.status, 0, `公开安装命令必须可由 bash 执行：${help.stderr || help.stdout}`);
assert.match(help.stdout, /health/, "帮助信息必须暴露健康检查入口");
assert.doesNotMatch(`${help.stdout}\n${help.stderr}`, /unbound variable|bad substitution/i, "公开命令不能依赖 zsh 语法");

const installHelp = spawnSync("bash", [installer, "--help"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env }
});
assert.equal(installHelp.status, 0, `一键安装入口必须可直接执行：${installHelp.stderr || installHelp.stdout}`);
assert.match(installHelp.stdout, /--core/, "一键安装必须提供不依赖视频工具的核心档位");
assert.match(installHelp.stdout, /health/, "一键安装必须说明安装后的健康检查命令");
const nativeInstaller = fs.readFileSync(path.join(root, "native-host/install-macos.sh"), "utf8");
assert.match(nativeInstaller, /health-check\.mjs/, "安装器必须复制健康检查实现，不能只安装调用入口");
assert.match(nativeInstaller, /for module in "\$script_dir"\/\*\.mjs; do[\s\S]{0,160}install -m 644/, "安装器必须完整复制 Native Host 模块，不能维护易漂移的手工清单");
assert.match(nativeInstaller, /install-profile/, "健康检查必须知道用户选择的安装档位");
assert.match(nativeInstaller, /mcp add shizuo/, "一键安装必须自动注册本机 MCP");
assert.match(nativeInstaller, /PAGEDOCK_AGY_BIN/, "安装器必须把 AGY 的绝对路径交给 Chrome Native Host");
assert.match(nativeInstaller, /PAGEDOCK_REMOTION_BIN/, "安装器必须把 Remotion runtime 的绝对路径交给 Chrome Native Host");
assert.match(nativeInstaller, /@remotion\/cli@latest/, "视频档安装器必须自动准备 Remotion CLI");
assert.match(nativeInstaller, /bundled_remotion_bin[\s\S]{0,300}-x "\$bundled_remotion_bin"[\s\S]{0,120}remotion_bin="\$bundled_remotion_bin"/, "安装器必须复用已有的 Remotion runtime，不能每次联网重装");
assert.doesNotMatch(nativeInstaller, /PAGEDOCK_MEDIA_USE_AUDIO_SCRIPT/, "视频档安装器不能再依赖旁白生成脚本");
assert.doesNotMatch(nativeInstaller, /PAGEDOCK_EXTENSION_ID:-[a-p]{32}/, "公开安装器不能内置维护者的本地扩展 ID");
assert.match(nativeInstaller, /请先在 chrome:\/\/extensions 加载拾作，复制其扩展 ID/, "公开安装器必须说明如何提供当前扩展 ID");
const healthSource = fs.readFileSync(path.join(root, "skills/shizuo/scripts/health-check.mjs"), "utf8");
assert.match(healthSource, /bundledRemotionPath[\s\S]{0,900}add\("remotion", "Remotion"/, "健康检查必须验证安装器管理的 Remotion runtime");
assert.match(healthSource, /videoEngineAvailable[\s\S]{0,500}"video_engine"/, "视频档健康检查必须接受任一可用视频引擎");
assert.match(nativeInstaller, /HyperFrames 与 Remotion 均不可用，至少需要一个视频引擎/, "视频档安装器不能强制同时安装两个视频引擎");
assert.match(nativeInstaller, /所有安装档位都记录一个[\s\S]{0,300}browser_candidates/, "核心更新不能清空已有的视频浏览器配置");
assert.match(nativeInstaller, /Google Chrome[\s\S]{0,300}managed_browser_path/, "安装器应优先使用已验证的系统 Chrome，再回退到 HyperFrames 浏览器");
const emptySupportRoot = fs.mkdtempSync(path.join(os.tmpdir(), "shizuo-health-contract-"));
const health = spawnSync(process.execPath, [path.join(root, "skills/shizuo/scripts/health-check.mjs"), "--json"], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, SHIZUO_SUPPORT_ROOT: emptySupportRoot }
});
const healthPayload = JSON.parse(health.stdout);
assert.equal(healthPayload.profile, "core");
assert.equal(healthPayload.checks.find(check => check.id === "python")?.required, false, "核心安装不能被终端依赖阻塞");
fs.rmSync(emptySupportRoot, { recursive: true, force: true });

console.log("拾作安装命令契约验证通过");
