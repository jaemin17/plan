import { CANVAS_GRID_SIZE_PX, layoutAllChildTasks, type BoardSize, type LocalTask } from "./taskModel.ts";

export const STORAGE_KEY = "plan.local-tasks";

type StoredTask = {
  id?: unknown;
  text?: unknown;
  col?: unknown;
  row?: unknown;
  xPercent?: unknown;
  yPercent?: unknown;
  parentId?: unknown;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clampStoredGrid(value: number) {
  return Math.max(0, Math.round(value));
}

function gridFromLegacyPercent(percent: number, axisPixels: number | undefined) {
  if (!axisPixels || axisPixels <= 0) return clampStoredGrid(percent);

  return clampStoredGrid(((percent / 100) * axisPixels) / CANVAS_GRID_SIZE_PX);
}

function parseStoredTask(task: StoredTask, boardSize?: BoardSize): LocalTask | null {
  if (typeof task.id !== "string" || typeof task.text !== "string") {
    return null;
  }

  let col: number;
  let row: number;
  if (isFiniteNumber(task.col) && isFiniteNumber(task.row)) {
    col = clampStoredGrid(task.col);
    row = clampStoredGrid(task.row);
  } else if (isFiniteNumber(task.xPercent) && isFiniteNumber(task.yPercent)) {
    col = gridFromLegacyPercent(task.xPercent, boardSize?.width);
    row = gridFromLegacyPercent(task.yPercent, boardSize?.height);
  } else {
    return null;
  }

  return {
    id: task.id,
    text: task.text,
    col,
    row,
    ...(typeof task.parentId === "string" ? { parentId: task.parentId } : {}),
  };
}

export function readStoredTasks(boardSize?: BoardSize): LocalTask[] {
  if (typeof window === "undefined") return [];

  try {
    const rawTasks = window.localStorage.getItem(STORAGE_KEY);
    if (!rawTasks) return [];

    const parsedTasks = JSON.parse(rawTasks);
    if (!Array.isArray(parsedTasks)) return [];

    const tasks: LocalTask[] = [];

    for (const item of parsedTasks) {
      if (typeof item !== "object" || item === null) continue;

      const task = parseStoredTask(item as StoredTask, boardSize);
      if (task) tasks.push(task);
    }

    return layoutAllChildTasks(tasks);
  } catch {
    return [];
  }
}

export function writeStoredTasks(tasks: LocalTask[]): void {
  const persisted = tasks.map(({ id, text, col, row, parentId }) => ({
    id,
    text,
    col,
    row,
    ...(parentId ? { parentId } : {}),
  }));

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}
