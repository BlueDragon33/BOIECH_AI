import { requireChatGPTUser } from "../chatgpt-auth";
import HealthEditorWorkspace from "./workspace";
import "./editor.css";

export const dynamic = "force-dynamic";

export default async function HealthContentEditorPage() {
  const user = await requireChatGPTUser("/bien-tap-suc-khoe-tre");
  return <HealthEditorWorkspace user={{ displayName: user.displayName, email: user.email }} />;
}
