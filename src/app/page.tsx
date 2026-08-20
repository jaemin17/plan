import styles from "./page.module.css";
import { DateStamp } from "./DateStamp";

export default function Home() {
  return (
    <div className={styles.page}>
      <DateStamp />
      <main className={styles.board} aria-label="计划工作区" />
    </div>
  );
}
