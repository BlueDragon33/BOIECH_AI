import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(here, "../app/suc-khoe-tre/who-bmi-lms-9-18.ts");
const enginePath = resolve(here, "../app/suc-khoe-tre/who-bmi-reference.ts");
const dataSource = readFileSync(dataPath, "utf8");
const engineSource = readFileSync(enginePath, "utf8");

function rowsFor(name) {
  const pattern = new RegExp(`export const ${name}:[\\s\\S]*?= \\[([\\s\\S]*?)\\] as const;`);
  const body = dataSource.match(pattern)?.[1];
  if (!body) throw new Error(`Không tìm thấy bảng ${name}`);
  return [...body.matchAll(/\[(\d+),\s*(-?\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\]/g)]
    .map((match) => match.slice(1).map(Number));
}

function near(actual, expected, epsilon = 0.00001) {
  if (Math.abs(actual - expected) > epsilon) throw new Error(`Sai mốc WHO: nhận ${actual}, cần ${expected}`);
}

for (const [name, checks] of [
  ["WHO_BMI_BOYS_9_18", [[108,-1.6318,16.049,0.10038],[180,-1.4961,19.7744,0.12412],[216,-1.026,21.7077,0.12836],[227,-0.8578,22.1514,0.12939]]],
  ["WHO_BMI_GIRLS_9_18", [[108,-1.465,16.0964,0.11816],[180,-1.1311,20.2125,0.13904],[216,-0.8462,21.2603,0.1433],[227,-0.7577,21.4143,0.14432]]],
]) {
  const rows = rowsFor(name);
  if (rows.length !== 120) throw new Error(`${name}: cần 120 tháng (108–227), nhận ${rows.length}`);
  rows.forEach((row, index) => {
    const expectedMonth = 108 + index;
    if (row[0] !== expectedMonth) throw new Error(`${name}: tháng thứ ${index} là ${row[0]}, cần ${expectedMonth}`);
    if (!(row[2] > 0) || !(row[3] > 0)) throw new Error(`${name}: M/S không hợp lệ tại tháng ${row[0]}`);
  });
  for (const expected of checks) {
    const row = rows.find((item) => item[0] === expected[0]);
    if (!row) throw new Error(`${name}: thiếu mốc ${expected[0]}`);
    expected.slice(1).forEach((value, index) => near(row[index + 1], value));
  }
}

if (!dataSource.includes("WHO_PRODUCT_MIN_MONTH = 108") || !dataSource.includes("WHO_PRODUCT_MAX_MONTH = 227")) {
  throw new Error("Ranh giới sản phẩm 9–18 tuổi chưa khóa ở 108–227 tháng");
}
if (!engineSource.includes('reason: "outside-9-18-scope"')) throw new Error("Engine chưa có trạng thái ngoài phạm vi 9–18");
if (engineSource.match(/BMI người lớn/g)?.length && !engineSource.includes("Không tự chuyển sang ngưỡng BMI người lớn")) {
  throw new Error("Cần giữ ranh giới rõ giữa BMI-for-age và BMI người lớn");
}

console.log("WHO BMI-for-age 9–18 validation PASS: 120 tháng × 2 giới, các mốc kiểm tra khớp bảng tham chiếu.");
