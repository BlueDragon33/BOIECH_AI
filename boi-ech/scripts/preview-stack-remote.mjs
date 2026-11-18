import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {roleAssetProbes} from "./production-package.mjs";
import { pathToFileURL } from "node:url";
import { previewD1Policy } from "./preview-d1-policy.mjs";

const ACCOUNT = "f88a42260814230aa4a151abbfe5659d";
const BOI = "boi-ech-preview";
const APP = "application-management-preview";
const APP_D1 = "00f8a685-452f-472c-81c5-4d0b1c4037c9";
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/`;

function provider(env, fetcher) {
  if (env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT || !env.CLOUDFLARE_API_TOKEN) throw new Error("Exact Preview Cloudflare account and existing deployment credential are required.");
  return async (worker, operation, body) => {
    const response = await fetcher(`${API}${worker}/${operation}`, {
      method: body ? "PUT" : "GET",
      headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    // Never forward provider error bodies, request headers or secret values.
    if (!response.ok) throw new Error(`Preview provider ${operation} failed: HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.success !== true) throw new Error(`Preview provider ${operation} did not acknowledge success.`);
    return payload.result;
  };
}
function bindings(settings) {
  if (!Array.isArray(settings?.bindings)) throw new Error("Preview provider returned no binding inventory.");
  return settings.bindings;
}
function dbMatches(list, id, allowEmpty = false) {
  const databases = list.filter(b => b.type === "d1");
  return (allowEmpty && databases.length === 0) || (databases.length === 1 && databases[0].name === "DB" && databases[0].id === id);
}
function variable(list, name) { return list.find(b => b.type === "plain_text" && b.name === name)?.text; }

export async function checkPreviewStack(env = process.env, fetcher = fetch, deployed = false) {
  const api = provider(env, fetcher);
  const policy = previewD1Policy(env);
  if (policy.borrowed) {
    const retired = bindings(await api("bauman-control-preview", "settings"));
    if (retired.some(b => b.type === "d1")) throw new Error("Retired Bauman Preview D1 must be detached before reuse.");
    const urls = await api("bauman-control-preview", "subdomain");
    if (urls.enabled !== false || urls.previews_enabled !== false) throw new Error("Retired Bauman Preview URLs must both remain disabled.");
  }
  const boi = bindings(await api(BOI, "settings"));
  const app = bindings(await api(APP, "settings"));
  if (!dbMatches(boi, policy.id, !deployed) || !dbMatches(app, APP_D1)) throw new Error("Live Preview D1 binding identity mismatch; no remote writes allowed.");
  for (const name of ["APPLICATION_MANAGEMENT_PREVIEW_ACCESS_SECRET", "MANAGED_APP_CREDENTIAL_ENCRYPTION_KEY"]) {
    if (!app.some(b => b.name === name && b.type === "secret_text")) throw new Error(`Existing App Preview protection ${name} must be retained.`);
  }
  if (deployed) {
    if (variable(boi,"BOI_ECH_BUILD_REVISION") !== env.GITHUB_SHA) {
      throw new Error("Live Preview build revision mismatch (Bơi Ếch Worker).");
    }
    if (variable(app,"APPLICATION_MANAGEMENT_BUILD_REVISION") !== env.APPLICATION_MANAGEMENT_BUILD_REVISION) {
      throw new Error("Live Preview build revision mismatch (Application-Management Worker).");
    }
    if (variable(boi,"BOI_ECH_DEPLOYMENT_CHANNEL") !== "cloudflare-preview" || variable(app,"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL") !== "cloudflare-preview") throw new Error("Live Preview channel mismatch.");
    if (!env.CONTROL_OWNER_EMAILS || /@example\.(?:com|test|invalid)\b/i.test(env.CONTROL_OWNER_EMAILS) || variable(app,"CONTROL_OWNER_EMAILS") !== env.CONTROL_OWNER_EMAILS) throw new Error("Live App Preview Owner policy mismatch or example identity.");
    if (boi.some(b => b.type === "r2_bucket")) throw new Error("FREE Preview must not introduce R2.");
    if (variable(boi,"APPLICATION_MANAGEMENT_ORIGIN") !== `https://${APP}.boiech-ai.workers.dev`) {
      throw new Error("Live Bơi Ếch Preview control Origin policy mismatch; refuse bridge writes.");
    }
  }
  return { boiWorker: BOI, appWorker: APP, boiD1: policy.name, appD1: APP_D1 };
}

/**
 * Post-deploy LIVE read-only API contract checks. Never request private rows or
 * mutate D1. The same credential is installed on the two protected Preview
 * Workers only; no response bodies or secret values are logged on failure.
 */
