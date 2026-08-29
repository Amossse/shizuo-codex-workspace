# Shizuo 2.24.1

Shizuo 2.24.1 is a release-hardening update for the local-first visual Codex workspace.

## Highlights

- Adds CI across supported Node.js versions and release-contract checks
- Ships an allowlisted extension ZIP plus a SHA-256 checksum
- Documents every browser permission and local/network data boundary
- Adds structured bug reports, feature requests, setup support, and a pull request checklist
- Keeps Native Host execution helpers behind a small tested module boundary
- Includes the latest video-runtime resilience and sanitized product documentation from `main`

## Install

1. Download `shizuo-codex-workspace-2.24.1.zip` from this release.
2. Optionally verify it with `SHA256SUMS.txt`.
3. Unzip it, open `chrome://extensions`, enable Developer mode, and choose Load unpacked.
4. Select the unzipped `shizuo-codex-workspace-2.24.1` folder.
5. Optional: connect local Codex by following the README quick start.

The release archive contains only install/runtime files and public policy documents. Tests, GitHub configuration, development screenshots, and local files are not included.
