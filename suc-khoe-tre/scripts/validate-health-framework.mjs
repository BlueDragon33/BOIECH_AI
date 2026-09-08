import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const fail = (message) => { throw new Error(`Framework validation failed: ${message}`); };

const catalogSource = read("app/suc-khoe-tre/health-domain-catalog.ts");
const bodyMatch = catalogSource.match(/export const HEALTH_DOMAINS:[\s\S]*?= \[([\s\S]*?)\n\] as const;/);
if (!bodyMatch) throw new Error("Không đọc được HEALTH_DOMAINS.");
const blocks = [...bodyMatch[1].matchAll(/\n  \{\n([\s\S]*?)\n  \},/g)].map((match) => match[1]);

if (blocks.length !== 22) fail(`cần đúng 22 miền chức năng sau Audit V3, hiện có ${blocks.length}`);

const ids = [];
const stageCounts = new Map([["foundation", 0], ["preteen", 0], ["early-adolescent", 0], ["late-adolescent", 0]]);
const allowedAreas = new Set(["growth", "nutrition", "activity", "care", "journal", "profile"]);

for (const block of blocks) {
  const id = block.match(/id: "([^"]+)"/)?.[1];
  const title = block.match(/title: "([^"]+)"/)?.[1];
  const navArea = block.match(/navArea: "([^"]+)"/)?.[1];
  const privacy = block.match(/privacy: "([^"]+)"/)?.[1];
  const stagesText = block.match(/stages: \[([^\]]+)\]/)?.[1] ?? "";
  const capabilitiesText = block.match(/capabilities: \[([^\]]+)\]/)?.[1] ?? "";
  if (!id || !title || !navArea || !privacy) fail("mỗi miền phải có id/title/navArea/privacy");
  if (!allowedAreas.has(navArea)) fail(`${id}: navArea không hợp lệ: ${navArea}`);
  if (!["standard", "sensitive", "highly-sensitive"].includes(privacy)) fail(`${id}: privacy không hợp lệ`);
  const stages = [...stagesText.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (!stages.length) fail(`${id}: chưa khai báo giai đoạn tuổi`);
  for (const stage of stages) {
    if (!stageCounts.has(stage)) fail(`${id}: stage không hợp lệ: ${stage}`);
    stageCounts.set(stage, stageCounts.get(stage) + 1);
  }
  const capabilityCount = [...capabilitiesText.matchAll(/"([^"]+)"/g)].length;
  if (capabilityCount < 2) fail(`${id}: cần ít nhất 2 capability trong bộ khung`);
  if (privacy === "highly-sensitive" && !/guardrail:/.test(block)) fail(`${id}: dữ liệu rất nhạy cảm phải có guardrail`);
  ids.push(id);
}

if (new Set(ids).size !== ids.length) fail("id miền chức năng bị trùng");
for (const [stage, count] of stageCounts) if (count < 10) fail(`${stage}: phạm vi quá mỏng (${count} miền)`);

const requiredV3Domains = [
  "vital-signs-screening-results",
  "injury-sports-musculoskeletal",
  "school-function-learning-neurodevelopment",
  "chronic-conditions-care-plans",
  "substance-use-risk-behaviour",
  "family-social-protective-context",
];
for (const id of requiredV3Domains) if (!ids.includes(id)) fail(`thiếu miền V3: ${id}`);

const transition = blocks.find((block) => /id: "transition-adult-care"/.test(block));
if (!transition || !/stages: \["late-adolescent"\]/.test(transition)) fail("transition-adult-care chỉ được dành cho 16–18 tuổi");
const reproductive = blocks.find((block) => /id: "relationships-reproductive-health"/.test(block));
if (!reproductive || /"foundation"/.test(reproductive.match(/stages: \[([^\]]+)\]/)?.[1] ?? "")) fail("sức khỏe sinh sản không được gắn trực tiếp vào stage 9–10 trong catalog chuyên sâu");

