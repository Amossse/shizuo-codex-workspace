import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { backgroundScriptFiles, nativeHostModuleFiles, readBackgroundSource, readWhiteboardSource, readWhiteboardStyles, whiteboardScriptFiles } from "./source-utils.mjs";

const root = new URL("../", import.meta.url).pathname;
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(file) {
  return readFileSync(join(root, file), "utf8");
}

function verifyJavaScript() {
  const files = [
    "app/background/index.js",
    "app/content/content-capture.js",
    "app/content/content-codex.js",
    "app/core/card-protocol.js",
    "app/core/board-domain.js",
    "app/core/pagedock-db.js",
    "app/pages/editor/editor.js",
    "app/pages/offscreen/offscreen.js",
    "app/pages/popup/popup.js",
    "app/pages/sidepanel/sidepanel.js"
  ]
    .concat(whiteboardScriptFiles(), backgroundScriptFiles())
    .concat(nativeHostModuleFiles());
  for (const file of files) {
    try {
      execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "pipe" });
    } catch (error) {
      failures.push(`${file} 语法检查失败：${String(error.stderr || error.message).trim()}`);
    }
  }
}

function verifySourceLineLimits() {
  const extensions = new Set([".js", ".mjs", ".py", ".sh", ".html", ".css"]);
  const excluded = new Set([".git", "artifacts", "node_modules", "vendor"]);
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        const relative = absolute.slice(root.length);
        const lineCount = readFileSync(absolute, "utf8").split("\n").length - 1;
        check(lineCount <= 1000, `${relative} 有 ${lineCount} 行，首方源文件不得超过 1000 行`);
      }
    }
  };
  visit(root);
}

function verifyHtmlContract(htmlFile, jsFile, source = read(jsFile)) {
  const html = read(htmlFile);
  const js = source;
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(!duplicates.length, `${htmlFile} 存在重复 id：${duplicates.join("、")}`);
  const references = [...js.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]);
  const missing = [...new Set(references.filter(id => !ids.includes(id)))];
  check(!missing.length, `${jsFile} 引用了 ${htmlFile} 中不存在的 id：${missing.join("、")}`);
}

function stripCssNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
}

function verifyCssBraces(file, source) {
  let depth = 0;
  let minimum = 0;
  for (const character of stripCssNoise(source)) {
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      minimum = Math.min(minimum, depth);
    }
  }
  check(depth === 0 && minimum === 0, `${file} 的 CSS 大括号不平衡`);
}

const manifest = JSON.parse(read("manifest.json"));
const packageJson = JSON.parse(read("package.json"));
check(manifest.version === packageJson.version, "manifest.json 与 package.json 版本不一致");
check(Array.isArray(manifest.optional_host_permissions), "缺少页面卡所需的可选域名权限声明");
check(manifest.optional_host_permissions?.includes("https://*/*"), "缺少 HTTPS 可选域名权限");

[
  "app/pages/whiteboard/index.html",
  "app/pages/whiteboard/modules/bootstrap.js",
  "app/pages/whiteboard/modules/whiteboard.css",
  "app/background/modules/runtime-context.js",
  "app/pages/popup/popup.html",
  "app/pages/sidepanel/sidepanel.html",
  "app/content/content-codex.js",
  "app/core/card-protocol.js",
  "app/core/board-domain.js",
  "app/core/pagedock-db.js",
  "scripts/page-chat-contract.mjs",
  "vendor/xterm/xterm.js",
  "vendor/xterm/xterm.css",
  "native-host/configure-bridge.mjs",
  "native-host/bridge-auth.mjs",
  "native-host/bridge-config.mjs",
  "native-host/shizuo-mcp-server.mjs",
  "native-host/runtime-utils.mjs",
  "skills/shizuo/SKILL.md",
  "skills/shizuo/REFERENCE.md",
  "skills/shizuo/scripts/shizuo.sh",
  "skills/shizuo/scripts/bridge-status.mjs",
  "skills/shizuo/scripts/health-check.mjs",
  "skills/shizuo/scripts/shizuo-mcp-server.mjs",
  "icons/icon32.png"
].forEach(file => check(existsSync(join(root, file)), `缺少运行文件：${file}`));

