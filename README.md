# Shizuo · 拾作

> **Turn scattered web research into answers you can check and revisit.** Collect source material, ask Codex about it, and keep the answers beside the originals.

[简体中文](README.zh-CN.md) · [Download](https://github.com/Amossse/shizuo-codex-workspace/releases/latest) · [Setup](#quick-start) · [Privacy](PRIVACY.md)

![Shizuo canvas connecting source material, a Codex task, and a visible result](docs/product-canvas-real.jpg)

## Why Shizuo

Comparing several articles usually means copying passages into a chat and finding the originals again later. Shizuo keeps the material and the conversation together:

- Collect pages or selected passages with their source links.
- Select the material and ask Codex to summarize, compare, or answer a question.
- Return to the saved answer, check the original material, and ask a follow-up.

Board data stays in your browser by default. Content is sent to your local AI CLI only when you explicitly run a task.

## Quick start

New installations use English. Change **Language** in the extension popup or **More → AI and connections** to English or 简体中文. Existing installations keep Chinese. Reopen pages after switching; active tasks and collected content are left unchanged. AI answers follow your question's language, not the interface language.

### 1. Install the extension

1. Download and unzip the [latest release](https://github.com/Amossse/shizuo-codex-workspace/releases/latest).
2. Open `chrome://extensions` or `edge://extensions` and enable **Developer mode**.
3. Choose **Load unpacked**, select the extracted folder, and pin Shizuo.

You can now capture and organize content without Codex.

### 2. Capture your first item

Open a new tab, paste a passage, then choose **开始收集 (Start collecting)**. Shizuo saves it and opens the board with that item selected. No board setup is needed.

To keep an article's source, collect its text using the extension button or selection menu on the original page. Pasting a URL saves the link; it does not import the article body.

### 3. Ask about your material

Select your material and choose **交给 AI (Ask AI)**. Connect Codex when you first want an answer; collection works without it.

Install and sign in to the [Codex CLI](https://developers.openai.com/codex/cli), then run this once from the extracted Shizuo folder:

```sh
./install.sh --core
```

Reload Shizuo in `chrome://extensions`. The installer detects the unpacked extension automatically, registers the local Native Host and MCP, and verifies the bridge. See [local Codex setup](docs/local-codex-setup.md) if detection fails.

## Try one real research task

Collect passages from three articles about a topic you are researching into the same board. Select the three cards, choose **交给 AI**, and ask:

> Where do these articles agree and disagree? Identify the source for each point. If the collected passages do not support a conclusion, say so.

The answer is saved on the board. Compare it with the source cards, then ask a follow-up in the same task. Source links make checking easier; they do not guarantee that an AI answer is correct. Nothing is sent to Codex until you run a task.

Image generation, multi-step workflows, and other advanced tools remain in the menus and task settings. See [capabilities](docs/capabilities.md) when you need them.

## Everyday actions

| Goal | Start here |
| --- | --- |
| Save a page or selection | Extension button or the selection menu |
| Open the canvas | A new tab or **Open Shizuo** |
| Ask Codex to work on context | Select cards, then choose **Send to AI** |
| Ask from the current page | Select text and choose **Ask Codex** |
| Find previous work | Search boards, cards, and sources from Home |

## Develop

There is no build step. Load the repository as an unpacked extension, edit the files, and reload it from `chrome://extensions`.

```sh
npm test
```

Runtime code lives under `app/`; the constrained local bridge lives under `native-host/`. See [architecture](docs/architecture.md), [capabilities](docs/capabilities.md), and [contributing](CONTRIBUTING.md).

## License

[MIT](LICENSE) © Shizuo Contributors