const trackingSource = read("app/suc-khoe-tre/health-tracking-catalog.ts");
const trackingBody = trackingSource.match(/export const HEALTH_TRACKING_ITEMS:[\s\S]*?= \[([\s\S]*?)\n\];/)?.[1];
if (!trackingBody) fail("không đọc được HEALTH_TRACKING_ITEMS");
const trackingBlocks = [...trackingBody.matchAll(/\n  \{([^\n]+)\},/g)].map((match) => match[1]);
if (trackingBlocks.length < 25) fail(`tracking catalog quá mỏng (${trackingBlocks.length} items)`);
if (!/noOverallHealthScore: true/.test(trackingSource)) fail("phải khóa nguyên tắc không dùng overall health score");
if (!/guidelineDrivenItemsRequireJurisdictionAndVersion: true/.test(trackingSource)) fail("guideline-driven tracking phải jurisdiction/version aware");
const trackedDomainIds = new Set([...trackingSource.matchAll(/domainId: "([^"]+)"/g)].map((match) => match[1]));
for (const id of requiredV3Domains) if (!trackedDomainIds.has(id)) fail(`${id}: chưa có tracking item`);

const privacySource = read("app/suc-khoe-tre/health-privacy-contracts.ts");
if (!/deviceApprovalIsNotProfileAuthorization: true/.test(privacySource)) fail("phải tách Device Gate khỏi Profile Authorization");
if (!/noLegalConsentAgeHardcoded: true/.test(privacySource)) fail("không được hard-code tuổi đồng ý pháp lý");
if (!/sensitiveNotificationsRedactedByDefault: true/.test(privacySource)) fail("notification nhạy cảm phải redacted mặc định");

const profileSource = read("app/suc-khoe-tre/health-profile-contracts.ts");
for (const rule of ["everyHealthRecordRequiresProfileId: true", "noCrossProfileTimelineMixing: true", "noCrossProfileReminderMixing: true", "deviceAccessDoesNotGrantAllProfileVisibility: true"]) {
  if (!profileSource.includes(rule)) fail(`Profile Registry thiếu rule: ${rule}`);
}

const attentionSource = read("app/suc-khoe-tre/health-attention-contracts.ts");
for (const contract of ["HealthDueItem", "HealthDataGap", "HealthTrendSignal", "HealthAttentionItem"]) {
  if (!new RegExp(`export type ${contract}`).test(attentionSource)) fail(`attention contract thiếu ${contract}`);
}
if (!/missingDataIsNotBadHealth: true/.test(attentionSource)) fail("Data Completeness không được đồng nhất với sức khỏe xấu");
if (!/maxPrimaryItemsOnToday: 5/.test(attentionSource)) fail("Today phải giới hạn attention để tránh alert fatigue");

const evidenceSource = read("app/suc-khoe-tre/health-evidence.ts");
for (const evidenceId of ["whoAdolescentHealth", "whoGamaIndicators", "vietnamSchoolHealth", "vietnamExpandedImmunization2026"]) {
  if (!new RegExp(`${evidenceId}:`).test(evidenceSource)) fail(`Evidence Registry thiếu ${evidenceId}`);
}
if (!/jurisdiction\?:/.test(evidenceSource) || !/reviewDueAt\?:/.test(evidenceSource)) fail("Evidence Registry phải có jurisdiction và reviewDueAt");

const contractsSource = read("app/suc-khoe-tre/health-record-contracts.ts");
for (const contract of ["VitalSignRecord", "ScreeningResultRecord", "ConditionRecord", "CarePlanRecord", "SymptomEpisodeRecord", "InjuryEpisodeRecord", "SchoolFunctionCheckIn", "SubstanceUseCheckIn", "SocialProtectiveContextRecord"]) {
  if (!new RegExp(`export type ${contract}`).test(contractsSource)) fail(`record contract thiếu ${contract}`);
}

console.log(`Health framework V3 PASS: ${blocks.length} domains · ${trackingBlocks.length}+ tracking items · multi-profile/privacy/attention/evidence checks OK.`);
