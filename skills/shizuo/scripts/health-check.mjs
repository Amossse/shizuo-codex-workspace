#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const supportRoot = process.env.SHIZUO_SUPPORT_ROOT
  || path.join(os.homedir(), "Library", "Application Support", "PageDock");
const configPath = process.env.SHIZUO_BRIDGE_CONFIG || path.join(supportRoot, "codex-bridge.json");
const hostPath = path.join(supportRoot, "pagedock-codex-host.mjs");
const mcpPath = path.join(supportRoot, "shizuo-mcp-server.mjs");
const bundledRemotionPath = path.join(supportRoot, "remotion-runtime", "node_modules", ".bin", "remotion");
let profile = "core";
try {
  const storedProfile = fs.readFileSync(path.join(supportRoot, "install-profile"), "utf8").trim();
  if (["core", "terminal", "video"].includes(storedProfile)) profile = storedProfile;
} catch {}
const terminalRequired = profile !== "core";
const videoRequired = profile === "video";
const manifestPath = path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts", "com.pagedock.codex.json");
const checks = [];

function commandPath(name) {
  const result = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function add(id, label, status, detail, required = true) {
  checks.push({ id, label, status, detail, required });
}

add("platform", "macOS", process.platform === "darwin" ? "pass" : "fail", process.platform, true);
for (const [id, label, command, required] of [
  ["node", "Node.js", "node", true],
  ["codex", "Codex CLI", "codex", true],
  ["agy", "AGY CLI", "agy", false],
  ["python", "Python 3", "python3", terminalRequired],
  ["hyperframes", "HyperFrames", "hyperframes", false],
  ["ffmpeg", "FFmpeg", "ffmpeg", videoRequired]
]) {
  const executable = commandPath(command);
  add(id, label, executable ? "pass" : required ? "fail" : "warn", executable || "未安装", required);
}
const remotionPath = fs.existsSync(bundledRemotionPath) ? bundledRemotionPath : commandPath("remotion");
add("remotion", "Remotion", remotionPath ? "pass" : "warn", remotionPath || "未安装", false);
const videoEngineAvailable = checks.some(check => ["hyperframes", "remotion"].includes(check.id) && check.status === "pass");
add(
  "video_engine",
  "视频引擎",
  videoEngineAvailable ? "pass" : videoRequired ? "fail" : "warn",
  videoEngineAvailable ? "至少一个视频引擎已就绪" : "HyperFrames 与 Remotion 均未安装",
  videoRequired
);
add("host", "Native Host", fs.existsSync(hostPath) ? "pass" : "fail", hostPath, true);
add("manifest", "Chrome 注册", fs.existsSync(manifestPath) ? "pass" : "fail", manifestPath, true);
add("mcp_adapter", "MCP Adapter", fs.existsSync(mcpPath) ? "pass" : "fail", mcpPath, true);

let config = null;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  add("bridge_config", "桥接配置", config.token && config.enabled ? "pass" : "fail", configPath, true);
} catch {
  add("bridge_config", "桥接配置", "fail", configPath, true);
}

const codex = commandPath("codex");
if (codex) {
  const result = spawnSync(codex, ["mcp", "get", "shizuo"], { encoding: "utf8" });
  add("codex_mcp", "Codex MCP 注册", result.status === 0 ? "pass" : "warn", result.status === 0 ? "已注册" : "未注册；运行 shizuo.sh local", false);
}

if (config?.token) {
  const bridgeUrl = String(process.env.SHIZUO_BRIDGE_URL || `http://127.0.0.1:${Number(config.port) || 43_127}`).replace(/\/$/, "");
  try {
    const response = await fetch(`${bridgeUrl}/v1/status`, {
      headers: { authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(2_000)
    });
    const payload = await response.json().catch(() => ({}));
    add("bridge", "拾作桥接", response.ok && payload.ok ? "pass" : "fail", response.ok && payload.ok ? `${payload.scope || "local"} · host ${payload.hostVersion || "unknown"}` : payload.error || `HTTP ${response.status}`, true);
  } catch (error) {
    add("bridge", "拾作桥接", "fail", `未连接：${error.message}`, true);
  }
}

const requiredFailures = checks.filter(check => check.required && check.status === "fail");
const payload = {
  ok: requiredFailures.length === 0,
  profile,
  checkedAt: new Date().toISOString(),
  checks,
  recommendations: [
    requiredFailures.length ? "重新运行项目根目录 ./install.sh，然后在 chrome://extensions 重新加载拾作。" : "核心能力已就绪。",
    !videoRequired && checks.some(check => check.id === "hyperframes" && check.status !== "pass") ? "如需视频创作，再运行 ./install.sh --video。" : "",
    !videoRequired && checks.some(check => check.id === "remotion" && check.status !== "pass") ? "如需视频创作，再运行 ./install.sh --video。" : "",
    !videoRequired && checks.some(check => check.id === "ffmpeg" && check.status !== "pass") ? "如需视频创作，再运行 ./install.sh --video。" : ""
  ].filter(Boolean)
};
process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
