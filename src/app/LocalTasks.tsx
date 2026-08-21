"use client";

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  attachTaskToParent,
  childXPercentAfterParentEdge,
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
  offsetXPercent: number;
  offsetYPercent: number;
  lastXPercent: number;
  lastYPercent: number;
  startClientX: number;
  startClientY: number;
  hasStarted: boolean;
};

const TASK_DRAG_START_DISTANCE_PX = 5;
const TASK_DROP_PARENT_MIN_GAP_PX = -24;
const TASK_DROP_PARENT_MAX_GAP_PX = 220;
const TASK_DROP_PARENT_PREFERRED_GAP_PX = 38;
const TASK_DROP_PARENT_VERTICAL_SLOP_PX = 36;

export function LocalTasks() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [nextTaskIndex, setNextTaskIndex] = useState(1);
  const [hasLoadedStoredTasks, setHasLoadedStoredTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const toolbarCloseTimeoutRef = useRef<number | null>(null);
  const editingInputRef = useRef<HTMLTextAreaElement | null>(null);
  const taskLayerRef = useRef<HTMLDivElement | null>(null);
  const taskRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const trashRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const measuredRelayoutFrameRef = useRef<number | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const storedTasks = readStoredTasks(boardSize());
      setTasks(storedTasks);
      setNextTaskIndex(storedTasks.length + 1);
      setHasLoadedStoredTasks(true);
    });
  }, []);

  useEffect(() => {
    if (!hasLoadedStoredTasks) return;

    writeStoredTasks(tasks);
  }, [hasLoadedStoredTasks, tasks]);

  useEffect(() => {
    if (!hasLoadedStoredTasks || draggingTaskId) return;

    function relayoutStoredChildren() {
      setTasks((currentTasks) => layoutAllChildTasks(currentTasks, boardSize()));
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
        const size = boardSize();
        if (!size) return;

        setTasks((currentTasks) => {
          const nextTasks = layoutMeasuredChildTasks(currentTasks, size);
          return areTaskLayoutsEqual(currentTasks, nextTasks) ? currentTasks : nextTasks;
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
  }, [draggingTaskId, hasLoadedStoredTasks, tasks]);

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
        xPercent: 50,
        yPercent: 50 + index * 6,
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

  function areTaskLayoutsEqual(firstTasks: LocalTask[], secondTasks: LocalTask[]) {
    if (firstTasks.length !== secondTasks.length) return false;

    return firstTasks.every((firstTask, index) => {
      const secondTask = secondTasks[index];
      return (
        secondTask &&
        firstTask.id === secondTask.id &&
        firstTask.text === secondTask.text &&
        firstTask.parentId === secondTask.parentId &&
        Math.abs(firstTask.xPercent - secondTask.xPercent) < 0.01 &&
        Math.abs(firstTask.yPercent - secondTask.yPercent) < 0.01
      );
    });
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

  function firstChildParentHeightPx(task: LocalTask, currentTasks: LocalTask[]) {
    if (!task.parentId) return undefined;

    const firstChild = currentTasks.find((candidateTask) => candidateTask.parentId === task.parentId);
    if (firstChild?.id !== task.id) return undefined;

    return taskRefs.current.get(task.parentId)?.getBoundingClientRect().height;
  }

  function layoutMeasuredChildTasks(currentTasks: LocalTask[], size: { width: number; height: number }) {
    const verticallyLaidOutTasks = layoutAllChildTasks(currentTasks, size);
    const measuredTasksById = new Map<string, LocalTask>();
    const taskWidthsById = new Map<string, number>();

    verticallyLaidOutTasks.forEach((task) => {
      const taskElement = taskRefs.current.get(task.id);
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
        xPercent: childXPercentAfterParentEdge(measuredTask(parent), parentWidthPixels, size),
      };
      measuredTasksById.set(task.id, nextTask);
      return nextTask;
    }

    return verticallyLaidOutTasks.map(measuredTask);
  }

  function pointerPercent(event: PointerEvent<HTMLElement>) {
    const layer = taskLayerRef.current;
    if (!layer) return null;

    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    return {
      xPercent: ((event.clientX - rect.left) / rect.width) * 100,
      yPercent: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function boardSize() {
    const layer = taskLayerRef.current;
    if (!layer) return undefined;

    const rect = layer.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;

    return {
      width: rect.width,
      height: rect.height,
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
    const point = pointerPercent(event);
    if (!point) return;

    const startsOnText = event.target instanceof HTMLTextAreaElement;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      taskId: task.id,
      offsetXPercent: point.xPercent - task.xPercent,
      offsetYPercent: point.yPercent - task.yPercent,
      lastXPercent: task.xPercent,
      lastYPercent: task.yPercent,
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

    const point = pointerPercent(event);
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

    const nextX = point.xPercent - dragState.offsetXPercent;
    const nextY = point.yPercent - dragState.offsetYPercent;
    const deltaX = nextX - dragState.lastXPercent;
    const deltaY = nextY - dragState.lastYPercent;

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id === dragState.taskId) {
          return moveTask(task, nextX, nextY);
        }

        if (isTaskDescendantOf(task, dragState.taskId, currentTasks)) {
          return moveTask(task, task.xPercent + deltaX, task.yPercent + deltaY);
        }

        return task;
      }),
    );

    dragState.lastXPercent = nextX;
    dragState.lastYPercent = nextY;
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
      setTasks((currentTasks) => deleteTask(currentTasks, dragState.taskId, boardSize()));
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

        return layoutChildTasks(detachedTasks, draggedTask.parentId, boardSize());
      }

      const attachedTasks = currentTasks.map((task) =>
        task.id === draggedTask.id ? attachTaskToParent(task, parent, boardSize()) : task,
      );

      return layoutChildTasks(attachedTasks, parent.id, boardSize());
    });

    dragStateRef.current = null;
    setDraggingTaskId(null);
    setIsOverTrash(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <>
      <div ref={taskLayerRef} className={styles.taskLayer} aria-label="任务标签">
        {tasks.map((task) => {
          const firstChildParentHeight = firstChildParentHeightPx(task, tasks);

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
                left: `${task.xPercent}%`,
                minHeight: firstChildParentHeight ? `${firstChildParentHeight}px` : undefined,
                top: `${task.yPercent}%`,
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
