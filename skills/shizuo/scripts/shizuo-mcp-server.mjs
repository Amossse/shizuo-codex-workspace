#!/usr/bin/env node

import fs from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

const configPath = process.env.SHIZUO_BRIDGE_CONFIG
  || path.join(os.homedir(), "Library", "Application Support", "PageDock", "codex-bridge.json");
let localConfig = {};
try {
  localConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch {}
const bridgeUrl = String(process.env.SHIZUO_BRIDGE_URL || `http://127.0.0.1:${Number(localConfig.port) || 43_127}`).replace(/\/$/, "");
const bridgeToken = String(process.env.SHIZUO_BRIDGE_TOKEN || localConfig.token || "");
const clientName = String(process.env.SHIZUO_CLIENT_NAME || os.hostname() || "Codex").replace(/[\r\n\t]/g, " ").trim().slice(0, 80);

const tools = [
  {
    name: "shizuo_list_boards",
    description: "列出拾作中的白板和卡片数量。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "shizuo_get_board",
    description: "读取一个拾作白板中的卡片内容；内容较多时使用 nextOffset 继续读取。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        offset: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        includeArchived: { type: "boolean" }
      },
      required: ["boardId"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_search_cards",
    description: "跨白板搜索卡片内容和来源；共享接入只会返回被授权白板。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 500 },
        boardId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_create_board",
    description: "创建一个新的拾作白板。",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", maxLength: 80 } },
      required: ["name"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_create_card",
    description: "在拾作白板中创建文字、文档、代码、图片、链接、页面或任务卡片。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        card: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["text", "document", "code", "image", "link", "page", "task"] },
            text: { type: "string" },
            src: { type: "string" },
            alt: { type: "string" },
            pageContent: { type: "string" },
            documentLanguage: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" }
          },
          required: ["type"],
          additionalProperties: false
        }
      },
      required: ["boardId", "card"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_update_card",
    description: "更新拾作卡片的正文、地址、语言或画布位置尺寸。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        cardId: { type: "string" },
        expectedUpdatedAt: { type: "number" },
        patch: {
          type: "object",
          properties: {
            text: { type: "string" },
            src: { type: "string" },
            alt: { type: "string" },
            pageContent: { type: "string" },
            documentLanguage: { type: "string" },
            x: { type: "number" },
            y: { type: "number" },
            width: { type: "number" },
            height: { type: "number" }
          },
          additionalProperties: false
        }
      },
      required: ["boardId", "cardId", "expectedUpdatedAt", "patch"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_connect_cards",
    description: "在同一白板的两张卡片之间建立内容连线。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        sourceCardId: { type: "string" },
        targetCardId: { type: "string" },
        expectedTargetUpdatedAt: { type: "number" },
        contentType: { type: "string" }
      },
      required: ["boardId", "sourceCardId", "targetCardId", "expectedTargetUpdatedAt"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_stream_card",
    description: "单次审批后把较长正文渐进呈现在卡片中；更新前必须使用最新 updatedAt。",
    inputSchema: { type: "object", properties: { boardId: { type: "string" }, cardId: { type: "string" }, expectedUpdatedAt: { type: "number" }, text: { type: "string", maxLength: 30000 }, mode: { type: "string", enum: ["replace", "append"] } }, required: ["boardId", "cardId", "expectedUpdatedAt", "text"], additionalProperties: false }
  },
  {
    name: "shizuo_list_messages",
    description: "读取当前共享白板中的协作评论和 @Codex 消息。",
    inputSchema: { type: "object", properties: { boardId: { type: "string" } }, additionalProperties: false }
  },
  {
    name: "shizuo_watch_events",
    description: "等待拾作白板的新协作消息、活动或在场状态；用返回的 cursor 继续订阅。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        after: { type: "integer", minimum: 0 },
        timeoutMs: { type: "integer", minimum: 0, maximum: 25000 }
      },
      additionalProperties: false
    }
  },
  {
    name: "shizuo_send_message",
    description: "向白板协作面板发送消息，可关联到一张卡片。",
    inputSchema: { type: "object", properties: { boardId: { type: "string" }, cardId: { type: "string" }, text: { type: "string", maxLength: 4000 } }, required: ["text"], additionalProperties: false }
  },
  {
    name: "shizuo_update_presence",
    description: "更新 Codex 在共享画布上的光标、选区和当前状态。",
    inputSchema: { type: "object", properties: { boardId: { type: "string" }, cardIds: { type: "array", items: { type: "string" }, maxItems: 20 }, x: { type: "number" }, y: { type: "number" }, state: { type: "string", maxLength: 80 } }, additionalProperties: false }
  },
  {
    name: "shizuo_report_task",
    description: "向拾作上报当前 Codex 任务的用户可读状态和最终结果；不要上报隐藏推理、令牌或敏感日志。",
    inputSchema: {
      type: "object",
      properties: {
        taskId: { type: "string", maxLength: 120 },
        boardId: { type: "string" },
        phase: { type: "string", enum: ["started", "running", "waiting_approval", "completed", "failed", "cancelled"] },
        title: { type: "string", maxLength: 160 },
        message: { type: "string", maxLength: 1000 },
        progress: { type: "number", minimum: 0, maximum: 100 },
        result: { type: "string", maxLength: 12000 },
        cardIds: { type: "array", items: { type: "string" }, maxItems: 20 },
        revision: { type: "integer", minimum: 0 }
      },
      required: ["taskId", "phase"],
      additionalProperties: false
    }
  },
  {
    name: "shizuo_delete_cards",
    description: "删除拾作卡片。只有桥接配置显式开启删除权限时可用。",
    inputSchema: {
      type: "object",
      properties: {
        boardId: { type: "string" },
        cardIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 }
      },
      required: ["boardId", "cardIds"],
      additionalProperties: false
    }
  }
];

