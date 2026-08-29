# Changelog

All notable changes to **拾作** are documented here.

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.24.1] - 2026-08-29

### Added

- Add continuous integration across supported Node.js versions, release packaging checks, issue forms, and a pull request checklist
- Add a complete privacy and browser-permission reference for local storage, optional network actions, Native Messaging, and trusted-LAN collaboration
- Add deterministic, allowlisted release archives with a SHA-256 checksum and an automated tagged-release workflow

### Changed

- Extract shared Native Host execution and bounded-output helpers behind a tested runtime utility module
- Update the public release path, supported security version, and repository metadata for the 2.24.1 maintenance release

### Fixed

- Prevent release archives from accidentally including untracked files, development-only screenshots, tests, or local configuration
- Keep package, manifest, README, changelog, release notes, and Git tags under an explicit version-consistency gate

## [2.24.0] - 2026-08-29

### Release

- Reframe the public project around one clear path: capture context, organize it on a visual canvas, and let Codex act with observable results
- Add release-ready overview artwork, a real in-page assistant capture, a GitHub social preview, and a direct downloadable extension package
- Move advanced and experimental capabilities behind progressive disclosure so first-time installation and use remain understandable

### Added

- Add “提炼知识卡” for selected cards, producing an editable, searchable Markdown document linked to its source cards and provenance
- Add a persisted growth lens to dynamic workflows so the same planner can optimize for work efficiency, skill development, broader perspective, or strategic thinking
- Add one-time, daily, and weekly background scheduling for Codex tasks and complete dynamic workflows, including DAG planning, live execution containers, media artifacts, cancellation, restart recovery, and anchored retries
- Add natural-language dynamic workflow planning that creates a validated DAG of live task containers and routes query, text, image-gen, and video steps through their existing execution engines
- Add a no-install LAN collaboration page where invited people can view, create, edit, move, resize, and connect cards under the owner's existing permission policy
- Inject a draggable, collapsible Codex quick entry into every supported web page, with an isolated page chat panel
- Show a selection toolbar for asking Codex, translating to Chinese, summarizing, analyzing, and generating new insights
- Persist page-level Codex conversations in extension IndexedDB and restore them through a normalized URL index
- Show a recent local Codex Session list and an on-demand preview of user-visible requests, progress, and final answers
- Add optional Kokoro post-production for generated MP4 videos, with sentence-aligned Chinese subtitles and the silent source video preserved
- Allow pasted PNG, JPEG, and WebP images to be previewed, removed, and sent with questions from the in-page Codex panel

### Changed

- Keep direct questions as the default task path, reveal multi-step planning with advanced settings, and group selection actions by AI processing versus canvas organization
- Shorten source-card starter actions to “总结”, “做成信息图”, and “自由画图” so outcomes are easier to scan
- Make the first successful capture point directly to “交给 AI”, open recent items at their exact card, explain disabled task actions, and keep experimental video out of the primary material shortcuts
- Add consistent keyboard focus and pressed feedback to core buttons, menus, board cards, and recent-item rows
- Focus the public first release on browser capture, local canvas organization, Agent/MCP board operations, and observable results; move collaboration, video, terminal, scheduling, and AGY entry points under experimental disclosure
- Remove internal repository and maintainer references from public-facing package, manifest, setup, contribution, and security documentation
- Generate silent videos with a persisted HyperFrames or Remotion engine choice, and remove HeyGen and local narration from the active video path
- Clear stale task errors as soon as a new run starts and reset edited questions to conversation mode
- Reframe first use around one outcome and one primary action: paste text, links, or images into the same entry, enter the canvas immediately, and reveal technical runtime choices only after onboarding
- Clarify the first-use path from capture to board to Codex, replace passive empty states with working starter actions, and move advanced home controls behind “更多”
- Tighten knowledge-card extraction to concise evidence-first sections and open generated cards in a compact reading layout by default
- Anchor the task composer to the card bottom and keep its prompt and action buttons the same height
- Reduce the task composer default height while retaining multiline expansion
- Show unstarted workflow containers as pending, with their upstream wait reason, until the scheduler reaches them
- Rename the sharing entry to “邀请协作” and separate the primary browser link from the expandable Codex connection instruction
- Connect the local Native Host automatically when a page opens and retry in the background after transient disconnections
- Prefer the local Codex connection state in the launcher instead of presenting an unrelated external MCP waiting state
- Keep selected text only as a quote inside the conversation, then move compact translate, summarize, analyze, and inspire actions beside Send
- Keep the four page actions visible after a quote is sent, falling back to the current page when no quote is attached
- Balance the page chat action row with quiet shortcuts on the left and the primary Send action aligned to the right
- Collapse the floating Codex entry toward its right edge instead of making it jump left
- Remove the redundant collaboration task-history section while keeping current status, result, and recent activity
- Remove the misleading collaboration comment input while keeping the bridge RPC backward compatible
- Hide legacy collaboration comments from the panel and exclude them from its availability and unread count

### Fixed

- Keep the home headline on one intentional line at desktop widths, dismiss every toolbar menu from capture-phase outside clicks, and render the Codex/AGY switch with the same in-product menu style as “更多”
- Feed knowledge-card extraction the selected task card's latest visible Codex answer instead of its generic execution receipt
- Create a linked loading container immediately when extracting a knowledge card, replace it in place on completion, and stop the global status spinner after success
- Remove the nested white composer panel from pending workflow containers
- Always clear the canvas marquee after cancellation, lost pointer capture, window blur, or tab switching
- Allow prompt-only dynamic workflows to enter planning without requiring an unrelated source card
- Adopt merged external board mutations before the next owner save, keep background workflow state authoritative, clear stale retry alarms on reschedule, and persist successful sibling results before reporting a partial workflow failure
- Respect the Native Host's single image/video resource limits, keep scheduled media chunks inside the background worker, retain only the previous scheduled workflow run, and store unchanged embedded media once per revision delta
- Make dynamic workflows stoppable during material preparation and execution, resume active planning on the correct channel, reject malformed DAGs, and keep reruns from consuming stale generated outputs
- Make browser collaborators editable by default, synchronize owner changes through long polling, render protected embedded media and task messages, and fix guest canvas pan/zoom/fit behavior
- Make one-time LAN invitations terminal-first so another Codex can connect without Chrome navigating a private HTTP address
- Keep blank task cards below a consistent visible top gutter when they are added from the toolbar
- Make local folder entries interactive: expand nested directories and preview text or image files inside the card

