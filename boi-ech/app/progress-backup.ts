/**
 * P3 local backup import. Deliberately restores only unfinished quiz drafts:
 * this data is untrusted, and never carries server-authoritative completion,
 * grades, entitlement, certificate status, or identity verification.
 */
export type LocalQuizDraft = {
  answers: Record<number, number>;
  lessonAnswers: Record<string, number>;
  lessonFlags: Record<string, number[]>;
  lessonChecked: Record<string, number[]>;
  flags: number[];
  checked: number[];
};

const MAX_BACKUP_BYTES = 256 * 1024;
const MAX_QUESTIONS = 10;
const LESSON_KEY = /^(0[1-8])-(?:[0-9])$/;
const LESSON = /^0[1-8]$/;
const QUESTION_INDEX = /^(?:0|[1-9])$/;

function fail(): never {
  throw new Error("Tệp sao lưu không đúng định dạng bản nháp Bơi Ếch.");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function index(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < MAX_QUESTIONS;
}
function indexList(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > MAX_QUESTIONS || !value.every(index)) fail();
  return [...new Set(value)];
}
function answers(value: unknown, key: RegExp): Record<string, number> {
  if (value === undefined) return {};
  const input = record(value);
  if (Object.keys(input).length > 80) fail();
  const safe: Record<string, number> = {};
  for (const [name, choice] of Object.entries(input)) {
    if (!key.test(name) || !index(choice)) fail();
    safe[name] = choice;
  }
  return safe;
}
function arrays(value: unknown): Record<string, number[]> {
  if (value === undefined) return {};
  const input = record(value);
  if (Object.keys(input).length > 8) fail();
  const safe: Record<string, number[]> = {};
  for (const [lesson, items] of Object.entries(input)) {
    if (!LESSON.test(lesson)) fail();
    safe[lesson] = indexList(items);
  }
  return safe;
}

export function parseLocalQuizBackup(source: string, currentLearner: string): LocalQuizDraft {
  if (typeof source !== "string" || source.length > MAX_BACKUP_BYTES) fail();
  let data: unknown;
  try { data = JSON.parse(source); } catch { return fail(); }
  const top = record(data);
  if (top.mon_hoc !== "Ứng dụng AI trong dạy và học môn Bơi ếch") fail();
  if (top.backup_version !== undefined && top.backup_version !== 2) fail();
  const owner = typeof top.hoc_vien === "string" ? top.hoc_vien.trim().normalize("NFC") : "";
  const current = currentLearner.trim().normalize("NFC");
  if (!owner || !current || owner !== current) {
    throw new Error("Tệp sao lưu thuộc hồ sơ học viên khác hoặc thiếu thông tin đối chiếu.");
  }
  const progress = record(top.tien_do);
  // The accepted top-level schema is intentionally narrow. New fields added to
  // a backup cannot elevate rights: the parser reads only quiz answer drafts.
  const legacyAnswers = answers(progress.answers, QUESTION_INDEX);
  const lessonAnswers = answers(progress.lessonAnswers, LESSON_KEY);
  return {
    answers: Object.fromEntries(Object.entries(legacyAnswers).map(([key,value]) => [Number(key),value])),
    lessonAnswers,
    lessonFlags: arrays(progress.lessonFlags),
    lessonChecked: arrays(progress.lessonChecked),
    flags: progress.flags === undefined ? [] : indexList(progress.flags),
    checked: progress.checked === undefined ? [] : indexList(progress.checked),
  };
}
