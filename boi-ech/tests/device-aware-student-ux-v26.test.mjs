import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("student shell consumes the synchronized authorized device profile", async () => {
  const shell = await readFile(new URL("../app/student-role-shell.tsx", import.meta.url), "utf8");

  assert.match(shell, /deviceType: "desktop" \| "phone" \| "tablet"/);
  assert.match(shell, /classifiedType = shell\.dataset\.deviceType/);
  assert.match(shell, /platform: shell\.dataset\.devicePlatform \?\? ""/);
  assert.match(shell, /browser: shell\.dataset\.deviceBrowser \?\? ""/);
  assert.match(shell, /DEVICE_TYPE_LABELS\[snapshot\.deviceType\]/);
  assert.match(shell, /<dt>Thiết bị<\/dt>/);
});

test("phone learner UX is classification-aware and touch optimized", async () => {
  const css = await readFile(new URL("../app/student-role-shell.css", import.meta.url), "utf8");

  assert.match(css, /\.app-shell\[data-device-type="phone"\] \.student-capabilities > div/);
  assert.match(css, /grid-auto-flow: column/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(css, /\.app-shell\[data-device-type="phone"\] \.student-hero-visual/);
  assert.match(css, /touch-action: manipulation/);
});

test("tablet learner UX uses a medium-density layout from the authorized classification", async () => {
  const css = await readFile(new URL("../app/student-role-shell.css", import.meta.url), "utf8");

  assert.match(css, /\.app-shell\[data-device-type="tablet"\] \.student-capabilities > div/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.app-shell\[data-device-type="tablet"\] \.student-lesson-grid/);
  assert.match(css, /\.app-shell\[data-device-type="tablet"\] \.student-side-stack/);
});

test("viewport responsive rules remain present as a fallback layer", async () => {
  const css = await readFile(new URL("../app/student-role-shell.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
});
