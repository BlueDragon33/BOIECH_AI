// Offline snapshot rehearsal only. No network, no source DB writes and no production/apply mode.
import * as sqliteApi from 'node:sqlite';
const {DatabaseSync} = sqliteApi;
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import ts from 'typescript';
const supplied=process.argv.slice(2);
if(supplied.length!==2||supplied[0]!=='--database'||/^[a-z]+:\/\//i.test(supplied[1]))throw new Error('Usage: node scripts/account-migration.mjs --database LOCAL_OFFLINE_SNAPSHOT.sqlite');
// Node 22.13 lacks node:sqlite.backup; VACUUM INTO provides a consistent disposable
// snapshot without mutating the read-only source database.
const source=new DatabaseSync(resolve(supplied[1]),{readOnly:true});
const directory=mkdtempSync(join(tmpdir(),'boiech-account-rehearsal-'));const path=join(directory,'clone.sqlite');let sqlite;
try{
 if(typeof sqliteApi.backup==='function')await sqliteApi.backup(source,path);
 else source.prepare('VACUUM INTO ?').run(path);
 source.close();sqlite=new DatabaseSync(path);sqlite.exec('PRAGMA foreign_keys=ON');
 function checkDatabase(){
  const integrity=sqlite.prepare('PRAGMA integrity_check').all();
  if(integrity.length!==1||Object.values(integrity[0])[0]!=='ok')throw new Error('SQLITE_INTEGRITY_CHECK_FAILED');
  if(sqlite.prepare('PRAGMA foreign_key_check').all().length)throw new Error('FOREIGN_KEY_CHECK_FAILED');
 }
 checkDatabase();
 const legacyTables=sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'account%' ORDER BY name").all().map(r=>r.name);
 function fingerprints(){return Object.fromEntries(legacyTables.map(name=>{
  const table='"'+name.replaceAll('"','""')+'"';
  const columns=sqlite.prepare('PRAGMA table_xinfo('+table+')').all().filter(column=>column.hidden!==1).map(column=>column.name);
  const projection=columns.flatMap((name,index)=>{
   const column='"'+name.replaceAll('"','""')+'"';
   // Preserve TEXT bytes inside SQLite, before Node performs UTF-8 decoding.
   return ['typeof('+column+') AS "t'+index+'"',
    'CASE WHEN typeof('+column+")='text' THEN hex(CAST("+column+' AS BLOB)) ELSE '+column+' END AS "v'+index+'"'];
  });
  const statement=sqlite.prepare('SELECT '+projection.join(',')+' FROM '+table);
  statement.setReadBigInts(true);
  // A sorted multiset handles WITHOUT ROWID tables and retains duplicate rows.
  // Tags preserve SQL value types without narrowing int64 or binary values.
  const rows=Array.from(statement.iterate(),row=>JSON.stringify(columns.map((name,index)=>{
   const value=row['v'+index];
   return [name,row['t'+index],typeof value==='bigint'?value.toString():value instanceof Uint8Array?Buffer.from(value).toString('base64'):Object.is(value,-0)?'-0':typeof value==='number'&&!Number.isFinite(value)?String(value):value];
  }))).sort();
  const hash=createHash('sha256');for(const row of rows)hash.update(row).update('\n');
  return [name,{count:rows.length,hash:hash.digest('hex')}];
 }))}
 const before=fingerprints();
 sqlite.exec(readFileSync(new URL('../drizzle/0018_account_first.sql',import.meta.url),'utf8'));
 function prepare(sql){let args=[];return {bind(...values){args=values;return this},async first(){return sqlite.prepare(sql).get(...args)??null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}},execute(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}}
 const db={prepare,async batch(queries){sqlite.exec('BEGIN IMMEDIATE');try{const result=queries.map(q=>q.execute());sqlite.exec('COMMIT');return result}catch(error){sqlite.exec('ROLLBACK');throw error}}};
 const loaded={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../app/account-core.server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const entitlement={exports:{}};const entitlementCode=ts.transpileModule(readFileSync(new URL('../app/account-entitlement.server.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',entitlementCode)(createRequire(import.meta.url),entitlement,entitlement.exports);
 new Function('require','module','exports',code)(name=>name==='./account-entitlement.server'?entitlement.exports:createRequire(import.meta.url)(name),loaded,loaded.exports);
 const service=new loaded.exports.AccountService(db);const report=await service.migrationReport();
 if(report.conflicts.length){process.stdout.write(JSON.stringify({mode:'LOCAL_SNAPSHOT_DRY_RUN',node:process.version,report,applied:false})+'\n');process.exitCode=2;}
 else{
  await service.backfill();const count=sqlite.prepare('SELECT count(*) AS count FROM accounts').get().count;
  await service.backfill();if(sqlite.prepare('SELECT count(*) AS count FROM accounts').get().count!==count)throw new Error('BACKFILL_NOT_IDEMPOTENT');
  const after=fingerprints();if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('LEGACY_DATA_CHANGED');
  checkDatabase();
  sqlite.close();sqlite=new DatabaseSync(path,{readOnly:true});
  checkDatabase();
  if(sqlite.prepare('SELECT count(*) AS count FROM accounts').get().count!==count)throw new Error('REOPEN_READBACK_FAILED');
  process.stdout.write(JSON.stringify({mode:'LOCAL_SNAPSHOT_DRY_RUN',node:process.version,report,mappedAccounts:count,legacyTables:legacyTables.length,legacyRowsUnchanged:true,idempotent:true,reopenReadback:true,integrityCheck:true,foreignKeyCheck:true,sourceUnmodified:true,rollback:'delete disposable clone; source snapshot unchanged'})+'\n');
 }
}finally{if(sqlite)sqlite.close();try{source.close()}catch{}rmSync(directory,{recursive:true,force:true})}
