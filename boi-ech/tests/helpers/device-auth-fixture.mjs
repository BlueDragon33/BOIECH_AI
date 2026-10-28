import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { DatabaseSync } from "node:sqlite";

// Execute the actual server and route against SQLite. Only the Workers binding,
// unused admin identity provider, and best-effort browser metadata are replaced.
export function fixture(mode, migrated = false) {
  const sqlite = new DatabaseSync(":memory:");
  if (!migrated) sqlite.exec("CREATE TABLE course_profiles (user_key TEXT, completed_json TEXT, scores_json TEXT, device_hash TEXT, updated_at TEXT)");
  if (!migrated) sqlite.exec("CREATE TABLE course_audit_log (id INTEGER PRIMARY KEY, actor TEXT, action TEXT, target TEXT, detail_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
  if (migrated) {
    const directory = new URL("../../drizzle/", import.meta.url);
    for (const file of fs.readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) sqlite.exec(fs.readFileSync(new URL(file, directory), "utf8"));
  }
  let transientBatchFailure = false;
  const database = {
    prepare(sql) {
      let args = [];
      const query = {
        bind(...values) { args = values; return query; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
      };
      return query;
    },
    async batch(queries) {
      if (transientBatchFailure) { transientBatchFailure = false; throw new Error("temporary D1 transport failure"); }
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const query of queries) results.push(await query.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
  };
  const authSource = stripTypeScriptTypes(fs.readFileSync(new URL("../../app/device-auth.server.ts", import.meta.url), "utf8"))
    .replace(/import \{ getChatGPTUser \} from "\.\/chatgpt-auth";/, "")
    .replace('await import("cloudflare:workers")', "testWorkers")
    .replace(/\bexport\s+/g, "");
  const authNames = ["DeviceAccessError", "createDeviceChallenge", "deviceErrorResponse", "getCourseDatabase", "getPublicDeviceState", "registerDevice", "saveDeviceRegistration", "verifyDeviceIdentityRequest", "verifyDeviceRequest"];
  const auth = new Function("testWorkers", "getChatGPTUser", `${authSource}; return {${authNames.join(",")}};`)({ env: { DB: database } }, async () => null);
  const routeSource = stripTypeScriptTypes(fs.readFileSync(new URL("../../app/api/device/route.ts", import.meta.url), "utf8"))
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g, "")
    .replace(/\bexport\s+/g, "");
  const POST = new Function(...authNames, "captureDeviceMetadata", "process", `${routeSource}; return POST;`)(...authNames.map(name => auth[name]), async () => {}, { env: { BOI_ECH_ACCESS_MODE: mode } });
  return {
    sqlite, database, auth,
    failNextBatch() { transientBatchFailure = true; },
    async post(payload, host = "boi-ech.boiech-ai.workers.dev") {
      const response = await POST(new Request(`https://${host}/api/device`, { method: "POST", body: JSON.stringify(payload) }));
      return { status: response.status, ...await response.json() };
    },
  };
}

export async function identity() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  return { publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey), privateKey: pair.privateKey };
}

export async function proof(f, key, deviceId) {
  const { challenge } = await f.post({ action: "challenge", deviceId });
  const bytes = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key.privateKey, new TextEncoder().encode(`boi-ech:${deviceId}:${challenge}`));
  return { deviceId, challenge, signature: Buffer.from(bytes).toString("base64url") };
}
