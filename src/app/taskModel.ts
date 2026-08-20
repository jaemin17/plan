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