export async function verifyV2SummaryLive(
  secret, fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))
) {
  const boiOrigin = `https://${BOI}.boiech-ai.workers.dev`;
  const appOrigin = `https://${APP}.boiech-ai.workers.dev`;
  const url = `${boiOrigin}/api/control/v2/account-summary`;
  const seen = [];
  const request = async (path, role, bearer, expected, {legacyGuard=false}={}) => {
    const headers = { origin: appOrigin, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(role ? { "x-control-role": role } : {}) };
    // The just-rotated shared secret can briefly reach Cloudflare edge locations
    // at different times. Retry ONLY app-coded credential propagation rejection,
    // NEVER a WAF/HTML 403, scope/origin denial, role denial or unknown failure.
    const delays = legacyGuard ? [0,1000,2000,4000,8000] : [0];
    for(let attempt=0;attempt<delays.length;attempt++){
      if(delays[attempt])await pause(delays[attempt]);
      const response = await fetcher(path, {
        method: "GET", headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
      });
      if(response.status===expected){
        if(legacyGuard){
          let code="UNKNOWN";
          try {
            if((response.headers.get("content-type")??"").includes("application/json"))
              code=(await response.clone().json())?.code??"UNKNOWN";
          } catch { /* Fail closed on unreadable response. */ }
          if(code!=="ACCOUNT_CONTROL_REQUIRED")
            throw new Error("Preview legacy control guard: expected ACCOUNT_CONTROL_REQUIRED on HTTP 409.");
        }
        seen.push(expected);
        return response;
      }
      let code="UNKNOWN";
      if(response.status===403){
        try {
          if((response.headers.get("content-type")??"").includes("application/json")){
            const payload=await response.json();
            if(typeof payload?.code==="string"&&/^CONTROL_[A-Z_]+$/.test(payload.code))code=payload.code;
          }
        }catch{ /* Cloudflare challenge/invalid response must never be retried. */ }
      }
      if(legacyGuard&&response.status===403&&
         (code==="CONTROL_SERVICE_FORBIDDEN"||code==="CONTROL_TICKET_FORBIDDEN")&&
         attempt<delays.length-1)continue;
      throw new Error(`Preview V2 control authorization/readback mismatch: expected HTTP ${expected}, got ${response.status}; safe code ${code}.`);
    }
    throw new Error("Preview legacy control guard exhausted the bounded credential propagation check.");
  };
  const aggregate = await (await request(url, "owner", secret, 200)).json();
  const validKeys = ["asOf", "contract", "counts", "verified"];
  const countKeys = ["totalAccounts", "pending", "active", "suspended", "expired", "unverified"];
  const counts = aggregate?.counts;
  if (!aggregate || Object.keys(aggregate).sort().join("|") !== validKeys.sort().join("|")
      || aggregate.contract !== "boi-account-summary.v2" || aggregate.verified !== true
      || !Number.isFinite(Date.parse(aggregate.asOf ?? "")) || !counts ||
      Object.keys(counts).sort().join("|") !== countKeys.sort().join("|") ||
      countKeys.some(key => !Number.isSafeInteger(counts[key]) || counts[key] < 0 || counts[key] > counts.totalAccounts)) {
    throw new Error("Live Preview V2 account-summary schema or aggregate evidence does not match the reviewed contract.");
  }
  await request(url, "publisher", secret, 200);
  await request(url, "viewer", secret, 403);
  await request(url, "owner", null, 401);
  await request(url, "owner", "invalid-preview-ticket", 403);
  // Explicit proof that V2 disables the legacy registry endpoint rather than
  // reopening private device/payment access through the central adapter.
  await request(`${boiOrigin}/api/control/overview?activityDays=0`, "owner", secret, 409, {legacyGuard:true});
  return { contract: "boi-account-summary.v2", verified: true, statusChecks: seen,
    totalAccountsVerified: true, personalRowsReturned: false };
}

/** Cloudflare secret rotation may take a short time to reach its runtime.
 * Retry ONLY explicit control-credential rejection, not role, origin, WAF,
 * unknown HTTP failures or bodyless 403. Never log a bearer or response body. */
export async function readBoiPreviewRuntime(secret, fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  const origin = `https://${APP}.boiech-ai.workers.dev`;
  const url = `https://${BOI}.boiech-ai.workers.dev/api/control/status`;
  const delays = [0, 1000, 2000, 4000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt]) await pause(delays[attempt]);
    const response = await fetcher(url, {
      method:"GET",
      headers: { authorization:`Bearer ${secret}`, origin, "x-control-role":"viewer" },
      cache:"no-store", redirect:"error", signal:AbortSignal.timeout(20_000),
    });
    if (response.ok) return await response.json();
    let code = "UNKNOWN";
    if (response.status === 403) {
      try {
        const payload = await response.json();
        if (typeof payload?.code === "string" && /^CONTROL_[A-Z_]+$/.test(payload.code)) code = payload.code;
      } catch { /* Cloudflare HTML/challenge is not trusted as an app error. */ }
    }
    if (response.status === 403 &&
        (code === "CONTROL_SERVICE_FORBIDDEN" || code === "CONTROL_TICKET_FORBIDDEN") &&
        attempt < delays.length - 1) continue;
    throw new Error(`Deployed Boi Preview runtime check failed: HTTP ${response.status}; safe code ${code}.`);
  }
  throw new Error("Deployed Boi Preview runtime readback exhausted retry policy.");
}