check(read("skills/shizuo/SKILL.md").split("\n").length <= 100, "拾作 Skill 主说明超过 100 行");
check(/name:\s*shizuo/.test(read("skills/shizuo/SKILL.md")), "拾作 Skill 缺少正确名称");
check(/Use when/.test(read("skills/shizuo/SKILL.md")), "拾作 Skill 描述缺少触发条件");
check(read("native-host/shizuo-mcp-server.mjs") === read("skills/shizuo/scripts/shizuo-mcp-server.mjs"), "Native Host 与 Skill 的 MCP 适配器已漂移");

const backgroundSource = readBackgroundSource();
const pageCodexSource = read("app/content/content-codex.js");
const whiteboardSource = readWhiteboardSource();
const whiteboardHtml = read("app/pages/whiteboard/index.html");
const whiteboardStyles = readWhiteboardStyles();
check(/#topbar:has\(details\.menu\[open\]\)\s*\{[^}]*z-index:\s*95\b/.test(whiteboardStyles), "顶部菜单展开时必须高于协作面板");
check(/body\[data-onboarding="first-run"\] \.home-shell \{ width: min\(1440px, calc\(100% - 80px\)\)/.test(whiteboardStyles), "首次进入的内容宽度必须与主页保持一致");
check(/body\[data-onboarding="first-run"\] \.hero p \{ max-width: none; margin: 16px auto 0; white-space: nowrap; \}/.test(whiteboardStyles), "桌面端首次进入说明不应意外换行");
check(/body\[data-onboarding="first-run"\] #quickText \{ height: 100%; padding: 14px; font-size: 15px; line-height: 22px; \}/.test(whiteboardStyles), "首次进入输入框的文字必须垂直居中");
check((whiteboardHtml.match(/id="openWorkflowTemplates"/g) || []).length === 1 && !whiteboardHtml.includes('id="saveWorkflowTemplate"'), "工作流模板菜单必须只有一个入口");
check(/function clearInbox\(\)/.test(read("app/core/pagedock-db.js")) && /clearInbox/.test(whiteboardSource), "收件箱必须提供保留根白板的清空操作");
check(/#versionHistoryDialog \{ height: min\(80dvh, 40rem\); overflow: hidden; \}/.test(whiteboardStyles) && /version-history-list/.test(whiteboardStyles), "版本历史必须只保留列表滚动区域");
check(/\.share-codex-details \{ margin-top: 12px;/.test(whiteboardStyles), "协作邀请中的 Codex 入口必须与链接保持间距");
check(manifest.content_scripts?.some(entry => entry.matches?.includes("<all_urls>") && entry.js?.includes("app/content/content-codex.js")), "Codex 快捷入口没有注入全部受支持页面");
check(/attachShadow\(\{ mode: "closed" \}\)/.test(pageCodexSource), "网页 Codex 快捷入口缺少 Shadow DOM 样式隔离");
check(/chrome\.storage\.local\.set\(\{ \[POSITION_KEY\]: \{ \.\.\.position, collapsed \} \}/.test(pageCodexSource), "网页 Codex 快捷入口缺少跨页面位置保存");
check(/setPointerCapture/.test(pageCodexSource) && /applyPosition\(\{ x: start\.left \+ dx, y: start\.top \+ dy \}\)/.test(pageCodexSource), "网页 Codex 快捷入口缺少拖动交互");
check(/向右收起 Codex 快捷入口/.test(pageCodexSource) && /rightEdge - width/.test(pageCodexSource), "Codex 快捷入口没有保持右边缘向右收起");
check(/问问 Codex/.test(pageCodexSource) && /翻译中文/.test(pageCodexSource) && /内容总结/.test(pageCodexSource) && /内容分析/.test(pageCodexSource) && /启发/.test(pageCodexSource), "网页选区快捷操作不完整");
check(/className = "message-quote"/.test(pageCodexSource) && !/contextQuote|context-quote/.test(pageCodexSource), "选中文字没有只在会话消息中保留引用");
check(/class="compose-quick-actions"/.test(pageCodexSource) && /title="翻译中文">翻译</.test(pageCodexSource) && /<button class="send"/.test(pageCodexSource), "弱化快捷操作没有与发送按钮放在同一排");
check(/\.send\s*\{[^}]*margin-left:\s*auto/.test(pageCodexSource), "网页快捷操作栏的主发送按钮没有靠右对齐");
check(/composeQuickActions\.hidden = busy/.test(pageCodexSource) && !/composeQuickActions\.hidden = !attachedSelection/.test(pageCodexSource), "快捷操作在没有待发送引用时被错误隐藏");
check(/text \? "选中文字" : "当前页面正文"/.test(pageCodexSource), "快捷操作没有在引用与当前页面之间自动选择上下文");
check(/if \(selectionText\) setAttachedSelection\(""\)/.test(pageCodexSource), "引用发送后仍残留在输入区");
check(/PAGE_CHAT_GET_REQUEST/.test(pageCodexSource) && /PAGE_CHAT_PUT_REQUEST/.test(pageCodexSource) && /restorePageChat/.test(pageCodexSource), "网页 Codex 对话没有按页面恢复和保存");
check(/PAGE_CHAT_GET_REQUEST/.test(backgroundSource) && /PageDockDB\.savePageChat/.test(backgroundSource), "页面会话没有通过扩展后台写入 IndexedDB");
check(/event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing/.test(pageCodexSource), "网页 Codex 输入框缺少回车发送或输入法保护");
check(/PAGE_CODEX_PORT/.test(backgroundSource) && /page-open/.test(backgroundSource) && /CODEX_AUTO_CONNECT_ALARM/.test(backgroundSource), "网页打开后的本地 Codex 自动连接或周期恢复链路不完整");
check(/本地已连接/.test(whiteboardSource) && /正在连接本地 Codex/.test(whiteboardHtml), "白板快捷入口没有优先呈现本地 Codex 自动连接状态");
const mcpAdapterSource = read("native-host/shizuo-mcp-server.mjs");
check(/if \(mutating\)[\s\S]{0,400}requestExternalMutationApproval/.test(backgroundSource), "外部写操作没有经过画布审批门禁");
check(/client\.type === "human" \? "edit" : "ask"/.test(backgroundSource), "浏览器协作者没有默认获得直接编辑权限");
check(/BRIDGE_APPROVAL_RESPONSE/.test(backgroundSource) && /externalApprovalRequests/.test(backgroundSource), "外部写操作审批响应链路不完整");
check(/external-codex-activity/.test(backgroundSource) && /externalCodexActivities/.test(backgroundSource), "外部 Codex 活动记录链路不完整");
check(/id="collaborationPanel"/.test(whiteboardHtml) && /允许一次/.test(whiteboardSource) && /拒绝/.test(whiteboardSource), "画布缺少 Codex 协作审批界面");
check(/x-shizuo-client-name/.test(mcpAdapterSource) && /os\.hostname\(\)/.test(mcpAdapterSource), "MCP 适配器没有携带接入者身份");
check(/boardScopeId/.test(backgroundSource) && /仅获授权访问当前共享白板/.test(backgroundSource), "接入者没有强制绑定当前共享白板");
check(/COLLABORATION_STORAGE_KEY/.test(backgroundSource) && /persistCollaborationState/.test(backgroundSource), "协作审计和权限没有持久化");
check(/collaboration\.send/.test(backgroundSource) && /external-codex-message/.test(backgroundSource), "协作评论消息链路不完整");
check(/collaboration\.presence/.test(backgroundSource) && /remotePresenceLayer/.test(whiteboardSource), "实时光标和选区链路不完整");
check(/collaboration\.watch/.test(backgroundSource) && /shizuo_watch_events/.test(mcpAdapterSource), "协作事件长轮询链路不完整");
check(/externalBoardChanges/.test(backgroundSource) && /event\.type === "board"/.test(read("native-host/collaboration-page.mjs")), "浏览器协作没有订阅白板实时变更");
check(/cards\.asset/.test(backgroundSource) && /\/v1\/collaboration\/assets\//.test(read("native-host/collaboration-page.mjs")), "浏览器协作没有安全展示内嵌卡片资源");
check(/collaboration\.task/.test(backgroundSource) && /external-codex-task/.test(backgroundSource), "外部 Codex 任务状态链路不完整");
check(/id="collaborationPetResult"/.test(whiteboardHtml) && /shizuo_report_task/.test(mcpAdapterSource), "画布缺少当前 Codex 任务结果界面或 MCP 工具");
check(/collaboration-pet-stage/.test(whiteboardHtml) && /externalTaskPetState/.test(whiteboardSource), "本地 Codex 状态没有采用桌面宠物式呈现");
check(/function syncLocalPluginCodexTask/.test(whiteboardSource) && /const primaryTask = pluginTask \|\| automaticTask/.test(whiteboardSource), "插件内 Codex 任务状态没有优先同步到工作伙伴宠物卡");
check(/syncLocalPluginCodexTask\(task, "completed", \{ message: "回答已生成", result: answer \}\)/.test(whiteboardSource), "独立 Codex 会话结果没有同步到工作伙伴宠物卡");
check(/collaborationLiveEl\.textContent = primaryClientIsLocal \? "本机"/.test(whiteboardSource), "本地插件任务仍被错误标记为内网任务");
check(/collaboration-scroll/.test(whiteboardHtml) && /collaboration-activity/.test(whiteboardHtml), "协作面板缺少单滚动区或最近活动");
check(!/id="collaborationTasks"/.test(whiteboardHtml) && !/任务记录/.test(whiteboardSource), "协作面板仍显示冗余任务记录");
check(!/collaborationMessageInput/.test(whiteboardHtml) && !/collaboration-compose/.test(whiteboardHtml) && !/BRIDGE_MESSAGE_SEND_REQUEST/.test(whiteboardSource), "协作面板仍保留容易误解的评论输入区");
check(!/collaborationMessages/.test(whiteboardHtml) && !/collaborationMessagesEl/.test(whiteboardSource) && !/externalCollaborationMessages/.test(whiteboardSource), "协作面板仍展示或统计历史评论残留");
check(!/EXTERNAL_CODEX_STATUS_TIMEOUT_MS/.test(backgroundSource), "外部 Codex 在线状态不应因空闲自动过期");
check(/仅光标和选区需要清理/.test(backgroundSource), "外部 Codex 永久在线与临时光标清理边界不清晰");
check(/event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing/.test(whiteboardSource), "任务输入框缺少回车发送或输入法保护");
check(/codexChatInputEl\.addEventListener\("keydown", event => \{[\s\S]{0,260}event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing[\s\S]{0,160}sendCodexChatMessage\(\)/.test(whiteboardSource), "独立 Codex 会话缺少回车发送、Shift 回车换行或输入法保护");
check(/expectedUpdatedAt/.test(backgroundSource) && /cards\.stream/.test(backgroundSource), "协作冲突检测或渐进生成链路不完整");
check(/commitBoardSnapshot/.test(read("app/core/pagedock-db.js")) && /BOARD_CONFLICT/.test(read("app/core/pagedock-db.js")), "版本化白板写入边界不完整");
check(/saveTemplateFromBoard/.test(read("app/core/pagedock-db.js")) && /runCurrentWorkflow/.test(whiteboardSource), "工作流模板或执行链路不完整");
check(/normalizeWorkflowPlan/.test(read("app/core/board-domain.js")) && /function runDynamicWorkflow/.test(whiteboardSource) && /function executeWorkflowTasks/.test(whiteboardSource), "自然语言动态工作流编排链路不完整");
check(/task-orchestrate/.test(whiteboardSource) && /执行容器/.test(whiteboardSource) && /"image-gen"/.test(whiteboardSource) && /"hyperframes-video"/.test(whiteboardSource) && /"remotion-video"/.test(whiteboardSource), "动态工作流缺少画布入口、执行容器或双视频执行通道");
check(/id="homeTemplates"[^>]*>模板库</.test(whiteboardHtml), "主页模板入口文案不清晰");
check(/function updateWorkflowTemplateEntry/.test(whiteboardSource) && /新建白板/.test(whiteboardSource) && /暂无工作流模板/.test(whiteboardSource), "模板库缺少数量反馈或零模板引导");
check(!/PAGEDOCK · AI 视觉总结|context\.fillText\("内容摘录"|task\.boardName} · 基于/.test(whiteboardSource), "视觉总结图仍包含品牌、原文摘录或来源脚注");
check(/"relations":\[/.test(whiteboardSource) && /内容结构/.test(whiteboardSource) && /关键关系/.test(whiteboardSource), "视觉总结图缺少结构与关系表达");
check(/function drawCenteredCanvasText/.test(whiteboardSource) && /textBaseline = "middle"/.test(whiteboardSource), "视觉总结文字区块没有真正居中");
check(/function drawSketchCard/.test(whiteboardSource) && /function drawSketchArrow/.test(whiteboardSource) && /手稿信息图/.test(whiteboardSource), "视觉总结图没有采用手稿风格");
check(/function drawSketchEmphasis/.test(whiteboardSource) && /重点突出/.test(whiteboardSource), "视觉总结图缺少重点强调和视觉修饰");
check(/function drawPaperTexture/.test(whiteboardSource) && /paper-fiber/.test(whiteboardSource) && /createRadialGradient/.test(whiteboardSource), "视觉总结图的纸张纹理不足");
check(/HanziPen SC/.test(whiteboardSource) && /Xingkai SC/.test(whiteboardSource) && /strokeText/.test(whiteboardSource), "视觉总结文字缺少手写墨迹感");
check(/手稿信息图/.test(whiteboardSource) && /AI 自由绘图/.test(whiteboardSource) && /image-gen/.test(whiteboardSource), "做图任务缺少模板与 image-gen 双通道");
check(/searchBoards/.test(read("app/core/pagedock-db.js")) && /listBoardRevisions/.test(read("app/core/pagedock-db.js")), "跨白板搜索或版本历史链路不完整");
check(/provenance/.test(read("app/core/card-protocol.js")) && /id="provenanceDialog"/.test(whiteboardHtml), "卡片来源追踪链路不完整");

verifyJavaScript();
verifySourceLineLimits();
verifyHtmlContract("app/pages/whiteboard/index.html", "whiteboard modules", whiteboardSource);
verifyHtmlContract("app/pages/popup/popup.html", "app/pages/popup/popup.js");
verifyHtmlContract("app/pages/sidepanel/sidepanel.html", "app/pages/sidepanel/sidepanel.js");

for (const file of ["app/styles/tokens.css", "app/styles/paper-theme.css", "app/pages/whiteboard/modules/whiteboard.css"]) verifyCssBraces(file, read(file));
for (const file of ["app/pages/whiteboard/index.html", "app/pages/popup/popup.html", "app/pages/sidepanel/sidepanel.html", "app/pages/editor/editor.html"]) {
  const styles = [...read(file).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(match => match[1]).join("\n");
  verifyCssBraces(file, styles);
}

const appSources = [whiteboardSource, backgroundSource, whiteboardStyles, ...["app/pages/popup/popup.js", "app/pages/sidepanel/sidepanel.js", "app/pages/whiteboard/index.html", "app/pages/popup/popup.html", "app/pages/sidepanel/sidepanel.html", "app/styles/paper-theme.css"].map(read)].join("\n");
check(!/transition\s*:\s*all\b/i.test(appSources), "发现 transition: all，会造成不可控动画");
check(!/\balert\s*\(/.test(appSources), "发现阻塞式 alert，请改为原位错误反馈");
check(!/chrome-extension:\/\/[a-p]{32}/.test(read("app/pages/popup/popup.js")), "弹出面板硬编码了扩展 ID");

if (failures.length) {
  console.error(`拾作验证失败（${failures.length} 项）`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`拾作 ${manifest.version} 验证通过`);
