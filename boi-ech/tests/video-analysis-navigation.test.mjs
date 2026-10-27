import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createVideoAnalysisRun } from "../app/phan-tich-video/video-analysis-run.mjs";

// Execute the actual frame-seeking function; MediaPipe is not needed to expose
// a pending seek that survives navigation or leaves its event handler behind.
async function loadSeek() {
  const path = new URL("../app/phan-tich-video/video-analyzer-impl.tsx", import.meta.url);
  const source = ts.createSourceFile(path.pathname, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "seek");
  assert.ok(declaration, "the main analyzer must expose its real seek implementation to this regression test");
  const imports = source.statements.filter((node) => ts.isImportDeclaration(node) && node.importClause?.namedBindings?.elements?.some((item) => item.name.text === "seekVideoFrame"))
    .map((node) => node.getText(source).replace(node.moduleSpecifier.text, new URL(node.moduleSpecifier.text, path).href));
  const { outputText } = ts.transpileModule(`${imports.join("\n")}\n${declaration.getText(source)}\nexport { seek };`, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)).seek;
}

class Video extends EventTarget {
  currentTime = 0;
  duration = 12;
  seeking = false;
  currentSrc = "blob:clip-a";
  src = "blob:clip-a";
  isConnected = true;
  handlers = new Set();
  addEventListener(type, handler, options) {
    if (type === "seeked") this.handlers.add(handler);
    super.addEventListener(type, handler, options);
  }
  removeEventListener(type, handler, options) {
    if (type === "seeked") this.handlers.delete(handler);
    super.removeEventListener(type, handler, options);
  }
}

test("leaving during a pending frame seek rejects immediately and removes the handler", async () => {
  const seek = await loadSeek();
  const video = new Video();
  const abort = new AbortController();
  const timers = new Map();
  globalThis.window = { setTimeout: (callback) => { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout: (id) => timers.delete(id) };
  try {
    const promise = seek(video, 2, abort.signal);
    let outcome = "pending";
    promise.then(() => { outcome = "resolved"; }, (error) => { outcome = error.name; });
    abort.abort();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(outcome, "AbortError");
    assert.equal(video.handlers.size, 0);
    assert.equal(timers.size, 0);
  } finally { delete globalThis.window; }
});

test("a failed seek removes its handler before another video can be selected", async () => {
  const seek = await loadSeek();
  const video = new Video();
  let timeout;
  globalThis.window = { setTimeout: (callback) => { timeout = callback; return 1; }, clearTimeout: () => {} };
  try {
    const promise = seek(video, 3);
    const rejected = assert.rejects(promise, /video/i);
    timeout();
    await rejected;
    assert.equal(video.handlers.size, 0);
  } finally { delete globalThis.window; }
});

test("sampling the current decoded timestamp does not wait for a new seek event", async () => {
  const seek = await loadSeek();
  const video = new Video();
  let timeoutCount = 0;
  globalThis.window = { setTimeout: () => { timeoutCount += 1; return 1; }, clearTimeout: () => {} };
  try {
    let completed = false;
    seek(video, 0).then(() => { completed = true; });
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(completed, true);
    assert.equal(timeoutCount, 0);
    assert.equal(video.handlers.size, 0);
  } finally { delete globalThis.window; }
});

test("canceling releases an acquired AI model exactly once", async () => {
  const run = createVideoAnalysisRun(new Video());
  let disposals = 0;
  await run.acquire(Promise.resolve({ dispose: () => { disposals += 1; } }));
  run.cancel();
  run.cancel();
  run.finish();
  assert.equal(disposals, 1);
  assert.throws(() => run.check(), { name: "AbortError" });
});

test("a model that finishes loading after navigation is disposed without being used", async () => {
  const run = createVideoAnalysisRun(new Video());
  let loaded;
  let disposals = 0;
  const pending = run.acquire(new Promise((resolve) => { loaded = resolve; }));
  const rejected = assert.rejects(pending, { name: "AbortError" });
  run.cancel();
  loaded({ dispose: () => { disposals += 1; } });
  await rejected;
  assert.equal(disposals, 1);
});

test("only one analyzer can seek and infer on the same learner video", () => {
  const video = new Video();
  const first = createVideoAnalysisRun(video);
  const second = createVideoAnalysisRun(video);
  assert.throws(() => first.check(), { name: "AbortError" });
  assert.doesNotThrow(() => second.check());
  second.finish();
});

test("a changed source or detached video cancels before the next inference", () => {
  for (const change of [(video) => { video.currentSrc = "blob:clip-b"; }, (video) => { video.isConnected = false; }]) {
    const video = new Video();
    const run = createVideoAnalysisRun(video);
    change(video);
    assert.throws(() => run.check(), { name: "AbortError" });
  }
});

for (const file of ["video-analyzer-impl.tsx", "camera-guidance-panel.tsx", "phase-cycle-analyzer.tsx"]) {
  for (const duringInitialization of [false, true]) {
    test(`${file}: cancellation ${duringInitialization ? "during" : "before"} model initialization releases AI resources`, async () => {
      const path = new URL(`../app/phan-tich-video/${file}`, import.meta.url);
      const source = ts.createSourceFile(file, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "createLandmarker");
      const { outputText } = ts.transpileModule(declaration.getText(source), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      const controller = new AbortController();
      let importEntered, releaseImport, modelEntered, releaseModel;
      const importStarted = new Promise((resolve) => { importEntered = resolve; });
      const imported = new Promise((resolve) => { releaseImport = resolve; });
      const modelStarted = new Promise((resolve) => { modelEntered = resolve; });
      const model = new Promise((resolve) => { releaseModel = resolve; });
      let creations = 0, closes = 0;
      const createdUrls = [], revokedUrls = [];
      const vision = { PoseLandmarker: { createFromOptions() { creations += 1; modelEntered(); return model; } } };
      const body = { text: async () => "", blob: async () => new Blob([]), arrayBuffer: async () => new ArrayBuffer(0) };
      const ImportFunction = function () { return () => { importEntered(); return imported; }; };
      const factory = new Function("prepareAssets", "AI_ASSETS", "cachedAsset", "URL", "Blob", "Function", "BUNDLE_URL", "WASM_LOADER_URL", "WASM_BINARY_URL", "MODEL_URL", `${outputText}\nreturn createLandmarker;`);
      const create = factory(async () => {}, ["a", "b", "c", "d"], async () => body, {
        createObjectURL() { const url = `blob:${createdUrls.length}`; createdUrls.push(url); return url; },
        revokeObjectURL(url) { revokedUrls.push(url); },
      }, Blob, ImportFunction, "a", "b", "c", "d");
      const pending = create(controller.signal);
      const rejected = assert.rejects(pending, { name: "AbortError" });
      await importStarted;
      if (duringInitialization) {
        releaseImport(vision);
        await modelStarted;
        controller.abort();
      } else {
        controller.abort();
        releaseImport(vision);
      }
      releaseModel({ close() { closes += 1; } });
      await rejected;
      assert.equal(creations, duringInitialization ? 1 : 0);
      assert.equal(closes, duringInitialization ? 1 : 0);
      assert.equal(createdUrls.length, 3);
      assert.deepEqual(revokedUrls, createdUrls);
    });
  }
}
