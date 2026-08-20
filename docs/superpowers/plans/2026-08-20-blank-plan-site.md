# Blank Plan Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a blank Next.js website foundation for a future personal planning tool.

**Architecture:** Use a static Next.js App Router site configured for GitHub Pages. Keep the first page minimal and avoid product interactions until the user is ready to design them.

**Tech Stack:** Next.js, TypeScript, pnpm, GitHub Actions, GitHub Pages static export.

---

### Task 1: Scaffold The Website

**Files:**
- Create: Next.js project files in `/Users/jaemin/Documents/ChatGPT/plan`

- [ ] **Step 1: Create the Next.js app in the current directory**

Run:

```bash
pnpm create next-app@latest . --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-pnpm --yes
```

Expected: the project contains `package.json`, `next.config.ts`, `src/app/page.tsx`, and `src/app/layout.tsx`.

- [ ] **Step 2: Confirm generated files exist**

Run:

```bash
test -f package.json && test -f next.config.ts && test -f src/app/page.tsx && test -f src/app/layout.tsx
```

Expected: exit code `0`.

### Task 2: Configure Static Export

**Files:**
- Modify: `/Users/jaemin/Documents/ChatGPT/plan/next.config.ts`

- [ ] **Step 1: Replace `next.config.ts` with GitHub Pages static export config**

Use:

```ts
import type { NextConfig } from "next";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPages = process.env.GITHUB_PAGES === "true";
const isUserOrOrgPagesSite = repositoryName.endsWith(".github.io");
const basePath =
  isGitHubPages && repositoryName && !isUserOrOrgPagesSite
    ? `/${repositoryName}`
    : undefined;

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath ?? "",
  },
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
```

### Task 3: Create The Blank Homepage

**Files:**
- Modify: `/Users/jaemin/Documents/ChatGPT/plan/src/app/page.tsx`
- Modify: `/Users/jaemin/Documents/ChatGPT/plan/src/app/page.module.css`
- Modify: `/Users/jaemin/Documents/ChatGPT/plan/src/app/layout.tsx`
- Modify: `/Users/jaemin/Documents/ChatGPT/plan/src/app/globals.css`

- [ ] **Step 1: Replace the default homepage with a minimal blank planning page**

Use:

```tsx
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
```

- [ ] **Step 2: Replace page styles**

Use:

```css
.page {
  min-height: 100svh;
  display: grid;
  place-items: center;
  padding: 48px 24px;
  background: #f7f7f4;
  color: #171717;
}

.shell {
  width: min(720px, 100%);
}

.kicker {
  margin: 0 0 12px;
  color: #606060;
  font-size: 0.875rem;
}

.shell h1 {
  margin: 0;
  font-size: clamp(2.5rem, 8vw, 5rem);
  font-weight: 600;
}
```

- [ ] **Step 3: Update metadata and language**

Set the page metadata to title `计划` and description `一个用于逐步建立个人计划流程的网站。`, and set `<html lang="zh-CN">`.

- [ ] **Step 4: Keep global styles minimal**

Use global styles that set `box-sizing`, zero body margin, and inherit the system font.

### Task 4: Add GitHub Pages Workflow

**Files:**
- Create: `/Users/jaemin/Documents/ChatGPT/plan/.github/workflows/deploy-github-pages.yml`

- [ ] **Step 1: Create the deployment workflow**

Use the workflow from `/Users/jaemin/Documents/skills/create-nextjs-github-pages-site/SKILL.md`, with pnpm 10, Node 22, `pnpm install --frozen-lockfile`, `pnpm build`, and `actions/deploy-pages@v4`.

### Task 5: Validate And Commit

**Files:**
- Validate all created and modified files.

- [ ] **Step 1: Run the production build**

Run:

```bash
pnpm build
```

Expected: build exits with code `0` and creates `/Users/jaemin/Documents/ChatGPT/plan/out`.

- [ ] **Step 2: Review git status**

Run:

```bash
git status --short
```

Expected: source files and docs are listed; `out/` and dependency output are not committed.

- [ ] **Step 3: Commit the local site foundation**

Run:

```bash
git add .
git commit -m "Set up blank planning site"
```

Expected: commit succeeds.

### Deferred: Publish To GitHub Pages

Publishing is deferred until `gh auth status` reports a valid login for the intended GitHub account. After login is fixed, create or connect the GitHub repository, push `main`, enable Pages workflow deployment, and wait for the GitHub Actions deployment URL.