## [2.23.0] - 2026-08-12

### Added

- Add `shizuo_report_task` for external Codex clients to report user-readable task phases, progress, linked output cards, and final results
- Show persistent external Codex tasks and expandable results in the canvas collaboration card, including reconnect-safe revisions and interrupted-connection state
- Observe local Codex Desktop turn lifecycle in the Native Host so the canvas pet shows running, completed, and cancelled state without manual task reports

### Changed

- Align direct image-gen output with the template image system's warm paper, hand-drawn ink, centered content blocks, and restrained accent colors while rejecting dark-tech defaults
- Stop retrying HeyGen after an explicit TTS credit exhaustion response, visibly fall back through macOS Han Premium, Tingting, then Meijia, and preserve the selected voice and fallback reason in audio metadata
- Teach the bundled `shizuo` Skill to report every remote collaboration turn from start through completion, failure, or cancellation without exposing hidden reasoning or sensitive logs
- Send task-card prompts with Enter while keeping Shift + Enter for multiline input and protecting IME composition
- Send independent Codex chat messages with Enter while keeping Shift + Enter for multiline input and protecting IME composition
- Mirror independent Codex chat progress and results into the collaboration pet, ahead of the generic Codex Desktop lifecycle status
- Collapse repeated user-visible task process statuses while retaining the latest detail and terminal outcome
- Keep an authorized external Codex shown as connected until it is revoked, sharing stops, or the bridge disconnects; only transient cursor presence expires

### Fixed

- Return the collaboration pet to idle after a local task finishes instead of leaving the previous completed task as the current status
- Reject unavailable macOS narration voices before synthesis so `say` cannot silently substitute Tingting while reporting Han
- Reject handwritten or truncated GSAP shims before HyperFrames browser checks, restore the pinned official GSAP runtime automatically, and route minified TDZ errors to dependency repair before Timeline changes
- Report HeyGen HTTP 402 as exhausted TTS credit instead of allowing an earlier transient network error to produce misleading proxy guidance
- Preserve a working system Chrome path across core or terminal bridge updates instead of falling back to a broken legacy HyperFrames Headless Shell

## [2.22.0] - 2026-08-11

### Added

- Add a profile-aware one-command installer and credential-safe connection health check
- Add workflow templates, dependency-aware workflow execution, cross-board card/source search, card provenance, and restorable board revision history
- Add persistent collaboration messages and activity, presence expiry, per-client revocation, unread state, and cursor-based long polling through `shizuo_watch_events`

### Changed

- Route board writes through a revisioned mutation boundary with field-level conflict detection instead of whole-board last-write-wins saves
- Keep the Native Messaging host token local-only and issue independent, board-scoped tokens through one-time LAN invites

### Fixed

- Make the installed `shizuo.sh` launcher POSIX-compatible so documented `sh` and `bash` invocations work
- Decouple core Codex setup from optional terminal and video dependencies

## [2.21.1] - 2026-08-11

### Added

- Bundle and install a `shizuo` Codex Skill that owns bridge diagnosis, local/LAN configuration, MCP registration, whiteboard operation workflows, and post-mutation verification
- Include deterministic Skill commands for local-only mode, trusted-LAN host/client setup, status checks, bridge disablement, and separately gated deletion permission

### Security

- Keep LAN enablement and card deletion as separate explicit actions, redact the local token from routine setup output, and instruct Codex never to expose terminal, file handles, or bridge secrets
- Verify that the Skill and Native Host ship the exact same MCP adapter so their available tools cannot silently drift

## [2.21.0] - 2026-08-11

### Added

- Let Codex actively connect to the running extension through a token-authenticated local bridge and an included MCP stdio adapter
- Expose bounded whiteboard tools for listing and reading boards, creating and updating cards, creating boards, and connecting card data
- Add an explicit LAN mode for trusted private networks so another user on the same intranet can connect with the shared endpoint and token
- Keep card deletion behind a separate opt-in bridge capability, disabled by default

### Security

- Bind the bridge to `127.0.0.1` by default; LAN mode accepts only private source addresses, requires a random bearer token, rate-limits clients, and never exposes terminal or local-file-handle APIs
- Keep IndexedDB ownership inside the Chrome extension and pass only bounded, sanitized card snapshots through Native Messaging

## [2.20.10] - 2026-08-10

### Changed

- Replace the oversized inline answer-creation menu with a compact anchored popover for text, image, and video creation
- Move the creation context selector into a quiet footer row and clarify each output with a concise description
- Use the browser top layer with automatic viewport-edge flipping so the menu does not squeeze or clip inside task cards

## [2.20.9] - 2026-08-10

### Added

- Reject visible `${...}` template source before HyperFrames rendering while allowing legitimate template literals inside scripts and styles
- Require dedicated opening and ending hook sections in every generated video script, with complete entrance, closing hold, and narration tail timing

### Fixed

- Route leaked template expressions and incomplete opening or ending sections into targeted Codex content repair before narration and final rendering

## [2.20.8] - 2026-08-10

### Changed

- Turn task cards into chronological conversation workspaces: only process logs collapse, while older messages remain in reading order and progressively reveal when the thread is long
- Keep the top of a task card focused on task identity; show source shortcuts only before the first answer
- Replace scattered creation buttons with one per-answer “创作” menu for text, image, and video output
- Add copy and explicit quote actions to every Codex answer, with the selected reply context shown above the bottom composer
- Stop silently reinjecting original source cards into later follow-up turns after the conversation has moved to a new topic

## [2.20.7] - 2026-08-10

### Changed

- Make task creation shortcuts use the latest completed Codex answer after the conversation changes topic, while keeping original materials available as an explicit context choice
- Add compact per-answer actions for summarizing or generating an image or video from one specific response
- Keep image and video generation out of the conversation history so derived artifacts cannot become the next conversation topic
- Freeze and persist the selected messages, source cards, and extra instruction for each derived artifact

