import type { CourseDocument, CourseEditScope, CourseLessonNumber } from "./course-content.server";
import { COURSE_LESSON_NUMBERS } from "./course-content.server";
import { LESSON_PARTS, courseProgressKey, normalizeCompletedProgress } from "./course-logic";
import type { PublicQuestion, ServerQuestion } from "./course-types";

export const AI_ENGINE_VERSION = "frog-ai-rules-1.0.0";
export const AI_PROMPT_VERSION = "grounded-course-v1";

export type AiLearnerProfile = {
  completed: string[];
  scores: Record<string, number>;
  attempts: Record<string, number>;
  totalActiveSeconds: number;
  lastActivityAt: string | null;
};

export type AiSelfAssessment = {
  lessonNumber: string;
  section: string;
  rating: number;
  confidence: number;
  createdAt: string;
};

export type AiQuizHistory = {
  lessonNumber: string;
  score: number;
  passed: boolean;
  createdAt: string;
};

export type AiSourceReference = {
  lessonNumber: string;
  section: "content" | "practice" | "analysis" | "review";
  label: string;
};

type Passage = AiSourceReference & {
  title: string;
  body: string;
  tokens: Set<string>;
};

const sectionLabels: Record<AiSourceReference["section"], string> = {
  content: "Nội dung",
  practice: "Thực hành",
  analysis: "Phân tích",
  review: "Ôn tập",
};

const domainTerms = [
  "boi", "ech", "nuoc", "tho", "luot", "chan", "tay", "dap", "khép", "khep", "goi", "ky thuat",
  "an toan", "thuc hanh", "loi", "sua", "phoi hop", "bai", "hoc", "on tap", "chuot rut", "kho tho",
];

const blockedAnswerTerms = ["dap an", "cau so", "cau 1", "cau 2", "cau 3", "cau 4", "cau 5", "cau 6", "cau 7", "cau 8", "cau 9", "cau 10", "lam ho bai kiem tra"];
const emergencyTerms = ["duoi nuoc", "duoi nuoc", "khong tho duoc", "kho tho", "dau nguc", "choang", "chong mat", "chuot rut", "bat tinh"];
const stopWords = new Set(["va", "la", "cua", "cho", "toi", "minh", "em", "anh", "chi", "nen", "lam", "the", "nao", "mot", "nhung", "voi", "khi", "duoc", "can", "gi", "o", "co"]);

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return new Set(normalized(value).split(" ").filter((token) => token.length > 1 && !stopWords.has(token)));
}

function sentence(value: string, maximum = 300) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maximum) return clean;
  const shortened = clean.slice(0, maximum);
  return `${shortened.slice(0, Math.max(shortened.lastIndexOf(". "), shortened.lastIndexOf("; "), maximum - 30)).trim()}…`;
}

function addPassage(passages: Passage[], lessonNumber: string, section: AiSourceReference["section"], title: string, values: unknown[]) {
  const body = values.flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
  if (!body) return;
  const label = `Bài ${lessonNumber} · ${sectionLabels[section]} · ${title}`;
  passages.push({ lessonNumber, section, label, title, body, tokens: tokens(`${title} ${body}`) });
}

