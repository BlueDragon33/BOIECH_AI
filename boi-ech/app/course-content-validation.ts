export const COURSE_DOCUMENT_SCHEMA_VERSION = 1;

type ValidationResult = { valid: boolean; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function add(errors: string[], message: string) {
  if (errors.length < 100) errors.push(message);
}

function requireText(value: unknown, path: string, errors: string[]) {
  if (typeof value !== "string" || !value.trim()) add(errors, `${path}: không được để trống.`);
}

function requireTextList(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    add(errors, `${path}: phải là danh sách từ 1–100 mục.`);
    return;
  }
  value.forEach((item, index) => requireText(item, `${path}, mục ${index + 1}`, errors));
}

function requireRecordList(
  value: unknown,
  path: string,
  errors: string[],
  validate: (item: Record<string, unknown>, itemPath: string, errors: string[]) => void,
) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    add(errors, `${path}: phải là danh sách từ 1–100 mục.`);
    return;
  }
  value.forEach((item, index) => {
    const itemPath = `${path}, mục ${index + 1}`;
    if (!isRecord(item)) add(errors, `${itemPath}: cấu trúc không hợp lệ.`);
    else validate(item, itemPath, errors);
  });
}

function validateQuestion(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) {
    add(errors, `${path}: câu hỏi không hợp lệ.`);
    return;
  }
  requireText(value.q, `${path}, nội dung`, errors);
  if (!Array.isArray(value.options) || value.options.length !== 4) {
    add(errors, `${path}: phải có đúng bốn phương án A–D.`);
  } else {
    value.options.forEach((option, index) => requireText(option, `${path}, phương án ${String.fromCharCode(65 + index)}`, errors));
  }
  if (typeof value.answer !== "number" || !Number.isInteger(value.answer) || value.answer < 0 || value.answer > 3) {
    add(errors, `${path}: đáp án phải nằm trong khoảng 0–3.`);
  }
  requireText(value.explain, `${path}, giải thích`, errors);
}

function validateQuestions(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value) || value.length !== 10) {
    add(errors, `${path}: phải có đúng mười câu hỏi.`);
    return;
  }
  value.forEach((question, index) => validateQuestion(question, `${path}, câu ${index + 1}`, errors));
}

function validateLessonOutline(value: unknown, lessonNumber: string, errors: string[]) {
  const path = `Bài ${lessonNumber}, tổng quan`;
  if (!isRecord(value)) {
    add(errors, `${path}: thiếu nội dung.`);
    return;
  }
  for (const key of ["n", "title", "meta", "status", "group", "summary", "duration", "target", "bridge"]) {
    requireText(value[key], `${path}, ${key}`, errors);
  }
  if (value.n !== lessonNumber) add(errors, `${path}: số bài không được thay đổi.`);
  requireTextList(value.objectives, `${path}, mục tiêu`, errors);
  requireRecordList(value.core, `${path}, nội dung cốt lõi`, errors, (item, itemPath, target) => {
    requireText(item.title, `${itemPath}, tiêu đề`, target);
    requireText(item.body, `${itemPath}, nội dung`, target);
  });
  requireTextList(value.practice, `${path}, thực hành`, errors);
  requireTextList(value.pass, `${path}, tiêu chí đạt`, errors);
}

