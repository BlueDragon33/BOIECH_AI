import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("teacher class workspace offers accessible Grid/List and non-sensitive persisted preference", () => {
  const component=source("app/teacher-class-workspace.tsx");
  const css=source("app/teacher-class-grid-list-v49.css");
  assert.match(component,/type TeacherClassView = "grid" \| "list"/);
  assert.match(component,/aria-pressed=\{classView === "grid"\}/);
  assert.match(component,/aria-pressed=\{classView === "list"\}/);
  assert.match(component,/data-view=\{classView\}/);
  assert.match(component,/localStorage\.setItem\(CLASS_VIEW_STORAGE, view\)/);
  assert.doesNotMatch(component,/localStorage\.setItem\([^\n]*accountId/);
  assert.match(css,/\[data-view="list"\]/);
  assert.match(css,/@media \(max-width: 760px\)/);
  assert.match(css,/:focus-visible/);
  assert.match(source("app/layout.tsx"),/import "\.\/teacher-class-grid-list-v49\.css"/);
});

test("role-specific bundles and portals require server-validated role workspace", () => {
  for(const [filename,role] of [["learner-enhancements.tsx","learner"],["teacher-enhancements.tsx","teacher"]]){
    const content=source("app/"+filename);
    assert.match(content,/useAccountWorkspace\(\)/);
    assert.ok(content.includes('workspace?.role!=="'+role+'"'));
  }
  const student=source("app/student-role-shell.tsx");
  const teacher=source("app/teacher-role-shell.tsx");
  const adaptive=source("app/student-adaptive-coach.tsx");
  assert.match(student,/workspace\?\.role === "learner"/);
  assert.match(teacher,/workspace\?\.role === "teacher"/);
  assert.match(adaptive,/workspace\?\.role === "learner"/);
  assert.doesNotMatch(teacher,/role === "Giảng viên"/);
  assert.doesNotMatch(student,/role === "Học viên"/);
  assert.doesNotMatch(adaptive,/role === "Học viên"/);
});

test("reload re-entry still requires real server session, device and role content", () => {
  const gate=source("app/account-gate.tsx");
  assert.match(gate,/resumeVerifiedSessionOnLoad/);
  assert.match(gate,/roleDeviceVerified\?\.accountId===id/);
  assert.match(gate,/roleDeviceVerified\.device\.status==="approved"/);
  assert.match(gate,/roleBootstrap\?\.accountId===id/);
  assert.match(gate,/managerPreload\?\.accountId===id/);
  assert.match(gate,/roleReady \|\| managerReady/);
  assert.match(gate,/if\(showGate\)\{resumeVerifiedSessionOnLoad\.current=false/);
  assert.match(gate,/resumeVerifiedSessionOnLoad\.current=false;\n    await run\(async\(\)=>\{/);
  // Must keep existing server authorization, manual GO and session expiry.
  assert.match(gate,/accountServerActive\(account, v2, Date\.now\(\)\)/);
  assert.match(gate,/onGo=\{\(\) => \{/);
});

test("teacher editor uses same authenticated account and retains independent P-256 and human edit approval", () => {
  const auth=source("app/editor-device-auth.server.ts");
  const page=source("app/bien-tap-noi-dung/page.tsx");
  const api=source("app/api/editor/device/route.ts");
  const content=source("app/api/editor/content/route.ts");
  assert.match(auth,/accountCookieToken\(\)/);
  assert.match(auth,/\.authorize\(token\)/);
  assert.match(auth,/if \(actor\.role !== "teacher"\) return null/);
  assert.match(auth,/if \(error instanceof AccountError\) return null/);
  assert.match(auth,/export async function getEditorUser/);
  assert.match(auth,/crypto\.subtle\.verify/);
  assert.match(api,/getEditorUser\(\)/);
  assert.match(page,/getEditorUser\(\)/);
  assert.match(page,/if \(!user\) redirect/);
  assert.match(content,/verifyEditorProof\(payload\)/);
  assert.match(content,/action === "request-edit"/);
  assert.match(content,/status IN \('permission_requested','draft','changes_requested','review'\)/);
});
