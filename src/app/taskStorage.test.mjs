import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { readStoredTasks, STORAGE_KEY, writeStoredTasks } from "./taskStorage.ts";

function installLocalStorage() {
  const store = new Map();

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
      removeItem(key) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  };
}

beforeEach(() => {
  installLocalStorage();
});

test("reads valid stored tasks from localStorage and normalizes child layout", () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      {
        id: "task-1",
        text: "写计划",
        col: 12,
        row: 10,
      },
      {
        id: "task-2",
        text: "拆子任务",
        col: 19,
        row: 12,
        parentId: "task-1",
      },
    ]),
  );

  assert.deepEqual(readStoredTasks(), [
    { id: "task-1", text: "写计划", col: 12, row: 10 },
    { id: "task-2", text: "拆子任务", col: 19, row: 10, parentId: "task-1" },
  ]);
});

test("ignores invalid stored task data", () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { id: "task-1", text: "有效", col: 8, row: 6 },
      { id: "task-2", text: 123, col: 8, row: 6 },
      { id: "task-3", text: "无效坐标", col: Number.NaN, row: 6 },
    ]),
  );

  assert.deepEqual(readStoredTasks(), [
    { id: "task-1", text: "有效", col: 8, row: 6 },
  ]);
});

test("writes only persisted task fields", () => {
  writeStoredTasks([
    { id: "task-1", text: "主任务", col: 12, row: 10 },
    { id: "task-2", text: "子任务", col: 19, row: 12, parentId: "task-1" },
  ]);

  assert.equal(
    window.localStorage.getItem(STORAGE_KEY),
    JSON.stringify([
      { id: "task-1", text: "主任务", col: 12, row: 10 },
      { id: "task-2", text: "子任务", col: 19, row: 12, parentId: "task-1" },
    ]),
  );
});

test("migrates legacy percent coordinates into grid coordinates", () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { id: "task-1", text: "旧任务", xPercent: 50, yPercent: 50 },
      { id: "task-2", text: "旧子任务", xPercent: 72, yPercent: 60, parentId: "task-1" },
    ]),
  );

  assert.deepEqual(readStoredTasks({ width: 680, height: 544 }), [
    { id: "task-1", text: "旧任务", col: 10, row: 8 },
    { id: "task-2", text: "旧子任务", col: 17, row: 8, parentId: "task-1" },
  ]);
});
