import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import fs from "node:fs";
const ddl=fs.readFileSync(new URL("../drizzle/0036_phone_national_equality.sql",import.meta.url),"utf8");
function db(){
 const sqlite=new DatabaseSync(":memory:");
 sqlite.exec("CREATE TABLE device_access(device_id TEXT PRIMARY KEY,phone TEXT UNIQUE);");
 sqlite.exec(ddl);
 return sqlite;
}
test("National significant digits compare exactly, ignoring only international dialing prefix and national trunk",()=>{
 const d=db();
 try{
  const insert=d.prepare("INSERT INTO device_access(device_id,phone) VALUES(?,?)");
  insert.run("vietnam","+84 912 345 678");
  assert.throws(()=>insert.run("vn-alias","0912345678"),/PHONE_NATIONAL_DUPLICATE/);
  assert.throws(()=>insert.run("vn-dotted","0912.345.678"),/PHONE_NATIONAL_DUPLICATE/);
  insert.run("position-diff","0912345679");
  insert.run("length-diff","09123456780");
  insert.run("russia","+7 (999) 123-45-67");
  assert.throws(()=>insert.run("russia-alias","89991234567"),/PHONE_NATIONAL_DUPLICATE/);
  insert.run("russia-shift","89991234568");
  insert.run("germany","+49 30 12345678");
  assert.throws(()=>insert.run("germany-alias","03012345678"),/PHONE_NATIONAL_DUPLICATE/);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM device_access").get().n,6);
 }finally{d.close();}
});
test("An existing legacy collision does not block installing guards, but new collisions are rejected",()=>{
 const d=new DatabaseSync(":memory:");
 try{
  d.exec("CREATE TABLE device_access(device_id TEXT PRIMARY KEY,phone TEXT UNIQUE);");
  d.prepare("INSERT INTO device_access(device_id,phone) VALUES(?,?)").run("one","+84912345678");
  d.prepare("INSERT INTO device_access(device_id,phone) VALUES(?,?)").run("two","0912345678");
  d.exec(ddl);
  assert.throws(()=>d.prepare("INSERT INTO device_access(device_id,phone) VALUES(?,?)").run("third","912345678"),/PHONE_NATIONAL_DUPLICATE/);
  assert.equal(d.prepare("SELECT COUNT(*) n FROM device_access").get().n,2);
 }finally{d.close();}
});
test("A phone update cannot acquire another account's exact national number",()=>{
 const d=db();
 try{
  const i=d.prepare("INSERT INTO device_access(device_id,phone) VALUES(?,?)");
  i.run("one","+84912345678");i.run("two",null);
  assert.throws(()=>d.prepare("UPDATE device_access SET phone=? WHERE device_id='two'").run("0912345678"),/PHONE_NATIONAL_DUPLICATE/);
  assert.equal(d.prepare("SELECT phone FROM device_access WHERE device_id='two'").get().phone,null);
 }finally{d.close();}
});
