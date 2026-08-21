"use client";

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  CANVAS_GRID_SIZE_PX,
  INITIAL_CANVAS_COLS,
  INITIAL_CANVAS_ROWS,
  TASK_HEIGHT_PX,
  TASK_WIDTH_PX,
  attachTaskToParent,
  childColAfterParentEdge,
  createBlankTask,
  detachTaskFromParent,
  deleteTask,
  layoutAllChildTasks,
  layoutChildTasks,
  moveTask,
  type LocalTask,
} from "./taskModel";
import { readStoredTasks, writeStoredTasks } from "./taskStorage";

type DragState = {
  taskId: string;
  offsetCol: number;
  offsetRow: number;
  lastCol: number;
  lastRow: number;
  startClientX: number;
  startClientY: number;
  hasStarted: boolean;
};

type ViewportSize = {
  width: number;
  height: number;
};

const TASK_DRAG_START_DISTANCE_PX = 5;
const TASK_DROP_PARENT_MIN_GAP_PX = -24;
const TASK_DROP_PARENT_MAX_GAP_PX = 220;
const TASK_DROP_PARENT_PREFERRED_GAP_PX = 38;
const TASK_DROP_PARENT_VERTICAL_SLOP_PX = 36;
const CANVAS_EXTRA_COLS = 10;
const CANVAS_EXTRA_ROWS = 8;
const PAGE_HORIZONTAL_PADDING_PX = 48;
const PAGE_VERTICAL_PADDING_PX = 96;

function canvasSize(tasks: LocalTask[], viewportSize: ViewportSize) {
  const visibleCols = Math.ceil(
    Math.max(0, viewportSize.width - PAGE_HORIZONTAL_PADDING_PX) / CANVAS_GRID_SIZE_PX,
  );
  const visibleRows = Math.ceil(
    Math.max(0, viewportSize.height - PAGE_VERTICAL_PADDING_PX) / CANVAS_GRID_SIZE_PX,
  );
  const taskCols = Math.ceil(TASK_WIDTH_PX / CANVAS_GRID_SIZE_PX);
  const taskRows = Math.ceil(TASK_HEIGHT_PX / CANVAS_GRID_SIZE_PX);
  const contentCols = tasks.reduce(
    (cols, task) => Math.max(cols, task.col + taskCols + CANVAS_EXTRA_COLS),
    INITIAL_CANVAS_COLS,
  );
  const contentRows = tasks.reduce(
    (rows, task) => Math.max(rows, task.row + taskRows + CANVAS_EXTRA_ROWS),
    INITIAL_CANVAS_ROWS,
  );
  const cols = Math.max(INITIAL_CANVAS_COLS, visibleCols, contentCols);
  const rows = Math.max(INITIAL_CANVAS_ROWS, visibleRows, contentRows);

  return {
    cols,
    rows,
    width: cols * CANVAS_GRID_SIZE_PX,
    height: rows * CANVAS_GRID_SIZE_PX,
  };
}

function areTaskLayoutsEqual(firstTasks: LocalTask[], secondTasks: LocalTask[]) {
  if (firstTasks.length !== secondTasks.length) return false;

  return firstTasks.every((firstTask, index) => {
    const secondTask = secondTasks[index];
    return (
      secondTask &&
      firstTask.id === secondTask.id &&
      firstTask.text === secondTask.text &&
      firstTask.parentId === secondTask.parentId &&
      firstTask.col === secondTask.col &&
      firstTask.row === secondTask.row
    );
  });
}

function areNumberRecordsEqual(first: Record<string, number>, second: Record<string, number>) {
  const firstKeys = Object.keys(first);
  const secondKeys = Object.keys(second);
  if (firstKeys.length !== secondKeys.length) return false;

  return firstKeys.every((key) => first[key] === second[key]);
}

function layoutMeasuredChildTasks(
  currentTasks: LocalTask[],
  taskElements: Map<string, HTMLDivElement>,
) {
  const verticallyLaidOutTasks = layoutAllChildTasks(currentTasks);
  const measuredTasksById = new Map<string, LocalTask>();
  const taskWidthsById = new Map<string, number>();

  verticallyLaidOutTasks.forEach((task) => {
    const taskElement = taskElements.get(task.id);
    if (taskElement) {
      taskWidthsById.set(task.id, taskElement.getBoundingClientRect().width);
    }
  });

  function measuredTask(task: LocalTask): LocalTask {
    const existingTask = measuredTasksById.get(task.id);
    if (existingTask) return existingTask;

    if (!task.parentId) {
      measuredTasksById.set(task.id, task);
      return task;
    }

    const parent = verticallyLaidOutTasks.find(
      (candidateTask) => candidateTask.id === task.parentId,
    );
    const parentWidthPixels = parent ? taskWidthsById.get(parent.id) : undefined;
    if (!parent || !parentWidthPixels) {
      measuredTasksById.set(task.id, task);
      return task;
    }

    const nextTask = {
      ...task,
      col: childColAfterParentEdge(measuredTask(parent), parentWidthPixels),
    };
    measuredTasksById.set(task.id, nextTask);
    return nextTask;
  }

  return verticallyLaidOutTasks.map(measuredTask);
}

