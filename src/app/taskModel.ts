export type LocalTask = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
  parentId?: string;
};

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

export function moveTask(task: LocalTask, xPercent: number, yPercent: number): LocalTask {
  return {
    ...task,
    xPercent: clampPercent(xPercent),
    yPercent: clampPercent(yPercent),
  };
}

export function attachTaskToParent(task: LocalTask, parent: LocalTask): LocalTask {
  if (task.id === parent.id) return task;

  return {
    ...task,
    parentId: parent.id,
    xPercent: clampPercent(parent.xPercent + 14),
    yPercent: clampPercent(parent.yPercent + 6),
  };
}

export function layoutChildTasks(tasks: LocalTask[], parentId: string): LocalTask[] {
  const parent = tasks.find((task) => task.id === parentId);
  if (!parent) return tasks;

  let childIndex = 0;

  return tasks.map((task) => {
    if (task.parentId !== parentId) return task;

    const laidOutTask = {
      ...task,
      xPercent: clampPercent(parent.xPercent + 14),
      yPercent: clampPercent(parent.yPercent + 6 + childIndex * 7),
    };
    childIndex += 1;
    return laidOutTask;
  });
}
