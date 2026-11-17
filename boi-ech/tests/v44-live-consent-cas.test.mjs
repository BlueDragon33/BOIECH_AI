import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";

// This exercises the exact AI approval predicate embedded in the canonical
// assign-person UPDATE, not a copied approximation of the SQL guard.
test("V44 P0: atomic AI apply denies a withdrawn/expired source after prior approval",t=>{
 const source=readFileSync("app/training-management.server.ts","utf8");
 const match=source.match(/const aiGuard=aiApproval\?\`([\s\S]*?)\`:"";/);
 assert.ok(match,"Canonical SQL aiGuard must exist");
 const guard=match[1];
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());
 db.exec(`
  CREATE TABLE device_access(device_id TEXT PRIMARY KEY,class_name TEXT);
  CREATE TABLE training_ai_proposals(proposal_id TEXT PRIMARY KEY,person_id TEXT,class_id TEXT,
    kind TEXT,state TEXT,revision INTEGER,source_fingerprint TEXT);
  CREATE TABLE training_ai_proposal_applications(proposal_id TEXT PRIMARY KEY);
  CREATE TABLE training_ai_profile_submissions(device_id TEXT PRIMARY KEY,role TEXT,
    state TEXT,consent_at TEXT,revision INTEGER,verified_revision INTEGER,valid_until TEXT);
  CREATE TABLE training_resources(id TEXT PRIMARY KEY,kind TEXT,status TEXT);
  CREATE TABLE training_ai_class_safety_attestations(class_id TEXT PRIMARY KEY,valid_until TEXT);
  INSERT INTO device_access VALUES('L1','Chưa phân lớp');
  INSERT INTO training_ai_proposals VALUES('learner:C1:L1','L1','C1','learner','approved',2,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  INSERT INTO training_ai_profile_submissions VALUES('L1','learner','verified',
    '2026-11-17T11:00:00Z',1,1,'2999-01-01T00:00:00Z');
  INSERT INTO training_resources VALUES('C1','class','active');
  INSERT INTO training_ai_class_safety_attestations VALUES('C1','2999-01-01T00:00:00Z');
 `);
 const params=['learner:C1:L1','L1','C1','learner',2,'a'.repeat(64),
  'learner:C1:L1','L1','learner','C1'];
 function apply(){
  const result=db.prepare("UPDATE device_access SET class_name='Class A' "+
   "WHERE device_id='L1' AND class_name='Chưa phân lớp' "+guard).run(...params);
  db.prepare("UPDATE device_access SET class_name='Chưa phân lớp' WHERE device_id='L1'").run();
  return result.changes;
 }
 assert.equal(apply(),1,"Valid approved live data may still apply");
 db.exec("UPDATE training_ai_profile_submissions SET state='withdrawn',consent_at=NULL,revision=revision+1");
 assert.equal(apply(),0,"Withdrawal must veto the final write, not only preflight");
 db.exec("UPDATE training_ai_profile_submissions SET state='verified',consent_at='2026-11-17T11:00:00Z'");
 assert.equal(apply(),0,"Revision changed after approval cannot use old verification");
 db.exec("UPDATE training_ai_profile_submissions SET verified_revision=revision,valid_until='2000-01-01T00:00:00Z'");
 assert.equal(apply(),0,"Expired verified profile must deny");
 db.exec("UPDATE training_ai_profile_submissions SET valid_until='2999-01-01T00:00:00Z'");
 assert.equal(apply(),1,"Restored valid proof may pass");
 db.exec("UPDATE training_ai_class_safety_attestations SET valid_until='2000-01-01T00:00:00Z'");
 assert.equal(apply(),0,"Expired pool attestation must deny");
 db.exec("UPDATE training_ai_class_safety_attestations SET valid_until='2999-01-01T00:00:00Z'");
 db.exec("UPDATE training_resources SET status='archived'");
 assert.equal(apply(),0,"Archived class must deny");
});
