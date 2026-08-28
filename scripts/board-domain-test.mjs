import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../board-domain.js", import.meta.url), "utf8");
const context = { console, structuredClone };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: "board-domain.js" });
const domain = context.PageDockBoardDomain;
vm.runInNewContext(fs.readFileSync(new URL("../card-protocol.js", import.meta.url), "utf8"), context, { filename: "card-protocol.js" });
const protocol = context.PageDockCardProtocol;

const base = {
  id: "board-1",
  name: "原白板",
  viewport: { zoom: 1 },
  items: [{ id: "card-1", boardId: "board-1", type: "text", text: "原文", x: 10, y: 10, updatedAt: 1 }]
};
const current = structuredClone(base);
current.items[0].x = 80;
current.items[0].updatedAt = 2;
const next = structuredClone(base);
next.items[0].text = "本地新文";
next.items[0].updatedAt = 3;

const merged = domain.mergeBoard(base, current, next);
assert.equal(merged.conflicts.length, 0, "不同字段的并发变更应自动合并");
assert.equal(merged.board.items[0].x, 80);
assert.equal(merged.board.items[0].text, "本地新文");

const conflicting = structuredClone(next);
current.items[0].text = "远端新文";
const rejected = domain.mergeBoard(base, current, conflicting);
assert.equal(rejected.conflicts[0]?.cardId, "card-1", "同字段并发变更必须报告卡片冲突");
assert(rejected.conflicts[0]?.fields.includes("text"));

const revision = domain.createRevision(base, merged.board, {
  revision: 2,
  actor: { id: "owner", name: "白板用户" },
  reason: "编辑卡片"
});
assert.equal(revision.itemChanges.length, 1, "版本只记录发生变化的卡片");
assert.equal(revision.itemChanges[0].before.text, "原文");
assert.equal(revision.itemChanges[0].after.text, "本地新文");
const restored = domain.applyRevision(merged.board, revision, "backward");
assert.equal(restored.items[0].text, "原文", "版本必须可以恢复卡片内容");
assert.equal(restored.items[0].x, 10, "版本必须可以恢复卡片位置");

const embedded = `data:image/png;base64,${"A".repeat(20_000)}`;
const mediaBefore = { id: "media", boardId: "board-1", type: "image", src: embedded, x: 0, y: 0 };
const mediaAfter = { ...mediaBefore, x: 80 };
const mediaRevision = domain.createRevision({ id: "board-1", items: [mediaBefore] }, { id: "board-1", items: [mediaAfter] });
assert.equal(mediaRevision.itemChanges[0].sharedEmbeddedSrc, embedded, "相同媒体二进制在单个版本中只能保存一次");
assert.equal(mediaRevision.itemChanges[0].before.src, undefined);
assert.equal(mediaRevision.itemChanges[0].after.src, undefined);
assert.equal(domain.applyRevision({ id: "board-1", items: [mediaAfter] }, mediaRevision, "backward").items[0].src, embedded, "压缩后的媒体版本必须仍可恢复");

const searchDocument = domain.toSearchDocument(
  { id: "board-1", name: "研究白板" },
  {
    id: "card-search",
    boardId: "board-1",
    type: "task",
    text: "分析飞书虚拟滚动",
    src: `data:image/png;base64,${"A".repeat(1000)}`,
    taskResult: "需要定位内部滚动容器",
    source: { title: "飞书文档", url: "https://example.com/wiki" },
    updatedAt: 10
  }
);
assert.doesNotMatch(searchDocument.searchText, /base64|AAAA/, "搜索索引不能复制嵌入式二进制");
const searchResults = domain.searchDocuments([searchDocument], "飞书 滚动", { limit: 10 });
assert.equal(searchResults.length, 1, "跨白板搜索必须匹配卡片内容和来源");
assert.equal(searchResults[0].boardId, "board-1");

const workflowBoard = {
  id: "workflow-board",
  name: "内容工作流",
  viewport: { zoom: 1 },
  items: [
    { id: "source", boardId: "workflow-board", type: "document", text: "素材", x: 10, y: 10, card: { permissions: { requested: [], granted: [] }, inputs: [] } },
    {
      id: "task",
      boardId: "workflow-board",
      type: "task",
      text: "总结素材",
      x: 400,
      y: 10,
      relationSourceIds: ["source"],
      taskSourceIds: ["source"],
      taskStatus: "running",
      taskRunId: "run-1",
      taskWorkflowLens: "skill",
      taskWorkflowInstruction: "每次都总结最新素材",
      taskWorkflowRunId: "workflow-run-1",
      taskSchedule: { enabled: true, repeat: "daily", nextRunAt: 1000 },
      taskMessages: [{ role: "assistant", text: "旧结果" }],
      card: { permissions: { requested: ["codex-run"], granted: ["codex-run"] }, inputs: [{ id: "link", sourceId: "source", targetId: "task" }] }
    }
  ]
};
const template = domain.createTemplate(workflowBoard, { id: "template-1", name: "总结工作流" });
assert.equal(template.cards[1].taskRunId, "", "模板不能保留运行中的任务");
assert.equal(template.cards[1].taskMessages.length, 0, "模板不能复用旧对话结果");
assert.equal(template.cards[1].taskWorkflowLens, "skill", "模板必须保留工作流成长视角");
assert.equal(template.cards[1].taskWorkflowInstruction, "每次都总结最新素材", "模板必须保留可复用的步骤指令");
assert.equal(template.cards[1].taskWorkflowRunId, "", "模板不能携带旧工作流运行批次");
assert.equal(template.cards[1].taskSchedule, null, "模板不能复制活动中的定时规则");
assert.equal(template.cards[1].card.permissions.granted.length, 0, "模板不能携带授权");
let idCounter = 0;
const instantiated = domain.instantiateTemplate(template, { makeId: prefix => `${prefix}-${++idCounter}`, now: 100 });
assert.notEqual(instantiated.items[0].id, "source");
assert.equal(instantiated.items[1].taskSourceIds[0], instantiated.items[0].id, "模板实例化必须重映射关系");
assert.equal(instantiated.items[1].provenance.operation, "template-instantiate", "模板创建的卡片必须记录来源");