## [2.20.6] - 2026-08-10

### Fixed

- Distinguish a quiet HyperFrames render-ready timeout from structured project runtime failures
- Route `check_runtime_failure`, runtime error counts, temporal-dead-zone errors, undefined references, and syntax errors into Codex project repair instead of incorrectly asking the user to retry later
- Cover the reported `Cannot access 'na' before initialization` check output in the Native Host classifier self-test

## [2.20.5] - 2026-08-09

### Fixed

- Open a whiteboard reliably on the first click after the Chrome window regains focus
- Refresh the board list when the tab becomes visible instead of replacing the clicked card between pointer-down and click

## [2.20.4] - 2026-08-09

### Changed

- Rebalance task cards around reading: place task context and creation shortcuts on one compact row and give the conversation the saved space
- Use a single-line follow-up composer after completion that grows only when the user enters more content
- Place collapsed process history before the latest completed answer so the answer remains the natural reading endpoint
- Reduce task scrollbar and control density without removing task history, process details, shortcuts, or multi-turn follow-up

## [2.20.3] - 2026-08-09

### Fixed

- Remove the nested scrollbar from task process history and let the task conversation remain the single vertical scroll container
- Keep wheel scrolling continuous across process events, answers, and the rest of the task content

## [2.20.2] - 2026-08-09

### Fixed

- Keep the application shell at 100% by blocking Chrome page zoom from the toolbar, overlays, side panels, and other non-canvas surfaces
- Reserve pinch and `Cmd/Ctrl + wheel` zoom for the whiteboard viewport while keeping the explicit canvas zoom controls available

## [2.20.1] - 2026-08-09

### Changed

- Reduce video audio validation to narration synthesis completeness and `<audio>` mounting only
- Stop transcribing generated narration or checking speaking rate, character count, segment duration, pronunciation similarity, or background music

### Fixed

- Allow successfully synthesized narration above 4.2 Chinese characters per second to proceed directly to video assembly

## [2.20.0] - 2026-08-09

### Added

- Accept files and folders dropped directly onto the canvas and create their matching image, file, or folder cards at the drop position
- Preserve live file-system handles when Chrome provides them, including refreshable folder contents and text-file previews
- Fall back to safe file and directory snapshots when persistent drag-and-drop handles are unavailable

## [2.19.3] - 2026-08-09

### Changed

- Generate videos with narration only and set `bgm.mode=none` throughout authoring and audio repair
- Stop requiring, waiting for, mounting, or quality-checking background music

### Fixed

- Remove generated background-music metadata and audio tags before validation so an unused music track cannot block video completion

## [2.19.2] - 2026-08-09

### Fixed

- Make the title-bar close button exit full-screen focus without deleting the card; it returns to card deletion only in the normal canvas view
- Update the close button's accessible label and tooltip to match its current full-screen or canvas behavior

## [2.19.1] - 2026-08-09

### Fixed

- Accept complete HeyGen Chill Brian narration when Chinese ASR only has moderate text differences, while still blocking clearly unintelligible audio
- Route missing audio mounts to video assembly repair instead of regenerating the same successful narration repeatedly
- Preserve HeyGen word timestamps for captions and avoid re-normalizing or retranscribing unchanged narration on every audio check
- Keep successful cloud narration when the optional ASR diagnostic is temporarily unavailable

## [2.19.0] - 2026-08-09

### Added

- Stream user-readable Codex process events, current stage, and elapsed time into each task card without exposing hidden reasoning
- Persist task run IDs and recent process events so a refreshed board can reconnect to work still running in the Native Host
- Check HeyGen reachability before starting a long video task and fail fast with an actionable card-level error
- Add task-state and performance contracts to the release verification suite

### Changed

- Initialize terminal renderers only near the viewport or after an explicit connection, throttle minimap redraws, lazy-decode images, and skip offscreen card rendering
- Stop importing, signing, or launching obsolete local TTS libraries during Native Host installation now that video narration is pinned to HeyGen
- Put text, image, and blank task first in the Add menu, with system-level card types grouped under “更多类型”
- Warn before browser storage is exhausted and strip runtime task/session authority from imported backups

### Fixed

- Preserve running task state across refresh instead of silently resetting it to idle
- Convert orphaned running tasks into explicit, retryable interrupted states while keeping their original prompt and history

## [2.18.6] - 2026-08-09

### Fixed

- Treat per-line HeyGen `fetch failed` anomalies as retryable network failures even when the shared audio engine exits successfully
- Report an unreachable HeyGen network path instead of misdiagnosing the failure as expired authentication or local intelligibility

### Changed

- Keep video narration strictly on HeyGen Starfish with Chill Brian instead of silently substituting ElevenLabs or a local system voice

## [2.18.5] - 2026-08-09

### Added

- Add a consistent full-screen focus mode to every whiteboard card, with title-bar and Escape exit controls

### Fixed

- Preserve each card's canvas position and dimensions while focused, and let page, task, document, image, video, and terminal contents use the full available area

## [2.18.4] - 2026-08-09

### Changed

- Pin video narration to HeyGen Starfish with the Chill Brian voice, Chinese language mode, and 1.2x speed
- Normalize every generated narration clip to WAV, 44.1 kHz, mono, 16-bit PCM after adding natural pauses

## [2.18.3] - 2026-08-08

### Fixed

- Retry transient HeyGen connection failures with bounded backoff and distinguish network outages from expired authentication in user-facing errors
- Stop accepting the locally generated Kokoro Mandarin voice when ASR confirms it is unintelligible, and use the validated macOS Tingting voice as the offline Chinese fallback
- Verify the real offline fallback with synthesis, transcription, and intelligibility checks during Native Host installation

## [2.18.2] - 2026-08-08

### Fixed

- Batch high-frequency PTY output and respect Native Messaging backpressure so verbose terminal commands cannot flood the Chrome renderer with tiny messages
- Persist terminal transcripts only after output becomes idle instead of rebuilding and saving the full board for every output fragment
- Dispose replaced xterm renderers and resize observers, throttle terminal fitting, and reduce retained terminal scrollback to avoid memory growth across board rerenders

