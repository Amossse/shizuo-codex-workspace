import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const root = path.resolve(new URL("../", import.meta.url).pathname);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function nativeFrame(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

async function testNativeBridge() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shizuo-bridge-test-"));
  const configPath = path.join(directory, "codex-bridge.json");
  const token = "test-token-abcdefghijklmnopqrstuvwxyz-123456";
  const port = await freePort();
  fs.writeFileSync(configPath, JSON.stringify({ enabled: true, bind: "127.0.0.1", port, lan: false, token, allowDestructive: false }));
  const child = spawn(process.execPath, [path.join(root, "native-host/pagedock-codex-host.mjs")], {
    env: {
      ...process.env,
      SHIZUO_BRIDGE_CONFIG: configPath,
      SHIZUO_BRIDGE_ADVERTISE_ADDRESS: "192.168.50.10",
      PAGEDOCK_ALLOWED_ORIGIN: ""
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  let nativeBuffer = Buffer.alloc(0);
  const nativeMessages = [];
  const nativeWaiters = [];
  child.stdout.on("data", chunk => {
    nativeBuffer = Buffer.concat([nativeBuffer, chunk]);
    while (nativeBuffer.length >= 4) {
      const length = nativeBuffer.readUInt32LE(0);
      if (nativeBuffer.length < length + 4) break;
      const message = JSON.parse(nativeBuffer.subarray(4, length + 4).toString("utf8"));
      nativeBuffer = nativeBuffer.subarray(length + 4);
      const waiter = nativeWaiters.shift();
      if (waiter) waiter(message);
      else nativeMessages.push(message);
    }
  });
  const nextNativeMessage = () => nativeMessages.length
    ? Promise.resolve(nativeMessages.shift())
    : new Promise(resolve => nativeWaiters.push(resolve));
  const started = new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr.on("data", chunk => {
      stderr += chunk.toString("utf8");
      if (stderr.includes("external bridge listening")) resolve();
    });
    child.on("exit", code => reject(new Error(`Native Host 提前退出：${code}\n${stderr}`)));
  });
  await started;

  const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/status`);
  if (unauthorized.status !== 401) throw new Error(`未授权请求应返回 401，实际 ${unauthorized.status}`);
  const status = await fetch(`http://127.0.0.1:${port}/v1/status`, { headers: { authorization: `Bearer ${token}` } });
  if (!status.ok || !(await status.json()).ok) throw new Error("桥接状态接口不可用");

  child.stdin.write(nativeFrame({ type: "bridge-share-create", id: "share-test", boardId: "board-1" }));
  const share = await nextNativeMessage();
  if (share.type !== "bridge-share-created" || share.id !== "share-test" || !share.inviteUrl) {
    throw new Error("Native Host 没有生成一次性内网邀请");
  }
  if (!share.inviteText?.includes("curl -fsS -X POST") || !share.inviteText.includes("| zsh") || !share.inviteText.includes("不要用 Chrome")) {
    throw new Error("一次性邀请没有提供绕过 Chrome 的终端直连命令");
  }
  if (share.inviteText.includes("打开这个地址")) {
    throw new Error("一次性邀请仍要求通过浏览器打开内网地址");
  }
  const localInviteUrl = new URL(share.inviteUrl);
  localInviteUrl.hostname = "127.0.0.1";
  const invitePage = await fetch(localInviteUrl);
  const inviteMarkdown = await invitePage.text();
  if (!invitePage.ok || !inviteMarkdown.includes("curl -fsS -X POST") || !inviteMarkdown.includes("| zsh")) {
    throw new Error("一次性邀请页没有提供自动安装命令");
  }
  const installer = await fetch(`${localInviteUrl}/install`, { method: "POST" });
  const installerScript = await installer.text();
  if (!installer.ok || !installerScript.includes("mcp add shizuo-lan") || !installerScript.includes("SHIZUO_BRIDGE_TOKEN")) {
    throw new Error("一次性邀请没有返回完整的 Codex 安装脚本");
  }
  const claimedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const activeOwnerToken = claimedConfig.token;
  const claimedClient = claimedConfig.clients?.find(client => client.boardId === "board-1");
  if (!claimedClient?.token || installerScript.includes(activeOwnerToken)) throw new Error("邀请没有使用独立的白板作用域客户端令牌");
  const scopedStatus = await fetch(`http://127.0.0.1:${port}/v1/status`, { headers: { authorization: `Bearer ${claimedClient.token}` } });
  const scopedPayload = await scopedStatus.json();
  if (!scopedStatus.ok || scopedPayload.boardId !== "board-1") throw new Error("客户端令牌没有绑定共享白板");
  const scopedRpcPromise = fetch(`http://127.0.0.1:${port}/v1/rpc`, {
    method: "POST",
    headers: { authorization: `Bearer ${claimedClient.token}`, "content-type": "application/json" },
    body: JSON.stringify({ method: "boards.get", params: { boardId: "board-2" } })
  });
  const scopedPluginRequest = await nextNativeMessage();
  if (scopedPluginRequest.remote?.boardId !== "board-1" || scopedPluginRequest.remote?.clientId !== claimedClient.id) {
    throw new Error("Native Host 没有向插件传递不可伪造的白板作用域");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: scopedPluginRequest.requestId, ok: false, error: "此接入者仅获授权访问当前共享白板" }));
  const deniedScopedRpc = await scopedRpcPromise;
  if (deniedScopedRpc.ok) throw new Error("越权白板请求没有被拒绝");
  const reusedInvite = await fetch(`${localInviteUrl}/install`, { method: "POST" });
  if (reusedInvite.status !== 410) throw new Error(`一次性邀请可被重复领取，实际状态 ${reusedInvite.status}`);

  if (!share.collaborationUrl) throw new Error("共享邀请缺少浏览器协作链接");
  const collaborationUrl = new URL(share.collaborationUrl);
  collaborationUrl.hostname = "127.0.0.1";
  const collaborationLanding = await fetch(collaborationUrl, { redirect: "manual" });
  const collaborationLandingHtml = await collaborationLanding.text();
  if (!collaborationLanding.ok || !collaborationLandingHtml.includes("加入白板协作") || !collaborationLandingHtml.includes("进入协作白板")) {
    throw new Error("浏览器协作邀请没有返回用户确认页");
  }
  const collaborationClaim = await fetch(`${collaborationUrl}/claim`, { method: "POST", redirect: "manual" });
  const collaborationCookie = collaborationClaim.headers.get("set-cookie")?.split(";", 1)[0] || "";
  if (collaborationClaim.status !== 303 || collaborationClaim.headers.get("location") !== "/v1/collaboration" || !collaborationCookie.includes("shizuo_collaboration=")) {
    throw new Error("浏览器协作邀请没有建立安全会话");
  }
  const collaborationPage = await fetch(`http://127.0.0.1:${port}/v1/collaboration`, { headers: { cookie: collaborationCookie } });
  const collaborationHtml = await collaborationPage.text();
  if (!collaborationPage.ok || !collaborationHtml.includes("浏览器协作") || !collaborationHtml.includes("新建卡片") || !collaborationHtml.includes("collaboration.watch") || !collaborationHtml.includes("beginCanvasPan") || !collaborationPage.headers.get("content-security-policy")?.includes("frame-ancestors 'none'")) {
    throw new Error("浏览器协作页缺少实时编辑界面或安全响应头");
  }
  const guestBoardPromise = fetch(`http://127.0.0.1:${port}/v1/collaboration/rpc`, {
    method: "POST",
    headers: { cookie: collaborationCookie, "content-type": "application/json", "x-shizuo-collaboration": "1", "x-shizuo-client-name": encodeURIComponent("小王") },
    body: JSON.stringify({ method: "boards.get", params: { boardId: "board-2" } })
  });
  const guestBoardRequest = await nextNativeMessage();
  if (guestBoardRequest.method !== "boards.get" || guestBoardRequest.params?.boardId !== "board-1" || guestBoardRequest.remote?.clientType !== "human" || guestBoardRequest.remote?.clientName !== "小王") {
    throw new Error("浏览器协作请求没有强制当前白板作用域或协作者身份");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: guestBoardRequest.requestId, ok: true, result: { id: "board-1", name: "测试白板", items: [], revision: 1 } }));
  const guestBoardResponse = await guestBoardPromise;
  if (!guestBoardResponse.ok || (await guestBoardResponse.json()).result?.id !== "board-1") throw new Error("浏览器协作页无法读取共享白板");
  const guestEditPromise = fetch(`http://127.0.0.1:${port}/v1/collaboration/rpc`, {
    method: "POST",
    headers: { cookie: collaborationCookie, "content-type": "application/json", "x-shizuo-collaboration": "1", "x-shizuo-client-name": encodeURIComponent("小王") },
    body: JSON.stringify({ method: "cards.update", params: { boardId: "board-2", cardId: "card-1", expectedUpdatedAt: 1, patch: { text: "协作修改" } } })
  });
  const guestEditRequest = await nextNativeMessage();
  if (guestEditRequest.method !== "cards.update" || guestEditRequest.params?.boardId !== "board-1" || guestEditRequest.capabilities?.requireVersion !== true) {
    throw new Error("浏览器协作编辑没有沿用作用域和版本冲突保护");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: guestEditRequest.requestId, ok: true, result: { id: "card-1", text: "协作修改" } }));
  if (!(await guestEditPromise).ok) throw new Error("浏览器协作编辑结果没有返回访客页");
  const guestAssetPromise = fetch(`http://127.0.0.1:${port}/v1/collaboration/assets/card-image`, { headers: { cookie: collaborationCookie } });
  const guestAssetRequest = await nextNativeMessage();
  if (guestAssetRequest.method !== "cards.asset" || guestAssetRequest.params?.boardId !== "board-1" || guestAssetRequest.params?.cardId !== "card-image") {
    throw new Error("浏览器卡片资源请求没有强制当前白板作用域");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: guestAssetRequest.requestId, ok: true, result: { dataUrl: "data:image/png;base64,iVBORw0KGgo=" } }));
  const guestAssetResponse = await guestAssetPromise;
  if (!guestAssetResponse.ok || guestAssetResponse.headers.get("content-type") !== "image/png" || !(await guestAssetResponse.arrayBuffer()).byteLength) {
    throw new Error("浏览器协作页无法读取受保护的内嵌图片");
  }
  const reusedCollaborationInvite = await fetch(collaborationUrl);
  if (reusedCollaborationInvite.status !== 410) throw new Error("浏览器协作邀请可被第二个访客重复领取");

  const rpcResponsePromise = fetch(`http://127.0.0.1:${port}/v1/rpc`, {
    method: "POST",
    headers: { authorization: `Bearer ${activeOwnerToken}`, "content-type": "application/json", "x-shizuo-client-name": encodeURIComponent("同事的 Codex") },
    body: JSON.stringify({ method: "boards.list", params: {} })
  });
  const pluginRequest = await nextNativeMessage();
  if (pluginRequest.type !== "plugin-request" || pluginRequest.method !== "boards.list" || pluginRequest.remote?.clientName !== "同事的 Codex") {
    throw new Error("桥接没有携带客户端身份转发白板请求");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: pluginRequest.requestId, ok: true, result: [{ id: "board-1", name: "测试白板" }] }));
  const rpcResponse = await rpcResponsePromise;
  const rpcPayload = await rpcResponse.json();
  if (!rpcResponse.ok || rpcPayload.result?.[0]?.id !== "board-1") throw new Error("插件响应没有返回给 HTTP 调用方");

  const taskResponsePromise = fetch(`http://127.0.0.1:${port}/v1/rpc`, {
    method: "POST",
    headers: { authorization: `Bearer ${activeOwnerToken}`, "content-type": "application/json", "x-shizuo-client-name": encodeURIComponent("同事的 Codex") },
    body: JSON.stringify({ method: "collaboration.task", params: { taskId: "task-1", phase: "running", title: "整理白板", revision: 2 } })
  });
  const taskPluginRequest = await nextNativeMessage();
  if (taskPluginRequest.method !== "collaboration.task" || taskPluginRequest.params?.taskId !== "task-1") {
    throw new Error("Native Host 没有转发 Codex 任务状态");
  }
  child.stdin.write(nativeFrame({ type: "plugin-response", requestId: taskPluginRequest.requestId, ok: true, result: { task: { taskId: "task-1", phase: "running" } } }));
  const taskResponse = await taskResponsePromise;
  if (!taskResponse.ok || (await taskResponse.json()).result?.task?.phase !== "running") throw new Error("Codex 任务状态没有返回给 MCP");

  child.stdin.write(nativeFrame({ type: "bridge-share-stop", id: "share-stop-test" }));
  const stopped = await nextNativeMessage();
  if (stopped.type !== "bridge-share-stopped" || stopped.scope !== "local") throw new Error("停止共享没有恢复仅本机模式");
  const stoppedConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (stoppedConfig.bind !== "127.0.0.1" || stoppedConfig.allowDestructive !== false) {
    throw new Error("停止共享后的桥接权限不安全");
  }
  if (stoppedConfig.clients?.length) throw new Error("停止共享后仍保留远端客户端令牌");
  const stoppedCollaboration = await fetch(`http://127.0.0.1:${port}/v1/collaboration`, { headers: { cookie: collaborationCookie } });
  if (stoppedCollaboration.status !== 401) throw new Error("停止共享后浏览器协作会话仍然有效");

  child.stdin.end();
  await once(child, "exit");
  fs.rmSync(directory, { recursive: true, force: true });
}