function validateFoundationLesson(value: unknown, lessonNumber: string, errors: string[]) {
  const path = `Bài ${lessonNumber}`;
  if (!isRecord(value)) {
    add(errors, `${path}: thiếu nội dung.`);
    return;
  }
  if (!isRecord(value.safety)) add(errors, `${path}, an toàn: cấu trúc không hợp lệ.`);
  else {
    requireText(value.safety.title, `${path}, tiêu đề an toàn`, errors);
    requireText(value.safety.body, `${path}, nội dung an toàn`, errors);
  }
  requireRecordList(value.knowledge, `${path}, phần học`, errors, (item, itemPath, target) => {
    for (const key of ["title", "body", "cue", "avoid"]) requireText(item[key], `${itemPath}, ${key}`, target);
    requireTextList(item.steps, `${itemPath}, các bước`, target);
  });
  requireRecordList(value.analysis, `${path}, phân tích kỹ thuật`, errors, (item, itemPath, target) => {
    for (const key of ["title", "body", "cue", "avoid"]) requireText(item[key], `${itemPath}, ${key}`, target);
    requireTextList(item.steps, `${itemPath}, các bước`, target);
  });
  requireRecordList(value.drills, `${path}, thực hành`, errors, (item, itemPath, target) => {
    for (const key of ["code", "title", "goal", "volume", "pass", "safety"]) requireText(item[key], `${itemPath}, ${key}`, target);
    requireTextList(item.steps, `${itemPath}, các bước`, target);
  });
  requireRecordList(value.mistakes, `${path}, phân tích lỗi`, errors, (item, itemPath, target) => {
    for (const key of ["sign", "cause", "fix"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  requireRecordList(value.session, `${path}, buổi tập`, errors, (item, itemPath, target) => {
    for (const key of ["time", "title", "body"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  validateQuestions(value.questions, path, errors);
  requireText(value.memory, `${path}, ghi nhớ`, errors);
  for (const key of ["practiceEyebrow", "practiceTitle", "practiceText", "sessionEyebrow", "sessionTitle", "sessionText"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") add(errors, `${path}, ${key}: phải là văn bản.`);
  }
}

function validateMovement(value: unknown, errors: string[]) {
  if (!isRecord(value)) {
    add(errors, "Bài 03: thiếu nội dung kỹ thuật cốt lõi.");
    return;
  }
  requireRecordList(value.phases, "Bài 03, các pha", errors, (item, itemPath, target) => {
    for (const key of ["id", "number", "short", "title", "action", "purpose", "cue", "avoid"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  requireRecordList(value.analysisPhases, "Bài 03, phân tích các pha", errors, (item, itemPath, target) => {
    for (const key of ["id", "number", "short", "title", "action", "purpose", "cue", "avoid"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  requireRecordList(value.mistakes, "Bài 03, phân tích lỗi", errors, (item, itemPath, target) => {
    for (const key of ["id", "name", "sign", "cause", "fix", "drill"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  requireRecordList(value.practice, "Bài 03, thực hành", errors, (item, itemPath, target) => {
    for (const key of ["code", "name", "volume", "goal", "safety"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  requireRecordList(value.sessionPlan, "Bài 03, buổi tập", errors, (item, itemPath, target) => {
    for (const key of ["time", "title", "body"]) requireText(item[key], `${itemPath}, ${key}`, target);
  });
  validateQuestions(value.questions, "Bài 03", errors);
}

export function validateCourseDocument(value: unknown): ValidationResult {
  if (!isRecord(value) || value.schemaVersion !== COURSE_DOCUMENT_SCHEMA_VERSION) {
    return { valid: false, errors: ["Phiên bản cấu trúc nội dung không được hỗ trợ."] };
  }
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > 2_000_000) {
    return { valid: false, errors: ["Gói nội dung vượt giới hạn 2 MB."] };
  }

  const errors: string[] = [];
  if (!isRecord(value.lessonOutlines)) add(errors, "Thiếu nhóm tổng quan bài học.");
  const outlines = isRecord(value.lessonOutlines) ? value.lessonOutlines : {};
  for (const number of ["01", "02", "03", "04", "05", "06", "07", "08"]) {
    validateLessonOutline(outlines[number], number, errors);
  }
  if (!isRecord(value.foundationDetails)) add(errors, "Thiếu nhóm bài học nền tảng.");
  const foundation = isRecord(value.foundationDetails) ? value.foundationDetails : {};
  for (const number of ["01", "02", "04", "05", "06", "07", "08"]) {
    validateFoundationLesson(foundation[number], number, errors);
  }
  validateMovement(value.movement, errors);
  return { valid: errors.length === 0, errors };
}
