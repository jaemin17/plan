export type LocalTask = {
  id: string;
  text: string;
  xPercent: number;
  yPercent: number;
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