### Added

- Add a repeatable PTY stress regression that fails when terminal output event frequency exceeds the safe limit

## [2.18.1] - 2026-08-08

### Changed

- Rename the product to **拾作** and adopt the brand line “收集、理解、创作” across Chrome surfaces, exports, local bridge messages, and current documentation
- Keep existing `PageDockDB`, `com.pagedock.codex`, `.pagedock`, environment variables, and local install paths unchanged so existing boards and bridge installations remain compatible

## [2.18.0] — 2026-08-08

### Changed
- Use Codex coding mode in the independent lower-right chat so answers can inspect and operate on the configured local workspace
- Replace implementation-heavy task progress with four user-facing stages and render Codex replies as readable Markdown
- Keep task cards focused on their current state, prevent duplicate submission during page preparation, and surface side-panel failures inline instead of blocking alerts

### Fixed
- Serialize IndexedDB writes per board and snapshot saves before switching boards, preventing slow saves and asynchronous task results from overwriting newer content
- Recover from cross-origin page redirects by requesting the final domain on retry instead of repeatedly failing with the original permission
- Close popup menus and dialogs consistently with outside click or Escape, center dialogs reliably, and use the runtime extension URL instead of a hard-coded installation ID

### Added
- Add a repeatable verification command for JavaScript syntax, manifest/package version parity, runtime assets, HTML/JavaScript contracts, CSS balance, and interaction regressions

## [2.17.2] — 2026-08-08

### Added
- Let Codex tasks read the rendered contents of connected page cards instead of receiving only their URL
- Request per-origin page access on the first analysis, load the page with the user's current Chrome session in a temporary background tab, and reuse the full virtual-scroll/Readability extraction pipeline

### Security
- Keep website access optional and domain-scoped; temporary analysis tabs are always closed and imported boards do not inherit page-content permissions

## [2.17.1] — 2026-08-08

### Fixed
- Preserve native copy and paste inside every input, textarea, contenteditable editor, and terminal textbox instead of converting pasted content into a new whiteboard card

## [2.17.0] — 2026-08-08

### Added
- Add one versioned card protocol for card types, content inputs and outputs, runtime state, connections, and capability permissions
- Make source → target connections carry a content snapshot into editable cards and provide the latest upstream content to every Codex task run
- Add persistent local file and folder cards with explicit read permission, refresh/reconnect flows, bounded previews, and separately stored browser handles
- Add resizable Markdown document cards with preview and language-labelled code cards
- Replace one-shot command cards with xterm.js terminals backed by persistent POSIX PTY login-shell sessions, including history, completion, ANSI, Ctrl+C, full-screen terminal apps, and resize propagation

### Security
- Reset all runtime capability grants and local handles when importing PageDock data
- Keep terminal cards output-only in the connection protocol so a data edge can never become implicit Shell execution

### Changed
- Bump the macOS Native Messaging host to 1.5.0 and install its PTY helper alongside the host

## [2.16.0] — 2026-08-08

### Added
- Add a Console entry that creates a resizable local terminal card on the whiteboard
- Execute explicitly entered shell commands through the existing Native Messaging bridge and stream stdout and stderr into the owning card
- Stop running commands, reuse recent command history, clear output, preserve bounded logs in IndexedDB, and include console content in selection analysis and board exports

### Security
- Keep webpage material isolated from console execution; only commands explicitly entered and submitted inside a console card reach the local shell
- Reuse the registered extension-origin check, configured coding workspace, process-tree cancellation, concurrency limit, and 24-hour task watchdog

## [2.15.9] — 2026-08-08

### Added
- Add a Page entry to the whiteboard Add menu and create resizable cards from HTTP(S) URLs
- Browse embedded pages inside the board, with refresh and external-tab actions for sites that block framing

### Changed
- Reuse the standard card title bar, selection, dragging, resizing, relationships, layout, persistence, and export behavior for page cards

## [2.15.8] — 2026-08-08

### Changed
- Prefer HeyGen Starfish for regenerated Mandarin narration, falling back to local Kokoro only when cloud generation is unavailable or fails quality validation
- Use natural 1.0× local speech, add 550ms breathing room between narration segments, and export the final stereo mix at 48 kHz

### Fixed
- Transcribe every generated narration file and block rendering when a segment is missing a real ASR result or falls below the Mandarin intelligibility threshold
- Stop accepting low-similarity narration after repair retries, so mechanical or garbled Chinese cannot silently reach the final video

## [2.15.7] — 2026-08-08

### Changed
- Extend analysis, coding, and every user-visible video processing stage timeout to 24 hours
- Keep short connection, browser startup, screenshot settling, and HyperFrames probe timeouts unchanged so technical failures still surface promptly

## [2.15.6] — 2026-08-08

### Fixed
- Keep Phonemizer's per-line eSpeak instances on the already verified macOS dylib inode, preventing repeated Gatekeeper checks from dropping every Kokoro narration segment
- Run a three-segment unified-audio-engine regression during bridge installation so multi-line narration failures are caught before a video task starts

## [2.15.5] — 2026-08-08

### Fixed
- Export the discovered Python runtime to HyperFrames so Chrome Native Messaging can load the installed Kokoro packages instead of falling back to the system Python
- Synthesize and validate a real Mandarin Kokoro sample during bridge installation, failing early with the underlying TTS error when the local runtime is incomplete

## [2.15.4] — 2026-08-08

### Changed
- Place collapsed task history above the latest turn and keep the newest answer at the bottom, matching the normal top-to-bottom conversation timeline

## [2.15.3] — 2026-08-08

### Changed
- Let short Codex chat bubbles shrink to their text instead of reserving a 180px minimum width
- Reveal the lightweight “放到白板” action on hover or keyboard focus and replace it with a quiet added status after use

## [2.15.2] — 2026-08-08

### Fixed
- Clear PageDock's custom card clipboard payload when copying highlighted task text, so pasting returns only the selected text instead of duplicating the whole card

