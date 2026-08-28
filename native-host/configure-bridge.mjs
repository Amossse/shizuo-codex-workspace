#!/usr/bin/env node

import { configureBridge, resolveBridgeConfigPath } from "./bridge-config.mjs";

const args = new Set(process.argv.slice(2));
const valueAfter = name => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
};
const configPath = resolveBridgeConfigPath();
const requestedPort = Number(valueAfter("--port"));
const config = configureBridge(configPath, {
  port: Number.isInteger(requestedPort) ? requestedPort : undefined,
  lan: args.has("--lan") ? true : args.has("--local") ? false : undefined,
  enabled: !args.has("--disable"),
  allowDestructive: args.has("--allow-delete")
    ? true
    : args.has("--deny-delete")
      ? false
      : undefined,
  rotateToken: args.has("--rotate-token"),
  preserveClients: true
});

const endpoint = `http://${config.lan ? "<本机内网 IP>" : "127.0.0.1"}:${config.port}`;
process.stdout.write([
  `拾作 Codex 桥接已${config.enabled ? "启用" : "停用"}`,
  `范围：${config.lan ? "同一内网（私网地址 + 令牌）" : "仅本机"}`,
  `地址：${endpoint}`,
  `删除权限：${config.allowDestructive ? "已开启" : "未开启"}`,
  "令牌：[已写入本地受保护配置]",
  `配置：${configPath}`,
  "重新加载 Chrome 中的拾作后生效。"
].join("\n") + "\n");