export function coursePassages(document: CourseDocument) {
  const passages: Passage[] = [];
  for (const lessonNumber of COURSE_LESSON_NUMBERS) {
    const outline = document.lessonOutlines[lessonNumber];
    addPassage(passages, lessonNumber, "content", outline.title, [outline.summary, outline.target, outline.objectives, outline.core.flatMap((item) => [item.title, item.body]), outline.bridge]);
    addPassage(passages, lessonNumber, "practice", "Tiêu chí và bài tập", [outline.practice, outline.pass]);

    if (lessonNumber === "03") {
      for (const phase of document.movement.phases) addPassage(passages, lessonNumber, "content", phase.title, [phase.action, phase.purpose, phase.cue, phase.avoid]);
      for (const phase of document.movement.analysisPhases) addPassage(passages, lessonNumber, "analysis", phase.title, [phase.action, phase.purpose, phase.cue, phase.avoid]);
      for (const drill of document.movement.practice) addPassage(passages, lessonNumber, "practice", drill.name, [drill.goal, drill.volume, drill.safety]);
      for (const item of document.movement.sessionPlan) addPassage(passages, lessonNumber, "practice", item.title, [item.time, item.body]);
      for (const mistake of document.movement.mistakes) addPassage(passages, lessonNumber, "review", mistake.name, [mistake.sign, mistake.cause, mistake.fix, mistake.drill]);
      continue;
    }

    const detail = document.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">];
    addPassage(passages, lessonNumber, "content", detail.safety.title, [detail.safety.body]);
    for (const item of detail.knowledge) addPassage(passages, lessonNumber, "content", item.title, [item.body, item.steps, item.cue, item.avoid]);
    for (const item of detail.analysis ?? detail.knowledge) addPassage(passages, lessonNumber, "analysis", item.title, [item.body, item.steps, item.cue, item.avoid]);
    for (const drill of detail.drills) addPassage(passages, lessonNumber, "practice", drill.title, [drill.goal, drill.steps, drill.volume, drill.pass, drill.safety]);
    for (const item of detail.session) addPassage(passages, lessonNumber, "practice", item.title, [item.time, item.body]);
    for (const mistake of detail.mistakes) addPassage(passages, lessonNumber, "review", mistake.sign, [mistake.cause, mistake.fix]);
    addPassage(passages, lessonNumber, "review", "Ghi nhớ cuối bài", [detail.memory]);
  }
  return passages;
}

function passageScore(passage: Passage, queryTokens: Set<string>, currentLesson: string) {
  let score = passage.lessonNumber === currentLesson ? 1.25 : 0;
  for (const token of queryTokens) if (passage.tokens.has(token)) score += token.length >= 6 ? 2.2 : 1.2;
  return score;
}