## [2.15.1] — 2026-08-07

### Changed
- Run free-form whiteboard task cards as Codex coding agents with project search, file editing, command execution, user configuration, and project rules enabled
- Keep the lower-right Codex panel as an independent read-only conversation and keep material-analysis shortcuts isolated from local command execution
- Default coding access to `~/code` when available, with `PAGEDOCK_CODING_WORKSPACE` available for an explicit alternative root

### Fixed
- Stop coding requests from incorrectly answering that PageDock is in pure conversation mode

## [2.15.0] — 2026-08-07

### Changed
- Reduce the Codex model to board tasks created by “交给 Codex” and a separate independent chat
- Switch task cards between focused idle, running, completed, failed, and cancelled presentations instead of showing every control at once
- Put the newest result first, fold older conversation turns, and let three-line task inputs grow with their content
- Replace implementation-specific video progress with four user-facing creation stages and keep raw errors inside expandable technical details
- Move layout optimization into More and keep the top toolbar focused on navigation, naming, adding, undo, redo, and overflow actions
- Give side-panel controls 44px targets and explain when the concurrent task limit disables an action

### Fixed
- Keep task failures on their owning cards instead of duplicating them as global errors
- Make blank-canvas clicks and Escape consistently dismiss menus, blur editors, and clear selection
- Keep only one transient menu open and preserve live toolbar and relationship-line positioning while cards resize

## [2.14.0] — 2026-08-07

### Added
- Keep a persistent multi-turn conversation inside every Codex task card, including its original whiteboard material context
- Restore task-card conversation history after refreshing or switching boards

### Changed
- Replace the cramped raw result pane with a scrollable message thread and a bottom composer
- Render assistant answers as sanitized Markdown with clearer headings, lists, quotations, links, and code styling
- Keep the next follow-up editable while the current turn is running

## [2.13.9] — 2026-08-07

### Fixed
- Force narration repair to use local Kokoro `zf_xiaobei` instead of inheriting an expired or unavailable cloud provider from `audio_request.json`
- Retry an empty or partial local narration result once with single-line concurrency
- Include per-attempt audio-engine output when narration still cannot be generated

## [2.13.8] — 2026-08-07

### Changed
- Replace the font-dependent back, undo, and redo characters with a consistent 20px SVG icon set

### Fixed
- Close open toolbar menus and remove toolbar focus when the user returns to the whiteboard canvas
- Keep the Add and More menus mutually exclusive instead of allowing both panels to remain open

## [2.13.7] — 2026-08-07

### Fixed
- Replace open-ended Codex audio regeneration with a deterministic local narration-only repair step
- Preserve existing BGM and SFX while Kokoro rebuilds failed narration, then limit Codex to audio mounting and timeline alignment
- Show narration regeneration as its own progress stage and fail with a concrete local-audio error instead of waiting 15 minutes

## [2.13.6] — 2026-08-07

### Fixed
- Reject `system-espeak-fallback`, macOS system speech, and other mechanical narration fallbacks at the blocking audio-quality gate
- Require failed HeyGen or Kokoro narration to be regenerated instead of rendering a video that reads Chinese character by character

## [2.13.5] — 2026-08-07

### Fixed
- Re-sign only Kokoro's installed `espeakng-loader` dynamic libraries during macOS bridge installation so local Chinese narration no longer triggers repeated Gatekeeper dialogs
- Verify the repaired eSpeak library with Python before completing installation without disabling Gatekeeper or changing system-wide security policy

## [2.13.4] — 2026-08-07

### Fixed
- Replace the single 30-minute end-to-end video timeout with independent watchdogs for Codex authoring, audio generation, validation, repair, rendering, normalization, and packaging
- Report the exact video stage that exceeded its limit instead of returning a generic Codex timeout after valid downstream work

## [2.13.3] — 2026-08-07

### Fixed
- Preserve native clipboard copying when text is highlighted inside a task card instead of replacing it with the selected card payload
- Keep whole-card copy available when no text range or editable field is active

## [2.13.2] — 2026-08-07

### Fixed
- Retry quiet HyperFrames render-ready startup timeouts against the unchanged project with a longer runtime window instead of wasting two Codex project-repair passes
- Keep genuine browser page exceptions on the existing Codex repair path and report persistent runtime startup contention separately

## [2.13.1] — 2026-08-07

### Fixed
- Restore stable full-width chat rows so short user messages no longer collapse the role label and bubble into a narrow centered column
- Keep loading cards and assistant actions aligned with their message bubble without layout jumps

## [2.13.0] — 2026-08-07

### Added
- Expand the whiteboard in every direction while cards are dragged or the canvas is panned, instead of clamping modules to a fixed 3200×2200 boundary
- Persist dynamic canvas dimensions with each board viewport

### Changed
- Make zoom-to-fit, minimap navigation, relationship lines, automatic layout, and PNG/PDF exports use the dynamic canvas and content bounds

## [2.12.4] — 2026-08-07

### Changed
- Make the floating selection toolbar visually compact while preserving a 44px vertical pointer target

## [2.12.3] — 2026-08-07

### Changed
- Increase trackpad and mouse-wheel zoom sensitivity to `0.01`

## [2.12.2] — 2026-08-07

### Changed
- Increase trackpad and mouse-wheel zoom sensitivity to `0.001`

## [2.12.1] — 2026-08-07

### Changed
- Increase trackpad and mouse-wheel zoom sensitivity by 20% while keeping smooth proportional scaling

## [2.12.0] — 2026-08-07

### Added
- Draw persistent directional connections from source cards to Codex task cards and from task cards to generated result cards
- Add a relationship-aware `优化布局` action that arranges connected modules from left to right and packs unrelated modules into a clean grid
- Include module connections in whiteboard PNG and PDF exports

### Changed
- Keep relationship lines synchronized while cards move, resize, load from IndexedDB, copy, delete, or move through undo and redo history

## [2.11.0] — 2026-08-07

### Added
- Check every generated narration segment for completeness, pacing, pronunciation similarity, background-music mounting, and timeline ducking before HyperFrames rendering
- Automatically repair failed audio projects up to two times and expose dedicated narration-check, repair, and final-mix progress states

