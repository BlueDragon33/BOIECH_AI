import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const read=name=>readFileSync(new URL("../app/"+name,import.meta.url),"utf8");
const manager=read("manager-details.tsx"), managerCss=read("manager-workspace.module.css");
const accountCss=read("account-profile-dialog.module.css"),account=read("account-profile-dialog.tsx");
const campus=read("manager-command-center.tsx"),campusCss=read("manager-command-center.module.css");
const roleCss=read("modal-contrast-v9.css"),page=read("page.tsx"),layout=read("layout.tsx");

function actualPalette(){
 const start=page.indexOf("function colorLuminance("),end=page.indexOf("function InstallAppButton(",start);
 assert.ok(start>=0&&end>start,"actual WCAG helper must exist in page.tsx");
 const js=ts.transpileModule(page.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
 return vm.runInNewContext(js+"\n({colorLuminance,contrastRatio,darkBackground,readableForeground})");
}
test("manager personnel native dialog centers at any viewport and restores focus",()=>{
 assert.match(manager,/el\.showModal\(\)/);
 assert.match(manager,/previous\.focus\(\)/);
 assert.match(managerCss,/\.sheet\{\s*position:fixed!important;inset:0!important;margin:auto!important/);
 assert.match(managerCss,/max-height:calc\(100dvh - 36px\)!important/);
 assert.doesNotMatch(managerCss,/\.sheet\{position:fixed;inset:auto 0 0/);
});
test("personal account dialog remains center on mobile and traps focus",()=>{
 assert.match(account,/createPortal\(<div className=\{styles\.backdrop\}/);
 assert.match(account,/aria-modal="true"/);
 assert.match(account,/priorFocus\.current\?\.focus\(\)/);
 assert.match(accountCss,/align-items:center;justify-items:center/);
 assert.match(accountCss,/place-items:center!important/);
 assert.doesNotMatch(accountCss,/align-items:end|border-radius:22px 22px 0 0/);
});
test("manager class and teacher learner dialogs are centered not docked",()=>{
 assert.match(campus,/aria-modal="true"/);
 assert.match(campusCss,/\.classModalBackdrop\{position:fixed;inset:0;z-index:2147483200;display:grid;place-items:center/);
 assert.match(roleCss,/\.teacher-drawer-backdrop\{\s*position:fixed!important;inset:0!important/);
 assert.match(roleCss,/\.teacher-learner-drawer\{\s*width:min\(700px,100%\)!important/);
 assert.match(roleCss,/height:auto!important/);
});
test("appearance, teacher actions and notes center with bounded internal scrolling",()=>{
 assert.match(roleCss,/\.appearance-panel\{\s*position:fixed!important/);
 assert.match(roleCss,/inset:50% auto auto 50%!important/);
 assert.match(roleCss,/transform:translate\(-50%,-50%\)!important/);
 assert.match(roleCss,/max-height:calc\(100dvh - 28px\)!important/);
 assert.match(roleCss,/\.teacher-action-backdrop,\.teacher-note-backdrop\{/);
 assert.match(roleCss,/max-height:calc\(100dvh - 30px\)!important/);
 assert.match(page,/previousFocus\.focus\(\)/);
 assert.ok(layout.indexOf('import "./modal-contrast-v9.css"')>layout.indexOf('import "./role-readable-v9.css"'));
});
test("real custom appearance palettes meet WCAG 4.5:1 for normal text",()=>{
 const {readableForeground,contrastRatio,colorLuminance,darkBackground}=actualPalette();
 assert.equal(colorLuminance("#000000"),0);
 assert.equal(colorLuminance("#ffffff"),1);
 assert.equal(colorLuminance("transparent"),null);
 assert.ok(darkBackground("#11234a"));
 const palettes=[
 ["#f4fbfb","#102b3f"],["#cee2e4","#5d7282"],
 ["#f4fbfb","#123b61"],["#bad0da","#657d8d"],
 ["#f4fbfb","#173c5e"],["#bdd0da","#718899"]
 ];
 const backgrounds=["#ffffff","#000000","#777777","#808080","#99bce8","#62a4ba",
 "#1a366f","#133b53","#f0efe7","#bd9962","#eceaf3","#123450"];
 for(const bg of backgrounds) for(const [light,dark] of palettes){
  const ink=readableForeground(bg,light,dark);
  assert.ok(contrastRatio(ink,bg)>=4.5,"Failed contrast "+ink+"/"+bg);
 }
 for(const key of ["page-ink","page-muted","content-ink","content-muted","card-ink","card-muted"]){
  assert.ok(page.includes('"--'+key+'": readableForeground('),key);
 }
});
test("all important modals are explicitly readable in both color schemes",()=>{
 assert.match(managerCss,/\.sheetBody small,\.sheetBody \.metricDetail,\.detailRow small/);
 assert.match(accountCss,/\.main\{background:#f6faff!important;color:#152e4e!important\}/);
 assert.match(roleCss,/\.teacher-rail-card\{\s*background:#112e4d!important/);
 assert.match(roleCss,/\.teacher-page \.teacher-table td\{\s*background:var\(--card-background,#fff\)!important/);
 assert.match(roleCss,/\.appearance-panel\{[\s\S]*?background:#f7fbff!important/);
});
test("named premium text/background pairs pass AA contrast",()=>{
 const {contrastRatio}=actualPalette();
 for(const [ink,bg] of [
 ["#f3f7ff","#182d5d"],["#bdd0f4","#182d5d"],["#d1e5ff","#25365d"],
 ["#152e4e","#f6faff"],["#4b6077","#f6faff"],
 ["#edf7ff","#102a52"],["#d7eafb","#112e4d"],
 ["#183550","#ffffff"],["#435e73","#f7fbff"]
 ])assert.ok(contrastRatio(ink,bg)>=4.5,"WCAG below AA "+ink+"/"+bg);
});

test("Multi-account switcher remains centered with readable formerly faint labels",()=>{
 const css=source("multi-account-switcher.css");
 assert.match(css,/\.multi-account-overlay\s*\{[\s\S]*?place-items:\s*center/);
 assert.match(roleCss,/\.multi-account-dialog\{\s*max-width:calc\(100vw - 20px\)!important/);
 assert.match(roleCss,/\.multi-account-copy small,\.multi-account-copy em,\.multi-account-add small\{/);
 assert.match(roleCss,/color:#435d72!important/);
 assert.match(roleCss,/font-size:calc\(12px \+ var\(--font-adjust,0px\)\)!important/);
 assert.match(roleCss,/\.multi-account-dialog header span\{color:#075c6a!important\}/);
});

test("WCAG fallback uses real black/white, avoiding the medium gray failure",()=>{
 const {readableForeground,contrastRatio}=actualPalette();
 assert.match(page,/contrastRatio\("#000000", background\)/);
 for(const bg of ["#777777","#808080","#858585","#999999"]){
  for(const ink of [["#f4fbfb","#102b3f"],["#bdd0da","#718899"]]){
   const selected=readableForeground(bg,...ink);
   assert.ok(contrastRatio(selected,bg)>=4.5);
  }
 }
});
