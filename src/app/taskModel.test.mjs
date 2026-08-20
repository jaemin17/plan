import assert from "node:assert/strict";
import { test } from "node:test";
import { createBlankTask } from "./taskModel.ts";

test("creates a blank task label near the center of the board", () => {
  const task = createBlankTask(2);

  assert.equal(task.id, "task-2");
  assert.equal(task.text, "");
  assert.equal(task.xPercent, 50);
  assert.equal(task.yPercent, 50);
});