### Changed
- Prefer HeyGen Starfish Mandarin narration after HyperFrames sign-in, while retaining an explicitly tuned Kokoro offline fallback
- Rewrite narration as 4–7 scene-linked spoken segments, normalize numbers and domain terms for speech, and target a calmer 3.8–4.3 Chinese characters per second
- Normalize the exported mix to -16 LUFS with a -1 dB true-peak ceiling and keep background music below narration with timeline ducking

## [2.10.0] — 2026-08-06

### Added
- Run up to three independent local Codex tasks concurrently, with per-card progress, cancellation, failure, and result state
- Keep the lower-right Codex conversation independent so it can run alongside whiteboard task cards

### Changed
- Limit HyperFrames video generation to one concurrent job while allowing it to coexist with text or image-analysis tasks
- Expose active task IDs and the concurrency limit through the background bridge while retaining the legacy single-task status field

## [2.9.3] — 2026-08-06

### Changed
- Restore text-summary, image-generation, and video-generation shortcuts inside every selection-based Codex task card
- Keep free-form questions in the same card, show shortcut progress and cancellation there, and place generated image/video artifacts beside the task
- Apply optional text entered in the task as an extra instruction for each shortcut

## [2.9.2] — 2026-08-06

### Changed
- Redesign the extension popup as a compact two-action launcher with a clear coral primary save action and a quieter workspace entry
- Integrate the Markdown/PDF format picker into the primary control, show the remembered format in the menu, and remove empty status spacing

## [2.9.1] — 2026-08-06

### Changed
- Create an empty, focused question task when selected material is sent to Codex instead of immediately running a fixed summary prompt
- Let users ask any question about the attached board material and start the task with the send button or `Cmd/Ctrl + Enter`

## [2.9.0] — 2026-08-06

### Changed
- Create and immediately run an in-canvas task card when selected board material is sent to Codex
- Keep task progress, cancellation, errors, and the final answer inside the new card instead of opening the fixed chat panel
- Send selected text, images, links, task results, and source metadata through the existing background Codex task chain without duplicating image data in IndexedDB
- Keep the lower-right Codex entry as an independent conversation whose answers can still be added to the board

## [2.8.5] — 2026-08-06

### Fixed
- Flip the selection overflow menu above the toolbar near the viewport bottom and constrain its height to the available scrollable space

## [2.8.4] — 2026-08-06

### Changed
- Slightly increase trackpad and wheel zoom sensitivity while preserving smooth delta-based scaling

## [2.8.3] — 2026-08-06

### Fixed
- Stack the whiteboard minimap, Codex launcher, and zoom controls with explicit spacing so the fixed controls never overlap

## [2.8.2] — 2026-08-06

### Fixed
- Keep the Codex composer anchored to the bottom of the panel while the message history independently fills and scrolls through the remaining space

## [2.8.1] — 2026-08-06

### Changed
- Redraw the PageDock icon around a collected page resting in a dock, with a Codex creation spark
- Match the warm paper, deep ink, and coral product palette instead of the previous blue-purple Markdown mark
- Export the 16, 32, 48, 128, and 512 pixel PNG assets from one SVG master and explicitly use them for the Chrome action
- Use the same mark in the popup, Inbox, whiteboard, and Markdown editor for consistent product identity

## [2.8.0] — 2026-08-06

### Changed
- Replace the four-mode popup with two task-based actions: remember the last Markdown/PDF save format and open PageDock
- Consolidate selected-card summaries, image creation, video creation, custom questions, and current-page questions into the single persistent Codex panel
- Reduce the board toolbar to back, name, add, undo, redo, and more; reveal alignment and grouping only for a selection
- Move zoom controls onto the canvas, remove the duplicate home new-board action, and standardize Chinese UI copy on `收件箱` and `保存`
- Focus the side panel on Inbox capture and batch organization while keeping a lightweight shortcut that attaches the current page to Codex
- Route background work through one lightweight status surface with busy, error, and silent-success behavior

### Accessibility
- Increase primary interaction targets to 44px while preserving the compact visual hierarchy

## [2.7.6] — 2026-08-06

### Changed
- Generate whiteboard videos with deterministic local Mandarin narration and low-volume instrumental background music by default
- Require local audio assets, narration-driven duration sync, aligned captions, root-level audio tracks, and completion of pending BGM generation before rendering
- Show a dedicated progress state while Codex produces narration and music

## [2.7.5] — 2026-08-06

### Changed
- Make short Codex input and output bubbles shrink to their content while long messages wrap at 92% of the chat width
- Auto-grow the Codex composer from a compact single-line height to 160px, then switch to internal scrolling

## [2.7.4] — 2026-08-06

### Changed
- Remove the artificial maximum card width and the task-only minimum width so cards can be resized more freely
- Reduce selection toolbar padding, gaps, button height, and corner radius for a more compact footprint
- Replace fixed 10% wheel zoom jumps with lower-sensitivity delta-based scaling

### Fixed
- Reposition the selection toolbar continuously while a selected card is being resized

## [2.7.3] — 2026-08-06

### Fixed
- Keep the marquee selection rectangle fully transparent so board content remains visible while dragging

## [2.7.2] — 2026-08-06

### Fixed
- Optically center the quick-capture text against its action button without changing the compact row height

## [2.7.1] — 2026-08-06

### Fixed
- Require generated HyperFrames compositions to register the real synchronous paused GSAP Timeline under the matching composition ID
- Automatically ask Codex to repair non-browser render runtime failures, re-run the full HyperFrames check, and retry rendering up to two times
- Show a dedicated whiteboard progress state while Codex repairs a render-only runtime failure

## [2.7.0] — 2026-08-06

### Added
- Add a `任务` toolbar entry that creates persistent, movable Codex task cards on the current whiteboard
- Let each task card send or stop its own local Codex request and keep the independent result, completion, and error state inside the card

### Changed
- Include task prompts and completed results when task cards participate in whiteboard selection analysis and exports

## [2.6.7] — 2026-08-06

