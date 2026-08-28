#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const configPath = process.env.SHIZUO_BRIDGE_CONFIG
  || path.join(os.homedir(), "Library", "Application Support", "PageDock", "codex-bridge.json");
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {
  process.stderr.write("未找到拾作桥接配置，请先安装 Native Host。\n");
  process.exit(1);
}
const url = String(process.env.SHIZUO_BRIDGE_URL || `http://127.0.0.1:${Number(config.port) || 43_127}`).replace(/\/$/, "");
const token = String(process.env.SHIZUO_BRIDGE_TOKEN || config.token || "");
if (!token) {
  process.stderr.write("拾作桥接配置缺少令牌。\n");
  process.exit(1);
}
try {
  const response = await fetch(`${url}/v1/status`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  process.stdout.write(`${JSON.stringify({
    connected: true,
    url,
    scope: payload.scope,
    allowDestructive: payload.allowDestructive,
    hostVersion: payload.hostVersion
  }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`拾作桥接未连接：${error.message}\n`);
  process.exit(2);
}