const methodByTool = Object.freeze({
  shizuo_list_boards: "boards.list",
  shizuo_get_board: "boards.get",
  shizuo_search_cards: "cards.search",
  shizuo_create_board: "boards.create",
  shizuo_create_card: "cards.create",
  shizuo_update_card: "cards.update",
  shizuo_connect_cards: "cards.connect",
  shizuo_stream_card: "cards.stream",
  shizuo_list_messages: "collaboration.list",
  shizuo_watch_events: "collaboration.watch",
  shizuo_send_message: "collaboration.send",
  shizuo_update_presence: "collaboration.presence",
  shizuo_report_task: "collaboration.task",
  shizuo_delete_cards: "cards.delete"
});

async function bridgeRpc(method, params) {
  if (!bridgeToken) throw new Error("缺少拾作连接令牌；请先运行 configure-bridge.mjs");
  const response = await fetch(`${bridgeUrl}/v1/rpc`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bridgeToken}`,
      "x-shizuo-client-name": encodeURIComponent(clientName),
      "content-type": "application/json"
    },
    body: JSON.stringify({ requestId: randomUUID(), method, params }),
    // 远端写操作可能需要等待白板用户确认，超时略长于 Native Host 的审批窗口。
    signal: AbortSignal.timeout(65_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || `拾作桥接返回 HTTP ${response.status}`);
  return payload.result;
}

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "shizuo-whiteboard", version: "1.3.0" }
      }
    });
    return;
  }
  if (message.method === "ping") {
    write({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }
  if (message.method === "tools/list") {
    write({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }
  if (message.method === "tools/call") {
    const toolName = String(message.params?.name || "");
    const method = methodByTool[toolName];
    if (!method) throw new Error(`未知的拾作工具：${toolName}`);
    try {
      const result = await bridgeRpc(method, message.params?.arguments || {});
      write({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
    } catch (error) {
      write({ jsonrpc: "2.0", id: message.id, result: { isError: true, content: [{ type: "text", text: error.message }] } });
    }
    return;
  }
  if (message.id !== undefined) {
    write({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } });
  }
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", line => {
  if (!line.trim()) return;
  try {
    const message = JSON.parse(line);
    Promise.resolve(handle(message)).catch(error => {
      if (message.id !== undefined) write({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: error.message } });
    });
  } catch (error) {
    process.stderr.write(`[shizuo-mcp] ${error.message}\n`);
  }
});
