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

test("dragging can start from task text after a small movement threshold", () => {
  assert.match(componentSource, /TASK_DRAG_START_DISTANCE_PX/);
  assert.match(componentSource, /hasStarted:\s*!startsOnText/);
  assert.match(componentSource, /dragDistance\s*<\s*TASK_DRAG_START_DISTANCE_PX/);
  assert.doesNotMatch(componentSource, /event\.target instanceof HTMLTextAreaElement\) return;/);
});

test("task labels render above the trash layer", () => {
  const taskTagRule = cssRule(".taskTag");
  const trashZoneRule = cssRule(".trashZone");

  assert.doesNotMatch(componentSource, /taskTagDragging/);
  assert.match(taskTagRule, /z-index:\s*40;/);
  assert.match(trashZoneRule, /z-index:\s*1;/);
});

test("trash deletion uses task rectangle contact instead of pointer position", () => {
  assert.match(componentSource, /function isTaskTouchingTrash/);
  assert.match(componentSource, /taskElement\.getBoundingClientRect\(\)/);
  assert.match(componentSource, /taskRect\.right >= trashRect\.left/);
  assert.match(componentSource, /taskRect\.left <= trashRect\.right/);
  assert.match(componentSource, /taskRect\.bottom >= trashRect\.top/);
  assert.match(componentSource, /taskRect\.top <= trashRect\.bottom/);
  assert.match(componentSource, /setIsOverTrash\(isTaskTouchingTrash\(dragState\.taskId\)\)/);
  assert.match(componentSource, /if \(isTaskTouchingTrash\(dragState\.taskId\)\)/);
});

test("first child task uses its parent height while later children keep natural height", () => {
  assert.match(componentSource, /function firstChildParentHeightPx/);
  assert.match(componentSource, /taskRefs\.current\.get\(task\.parentId\)/);
  assert.match(componentSource, /currentTasks\.find\(\(candidateTask\) => candidateTask\.parentId === task\.parentId\)/);
  assert.match(componentSource, /minHeight:\s*firstChildParentHeight \? `\$\{firstChildParentHeight\}px` : undefined/);
});

test("drop parent selection uses task rectangles and prefers deeper targets", () => {
  assert.match(componentSource, /function findDropParentTask/);
  assert.match(componentSource, /function taskDepth/);
  assert.match(componentSource, /draggedRect\.left - candidateRect\.right/);
  assert.match(componentSource, /verticalOverlap/);
  assert.match(componentSource, /b\.depth - a\.depth/);
  assert.match(componentSource, /findDropParentTask\(dragState\.taskId, currentTasks\)/);
  assert.doesNotMatch(componentSource, /draggedTask\.xPercent >= task\.xPercent \+ 6/);
});
