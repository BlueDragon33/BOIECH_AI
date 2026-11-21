import EditorSessionGate from "./editor-session-gate";

export const dynamic = "force-dynamic";

const TEACHER_TABS = new Set(["overview","class","learners","tasks","reports","messages","schedule","profile","analysis"]);

export default async function ContentEditorPage({ searchParams }: { searchParams: Promise<{ lesson?: string; return?: string; tab?: string; class?: string }> }) {
  const params = await searchParams;
  const requestedLesson = params.lesson ?? "";
  const initialLesson = /^0[1-8]$/.test(requestedLesson) ? requestedLesson : "01";
  const requestedTab = params.tab ?? "tasks";
  const returnTab = TEACHER_TABS.has(requestedTab) ? requestedTab : "tasks";
  const teacherReturn = params.return === "teacher";
  const returnClass = (params.class ?? "").trim().slice(0, 100);
  const classQuery = returnClass ? `&class=${encodeURIComponent(returnClass)}` : "";
  const returnHref = teacherReturn ? `/?workspace=teacher&tab=${encodeURIComponent(returnTab)}${classQuery}` : "/";
  // Render safely even when the D1/identity readback is temporarily unavailable.
  // The editor and each mutation remain blocked until a signed teacher session
  // is confirmed independently on /api/editor/session and POST proof routes.
  return <EditorSessionGate initialLesson={initialLesson} returnHref={returnHref} />;
}
