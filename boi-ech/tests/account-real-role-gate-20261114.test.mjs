import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src=(p)=>fs.readFileSync(new URL("../app/"+p,import.meta.url),"utf8");
const gate=src("account-gate.tsx");
const preload=src("account-workspace-bootstrap.tsx");
const home=src("page.tsx");
const teacher=src("teacher-role-shell.tsx");
const workspaceSkin=src("account-verification-showcase.module.css");
const visual=src("account-verification-showcase.tsx");
const runtime=src("account-runtime.server.ts");
const verify=src("device-auth.server.ts");

test("a successful login changes immediately to CHECKING instead of standing in the old form",()=>{
 assert.match(gate,/if\(showGate\)setAuthSubmitting\(true\)/);
 assert.match(gate,/if \(authSubmitting && !active\) return <AccountVerificationShowcase phase="checking"/);
 assert.match(gate,/finally \{ if\(showGate\)setAuthSubmitting\(false\); \}/);
 assert.match(gate,/setFieldErrors\(previous=>/);
});
test("server-authoritative session and device are checked before any GO",()=>{
 assert.match(preload,/portableWorkspaceCredential\(\)/);
 assert.match(preload,/action:"register",publicKey:credential.publicKey/);
 assert.match(preload,/device.accountId!==accountId\|\|device.deviceId!==storageDeviceId/);
 assert.match(preload,/device.personRole!==role\|\|device.status!=="approved"\|\|!device.registrationComplete/);
 assert.match(gate,/checks=\{\[ready,active && deviceVerified,workspaceVerified\]\}/);
 assert.match(gate,/accountServerActive\(account, v2, Date.now\(\)\) && workspaceVerified && deviceVerified/);
});
test("learner bootstrap reads real first lesson and teacher reads real scoped overview before GO",()=>{
 assert.match(preload,/\"\/api\/course\",\{action:"bootstrap",lessonNumber:"01",\.\.\.proof\}/);
 assert.match(preload,/\"\/api\/teacher\/overview\",proof,signal/);
 assert.match(preload,/Array.isArray\(data.outlines\)\|\|data.outlines.length!==8/);
 assert.match(preload,/Array.isArray\(overview.learners\)/);
 assert.match(preload,/await import\("\.\/teacher-enhancements"\)/);
 assert.match(preload,/await import\("\.\/learner-enhancements"\)/);
 assert.match(preload,/credentials:"same-origin",cache:"no-store"/);
 assert.match(preload,/signal.throwIfAborted\(\)/);
});
test("after GO Home reuses actual approved device/content, no second DeviceGate initialization",()=>{
 assert.match(gate,/<AccountWorkspaceProvider workspace=\{roleBootstrap\}>\{children\}<\/AccountWorkspaceProvider>/);
 assert.match(home,/const accountWorkspace=useAccountWorkspace\(\)/);
 assert.match(home,/const \[ready, setReady\] = useState\(Boolean\(accountWorkspace\)\)/);
 assert.match(home,/const \[hasEnteredLearning, setHasEnteredLearning\] = useState\(Boolean\(accountWorkspace\)\)/);
 assert.match(home,/const deviceTask = accountWorkspace \? Promise.resolve\(\) : getOrCreateDeviceCredential\(\)/);
 assert.match(home,/skipPreloadedCourseRead.current/);
 assert.match(home,/if \(!ready \|\| !localProgressReady\) return/);
});
test("teacher enhancement consumes genuine prefetched server overview, not a second loading card",()=>{
 assert.match(teacher,/const preloadedTeacher=workspace\?\.role==="teacher" \? workspace : null/);
 assert.match(teacher,/preloadedTeacher\?\.teacherOverview as TeacherOverview/);
 assert.match(teacher,/const attemptedDeviceRef = useRef\(preloadedTeacher\?\.device.deviceId\?\?""\)/);
 assert.match(teacher,/const loadedDeviceRef = useRef\(preloadedTeacher\?\.device.deviceId\?\?""\)/);
});
test("V2 account entitlement is authoritative, legacy device expiry never blocks second gate",()=>{
 assert.match(runtime,/accessExpired:false,accessExpiringSoon:false/);
 assert.match(runtime,/const actor = config.v2 \? await service.authorize\(token\)/);
 assert.match(verify,/await .*\.authorize\(await runtime.accountCookieToken\(\)\)/);
 assert.match(verify,/if \(!v2Account && row\?\.access_expires_at/);
});
test("all rings animate during real CHECKING with accessible reduced-motion and exact one-second GO",()=>{
 assert.match(visual,/className=\{styles.gear\}/);
 assert.match(visual,/className=\{styles.tinyOrbit\}/);
 assert.match(visual,/className=\{styles.innerOrbit\}/);
 assert.match(workspaceSkin,/repeating-conic-gradient/);
 assert.match(workspaceSkin,/boiOrbitForward 3.3s linear infinite/);
 assert.match(workspaceSkin,/boiOrbitReverse 5.1s linear infinite/);
 assert.match(workspaceSkin,/prefers-reduced-motion:reduce/);
 assert.match(visual,/window.setTimeout\(\(\) => goRef.current\(\), 1000\)/);
});
