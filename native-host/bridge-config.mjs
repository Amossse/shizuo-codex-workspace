import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BRIDGE_CONFIG_VERSION = 2;
const DEFAULT_BRIDGE_PORT = 43_127;

export function resolveBridgeConfigPath(environment = process.env) {
  return environment.SHIZUO_BRIDGE_CONFIG
    || path.join(environment.HOME || os.homedir(), "Library", "Application Support", "PageDock", "codex-bridge.json");
}

function bridgePort(value, fallback = DEFAULT_BRIDGE_PORT) {
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) return fallback;
  return Math.min(65_535, Math.max(1_024, Math.trunc(candidate)));
}

function bridgeClients(value) {
  return (Array.isArray(value) ? value : []).slice(-50).map(client => ({
    id: String(client?.id || ""),
    token: String(client?.token || ""),
    boardId: String(client?.boardId || ""),
    createdAt: Number(client?.createdAt) || 0
  })).filter(client => client.id && client.token.length >= 32 && client.boardId);
}

function validToken(value) {
  const token = String(value || "");
  return token.length >= 32 ? token : "";
}

export function readStoredBridgeConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return null;
  try {
    const stored = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;
  } catch (error) {
    console.warn("[shizuo-bridge] config rejected", { configPath, reason: error.message });
    return null;
  }
}

function normalizedBridgeConfig(stored) {
  const lan = stored?.lan === true && stored?.bind === "0.0.0.0";
  return {
    ...(stored || {}),
    version: BRIDGE_CONFIG_VERSION,
    enabled: stored?.enabled === true,
    bind: lan ? "0.0.0.0" : "127.0.0.1",
    port: bridgePort(stored?.port),
    lan,
    allowDestructive: stored?.allowDestructive === true,
    token: validToken(stored?.token),
    clientTokensVersion: 2,
    clients: bridgeClients(stored?.clients)
  };
}

export function readActiveBridgeConfig(configPath) {
  const config = normalizedBridgeConfig(readStoredBridgeConfig(configPath));
  return config.enabled && config.token ? config : null;
}

export function writeBridgeConfig(configPath, config) {
  const directory = path.dirname(configPath);
  const temporaryPath = `${configPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    fs.chmodSync(temporaryPath, 0o600);
    fs.renameSync(temporaryPath, configPath);
    fs.chmodSync(configPath, 0o600);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return config;
}

export function configureBridge(configPath, options = {}) {
  const stored = readStoredBridgeConfig(configPath) || {};
  const lan = typeof options.lan === "boolean" ? options.lan : stored.lan === true;
  const requestedPort = Number(options.port);
  const port = Number.isInteger(requestedPort) && requestedPort >= 1_024 && requestedPort <= 65_535
    ? requestedPort
    : bridgePort(stored.port);
  const rotateToken = options.rotateToken === true
    || (options.rotateLegacyToken === true && stored.clientTokensVersion !== 2);
  const config = normalizedBridgeConfig({
    ...stored,
    version: BRIDGE_CONFIG_VERSION,
    enabled: typeof options.enabled === "boolean" ? options.enabled : true,
    bind: lan ? "0.0.0.0" : "127.0.0.1",
    port,
    lan,
    allowDestructive: typeof options.allowDestructive === "boolean"
      ? options.allowDestructive
      : stored.allowDestructive === true,
    token: rotateToken ? randomBytes(32).toString("base64url") : validToken(stored.token) || randomBytes(32).toString("base64url"),
    clientTokensVersion: 2,
    clients: options.preserveClients === false ? [] : bridgeClients(stored.clients),
    updatedAt: new Date().toISOString()
  });
  return writeBridgeConfig(configPath, config);
}

export function startLanShare(configPath) {
  return configureBridge(configPath, {
    lan: true,
    enabled: true,
    allowDestructive: false,
    // 首次升级到独立接入者令牌时轮换旧共享令牌，避免历史邀请继续拥有全白板权限。
    rotateLegacyToken: true,
    preserveClients: true
  });
}

export function stopLanShare(configPath) {
  return configureBridge(configPath, {
    lan: false,
    enabled: true,
    allowDestructive: false,
    // 停止共享必须让现有接入者立即失效；普通 CLI 切回本机模式仍会保留接入者记录。
    preserveClients: false
  });
}

export function registerBridgeClient(configPath, client) {
  const stored = readStoredBridgeConfig(configPath) || {};
  const nextClient = {
    id: String(client?.clientId || client?.id || ""),
    token: String(client?.clientToken || client?.token || ""),
    boardId: String(client?.boardId || ""),
    createdAt: Number(client?.createdAt) || Date.now()
  };
  if (!nextClient.id || nextClient.token.length < 32 || !nextClient.boardId) throw new Error("接入者配置不完整");
  const clients = bridgeClients(stored.clients).filter(entry => entry.id !== nextClient.id).slice(-49);
  clients.push(nextClient);
  return writeBridgeConfig(configPath, normalizedBridgeConfig({
    ...stored,
    version: BRIDGE_CONFIG_VERSION,
    clients,
    updatedAt: new Date().toISOString()
  }));
}

export function revokeBridgeClient(configPath, clientId) {
  const stored = readStoredBridgeConfig(configPath) || {};
  const id = String(clientId || "");
  const clients = bridgeClients(stored.clients);
  const remaining = clients.filter(client => client.id !== id);
  if (!id || remaining.length === clients.length) return { config: normalizedBridgeConfig(stored), removed: false };
  const config = writeBridgeConfig(configPath, normalizedBridgeConfig({
    ...stored,
    version: BRIDGE_CONFIG_VERSION,
    clients: remaining,
    updatedAt: new Date().toISOString()
  }));
  return { config, removed: true };
}
