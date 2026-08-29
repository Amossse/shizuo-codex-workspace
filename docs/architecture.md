# Architecture

拾作按运行边界组织代码，而不是按页面或行数堆叠。首方运行时代码单文件不得超过 1000 行；`npm test` 会执行该契约。

## Extension runtime

- `background.js` 是 Service Worker 的 composition root，只按顺序加载 `background/` Module。
- `background/runtime-context.js` 持有跨模块共享的 Chrome 运行态。
- `background/collaboration.js` 实现协作会话、Presence、审批和远程白板 RPC。
- `background/native-bridge.js` 管理 Native Host 连接与恢复。
- `background/scheduler.js` 管理定时任务和动态工作流。
- `background/bridge-requests.js` 适配 Codex 与 Terminal 请求。
- `background/collection-router.js` 注册 Chrome 事件并收集网页内容。
- `background/capture.js` 负责页面上下文、Markdown、截图和 PDF。

这些脚本运行在同一个经典 Service Worker 全局域中，加载顺序由 composition root 固定。Router 只组合能力，不重新实现业务规则。

## Whiteboard runtime

`whiteboard.html` 只描述结构并按顺序加载 `whiteboard/` Module。核心边界是：

- `runtime-context`：唯一共享的 Board/Card 运行上下文。
- `canvas`、`cards`、`card-renderers`：画布行为、通用卡片和外部能力 Adapter。
- `task-card`、`task-runtime`：任务会话展示与执行生命周期。
- `ai-generation`、`result-delivery`：生成上下文和结果交付。
- `board-controller`：Mutation、Revision、持久化、历史与导航。
- `bootstrap`：事件装配，始终最后加载。

样式集中在 `whiteboard/whiteboard.css`，避免 HTML 同时承担页面结构和视觉实现。

## Native Host

`native-host/pagedock-codex-host.mjs` 是可执行 composition root，外部命令与 Native Messaging 协议保持稳定。深 Module 各自拥有状态和清理责任：

- `codex-session-observer.mjs`：Session List、Preview 和生命周期监听。
- `collaboration-bridge.mjs`：HTTP Bridge、邀请、限流和 Plugin request。
- `task-prompts.mjs`：所有任务模式的信任边界与 Prompt policy。
- `task-artifacts.mjs`：CLI 事件、图片/视频产物和 Kokoro 后期交付。
- `video-adapters.mjs`：HyperFrames 与 Remotion Adapter。
- `task-runner.mjs`：Runtime 选择、并发、超时和任务清理。
- `terminal-controller.mjs`：一次性命令与 PTY Session。

安装器复制全部 Native Host `.mjs` Module，避免入口与 Implementation 漂移。

## Persistence

`pagedock-db.js` 保持一个深 IndexedDB Interface：Board、Mutation、Revision、Template、Search 与 Page Chat 共享同一事务边界。它只略高于阈值，因此通过移除无意义空行收敛，而没有为了文件数量制造浅层转发 Module。

## Change rules

1. 新行为先放入拥有该状态或不变量的 Module。
2. Runtime 与视频引擎通过 Adapter 接入，不在 Router 中增加分支实现。
3. Mutation 必须经过数据库 Revision 边界；不能直接覆盖白板状态。
4. 新文件需进入发布包和安装链路，并由契约测试验证。
