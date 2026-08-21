import assert from "node:assert/strict";
import { test } from "node:test";
import {
  attachTaskToParent,
  childColAfterParentEdge,
  createBlankTask,
  deleteTask,
  detachTaskFromParent,
  layoutChildTasks,
  moveTask,
} from "./taskModel.ts";

test("creates a blank task label near the center of the board", () => {
  const task = createBlankTask(2);

  assert.equal(task.id, "task-2");
  assert.equal(task.text, "");
  assert.equal(task.col, 8);
  assert.equal(task.row, 6);
});

test("moves a task label while only clamping it away from negative coordinates", () => {
  const task = createBlankTask(1);
  const moved = moveTask(task, 72, -5);

  assert.equal(moved.id, task.id);
  assert.equal(moved.col, 72);
  assert.equal(moved.row, 0);
});

test("moves a task label beyond the current visible canvas", () => {
  const task = createBlankTask(1);
  const moved = moveTask(task, 44, 30);

  assert.equal(moved.col, 44);
  assert.equal(moved.row, 30);
});

test("attaches a task to a parent and places it after the parent", () => {
  const parent = { ...createBlankTask(1), col: 12, row: 10 };
  const child = createBlankTask(2);

  const attached = attachTaskToParent(child, parent);

  assert.equal(attached.parentId, "task-1");
  assert.equal(attached.col, 19);
  assert.equal(attached.row, 10);
});

test("does not attach a task to itself", () => {
  const task = createBlankTask(1);

  const attached = attachTaskToParent(task, task);

  assert.equal(attached.parentId, undefined);
  assert.equal(attached.col, 8);
  assert.equal(attached.row, 6);
});

test("detaches a child task without moving it", () => {
  const child = {
    ...createBlankTask(2),
    parentId: "task-1",
    col: 20,
    row: 14,
  };

  const detached = detachTaskFromParent(child);

  assert.equal(detached.parentId, undefined);
  assert.equal(detached.col, 20);
  assert.equal(detached.row, 14);
});

test("lays out the first child level with the parent and stacks later children below it", () => {
  const parent = { ...createBlankTask(1), col: 12, row: 10 };
  const firstChild = { ...createBlankTask(2), parentId: parent.id };
  const secondChild = { ...createBlankTask(3), parentId: parent.id };

  const laidOut = layoutChildTasks([parent, firstChild, secondChild], parent.id);

  assert.deepEqual(
    laidOut.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      col: task.col,
      row: task.row,
    })),
    [
      { id: "task-1", parentId: undefined, col: 12, row: 10 },
      { id: "task-2", parentId: "task-1", col: 19, row: 10 },
      { id: "task-3", parentId: "task-1", col: 19, row: 12 },
    ],
  );
});

test("places a child task a fixed gap after the measured parent right edge", () => {
  const parent = { ...createBlankTask(1), col: 12, row: 10 };

  assert.equal(childColAfterParentEdge(parent, 200), 19);
  assert.equal(childColAfterParentEdge(parent, 320), 23);
});

test("places a grandchild after a left-anchored child task edge", () => {
  const childParent = { ...createBlankTask(2), parentId: "task-1", col: 12, row: 14 };

  assert.equal(childColAfterParentEdge(childParent, 200), 19);
});

test("deletes a child task and relayouts the remaining siblings", () => {
  const parent = { ...createBlankTask(1), col: 12, row: 10 };
  const firstChild = { ...createBlankTask(2), parentId: parent.id, col: 19, row: 12 };
  const secondChild = { ...createBlankTask(3), parentId: parent.id, col: 19, row: 14 };

  const remaining = deleteTask([parent, firstChild, secondChild], firstChild.id);

  assert.deepEqual(
    remaining.map((task) => ({
      id: task.id,
      parentId: task.parentId,
      col: task.col,
      row: task.row,
    })),
    [
      { id: "task-1", parentId: undefined, col: 12, row: 10 },
      { id: "task-3", parentId: "task-1", col: 19, row: 10 },
    ],
  );
});

test("deletes a parent task and promotes its children", () => {
  const parent = { ...createBlankTask(1), col: 12, row: 10 };
  const child = { ...createBlankTask(2), parentId: parent.id, col: 19, row: 14 };

  const remaining = deleteTask([parent, child], parent.id);

  assert.deepEqual(remaining, [{ id: "task-2", text: "", col: 19, row: 14 }]);
});
