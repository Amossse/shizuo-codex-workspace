# Shizuo 2.24.2

Shizuo 2.24.2 is a runtime modularization and compatibility release for the local-first visual Codex workspace.

## Highlights

- Splits the whiteboard, background worker, and Native Host into ownership-based modules
- Keeps every first-party source file at or below 1,000 lines with an automated verification gate
- Preserves the extension, Native Messaging, MCP, collaboration, and release interfaces
- Restores the documented Node.js 18 development and CI compatibility
- Packages every new runtime module in the deterministic release archive

## Install

1. Download `shizuo-codex-workspace-2.24.2.zip` from this release.
2. Optionally verify it with `SHA256SUMS.txt`.
3. Unzip it, open `chrome://extensions`, enable Developer mode, and choose Load unpacked.
4. Select the unzipped `shizuo-codex-workspace-2.24.2` folder.
5. Optional: connect local Codex by following the README quick start.

The release archive contains only install/runtime files and public policy documents. Tests, GitHub configuration, development screenshots, and local files are not included.
