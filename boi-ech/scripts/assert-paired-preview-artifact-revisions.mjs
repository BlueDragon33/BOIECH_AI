import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Exact before-write Preview gate. The Cloudflare Vite plugin writes Wrangler's
 * deploy config from its build-time GITHUB_SHA, which may belong to the *parent*
 * BOIECH_AI checkout unless we explicitly scope the second App build.
 *
 * This gate inspects the generated artifact that "wrangler deploy" will use,
 * not just the source templates or CI env vars. It performs no network or D1
 * operations and never prints secrets/other Wrangler bindings.
 */
export function readGeneratedPreviewConfig(root) {
  const redirectPath = path.join(root, ".wrangler", "deploy", "config.json");
  const redirect = JSON.parse(fs.readFileSync(redirectPath, "utf8"));
  if (typeof redirect?.configPath !== "string" || !redirect.configPath.trim()) {
    throw new Error("Preview generated deployment config redirect is missing.");
  }
  const generatedPath = path.resolve(path.dirname(redirectPath), redirect.configPath);
  const relative = path.relative(root, generatedPath).split(path.sep).join("/");
  if (!relative.startsWith("dist/")) throw new Error("Preview generated config must be inside dist/.");
  return JSON.parse(fs.readFileSync(generatedPath, "utf8"));
}

export function verifyPairedPreviewArtifacts(boi, app, env) {
  const revision = (value) => typeof value === "string" && /^[a-f0-9]{40}$/i.test(value);
  const boiExpected = env.GITHUB_SHA;
  const appExpected = env.APPLICATION_MANAGEMENT_BUILD_REVISION;
  if (!revision(boiExpected) || !revision(appExpected) || boiExpected === appExpected) {
    throw new Error("Paired Preview requires two distinct pinned, valid source revisions.");
  }
  if (boi?.name !== "boi-ech-preview" || app?.name !== "application-management-preview") {
    throw new Error("Generated artifact Worker identity mismatch; stop before Preview D1 writes.");
  }
  if (boi?.vars?.BOI_ECH_BUILD_REVISION !== boiExpected) {
    throw new Error("Bơi Ếch Preview artifact revision mismatch; stop before Preview D1 writes.");
  }
  if (app?.vars?.APPLICATION_MANAGEMENT_BUILD_REVISION !== appExpected) {
    throw new Error("Application-Management Preview artifact revision mismatch; stop before Preview D1 writes.");
  }
  if (boi?.vars?.BOI_ECH_DEPLOYMENT_CHANNEL !== "cloudflare-preview" ||
      app?.vars?.APPLICATION_MANAGEMENT_DEPLOYMENT_CHANNEL !== "cloudflare-preview") {
    throw new Error("Generated paired Preview channel mismatch; stop before Preview D1 writes.");
  }
  return { verified: true, paired: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const appRoot = path.resolve(process.cwd(), "application-management-preview-source");
  const boiRoot = path.resolve(process.cwd(), "boi-ech");
  verifyPairedPreviewArtifacts(
    readGeneratedPreviewConfig(boiRoot),
    readGeneratedPreviewConfig(appRoot),
    process.env,
  );
  console.log("Both generated Preview Worker artifacts have exact, distinct reviewed revisions. PASS (read-only).");
}
