import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const base = new URL("../app/phan-tich-video/", import.meta.url);
const main = readFileSync(new URL("video-analyzer-impl.tsx", base), "utf8");
const cycle = readFileSync(new URL("phase-cycle-analyzer.tsx", base), "utf8");

test("full frame sampling survives progress throttling in both video modes", () => {
  for (const [name, source] of [["technique", main], ["cycle", cycle]]) {
    assert.match(source, /for \(let index = 0; index < sampleCount; index \+= 1\)/, name);
    assert.match(source, /await seek\(video, time, run\.signal\)/, name);
    assert.match(source, /pose\.landmarker\.detectForVideo\(video, index \* 200 \+ 1\)/, name);
    assert.match(source, /const bucket = Math\.floor\(pct \/ 5\)/, name);
    assert.match(source, /if \(bucket !== previousProgressBucket \|\| index === sampleCount - 1\)/, name);
    assert.match(source, /await new Promise<void>\(\(resolve\) => window\.setTimeout\(resolve, 0\)\)/, name);
    assert.match(source, /run\.check\(\)/, name);
    const parsed = ts.createSourceFile(name + ".tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(parsed.parseDiagnostics.length, 0, name + ": TypeScript parser error");
  }
});

test("150 pose samples produce at most 22 progress notifications per phase", () => {
  const sampleCount = 150;
  for (const maximum of [82, 100]) {
    let previous = -1;
    let count = 0;
    let final = -1;
    for (let index = 0; index < sampleCount; index += 1) {
      const pct = Math.round((index + 1) / sampleCount * maximum);
      const bucket = Math.floor(pct / 5);
      if (bucket !== previous || index === sampleCount - 1) {
        previous = bucket;
        count += 1;
        final = pct;
      }
    }
    assert.ok(count <= 22, maximum + ": too many UI updates: " + count);
    assert.equal(final, maximum);
  }
});

test("MediaPipe assets are fetched once per inference, with explicit offline download retained", () => {
  assert.match(main, /async function prepareAssets\(/);
  assert.match(main, /await prepareAssets\(\(done, total\) => setProgress/);
  const start = main.indexOf("async function createLandmarker(");
  const end = main.indexOf("async function", start + 6);
  const loader = main.slice(start, end > start ? end : undefined);
  assert.doesNotMatch(loader, /await prepareAssets\(/);
  assert.match(loader, /Promise\.all\(AI_ASSETS\.map\(\(url\) => cachedAsset\(url, signal\)\)\)/);
});
