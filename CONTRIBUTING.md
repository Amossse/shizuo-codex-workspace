# Contributing to 拾作

Thanks for your interest in improving **拾作**! This document describes how to set up the project locally, the conventions we follow, and how to submit changes.

## Prerequisites

- Node.js ≥ 18 (only needed for refreshing vendored dependencies)
- Latest Chrome or Edge (Chromium-based)
- Familiarity with Manifest V3 extensions

## Local development

1. Fork and clone this repository, then enter the `shizuo` directory.

2. Load the unpacked extension

   - Open `chrome://extensions`
   - Toggle **Developer mode**
   - Click **Load unpacked** → select this directory

3. Iterate

   - Edit `editor.js` / `editor.html` / `background.js`
   - Hit the **Reload** button on the extension card in `chrome://extensions`
   - Click the toolbar icon on a sample page to retest

There is **no build step** — everything is plain JS so you can iterate in seconds.

## Refreshing vendored dependencies

```bash
npm pack turndown turndown-plugin-gfm @mozilla/readability marked dompurify monaco-editor
```

Then copy the relevant files into `vendor/`:

| From npm tarball | Into |
| --- | --- |
| `turndown/dist/turndown.js` | `vendor/turndown/` |
| `turndown-plugin-gfm/dist/turndown-plugin-gfm.js` | `vendor/turndown/` |
| `@mozilla/readability/Readability.js` | `vendor/readability/` |
| `marked/lib/marked.umd.js` | `vendor/markdown/` |
| `dompurify/dist/purify.min.js` | `vendor/markdown/` |
| `monaco-editor/min/` (entire directory) | `vendor/monaco/min/` |

Monaco ships at ~16 MB unpacked. Trim what you don't need:

- `vs/language/` — TS / CSS / HTML / JSON language services (this project only uses `markdown`)
- `vs/assets/{ts,css,html,json}.worker-*.js` — corresponding language workers
- `vs/nls.messages.{de,es,fr,it,ja,ko,pl,pt-br,ru,tr,zh-tw}.js.js` — translations you don't ship

After trimming, the bundle is ~5 MB.

## Commit conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
feat:     new feature
fix:      bug fix
docs:     documentation only
style:    formatting (no behavior change)
refactor: code restructure (no behavior change)
perf:     performance improvement
test:     tests
chore:    build / tooling / deps
```

Examples:

```
feat(editor): add Export .md toolbar action
fix(turndown): preserve query strings when resolving relative URLs
docs(readme): expand FAQ on Monaco worker loading
```

## Pull request flow

1. Fork and branch: `git checkout -b feat/your-feature`
2. Verify your change by loading the extension and exercising it in the browser
3. Update `CHANGELOG.md` under `## [Unreleased]`
4. Open a PR with: motivation, summary of changes, how to test, screenshots (for UI changes)
5. A maintainer will review and merge

## Filing issues

Please include:

- Browser and version (e.g. Chrome 126.0.6478.127, Edge 126)
- Operating system
- Reproduction steps
- Screenshot or console error
- The URL that triggers the issue (if public)

## Code style

- 2-space indentation
- Prefer double quotes; backticks for templates
- `const` / `let` only — no `var`
- Comment non-obvious logic; include an example next to non-trivial regex
- Keep dependencies vendored and version-pinned

## Code of Conduct

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).
