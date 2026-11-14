import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../app/account-gate.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/account-gate.module.css",import.meta.url),"utf8");
const start=source.indexOf('type Mode = "login"'),end=source.indexOf("function accountNetworkError(");
assert.ok(start>0&&end>start,"find production validation implementation");
const validationOnly=source.slice(start,end);
const compiled=ts.transpileModule(validationOnly,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const validate=new Function(compiled+"\nreturn authFieldError;")();

function field(name,value,{type="text",required=true,valueMissing=false,tooShort=false,typeMismatch=false}={}){
 return {name,value,type,required,validity:{valueMissing,tooShort,tooLong:false,typeMismatch,
   patternMismatch:false,badInput:false}};
}
function form(password=""){
 return {elements:{namedItem:(name)=>name==="password"?{value:password}:null}};
}
test("inline registration error pinpoints missing and malformed fields",()=>{
 assert.match(validate(field("login","ab"),form(),"email"),/3–64/);
 assert.match(validate(field("login","bad name"),form(),"email"),/3–64/);
 assert.equal(validate(field("login","member_2"),form(),"email"),"");
 assert.match(validate(field("contactValue","oops@",{type:"email"}),form(),"email"),/Email/);
 assert.equal(validate(field("contactValue","learn@example.org",{type:"email"}),form(),"email"),"");
 assert.match(validate(field("contactValue","123",{type:"tel"}),form(),"phone"),/7–16/);
 assert.equal(validate(field("contactValue","+7 916 123-45-67",{type:"tel"}),form(),"phone"),"");
 assert.match(validate(field("securityAnswer","x"),form(),"email"),/2 ký tự/);
 assert.match(validate(field("privacyAccepted","on",{type:"checkbox",valueMissing:true}),form(),"email"),/xác nhận/);
 assert.match(validate(field("password","",{valueMissing:true}),form(),"email"),/mật khẩu/);
});
test("confirmation mismatch uses confirmation field, not a global alert alone",()=>{
 assert.match(validate(field("passwordConfirm","123456789012345"),form("mismatched123456"),"email"),/không khớp/);
 assert.equal(validate(field("passwordConfirm","same"),form("same"),"email"),"");
 for(const check of ['setFieldErrors(issues)','id="auth-password-confirm-error"',
   'aria-invalid={Boolean(fieldErrors.login)}','aria-describedby={fieldErrors.contactValue',
   'code==="AUTH_FAILED"?"password"','code==="SECURITY_ANSWER_INVALID"?"securityAnswer"'])
   assert.ok(source.includes(check),check);
 assert.ok(css.includes(".authForm .fieldError"));
});
test("pending approval rechecks only on real events with no overlapping refresh",()=>{
 for(const check of [
   'account.onboardingStage !== "active"',
   "if (document.hidden || lock.current) return",
   "if (refreshInFlight.current) { queuedAfterCurrent = true; return; }",
   "refreshInFlight.current = false",
   'window.addEventListener("boi:account:changed",refresh)',
   'window.addEventListener("online",refresh)',
   'action:"profile-draft-activate"',
   "attemptedAutoActivation.current.delete(key)",
   "accountServerActive(account, v2, observedNow)"])
   assert.ok(source.includes(check),check);
 assert.doesNotMatch(source,/needsApprovalPolling \? 20000 : 60000/);
});
test("approved UI still requires exact server-side entitlement and trusted device",()=>{
 const contract=fs.readFileSync(new URL("../app/account-lifecycle-client.ts",import.meta.url),"utf8");
 for(const check of ['account.status !== "approved"','account.onboardingStage === "active"',
   'account.deviceApproved === true','account.entitlementActive === true'])
   assert.ok(contract.includes(check),check);
});
test("unchanged manager invitation handling remains in account gate",()=>{
 for(const check of ['#manager-invite=',"managerInviteRef.current=invite",
   'managerInviteRef.current="";setManagerInvite("")'])
   assert.ok(source.includes(check),check);
});
