export type LocalTask = {
  id: string;
  text: string;
  col: number;
  row: number;
  parentId?: string;
};

export type BoardSize = {
  width: number;
  height: number;
};

export const CANVAS_GRID_SIZE_PX = 34;
export const INITIAL_CANVAS_COLS = 16;
export const INITIAL_CANVAS_ROWS = 12;
export const TASK_WIDTH_PX = 204;
export const TASK_HEIGHT_PX = 170;
const CHILD_TASK_PARENT_GAP_PX = 38;
const CHILD_TASK_Y_GAP_ROWS = 2;

export function createBlankTask(index: number): LocalTask {
  return {
    id: `task-${index}`,
    text: "",
    col: Math.floor(INITIAL_CANVAS_COLS / 2),
    row: Math.floor(INITIAL_CANVAS_ROWS / 2),
  };
}

function clampGrid(value: number) {
  return Math.max(0, Math.round(value));
}

export function childColAfterParentEdge(
  parent: LocalTask,
  parentWidthPixels: number,
): number {
  const parentWidth = parentWidthPixels > 0 ? parentWidthPixels : TASK_WIDTH_PX;
  return clampGrid(parent.col + Math.round((parentWidth + CHILD_TASK_PARENT_GAP_PX) / CANVAS_GRID_SIZE_PX));
}

export function moveTask(task: LocalTask, col: number, row: number): LocalTask {
  return {
    ...task,
    col: clampGrid(col),
    row: clampGrid(row),
  };
}

export function attachTaskToParent(
  task: LocalTask,
  parent: LocalTask,
): LocalTask {
  if (task.id === parent.id) return task;

  return {
    ...task,
    parentId: parent.id,
    col: childColAfterParentEdge(parent, TASK_WIDTH_PX),
    row: clampGrid(parent.row),
  };
}

export function detachTaskFromParent(task: LocalTask): LocalTask {
  const detachedTask = { ...task };
  delete detachedTask.parentId;
  return detachedTask;
}

export function layoutChildTasks(
  tasks: LocalTask[],
  parentId: string,
): LocalTask[] {
  const parent = tasks.find((task) => task.id === parentId);
  if (!parent) return tasks;

  let childIndex = 0;
  const childCol = childColAfterParentEdge(parent, TASK_WIDTH_PX);

  return tasks.map((task) => {
    if (task.parentId !== parentId) return task;

    const laidOutTask = {
      ...task,
      col: childCol,
      row: clampGrid(parent.row + childIndex * CHILD_TASK_Y_GAP_ROWS),
    };
    childIndex += 1;
    return laidOutTask;
  });
}

export function layoutAllChildTasks(tasks: LocalTask[]): LocalTask[] {
  const parentIds = tasks
    .filter((task) => tasks.some((childTask) => childTask.parentId === task.id))
    .map((task) => task.id);

  return parentIds.reduce(
    (laidOutTasks, parentId) => layoutChildTasks(laidOutTasks, parentId),
    tasks,
  );
}

export function deleteTask(tasks: LocalTask[], taskId: string): LocalTask[] {
  const deletedTask = tasks.find((task) => task.id === taskId);
  if (!deletedTask) return tasks;

  const promotedTasks = tasks
    .filter((task) => task.id !== taskId)
    .map((task) => {
      if (task.parentId !== taskId) return task;

      return detachTaskFromParent(task);
    });

  return deletedTask.parentId
    ? layoutChildTasks(promotedTasks, deletedTask.parentId)
    : promotedTasks;
}
