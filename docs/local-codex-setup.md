# Connect local Codex

Capture and canvas features work offline. You only need this setup when Shizuo should run a task through your signed-in local Codex CLI.

## One-time setup

1. Load the extracted Shizuo folder from `chrome://extensions`.
2. Open a terminal in that same folder and run:

```sh
./install.sh --core
```

3. Reload Shizuo from `chrome://extensions`.
4. Open Shizuo and choose **Send to AI**. A green local connection state means it is ready.

The installer identifies the extension ID from the loaded folder, registers the local Native Messaging Host and MCP, and verifies the bridge. It does not share Codex credentials with the extension.

If multiple copies of Shizuo are loaded or automatic detection fails, copy the target extension ID and run:

```sh
PAGEDOCK_EXTENSION_ID=your_extension_id ./install.sh --core
```

## Health check

```sh
sh "$HOME/.codex/skills/shizuo/scripts/shizuo.sh" health
```

If the Native Host is ready but the Codex CLI is not, run `codex` in a terminal and complete sign-in, then check the connection again in Shizuo.

## Optional profiles

```sh
./install.sh --core
./install.sh --terminal
./install.sh --video
```

`core` is the smallest profile for everyday tasks. Terminal and video support are optional.

[中文说明](local-codex-setup.zh-CN.md)
