"use client";

import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import {
  attachTaskToParent,
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
};

export function LocalTasks() {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [nextTaskIndex, setNextTaskIndex] = useState(1);
  const [hasLoadedStoredTasks, setHasLoadedStoredTasks] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [isToolbarMenuOpen, setIsToolbarMenuOpen] = useState(false);
  const toolbarCloseTimeoutRef = useRef<number | null>(null);
  const editingInputRef = useRef<HTMLInputElement | null>(null);
  const taskLayerRef = useRef<HTMLDivElement | null>(null);
  const trashRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);

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

  function updateTaskText(taskId: string, event: ChangeEvent<HTMLInputElement>) {
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

  function isPointerOverTrash(event: PointerEvent<HTMLElement>) {
    const trash = trashRef.current;
    if (!trash) return false;

    const rect = trash.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function startDraggingTask(task: LocalTask, event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof HTMLInputElement) return;

    const point = pointerPercent(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      taskId: task.id,
      offsetXPercent: point.xPercent - task.xPercent,
      offsetYPercent: point.yPercent - task.yPercent,
      lastXPercent: task.xPercent,
      lastYPercent: task.yPercent,
    };
    setEditingTaskId(null);
    setDraggingTaskId(task.id);
    setIsOverTrash(isPointerOverTrash(event));
  }

  function dragTask(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const point = pointerPercent(event);
    if (!point) return;

    const nextX = point.xPercent - dragState.offsetXPercent;
    const nextY = point.yPercent - dragState.offsetYPercent;
    const deltaX = nextX - dragState.lastXPercent;
    const deltaY = nextY - dragState.lastYPercent;
    const nextIsOverTrash = isPointerOverTrash(event);

    setTasks((currentTasks) =>
      currentTasks.map((task) => {
        if (task.id === dragState.taskId) {
          return moveTask(task, nextX, nextY);
        }

        if (task.parentId === dragState.taskId) {
          return moveTask(task, task.xPercent + deltaX, task.yPercent + deltaY);
        }

        return task;
      }),
    );

    dragState.lastXPercent = nextX;
    dragState.lastYPercent = nextY;
    setIsOverTrash(nextIsOverTrash);
  }

  function stopDraggingTask(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    if (isPointerOverTrash(event)) {
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

      const parent = currentTasks.find(
        (task) =>
          task.id !== draggedTask.id &&
          draggedTask.xPercent >= task.xPercent + 6 &&
          draggedTask.xPercent <= task.xPercent + 24 &&
          Math.abs(draggedTask.yPercent - task.yPercent) <= 12,
      );

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
        {tasks.map((task) => (
          <div
            className={`${styles.taskTag} ${task.parentId ? styles.childTaskTag : ""}`}
            key={task.id}
            onPointerDown={(event) => startDraggingTask(task, event)}
            onPointerMove={dragTask}
            onPointerUp={stopDraggingTask}
            onPointerCancel={stopDraggingTask}
            style={{
              left: `${task.xPercent}%`,
              top: `${task.yPercent}%`,
            }}
          >
            <span className={styles.taskDragGrip} aria-hidden="true" />
            <input
              ref={editingTaskId === task.id ? editingInputRef : null}
              className={styles.taskInput}
              value={task.text}
              onChange={(event) => updateTaskText(task.id, event)}
              onFocus={() => setEditingTaskId(task.id)}
              onBlur={() => setEditingTaskId(null)}
              aria-label="Edit task"
              placeholder="New task"
            />
          </div>
        ))}
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
