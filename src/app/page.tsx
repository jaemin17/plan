import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-label="计划工作区">
        <p className={styles.kicker}>Plan</p>
        <h1>计划</h1>
      </section>
    </main>
  );
}
