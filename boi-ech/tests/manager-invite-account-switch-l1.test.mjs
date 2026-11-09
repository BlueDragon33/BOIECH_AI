import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const gate=readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");

test("L1 manager invitation tells an already signed-in user how to switch accounts",()=>{
 assert.match(gate,/managerInvite\?<p role="status">Bạn đang đăng nhập bằng tài khoản khác/);
 assert.match(gate,/“Đăng xuất \/ đổi tài khoản”/);
});
test("L1 switch only carries a valid 256-bit token in fragment, not URL query",()=>{
 assert.match(gate,/const oneUseFragment=\/\^\[a-f0-9\]\{64\}\$\/.test\(token\)/);
 assert.match(gate,/#manager-invite=/);
 assert.match(gate,/window\.location\.replace\(window\.location\.pathname\+window\.location\.search\+oneUseFragment\)/);
 assert.doesNotMatch(gate,/window\.location\.search\s*\+\s*["']manager-invite=/);
});
test("L1 invite hash is immediately scrubbed after mount; no Web Storage persistence",()=>{
 assert.match(gate,/new URLSearchParams\(window\.location\.hash\.slice\(1\)\)/);
 assert.match(gate,/history\.replaceState\(window\.history\.state,"",window\.location\.pathname\+window\.location\.search\)/);
 assert.match(gate,/managerInviteRef\.current=invite;setManagerInvite\(invite\)/);
 assert.match(gate,/managerInviteRef\.current="";setManagerInvite\(""\)/);
 assert.doesNotMatch(gate,/\b(?:localStorage|sessionStorage)\.(?:setItem|managerInvite)/);
});
test("L1 session logout is committed before transferring the pending invite",()=>{
 const logout=gate.indexOf('await send({ action: "logout" })');
 const transfer=gate.indexOf('reloadPreservingPendingManagerInvite(managerInviteRef.current)',logout);
 assert.ok(logout>=0&&transfer>logout);
 const scope=gate.slice(logout,transfer);
 assert.match(scope,/broadcast\(\)/);
 assert.doesNotMatch(scope,/window\.location\.reload\(\)/);
});
test("L1 automatic expired-session or changed-account reloads also preserve the invite",()=>{
 assert.match(gate,/if\(current\.current\)\{setReady\(false\);reloadPreservingPendingManagerInvite\(managerInviteRef\.current\);return;\}/);
 assert.match(gate,/accountTransitionNeedsReload\(current\.current/);
 assert.ok((gate.match(/reloadPreservingPendingManagerInvite\(managerInviteRef\.current\)/g)??[]).length>=3);
});
