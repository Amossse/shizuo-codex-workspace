# Shizuo 2.24.3

Shizuo 2.24.3 makes the required local Codex setup explicit and recoverable without changing an existing unpacked extension ID.

## Highlights

- The setup sequence now makes the Chrome Native Messaging boundary explicit: load 拾作, copy its shown extension ID, run the installer, then reload.
- The installer validates the supplied ID and writes that exact origin into the local Native Messaging allowlist.
- If the local bridge is unavailable, the launcher and task card explain whether to reload 拾作 or run the installer instead of showing a generic retry error.

## Install

1. Download `shizuo-codex-workspace-2.24.3.zip` from this release and unzip it.
2. Open `chrome://extensions`, enable Developer mode, and choose Load unpacked.
3. Select the unzipped folder and copy the shown extension ID.
4. Run `PAGEDOCK_EXTENSION_ID=your_extension_id ./install.sh --core` in that folder, then reload 拾作 once.
5. Run `sh "$HOME/.codex/skills/shizuo/scripts/shizuo.sh" health`; the bridge should report connected after the extension is open.

The release archive contains only install/runtime files and public policy documents. Tests, GitHub configuration, development screenshots, and local files are not included.
