import styles from "./page.module.css";
import { DateStamp } from "./DateStamp";
import { LocalTasks } from "./LocalTasks";

export default function Home() {
  return (
    <div className={styles.page}>
      <DateStamp />
      <main className={styles.board} aria-label="计划工作区">
        <LocalTasks />
      </main>
    </div>
  );
}
