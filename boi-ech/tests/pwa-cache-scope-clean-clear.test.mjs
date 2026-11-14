import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the shipped service worker, not a replica of its cache filter.
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
function workerHarness(initialKeys) {
  const handlers = new Map();
  const deleted = [];
  const present = new Set(initialKeys);
  const caches = {
    keys: async () => [...present],
    delete: async (key) => { deleted.push(key); return present.delete(key); },
    open: async () => ({ addAll: async () => {}, put: async () => {} }),
    match: async () => undefined,
  };
  const self = {
    location: { origin: "https://boi-ech.boiech-ai.workers.dev" },
    addEventListener: (name, handler) => handlers.set(name, handler),
    clients: { claim: async () => undefined },
    skipWaiting: () => undefined,
  };
  vm.runInNewContext(source, { self, caches, URL, Promise, Response, fetch: async () => new Response("ok") });
  async function activate() {
    let pending;
    handlers.get("activate")({ waitUntil: (task) => { pending = task; } });
    assert.ok(pending, "activation must await cache housekeeping");
    await pending;
  }
  return { activate, deleted, present, handlers };
}

test("PWA upgrade removes only obsolete app-shell versions, retaining offline MediaPipe model", async () => {
  const worker = workerHarness([
    "boi-ech-webapp-v2", "boi-ech-webapp-v3", "boi-ech-webapp-v4",
    "boi-ech-pose-ai-v1", "boi-ech-pose-ai-v2", "some-other-application",
  ]);
  await worker.activate();
  assert.deepEqual(worker.deleted.sort(), ["boi-ech-webapp-v2", "boi-ech-webapp-v3"]);
  assert.ok(worker.present.has("boi-ech-webapp-v4"));
  assert.ok(worker.present.has("boi-ech-pose-ai-v1"));
  assert.ok(worker.present.has("boi-ech-pose-ai-v2"));
  assert.ok(worker.present.has("some-other-application"));
});

test("Service Worker still delegates authenticated API reads to the network", () => {
  const worker = workerHarness([]);
  let intercepted = false;
  worker.handlers.get("fetch")({
    request: { method: "GET", url: "https://boi-ech.boiech-ai.workers.dev/api/accounts", mode: "navigate" },
    respondWith: () => { intercepted = true; },
  });
  assert.equal(intercepted, false);
});

test("PWA controllerchange does not force-refresh an active lesson or video", () => {
  const sourcePage = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const start = sourcePage.indexOf("const onControllerChange = () => {");
  const stop = sourcePage.indexOf("navigator.serviceWorker.addEventListener", start);
  assert.ok(start > 0 && stop > start, "locate controllerchange handler");
  const handler = sourcePage.slice(start, stop);
  assert.match(handler, /setUpdateAvailable\(true\)/);
  assert.doesNotMatch(handler, /location\.reload\(/);
  assert.match(sourcePage, /onClick=\{\(\) => window\.location\.reload\(\)\}>Tải bản mới/);
  assert.match(sourcePage, /Lưu phần đang làm trước khi tải lại/);
});
