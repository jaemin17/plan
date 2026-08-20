"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { formatDateStamp } from "./formatDateStamp";

export function DateStamp() {
  const [stamp, setStamp] = useState(() => formatDateStamp(new Date()));
  const [isStorageHelpOpen, setIsStorageHelpOpen] = useState(false);

  useEffect(() => {
    function refresh() {
      setStamp(formatDateStamp(new Date()));
    }

    refresh();

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timeoutId = window.setTimeout(refresh, nextMidnight.getTime() - now.getTime());

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className={styles.dateStampGroup}>
      <div className={styles.dateStampRow}>
        <time className={styles.dateStamp} dateTime={stamp.dateTime}>
          <em>{stamp.label}</em>
        </time>
        <button
          className={styles.dateStorageHelpButton}
          type="button"
          onMouseEnter={() => setIsStorageHelpOpen(true)}
          onMouseLeave={() => setIsStorageHelpOpen(false)}
          onFocus={() => setIsStorageHelpOpen(true)}
          onBlur={() => setIsStorageHelpOpen(false)}
          aria-label="Storage help"
          aria-expanded={isStorageHelpOpen}
        >
          <svg
            className={styles.dateStorageHelpIcon}
            viewBox="0 0 1024 1024"
            focusable="false"
            aria-hidden="true"
          >
            <path d="M755.9 77.1H268.1c-112 0-203.2 91.2-203.2 203.2v325.1c0 112 91.2 203.2 203.2 203.2h124.1L512 946.9l119.8-138.3h124.1c112 0 203.2-91.2 203.2-203.2V280.3c0-112.1-91.2-203.2-203.2-203.2z m121.9 528.3c0 67.2-54.7 121.9-121.9 121.9H594.6L512 822.8l-82.6-95.4H268.1c-67.2 0-121.9-54.7-121.9-121.9V280.3c0-67.2 54.7-121.9 121.9-121.9h487.7c67.2 0 121.9 54.7 121.9 121.9v325.1z" />
            <path d="M527.5 253.5c-84.4-3.9-134.4 33.8-150 113l56.5 13.6c11.7-51.9 40.2-77.9 85.7-77.9 37.7 2.6 58.4 22.1 62.3 58.4 1.3 26-16.2 52-52.6 77.9-35.1 23.4-52 53.9-50.7 91.6v19.5h52.6V534c-1.3-27.3 13-50.7 42.9-70.1 50.7-31.2 74.7-67.5 72.1-109.1-7.8-63.6-47.4-97.4-118.8-101.3zM472.9 596.4h64.3v62.3h-64.3z" />
          </svg>
        </button>
      </div>
      {isStorageHelpOpen ? (
        <div className={styles.dateStorageHelpPanel} role="note">
          <p>
            <strong>1. Saved only in this browser.</strong>
            <span>Not uploaded or synced.</span>
          </p>
          <p>
            <strong>2. Best for temporary plans.</strong>
            <span>Do not use for important records.</span>
          </p>
          <p>
            <strong>3. May disappear if you clear data or switch browsers/devices.</strong>
          </p>
        </div>
      ) : null}
    </div>
  );
}
