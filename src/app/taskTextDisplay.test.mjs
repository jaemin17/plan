import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const componentSource = readFileSync(new URL("./LocalTasks.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./page.module.css", import.meta.url), "utf8");

function cssRule(selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssSource.match(new RegExp(`${escapedSelector}\\s*\\{(?<body>[^}]+)\\}`));
  return match?.groups?.body ?? "";
}

test("task editor supports long multi-line text without clipping the task label", () => {
  const taskTagRule = cssRule(".taskTag");
  const childTaskTagRule = cssRule(".childTaskTag");
  const taskInputRule = cssRule(".taskInput");

  assert.match(componentSource, /<textarea\s/);
  assert.doesNotMatch(componentSource, /<input\s/);
  assert.match(taskTagRule, /align-items:\s*center;/);
  assert.match(taskTagRule, /transform:\s*translate\(-50%, -50%\);/);
  assert.match(childTaskTagRule, /transform:\s*translateY\(-50%\);/);
  assert.match(taskTagRule, /max-height:\s*180px;/);
  assert.match(taskTagRule, /overflow:\s*visible;/);
  assert.match(taskInputRule, /max-height:\s*calc\(180px - 10px\);/);
  assert.match(taskInputRule, /overflow-y:\s*auto;/);
  assert.match(taskInputRule, /resize:\s*none;/);
  assert.match(taskInputRule, /overflow-wrap:\s*anywhere;/);
  assert.match(taskInputRule, /white-space:\s*pre-wrap;/);
  assert.match(taskInputRule, /line-height:\s*1\.35;/);
  assert.match(taskInputRule, /min-height:\s*calc\(14px \* 1\.35\);/);
  assert.match(taskInputRule, /padding:\s*0;/);
});

test("task hierarchy changes schedule measured child layout without waiting for resize", () => {
  const observerCallbackIndex = componentSource.indexOf("const resizeObserver = new ResizeObserver");
  const cleanupIndex = componentSource.indexOf("return () =>", observerCallbackIndex);

  assert.notEqual(observerCallbackIndex, -1);
  assert.notEqual(cleanupIndex, -1);
  assert.match(
    componentSource.slice(observerCallbackIndex, cleanupIndex),
    /scheduleMeasuredChildRelayout\(\);/,
  );
});