const connectedTarget = { id: "target", boardId: "board-1", type: "task", revision: 4 };
protocol.connect({ id: "source", boardId: "board-1", type: "text", revision: 7 }, connectedTarget);
assert.equal(connectedTarget.provenance.parents[0].cardRevision, 7, "连接必须固定上游卡片版本");
assert.equal(connectedTarget.provenance.operation, "connect");

const workflow = domain.planWorkflow([
  { id: "collect", type: "task", taskSourceIds: [] },
  { id: "summarize", type: "task", taskSourceIds: ["collect"] },
  { id: "publish", type: "task", relationSourceIds: ["summarize"] }
]);
assert.equal(JSON.stringify(workflow.waves), JSON.stringify([["collect"], ["summarize"], ["publish"]]));
assert.equal(JSON.stringify(workflow.cycles), "[]");
const workflowLanes = domain.partitionWorkflowWave(
  ["research", "draft", "image-a", "image-b", "video"],
  id => ({ "image-a": "image-gen", "image-b": "image-gen", video: "video" })[id] || "coding"
);
assert.equal(JSON.stringify(workflowLanes.parallel), JSON.stringify(["research", "draft"]), "普通步骤应该保留并行执行");
assert.equal(JSON.stringify(workflowLanes.serial), JSON.stringify(["image-a", "image-b", "video"]), "图片和视频必须遵守本地单任务资源限制");
const cyclicWorkflow = domain.planWorkflow([
  { id: "a", type: "task", taskSourceIds: ["b"] },
  { id: "b", type: "task", taskSourceIds: ["a"] }
]);
assert.equal(JSON.stringify([...cyclicWorkflow.cycles].sort()), JSON.stringify(["a", "b"]));

const dynamicWorkflow = domain.normalizeWorkflowPlan({
  title: "热点内容生产",
  steps: [
    { id: "research", title: "查询热点", instruction: "查询今天的 AI 热点", mode: "coding" },
    { id: "image", title: "生成图片", instruction: "生成热点信息图", mode: "image-gen", dependsOn: ["research"] },
    { id: "video", title: "生成视频", instruction: "生成解释视频", mode: "video", dependsOn: ["research", "image"] }
  ]
});
assert.equal(JSON.stringify(dynamicWorkflow.waves), JSON.stringify([["research"], ["image"], ["video"]]), "动态计划必须形成可执行波次");
assert.equal(dynamicWorkflow.steps[1].mode, "image-gen");
assert.throws(() => domain.normalizeWorkflowPlan({ steps: [
  { id: "a", instruction: "A", dependsOn: ["b"] },
  { id: "b", instruction: "B", dependsOn: ["a"] }
] }), /循环依赖/, "动态计划不能接受环");
assert.throws(() => domain.normalizeWorkflowPlan({ steps: [
  { id: "same", instruction: "A" },
  { id: "same", instruction: "B" }
] }), /ID 重复/, "动态计划不能接受重复步骤 ID");
assert.throws(() => domain.normalizeWorkflowPlan({ steps: [
  { id: "bad-mode", instruction: "A", mode: "unknown" }
] }), /不支持的执行方式/, "动态计划不能把未知执行方式静默降级为 coding");

const dailySchedule = domain.advanceTaskSchedule({ enabled: true, repeat: "daily", nextRunAt: new Date("2026-08-15T09:00:00").getTime() }, new Date("2026-08-16T10:00:00").getTime());
assert.equal(new Date(dailySchedule.nextRunAt).getDate(), 17, "错过的每日任务必须推进到未来，而不是连续补跑");
const oneTimeSchedule = domain.advanceTaskSchedule({ enabled: true, repeat: "once", nextRunAt: Date.now() }, Date.now());
assert.equal(oneTimeSchedule.enabled, false, "单次任务触发后必须自动关闭");
const workflowSchedule = domain.normalizeTaskSchedule({ enabled: true, execution: "workflow", repeat: "weekly", nextRunAt: 1000, retryAt: 500 });
assert.equal(workflowSchedule.execution, "workflow", "定时规则必须区分普通任务与动态工作流");
assert.equal(workflowSchedule.retryAt, 500, "临时重试不能覆盖周期执行锚点");
const retriedWeeklySchedule = domain.beginTaskScheduleRun(workflowSchedule, 500);
assert.equal(retriedWeeklySchedule.nextRunAt, 1000, "重试执行不能把每周锚点额外推进一轮");
assert.equal(retriedWeeklySchedule.retryAt, 0, "重试开始后必须清除临时重试时间");
assert.equal(domain.workflowLens("strategy").label, "格局提升", "成长视角必须返回稳定的用户语言");
assert.equal(domain.workflowLens("unknown").id, "general", "未知成长视角必须安全回退到通用规划");
assert.match(domain.workflowPlanningPrompt("查询热点", "perspective"), /成长视角：视野拓展[\s\S]*用户目标：查询热点/, "页面与后台必须复用同一份工作流规划契约");

console.log("白板领域并发合并验证通过");
