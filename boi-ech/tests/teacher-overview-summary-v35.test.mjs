import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8");

test("V35 OverviewDashboard defines summary in its own render scope", () => {
  const start = shell.indexOf("function OverviewDashboard");
  const end = shell.indexOf("\nfunction TeacherDashboard", start);
  assert.ok(start >= 0 && end > start, "OverviewDashboard source must be discoverable");
  const overview = shell.slice(start, end);
  assert.match(
    overview,
    /const summary = overview\?\.summary \?\? \{ learnerCount:0, active7d:0, needingSupport:0, analysisCount:0, averageProgress:0 \};/
  );
  const declaration = overview.indexOf("const summary =");
  for (const use of ["summary.active7d", "summary.learnerCount", "summary.analysisCount", "summary.needingSupport", "summary.averageProgress", "summary={summary}"]) {
    const index = overview.indexOf(use);
    assert.ok(index > declaration, `${use} must be read only after summary is declared`);
  }
});

test("V35 keeps the summary fallback aligned with the TeacherOverview summary contract", () => {
  assert.match(shell, /summary: \{ learnerCount: number; active7d: number; needingSupport: number; analysisCount: number; averageProgress: number \}/);
});
