export const LESSON_PARTS = ["hoc-tap", "thuc-hanh", "phan-tich", "on-tap", "kiem-tra"] as const;

export type LessonPart = (typeof LESSON_PARTS)[number];

export function courseProgressKey(part: LessonPart, lessonNumber: string) {
  return lessonNumber === "03" ? part : `${part}-${lessonNumber}`;
}

export function firstMissingPrerequisite(
  completed: readonly string[],
  lessonNumber: string,
  targetPart: LessonPart,
): LessonPart | null {
  const targetIndex = LESSON_PARTS.indexOf(targetPart);
  if (targetIndex <= 0) return null;

  return (
    LESSON_PARTS.slice(0, targetIndex).find(
      (part) => !completed.includes(courseProgressKey(part, lessonNumber)),
    ) ?? null
  );
}

export function canSubmitLesson(completed: readonly string[], lessonNumber: string) {
  return firstMissingPrerequisite(completed, lessonNumber, "kiem-tra") === null;
}

export function normalizeCompletedProgress(value: unknown) {
  const completed = new Set(
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
  );

  for (let number = 1; number <= 8; number += 1) {
    const lessonNumber = String(number).padStart(2, "0");
    if (!completed.has(`bai-${lessonNumber}`)) continue;
    LESSON_PARTS.forEach((part) => completed.add(courseProgressKey(part, lessonNumber)));
  }

  return [...completed];
}
