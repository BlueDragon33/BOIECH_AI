import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createVideoAnalysisRun } from "../app/phan-tich-video/video-analysis-run.mjs";

// Execute the actual preflight effect, preserving MutationObserver microtask
// delivery order. Bound the queue so the old infinite loop fails without hanging CI.
async function preflightEffect() {
  const path = new URL("../app/phan-tich-video/preflight-enforcement-panel.tsx", import.meta.url);
  const source = ts.createSourceFile(path.pathname, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "PreflightEnforcementPanel");
  const call = component.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) && node.expression.expression.getText(source) === "useEffect").expression;
  const helpers = source.statements.filter(node => ts.isFunctionDeclaration(node) && node !== component).map(node => node.getText(source)).join("\n");
  const { outputText } = ts.transpileModule(`${helpers}\nconst effect = ${call.arguments[0].getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  return new Function("document", "window", "MutationObserver", "styles", "sourceRef", "setSource", "setOverrideSource", "setNotice", "setGateStatus", "setPortalHost", `${outputText}; return effect;`);
}

async function fixture() {
  const microtasks = [], timers = new Map(), observers = new Set();
  let stateWrites = 0, creations = 0;
  const mutate = () => {
    for (const observer of observers) {
      if (!observer.active || observer.queued) continue;
      observer.queued = true;
      microtasks.push(() => { observer.queued = false; if (observer.active) observer.callback(); });
    }
  };
  const root = {
    isConnected: true,
    hosts: [],
    querySelector(selector) { return selector === ".analyze" ? button : null; },
  };
  const parent = { insertBefore(host) { root.hosts.push(host); mutate(); } };
  const button = { parentElement: parent };
  const document = {
    querySelector: () => root,
    createElement() {
      creations++;
      const host = {
        dataset: {}, style: {},
        get isConnected() { return root.isConnected && root.hosts.includes(host); },
        remove() { const index = root.hosts.indexOf(host); if (index >= 0) { root.hosts.splice(index, 1); mutate(); } },
      };
      return host;
    },
  };
  class Observer {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const window = {
    setTimeout(callback) { const id = timers.size + 1; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const write = () => { stateWrites++; };
  const effect = (await preflightEffect())(document, window, Observer, { analyzeButton: "analyze", report: "report" }, { current: "" }, write, write, write, write, write);
  const cleanup = effect();
  return {
    root, cleanup, mutate,
    get stateWrites() { return stateWrites; },
    get creations() { return creations; },
    get observersActive() { return [...observers].filter(observer => observer.active).length; },
    runTimers() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    drain() {
      for (let count = 0; count < 12 && microtasks.length; count++) microtasks.shift()();
      assert.equal(microtasks.length, 0, "detached preflight root must not keep creating hosts in an infinite mutation loop");
    },
  };
}

test("quay lại: detached analysis DOM cannot starve navigation before React passive cleanup", async () => {
  const f = await fixture();
  try {
    f.runTimers(); f.drain();
    assert.equal(f.creations, 1);
    const writes = f.stateWrites;
    f.root.isConnected = false;
    f.root.hosts[0].remove(); // React removes the portal while effects await cleanup.
    f.drain();
    assert.equal(f.creations, 1);
    assert.equal(f.stateWrites, writes);
  } finally { f.cleanup(); }
});

test("quay lại before initial timer cannot recreate a portal in detached video DOM", async () => {
  const f = await fixture();
  try {
    f.root.isConnected = false;
    f.runTimers(); f.drain();
    assert.equal(f.creations, 0);
    assert.equal(f.stateWrites, 0);
  } finally { f.cleanup(); }
});

test("a connected analyzer repairs a removed preflight host once and cleans up observers", async () => {
  const f = await fixture();
  f.runTimers(); f.drain();
  f.root.hosts[0].remove(); f.drain();
  assert.equal(f.creations, 2);
  assert.equal(f.root.hosts.length, 1);
  f.cleanup(); f.drain();
  assert.equal(f.observersActive, 0);
  assert.equal(f.root.hosts.length, 0);
});

async function pageFixture(query) {
  const path = new URL("../app/phan-tich-video/page.tsx", import.meta.url);
  const source = ts.createSourceFile(path.pathname, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "LocalVideoAnalysisPage");
  const { outputText } = ts.transpileModule(declaration.getText(source).replace("export default ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } });
  const listeners = new Map(), cleanups = [];
  const window = {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const { cancelVideoAnalysisRuns } = await import("../app/phan-tich-video/video-analysis-run.mjs");
  const render = new Function("React", "Link", "useSearchParams", "useEffect", "window", "cancelVideoAnalysisRuns", "MediaPipeConsentGate", "VideoAnalyzer", `${outputText}; return LocalVideoAnalysisPage;`)(React, "client-router-link", () => new URLSearchParams(query), effect => cleanups.push(effect()), window, cancelVideoAnalysisRuns, "consent", "analyzer");
  const tree = render();
  const back = tree.children[0].children[0].children[0];
  return { back, listeners, cleanup() { cleanups.forEach(cleanup => cleanup?.()); } };
}

test("back link uses native document navigation and cancels active analysis before leaving", async () => {
  const f = await pageFixture("");
  try {
    assert.equal(f.back.type, "a", "returning home must remount the document-scoped learner/teacher shells");
    assert.equal(f.back.props.href, "/");
    const run = createVideoAnalysisRun();
    let disposed = 0;
    await run.acquire(Promise.resolve({ dispose() { disposed++; } }));
    f.back.props.onClick();
    assert.equal(run.signal.aborted, true);
    assert.equal(disposed, 1);
  } finally { f.cleanup(); }
});

test("teacher return preserves only validated tab and encoded class context", async () => {
  const f = await pageFixture("return=teacher&tab=learners&class=L%E1%BB%9Bp%201%26tab%3Dprofile");
  const invalid = await pageFixture("return=teacher&tab=https://evil.test&class=%3Cscript%3E");
  try {
    assert.equal(f.back.props.href, "/?workspace=teacher&tab=learners&class=L%E1%BB%9Bp%201%26tab%3Dprofile");
    assert.equal(invalid.back.props.href, "/?workspace=teacher&tab=analysis&class=%3Cscript%3E");
  } finally { f.cleanup(); invalid.cleanup(); }
});

test("browser back or pagehide cancels AI even when the page enters the back-forward cache", async () => {
  const f = await pageFixture("");
  try {
    const run = createVideoAnalysisRun();
    assert.equal(typeof f.listeners.get("pagehide"), "function");
    f.listeners.get("pagehide")({ persisted: true });
    assert.equal(run.signal.aborted, true);
  } finally { f.cleanup(); }
  assert.equal(f.listeners.size, 0);
});
