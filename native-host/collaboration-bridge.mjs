import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { authorizeBridgeClient, isLoopbackAddress, normalizedRemoteAddress } from "./bridge-auth.mjs";
import { readActiveBridgeConfig, registerBridgeClient, revokeBridgeClient, startLanShare, stopLanShare } from "./bridge-config.mjs";
import { collaborationBoardPage, collaborationLandingPage } from "./collaboration-page.mjs";
import { truncate } from "./runtime-utils.mjs";

const MAX_BRIDGE_BODY_BYTES = 256 * 1024;
const BRIDGE_REQUEST_TIMEOUT_MS = 60_000;
const BRIDGE_RATE_LIMIT_PER_MINUTE = 120;
const BRIDGE_INVITE_TTL_MS = 10 * 60 * 1000;

// Owns the trusted-LAN HTTP bridge, invites, rate limits, and plugin requests.
export function createCollaborationBridge({ bridgeConfigPath, hostDirectory, installedSkillDirectory, hostVersion: HOST_VERSION, send, log }) {
  const pluginRequests = new Map();
  const bridgeRateWindows = new Map();
  const bridgeInvites = new Map();
  let bridgeServer;
  function revokeBridgeClientRequest(message) {
    const clientId = String(message.clientId || "");
    if (!clientId || clientId === "owner-local") throw new Error("不能撤销本机拥有者");
    const result = revokeBridgeClient(bridgeConfigPath, clientId);
    if (!result.removed) throw new Error("接入者已失效或不存在");
    send({ type: "bridge-client-revoked", id: String(message.id || ""), clientId });
    log("bridge client revoked", { clientId });
  }
  
  function isPrivateNetworkAddress(value) {
    const address = normalizedRemoteAddress(value);
    if (isLoopbackAddress(address)) return true;
    if (/^10\./.test(address) || /^192\.168\./.test(address) || /^169\.254\./.test(address)) return true;
    const match = /^172\.(\d{1,3})\./.exec(address);
    if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return true;
    return address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe8") || address.startsWith("fe9") || address.startsWith("fea") || address.startsWith("feb");
  }
  
  function bridgeJson(response, status, payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(body);
  }
  
  function bridgeText(response, status, body, contentType = "text/plain; charset=utf-8") {
    const payload = Buffer.from(String(body || ""), "utf8");
    response.writeHead(status, {
      "content-type": contentType,
      "content-length": payload.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(payload);
  }
  
  function bridgeBinary(response, body, contentType) {
    response.writeHead(200, {
      "content-type": contentType,
      "content-length": body.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end(body);
  }
  
  function bridgeHtml(response, body, nonce) {
    const payload = Buffer.from(String(body || ""), "utf8");
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "content-length": payload.length,
      "cache-control": "no-store",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data: http: https:; media-src 'self' data: http: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY"
    });
    response.end(payload);
  }
  
  function bridgeRedirect(response, location, cookie = "") {
    response.writeHead(303, {
      location,
      ...(cookie ? { "set-cookie": cookie } : {}),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    response.end();
  }
  
  function requestCookie(request, name) {
    const prefix = `${name}=`;
    const value = String(request.headers.cookie || "")
      .split(";")
      .map(part => part.trim())
      .find(part => part.startsWith(prefix))
      ?.slice(prefix.length);
    if (!value) return "";
    try { return decodeURIComponent(value); } catch { return ""; }
  }
  
  function preferredPrivateIpv4() {
    const configuredAddress = String(process.env.SHIZUO_BRIDGE_ADVERTISE_ADDRESS || "").trim();
    if (configuredAddress && isPrivateNetworkAddress(configuredAddress) && !isLoopbackAddress(configuredAddress)) {
      return configuredAddress;
    }
    const candidates = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      for (const entry of addresses || []) {
        if (entry.family !== "IPv4" || entry.internal || !isPrivateNetworkAddress(entry.address)) continue;
        const interfaceRank = /^en\d+$/.test(name) ? 0 : /^(bridge|utun|docker|vbox)/.test(name) ? 2 : 1;
        const addressRank = entry.address.startsWith("169.254.") ? 2 : 0;
        candidates.push({ address: entry.address, rank: interfaceRank + addressRank });
      }
    }
    candidates.sort((left, right) => left.rank - right.rank || left.address.localeCompare(right.address));
    return candidates[0]?.address || "";
  }
  
  function shellQuote(value) {
    return `'${String(value || "").replaceAll("'", `'"'"'`)}'`;
  }
  
  function decodedHeaderText(value) {
    try {
      return decodeURIComponent(String(value || ""));
    } catch {
      return String(value || "");
    }
  }
  
  function clientInstallFiles() {
    const sourceSkillDirectory = path.resolve(hostDirectory, "../skills/shizuo");
    const skillDirectory = fs.existsSync(path.join(sourceSkillDirectory, "SKILL.md"))
      ? sourceSkillDirectory
      : installedSkillDirectory;
    return [
      ["SKILL.md", path.join(skillDirectory, "SKILL.md"), 80_000],
      ["REFERENCE.md", path.join(skillDirectory, "REFERENCE.md"), 80_000],
      ["scripts/shizuo.sh", path.join(skillDirectory, "scripts", "shizuo.sh"), 80_000],
      ["scripts/bridge-status.mjs", path.join(skillDirectory, "scripts", "bridge-status.mjs"), 80_000],
      ["scripts/shizuo-mcp-server.mjs", path.join(hostDirectory, "shizuo-mcp-server.mjs"), 300_000]
    ].map(([target, source, limit]) => {
      const content = fs.readFileSync(source);
      if (content.length > limit) throw new Error(`客户端安装文件过大：${target}`);
      return { target, encoded: content.toString("base64") };
    });
  }
  
  function buildBridgeClientInstaller(invite) {
    const writes = clientInstallFiles().map(file => [
      `target="$skill_root/${file.target}"`,
      "mkdir -p \"$(dirname \"$target\")\"",
      `"$node_bin" -e 'require("fs").writeFileSync(process.argv[1], Buffer.from(process.argv[2], "base64"))' "$target" ${shellQuote(file.encoded)}`
    ].join("\n")).join("\n");
    return [
      "#!/bin/zsh",
      "set -euo pipefail",
      "node_bin=\"$(command -v node || true)\"",
      "codex_bin=\"$(command -v codex || true)\"",
      "[[ -n \"$node_bin\" && -x \"$node_bin\" ]] || { print -u2 '未找到 Node.js'; exit 1; }",
      "[[ -n \"$codex_bin\" && -x \"$codex_bin\" ]] || { print -u2 '未找到 Codex CLI'; exit 1; }",
      "codex_root=\"${CODEX_HOME:-$HOME/.codex}\"",
      "skill_root=\"$codex_root/skills/shizuo\"",
      "mkdir -p \"$skill_root/scripts\"",
      writes,
      "chmod 755 \"$skill_root/scripts/shizuo.sh\" \"$skill_root/scripts/bridge-status.mjs\"",
      `bridge_url=${shellQuote(invite.endpoint)}`,
      `bridge_token=${shellQuote(invite.clientToken)}`,
      "if \"$codex_bin\" mcp get shizuo-lan >/dev/null 2>&1; then \"$codex_bin\" mcp remove shizuo-lan >/dev/null; fi",
      "\"$codex_bin\" mcp add shizuo-lan --env \"SHIZUO_BRIDGE_URL=$bridge_url\" --env \"SHIZUO_BRIDGE_TOKEN=$bridge_token\" -- \"$node_bin\" \"$skill_root/scripts/shizuo-mcp-server.mjs\"",
      "SHIZUO_BRIDGE_URL=\"$bridge_url\" SHIZUO_BRIDGE_TOKEN=\"$bridge_token\" \"$node_bin\" \"$skill_root/scripts/bridge-status.mjs\" >/dev/null",
      "print '拾作已连接。请重启 Codex，然后说：读取拾作白板'"
    ].join("\n") + "\n";
  }
  
  function activeBridgeInvite(code) {
    const invite = bridgeInvites.get(String(code || ""));
    if (!invite) return null;
    if (Date.now() >= invite.expiresAt) {
      bridgeInvites.delete(invite.code);
      return null;
    }
    return invite;
  }
  
  function inviteMarkdown(invite) {
    return [
      "# 拾作一次性连接邀请",
      "",
      "此邀请仅适用于同一可信内网，10 分钟内一次有效。",
      "无需使用 Chrome 打开内网地址。只有在用户明确要求连接拾作时，才在 Codex 终端执行下面的安装命令：",
      "",
      "```bash",
      `curl -fsS -X POST ${shellQuote(`${invite.inviteUrl}/install`)} | zsh`,
      "```",
      "",
      "安装完成后重启 Codex，再说“读取拾作白板”。默认不开放删除、终端或本地文件能力。"
    ].join("\n");
  }
  
  function readBridgeBody(request) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let length = 0;
      request.on("data", chunk => {
        length += chunk.length;
        if (length > MAX_BRIDGE_BODY_BYTES) {
          reject(new Error("请求内容过大"));
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
        } catch {
          reject(new Error("请求不是有效 JSON"));
        }
      });
      request.on("error", reject);
    });
  }
  
  function consumeBridgeRate(address) {
    const key = normalizedRemoteAddress(address);
    const now = Date.now();
    const current = bridgeRateWindows.get(key);
    if (!current || now - current.startedAt >= 60_000) {
      bridgeRateWindows.set(key, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= BRIDGE_RATE_LIMIT_PER_MINUTE;
  }
  
  function requestPlugin(method, params, config, remoteAddress, clientName, client, clientType = "codex") {
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pluginRequests.delete(requestId);
        reject(new Error("插件响应超时，请确认 Chrome 中已启用拾作"));
      }, BRIDGE_REQUEST_TIMEOUT_MS);
      pluginRequests.set(requestId, { resolve, reject, timer });
      send({
        type: "plugin-request",
        requestId,
        method,
        params,
        capabilities: { allowDestructive: config.allowDestructive, requireVersion: Boolean(client?.boardId) },
        remote: {
          address: normalizedRemoteAddress(remoteAddress),
          lan: !isLoopbackAddress(remoteAddress),
          clientId: String(client?.id || "owner-local"),
          boardId: String(client?.boardId || ""),
          clientName: truncate(decodedHeaderText(clientName), 80).replace(/[\r\n\t]/g, " ").trim() || (clientType === "human" ? "协作者" : "Codex"),
          clientType: clientType === "human" ? "human" : "codex"
        }
      });
      log("plugin request forwarded", { requestId, method, remoteAddress: normalizedRemoteAddress(remoteAddress) });
    });
  }
  
  function settlePluginRequest(message) {
    const requestId = String(message.requestId || "");
    const pending = pluginRequests.get(requestId);
    if (!pending) return;
    pluginRequests.delete(requestId);
    clearTimeout(pending.timer);
    if (message.ok) pending.resolve(message.result);
    else pending.reject(new Error(String(message.error || "插件操作失败")));
  }
  
  async function startBridgeServer() {
    const config = readActiveBridgeConfig(bridgeConfigPath);
    if (!config) {
      log("external bridge disabled", { configPath: bridgeConfigPath });
      return null;
    }
    const server = http.createServer(async (request, response) => {
      const remoteAddress = request.socket.remoteAddress || "";
      if ((!config.lan && !isLoopbackAddress(remoteAddress)) || (config.lan && !isPrivateNetworkAddress(remoteAddress))) {
        bridgeJson(response, 403, { ok: false, error: "只允许本机或同一内网访问" });
        return;
      }
      if (!consumeBridgeRate(remoteAddress)) {
        bridgeJson(response, 429, { ok: false, error: "请求过于频繁" });
        return;
      }
      const requestUrl = new URL(request.url || "/", "http://shizuo.local");
      const inviteMatch = /^\/v1\/join\/([A-Za-z0-9_-]{32,})$/.exec(requestUrl.pathname);
      const installMatch = /^\/v1\/join\/([A-Za-z0-9_-]{32,})\/install$/.exec(requestUrl.pathname);
      const collaborateMatch = /^\/v1\/collaborate\/([A-Za-z0-9_-]{32,})$/.exec(requestUrl.pathname);
      const collaborateClaimMatch = /^\/v1\/collaborate\/([A-Za-z0-9_-]{32,})\/claim$/.exec(requestUrl.pathname);
      const collaborationAssetMatch = /^\/v1\/collaboration\/assets\/([^/]+)$/.exec(requestUrl.pathname);
      const collaborationToken = requestCookie(request, "shizuo_collaboration");
      const activeConfig = readActiveBridgeConfig(bridgeConfigPath);
      const collaborationClient = activeConfig ? authorizeBridgeClient(collaborationToken, activeConfig, remoteAddress) : null;
      if (request.method === "GET" && collaborateMatch) {
        if (collaborationClient?.boardId) {
          bridgeRedirect(response, "/v1/collaboration");
          return;
        }
        const invite = activeBridgeInvite(collaborateMatch[1]);
        if (!invite || invite.kind !== "human") {
          bridgeText(response, 410, "此拾作协作邀请已使用或已过期。\n");
          return;
        }
        const nonce = randomBytes(18).toString("base64url");
        bridgeHtml(response, collaborationLandingPage(collaborateMatch[1], nonce), nonce);
        return;
      }
      if (request.method === "POST" && collaborateClaimMatch) {
        const invite = activeBridgeInvite(collaborateClaimMatch[1]);
        if (!invite || invite.kind !== "human") {
          bridgeText(response, 410, "此拾作协作邀请已使用或已过期。\n");
          return;
        }
        // 只有用户点击进入后才领取邀请，避免聊天软件的链接预览消耗一次性访问资格。
        bridgeInvites.delete(invite.code);
        registerBridgeClient(bridgeConfigPath, invite);
        bridgeRedirect(response, "/v1/collaboration", `shizuo_collaboration=${encodeURIComponent(invite.clientToken)}; Path=/v1; HttpOnly; SameSite=Strict`);
        log("browser collaboration invite claimed", { remoteAddress: normalizedRemoteAddress(remoteAddress) });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/v1/collaboration") {
        if (!collaborationClient?.boardId) {
          bridgeText(response, 401, "此拾作协作会话已失效，请向白板主人重新获取邀请。\n");
          return;
        }
        const nonce = randomBytes(18).toString("base64url");
        bridgeHtml(response, collaborationBoardPage({ boardId: collaborationClient.boardId, nonce }), nonce);
        return;
      }
      if (request.method === "GET" && collaborationAssetMatch) {
        if (!collaborationClient?.boardId) {
          bridgeText(response, 401, "协作会话已失效\n");
          return;
        }
        try {
          const result = await requestPlugin("cards.asset", {
            boardId: collaborationClient.boardId,
            cardId: decodeURIComponent(collaborationAssetMatch[1])
          }, activeConfig, remoteAddress, request.headers["x-shizuo-client-name"], collaborationClient, "human");
          const match = /^data:(image\/(?:png|jpeg|gif|webp)|video\/(?:mp4|webm)|audio\/(?:mpeg|mp4|wav|ogg));base64,([A-Za-z0-9+/=]+)$/.exec(String(result?.dataUrl || ""));
          if (!match) throw new Error("卡片资源格式不受支持");
          const bytes = Buffer.from(match[2], "base64");
          if (!bytes.length || bytes.length > 48 * 1024 * 1024) throw new Error("卡片资源过大或为空");
          bridgeBinary(response, bytes, match[1]);
        } catch (error) {
          bridgeText(response, 404, error.message || "卡片资源不可用");
        }
        return;
      }
      if (request.method === "POST" && requestUrl.pathname === "/v1/collaboration/rpc") {
        if (!collaborationClient?.boardId) {
          bridgeJson(response, 401, { ok: false, error: "协作会话已失效" });
          return;
        }
        if (request.headers["x-shizuo-collaboration"] !== "1") {
          bridgeJson(response, 403, { ok: false, error: "协作请求校验失败" });
          return;
        }
        try {
          const body = await readBridgeBody(request);
          const method = String(body.method || "");
          const allowedMethods = new Set(["boards.get", "cards.create", "cards.update", "cards.connect", "collaboration.watch"]);
          if (!allowedMethods.has(method)) throw new Error("浏览器协作不支持此操作");
          const params = body.params && typeof body.params === "object" ? { ...body.params, boardId: collaborationClient.boardId } : { boardId: collaborationClient.boardId };
          const result = await requestPlugin(method, params, activeConfig, remoteAddress, request.headers["x-shizuo-client-name"], collaborationClient, "human");
          bridgeJson(response, 200, { ok: true, result });
        } catch (error) {
          bridgeJson(response, /权限|拒绝|只读|校验/.test(error.message) ? 403 : 400, { ok: false, error: error.message });
        }
        return;
      }
      if (request.method === "GET" && inviteMatch) {
        const invite = activeBridgeInvite(inviteMatch[1]);
        if (!invite || invite.kind !== "codex") {
          bridgeText(response, 410, "此拾作连接邀请已使用或已过期。\n");
          return;
        }
        bridgeText(response, 200, inviteMarkdown(invite), "text/markdown; charset=utf-8");
        return;
      }
      if (request.method === "POST" && installMatch) {
        const invite = activeBridgeInvite(installMatch[1]);
        if (!invite || invite.kind !== "codex") {
          bridgeText(response, 410, "此拾作连接邀请已使用或已过期。\n");
          return;
        }
        // 领取安装脚本前先作废邀请，避免并发请求重复取得长期连接令牌。
        bridgeInvites.delete(invite.code);
        const currentConfig = readActiveBridgeConfig(bridgeConfigPath);
        if (!currentConfig?.lan) {
          bridgeText(response, 410, "拾作内网共享已停止。\n");
          return;
        }
        registerBridgeClient(bridgeConfigPath, invite);
        bridgeText(response, 200, buildBridgeClientInstaller(invite), "text/plain; charset=utf-8");
        log("one-time bridge invite claimed", { remoteAddress: normalizedRemoteAddress(remoteAddress) });
        return;
      }
      const authorization = String(request.headers.authorization || "");
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : request.headers["x-shizuo-token"];
      const client = activeConfig ? authorizeBridgeClient(token, activeConfig, remoteAddress) : null;
      if (!client) {
        bridgeJson(response, 401, { ok: false, error: "连接令牌无效" });
        return;
      }
      if (request.method === "GET" && requestUrl.pathname === "/v1/status") {
        bridgeJson(response, 200, {
          ok: true,
          product: "拾作",
          hostVersion: HOST_VERSION,
          scope: activeConfig.lan ? "lan" : "local",
          boardId: client.boardId,
          allowDestructive: activeConfig.allowDestructive
        });
        return;
      }
      if (request.method !== "POST" || requestUrl.pathname !== "/v1/rpc") {
        bridgeJson(response, 404, { ok: false, error: "接口不存在" });
        return;
      }
      try {
        const body = await readBridgeBody(request);
        const method = String(body.method || "");
        const allowedMethods = new Set(["boards.list", "boards.get", "boards.create", "cards.search", "cards.create", "cards.update", "cards.connect", "cards.stream", "cards.delete", "collaboration.list", "collaboration.send", "collaboration.presence", "collaboration.watch", "collaboration.task"]);
        if (!allowedMethods.has(method)) throw new Error("不支持的白板操作");
        if (method === "cards.delete" && !activeConfig.allowDestructive) throw new Error("当前连接未开启删除权限");
        const result = await requestPlugin(
          method,
          body.params && typeof body.params === "object" ? body.params : {},
          activeConfig,
          remoteAddress,
          request.headers["x-shizuo-client-name"],
          client
        );
        bridgeJson(response, 200, { ok: true, requestId: String(body.requestId || ""), result });
      } catch (error) {
        log("bridge RPC rejected", { reason: error?.message || String(error) });
        bridgeJson(response, /权限|令牌/.test(error.message) ? 403 : 400, { ok: false, error: error.message });
      }
    });
    bridgeServer = server;
    await new Promise((resolve, reject) => {
      const rejectStartup = error => {
        if (bridgeServer === server) bridgeServer = undefined;
        reject(error);
      };
      server.once("error", rejectStartup);
      server.listen(config.port, config.bind, () => {
        server.off("error", rejectStartup);
        server.on("error", error => log("external bridge failed", { reason: error.message, bind: config.bind, port: config.port }));
        resolve();
      });
    });
    log("external bridge listening", { bind: config.bind, port: config.port, lan: config.lan, allowDestructive: config.allowDestructive });
    return config;
  }
  
  async function stopBridgeServer() {
    const server = bridgeServer;
    if (!server) return;
    bridgeServer = undefined;
    await new Promise(resolve => {
      server.close(resolve);
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    });
  }
  
  async function restartBridgeServer() {
    await stopBridgeServer();
    return startBridgeServer();
  }
  
  async function createBridgeShare(message) {
    const privateAddress = preferredPrivateIpv4();
    if (!privateAddress) throw new Error("未找到可用的内网 IPv4 地址，请先连接同一 Wi-Fi 或有线网络");
    const boardId = String(message.boardId || "");
    if (!boardId) throw new Error("请先打开要共享的白板");
    bridgeInvites.clear();
    const config = startLanShare(bridgeConfigPath);
    try {
      await restartBridgeServer();
    } catch (error) {
      stopLanShare(bridgeConfigPath);
      await restartBridgeServer().catch(restartError => {
        log("failed to restore local bridge", { reason: restartError.message });
      });
      throw error;
    }
    const endpoint = `http://${privateAddress}:${config.port}`;
    const code = randomBytes(24).toString("base64url");
    const collaborationCode = randomBytes(24).toString("base64url");
    const inviteUrl = `${endpoint}/v1/join/${code}`;
    const collaborationUrl = `${endpoint}/v1/collaborate/${collaborationCode}`;
    const invite = {
      code,
      kind: "codex",
      clientId: randomUUID(),
      clientToken: randomBytes(32).toString("base64url"),
      boardId,
      endpoint,
      inviteUrl,
      expiresAt: Date.now() + BRIDGE_INVITE_TTL_MS
    };
    const collaborationInvite = {
      code: collaborationCode,
      kind: "human",
      clientId: randomUUID(),
      clientToken: randomBytes(32).toString("base64url"),
      boardId,
      endpoint,
      inviteUrl: collaborationUrl,
      expiresAt: invite.expiresAt
    };
    bridgeInvites.set(code, invite);
    bridgeInvites.set(collaborationCode, collaborationInvite);
    const inviteText = [
      "连接我的拾作白板（同一可信内网，10 分钟内一次有效）。",
      "请在 Codex 终端直接执行下面命令，不要用 Chrome 打开链接：",
      `curl -fsS -X POST ${shellQuote(`${inviteUrl}/install`)} | zsh`,
      "安装完成后重启 Codex，再说“读取拾作白板”。"
    ].join("\n");
    log("one-time bridge invite created", { scope: "lan", port: config.port, expiresAt: invite.expiresAt });
    send({
      type: "bridge-share-created",
      id: String(message.id || ""),
      inviteUrl,
      inviteText,
      collaborationUrl,
      endpoint,
      expiresAt: invite.expiresAt,
      scope: "lan"
    });
  }
  
  async function stopBridgeShare(message) {
    bridgeInvites.clear();
    const config = stopLanShare(bridgeConfigPath);
    await restartBridgeServer();
    log("external bridge returned to local mode", { port: config.port });
    send({
      type: "bridge-share-stopped",
      id: String(message.id || ""),
      scope: "local"
    });
  }

  function shutdownCollaborationBridge() {
    for (const pending of pluginRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Chrome 已断开拾作插件桥接"));
    }
    pluginRequests.clear();
    bridgeInvites.clear();
    bridgeServer?.close();
    bridgeServer = undefined;
  }

  return Object.freeze({ revokeBridgeClientRequest, settlePluginRequest, startBridgeServer, createBridgeShare, stopBridgeShare, shutdownCollaborationBridge });
}
