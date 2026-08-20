import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDateStamp } from "./formatDateStamp.ts";

test("formats the local calendar date for the header stamp", () => {
  const stamp = formatDateStamp(new Date(2026, 6, 17));

  assert.equal(stamp.dateTime, "2026-07-17");
  assert.equal(stamp.label, "Friday 17 July 2026");
});

test("updates the stamp for the next calendar day", () => {
  const stamp = formatDateStamp(new Date(2026, 6, 18));

  assert.equal(stamp.dateTime, "2026-07-18");
  assert.equal(stamp.label, "Saturday 18 July 2026");
});