### Fixed
- Use HyperFrames' stable screenshot capture path for PageDock video renders instead of its experimental parallel drawElement path
- Preserve both the beginning and the error tail of long HyperFrames logs, and return a cleaned actionable failure instead of progress-only output

## [2.6.6] — 2026-08-06

### Fixed
- Probe the HyperFrames browser during Native Host installation and fall back from an incompatible cached build to a working system Chrome
- Keep the validated browser path in the Native Host environment for both HyperFrames checks and renders
- Report browser launch failures immediately instead of sending them through two ineffective Codex project-repair attempts

## [2.6.5] — 2026-08-06

### Added
- Show an in-thread Codex loading card with safe progress stages, elapsed time, and a visible stop hint

### Changed
- Map real Native Host start and thinking events to user-facing progress instead of exposing or inventing chain-of-thought

## [2.6.4] — 2026-08-06

### Changed
- Reduce the home search and quick-capture row height from 64px to 52px

## [2.6.3] — 2026-08-06

### Changed
- Shorten the home headline to `与 Codex 一起创作`

## [2.6.2] — 2026-08-06

### Changed
- Replace the generic home slogan with a direct whiteboard-and-Codex creation message
- Unify the home search and quick-capture corner hierarchy, including a wrapper-level focus ring

## [2.6.1] — 2026-08-06

### Fixed
- Keep the whiteboard Codex progress label transparent and readable instead of inheriting the minimap marker's coral fill

## [2.6.0] — 2026-08-06

### Changed
- Redesign the whiteboard, fixed Codex chat, Inbox side panel, popup, and Markdown editor as one warm-light Coral paper workbench for general users
- Introduce shared OKLCH design tokens, consistent typography, focus rings, control states, restrained press/lift motion, and reduced-motion fallbacks
- Switch Monaco to its light editor theme so Markdown source and preview stay visually consistent

## [2.5.0] — 2026-08-06

### Added
- Fixed Codex chat entry on both the PageDock home and board canvas, with a compact non-modal conversation panel
- Local conversation continuity using the recent user and Codex messages as bounded context, with history persisted in extension storage
- One-click placement of any Codex answer as a text card on the current board, falling back to the Inbox from the home view
- New-conversation, keyboard send, close, connection, busy, error, stop, and success states without opening the browser side panel

### Changed
- Share the single local Codex bridge between selection AI and direct chat so their progress and cancellation states cannot overwrite each other
- Add a restricted Native Host conversation mode that keeps shell and file tools disabled

## [2.4.3] — 2026-08-06

### Fixed
- Make whiteboard cancellation immediately clear stale task state even when the Native Host has disconnected or the task already failed
- Disable repeated stop requests while cancellation is pending and restore the control if delivery fails
- Terminate the complete Codex, HyperFrames, browser, and FFmpeg process group instead of only the direct child process
- Explicitly hide toolbar buttons carrying the `hidden` attribute

## [2.4.2] — 2026-08-06

### Fixed
- Feed structured HyperFrames browser-check findings back into Codex for up to two targeted repair passes instead of deleting the generated project after the first failed check
- Extend video task timeouts for the repair loop and show a dedicated repair status on the originating whiteboard selection
- Return expanded structured check diagnostics when automatic repair cannot resolve the project

## [2.4.1] — 2026-08-06

### Fixed
- Bind Codex progress, status text, and cancellation controls to the exact whiteboard cards that started the task instead of reusing that state on a later selection
- Keep a user's newer selection unchanged when an earlier selection's AI result finishes in the background

## [2.4.0] — 2026-08-06

### Added
- Generate a 30–45 second Chinese 16:9 explainer video from every selected whiteboard card as one multimodal context
- Let Codex author an isolated HyperFrames project, then run trusted fixed-argument `check` and high-quality `render` steps outside the agent sandbox
- Return MP4 files through bounded Native Messaging chunks and save them as persistent, playable, downloadable IndexedDB video cards

### Changed
- Require and verify local HyperFrames and FFmpeg executables when installing the macOS Codex bridge
- Extend long-running video jobs to 20 minutes while keeping ordinary Codex analysis at the existing 3-minute timeout

## [2.3.2] — 2026-08-06

### Fixed
- Keep long whiteboard text inside its resized card and make the content area independently scrollable
- Prevent inner text scrolling from propagating to the whiteboard viewport while preserving the drag handle and source footer

## [2.3.1] — 2026-08-06

### Fixed
- Treat every selected text, image, and link as one multimodal context for both whiteboard AI actions instead of splitting inputs by card type
- Replace the separate image-description action with a visual-summary generator that combines original materials and Codex understanding into one PNG card
- Reject selections above the explicit 12-image limit instead of silently analyzing only part of the selection

## [2.3.0] — 2026-08-06

### Added
- Floating AI actions after whiteboard selection, with separate text and image summaries
- Codex vision input for up to six selected PNG, JPEG, or WebP cards; temporary image files are permission-restricted and removed after the task
- Insert every AI response as an editable, movable, undoable whiteboard text card beside the original selection

## [2.2.4] — 2026-08-06

### Fixed
- Add the Native Host's exact Node.js directory to `PATH` before launching Codex, so Chrome's minimal environment works with NVM-installed CLIs
- Run the macOS Host installer self-test in a Chrome-like clean environment to catch missing-Node failures before installation completes

## [2.2.3] — 2026-08-06

### Fixed
- Keep the local Codex Native Messaging connection in the extension background so side-panel reloads and tab switches do not interrupt an active analysis
- Show the exact local-bridge connection error and provide a reconnect action instead of leaving the panel in an ambiguous disconnected state

## [2.2.2] — 2026-08-06

### Changed
- Shorten the fourth toolbar action to `侧边栏`; the panel continues to contain Inbox and local Codex features

## [2.2.1] — 2026-08-06

### Changed
- Rename the fourth toolbar action to `收件箱 / Codex 侧栏` so the local Codex entry is visible before opening the side panel
- Show the loaded extension version below the PageDock side-panel title to make stale Chrome resources immediately identifiable

## [2.2.0] — 2026-08-06

