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
        xPercent: 40,
        yPercent: 42,
      },
      {
        id: "task-2",
        text: "拆子任务",
        xPercent: 54,
        yPercent: 48,
        parentId: "task-1",
      },
    ]),
  );

  assert.deepEqual(readStoredTasks(), [
    { id: "task-1", text: "写计划", xPercent: 40, yPercent: 42 },
    { id: "task-2", text: "拆子任务", xPercent: 54, yPercent: 42, parentId: "task-1" },
  ]);
});

test("ignores invalid stored task data", () => {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      { id: "task-1", text: "有效", xPercent: 50, yPercent: 50 },
      { id: "task-2", text: 123, xPercent: 50, yPercent: 50 },
      { id: "task-3", text: "无效坐标", xPercent: Number.NaN, yPercent: 50 },
    ]),
  );

  assert.deepEqual(readStoredTasks(), [
    { id: "task-1", text: "有效", xPercent: 50, yPercent: 50 },
  ]);
});

test("writes only persisted task fields", () => {
  writeStoredTasks([
    { id: "task-1", text: "主任务", xPercent: 40, yPercent: 42 },
    { id: "task-2", text: "子任务", xPercent: 54, yPercent: 48, parentId: "task-1" },
  ]);

  assert.equal(
    window.localStorage.getItem(STORAGE_KEY),
    JSON.stringify([
      { id: "task-1", text: "主任务", xPercent: 40, yPercent: 42 },
      { id: "task-2", text: "子任务", xPercent: 54, yPercent: 48, parentId: "task-1" },
    ]),
  );
});