function measuredFirstChildHeights(
  currentTasks: LocalTask[],
  taskElements: Map<string, HTMLDivElement>,
) {
  const heights: Record<string, number> = {};

  currentTasks.forEach((task) => {
    if (!task.parentId) return;

    const firstChild = currentTasks.find(
      (candidateTask) => candidateTask.parentId === task.parentId,
    );
    if (firstChild?.id !== task.id) return;

    const parentHeight = taskElements.get(task.parentId)?.getBoundingClientRect().height;
    if (parentHeight) heights[task.id] = parentHeight;
  });

  return heights;
}

export function LocalTasks() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [nextTaskIndex, setNextTaskIndex] = useState(1);
  const [hasLoadedStoredTasks, setHasLoadedStoredTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [firstChildHeights, setFirstChildHeights] = useState<Record<string, number>>({});
  const toolbarCloseTimeoutRef = useRef<number | null>(null);
  const editingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const taskLayerRef = useRef<HTMLDivElement | null>(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const trashRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const measuredRelayoutFrameRef = useRef<number | null>(null);
  const canvasMetrics = useMemo(() => canvasSize(tasks, viewportSize), [tasks, viewportSize]);

  useEffect(() => {
    function measureViewport() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }

    measureViewport();
    window.addEventListener("resize", measureViewport);
    return () => window.removeEventListener("resize", measureViewport);
  }, []);

  useEffect(() => {
    if (hasLoadedStoredTasks || viewportSize.width === 0 || viewportSize.height === 0) return;

    queueMicrotask(() => {
      const storedTasks = readStoredTasks({
        width: canvasMetrics.width,
        height: canvasMetrics.height,
      });
      setTasks(storedTasks);
      setNextTaskIndex(storedTasks.length + 1);
      setHasLoadedStoredTasks(true);
    });
  }, [
    canvasMetrics.height,
    canvasMetrics.width,
    hasLoadedStoredTasks,
    viewportSize.height,
    viewportSize.width,
  ]);

  useEffect(() => {
    if (!hasLoadedStoredTasks) return;

    writeStoredTasks(tasks);
  }, [hasLoadedStoredTasks, tasks]);

  useEffect(() => {
    if (!hasLoadedStoredTasks || draggingTaskId) return;

    function relayoutStoredChildren() {
      setTasks((currentTasks) => layoutAllChildTasks(currentTasks));
    }

    window.addEventListener("resize", relayoutStoredChildren);
    return () => window.removeEventListener("resize", relayoutStoredChildren);
  }, [draggingTaskId, hasLoadedStoredTasks]);

  useEffect(() => {
    if (!hasLoadedStoredTasks || draggingTaskId) return;

    function scheduleMeasuredChildRelayout() {
      if (measuredRelayoutFrameRef.current !== null) return;

      measuredRelayoutFrameRef.current = window.requestAnimationFrame(() => {
        measuredRelayoutFrameRef.current = null;
        const taskElements = taskRefs.current;

        setTasks((currentTasks) => {
          const nextTasks = layoutMeasuredChildTasks(currentTasks, taskElements);
          return areTaskLayoutsEqual(currentTasks, nextTasks) ? currentTasks : nextTasks;
        });
        setFirstChildHeights((currentHeights) => {
          const nextHeights = measuredFirstChildHeights(tasks, taskElements);
          return areNumberRecordsEqual(currentHeights, nextHeights) ? currentHeights : nextHeights;
        });
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      scheduleMeasuredChildRelayout();
    });

    const layer = taskLayerRef.current;
    if (layer) {
      resizeObserver.observe(layer);
    }

    taskRefs.current.forEach((taskElement) => {
      resizeObserver.observe(taskElement);
    });

    scheduleMeasuredChildRelayout();

    return () => {
      resizeObserver.disconnect();
      if (measuredRelayoutFrameRef.current !== null) {
        window.cancelAnimationFrame(measuredRelayoutFrameRef.current);
        measuredRelayoutFrameRef.current = null;
      }
    };
  }, [canvasMetrics.height, canvasMetrics.width, draggingTaskId, hasLoadedStoredTasks, tasks]);

  useEffect(() => {
    if (!editingTaskId) return;

    queueMicrotask(() => {
      editingInputRef.current?.focus();
    });
  }, [editingTaskId]);

  function openToolbarMenu() {
    if (toolbarCloseTimeoutRef.current !== null) {
      window.clearTimeout(toolbarCloseTimeoutRef.current);
      toolbarCloseTimeoutRef.current = null;
    }
    setIsToolbarMenuOpen(true);
  }

  function scheduleCloseToolbarMenu() {
    if (toolbarCloseTimeoutRef.current !== null) {
      window.clearTimeout(toolbarCloseTimeoutRef.current);
    }
    toolbarCloseTimeoutRef.current = window.setTimeout(() => {
      setIsToolbarMenuOpen(false);
      toolbarCloseTimeoutRef.current = null;
    }, 120);
  }

  function createTask() {
    const task = createBlankTask(nextTaskIndex);

    setTasks((currentTasks) => [...currentTasks, task]);
    setNextTaskIndex((currentIndex) => currentIndex + 1);
    setEditingTaskId(task.id);
  }

  function updateTaskText(taskId: string, event: ChangeEvent<HTMLTextAreaElement>) {
    const text = event.target.value;
    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? { ...task, text } : task)),
    );
  }

  function organizeTasks() {
    setTasks((currentTasks) =>
      currentTasks.map((task, index) => ({
        ...task,
        parentId: undefined,
        col: Math.floor(INITIAL_CANVAS_COLS / 2),
        row: Math.floor(INITIAL_CANVAS_ROWS / 2) + index * 2,
      })),
    );
    setIsToolbarMenuOpen(false);
  }

  function clearTasks() {
    setTasks([]);
    setEditingTaskId(null);
    setIsToolbarMenuOpen(false);
  }

  function setTaskRef(taskId: string, element: HTMLDivElement | null) {
    if (element) {
      taskRefs.current.set(taskId, element);
      return;
    }

    taskRefs.current.delete(taskId);
  }

  function isTaskDescendantOf(task: LocalTask, ancestorId: string, currentTasks: LocalTask[]) {
    let parentId = task.parentId;

    while (parentId) {
      if (parentId === ancestorId) return true;

      const parentTask = currentTasks.find((candidateTask) => candidateTask.id === parentId);
      parentId = parentTask?.parentId;
    }

    return false;
  }

  function taskDepth(task: LocalTask, currentTasks: LocalTask[]) {
    let depth = 0;
    let parentId = task.parentId;

    while (parentId) {
      depth += 1;
      const parentTask = currentTasks.find((candidateTask) => candidateTask.id === parentId);
      parentId = parentTask?.parentId;
    }

    return depth;
  }

  function findDropParentTask(draggedTaskId: string, currentTasks: LocalTask[]) {
    const draggedTask = currentTasks.find((task) => task.id === draggedTaskId);
    const draggedElement = taskRefs.current.get(draggedTaskId);
    if (!draggedTask || !draggedElement) return undefined;

    const draggedRect = draggedElement.getBoundingClientRect();
    const draggedCenterY = draggedRect.top + draggedRect.height / 2;

    return currentTasks
      .flatMap((candidateTask) => {
        if (
          candidateTask.id === draggedTask.id ||
          isTaskDescendantOf(candidateTask, draggedTask.id, currentTasks)
        ) {
          return [];
        }

        const candidateElement = taskRefs.current.get(candidateTask.id);
        if (!candidateElement) return [];

        const candidateRect = candidateElement.getBoundingClientRect();
        const horizontalGap = draggedRect.left - candidateRect.right;
        if (
          horizontalGap < TASK_DROP_PARENT_MIN_GAP_PX ||
          horizontalGap > TASK_DROP_PARENT_MAX_GAP_PX
        ) {
          return [];
        }

        const verticalOverlap =
          Math.min(draggedRect.bottom, candidateRect.bottom) -
          Math.max(draggedRect.top, candidateRect.top);
        const candidateCenterY = candidateRect.top + candidateRect.height / 2;
        const verticalDistance = Math.abs(draggedCenterY - candidateCenterY);
        const maxVerticalDistance =
          Math.max(draggedRect.height, candidateRect.height) / 2 + TASK_DROP_PARENT_VERTICAL_SLOP_PX;
        if (verticalOverlap <= 0 && verticalDistance > maxVerticalDistance) {
          return [];
        }

        return [
          {
            depth: taskDepth(candidateTask, currentTasks),
            horizontalDistance: Math.abs(horizontalGap - TASK_DROP_PARENT_PREFERRED_GAP_PX),
            right: candidateRect.right,
            task: candidateTask,
            verticalDistance,
          },
        ];
      })
      .sort(
        (a, b) =>
          b.depth - a.depth ||
          a.verticalDistance - b.verticalDistance ||
          a.horizontalDistance - b.horizontalDistance ||
          b.right - a.right,
      )[0]?.task;
  }

  function pointerGrid(event: PointerEvent<HTMLElement>) {
    const layer = taskLayerRef.current;
    if (!layer) return null;

    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      col: (event.clientX - rect.left) / CANVAS_GRID_SIZE_PX,
      row: (event.clientY - rect.top) / CANVAS_GRID_SIZE_PX,
    };
  }

  function isTaskTouchingTrash(taskId: string) {
    const taskElement = taskRefs.current.get(taskId);
    const trash = trashRef.current;
    if (!taskElement || !trash) return false;

    const taskRect = taskElement.getBoundingClientRect();
    const trashRect = trash.getBoundingClientRect();
    return (
      taskRect.right >= trashRect.left &&
      taskRect.left <= trashRect.right &&
      taskRect.bottom >= trashRect.top &&
      taskRect.top <= trashRect.bottom
    );
  }

  function startDraggingTask(task: LocalTask, event: PointerEvent<HTMLDivElement>) {
    const point = pointerGrid(event);
    if (!point) return;

    const startsOnText = event.target instanceof HTMLTextAreaElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      taskId: task.id,
      offsetCol: point.col - task.col,
      offsetRow: point.row - task.row,
      lastCol: task.col,
      lastRow: task.row,
      startClientX: event.clientX,
      startClientY: event.clientY,
      hasStarted: !startsOnText,
    };

    if (!startsOnText) {
      setEditingTaskId(null);
      setDraggingTaskId(task.id);
      setIsOverTrash(isTaskTouchingTrash(task.id));
    }
  }

  function dragTask(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const point = pointerGrid(event);
    if (!point) return;

    if (!dragState.hasStarted) {
      const dragDistance = Math.hypot(
        event.clientX - dragState.startClientX,
        event.clientY - dragState.startClientY,
      );
      if (dragDistance < TASK_DRAG_START_DISTANCE_PX) return;

      dragState.hasStarted = true;
      setEditingTaskId(null);
      setDraggingTaskId(dragState.taskId);
    }

    const nextCol = point.col - dragState.offsetCol;
    const nextRow = point.row - dragState.offsetRow;
    const deltaCol = nextCol - dragState.lastCol;
    const deltaRow = nextRow - dragState.lastRow;

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id === dragState.taskId) {
          return moveTask(task, nextCol, nextRow);
        }

        if (isTaskDescendantOf(task, dragState.taskId, currentTasks)) {
          return moveTask(task, task.col + deltaCol, task.row + deltaRow);
        }

        return task;
      }),
    );

    dragState.lastCol = nextCol;
    dragState.lastRow = nextRow;
    setIsOverTrash(isTaskTouchingTrash(dragState.taskId));
  }

  function stopDraggingTask(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    if (!dragState.hasStarted) {
      dragStateRef.current = null;
      setDraggingTaskId(null);
      setIsOverTrash(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    if (isTaskTouchingTrash(dragState.taskId)) {
      setTasks((currentTasks) => deleteTask(currentTasks, dragState.taskId));
      dragStateRef.current = null;
      setDraggingTaskId(null);
      setIsOverTrash(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }

    setTasks((currentTasks) => {
      const draggedTask = currentTasks.find((task) => task.id === dragState.taskId);
      if (!draggedTask) return currentTasks;

      const parent = findDropParentTask(dragState.taskId, currentTasks);

      if (!parent) {
        if (!draggedTask.parentId) return currentTasks;

        const detachedTasks = currentTasks.map((task) =>
          task.id === draggedTask.id ? detachTaskFromParent(task) : task,
        );

        return layoutChildTasks(detachedTasks, draggedTask.parentId);
      }

      const attachedTasks = currentTasks.map((task) =>
        task.id === draggedTask.id ? attachTaskToParent(task, parent) : task,
      );

      return layoutChildTasks(attachedTasks, parent.id);
    });

    dragStateRef.current = null;
    setDraggingTaskId(null);
    setIsOverTrash(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <>
      <div
        ref={taskLayerRef}
        className={styles.taskLayer}
        style={{ width: `${canvasMetrics.width}px`, height: `${canvasMetrics.height}px` }}
        aria-label="任务标签"
      >
        {tasks.map((task) => {
          const firstChildParentHeight = firstChildHeights[task.id];

          return (
            <div
              ref={(element) => setTaskRef(task.id, element)}
              className={[styles.taskTag, task.parentId ? styles.childTaskTag : ""]
                .filter(Boolean)
                .join(" ")}
              key={task.id}
              onPointerDown={(event) => startDraggingTask(task, event)}
              onPointerMove={dragTask}
              onPointerUp={stopDraggingTask}
              onPointerCancel={stopDraggingTask}
              style={{
                left: `${task.col * CANVAS_GRID_SIZE_PX}px`,
                minHeight: firstChildParentHeight ? `${firstChildParentHeight}px` : undefined,
                top: `${task.row * CANVAS_GRID_SIZE_PX}px`,
              }}
            >
              <span className={styles.taskDragGrip} aria-hidden="true" />
              <textarea
                ref={editingTaskId === task.id ? editingInputRef : null}
                className={styles.taskInput}
                value={task.text}
                onChange={(event) => updateTaskText(task.id, event)}
                onFocus={() => setEditingTaskId(task.id)}
                onBlur={() => setEditingTaskId(null)}
                aria-label="Edit task"
                placeholder="New task"
                rows={1}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.taskToolbar} role="toolbar" aria-label="New task toolbar">
        <button
          className={styles.addTaskButton}
          type="button"
          onClick={createTask}
          aria-label="New task"
        >
          <span className={styles.addTaskButtonLineIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </span>
          <span>New task</span>
        </button>
        <div
          className={styles.toolbarMenu}
          aria-label="More actions"
          onMouseEnter={openToolbarMenu}
          onMouseLeave={scheduleCloseToolbarMenu}
        >
          <button
            className={styles.toolbarMenuButton}
            type="button"
            onClick={openToolbarMenu}
            aria-label="Open more actions"
            aria-expanded={isToolbarMenuOpen}
          >
            <span className={styles.toolbarMenuDots}>...</span>
          </button>
          {isToolbarMenuOpen ? (
            <div className={styles.toolbarPopover} aria-label="More actions options">
              <div className={styles.toolbarActionMenu}>
                <button
                  className={styles.toolbarActionButton}
                  type="button"
                  onClick={organizeTasks}
                  disabled={tasks.length <= 1}
                  aria-label="Organize tasks"
                >
                  Organize
                </button>
                <button
                  className={styles.toolbarActionButton}
                  type="button"
                  onClick={clearTasks}
                  disabled={tasks.length === 0}
                  aria-label="Clear all tasks"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={trashRef}
        className={[
          styles.trashZone,
          draggingTaskId ? styles.trashZoneActive : "",
          isOverTrash ? styles.trashZoneHover : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-label="Drag here to delete task"
      >
        <svg
          className={styles.trashIcon}
          viewBox="0 0 24 24"
          focusable="false"
          aria-hidden="true"
        >
          <g className={styles.trashLid}>
            <path
              fill="currentColor"
              d="M9.7 2.9h4.6c.45 0 .8.35.8.8V4.55H8.9V3.7c0-.45.35-.8.8-.8ZM5.35 4.55h13.3c.55 0 1 .45 1 1v.35c0 .28-.22.5-.5.5H4.85c-.28 0-.5-.22-.5-.5v-.35c0-.55.45-1 1-1Z"
            />
          </g>
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M5.55 7.85 6.55 19.9c.1 1.05.98 1.85 2.04 1.85h6.82c1.06 0 1.94-.8 2.04-1.85L18.45 7.85H5.55Zm3.05 2.35c.38 0 .68.3.68.68v5.8a.68.68 0 0 1-1.36 0v-5.8c0-.38.3-.68.68-.68Zm3.4 0c.38 0 .68.3.68.68v5.8a.68.68 0 0 1-1.36 0v-5.8c0-.38.3-.68.68-.68Zm3.4 0c.38 0 .68.3.68.68v5.8a.68.68 0 0 1-1.36 0v-5.8c0-.38.3-.68.68-.68Z"
          />
        </svg>
      </div>
    </>
  );
}
