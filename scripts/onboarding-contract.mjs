import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("whiteboard.html");
const board = read("whiteboard.js");

assert.match(html, /id="homeMoreMenu"[\s\S]{0,900}AI 与连接[\s\S]{0,400}实验能力[\s\S]{0,300}协作与会话/, "主页高级能力必须渐进披露");
assert.match(html, /id="homeJourney"[\s\S]{0,1800}先放入一条内容[\s\S]{0,500}整理到白板[\s\S]{0,500}journeyAiName/, "首次进入必须解释收集、整理和创作主路径");
assert.match(board, /const isFirstRun = homeBoards\.every[\s\S]{0,300}homeJourneyEl\.hidden = !isFirstRun/, "首次引导必须由真实白板数据决定，而不是永久打扰老用户");
assert.match(html, /从一条内容，得到一个结果/, "首页必须先表达用户可得到的结果，而不是罗列功能");
assert.match(html, /把网页和本地资料放进画布[\s\S]{0,180}留下可追溯的过程与结果/, "首页必须明确浏览器到画布再到 Agent 结果的核心承诺");
assert.doesNotMatch(html, /class="hero"[\s\S]{0,400}回答、图片、视频或知识卡/, "首页核心承诺不能再罗列实验性产物");
assert.doesNotMatch(html, /id="aiRuntimeMenu"/, "技术型运行时选择不能常驻顶栏");
assert.match(html, /id="healthCheckDialog"[\s\S]{0,900}id="aiRuntimeSelect"[\s\S]{0,500}id="selectionVideoEngine"/, "运行时与视频引擎必须收进 AI 与连接设置");
assert.match(html, /id="exportMenu"[\s\S]{0,1800}画布[\s\S]{0,500}工作流[\s\S]{0,700}数据与恢复[\s\S]{0,500}设置[\s\S]{0,400}实验能力/, "白板更多菜单必须按用户任务分组并弱化实验能力");
assert.doesNotMatch(html, /id="toggleCollaboration"/, "协作面板不能占用常驻顶栏入口");
assert.match(html, /id="askSelectionWithCodex"[^>]*>交给 AI</, "画布主动作不应暴露底层运行时");
assert.match(html, /id="quickAdd"[^>]*>开始整理</, "首次体验必须只有一个结果导向的主操作");
["emptyAddTask", "emptyAddText", "emptyAddImage"].forEach(id => assert.match(html, new RegExp(`id="${id}"`), `空白画布必须提供 ${id} 起步动作`));
assert.match(board, /emptyAddText[\s\S]{0,600}addTextItem[\s\S]{0,600}emptyAddTask[\s\S]{0,300}addTaskItem/, "空白画布入口必须真正创建对应卡片");
assert.match(board, /quickTextEl\.addEventListener\("keydown", event => \{[\s\S]{0,300}event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.isComposing/, "快速收集必须支持回车保存、Shift 回车换行和输入法保护");
assert.match(board, /if \(firstRun && savedItems\[0\]\?\.id\)[\s\S]{0,350}focusExternalActivity\(\{ boardId: db\.INBOX_ID, cardId: savedItems\[0\]\.id \}\)/, "第一条内容保存后必须直接进入白板并聚焦结果");
assert.match(board, /内容已放入白板。下一步：点击上方“交给 AI”[\s\S]{0,80}6500/, "首次收集后必须给出可执行的下一步，而不是只报告成功");
assert.match(board, /function createRecentItem[\s\S]{0,1400}focusExternalActivity\(\{ boardId: item\.boardId, cardId: item\.id \}\)/, "最近收集必须定位到具体卡片，而不是只打开白板");
assert.match(board, /function captureHomeImages\(files\)[\s\S]{0,900}readFileAsDataUrl[\s\S]{0,500}finishHomeCapture/, "首次主入口必须让图片与文字进入同一条成功路径");
assert.match(board, /quickTextEl\.addEventListener\("paste"[\s\S]{0,500}captureHomeImages/, "首次主入口必须支持直接粘贴图片");
assert.match(board, /quickCaptureWrapEl\.addEventListener\("drop"[\s\S]{0,400}captureHomeImages/, "首次主入口必须支持拖入图片");
assert.match(board, /orchestrate\.textContent = "规划多步任务"/, "动态工作流入口必须使用新用户能理解的名称");
assert.match(board, /orchestrate\.hidden = active \|\| failed \|\| item\.taskWorkflowRole === "step" \|\| !settingsExpanded/, "多步工作流必须跟随高级设置渐进披露");
assert.match(html, /id="selectionMoreMenu"[\s\S]{0,500}AI 处理[\s\S]{0,300}提炼知识卡[\s\S]{0,300}整理画布[\s\S]{0,500}连接所选/, "圈选更多菜单必须区分 AI 处理与画布整理");
assert.match(board, /hasConversation \? `与 \$\{aiRuntimeLabel\(\)\} 对话` : `问问 \$\{aiRuntimeLabel\(\)\}`/, "空白任务与持续对话必须跟随当前 AI 运行时并保持明确语义");
assert.match(board, /function updateAiRuntimeCopy\(\)[\s\S]{0,500}AI 助手/, "切换本地 AI 不应改变主任务语言");
assert.doesNotMatch(board, /starterLabel\.textContent = "从素材开始"[\s\S]{0,500}\["video", "生成视频"\]/, "实验性视频不能占据素材任务的首屏快捷动作");
assert.match(board, /send\.title = atCapacity[\s\S]{0,220}先输入问题或要完成的任务/, "空任务必须解释发送按钮不可用的原因");

console.log("新用户主路径体验契约验证通过");
