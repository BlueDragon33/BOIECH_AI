import { requireChatGPTUser } from "../chatgpt-auth";
import EditorWorkspace from "./editor-workspace";

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
  const editorHref = `/bien-tap-noi-dung?lesson=${encodeURIComponent(initialLesson)}${teacherReturn ? `&return=teacher&tab=${encodeURIComponent(returnTab)}${classQuery}` : ""}`;
  const user = await requireChatGPTUser(editorHref);
  return <EditorWorkspace user={{ displayName: user.displayName, email: user.email }} initialLesson={initialLesson} returnHref={returnHref} />;
}
