import {randomBytes,createHash} from "node:crypto";
import type {D1Database} from "@cloudflare/workers-types";
import {AccountError,AccountService,deviceKeyId,hashPassword,verifyPassword,hashSecurityAnswer,verifySecurityAnswer} from "./account-core.server";

const fail=(code:string,status=403):never=>{throw new AccountError(code,status)};
const QUESTION="Tên lúc nhỏ của bạn là gì?";
const loginName=(input:unknown)=>{
  if(typeof input!=="string"||! /^[a-z0-9][a-z0-9._-]{2,63}$/.test(input.trim().toLowerCase()))fail("ACCOUNT_INPUT",400);
  return input.trim().toLowerCase();
};
const nonce=()=>randomBytes(32).toString("base64url");

type QuestionRow={account_id:string;storage_device_id:string;public_key_jwk:string;
  answer_verifier:string;generation:number;question_revision:number};
export class AccountSecurityQuestionService{
  constructor(private db:D1Database,private accounts:AccountService){}
  async status(token:string){
    const principal=await this.accounts.session(token);
    if(!principal.deviceApproved)fail("DEVICE_APPROVAL_REQUIRED");
    const row=await this.db.prepare("SELECT 1 AS configured FROM account_recovery_questions WHERE account_id=?")
      .bind(principal.accountId).first<{configured:number}>();
    return {question:QUESTION,configured:!!row};
  }
  async change(token:string,password:unknown,answer:unknown){
    const principal=await this.accounts.authorize(token);
    const credential=await this.db.prepare("SELECT password_verifier FROM account_credentials WHERE account_id=?")
      .bind(principal.accountId).first<{password_verifier:string}>();
    if(!credential||!await verifyPassword(password,credential.password_verifier))fail("AUTH_FAILED",401);
    const verifier=await hashSecurityAnswer(answer);
    const results=await this.db.batch([
      this.db.prepare(`INSERT INTO account_recovery_questions(account_id,answer_verifier)
        SELECT ?,? WHERE EXISTS(
          SELECT 1 FROM account_sessions s
          JOIN account_devices b ON b.account_id=s.account_id AND b.device_id=s.device_id
          JOIN account_credentials c ON c.account_id=s.account_id AND c.generation=s.generation
          JOIN account_onboarding o ON o.account_id=s.account_id
          WHERE s.account_id=? AND s.token_hash=? AND s.device_id=?
          AND s.revoked=0 AND b.revoked=0 AND b.approved=1 AND o.stage='active'
          AND s.expires_at>(julianday('now')-2440587.5)*86400000
          AND s.idle_expires_at>(julianday('now')-2440587.5)*86400000
        ) ON CONFLICT(account_id) DO UPDATE SET
           answer_verifier=excluded.answer_verifier,revision=revision+1,updated_at=CURRENT_TIMESTAMP`)
        .bind(principal.accountId,verifier,principal.accountId,principal.sessionHash,principal.deviceId),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        VALUES(?,'account.security.answer.changed',?,CASE WHEN changes()=1
          THEN 'self-service reauthenticated answer rotation; old answer never exposed' ELSE NULL END)`)
        .bind(principal.accountId,principal.accountId)
    ]).catch(()=>fail("ACCOUNT_CAS_CONFLICT",409));
    if(Number(results[0].meta.changes)!==1)fail("ACCOUNT_CAS_CONFLICT",409);
    return {question:QUESTION,configured:true};
  }
  // The challenge response is indistinguishable for registered and unknown IDs.
  // A signed proof from the ORIGINAL trusted P-256 browser is mandatory.
  async challenge(loginInput:unknown,peer:string){
    const login=loginName(loginInput);
    await this.accounts.limitSecurityRecoveryAttempt(login,peer,"challenge");
    const challenge=nonce();
    const row=await this.db.prepare(`SELECT a.storage_device_id
      FROM accounts a JOIN account_recovery_questions q ON q.account_id=a.account_id
      WHERE a.login=?`).bind(login).first<{storage_device_id:string}>();
    if(row){
      await this.db.prepare("INSERT INTO device_challenges(nonce,device_id,expires_at) VALUES(?,?,?)")
        .bind(challenge,row.storage_device_id,Date.now()+120000).run();
    }
    return {challenge,expiresInSeconds:120,question:QUESTION,requiresOriginalTrustedDevice:true};
  }
  async recover(input:Record<string,unknown>,peer:string){
    const login=loginName(input.login);
    await this.accounts.limitSecurityRecoveryAttempt(login,peer,"recover");
    const challenge=typeof input.challenge==="string"?input.challenge:"";
    const signature=typeof input.signature==="string"?input.signature:"";
    if(!/^[A-Za-z0-9_-]{40,50}$/.test(challenge)||!/^[A-Za-z0-9_-]{80,200}$/.test(signature))
      fail("AUTH_FAILED",401);
    const row=await this.db.prepare(`SELECT a.account_id,a.storage_device_id,d.public_key_jwk,
       q.answer_verifier,c.generation,q.revision AS question_revision
      FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_credentials c ON c.account_id=a.account_id
      JOIN account_recovery_questions q ON q.account_id=a.account_id
      WHERE a.login=?`).bind(login).first<QuestionRow>();
    if(!row)fail("AUTH_FAILED",401);
    // Consume the nonce once, before answer verification. Failed attempts cannot replay.
    const consumed=await this.db.prepare(`DELETE FROM device_challenges
      WHERE nonce=? AND device_id=? AND expires_at>?`)
      .bind(challenge,row.storage_device_id,Date.now()).run();
    if(Number(consumed.meta.changes)!==1)fail("AUTH_FAILED",401);
    const answerValid=await verifySecurityAnswer(input.securityAnswer,row.answer_verifier);
    let keyValid=false,deviceId="";
    try{
      const jwk=JSON.parse(row.public_key_jwk) as JsonWebKey;
      deviceId=await deviceKeyId(jwk);
      const trusted=await this.db.prepare(`SELECT 1 AS ok FROM account_devices
        WHERE account_id=? AND device_id=? AND approved=1 AND revoked=0`)
        .bind(row.account_id,deviceId).first<{ok:number}>();
      if(trusted){
        const key=await crypto.subtle.importKey("jwk",
          {kty:"EC",crv:"P-256",x:jwk.x!,y:jwk.y!},
          {name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
        keyValid=await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,
          Buffer.from(signature,"base64url"),
          new TextEncoder().encode(`boi-ech:recover:${login}:${challenge}`));
      }
    }catch{keyValid=false;}
    if(!answerValid||!keyValid)fail("AUTH_FAILED",401);
    const verifier=await hashPassword(input.password),nextCode=randomBytes(32).toString("hex");
    const result=await this.db.batch([
      this.db.prepare(`UPDATE account_credentials
        SET password_verifier=?,recovery_hash=?,generation=generation+1,updated_at=CURRENT_TIMESTAMP
        WHERE account_id=? AND generation=?
        AND EXISTS(SELECT 1 FROM account_recovery_questions q
          WHERE q.account_id=? AND q.revision=? AND q.answer_verifier=?)
        AND EXISTS(SELECT 1 FROM account_devices b
          WHERE b.account_id=? AND b.device_id=? AND b.approved=1 AND b.revoked=0)`)
        .bind(verifier,createHash("sha256").update(nextCode).digest("hex"),
          row.account_id,row.generation,row.account_id,row.question_revision,row.answer_verifier,row.account_id,deviceId),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        VALUES(?,'credential.recovered.question',?,CASE WHEN changes()=1
          THEN 'hashed childhood answer + original trusted P256 proof' ELSE NULL END)`)
        .bind(row.account_id,row.account_id),
      this.db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=? AND generation<=?")
        .bind(row.account_id,row.generation),
    ]).catch(()=>fail("AUTH_FAILED",401));
    if(Number(result[0].meta.changes)!==1)fail("AUTH_FAILED",401);
    return {recoveryCode:nextCode,accountId:row.account_id};
  }
}
