# Privacy Policy

Last updated: 2026-08-29

拾作 (Shizuo) is a local-first browser extension. It has no analytics, advertising SDK, account system, or hosted data service operated by the project.

## Data stored locally

The following data stays in the browser profile that installed the extension:

- Captured webpages, selections, links, images, and their source metadata
- Boards, cards, connections, revisions, templates, provenance, and search indexes
- Inbox state, extension preferences, task metadata, and page-level chat history
- Browser file or folder handles explicitly granted to a card

Browser file handles are not included in portable exports. Use the extension's delete, board-delete, history, or full-reset controls to remove local records. Uninstalling the extension also removes its browser-managed local data according to the browser's extension-storage behavior.

## When data can leave the browser

拾作 makes no background analytics or advertising requests. Network or local-process activity occurs only for a capability you invoke:

- **Page capture and page cards:** the extension reads the active page or a URL you explicitly authorize. Optional HTTP(S) host permission is requested for that origin.
- **Codex tasks:** selected material and your prompt are sent through Chrome Native Messaging to your local Native Host, which invokes your existing Codex CLI. Codex network traffic and retention follow the Codex CLI and account settings; the extension never receives your Codex credentials.
- **Image and video creation:** explicit creation tasks can invoke the selected local agent and optional HyperFrames, Remotion, FFmpeg, or Kokoro tools. Those tools have their own network and storage behavior.
- **Trusted-LAN collaboration:** when you explicitly start sharing, the Native Host exposes a board-scoped HTTP session to the private network. Traffic is not end-to-end encrypted; use it only on a trusted network and stop sharing when finished.
- **Remote images:** an explicit capture or export may fetch an image referenced by the selected page so it can be stored with the card.

## Browser permission reference

| Permission | Why it is needed | Activation boundary |
| --- | --- | --- |
| `activeTab` | Read the page the user is actively capturing or asking about | A toolbar, context-menu, or explicit page action |
| `scripting` | Inject the capture helper into the selected tab | An explicit capture/read action |
| `storage` | Store preferences and lightweight extension state | Local extension use |
| `downloads` | Save Markdown, images, PDFs, backups, and board exports | An explicit export/download action |
| `offscreen` | Stitch full-page screenshots without keeping a visible helper tab | An explicit screenshot/PDF capture |
| `contextMenus` | Offer capture actions for pages, links, images, and selections | Browser context-menu use |
| `sidePanel` | Provide the Inbox and page-assistant panel | The user opens the side panel |
| `nativeMessaging` | Connect the extension to the locally installed Codex bridge | Local Codex, terminal, collaboration, or media actions |
| `alarms` | Resume scheduled tasks and bounded reconnect attempts | A schedule or local bridge has been configured |
| New-tab override | Show the local board home and canvas | Opening a new tab while the extension is enabled |
| `<all_urls>` content script | Show the draggable page assistant on normal webpages | Supported HTTP(S) pages; the assistant can be closed or collapsed |
| Optional `http://*/*` / `https://*/*` | Read a page-card URL from its origin after approval | Requested per explicit page-card access |

The extension does not run on browser-internal pages where Chrome extensions are prohibited.

## Local Native Host and credentials

The installer registers `com.pagedock.codex` for the extension ID supplied by the user. The local bridge binds to `127.0.0.1` by default and stores its random token in the user's application-support directory. Routine output redacts that token. Neither bridge tokens nor Codex credentials belong in issues, screenshots, commits, or shared documents.

## Collaboration safety

LAN sharing is off by default. Starting it creates expiring, one-time invitations and independent board-scoped client tokens. Stopping sharing revokes the active collaboration sessions. LAN mode does not grant terminal access, browser file-handle access, unrestricted shell access, or deletion permission.

## Security reports

Do not include captured content or tokens in a public issue. Report vulnerabilities through the private process described in [SECURITY.md](SECURITY.md).

## Changes

Material privacy changes will be documented in [CHANGELOG.md](CHANGELOG.md) and reflected in this file's update date.
