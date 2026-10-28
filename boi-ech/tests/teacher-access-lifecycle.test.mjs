import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Run the actual component and its effects. Controlled network promises preserve
// the separate render/network tasks which expose the loading/effect retry loop.
async function fixture(credential = null) {
  const path = new URL("../app/teacher-role-shell.tsx", import.meta.url);
  const source = ts.createSourceFile(path.pathname, await readFile(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = source.statements.filter(node => ts.isFunctionDeclaration(node) && ["TeacherRoleShell", "createTeacherOverviewLoader"].includes(node.name?.text));
  const { outputText } = ts.transpileModule(declarations.map(node => node.getText(source).replace("export default ", "")).join("\n"), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } });
  const slots = [], effects = [], timers = new Map(), listeners = new Map(), observers = new Set(), requests = [], keys = [];
  let cursor = 0, dirty = true, tree, now = 0, timerId = 0, mountCount = 0;
  const changed = (a, b) => !a || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]));
  function useState(initial) {
    const index = cursor++;
    slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
    return [slots[index].value, value => {
      const next = typeof value === "function" ? value(slots[index].value) : value;
      if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
    }];
  }
  function useRef(value) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; }
  function useMemo(create, deps) { const index = cursor++; if (!slots[index] || changed(slots[index].deps, deps)) slots[index] = { deps, value: create() }; return slots[index].value; }
  function useEffect(effect, deps) {
    const index = cursor++;
    if (!slots[index] || changed(slots[index].deps, deps)) effects.push(() => {
      slots[index]?.cleanup?.(); slots[index] = { deps, cleanup: effect() };
    });
  }
  class Element {
    dataset = {}; children = []; isConnected = true; className = "";
    querySelector(selector) { return this.queries?.[selector] ?? null; }
    getAttribute(name) { return name === "data-device-id" ? this.dataset.deviceId : name === "title" ? "Giảng viên thử nghiệm · SQTEST" : null; }
    closest(selector) {
      if (this.dataset.teacherRoleUi && !(selector.includes(":not(body)") && this.tagName === "BODY")) return this;
      return this.parent?.closest(selector) ?? null;
    }
    append(node) { node.parent = this; node.isConnected = this.isConnected; this.children.push(node); notify(this); }
    insertBefore(node) { this.append(node); }
    insertAdjacentElement(_where, node) { this.parent.append(node); }
    remove() { this.isConnected = false; if (this.parent) { this.parent.children = this.parent.children.filter(node => node !== this); notify(this.parent); } }
  }
  function notify(target, attributeName) { for (const observer of observers) if (observer.active && (!attributeName || observer.options.attributeFilter.includes(attributeName))) observer.callback([{ target }]); }
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.add(this); }
    observe(_target, options) { this.active = true; this.options = options; }
    disconnect() { this.active = false; }
  }
  const shell = new Element(), main = new Element(), sidebar = new Element(), topbar = new Element(), brand = new Element(), chip = new Element();
  shell.dataset = { personRole: "teacher", deviceId: credential ? "" : "a".repeat(64) };
  main.parent = shell; sidebar.parent = shell; topbar.parent = main; brand.parent = sidebar;
  shell.queries = { ".main-area": main, ".sidebar": sidebar };
  main.queries = { ":scope > .topbar": topbar };
  sidebar.queries = { ".brand-row": brand };
  topbar.queries = { ".topbar-actions": new Element() };
  const document = {
    body: new Element(),
    querySelector(selector) { return selector === ".app-shell" ? shell : selector === ".learner-chip" ? chip : { textContent: selector.includes("small") ? "Giảng viên" : "Chào Kiểm thử" }; },
    createElement() { mountCount++; return new Element(); },
  };
  document.body.tagName = "BODY";
  shell.parent = document.body;
  const window = {
    location: { pathname: "/", search: "" }, history: { replaceState() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout(callback, delay = 0) { const id = ++timerId; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) { if (listeners.get(name) === callback) listeners.delete(name); },
  };
  const load = (deviceId, signal) => new Promise((resolve, reject) => requests.push({ deviceId, signal, resolve, reject }));
  const hashing = new Set();
  const cryptoFacade = { subtle: { digest(...args) { const pending = crypto.subtle.digest(...args); hashing.add(pending); pending.finally(() => hashing.delete(pending)); return pending; } } };
  const React = { Fragment: "fragment", createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
  const render = new Function("useState", "useRef", "useMemo", "useEffect", "React", "createPortal", "window", "document", "MutationObserver", "Element", "text", "loadTeacherOverview", "saveTeacherAction", "readStoredDeviceCredential", "TeacherNavigation", "TeacherSearch", "TeacherDashboard", "crypto", `${outputText}; return TeacherRoleShell;`)(useState, useRef, useMemo, useEffect, React, (child, mount) => ({ type: "portal", children: [child], mount }), window, document, MutationObserver, Element, node => node?.textContent ?? "", load, async () => {}, async () => credential, "nav", "search", "dashboard", cryptoFacade);
  function find(node, type) { if (!node) return null; if (node.type === type) return node; for (const child of node.children ?? []) { const found = find(child, type); if (found) return found; } return null; }
  async function settle() {
    for (let iteration = 0; iteration < 40; iteration++) {
      for (let turn = 0; turn < 8; turn++) await Promise.resolve();
      if (hashing.size) { await Promise.all([...hashing]); continue; }
      if (dirty) { dirty = false; cursor = 0; tree = render(); keys.push(find(tree, "dashboard")?.props.key); while (effects.length) effects.shift()(); continue; }
      const due = [...timers].filter(([, timer]) => timer.at <= now);
      if (!due.length) return;
      for (const [id, timer] of due) { timers.delete(id); timer.callback(); }
    }
    assert.fail("teacher effects must settle without repeated rendering or network retries");
  }
  return {
    requests, shell, settle, keys,
    get timerCount() { return timers.size; },
    get mounts() { return mountCount; },
    get dashboard() { return find(tree, "dashboard")?.props; },
    refresh() { listeners.get("boi-ech:teacher-refresh")?.(); },
    mutate(attribute = "data-device-id") { notify(shell, attribute); },
    async tick(ms) { now += ms; await settle(); },
    cleanup() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

const overview = name => ({ teacher: { name, className: "Lớp thử nghiệm" }, learners: [], summary: { learnerCount: 0 } });

test("teacher overview failure settles to an actionable error instead of automatic retry", async () => {
  const f = await fixture();
  try {
    await f.settle(); assert.equal(f.requests.length, 1);
    f.requests[0].reject(new Error("HTTP 500 kiểm thử")); await f.settle();
    f.mutate(); await f.settle();
    assert.equal(f.requests.length, 1, "DOM changes must not restart failed teacher requests");
    assert.equal(f.dashboard.loading, false);
    assert.match(f.dashboard.error, /HTTP 500/);
    f.refresh(); await f.settle(); assert.equal(f.requests.length, 2);
    f.requests[1].resolve(overview("Giảng viên A")); await f.settle();
    assert.equal(f.dashboard.overview.teacher.name, "Giảng viên A");
  } finally { f.cleanup(); }
});

test("stored-credential identity keeps dashboard state stable across unrelated DOM changes", async () => {
  const f = await fixture({ publicKey: { kty: "EC", crv: "P-256", x: "A".repeat(43), y: "B".repeat(43) } });
  try {
    await f.settle();
    assert.equal(f.requests.length, 1);
    f.requests[0].resolve(overview("Giảng viên A")); await f.settle();
    const key = f.dashboard.key;
    const from = f.keys.length;
    f.mutate("class"); await f.settle();
    assert.ok(f.keys.slice(from).every(next => next === key), "ordinary mutations must not temporarily clear the resolved credential key");
    assert.equal(f.requests.length, 1);
  } finally { f.cleanup(); }
});

test("teacher request loading and completion do not remove or recreate portal mounts", async () => {
  const f = await fixture();
  try {
    await f.settle(); assert.equal(f.mounts, 3);
    f.requests[0].resolve(overview("Giảng viên A")); await f.settle();
    assert.equal(f.mounts, 3);
    assert.equal(f.dashboard.loading, false);
  } finally { f.cleanup(); }
});

test("a pending teacher request is bounded and can be retried explicitly", async () => {
  const f = await fixture();
  try {
    await f.settle(); await f.tick(15_001);
    assert.equal(f.dashboard.loading, false);
    assert.match(f.dashboard.error, /thời gian|quá lâu/i);
    assert.equal(f.requests.length, 1);
  } finally { f.cleanup(); }
});

test("switching teacher identity cancels old work and ignores late old results", async () => {
  const f = await fixture();
  try {
    await f.settle();
    const originalKey = f.dashboard.key;
    f.shell.dataset.deviceId = "b".repeat(64); f.mutate(); await f.settle();
    assert.equal(f.requests.length, 2);
    f.requests[1].resolve(overview("Giảng viên B")); await f.settle();
    assert.notEqual(f.dashboard.key, originalKey, "learner drawers and action drafts must remount for the new teacher identity");
    f.requests[0].resolve(overview("Giảng viên A")); await f.settle();
    assert.equal(f.dashboard.overview.teacher.name, "Giảng viên B");
  } finally { f.cleanup(); }
});

test("refresh clicks during an active request do not create duplicate signed requests", async () => {
  const f = await fixture();
  try {
    await f.settle(); f.refresh(); f.refresh(); await f.settle();
    assert.equal(f.requests.length, 1);
  } finally { f.cleanup(); }
});

test("unmount aborts pending work and clears its deadline", async () => {
  const f = await fixture();
  await f.settle();
  f.cleanup();
  assert.equal(f.requests[0].signal.aborted, true);
  assert.equal(f.timerCount, 0);
  f.requests[0].resolve(overview("Late response"));
  await f.settle();
  assert.equal(f.dashboard.overview, null);
});

test("late results from a timed out request cannot overwrite an explicit retry", async () => {
  const f = await fixture();
  try {
    await f.settle(); await f.tick(15_001); f.refresh(); await f.settle();
    f.requests[1].resolve(overview("Retry result")); await f.settle();
    f.requests[0].resolve(overview("Late response")); await f.settle();
    assert.equal(f.dashboard.overview.teacher.name, "Retry result");
  } finally { f.cleanup(); }
});

test("switching teachers removes the actual dashboard learner drawer and action draft", async () => {
  const f = await fixture();
  try {
    const source = ts.createSourceFile("teacher.tsx", await readFile(new URL("../app/teacher-role-shell.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "TeacherDashboard");
    const { outputText } = ts.transpileModule(declaration.getText(source), { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } });
    let slots = [], cursor = 0, activeKey;
    const useState = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], value => { slots[index] = value; }]; };
    const React = { createElement: (type, props, ...children) => ({ type, props: props ?? {}, children }) };
    const args = { useState, useEffect() {}, React, window: { sessionStorage: { getItem() { return null; } }, setTimeout() {} }, document: { querySelector() { return null; } }, matchesQuery: () => true, text: () => "", OverviewDashboard: "overview", LearnerDrawer: "drawer", TeacherActionDialog: "action" };
    const dashboard = new Function(...Object.keys(args), `${outputText}; return TeacherDashboard;`)(...Object.values(args));
    const render = ({ key, ...props }) => {
      // React consumes key before props and remounts component state on a new key.
      if (activeKey !== key) { activeKey = key; slots = []; }
      cursor = 0;
      return dashboard(props);
    };
    const learnerA = { personCode: "HV-A", name: "Học viên A", className: "Lớp A" };
    await f.settle();
    f.requests[0].resolve({ ...overview("Giảng viên A"), learners: [learnerA] }); await f.settle();
    const controls = render(f.dashboard).children.find(node => node?.type === "overview").props;
    controls.onSelect(learnerA);
    controls.onAction({ mode: "feedback", learner: learnerA });
    const open = render(f.dashboard);
    assert.equal(open.children.find(node => node?.type === "drawer").props.learner.name, "Học viên A");
    assert.equal(open.children.find(node => node?.type === "action").props.draft.learner.name, "Học viên A");
    f.shell.dataset.deviceId = "b".repeat(64); f.mutate(); await f.settle();
    f.requests[1].resolve(overview("Giảng viên B")); await f.settle();
    const next = render(f.dashboard);
    assert.equal(next.children.some(node => node?.type === "drawer" || node?.type === "action"), false);
  } finally { f.cleanup(); }
});
