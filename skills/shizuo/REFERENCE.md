# 拾作 Skill reference

## Deterministic setup commands

Run from the installed Skill directory:

```bash
sh scripts/shizuo.sh health
sh scripts/shizuo.sh status
sh scripts/shizuo.sh local
sh scripts/shizuo.sh lan-host
sh scripts/shizuo.sh disable
sh scripts/shizuo.sh delete-on
sh scripts/shizuo.sh delete-off
```

Configure a second Codex client on the same trusted private network:

1. On the board owner's canvas, click “邀请协作” and expand “连接对方的 Codex”.
2. Copy that instruction into the other Codex and explicitly ask it to connect. The primary browser link is for a person to join the live board without installing 拾作.
3. That Codex runs the invitation's terminal command directly without opening Chrome, then restarts. The invitation expires after 10 minutes or its first successful claim.

The owner sees connected people and Codex clients, presence, comments, and live read/write activity on the canvas. Browser collaborators can create, edit, move, resize, and connect cards immediately without per-change confirmation; owners can still downgrade a person to ask-each-time or read-only. Each invite has an independent token restricted to the board that was open when sharing started; “本次会话允许” remains available for Codex clients and expires when sharing stops.

The one-time installer registers a separate, board-scoped `shizuo-lan` MCP. Set `SHIZUO_REPLACE=1` only when the user asks to replace that existing client configuration.

## MCP tool mapping

| Intent | Tool |
| --- | --- |
| List whiteboards | `shizuo_list_boards` |
| Read cards | `shizuo_get_board` |
| Search cards and sources across boards | `shizuo_search_cards` |
| Create whiteboard | `shizuo_create_board` |
| Create card or task | `shizuo_create_card` |
| Update card content or geometry | `shizuo_update_card` |
| Connect card data | `shizuo_connect_cards` |
| Progressively generate long card content | `shizuo_stream_card` |
| Read collaboration comments | `shizuo_list_messages` |
| Wait for new collaboration events | `shizuo_watch_events` |
| Reply or comment on a card | `shizuo_send_message` |
| Show cursor, selection, and state | `shizuo_update_presence` |
| Report task progress and final result | `shizuo_report_task` |
| Delete cards | `shizuo_delete_cards` |

## Examples

- “读取拾作里项目复盘白板”：list, resolve the board ID, then get the board page by page.
- “把这段结论放进白板”：resolve the target board, create a text/document card, then re-read it.
- “让 A 的内容流向任务 B”：read both card IDs, connect A to B, then verify B's `relationSourceIds`.
- “让同事在内网用 Codex 访问”：prefer the canvas one-time invite; use `lan-host` plus `lan-client` only as a manual fallback.

## Task reporting

Use one stable `taskId` for the whole Codex turn and increase `revision` for every update. Start with `started`, use `running` only for meaningful user-visible milestones, switch to `waiting_approval` while a whiteboard mutation needs confirmation, and always finish with `completed`, `failed`, or `cancelled`. Put the concise final answer in `result` and link created or updated output cards through `cardIds`. Never report hidden reasoning or secrets.

Local Codex Desktop turns are also detected from their local session lifecycle (`task_started`, `task_complete`, and `turn_aborted`). This automatic signal only drives the current pet state and a short user-request title; use `shizuo_report_task` when the owner needs durable milestones, linked cards, or a final result in task history.

## Security boundary

The bridge is HTTP on a trusted private network, not end-to-end encrypted. Browser and Codex invitations are unguessable, expire after 10 minutes, can be claimed only once, and issue independent per-client tokens scoped to one board. The browser token stays in an HttpOnly same-site cookie. Remote mutations follow the owner's per-client policy and use optimistic version checks. Audit activity and comments persist locally. LAN mode never implies delete permission, terminal access, local-file-handle access, or permission to publish a token.
