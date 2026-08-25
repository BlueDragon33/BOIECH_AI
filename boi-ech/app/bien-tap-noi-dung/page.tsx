import { requireChatGPTUser } from "../chatgpt-auth";
import EditorWorkspace from "./editor-workspace";

export const dynamic = "force-dynamic";

export default async function ContentEditorPage({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const user = await requireChatGPTUser("/bien-tap-noi-dung");
  const requestedLesson = (await searchParams).lesson ?? "";
  const initialLesson = /^0[1-8]$/.test(requestedLesson) ? requestedLesson : "01";
  return <EditorWorkspace user={{ displayName: user.displayName, email: user.email }} initialLesson={initialLesson} />;
}
