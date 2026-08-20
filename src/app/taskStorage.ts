import type { LocalTask } from "./taskModel";

export const STORAGE_KEY = "plan.local-tasks";

type StoredTask = {
  id?: unknown;
  text?: unknown;
  xPercent?: unknown;
  yPercent?: unknown;
  parentId?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseStoredTask(task: StoredTask): LocalTask | null {
  if (
    typeof task.id !== "string" ||
    typeof task.text !== "string" ||
    !isFiniteNumber(task.xPercent) ||
    !isFiniteNumber(task.yPercent)
  ) {
    return null;
  }

  return {
    id: task.id,
    text: task.text,
    xPercent: task.xPercent,
    yPercent: task.yPercent,
    ...(typeof task.parentId === "string" ? { parentId: task.parentId } : {}),
  };
}

export function readStoredTasks(): LocalTask[] {
  if (typeof window === "undefined") return [];

  try {
    const rawTasks = window.localStorage.getItem(STORAGE_KEY);
    if (!rawTasks) return [];

    const parsedTasks = JSON.parse(rawTasks);
    if (!Array.isArray(parsedTasks)) return [];

    const tasks: LocalTask[] = [];

    for (const item of parsedTasks) {
      if (typeof item !== "object" || item === null) continue;

      const task = parseStoredTask(item as StoredTask);
      if (task) tasks.push(task);
    }

    return tasks;
  } catch {
    return [];
  }
}

export function writeStoredTasks(tasks: LocalTask[]): void {
  const persisted = tasks.map(({ id, text, xPercent, yPercent, parentId }) => ({
    id,
    text,
    xPercent,
    yPercent,
    ...(parentId ? { parentId } : {}),
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}
