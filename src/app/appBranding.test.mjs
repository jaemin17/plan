import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const layoutSource = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("./taskStorage.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
);

test("uses Next as the product-facing app name", () => {
  assert.match(layoutSource, /title:\s*"Next"/);
  assert.match(
    layoutSource,
    /description:\s*"Turn scattered thoughts into your next step\."/,
  );
  assert.match(pageSource, /aria-label="Next workspace"/);
  assert.equal(packageJson.name, "next-plan");
});

test("keeps the existing storage key so saved tasks remain available", () => {
  assert.match(storageSource, /"plan\.local-tasks"/);
});
