import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { AccountEntitlementService } from "./account-entitlement.server";

// Standard OpenSSL scrypt, OWASP's N=2^15/r=8/p=3 profile. No reversible password storage.
const KDF = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const SESSION_MS = 8 * 60 * 60 * 1000;
const IDLE_MS = 30 * 60 * 1000;
const TOKEN = /^[a-f0-9]{64}$/;
const ACCOUNT = /^acc_[a-f0-9]{64}$/;
export const ACCOUNT_COOKIE = "__Host-boiech-session";
export class AccountError extends Error {
  constructor(public code: string, public status = 403) { super(code); this.name = "AccountError"; }
}
function fail(code: string, status = 403): never { throw new AccountError(code, status); }
function bounded(value: unknown, max: number, code = "ACCOUNT_INPUT"): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) fail(code, 400);
  return value.trim().normalize("NFC");
}
function loginName(value: unknown) {
  const name = bounded(value, 64).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(name)) fail("ACCOUNT_INPUT", 400);
  return name;
}
function checkPassword(value: unknown): string {
  if (typeof value !== "string" || [...value].length < 15 || value.length > 1024) fail("PASSWORD_POLICY", 400);
  return value;
}
const random = () => randomBytes(32).toString("hex");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, Buffer.from(salt, "hex"), 32, KDF,
    (error, key) => error ? reject(new AccountError("PASSWORD_KDF_UNAVAILABLE", 503)) : resolve(key)));
}
export async function hashPassword(password: unknown) {
  const input = checkPassword(password), salt = randomBytes(16).toString("hex");
  return `scrypt$32768$8$3$${salt}$${(await derive(input, salt)).toString("hex")}`;
}
export async function verifyPassword(password: unknown, verifier: string) {
  const match = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(verifier);
  if (typeof password !== "string" || password.length > 1024 || !match) return false;
  const actual = await derive(password, match[1]);
  return timingSafeEqual(actual, Buffer.from(match[2], "hex"));
}
export async function deviceKeyId(value: unknown) {
  if (!value || typeof value !== "object") fail("DEVICE_KEY_INVALID", 400);
  const k = value as JsonWebKey;
  if (k.kty !== "EC" || k.crv !== "P-256" || !k.x || !k.y || k.d) fail("DEVICE_KEY_INVALID", 400);
  await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: k.x, y: k.y }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return digest(JSON.stringify({ kty: "EC", crv: "P-256", x: k.x, y: k.y }));
}
function publicKeyJson(value: unknown) {
  const k = value as JsonWebKey;
  return JSON.stringify({ kty: "EC", crv: "P-256", x: k.x, y: k.y });
}
type Row = { account_id: string; storage_device_id: string; login: string | null; revision: number;
  status: string; person_role: string; person_code: string; learner_name: string; class_name: string;
  phone: string; payment_status: string; access_group: string; access_expires_at: string | null; management_enabled: number };
export type AccountView = { accountId: string; storageDeviceId: string; login: string | null; revision: number;
  status: string; role: string; name: string; personCode: string; className: string; expiresAt: string | null };
export type Principal = AccountView & { deviceId: string; sessionHash: string; generation: number; absoluteExpiry: number; deviceApproved: boolean };
const COLUMNS = `a.account_id,a.storage_device_id,a.login,a.revision,d.status,d.person_role,d.person_code,
 d.learner_name,d.class_name,d.phone,d.payment_status,d.access_group,d.access_expires_at,d.management_enabled`;