async function testMcpAdapter() {
  const token = "mcp-test-token";
  const receivedMethods = [];
  const server = http.createServer((request, response) => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(401).end();
      return;
    }
    if (!request.headers["x-shizuo-client-name"]) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "缺少客户端身份" }));
      return;
    }
    const chunks = [];
    request.on("data", chunk => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      receivedMethods.push(body.method);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, result: body.method === "boards.list" ? [{ id: "mcp-board" }] : {} }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  const child = spawn(process.execPath, [path.join(root, "native-host/shizuo-mcp-server.mjs")], {
    env: { ...process.env, SHIZUO_BRIDGE_URL: `http://127.0.0.1:${port}`, SHIZUO_BRIDGE_TOKEN: token },
    stdio: ["pipe", "pipe", "pipe"]
  });
  const lines = [];
  const waiters = [];
  let output = "";
  child.stdout.on("data", chunk => {
    output += chunk.toString("utf8");
    const parts = output.split("\n");
    output = parts.pop();
    for (const line of parts.filter(Boolean)) {
      const message = JSON.parse(line);
      const waiter = waiters.shift();
      if (waiter) waiter(message);
      else lines.push(message);
    }
  });
  const nextLine = () => lines.length ? Promise.resolve(lines.shift()) : new Promise(resolve => waiters.push(resolve));
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })}\n`);
  const initialized = await nextLine();
  if (initialized.result?.serverInfo?.name !== "shizuo-whiteboard") throw new Error("MCP initialize 响应不正确");
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`);
  const listed = await nextLine();
  if (!listed.result?.tools?.some(tool => tool.name === "shizuo_get_board")) throw new Error("MCP 工具列表不完整");
  if (!listed.result?.tools?.some(tool => tool.name === "shizuo_search_cards")) throw new Error("MCP 缺少跨白板搜索工具");
  if (!listed.result?.tools?.some(tool => tool.name === "shizuo_watch_events")) throw new Error("MCP 缺少协作事件订阅工具");
  if (!listed.result?.tools?.some(tool => tool.name === "shizuo_report_task")) throw new Error("MCP 缺少 Codex 任务状态上报工具");
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "shizuo_list_boards", arguments: {} } })}\n`);
  const called = await nextLine();
  if (!called.result?.content?.[0]?.text?.includes("mcp-board")) throw new Error("MCP 没有调用拾作 HTTP 桥接");
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "shizuo_report_task", arguments: { taskId: "task-2", phase: "completed", result: "整理完成", revision: 3 } } })}\n`);
  const reported = await nextLine();
  if (reported.result?.isError || !receivedMethods.includes("collaboration.task")) throw new Error("MCP 没有上报 Codex 任务结果");
  child.stdin.end();
  await once(child, "exit");
  await new Promise(resolve => server.close(resolve));
}

await testNativeBridge();
await testMcpAdapter();
console.log("拾作 Codex 外部桥接验证通过");
