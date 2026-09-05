import { requireChatGPTUser } from "../../chatgpt-auth";
import HealthControlCenter from "../../health-control-center";

export const dynamic = "force-dynamic";

export default async function ChildHealthAdminPage() {
  const user = await requireChatGPTUser("/apps/suc-khoe-tre");
  return <HealthControlCenter user={{ displayName: user.displayName, email: user.email }} />;
}