function view(row: Row): AccountView {
  return { accountId: row.account_id, storageDeviceId: row.storage_device_id, login: row.login, revision: row.revision,
    status: row.status, role: row.person_role, name: row.learner_name, personCode: row.person_code,
    className: row.class_name, expiresAt: row.access_expires_at };
}
export class AccountService {
  constructor(private db: D1Database, private now: () => number = Date.now, private v2Enabled = false) {}
  private audit(actor: string, action: string, target: string, purpose: string, conditional = false) {
    return this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose) SELECT ?,?,?,?${conditional ? " WHERE changes()=1" : ""}`)
      .bind(actor, action, target, purpose);
  }
  private async approvalExpiry() {
    const policy=await this.db.prepare("SELECT default_access_days FROM access_automation_settings WHERE id='global'")
      .first<{default_access_days:number}>();
    if(!policy||!Number.isInteger(policy.default_access_days)||policy.default_access_days<1||policy.default_access_days>365)
      fail("ACCOUNT_ACCESS_POLICY_UNAVAILABLE",503);
    return new Date(this.now()+policy.default_access_days*86400000).toISOString();
  }
  private async row(id: string) {
    if (!ACCOUNT.test(id)) fail("ACCOUNT_INPUT", 400);
    const row = await this.db.prepare(`SELECT ${COLUMNS} FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id WHERE a.account_id=?`)
      .bind(id).first<Row>();
    if (!row) fail("ACCOUNT_NOT_FOUND", 404);
    return row;
  }
  async ownerRead(id: string) {
    const row = await this.row(id);
    const caps = await this.db.prepare("SELECT scope,enabled,expires_at FROM account_manager_permissions WHERE account_id=? ORDER BY scope").bind(id)
      .all<{ scope: string; enabled: number; expires_at: number | null }>();
    const entitlement = this.v2Enabled ? await new AccountEntitlementService(this.db,this.now).read(id) : null;
    const onboarding = this.v2Enabled ? await this.db.prepare(
      "SELECT stage,revision,last_review_note FROM account_onboarding WHERE account_id=?").bind(id)
      .first<{stage:string;revision:number;last_review_note:string|null}>() : null;
    return { ...view(row), onboardingStage: onboarding?.stage??null, onboardingRevision: onboarding?.revision??null,
      reviewNote: onboarding?.last_review_note??null,
      entitlement,
      permissions: (caps.results ?? []).map(p => ({ scope: p.scope, configured: p.enabled === 1,
      effective: p.enabled === 1 && (!p.expires_at || p.expires_at > this.now()) && row.status === "approved" && row.management_enabled === 1 &&
        (!row.access_expires_at || Date.parse(row.access_expires_at) > this.now()) && (!this.v2Enabled || entitlement?.active === true), expiresAt: p.expires_at })) };
  }
  async ownerList() {
    const result = await this.db.prepare(`SELECT a.account_id FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      WHERE d.person_role='manager' ORDER BY a.account_id LIMIT 101`).all<{ account_id: string }>();
    if ((result.results?.length ?? 0) > 100) fail("ACCOUNT_RESULT_LIMIT", 413);
    return Promise.all((result.results ?? []).map(r => this.ownerRead(r.account_id)));
  }
  private async throttle(login: string, peer: string, kind: string, maximum = 6) {
    const now = this.now(), window = 15 * 60 * 1000;
    // Account-wide and source-wide buckets. Unknown accounts follow exactly the same path.
    const keys = [digest(`${kind}:login:${login}`), digest(`${kind}:peer:${peer}`)];
    const statements = keys.map(key => this.db.prepare(`INSERT INTO account_auth_limits(bucket,window_start,attempts) VALUES(?,?,1)
      ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END,
      window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END`)
      .bind(key, now, now - window, now - window));
    await this.db.batch(statements);
    for (const key of keys) {
      const row = await this.db.prepare("SELECT attempts FROM account_auth_limits WHERE bucket=?").bind(key).first<{ attempts: number }>();
      if (!row || row.attempts > maximum) fail("RATE_LIMITED", 429);
    }
  }
  private async issue(accountId: string, publicKey: unknown, expectedGeneration?: number) {
    const deviceId = await deviceKeyId(publicKey), token = random(), now = this.now();
    const credential = await this.db.prepare("SELECT generation FROM account_credentials WHERE account_id=?").bind(accountId).first<{ generation: number }>();
    if (!credential || (expectedGeneration !== undefined && credential.generation !== expectedGeneration)) fail("AUTH_FAILED", 401);
    const existing = await this.db.prepare("SELECT revoked FROM account_devices WHERE account_id=? AND device_id=?").bind(accountId, deviceId).first<{ revoked: number }>();
    if (existing?.revoked) fail("DEVICE_REVOKED", 403);
    // A new key is pending owner confirmation; only the first key of an entirely new account
    // is trusted at signup. Existence is evaluated inside the D1 write transaction.
    const deviceInsert = this.v2Enabled
      ? this.db.prepare(`INSERT INTO account_devices(account_id,device_id,public_key_jwk,approved)
          SELECT ?,?,?,CASE WHEN NOT EXISTS(SELECT 1 FROM account_devices WHERE account_id=?) THEN 1 ELSE 0 END
          WHERE 1 ON CONFLICT(account_id,device_id) DO NOTHING`)
          .bind(accountId, deviceId, publicKeyJson(publicKey), accountId)
      : this.db.prepare(`INSERT INTO account_devices(account_id,device_id,public_key_jwk) VALUES(?,?,?)
          ON CONFLICT(account_id,device_id) DO NOTHING`).bind(accountId, deviceId, publicKeyJson(publicKey));
    const statements = [deviceInsert];
    statements.push(this.db.prepare(`INSERT INTO account_sessions(token_hash,account_id,device_id,generation,expires_at,idle_expires_at)
      SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM account_credentials WHERE account_id=? AND generation=?)
       AND EXISTS(SELECT 1 FROM account_devices WHERE account_id=? AND device_id=? AND revoked=0)`)
      .bind(digest(token), accountId, deviceId, credential.generation, now + SESSION_MS, now + IDLE_MS,
        accountId, credential.generation, accountId, deviceId));
    statements.push(this.audit(accountId, "session.created", deviceId, "authenticated login", true));
    const result = await this.db.batch(statements).catch(error => {
      // D1 quota triggers are the final authority; the earlier read is only UX.
      if (error instanceof Error && error.message.includes("ACCOUNT_DEVICE_LIMIT_REACHED")) fail("DEVICE_LIMIT_REACHED", 409);
      throw error;
    });
    if (Number(result[1].meta.changes) !== 1) fail("SESSION_CONFLICT", 409);
    return { token, deviceId, account: view(await this.row(accountId)) };
  }
  async register(input: Record<string, unknown>, peer: string) {
    const login = loginName(input.login);
    await this.throttle(login, peer, "register", 5);
    if (input.privacyAccepted !== true || !["learner", "manager", "teacher"].includes(String(input.role))) fail("ACCOUNT_INPUT", 400);
    if (this.v2Enabled) return this.registerV2(input, login);
    const role = String(input.role), code = bounded(input.personCode, 32).toUpperCase();
    const rawPhone = bounded(input.phone, 32).replace(/[ ()-]/g, "");
    const phone = rawPhone.startsWith("+84") ? "0" + rawPhone.slice(3) : rawPhone;
    const family = bounded(input.familyName, 60), given = bounded(input.givenName, 60), className = bounded(input.className, 80);
    if (!/^[A-Z0-9._-]+$/.test(code) || !/^[+0-9 ()-]{7,32}$/.test(phone)) fail("ACCOUNT_INPUT", 400);
    const keyId = await deviceKeyId(input.publicKey), password = await hashPassword(input.password);
    const accountId = "acc_" + random(), storageId = random(), recoveryCode = random();
    // Storage anchor is independent of login-device keys. Existing foreign-key consumers remain untouched.
    try {
      await this.db.batch([
        this.db.prepare(`INSERT INTO device_access(device_id,display_code,public_key_jwk,status,person_role,person_code,phone,
          learner_name,learner_family_name,learner_given_name,class_name,registration_submitted_at,management_enabled)
          VALUES(?,?,?,'pending',?,?,?,?,?,?,?,CURRENT_TIMESTAMP,0)`)
          .bind(storageId, "BE-" + storageId.slice(0, 16).toUpperCase(), publicKeyJson(input.publicKey), role, code, phone, family + " " + given, family, given, className),
        this.db.prepare("INSERT INTO device_profiles(device_id) VALUES(?)").bind(storageId),
        this.db.prepare("INSERT INTO accounts(account_id,storage_device_id,login) VALUES(?,?,?)").bind(accountId, storageId, login),
        this.db.prepare("INSERT INTO account_credentials(account_id,password_verifier,recovery_hash) VALUES(?,?,?)").bind(accountId, password, digest(recoveryCode)),
        this.audit(accountId, "registration.submitted", accountId, "visible registration privacy notice accepted"),
      ]);
    } catch (error) {
      // Distinguish a full account roster from a duplicate identity without exposing others' data.
      if (error instanceof Error && error.message.includes("ACCOUNT_CAPACITY_REACHED")) fail("ACCOUNT_CAPACITY_REACHED", 409);
      if (error instanceof Error && error.message.includes("ACCOUNT_ROLE_OR_POLICY_MISSING")) fail("ACCOUNT_POLICY_UNAVAILABLE", 503);
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) fail("REGISTRATION_UNAVAILABLE", 409);
      throw error;
    }
    const issued = await this.issue(accountId, input.publicKey);
    if (issued.deviceId !== keyId) fail("DEVICE_KEY_INVALID", 400);
    return { ...issued, recoveryCode };
  }
  private async registerV2(input: Record<string, unknown>, login: string) {
    const role = String(input.role), keyId = await deviceKeyId(input.publicKey);
    const verifier = await hashPassword(input.password), accountId = "acc_" + random();
    const storageId = random(), recoveryCode = random();
    try {
      await this.db.batch([
        this.db.prepare(`INSERT INTO device_access(device_id,display_code,public_key_jwk,status,
          person_role,registration_submitted_at,management_enabled)
          VALUES(?,?,?,'pending',?,CURRENT_TIMESTAMP,0)`)
          .bind(storageId, "BE-"+storageId.slice(0,16).toUpperCase(), publicKeyJson(input.publicKey), role),
        this.db.prepare("INSERT INTO device_profiles(device_id) VALUES(?)").bind(storageId),
        this.db.prepare("INSERT INTO accounts(account_id,storage_device_id,login) VALUES(?,?,?)").bind(accountId,storageId,login),
        this.db.prepare("INSERT INTO account_credentials(account_id,password_verifier,recovery_hash) VALUES(?,?,?)")
          .bind(accountId,verifier,digest(recoveryCode)),
        this.audit(accountId, "registration.requested.v2", accountId, "profile only after first review"),
      ]);
    } catch(error) {
      if(error instanceof Error && error.message.includes("ACCOUNT_CAPACITY_REACHED")) fail("ACCOUNT_CAPACITY_REACHED",409);
      if(error instanceof Error && /UNIQUE|constraint/i.test(error.message)) fail("REGISTRATION_UNAVAILABLE",409);
      throw error;
    }
    const issued=await this.issue(accountId,input.publicKey);
    if(issued.deviceId!==keyId) fail("DEVICE_KEY_INVALID",400);
    return { ...issued, recoveryCode };
  }
  async login(input: Record<string, unknown>, peer: string) {
    const login = loginName(input.login);
    await this.throttle(login, peer, "login");
    const row = await this.db.prepare(`SELECT a.account_id,c.password_verifier,c.generation FROM accounts a
      JOIN account_credentials c ON c.account_id=a.account_id WHERE a.login=?`).bind(login)
      .first<{ account_id: string; password_verifier: string; generation: number }>();
    // The unknown-account path performs the same KDF cost. Neither response reveals existence/status.
    const dummy = `scrypt$32768$8$3$${"0".repeat(32)}$${"0".repeat(64)}`;
    const valid = await verifyPassword(input.password, row?.password_verifier ?? dummy);
    if (!row || !valid) fail("AUTH_FAILED", 401);
    // Generation is rechecked after the expensive KDF so reset cannot race a login.
    const current = await this.db.prepare("SELECT generation FROM account_credentials WHERE account_id=?").bind(row.account_id).first<{ generation: number }>();
    if (current?.generation !== row.generation) fail("AUTH_FAILED", 401);
    return this.issue(row.account_id, input.publicKey, row.generation);
  }
  async session(token: string): Promise<Principal> {
    if (!TOKEN.test(token)) fail("SESSION_REQUIRED", 401);
    const now = this.now();
    const row = await this.db.prepare(`SELECT ${COLUMNS},s.device_id,s.generation,s.expires_at${this.v2Enabled ? ",b.approved AS device_approved" : ""} FROM account_sessions s
      JOIN accounts a ON a.account_id=s.account_id JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_devices b ON b.account_id=s.account_id AND b.device_id=s.device_id
      JOIN account_credentials c ON c.account_id=s.account_id AND c.generation=s.generation
      WHERE s.token_hash=? AND s.revoked=0 AND b.revoked=0 AND s.expires_at>? AND s.idle_expires_at>?`)
      .bind(digest(token), now, now).first<Row & { device_id: string; generation: number; expires_at: number; device_approved?: number }>();
    if (!row) fail("SESSION_INVALID", 401);
    return { ...view(row), deviceId: row.device_id, sessionHash: digest(token), generation: row.generation,
      absoluteExpiry: row.expires_at, deviceApproved: !this.v2Enabled || row.device_approved === 1 };
  }
  async authorize(token: string, protectedModule = true) {
    const actor = await this.session(token);
    if (protectedModule) {
      if (this.v2Enabled) {
        if (!actor.deviceApproved) fail("DEVICE_APPROVAL_REQUIRED");
        const stage = await this.db.prepare("SELECT stage FROM account_onboarding WHERE account_id=?")
          .bind(actor.accountId).first<{stage:string}>();
        if (stage?.stage !== "active") fail(stage ? "ACCOUNT_ONBOARDING_REQUIRED" : "ACCOUNT_ONBOARDING_MISSING");
        await new AccountEntitlementService(this.db,this.now).assertActive(actor.accountId);
      }
      if (actor.status !== "approved") fail(actor.status === "blocked" ? "ACCOUNT_BLOCKED" : "ACCOUNT_PENDING");
      if (actor.expiresAt && !(Date.parse(actor.expiresAt) > this.now())) fail("ACCOUNT_EXPIRED");
    }
    return actor;
  }
  async rotate(token: string) {
    const actor = await this.session(token), next = random();
    // DELETE ... RETURNING is not needed: insert replacement only on successful one-use CAS.
    const result = await this.db.batch([
      this.db.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=? AND revoked=0").bind(actor.sessionHash),
      this.db.prepare(`INSERT INTO account_sessions(token_hash,account_id,device_id,generation,expires_at,idle_expires_at)
        SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(digest(next), actor.accountId, actor.deviceId, actor.generation,
          actor.absoluteExpiry, Math.min(actor.absoluteExpiry, this.now() + IDLE_MS)),
    ]);
    if (Number(result[0].meta.changes) !== 1 || Number(result[1].meta.changes) !== 1) fail("SESSION_CONFLICT", 409);
    return { token: next };
  }
  async logout(token: string) {
    const actor = await this.session(token);
    await this.db.batch([this.db.prepare("UPDATE account_sessions SET revoked=1 WHERE token_hash=?").bind(actor.sessionHash),
      this.audit(actor.accountId, "session.revoked", actor.deviceId, "logout")]);
  }
  async revokeDevice(token: string, deviceId: unknown) {
    const actor = await this.session(token);
    if (this.v2Enabled && !actor.deviceApproved) fail("DEVICE_APPROVAL_REQUIRED");
    if (typeof deviceId !== "string" || !TOKEN.test(deviceId)) fail("DEVICE_KEY_INVALID", 400);
    const result = await this.db.batch([
      this.db.prepare("UPDATE account_devices SET revoked=1 WHERE account_id=? AND device_id=? AND revoked=0").bind(actor.accountId, deviceId),
      this.audit(actor.accountId, "device.revoked", deviceId, "account session management", true),
      this.db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=? AND device_id=?").bind(actor.accountId, deviceId),
    ]);
    if (Number(result[0].meta.changes) !== 1) fail("DEVICE_NOT_FOUND", 404);
  }
  async devices(token: string) {
    const actor = await this.session(token);
    if (this.v2Enabled && !actor.deviceApproved) return [{ device_id: actor.deviceId, approved: 0, revoked: 0 }];
    const query = this.v2Enabled
      ? "SELECT device_id,revoked,approved,created_at FROM account_devices WHERE account_id=? ORDER BY created_at DESC LIMIT 100"
      : "SELECT device_id,revoked,created_at FROM account_devices WHERE account_id=? ORDER BY created_at DESC LIMIT 100";
    return (await this.db.prepare(query).bind(actor.accountId).all()).results;
  }
  async approveDevice(token: string, targetId: unknown, password: unknown, peer: string) {
    if (!this.v2Enabled) fail("ACCOUNT_FEATURE_DISABLED",404);
    const actor = await this.session(token);
    if (!actor.deviceApproved) fail("DEVICE_APPROVAL_REQUIRED");
    if (typeof targetId !== "string" || !TOKEN.test(targetId)) fail("DEVICE_KEY_INVALID",400);
    await this.throttle(actor.accountId,peer,"device-approval");
    const credential = await this.db.prepare("SELECT password_verifier FROM account_credentials WHERE account_id=?")
      .bind(actor.accountId).first<{password_verifier:string}>();
    if (!credential || !await verifyPassword(password,credential.password_verifier)) fail("AUTH_FAILED",401);
    const statements = [
      this.db.prepare(`UPDATE account_devices SET approved=1 WHERE account_id=? AND device_id=?
        AND revoked=0 AND approved=0 AND EXISTS(
          SELECT 1 FROM account_devices WHERE account_id=? AND device_id=? AND approved=1 AND revoked=0)`)
        .bind(actor.accountId,targetId,actor.accountId,actor.deviceId),
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'account.device.approved',?,'confirmed trusted device' WHERE changes()=1`)
        .bind(actor.accountId,targetId),
    ];
    const result=await this.db.batch(statements);
    if(Number(result[0].meta.changes)!==1) fail("DEVICE_APPROVAL_CONFLICT",409);
    return {deviceId:targetId,approved:true};
  }
  async recover(input: Record<string, unknown>, peer: string) {
    const login = loginName(input.login);
    await this.throttle(login, peer, "recover", 5);
    const code = typeof input.recoveryCode === "string" ? input.recoveryCode : "";
    const codeHash = digest(code);
    const row = await this.db.prepare(`SELECT a.account_id,c.recovery_hash,c.generation FROM accounts a
      JOIN account_credentials c ON c.account_id=a.account_id WHERE a.login=?`).bind(login)
      .first<{ account_id: string; recovery_hash: string; generation: number }>();
    if (!row || !TOKEN.test(code) || !timingSafeEqual(Buffer.from(codeHash, "hex"), Buffer.from(row.recovery_hash, "hex"))) fail("AUTH_FAILED", 401);
    const verifier = await hashPassword(input.password), recoveryCode = random();
    const result = await this.db.batch([
      this.db.prepare(`UPDATE account_credentials SET password_verifier=?,recovery_hash=?,generation=generation+1,updated_at=CURRENT_TIMESTAMP
        WHERE account_id=? AND recovery_hash=? AND generation=?`).bind(verifier, digest(recoveryCode), row.account_id, codeHash, row.generation),
      this.audit(row.account_id, "credential.recovered", row.account_id, "single-use offline recovery", true),
      this.db.prepare("UPDATE account_sessions SET revoked=1 WHERE account_id=? AND generation<=?").bind(row.account_id, row.generation),
    ]);
    if (Number(result[0].meta.changes) !== 1) fail("AUTH_FAILED", 401);
    return { recoveryCode, accountId: row.account_id };
  }
  private async verifyRecoveryDeviceProof(input: Record<string,unknown>, peer: string) {
    if(!this.v2Enabled)fail("ACCOUNT_FEATURE_DISABLED",404);
    const login=loginName(input.login);
    await this.throttle(login,peer,"device-recovery",5);
    const row=await this.db.prepare(`SELECT a.account_id,c.password_verifier,c.recovery_hash
      FROM accounts a JOIN account_credentials c ON c.account_id=a.account_id
      WHERE a.login=?`).bind(login).first<{account_id:string;password_verifier:string;recovery_hash:string}>();
    const dummy=`scrypt$32768$8$3${"0".repeat(32)}${"0".repeat(64)}`;
    const passwordValid=await verifyPassword(input.password,row?.password_verifier??dummy);
    const code=typeof input.recoveryCode==="string"?input.recoveryCode:"";
    const proofValid=TOKEN.test(code)&&!!row&&timingSafeEqual(Buffer.from(digest(code),"hex"),Buffer.from(row.recovery_hash,"hex"));
    if(!row||!passwordValid||!proofValid)fail("AUTH_FAILED",401);
    return row;
  }
  async recoveryDeviceList(input: Record<string,unknown>,peer:string) {
    const row=await this.verifyRecoveryDeviceProof(input,peer);
    const devices=await this.db.prepare(`SELECT device_id,approved,created_at FROM account_devices
      WHERE account_id=? AND revoked=0 ORDER BY created_at DESC LIMIT 3`)
      .bind(row.account_id).all<{device_id:string;approved:number;created_at:string}>();
    return {devices:devices.results??[]};
  }
  async recoverLostDevice(input: Record<string,unknown>,peer:string) {
    const row=await this.verifyRecoveryDeviceProof(input,peer);
    const target=input.deviceId;
    if(typeof target!=="string"||!TOKEN.test(target))fail("DEVICE_KEY_INVALID",400);
    const nextCode=random();
    try {
      const results=await this.db.batch([
        this.db.prepare(`UPDATE account_devices SET revoked=1
          WHERE account_id=? AND device_id=? AND revoked=0`).bind(row.account_id,target),
        this.db.prepare(`UPDATE account_credentials SET recovery_hash=?,updated_at=CURRENT_TIMESTAMP
          WHERE account_id=? AND recovery_hash=? AND changes()=1`)
          .bind(digest(nextCode),row.account_id,row.recovery_hash),
        this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
          VALUES(?,'account.device.recovery',?,CASE WHEN changes()=1 THEN 'one-use recovery + password' ELSE NULL END)`)
          .bind(row.account_id,target),
        this.db.prepare(`UPDATE account_sessions SET revoked=1 WHERE account_id=? AND device_id=?`)
          .bind(row.account_id,target),
      ]);
      if(Number(results[0].meta.changes)!==1||Number(results[1].meta.changes)!==1)fail("DEVICE_RECOVERY_CONFLICT",409);
    } catch(error) {
      if(error instanceof Error&&/NOT NULL.*purpose|constraint/i.test(error.message))fail("DEVICE_RECOVERY_CONFLICT",409);
      throw error;
    }
    return {ok:true,deviceId:target,recoveryCode:nextCode};
  }
  async approveRecoveredDevice(input: Record<string,unknown>,peer:string) {
    const row=await this.verifyRecoveryDeviceProof(input,peer);
    const target=input.deviceId;
    if(typeof target!=="string"||!TOKEN.test(target))fail("DEVICE_KEY_INVALID",400);
    // A pending, non-revoked key is already counted in the 3-device SQL guard.
    // Offline recovery requires both password AND the current one-use recovery code.
    const nextCode=random();
    try {
      const result=await this.db.batch([
        this.db.prepare(`UPDATE account_devices SET approved=1 WHERE account_id=? AND device_id=?
          AND revoked=0 AND approved=0`).bind(row.account_id,target),
        this.db.prepare(`UPDATE account_credentials SET recovery_hash=?,updated_at=CURRENT_TIMESTAMP
          WHERE account_id=? AND recovery_hash=? AND changes()=1`)
          .bind(digest(nextCode),row.account_id,row.recovery_hash),
        this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
          VALUES(?,'account.device.recovered-approved',?,CASE WHEN changes()=1 THEN 'one-use proof + password' ELSE NULL END)`)
          .bind(row.account_id,target),
      ]);
      if(Number(result[0].meta.changes)!==1||Number(result[1].meta.changes)!==1)fail("DEVICE_RECOVERY_CONFLICT",409);
    }catch(error){
      if(error instanceof Error && /NOT NULL.*purpose|constraint/i.test(error.message))fail("DEVICE_RECOVERY_CONFLICT",409);
      throw error;
    }
    return {ok:true,deviceId:target,recoveryCode:nextCode};
  }
  async capability(actor: Principal, scope: string) {
    // Read owning rows freshly, not a role or a client-provided capability claim.
    const row = await this.db.prepare(`SELECT 1 AS allowed FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_manager_permissions p ON p.account_id=a.account_id
      WHERE a.account_id=? AND d.person_role='manager' AND d.status='approved' AND d.management_enabled=1
      AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
      AND p.scope=? AND p.enabled=1 AND (p.expires_at IS NULL OR p.expires_at>?)`)
      .bind(actor.accountId, scope, this.now()).first<{ allowed: number }>();
    if (!row) fail("ACCOUNT_PERMISSION_REQUIRED");
  }
  async ownerCommand(owner: { actor: string; role: string }, input: Record<string, unknown>) {
    if (owner.role !== "owner" || !owner.actor) fail("OWNER_REQUIRED");
    const id = String(input.accountId), row = await this.row(id);
    if (row.person_role !== "manager") fail("TARGET_ROLE_FORBIDDEN");
    if (!Number.isSafeInteger(input.expectedRevision) || row.revision !== input.expectedRevision) fail("ACCOUNT_CAS_CONFLICT", 409);
    const op = input.operation;
    if (!["approve-manager", "management", "read-all"].includes(String(op))) fail("ACCOUNT_INPUT", 400);
    const enabled = op === "approve-manager" ? true : input.enabled;
    if (typeof enabled !== "boolean") fail("ACCOUNT_INPUT", 400);
    const expiry = input.expiresAt === undefined || input.expiresAt === null ? null : input.expiresAt;
    if (expiry !== null && (typeof expiry !== "number" || !Number.isSafeInteger(expiry) || expiry <= this.now() || expiry > this.now() + 366 * 86400000)) fail("ACCOUNT_INPUT", 400);
    if (op === "approve-manager" ? (row.status !== "pending" || row.payment_status !== "unassigned" || row.access_group !== "unassigned") : enabled && (row.status !== "approved" || (row.access_expires_at && !(Date.parse(row.access_expires_at) > this.now())))) fail("ACCOUNT_STATE_CONFLICT", 409);
    if (this.v2Enabled && op === "approve-manager") {
      const step = await this.db.prepare("SELECT stage FROM account_onboarding WHERE account_id=?").bind(id).first<{stage:string}>();
      if (step?.stage !== "profile_review") fail("ACCOUNT_ONBOARDING_REQUIRED",409);
    }
    const accessExpiry=op==="approve-manager"?await this.approvalExpiry():null;
    const scopes = op === "read-all" ? ["registrants.read.all"] : ["manager.approve.registration", "manager.manage.assigned"];
    const statements: D1PreparedStatement[] = [this.db.prepare("UPDATE accounts SET revision=revision+1 WHERE account_id=? AND revision=?")
      .bind(id, row.revision)];
    // Force stale CAS to abort the entire batch, even when another Owner races after the SELECT.
    statements.push(this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
      SELECT ?,?,?,CASE WHEN changes()=1 THEN ? ELSE NULL END`).bind(owner.actor, "owner." + String(op), id, enabled ? "grant" : "revoke"));
    if (op === "approve-manager") statements.push(this.db.prepare(`UPDATE device_access SET status='approved',management_enabled=1,
      approved_at=CURRENT_TIMESTAMP,blocked_at=NULL,access_group='free',payment_status='free_approved',
      access_expires_at=CASE WHEN access_expires_at IS NULL OR datetime(access_expires_at)<=CURRENT_TIMESTAMP THEN ? ELSE access_expires_at END,updated_at=CURRENT_TIMESTAMP
      WHERE device_id=? AND status='pending' AND payment_status='unassigned' AND access_group='unassigned'`).bind(accessExpiry,row.storage_device_id));
    if (op === "approve-manager" && this.v2Enabled) {
      statements.push(this.db.prepare(`UPDATE account_onboarding
      SET stage='active',revision=revision+1,second_review_by=?,second_review_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND stage='profile_review' AND changes()=1`).bind(owner.actor,id));
      statements.push(await new AccountEntitlementService(this.db,this.now).grantOnApproval(id,"manager"));
    }
    if (op === "approve-manager") statements.push(this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose) SELECT ?,'owner.manager-approval',?,CASE WHEN changes()=1 THEN 'pending unassigned account' ELSE NULL END`).bind(owner.actor,id));
    if (op === "management") statements.push(this.db.prepare("UPDATE device_access SET management_enabled=?,updated_at=CURRENT_TIMESTAMP WHERE device_id=?")
      .bind(enabled ? 1 : 0, row.storage_device_id));
    for (const scope of scopes) statements.push(this.db.prepare(`INSERT INTO account_manager_permissions(account_id,scope,enabled,expires_at,granted_by)
      VALUES(?,?,?,?,?) ON CONFLICT(account_id,scope) DO UPDATE SET enabled=excluded.enabled,expires_at=excluded.expires_at,granted_by=excluded.granted_by`)
      .bind(id, scope, enabled ? 1 : 0, expiry, owner.actor));
    try { await this.db.batch(statements); } catch (error) {
      if (error instanceof Error && /NOT NULL.*purpose/.test(error.message)) fail("ACCOUNT_CAS_CONFLICT", 409);
      throw error;
    }
    const readback = await this.ownerRead(id);
    if (readback.revision !== row.revision + 1 || scopes.some(scope => {const p=readback.permissions.find(p=>p.scope===scope);return p?.configured!==enabled||p.expiresAt!==expiry;})) fail("ACCOUNT_READBACK_FAILED", 503);
    return readback;
  }
  async reviewBoard(token: string) {
    const actor = await this.authorize(token);
    await this.capability(actor, "manager.approve.registration");
    const onboardingSelect = this.v2Enabled ? ",o.stage AS onboarding_stage,o.revision AS onboarding_revision,o.first_review_by" : "";
    const onboardingJoin = this.v2Enabled ? " LEFT JOIN account_onboarding o ON o.account_id=a.account_id" : "";
    const result = await this.db.prepare(`SELECT ${COLUMNS},m.manager_device_id${onboardingSelect} FROM accounts a
      JOIN device_access d ON d.device_id=a.storage_device_id LEFT JOIN manager_device_assignments m ON m.target_device_id=d.device_id${onboardingJoin}
      WHERE (d.status='pending' AND d.person_role IN ('learner','teacher') AND d.payment_status='unassigned' AND m.target_device_id IS NULL)
       OR m.manager_device_id=? ORDER BY a.account_id LIMIT 201`).bind(actor.storageDeviceId)
       .all<Row & { manager_device_id: string | null; onboarding_stage?: string; onboarding_revision?: number; first_review_by?: string|null }>();
    if ((result.results?.length ?? 0) > 200) fail("ACCOUNT_RESULT_LIMIT", 413);
    const counts = await this.db.prepare(`SELECT d.person_role,COUNT(DISTINCT d.device_id) AS used FROM manager_device_assignments m
      JOIN device_access d ON d.device_id=m.target_device_id WHERE d.status='approved'
      AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP) GROUP BY d.person_role`).all<{ person_role: string; used: number }>();
    const limits = await this.db.prepare("SELECT learner_limit,teacher_limit FROM manager_approval_limits WHERE scope='manager-tier'").first<{ learner_limit: number; teacher_limit: number }>();
    if (!limits) fail("ACCOUNT_QUOTA_MISSING", 503);
    return { managerDeviceId: actor.storageDeviceId, quotas: {
      learner: { limit: limits.learner_limit, used: counts.results?.find(c => c.person_role === "learner")?.used ?? 0 },
      teacher: { limit: limits.teacher_limit, used: counts.results?.find(c => c.person_role === "teacher")?.used ?? 0 },
    }, devices: (result.results ?? []).map(r => ({ accountId: r.account_id, deviceId: r.storage_device_id,
      deviceCode: r.person_code, role: r.person_role, name: r.learner_name, personCode: r.person_code, className: r.class_name,
      status: r.status, registrationComplete: this.v2Enabled ? Boolean(r.person_code&&r.learner_name&&r.phone&&r.class_name) : true,
      onboardingStage: r.onboarding_stage??null, onboardingRevision: r.onboarding_revision??null,
      firstReviewMine: r.first_review_by===actor.accountId,
      assignedToMe: r.manager_device_id === actor.storageDeviceId })) };
  }
  async review(token: string, targetId: string, action: string) {
    const actor = await this.authorize(token);
    await this.capability(actor, "manager.approve.registration");
    const target = await this.row(targetId);
    if (!["learner", "teacher"].includes(target.person_role) || actor.accountId === targetId) fail("TARGET_ROLE_FORBIDDEN");
    if (!["approve", "block"].includes(action)) fail("ACCOUNT_INPUT", 400);
    if (this.v2Enabled && action === "approve") {
      const step=await this.db.prepare("SELECT stage,first_review_by FROM account_onboarding WHERE account_id=?")
        .bind(targetId).first<{stage:string;first_review_by:string|null}>();
      if(step?.stage!=="profile_review" || step.first_review_by!==actor.accountId) fail("ACCOUNT_ONBOARDING_REQUIRED",409);
    }
    const guard = `EXISTS(SELECT 1 FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
      JOIN account_manager_permissions p ON p.account_id=a.account_id WHERE a.account_id=? AND d.person_role='manager'
      AND d.status='approved' AND d.management_enabled=1 AND (d.access_expires_at IS NULL OR datetime(d.access_expires_at)>CURRENT_TIMESTAMP)
      AND p.scope='manager.approve.registration' AND p.enabled=1 AND (p.expires_at IS NULL OR p.expires_at>?))`;
    const statements: D1PreparedStatement[] = [];
    if (action === "approve") {
      const accessExpiry=await this.approvalExpiry();
      statements.push(this.db.prepare(`INSERT INTO manager_device_assignments(target_device_id,manager_device_id,person_role)
        SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM device_access WHERE device_id=? AND status='pending' AND payment_status='unassigned') AND ${guard}`)
        .bind(target.storage_device_id, actor.storageDeviceId, target.person_role, target.storage_device_id, actor.accountId, this.now()));
      statements.push(this.db.prepare(`UPDATE device_access SET status='approved',access_group='free',payment_status='free_approved',approved_at=CURRENT_TIMESTAMP,
        access_expires_at=COALESCE(access_expires_at,?),updated_at=CURRENT_TIMESTAMP
        WHERE device_id=? AND status='pending' AND changes()=1`).bind(accessExpiry,target.storage_device_id));
    } else statements.push(this.db.prepare(`UPDATE device_access SET status='blocked',blocked_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE device_id=? AND status='approved' AND EXISTS(SELECT 1 FROM manager_device_assignments WHERE target_device_id=? AND manager_device_id=?) AND ${guard}`)
      .bind(target.storage_device_id, target.storage_device_id, actor.storageDeviceId, actor.accountId, this.now()));
    // A failed conditional write must roll back preceding assignment and produce no success audit.
    if (this.v2Enabled && action === "approve") {
      statements.push(this.db.prepare(`UPDATE account_onboarding
      SET stage='active',revision=revision+1,second_review_by=?,second_review_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP WHERE account_id=? AND stage='profile_review' AND first_review_by=?
      AND changes()=1`).bind(actor.accountId,targetId,actor.accountId));
      statements.push(await new AccountEntitlementService(this.db,this.now).grantOnApproval(targetId,target.person_role));
    }
    statements.push(this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose) SELECT ?,?,?,CASE WHEN changes()=1 THEN ? ELSE NULL END`)
      .bind(actor.accountId, "registration." + action, targetId, "manager registration review"));
    try { await this.db.batch(statements); } catch (error) {
      if (error instanceof Error && /QUOTA/.test(error.message)) fail("ACCOUNT_QUOTA_REACHED", 409);
      if (error instanceof Error && /constraint|MANAGER_/i.test(error.message)) fail("ACCOUNT_REVIEW_CONFLICT", 409);
      throw error;
    }
    const after = await this.row(targetId);
    if (after.status !== (action === "approve" ? "approved" : "blocked")) fail("ACCOUNT_READBACK_FAILED", 503);
    return view(after);
  }
  async readRegistrants(token: string, purpose: unknown, offset = 0, limit = 50) {
    const reason = bounded(purpose, 160, "READ_PURPOSE_REQUIRED");
    if (reason.length < 3) fail("READ_PURPOSE_REQUIRED", 400);
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50) fail("ACCOUNT_QUERY_LIMIT", 400);
    const actor = await this.authorize(token);
    await this.capability(actor, "registrants.read.all");
    // Read+per-target audit are one transaction. Authorization is repeated IN the query to close revoke races.
    const guard = `EXISTS(SELECT 1 FROM account_manager_permissions p JOIN accounts m ON m.account_id=p.account_id
      JOIN device_access md ON md.device_id=m.storage_device_id WHERE p.account_id=? AND p.scope='registrants.read.all'
      AND p.enabled=1 AND (p.expires_at IS NULL OR p.expires_at>?) AND md.person_role='manager' AND md.status='approved'
      AND md.management_enabled=1 AND (md.access_expires_at IS NULL OR datetime(md.access_expires_at)>CURRENT_TIMESTAMP))`;
    const query = `SELECT a.account_id,d.learner_name,d.person_role,d.person_code,d.class_name,d.status FROM accounts a
      JOIN device_access d ON d.device_id=a.storage_device_id WHERE ${guard} ORDER BY a.account_id LIMIT ? OFFSET ?`;
    const result = await this.db.batch([
      this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose)
        SELECT ?,'registrants.read.all',r.account_id,? FROM (${query}) r`).bind(actor.accountId, reason, actor.accountId, this.now(), limit, offset),
      this.db.prepare(query).bind(actor.accountId, this.now(), limit, offset),
    ]);
    const rows = result[1].results as Array<{ account_id: string; learner_name: string; person_role: string; person_code: string; class_name: string; status: string }>;
    return { accounts: rows.map(r => ({ accountId: r.account_id, name: r.learner_name, role: r.person_role, personCode: r.person_code, className: r.class_name, status: r.status })), nextOffset: rows.length === limit ? offset + limit : null };
  }
  async migrationReport() {
    const conflicts = await this.db.prepare(`SELECT 'identity' AS kind, MIN(device_id) AS device_id FROM device_access
      WHERE registration_submitted_at IS NOT NULL GROUP BY person_role,person_code HAVING COUNT(*)>1
      UNION ALL SELECT 'phone',MIN(device_id) FROM device_access WHERE registration_submitted_at IS NOT NULL GROUP BY phone HAVING COUNT(*)>1
      UNION ALL SELECT 'mapping',d.device_id FROM device_access d JOIN accounts a ON a.account_id='acc_'||d.device_id WHERE a.storage_device_id<>d.device_id`)
      .all<{ kind: string; device_id: string }>();
    const count = await this.db.prepare(`SELECT COUNT(*) AS n FROM device_access WHERE registration_submitted_at IS NOT NULL
      AND person_role IN ('learner','manager','teacher') AND trim(COALESCE(person_code,''))<>'' AND trim(COALESCE(phone,''))<>''`)
      .first<{ n: number }>();
    return { eligible: count?.n ?? 0, conflicts: conflicts.results ?? [] };
  }
  async backfill() {
    const report = await this.migrationReport();
    if (report.conflicts.length) fail("MIGRATION_CONFLICT", 409);
    // Idempotent deterministic mapping; no profile/status/payment or original permission writes.
    await this.db.batch([
      this.db.prepare(`INSERT INTO accounts(account_id,storage_device_id) SELECT 'acc_'||device_id,device_id FROM device_access
        WHERE registration_submitted_at IS NOT NULL AND person_role IN ('learner','manager','teacher')
        AND trim(COALESCE(person_code,''))<>'' AND trim(COALESCE(phone,''))<>'' ON CONFLICT(storage_device_id) DO NOTHING`),
      this.db.prepare(`INSERT INTO account_devices(account_id,device_id,public_key_jwk)
        SELECT a.account_id,d.device_id,d.public_key_jwk FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
        WHERE a.account_id='acc_'||d.device_id ON CONFLICT(account_id,device_id) DO NOTHING`),
      ...["manager.approve.registration", "manager.manage.assigned"].map(scope => this.db.prepare(`INSERT INTO account_manager_permissions(account_id,scope,enabled,granted_by)
        SELECT a.account_id,?,1,'migration:existing-operational-grant' FROM accounts a JOIN device_access d ON d.device_id=a.storage_device_id
        WHERE d.person_role='manager' AND d.management_enabled=1 ON CONFLICT(account_id,scope) DO NOTHING`).bind(scope)),
    ]);
    return report;
  }
  async claim(input: Record<string, unknown>, verifiedLegacyDeviceId: string | null, peer: string) {
    const login = loginName(input.login);
    await this.throttle(login, peer, "claim", 5);
    const bindingId = await deviceKeyId(input.publicKey);
    if (!verifiedLegacyDeviceId || bindingId !== verifiedLegacyDeviceId) fail("LEGACY_PROOF_REQUIRED");
    const row = await this.db.prepare("SELECT account_id,login FROM accounts WHERE storage_device_id=?").bind(verifiedLegacyDeviceId)
      .first<{ account_id: string; login: string | null }>();
    if (!row || row.login) fail("LEGACY_CLAIM_UNAVAILABLE", 409);
    const verifier = await hashPassword(input.password), recoveryCode = random();
    try {
      await this.db.batch([
        this.db.prepare("UPDATE accounts SET login=?,revision=revision+1 WHERE account_id=? AND login IS NULL").bind(login, row.account_id),
        this.db.prepare(`INSERT INTO account_credentials(account_id,password_verifier,recovery_hash)
          SELECT ?,?,? WHERE changes()=1`).bind(row.account_id, verifier, digest(recoveryCode)),
        this.db.prepare(`INSERT INTO account_audit(actor,action,target,purpose) SELECT ?,'legacy.claimed',?,CASE WHEN changes()=1 THEN 'verified original P-256 key possession' ELSE NULL END`).bind(row.account_id,row.account_id),
      ]);
    } catch { fail("LEGACY_CLAIM_UNAVAILABLE", 409); }
    return { ...await this.issue(row.account_id, input.publicKey), recoveryCode };
  }
}
