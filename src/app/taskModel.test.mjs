import assert from "node:assert/strict";
import { test } from "node:test";
import { createBlankTask, moveTask } from "./taskModel.ts";

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
