export type LocalTask = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  parentId?: string;
};

export type BoardSize = {
  width: number;
  height: number;
};

const CHILD_TASK_X_OFFSET_PERCENT = 14;
const CHILD_TASK_Y_GAP_PERCENT = 8;
const CHILD_TASK_X_OFFSET_MIN_PX = 96;
const CHILD_TASK_X_OFFSET_MAX_PX = 132;
const CHILD_TASK_Y_GAP_MIN_PX = 64;
const CHILD_TASK_Y_GAP_MAX_PX = 68;
const CHILD_TASK_PARENT_GAP_PX = 38;

export function createBlankTask(index: number): LocalTask {
  return {
    id: `task-${index}`,
    text: "",
    xPercent: 50,
    yPercent: 50,
  };
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 4), 96);
}

function clampPixelOffset(preferredPixels: number, minPixels: number, maxPixels: number) {
  return Math.min(Math.max(preferredPixels, minPixels), maxPixels);
}

function percentOffset(
  preferredPercent: number,
  axisPixels: number | undefined,
  minPixels: number,
  maxPixels: number,
) {
  if (!axisPixels || axisPixels <= 0) return preferredPercent;

  return (
    (clampPixelOffset((axisPixels * preferredPercent) / 100, minPixels, maxPixels) / axisPixels) *
    100
  );
}

function childXOffsetPercent(boardSize?: BoardSize) {
  return percentOffset(
    CHILD_TASK_X_OFFSET_PERCENT,
    boardSize?.width,
    CHILD_TASK_X_OFFSET_MIN_PX,
    CHILD_TASK_X_OFFSET_MAX_PX,
  );
}

function childYGapPercent(boardSize?: BoardSize) {
  return percentOffset(
    CHILD_TASK_Y_GAP_PERCENT,
    boardSize?.height,
    CHILD_TASK_Y_GAP_MIN_PX,
    CHILD_TASK_Y_GAP_MAX_PX,
  );
}

export function childXPercentAfterParentEdge(
  parent: LocalTask,
  parentWidthPixels: number,
  boardSize: BoardSize,
): number {
  if (boardSize.width <= 0 || parentWidthPixels <= 0) {
    return clampPercent(parent.xPercent + childXOffsetPercent(boardSize));
  }

  const parentAnchorPixels = (parent.xPercent / 100) * boardSize.width;
  const parentRightPixels = parent.parentId
    ? parentAnchorPixels + parentWidthPixels
    : parentAnchorPixels + parentWidthPixels / 2;
  const childLeftPixels = parentRightPixels + CHILD_TASK_PARENT_GAP_PX;
  return clampPercent((childLeftPixels / boardSize.width) * 100);
}

export function moveTask(task: LocalTask, xPercent: number, yPercent: number): LocalTask {
  return {
    ...task,
    xPercent: clampPercent(xPercent),
    yPercent: clampPercent(yPercent),
  };
}

export function attachTaskToParent(
  task: LocalTask,
  parent: LocalTask,
  boardSize?: BoardSize,
): LocalTask {
  if (task.id === parent.id) return task;

  return {
    ...task,
    parentId: parent.id,
    xPercent: clampPercent(parent.xPercent + childXOffsetPercent(boardSize)),
    yPercent: clampPercent(parent.yPercent),
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
  boardSize?: BoardSize,
): LocalTask[] {
  const parent = tasks.find((task) => task.id === parentId);
  if (!parent) return tasks;

  let childIndex = 0;
  const xOffsetPercent = childXOffsetPercent(boardSize);
  const yGapPercent = childYGapPercent(boardSize);

  return tasks.map((task) => {
    if (task.parentId !== parentId) return task;

    const laidOutTask = {
      ...task,
      xPercent: clampPercent(parent.xPercent + xOffsetPercent),
      yPercent: clampPercent(parent.yPercent + childIndex * yGapPercent),
    };
    childIndex += 1;
    return laidOutTask;
  });
}

export function layoutAllChildTasks(tasks: LocalTask[], boardSize?: BoardSize): LocalTask[] {
  const parentIds = tasks
    .filter((task) => tasks.some((childTask) => childTask.parentId === task.id))
    .map((task) => task.id);

  return parentIds.reduce(
    (laidOutTasks, parentId) => layoutChildTasks(laidOutTasks, parentId, boardSize),
    tasks,
  );
}

export function deleteTask(tasks: LocalTask[], taskId: string, boardSize?: BoardSize): LocalTask[] {
  const deletedTask = tasks.find((task) => task.id === taskId);
  if (!deletedTask) return tasks;

  const promotedTasks = tasks
    .filter((task) => task.id !== taskId)
    .map((task) => {
      if (task.parentId !== taskId) return task;

      return detachTaskFromParent(task);
    });

  return deletedTask.parentId
    ? layoutChildTasks(promotedTasks, deletedTask.parentId, boardSize)
    : promotedTasks;
}
