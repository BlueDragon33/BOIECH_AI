import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "app/suc-khoe-tre/health-domain-catalog.ts");
const source = fs.readFileSync(catalogPath, "utf8");
const bodyMatch = source.match(/export const HEALTH_DOMAINS:[\s\S]*?= \[([\s\S]*?)\n\] as const;/);
if (!bodyMatch) throw new Error("Không đọc được HEALTH_DOMAINS.");

const blocks = [...bodyMatch[1].matchAll(/\n  \{\n([\s\S]*?)\n  \},/g)].map((match) => match[1]);
const fail = (message) => { throw new Error(`Framework validation failed: ${message}`); };

if (blocks.length !== 16) fail(`cần đúng 16 miền chức năng, hiện có ${blocks.length}`);

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
for (const [stage, count] of stageCounts) if (count < 8) fail(`${stage}: phạm vi quá mỏng (${count} miền)`);

const transition = blocks.find((block) => /id: "transition-adult-care"/.test(block));
if (!transition || !/stages: \["late-adolescent"\]/.test(transition)) fail("transition-adult-care chỉ được dành cho 16–18 tuổi");
const reproductive = blocks.find((block) => /id: "relationships-reproductive-health"/.test(block));
if (!reproductive || /"foundation"/.test(reproductive.match(/stages: \[([^\]]+)\]/)?.[1] ?? "")) fail("sức khỏe sinh sản không được gắn trực tiếp vào stage 9–10 trong catalog chuyên sâu");

console.log(`Health framework PASS: ${blocks.length} domains · 4 stages · privacy/guardrail checks OK.`);
