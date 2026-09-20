import assert from "node:assert/strict";
import vm from "node:vm";
import { readdirSync } from "node:fs";
import path from "node:path";
import { readSource } from "./source-utils.mjs";
import { createTaskPrompts } from "../native-host/task-prompts.mjs";

async function runtime(stored = {}, databases = [], failWrite = false, worker = false, website = false) {
  const listeners = [];
  const context = vm.createContext({ console, document: worker ? undefined : {},
    location: { protocol: website ? "https:" : "chrome-extension:" },
    indexedDB: { databases: async () => { assert.equal(website, false, "must not read website databases"); return databases; } },
    chrome: { runtime: { sendMessage: async message => {
      assert.equal(message.type, "shizuo-language-get");
      return { language: "zh-CN" };
    } }, storage: { local: {
      get: async () => ({ ...stored }),
      set: async value => { if (failWrite) throw new Error("Storage unavailable"); Object.assign(stored, value); }
    }, onChanged: { addListener: callback => listeners.push(callback) } } }
  });
  for (const file of ["i18n-en.js", "i18n-en-extended.js", "i18n.js"]) vm.runInContext(readSource(`app/core/${file}`), context);
  await context.ShizuoI18n.ready;
  return { context, api: context.ShizuoI18n, stored, listeners };
}

const fresh = await runtime();
assert.equal(fresh.api.language, "en");
assert.equal(fresh.stored[fresh.api.KEY], "en");
assert.equal(fresh.api.t("拾作"), "Shizuo");
assert.equal(fresh.api.t("发送"), "Send");
const userText = "发送 <img src=x onerror=alert(1)> {1} $&";
assert.equal(fresh.api.t("来源：{0}", userText), `Source: ${userText}`, "interpolation must preserve user content exactly without recursive translation");
assert.equal(fresh.api.t(userText), userText);
for (const [source, translated] of Object.entries(fresh.context.ShizuoEnglish)) {
  const slots = text => [...text.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
  assert.deepEqual(slots(translated), slots(source), `Placeholder mismatch: ${source}`);
  assert.doesNotMatch(translated, /\p{Script=Han}/u, `Untranslated English message: ${source}`);
}
assert.equal((await runtime({}, [{ name: "pagedock" }])).api.language, "zh-CN");
assert.equal((await runtime({ __whiteboard_state__: {} })).api.language, "zh-CN");
assert.equal((await runtime({ __pagedock_ai_runtime_v1__: "codex" })).api.language, "zh-CN");
assert.equal((await runtime({ [fresh.api.KEY]: "en" }, [{ name: "pagedock" }])).api.language, "en");
assert.equal((await runtime({ [fresh.api.KEY]: "invalid" })).api.language, "en");
await fresh.api.setLanguage("zh-CN");
assert.equal(fresh.api.language, "en", "an active page must not reload or change language halfway through a task");
const reopened = await runtime(fresh.stored);
assert.equal(reopened.api.t("发送"), "发送");
await reopened.api.setLanguage("en");
assert.equal((await runtime(reopened.stored)).api.language, "en");
await assert.rejects(() => fresh.api.setLanguage("fr"), /Unsupported/);
const failure = await runtime({ [fresh.api.KEY]: "en" }, [], true);
await assert.rejects(() => failure.api.setLanguage("zh-CN"), /Storage unavailable/);
assert.equal(failure.api.language, "en");
const worker = await runtime({ [fresh.api.KEY]: "en" }, [], false, true);
worker.listeners[0]({ [fresh.api.KEY]: { newValue: "zh-CN" } }, "local");
assert.equal(worker.api.t("发送"), "发送");
const contentScript = await runtime({}, [], false, false, true);
assert.equal(contentScript.api.language, "zh-CN", "website scripts must use the worker's migration decision");
assert.equal(contentScript.stored[contentScript.api.KEY], undefined, "website scripts must not overwrite language migration");

const pageSource = readSource("app/core/i18n-page.js");
assert.doesNotMatch(pageSource, /MutationObserver|location\.reload|innerHTML\s*=/);
assert.match(pageSource, /script, style, textarea, \[contenteditable\]/);
assert.match(readSource("app/core/pagedock-db.js"), /ShizuoI18n\.ready\.then\(openDatabaseReady\)/, "database creation must wait until migration finishes");
const manifest = JSON.parse(readSource("manifest.json"));
assert.equal(manifest.name, "Shizuo");
assert.equal(manifest.content_scripts[0].js.at(-1), "app/content/content-codex.js");
for (const page of ["whiteboard/index", "popup/popup", "sidepanel/sidepanel", "editor/editor", "offscreen/offscreen"]) {
  const html = readSource(`app/pages/${page}.html`);
  assert.match(html, /core\/i18n-page\.js/);
  assert.match(html, /lang="en"/);
  const shell = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
  for (const match of shell.matchAll(/>([^<>]+)</g)) {
    const text = match[1].trim();
    if (!/\p{Script=Han}/u.test(text) || ["简体中文", "Language / 语言"].includes(text)) continue;
    assert.ok(Object.hasOwn(fresh.context.ShizuoEnglish, text), `Missing static translation: ${text}`);
  }
}
function checkUiKeys(directory) {
  for (const file of readdirSync(new URL(`../${directory}`, import.meta.url), { withFileTypes: true })) {
    const relative = path.posix.join(directory, file.name);
    if (file.isDirectory()) checkUiKeys(relative);
    else if (file.name.endsWith(".js") && !file.name.startsWith("i18n")) {
      for (const match of readSource(relative).matchAll(/\bui\(("(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g)) {
        const key = vm.runInNewContext(match[1]);
        assert.ok(Object.hasOwn(fresh.context.ShizuoEnglish, key), `Missing UI translation in ${relative}: ${key}`);
      }
    }
  }
}
checkUiKeys("app");
const prompts = createTaskPrompts({ codingWorkspace: "/tmp" });
for (const name of ["buildAnalysisPrompt", "buildConversationPrompt", "buildCodingPrompt"]) {
  const prompt = prompts[name]({ prompt: "Compare these sources", page: { content: "这是中文资料" } });
  assert.match(prompt, /language of the user's latest question/);
  assert.doesNotMatch(prompt, /请使用中文/);
  assert.match(prompt, /Compare these sources/);
}
console.log("English/Chinese language, migration, interpolation and prompt checks passed");
