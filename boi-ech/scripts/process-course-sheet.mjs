import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [, , lessonNumber, group, source] = process.argv;
if (!/^0[1-8]$/.test(lessonNumber ?? "") || !["technique", "diagnostic"].includes(group) || !source) {
  throw new Error("Cách dùng: node scripts/process-course-sheet.mjs <01-08> <technique|diagnostic> <sheet.png>");
}

const namespace = "be-visuals-v1-4e3b9a7c13d8f06fa571c92b8e64f10d";
const dimensions = execFileSync("identify", ["-format", "%w %h", source], { encoding: "utf8" }).trim().split(/\s+/).map(Number);
const [width, height] = dimensions;
if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1200 || height < 675) {
  throw new Error("Storyboard không đủ độ phân giải để tách thành tám ảnh.");
}

const destination = path.resolve("public/course-media");
mkdirSync(destination, { recursive: true });
const cellWidth = Math.floor(width / 4);
const cellHeight = Math.floor(height / 2);

for (let index = 0; index < 8; index += 1) {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const id = createHash("sha256")
    .update(`${namespace}:${lessonNumber}:${group}:${index}`)
    .digest("hex")
    .slice(0, 32);
  execFileSync("convert", [
    source,
    "-crop", `${cellWidth}x${cellHeight}+${column * cellWidth}+${row * cellHeight}`,
    "+repage",
    "-resize", "960x540>",
    "-strip",
    "-quality", "82",
    path.join(destination, `${id}.webp`),
  ]);
}

console.log(`Đã xử lý 8 ảnh ${group} cho Bài ${lessonNumber}.`);