### Added
- Local Codex assistant in the Inbox side panel for complete-page summaries and questions
- Restricted Chrome Native Messaging host that runs `codex exec` with ephemeral sessions, local command tools disabled, a read-only sandbox, an empty workspace, and no approval escalation
- macOS installer that registers `com.pagedock.codex` for the PageDock extension and verifies the local Codex CLI

### Changed
- Reuse the complete virtual-scroll page collector and convert captured HTML to Markdown before local Codex analysis
- Add the Chrome `nativeMessaging` permission for the explicitly installed local bridge

## [2.1.0] — 2026-08-05

### Added
- Multi-select Inbox cards and move them to another board in one batch
- Archive, restore, and permanently delete Inbox cards in batches
- Choose the Inbox or one of the three most recently used boards from every PageDock context-menu collection action
- Open a collected card's original page directly from its source link

### Changed
- Hide archived Inbox cards from board and recent-item views while retaining them in complete backups
- Refresh context-menu board targets after board and Inbox data changes

## [2.0.1] — 2026-08-05

### Fixed
- Only show the selection marquee after a 4px drag, so clicking blank canvas no longer flashes the previous selection box
- Clear the marquee's inline bounds after every completed or cancelled selection gesture

## [2.0.0] — 2026-08-05

### Added
- IndexedDB-backed multi-board storage with board list, detail view, Inbox, recent collection history, search, and one-time legacy migration
- Context-menu collection for selected text, images, links, and pages with source metadata
- Chrome side-panel Inbox with quick capture and board navigation
- Whiteboard zoom, pan, marquee/Shift multi-select, alignment, grouping, undo/redo, keyboard shortcuts, and minimap
- Current-board `.pagedock`, PNG, and PDF exports plus complete backup and restore
- New-tab home with recent boards, recent collections, search, quick capture, and board creation

### Changed
- Move all board records and imported image data from `chrome.storage.local` to IndexedDB
- Require Chrome 116 or later for direct Side Panel opening

## [1.7.4] — 2026-08-05

### Changed
- Rename the extension from **Markdownify Web** to **PageDock**
- Adopt the Chinese positioning **网页存档与整理** and the whiteboard tagline **收下网页，自由整理**
- Rename generated PDF folders, fallback filenames, and release archives to use the PageDock brand

## [1.7.3] — 2026-08-05

### Fixed
- Register the whiteboard as Chrome's new-tab override so opening a new tab loads `whiteboard.html`

## [1.7.2] — 2026-08-05

### Changed
- Pin the whiteboard tab to the installed extension's own `whiteboard.html`

## [1.7.1] — 2026-08-05

### Changed
- Rename the third popup action from **白板模式** to **白板工具**

## [1.7.0] — 2026-08-05

### Added
- Whiteboard mode in a new extension page for pasting copied text and images
- Editable and resizable cards with free drag layout, keyboard movement, deletion, and local auto-save
- Image file import, image drag-and-drop, and automatic board restoration

### Changed
- Rename the popup actions to **页面转 Markdown**, **页面转 PDF**, and **白板模式**

## [1.6.0] — 2026-08-04

### Added
- Draggable divider for resizing Markdown source and preview panes between 20% and 80%
- Persisted split ratio, keyboard adjustment, and double-click reset to 50/50

## [1.5.0] — 2026-07-27

### Added
- Export every full-page screenshot as one multi-page PDF regardless of page length
- Embed native-resolution RGB screenshot data with lossless Flate compression and PNG row prediction

### Changed
- Replace multiple long-page PNG downloads with a single PDF download

## [1.4.2] — 2026-07-27

### Changed
- Wait 600 ms after every screenshot scroll so lazy-loaded and dynamically rendered content can settle before capture
- Apply the same delay before the final page-height measurement

## [1.4.1] — 2026-07-27

### Changed
- Preserve the browser screenshot's native pixel density instead of reducing high-DPI captures to one pixel per CSS pixel
- Disable Canvas image smoothing while stitching screenshot tiles

### Fixed
- Text in long screenshots now retains the same source resolution as the browser viewport

## [1.4.0] — 2026-07-27

### Added
- Toolbar popup with separate **Markdown** and **Screenshot** actions
- Virtual-scroll Markdown collection for pages that render only the visible content blocks
- Scroll-and-stitch PNG capture for document-level and nested scrolling containers
- Automatic high-resolution PNG splitting for extremely long pages

### Fixed
- Screenshot downloads now remove invisible Unicode filename controls, respect UTF-8 byte limits, and retry with a safe ASCII filename when Chrome rejects a page title
- Long screenshots no longer shrink below one output pixel per CSS pixel, keeping document text readable

## [1.3.0] — 2026-06-15

### Added
- Tri-state view switcher in the toolbar: **Source / Split / Preview**, persisted via `chrome.storage.local`
- Live Markdown preview (marked + DOMPurify XSS sanitization)
- Keyboard shortcuts: `Cmd/Ctrl + 1 / 2 / 3` for source / split / preview
- Dark-theme preview styling for headings, code, tables, quotes, links

### Changed
- Project renamed to **Markdownify Web** for clearer discoverability
- `manifest.json` `name` / `description` / `default_title` rewritten for store-ready copy

## [1.2.0] — 2026-06-15

### Added
- Mozilla Readability integration — extracts main article content, falls back to cleaned `<body>` when declined
- Turndown + GFM plugin — HTML → Markdown with tables, strikethrough, task lists
- Monaco Editor — VS Code-grade editing experience inside the extension
- Custom Turndown rules: relative-URL resolution, language-aware fenced code blocks, `data:` image stripping
- Auto-inject `# title / > source / > byline` header into the produced Markdown

### Changed
- Replaced the legacy `<textarea>` with Monaco

## [1.1.0] — 2026-06-15

### Changed
- Removed the toolbar action buttons in favor of a minimal, distraction-free editor
- Draft is now auto-saved silently on every input

## [1.0.0] — 2026-06-15

### Added
- Initial release: click the toolbar icon to capture page text and edit it in a basic editor
- Draft persistence via `chrome.storage.local`
- Graceful fallback for `chrome://` / `edge://` internal pages