export function tutorReply(document: CourseDocument, query: string, currentLesson: string, learnerGivenName: string) {
  const startedAt = performance.now();
  const cleanQuery = query.trim().replace(/\s+/g, " ").slice(0, 500);
  const normalizedQuery = normalized(cleanQuery);
  const name = learnerGivenName.trim().slice(0, 60) || "Học viên";

  if (emergencyTerms.some((term) => normalizedQuery.includes(normalized(term)))) {
    return {
      answer: `${name}, hãy dừng bơi ngay, bám thành hoặc dùng vật nổi, báo người giám sát và rời khỏi nước nếu có thể. Nếu khó thở, đau ngực, bất tỉnh hoặc tình trạng không giảm, cần gọi cấp cứu tại địa phương. Trợ giảng không thay thế nhân viên y tế.`,
      steps: ["Dừng vận động và giữ đường thở trên mặt nước.", "Báo ngay cho người giám sát hoặc cứu hộ.", "Không quay lại tập cho tới khi đã an toàn và được đánh giá phù hợp."],
      citations: [] as AiSourceReference[],
      safety: "emergency" as const,
      engineVersion: AI_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  }

  if (blockedAnswerTerms.some((term) => normalizedQuery.includes(normalized(term)))) {
    return {
      answer: `${name}, trợ giảng không cung cấp đáp án bài kiểm tra. Tôi có thể giải thích lại nguyên tắc, gợi ý phần cần ôn và tạo một bài luyện mới không làm lộ đáp án.`,
      steps: ["Nêu kỹ thuật hoặc lỗi đang chưa rõ.", "Mở phần Ôn tập của bài tương ứng.", "Làm lại bài kiểm tra đủ 10 câu; đạt từ 8/10 để qua bài."],
      citations: [] as AiSourceReference[],
      safety: "answer-key-protected" as const,
      engineVersion: AI_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  }

  const greeting = /^(chao|xin chao|hello|hi)\b/.test(normalizedQuery);
  const looksRelevant = greeting || domainTerms.some((term) => normalizedQuery.includes(normalized(term))) || /\bbai\s*[0-8]?\d\b/.test(normalizedQuery);
  if (!looksRelevant) {
    return {
      answer: `${name}, tôi chỉ hỗ trợ nội dung thuộc môn Bơi ếch đã được nhà trường xuất bản. Hãy hỏi về an toàn, kỹ thuật, thực hành, phân tích lỗi hoặc ôn tập của một bài cụ thể.`,
      steps: [`Ví dụ: “Bài ${currentLesson}, tôi cần nhớ gì khi thực hành?”`, "Không nhập số điện thoại, thông tin sức khỏe chi tiết hoặc dữ liệu riêng tư vào câu hỏi."],
      citations: [] as AiSourceReference[],
      safety: "off-topic" as const,
      engineVersion: AI_ENGINE_VERSION,
      promptVersion: AI_PROMPT_VERSION,
      durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
    };
  }

  const queryTokens = tokens(cleanQuery);
  const ranked = coursePassages(document)
    .map((passage) => ({ passage, score: passageScore(passage, queryTokens, currentLesson) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.passage.label.localeCompare(right.passage.label, "vi"))
    .slice(0, 2);
  const selected = ranked.length > 0 ? ranked : coursePassages(document).filter((passage) => passage.lessonNumber === currentLesson).slice(0, 2).map((passage) => ({ passage, score: 0 }));
  const citations = selected.map(({ passage }) => ({ lessonNumber: passage.lessonNumber, section: passage.section, label: passage.label }));
  const steps = selected.map(({ passage }) => `${passage.title}: ${sentence(passage.body, 220)}`);
  return {
    answer: `${name}, theo bài giảng đã được duyệt, ${steps.map((item) => item.charAt(0).toLowerCase() + item.slice(1)).join(" Tiếp theo, ")}`,
    steps,
    citations,
    safety: "grounded" as const,
    engineVersion: AI_ENGINE_VERSION,
    promptVersion: AI_PROMPT_VERSION,
    durationMs: Math.max(1, Math.round(performance.now() - startedAt)),
  };
}

function lessonMastery(profile: AiLearnerProfile, assessments: AiSelfAssessment[], lessonNumber: string) {
  const completed = normalizeCompletedProgress(profile.completed);
  const partCount = LESSON_PARTS.filter((part) => completed.includes(courseProgressKey(part, lessonNumber))).length;
  const score = profile.scores[lessonNumber];
  const latestAssessment = assessments.find((item) => item.lessonNumber === lessonNumber);
  const progressValue = (partCount / 5) * 55;
  const scoreValue = score === undefined ? 0 : (score / 10) * 35;
  const selfValue = latestAssessment ? (latestAssessment.rating / 5) * 10 : 0;
  return Math.max(0, Math.min(100, Math.round(progressValue + scoreValue + selfValue)));
}

export function learnerIntelligence(document: CourseDocument, profile: AiLearnerProfile, assessments: AiSelfAssessment[], history: AiQuizHistory[] = []) {
  const completed = normalizeCompletedProgress(profile.completed);
  const unlocked = COURSE_LESSON_NUMBERS.filter((lesson, index) => index === 0 || completed.includes(`bai-${COURSE_LESSON_NUMBERS[index - 1]}`));
  const competencies = COURSE_LESSON_NUMBERS.map((lessonNumber) => ({
    lessonNumber,
    label: document.lessonOutlines[lessonNumber].title,
    mastery: lessonMastery(profile, assessments, lessonNumber),
    attempts: Math.max(0, Number(profile.attempts[lessonNumber]) || 0),
    score: profile.scores[lessonNumber] ?? null,
    unlocked: unlocked.includes(lessonNumber),
  }));
  const priority = competencies.filter((item) => item.unlocked).sort((left, right) => left.mastery - right.mastery || right.attempts - left.attempts)[0] ?? competencies[0];
  const nextPart = LESSON_PARTS.find((part) => !completed.includes(courseProgressKey(part, priority.lessonNumber))) ?? "on-tap";
  const nextPartLabel = { "hoc-tap": "Nội dung", "thuc-hanh": "Thực hành", "phan-tich": "Phân tích", "on-tap": "Ôn tập", "kiem-tra": "Kiểm tra" }[nextPart];
  const now = Date.now();
  const lastActivity = profile.lastActivityAt ? Date.parse(profile.lastActivityAt) : Number.NaN;
  const inactiveDays = Number.isFinite(lastActivity) ? Math.floor((now - lastActivity) / 86_400_000) : null;
  const alerts: { level: "info" | "warning" | "critical"; code: string; text: string }[] = [];
  if (inactiveDays === null || inactiveDays >= 7) alerts.push({ level: "warning", code: "inactive", text: inactiveDays === null ? "Chưa có hoạt động học được ghi nhận." : `Không có hoạt động học trong ${inactiveDays} ngày.` });
  if (priority.attempts >= 3 && (priority.score ?? 0) < 8) alerts.push({ level: "critical", code: "repeated-failure", text: `Bài ${priority.lessonNumber} đã làm ${priority.attempts} lượt nhưng chưa đạt 8/10.` });
  if (priority.mastery < 35) alerts.push({ level: "warning", code: "low-mastery", text: `Năng lực Bài ${priority.lessonNumber} đang ở mức ${priority.mastery}%.` });

  const beforeAfter = COURSE_LESSON_NUMBERS.map((lessonNumber) => {
    const rows = history.filter((item) => item.lessonNumber === lessonNumber);
    return rows.length > 0 ? { lessonNumber, first: rows[0].score, latest: rows.at(-1)!.score, best: Math.max(...rows.map((item) => item.score)), attempts: rows.length } : null;
  }).filter(Boolean);

  return {
    generatedAt: new Date().toISOString(),
    engineVersion: AI_ENGINE_VERSION,
    profileVersion: "competency-v1",
    priorityLesson: priority.lessonNumber,
    priorityPart: nextPart,
    competencies,
    alerts,
    beforeAfter,
    todayPlan: [
      { id: "continue", minutes: 12, lessonNumber: priority.lessonNumber, section: nextPart, title: `Tiếp tục Bài ${priority.lessonNumber} · ${nextPartLabel}`, reason: `Đây là bước chưa hoàn thành gần nhất trong bài ưu tiên.` },
      { id: "review", minutes: 8, lessonNumber: priority.lessonNumber, section: "on-tap", title: `Ôn một lỗi trọng tâm của Bài ${priority.lessonNumber}`, reason: `Mức nắm vững hiện tại là ${priority.mastery}%.` },
      { id: "reflect", minutes: 2, lessonNumber: priority.lessonNumber, section: nextPart, title: "Tự đánh giá sau lượt tập", reason: "Dữ liệu tự đánh giá giúp lộ trình lần sau sát hơn." },
    ],
  };
}

function questionBank(document: CourseDocument, lessonNumber: CourseLessonNumber): readonly ServerQuestion[] {
  return lessonNumber === "03" ? document.movement.questions : document.foundationDetails[lessonNumber as Exclude<CourseLessonNumber, "03">].questions;
}

function seededOffset(seed: string) {
  return [...seed].reduce((total, character) => (total * 31 + character.charCodeAt(0)) % 10_007, 17);
}

export type AiQuizQuestionRef = { lessonNumber: CourseLessonNumber; questionIndex: number };

export function adaptiveQuiz(document: CourseDocument, profile: AiLearnerProfile, assessments: AiSelfAssessment[], seed: string) {
  const intelligence = learnerIntelligence(document, profile, assessments);
  const priorities = intelligence.competencies.filter((item) => item.unlocked).sort((left, right) => left.mastery - right.mastery || right.attempts - left.attempts).map((item) => item.lessonNumber as CourseLessonNumber);
  const weighted = priorities.length > 1 ? [priorities[0], priorities[0], ...priorities.slice(1)] : priorities;
  const offsets = new Map<CourseLessonNumber, number>();
  const refs: AiQuizQuestionRef[] = [];
  let turn = 0;
  while (refs.length < 10 && turn < 200) {
    const lessonNumber = weighted[turn % weighted.length] ?? "01";
    const bank = questionBank(document, lessonNumber);
    const localOffset = offsets.get(lessonNumber) ?? 0;
    const questionIndex = (seededOffset(`${seed}:${lessonNumber}`) + localOffset * 3) % bank.length;
    offsets.set(lessonNumber, localOffset + 1);
    if (!refs.some((item) => item.lessonNumber === lessonNumber && item.questionIndex === questionIndex)) refs.push({ lessonNumber, questionIndex });
    turn += 1;
  }
  const questions: (PublicQuestion & { lessonNumber: string })[] = refs.map((ref) => {
    const item = questionBank(document, ref.lessonNumber)[ref.questionIndex];
    return { q: item.q, options: item.options, lessonNumber: ref.lessonNumber };
  });
  return { refs, questions, passScore: 8, questionCount: 10, focusLessons: [...new Set(refs.map((item) => item.lessonNumber))] };
}

export function scoreAdaptiveQuiz(document: CourseDocument, refs: AiQuizQuestionRef[], answers: number[]) {
  return refs.reduce((score, ref, index) => score + (questionBank(document, ref.lessonNumber)[ref.questionIndex]?.answer === answers[index] ? 1 : 0), 0);
}

export type AiDraftSuggestion = {
  id: string;
  path: (string | number)[] | null;
  before: string | null;
  after: string | null;
  reason: string;
  severity: "improve" | "warning";
};

function editableStrings(value: unknown, path: (string | number)[] = [], output: { path: (string | number)[]; key: string; value: string }[] = []) {
  if (Array.isArray(value)) value.forEach((item, index) => editableStrings(item, [...path, index], output));
  else if (value && typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, item]) => editableStrings(item, [...path, key], output));
  else if (typeof value === "string") output.push({ path, key: String(path.at(-1) ?? ""), value });
  return output;
}

export function contentDraftSuggestions(content: unknown, scope: CourseEditScope) {
  const strings = editableStrings(content);
  const suggestions: AiDraftSuggestion[] = [];
  const candidates = strings.filter((item) => !["id", "n", "number", "code", "status", "group", "time", "volume"].includes(item.key));
  const safety = candidates.find((item) => item.key === "safety" || normalized(item.value).includes("an toan"));
  if (scope.section !== "quiz" && !safety) {
    suggestions.push({ id: "safety-gap", path: null, before: null, after: null, reason: "Phần này chưa có chỉ dẫn an toàn rõ ràng. Hãy bổ sung điều kiện giám sát, tín hiệu phải dừng và mức tập phù hợp.", severity: "warning" });
  }
  for (const item of candidates) {
    if (suggestions.filter((suggestion) => suggestion.path).length >= 3) break;
    const before = item.value.trim();
    if (before.length < 18 || before.length > 480 || /[{}<>]/.test(before)) continue;
    let addition = "";
    let reason = "";
    if (["goal", "target", "pass"].includes(item.key) && !/quan sat|do duoc|thuc hien|dat/i.test(normalized(before))) {
      addition = " Tiêu chí quan sát: thực hiện đúng trình tự, ổn định và có người giám sát.";
      reason = "Chuyển mục tiêu thành kết quả có thể quan sát và đánh giá.";
    } else if (["body", "summary", "practiceText", "sessionText"].includes(item.key) && before.length < 150) {
      addition = " Thực hiện từ chậm đến hoàn chỉnh; chỉ tăng mức khi dấu hiệu đúng được lặp lại ổn định.";
      reason = "Bổ sung nguyên tắc tăng dần và tiêu chí chuyển mức cho người học online.";
    } else if (["avoid", "fix", "cause"].includes(item.key) && before.length < 110) {
      addition = " Sau mỗi lượt, đối chiếu một dấu hiệu duy nhất rồi mới điều chỉnh tiếp.";
      reason = "Giúp người học tự sửa một lỗi mỗi lần, tránh quá tải chỉ dẫn.";
    } else if (item.key === "safety" && !/dung|giam sat|khong boi mot minh/i.test(normalized(before))) {
      addition = " Dừng ngay khi đau, chóng mặt, chuột rút hoặc khó thở và báo người giám sát.";
      reason = "Làm rõ tín hiệu dừng khẩn cấp trong bài thực hành.";
    }
    if (addition) suggestions.push({ id: `field-${suggestions.length + 1}`, path: item.path, before, after: `${before}${addition}`, reason, severity: "improve" });
  }
  if (scope.section === "quiz") suggestions.push({ id: "quiz-human-check", path: null, before: null, after: null, reason: "AI không tự đổi đáp án. Giáo viên cần kiểm tra tính đơn nghĩa của câu hỏi, bốn phương án và lời giải trước khi gửi duyệt.", severity: "warning" });
  if (suggestions.length === 0) suggestions.push({ id: "quality-ok", path: null, before: null, after: null, reason: "Cấu trúc hiện tại đã đủ rõ. Hãy đọc lại tính chính xác chuyên môn và điều kiện an toàn trước khi gửi Trung tâm.", severity: "improve" });
  return { engineVersion: AI_ENGINE_VERSION, promptVersion: "content-review-v1", scope: scope.value, suggestions };
}
