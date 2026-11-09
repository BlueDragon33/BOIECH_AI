import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");

test("L1 manager invitation prompts the already-authenticated account to switch first",()=>{
 assert.match(gate,/managerInvite\?<p role="status">Bạn đang đăng nhập bằng tài khoản khác/);
 assert.match(gate,/“Đăng xuất \/ đổi tài khoản”/);
});
test("L1 account switch preserves only valid 256-bit invite token in the URL fragment",()=>{
 assert.match(gate,/const nextFragment=\/\^\[a-f0-9\]\{64\}\$\/.test\(managerInvite\)/);
 assert.match(gate,/#manager-invite=/);
 assert.match(gate,/window\.location\.replace\(window\.location\.pathname\+window\.location\.search\+nextFragment\)/);
 assert.doesNotMatch(gate,/window\.location\.search\s*\+\s*["']manager-invite=/);
});
test("L1 invitation fragment is scrubbed on mount and not saved to persistent browser storage",()=>{
 assert.match(gate,/new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/);
 assert.match(gate,/history\.replaceState\(window\.history\.state,"",window\.location\.pathname\+window\.location\.search\)/);
 assert.match(gate,/setManagerInvite\(invite\);setRole\("manager"\);setMode\("register"\)/);
 assert.doesNotMatch(gate,/\b(?:localStorage|sessionStorage)\.(?:setItem|managerInvite)/);
});
test("L1 sign-out is committed before transferring the invitation to the next account session",()=>{
 const logout=gate.indexOf('await send({ action: "logout" })');
 const transfer=gate.indexOf('window.location.replace(window.location.pathname+window.location.search+nextFragment)');
 assert.ok(logout>=0&&transfer>logout);
 const scope=gate.slice(logout,transfer);
 assert.match(scope,/broadcast\(\)/);
 assert.doesNotMatch(scope,/window\.location\.reload\(\)/);
});
