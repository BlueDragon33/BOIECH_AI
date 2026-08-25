export type ServerQuestion = {
  q: string;
  options: string[];
  answer: number;
  explain: string;
};

export type LessonOutline = {
  n: string;
  title: string;
  meta: string;
  status: string;
  group: string;
  summary: string;
  duration: string;
  target: string;
  objectives: string[];
  core: { title: string; body: string }[];
  practice: string[];
  pass: string[];
  bridge: string;
};

export type PublicQuestion = Pick<ServerQuestion, "q" | "options"> & {
  image?: LessonVisual;
  optionImages?: LessonVisual[];
};

export type LessonVisual = {
  src: string;
  alt: string;
};

export type LessonVisualSet = {
  cover: LessonVisual;
  technique: LessonVisual[];
  diagnostics: LessonVisual[];
};

export type FoundationDetail = {
  safety: { title: string; body: string };
  knowledge: {
    title: string;
    body: string;
    steps: string[];
    cue: string;
    avoid: string;
  }[];
  analysis?: {
    title: string;
    body: string;
    steps: string[];
    cue: string;
    avoid: string;
  }[];
  drills: {
    code: string;
    title: string;
    goal: string;
    steps: string[];
    volume: string;
    pass: string;
    safety: string;
  }[];
  mistakes: { sign: string; cause: string; fix: string }[];
  session: { time: string; title: string; body: string }[];
  questions: ServerQuestion[];
  memory: string;
  practiceEyebrow?: string;
  practiceTitle?: string;
  practiceText?: string;
  sessionEyebrow?: string;
  sessionTitle?: string;
  sessionText?: string;
};

export type PublicFoundationDetail = Omit<FoundationDetail, "questions"> & {
  questions: PublicQuestion[];
};

export type MovementPhase = {
  id: string;
  number: string;
  short: string;
  title: string;
  action: string;
  purpose: string;
  cue: string;
  avoid: string;
};

export type MovementMistake = {
  id: string;
  name: string;
  sign: string;
  cause: string;
  fix: string;
  drill: string;
};

export type MovementDrill = {
  code: string;
  name: string;
  volume: string;
  goal: string;
  safety: string;
};

export type SessionItem = { time: string; title: string; body: string };

export type LessonContentPayload =
  | {
      kind: "foundation";
      lessonNumber: string;
      detail: PublicFoundationDetail;
      visuals: LessonVisualSet;
    }
  | {
      kind: "movement";
      lessonNumber: "03";
      phases: MovementPhase[];
      analysisPhases?: MovementPhase[];
      mistakes: MovementMistake[];
      practice: MovementDrill[];
      sessionPlan: SessionItem[];
      questions: PublicQuestion[];
      visuals: LessonVisualSet;
    };

export type QuizFeedback = {
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

export type ServerCourseState = {
  completed: string[];
  scores: Record<string, number>;
  boundDevice: true;
};
