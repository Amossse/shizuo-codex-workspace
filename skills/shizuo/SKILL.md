---
name: shizuo
description: Connects Codex to the 拾作 Chrome extension, configures its local or trusted-LAN MCP bridge, and reads or operates whiteboards and cards. Use when the user mentions 拾作, shizuo MCP, whiteboard connection, LAN sharing, board/card operations, or asks Codex to work with content in the 拾作 plugin.
---

# 拾作

## Quick start

1. Resolve this skill directory and run `sh scripts/shizuo.sh health`.
2. Prefer the available `shizuo_*` MCP tools for every whiteboard read or mutation.
3. If the MCP is not registered, run `bash scripts/shizuo.sh local`, then tell the user to reload 拾作 and restart Codex.
4. Never claim the current Codex session can use a newly registered MCP until its tools are actually available.

## Connection workflow

- Default to `local`; it binds the host to `127.0.0.1` and keeps deletion disabled.
- If the user provides a `/v1/join/<code>` invite and explicitly asks to connect, do not open it in Chrome. Run its one-time `curl -fsS -X POST '<invite>/install' | zsh` command directly in the terminal. Do not print the returned installer or embedded token.
- Prefer the canvas “邀请协作” action: its browser link lets a person join the current board without installing 拾作, while the separate Codex instruction connects another Codex. Both are 10-minute, one-time, board-scoped invitations and keep deletion disabled.
- At the start of a remote collaboration turn, read `shizuo_list_messages`, create a stable task ID, and call `shizuo_report_task` with `phase: started`. Report meaningful user-visible stages with increasing revisions, refresh tasks longer than 60 seconds, then always report `completed`, `failed`, or `cancelled` with the concise final result before ending the turn.
- Local Codex Desktop turn lifecycle is observed automatically by the Native Host and shown by the canvas pet. Keep explicit `shizuo_report_task` calls for remote turns, meaningful milestones, linked cards, and final results; automatic observation never exposes response text, hidden reasoning, logs, or credentials.
- While actively collaborating, call `shizuo_watch_events` with the returned cursor and use `shizuo_send_message` for replies. Long polling does not wake a stopped Codex process.
- Task reports may contain only user-readable progress and results. Never send hidden reasoning, credentials, tokens, raw terminal output, or sensitive logs.
- Use `shizuo_update_presence` before reading or changing a focused card so the owner sees the active cursor, selection, and state.
- Remote reads appear in the owner's persistent activity feed. Every remote create, update, connect, or stream waits for the configured owner policy: read-only, ask each time, session allow, or editable. Never retry a rejected or expired request automatically.
- Run `bash scripts/shizuo.sh lan-host` only when the user explicitly requests trusted-intranet access.
- Configure another LAN user's Codex with `SHIZUO_BRIDGE_URL` and `SHIZUO_BRIDGE_TOKEN`, then run `bash scripts/shizuo.sh lan-client` on that user's machine.
- Treat the bridge token as a secret. Never include it in normal answers, logs, documents, commits, or screenshots.
- Enable deletion with `bash scripts/shizuo.sh delete-on` only after explicit authorization; return to `delete-off` afterward when practical.
- Do not expose terminal execution, browser file handles, or local Shell access through this Skill.

## Whiteboard workflow

1. List boards before assuming a board ID.
2. Read the selected board and continue with `nextOffset` until the needed cards are present.
3. Use `shizuo_search_cards` when the user describes content or source but not the board/card ID.
4. For ambiguous mutations, identify the target board/card before changing it. A shared client can access only its invited board.
5. Use card types supported by the MCP: text, document, code, image, link, page, and task.
6. Use connections only in explicit source to target order.
7. Pass the latest `updatedAt` as `expectedUpdatedAt` or `expectedTargetUpdatedAt` for updates, connections, and streams. On conflict, re-read before proposing a retry.
8. For long text, prefer `shizuo_stream_card` so one approved operation appears progressively on the canvas.
9. Re-read the affected board after each mutation and report the concrete result.
10. Do not delete cards unless the user explicitly asks for deletion.

## Failure handling

- If status says Chrome is disconnected, ask the user to reload 拾作 in `chrome://extensions` and keep Chrome running.
- If `codex mcp get shizuo` succeeds but no `shizuo_*` tools are loaded, restart Codex; do not re-register repeatedly.
- If a LAN request fails, verify private-network reachability, URL, token, and host mode without printing the token.
- See [REFERENCE.md](REFERENCE.md) for commands, tool mapping, and examples.
