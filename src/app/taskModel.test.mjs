import assert from "node:assert/strict";
import { test } from "node:test";
import { attachTaskToParent, createBlankTask, moveTask } from "./taskModel.ts";

test("creates a blank task label near the center of the board", () => {
  const task = createBlankTask(2);

  assert.equal(task.id, "task-2");
  assert.equal(task.text, "");
  assert.equal(task.xPercent, 50);
  assert.equal(task.yPercent, 50);
});

test("moves a task label while keeping it inside the board", () => {
  const task = createBlankTask(1);
  const moved = moveTask(task, 72, -5);

  assert.equal(moved.id, task.id);
  assert.equal(moved.xPercent, 72);
  assert.equal(moved.yPercent, 4);
});

test("attaches a task to a parent and places it after the parent", () => {
  const parent = { ...createBlankTask(1), xPercent: 40, yPercent: 42 };
  const child = createBlankTask(2);

  const attached = attachTaskToParent(child, parent);

  assert.equal(attached.parentId, "task-1");
  assert.equal(attached.xPercent, 54);
  assert.equal(attached.yPercent, 48);
});

test("does not attach a task to itself", () => {
  const task = createBlankTask(1);

  const attached = attachTaskToParent(task, task);

  assert.equal(attached.parentId, undefined);
  assert.equal(attached.xPercent, 50);
  assert.equal(attached.yPercent, 50);
});
