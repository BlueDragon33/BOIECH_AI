import { randomBytes } from "node:crypto";
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
    if (variable(boi,"BOI_ECH_BUILD_REVISION") !== env.GITHUB_SHA || variable(app,"APPLICATION_MANAGEMENT_BUILD_REVISION") !== env.APPLICATION_MANAGEMENT_BUILD_REVISION) throw new Error("Live Preview build revision mismatch.");
    if (variable(boi,"BOI_ECH_DEPLOYMENT_CHANNEL") !== "cloudflare-preview" || variable(app,"APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL") !== "cloudflare-preview") throw new Error("Live Preview channel mismatch.");
    if (!env.CONTROL_OWNER_EMAILS || /@example\.(?:com|test|invalid)\b/i.test(env.CONTROL_OWNER_EMAILS) || variable(app,"CONTROL_OWNER_EMAILS") !== env.CONTROL_OWNER_EMAILS) throw new Error("Live App Preview Owner policy mismatch or example identity.");
    if (boi.some(b => b.type === "r2_bucket")) throw new Error("FREE Preview must not introduce R2.");
  }
  return { boiWorker: BOI, appWorker: APP, boiD1: policy.name, appD1: APP_D1 };
}

/**
 * Post-deploy LIVE read-only API contract checks. Never request private rows or
 * mutate D1. The same credential is installed on the two protected Preview
 * Workers only; no response bodies or secret values are logged on failure.
 */
export async function verifyV2SummaryLive(secret, fetcher = fetch) {
  const boiOrigin = `https://${BOI}.boiech-ai.workers.dev`;
  const appOrigin = `https://${APP}.boiech-ai.workers.dev`;
  const url = `${boiOrigin}/api/control/v2/account-summary`;
  const seen = [];
  const request = async (path, role, bearer, expected) => {
    const headers = { origin: appOrigin, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...(role ? { "x-control-role": role } : {}) };
    const response = await fetcher(path, {
      method: "GET", headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    if (response.status !== expected) throw new Error(`Preview V2 control authorization/readback mismatch: expected HTTP ${expected}, got ${response.status}.`);
    seen.push(expected);
    return response;
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
  await request(`${boiOrigin}/api/control/overview?activityDays=0`, "owner", secret, 409);
  return { contract: "boi-account-summary.v2", verified: true, statusChecks: seen,
    totalAccountsVerified: true, personalRowsReturned: false };
}

export async function installPreviewBridge(env = process.env, fetcher = fetch) {
  if (env.PREVIEW_BRIDGE_CONFIRMATION !== "INSTALL_PREVIEW_BRIDGE") throw new Error("INSTALL_PREVIEW_BRIDGE confirmation is required to create or rotate the shared credential on the two named Preview Workers.");
  const result = await checkPreviewStack(env, fetcher, true);
  const api = provider(env, fetcher);
  const secret = randomBytes(48).toString("base64url");
  for (const worker of [BOI, APP]) await api(worker, "secrets", { name:"CONTROL_SERVICE_SECRET", type:"secret_text", text:secret });
  // Read back actual runtime + D1 access with the new key. No key is returned or logged.
  const boiResponse = await fetcher(`https://${BOI}.boiech-ai.workers.dev/api/control/status`, {
    headers: { authorization:`Bearer ${secret}`, origin:`https://${APP}.boiech-ai.workers.dev`, "x-control-role":"viewer" },
    redirect:"error", signal:AbortSignal.timeout(20_000),
  });
  if (!boiResponse.ok) throw new Error(`Deployed Boi Preview runtime check failed: HTTP ${boiResponse.status}.`);
  const status = await boiResponse.json();
  if (status.ok !== true || status.application !== "boi-ech" || status.deployment?.revision !== env.GITHUB_SHA || status.deployment.channel !== "cloudflare-preview" || status.deployment.paymentStorageReady !== false) throw new Error("Deployed Boi Preview runtime revision, D1 or FREE storage check failed.");
  const appResponse = await fetcher(`https://${APP}.boiech-ai.workers.dev/__deployment`, {
    headers:{accept:"application/json"}, redirect:"error", signal:AbortSignal.timeout(20_000),
  });
  if (appResponse.status !== 401 || (await appResponse.json()).error !== "preview_access_required") throw new Error("App Preview anonymous access protection check failed.");
  const v2Summary = await verifyV2SummaryLive(secret, fetcher);
  await checkPreviewStack(env, fetcher, true);
  return {...result, boiRevision:status.deployment.revision, appRevision:env.APPLICATION_MANAGEMENT_BUILD_REVISION, appAnonymousStatus:appResponse.status, v2Summary, bridgeInstalled:true, acceptance:"Owner/MFA/account/device business acceptance remains separate"};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = process.argv[2] === "install-bridge" ? await installPreviewBridge() : await checkPreviewStack();
  console.log(JSON.stringify(result));
}
