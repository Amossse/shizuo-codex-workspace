import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app/core/pagedock-db.js", import.meta.url), "utf8");
const content = fs.readFileSync(new URL("../app/content/content-codex.js", import.meta.url), "utf8");
const context = { console, structuredClone, URL, crypto: { randomUUID: () => "test-id" } };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "pagedock-db.js" });

const normalize = context.PageDockDB.normalizePageChatUrl;
assert.equal(
  normalize("https://Example.com/article/?b=2&utm_source=test&a=1#part-2"),
  "https://example.com/article?a=1&b=2",
  "普通锚点和追踪参数不应拆分页面会话"
);
assert.notEqual(
  normalize("https://example.com/article?id=1"),
  normalize("https://example.com/article?id=2"),
  "有业务含义的查询参数必须区分页面会话"
);
assert.notEqual(
  normalize("https://example.com/#/document/1"),
  normalize("https://example.com/#/document/2"),
  "SPA hash 路由必须区分页面会话"
);

assert.match(source, /createIndex\("normalizedUrl", "normalizedUrl", \{ unique: true \}\)/, "页面会话必须使用唯一 URL 索引");
assert.match(source, /PAGE_CHAT_LIMIT = 200/, "页面会话必须有数量上限");
assert.match(source, /slice\(-30\)/, "单页会话必须限制消息数量");
assert.match(content, /input\.addEventListener\("paste"[\s\S]{0,500}attachImageFiles\(images\)/, "页面 Codex 输入框必须接收剪贴板图片");
assert.match(content, /images:\s*imageBatch/, "页面问题必须把粘贴图片发送给本地 Codex");
assert.match(content, /className = "compose-image"[\s\S]{0,600}移除图片/, "粘贴图片必须支持预览和移除");
assert.match(source, /imageCount:\s*Math\.min\(4/, "页面会话必须持久化图片数量而不是图片数据");
assert.match(content, /taskEvent/, "页面 Codex 必须能按任务 ID 找回错过的终态事件");
assert.match(content, /reconcileActiveTask/, "页面 Codex 忙碌时必须主动对账，不能无限停留在处理中");
assert.match(content, /SAVE_SELECTION_TO_INBOX_REQUEST/, "选区快捷菜单必须支持保存到收件箱");
assert.match(content, /saveSelectionToInbox\(text, button\)/, "选区保存必须展示明确的成功或失败反馈");

console.log("页面 Codex URL 会话索引契约验证通过");
