import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { authorizeBridgeClient } from "../native-host/bridge-auth.mjs";
import { readActiveBridgeConfig, registerBridgeClient, revokeBridgeClient, startLanShare, stopLanShare } from "../native-host/bridge-config.mjs";

const config = {
  token: "owner-token-abcdefghijklmnopqrstuvwxyz",
  clients: [
    { id: "client-1", token: "client-token-abcdefghijklmnopqrstuvwxyz", boardId: "board-1" }
  ]
};

assert.deepEqual(
  authorizeBridgeClient("owner-token-abcdefghijklmnopqrstuvwxyz", config, "127.0.0.1"),
  { id: "owner-local", boardId: "", lan: false },
  "主令牌应只允许本机拥有者"
);
assert.equal(
  authorizeBridgeClient("owner-token-abcdefghijklmnopqrstuvwxyz", config, "192.168.1.8"),
  null,
  "主令牌不能从内网访问全部白板"
);
assert.deepEqual(
  authorizeBridgeClient("client-token-abcdefghijklmnopqrstuvwxyz", config, "192.168.1.8"),
  { id: "client-1", boardId: "board-1", lan: true },
  "内网接入者必须使用白板作用域令牌"
);
assert.equal(authorizeBridgeClient("wrong-token", config, "127.0.0.1"), null);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shizuo-config-test-"));
const configPath = path.join(directory, "codex-bridge.json");
fs.writeFileSync(configPath, JSON.stringify(config));
const configured = spawnSync(process.execPath, [new URL("../native-host/configure-bridge.mjs", import.meta.url).pathname, "--local"], {
  encoding: "utf8",
  env: { ...process.env, SHIZUO_BRIDGE_CONFIG: configPath }
});
assert.equal(configured.status, 0);
assert.doesNotMatch(configured.stdout, /owner-token-abcdefghijklmnopqrstuvwxyz/, "配置器不能打印主令牌");
const preserved = JSON.parse(fs.readFileSync(configPath, "utf8"));
assert.equal(preserved.version, 2, "所有配置入口必须统一写入 v2");
assert.equal(preserved.token, config.token);
assert.equal(preserved.clients[0].id, "client-1", "更新桥接模式不能清空独立客户端");
assert.equal(fs.statSync(configPath).mode & 0o777, 0o600, "桥接配置必须保持为仅当前用户可读写");
const rotated = spawnSync(process.execPath, [new URL("../native-host/configure-bridge.mjs", import.meta.url).pathname, "--rotate-token"], {
  encoding: "utf8",
  env: { ...process.env, SHIZUO_BRIDGE_CONFIG: configPath }
});
assert.equal(rotated.status, 0);
assert.notEqual(JSON.parse(fs.readFileSync(configPath, "utf8")).token, config.token, "暴露后必须可以显式轮换主令牌");

fs.writeFileSync(configPath, JSON.stringify({ ...config, version: 1, enabled: true, bind: "127.0.0.1", lan: true, clientTokensVersion: 1 }));
const safelyNormalized = readActiveBridgeConfig(configPath);
assert.equal(safelyNormalized.bind, "127.0.0.1", "不一致的 LAN 配置必须收紧为回环地址");
assert.equal(safelyNormalized.lan, false);
const shared = startLanShare(configPath);
assert.equal(shared.version, 2, "开启共享必须升级旧配置");
assert.equal(shared.lan, true);
assert.equal(shared.allowDestructive, false, "开启内网共享不能继承删除权限");
assert.notEqual(shared.token, config.token, "旧共享令牌必须在首次升级时轮换");

registerBridgeClient(configPath, {
  clientId: "client-2",
  clientToken: "second-client-token-abcdefghijklmnopqrstuvwxyz",
  boardId: "board-2"
});
assert.equal(readActiveBridgeConfig(configPath).clients.some(client => client.id === "client-2"), true);
const removed = revokeBridgeClient(configPath, "client-2");
assert.equal(removed.removed, true, "撤销接入者必须删除其长期令牌");
assert.equal(authorizeBridgeClient("second-client-token-abcdefghijklmnopqrstuvwxyz", removed.config, "192.168.1.8"), null);
const local = stopLanShare(configPath);
assert.equal(local.lan, false);
assert.equal(local.clients.length, 0, "停止共享必须让全部远端接入者失效");
fs.rmSync(directory, { recursive: true, force: true });

console.log("拾作桥接鉴权契约验证通过");
