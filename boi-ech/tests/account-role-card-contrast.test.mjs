import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css=readFileSync(new URL("../app/account-gate.module.css",import.meta.url),"utf8");
const globalCss=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
const component=readFileSync(new URL("../app/registration-roles.tsx",import.meta.url),"utf8");
function luminance(hex){
 const [r,g,b]=hex.replace("#","").match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return r*.2126+g*.7152+b*.0722;
}
function contrast(a,b){
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test("existing role picker uses authenticated light-theme foreground for every state",()=>{
 assert.match(globalCss,/\.person-role-field label\.selected \{[^}]*color: #fff/);
 assert.match(css,/\.authRoot :global\(\.person-role-field label\.selected b\)\{color:#123d48/);
 assert.match(css,/\.authRoot :global\(\.person-role-field label\.selected small\)\{color:#3f6570/);
 assert.match(css,/\.authRoot :global\(\.person-role-field label\),/);
 assert.match(css,/\.authRoot :global\(\.person-role-field label:focus-within\)/);
 assert.match(component,/value===role\.id\?"selected":""/);
 assert.match(component,/type="radio"/);
});
test("light role labels pass WCAG AA contrast for both selected and idle cards",()=>{
 for (const bg of ["#fbfdfe","#e1f8f4"]) {
  for(const fg of ["#123d48","#3f6570"])
   assert.ok(contrast(fg,bg)>=4.5,fg+" on "+bg+" does not meet 4.5:1 contrast");
 }
});
