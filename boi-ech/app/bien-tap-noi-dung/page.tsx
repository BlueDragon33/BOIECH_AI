import { requireChatGPTUser } from "../chatgpt-auth";
import EditorWorkspace from "./editor-workspace";

export const dynamic = "force-dynamic";

const TEACHER_TABS = new Set(["overview","class","learners","tasks","reports","messages","schedule","profile","analysis"]);

export default async function ContentEditorPage({ searchParams }: { searchParams: Promise<{ lesson?: string; return?: string; tab?: string }> }) {
  const params = await searchParams;
  const requestedLesson = params.lesson ?? "";
  const initialLesson = /^0[1-8]$/.test(requestedLesson) ? requestedLesson : "01";
  const requestedTab = params.tab ?? "tasks";
  const returnTab = TEACHER_TABS.has(requestedTab) ? requestedTab : "tasks";
  const teacherReturn = params.return === "teacher";
  const returnHref = teacherReturn ? `/?workspace=teacher&tab=${encodeURIComponent(returnTab)}` : "/";
  const editorHref = `/bien-tap-noi-dung?lesson=${encodeURIComponent(initialLesson)}${teacherReturn ? `&return=teacher&tab=${encodeURIComponent(returnTab)}` : ""}`;
  const user = await requireChatGPTUser(editorHref);
  return <EditorWorkspace user={{ displayName: user.displayName, email: user.email }} initialLesson={initialLesson} returnHref={returnHref} />;
}
