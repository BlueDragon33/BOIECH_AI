import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = name => readFileSync(new URL("../" + name, import.meta.url), "utf8");

test("editor route never calls D1 on initial server-rendered navigation", () => {
  const page = source("app/bien-tap-noi-dung/page.tsx");
  assert.match(page, /force-dynamic/);
  assert.match(page, /EditorSessionGate/);
  assert.doesNotMatch(page, /getEditorUser\(/);
  assert.doesNotMatch(page, /requireChatGPTUser/);
  assert.match(page, /returnHref=\{returnHref\}/);
  assert.match(page, /encodeURIComponent\(returnTab\)/);
  assert.match(page, /encodeURIComponent\(returnClass\)/);
});

test("editor session endpoint denies unverified sessions and backend outages", () => {
  const route = source("app/api/editor/session/route.ts");
  assert.match(route, /export async function GET/);
  assert.match(route, /getEditorUser\(\)/);
  assert.match(route, /if \(!user\)/);
  assert.match(route, /EDITOR_SESSION_REQUIRED/);
  assert.match(route, /EDITOR_SESSION_UNAVAILABLE/);
  assert.match(route, /status: 401/);
  assert.match(route, /status: 503/);
  assert.match(route, /no-store, private/);
  assert.match(route, /vary: "Cookie"/);
  assert.doesNotMatch(route, /\.run\(/);
  assert.doesNotMatch(route, /accountCookieToken/);
});

test("editor client shows a session error rather than a global error screen", () => {
  const gate = source("app/bien-tap-noi-dung/editor-session-gate.tsx");
  assert.match(gate, /credentials: "same-origin"/);
  assert.match(gate, /cache: "no-store"/);
  assert.match(gate, /AbortController/);
  assert.match(gate, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(gate, /EDITOR_SESSION_NETWORK/);
  assert.match(gate, /state\.kind === "ready"/);
  assert.match(gate, /EditorWorkspace user=\{state\.user\}/);
  assert.match(gate, /Kiểm tra lại/);
  assert.match(gate, /Về lớp học/);
});

test("editor mutation contract retains signed role and independently signed laptop", () => {
  const session = source("app/editor-device-auth.server.ts");
  const device = source("app/api/editor/device/route.ts");
  const content = source("app/api/editor/content/route.ts");
  assert.match(session, /\.authorize\(token\)/);
  assert.match(session, /actor\.role !== "teacher"/);
  assert.match(session, /crypto\.subtle\.verify/);
  assert.match(session, /EDITOR_CSRF_REJECTED/);
  assert.match(device, /getEditorUser\(\)/);
  assert.match(device, /assertEditorPostOrigin\(request\)/);
  assert.match(content, /verifyEditorProof\(payload\)/);
  assert.match(content, /assertEditorPostOrigin\(request\)/);
});

test("Production deployment verifies editor route without signed test bypass", () => {
  const workflow = readFileSync(new URL("../../.github/workflows/deploy-cloudflare.yml", import.meta.url), "utf8");
  const smoke = source("scripts/verify-editor-route-live.mjs");
  assert.match(workflow, /run: node scripts\/verify-editor-route-live\.mjs/);
  assert.match(smoke, /bien-tap-noi-dung\?lesson=01/);
  assert.match(smoke, /session\.status!==401/);
  assert.match(smoke, /EDITOR_SESSION_REQUIRED/);
  assert.doesNotMatch(smoke, /POST|\.run\(/);
});