/**
 * Validate real Cloudflare Preview URLs for both role-specific lazy chunks.
 * Use the exact generated deployment asset manifest so a successful shell/
 * status readback cannot hide a failed teacher or learner GO.
 * This read-only check is required BEFORE rotating the shared Preview bridge.
 */
export async function verifyPreviewRoleAssetsLive(
  fetcher=fetch,root=process.cwd(),{
    // Only a just-deployed asset's 404 can be transient while Cloudflare
    // propagates the new immutable asset manifest across its edge.
    retryDelays=[0,1000,2000,4000,7000,12000],
    pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
  }={}
) {
  const dist=path.resolve(root,"dist")+path.sep;
  const redirect=path.resolve(root,".wrangler/deploy/config.json");
  const configIndex=JSON.parse(fs.readFileSync(redirect,"utf8"));
  if(typeof configIndex?.configPath!=="string")throw new Error("Preview role smoke: generated config redirect missing.");
  const configPath=path.resolve(path.dirname(redirect),configIndex.configPath);
  if(!configPath.startsWith(dist))throw new Error("Preview role smoke: generated config path must stay under dist.");
  const config=JSON.parse(fs.readFileSync(configPath,"utf8"));
  if(config.name!==BOI||typeof config.assets?.directory!=="string")
    throw new Error("Preview role smoke: unexpected Worker or asset directory.");
  const assetsRoot=path.resolve(path.dirname(configPath),config.assets.directory);
  if(assetsRoot!==path.resolve(root,"dist") && !assetsRoot.startsWith(dist))
    throw new Error("Preview role smoke: asset directory must remain under dist.");
  const roleFiles=roleAssetProbes(fs.readdirSync(path.join(assetsRoot,"assets")));
  if(!Array.isArray(retryDelays)||retryDelays.length<1||retryDelays.length>10||
     retryDelays.some(v=>!Number.isInteger(v)||v<0||v>15000))
    throw new Error("Preview role smoke: invalid bounded retry policy.");
  for(const file of roleFiles){
    let lastStatus=0;
    let verified=false;
    for(let attempt=0;attempt<retryDelays.length;attempt++){
      if(retryDelays[attempt])await pause(retryDelays[attempt]);
      const response=await fetcher(`https://${BOI}.boiech-ai.workers.dev/${file}`,{
        method:"GET",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000),
      });
      lastStatus=response.status;
      const mime=response.headers.get("content-type")??"";
      if(response.status===200&&/javascript|ecmascript/i.test(mime)){verified=true;break;}
      // Only freshly deployed 404s may converge. Never mask HTML fallback,
      // 401/403, redirects, invalid MIME or unrelated Worker/origin failures.
      if(response.status!==404||attempt===retryDelays.length-1)
        throw new Error(`Preview role smoke: ${file} returned HTTP ${lastStatus} or non-JavaScript content.`);
    }
    if(!verified)throw new Error(`Preview role smoke: ${file} did not become available after bounded retries (HTTP ${lastStatus}).`);
  }
  return {checked:roleFiles.length,files:roleFiles};
}

export async function installPreviewBridge(env = process.env, fetcher = fetch, roleVerifier = verifyPreviewRoleAssetsLive) {
  if (env.PREVIEW_BRIDGE_CONFIRMATION !== "INSTALL_PREVIEW_BRIDGE") throw new Error("INSTALL_PREVIEW_BRIDGE confirmation is required to create or rotate the shared credential on the two named Preview Workers.");
  const result = await checkPreviewStack(env, fetcher, true);
  const roleSmoke=await roleVerifier(fetcher);
  const api = provider(env, fetcher);
  const secret = randomBytes(48).toString("base64url");
  for (const worker of [BOI, APP]) await api(worker, "secrets", { name:"CONTROL_SERVICE_SECRET", type:"secret_text", text:secret });
  // Read back actual runtime + D1 access with the new key. No key is returned or logged.
  const status = await readBoiPreviewRuntime(secret, fetcher);
  if (status.ok !== true || status.application !== "boi-ech" || status.deployment?.revision !== env.GITHUB_SHA || status.deployment.channel !== "cloudflare-preview" || status.deployment.paymentStorageReady !== false) throw new Error("Deployed Boi Preview runtime revision, D1 or FREE storage check failed.");
  const appResponse = await fetcher(`https://${APP}.boiech-ai.workers.dev/__deployment`, {
    headers:{accept:"application/json"}, redirect:"error", signal:AbortSignal.timeout(20_000),
  });
  if (appResponse.status !== 401 || (await appResponse.json()).error !== "preview_access_required") throw new Error("App Preview anonymous access protection check failed.");
  const v2Summary = await verifyV2SummaryLive(secret, fetcher);
  await checkPreviewStack(env, fetcher, true);
  return {...result, boiRevision:status.deployment.revision, appRevision:env.APPLICATION_MANAGEMENT_BUILD_REVISION, appAnonymousStatus:appResponse.status, v2Summary, roleSmoke, bridgeInstalled:true, acceptance:"Owner/MFA/account/device business acceptance remains separate"};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = process.argv[2] === "install-bridge" ? await installPreviewBridge() : await checkPreviewStack();
  console.log(JSON.stringify(result));
}
