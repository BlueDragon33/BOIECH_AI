import { requireChatGPTUser } from "../../chatgpt-auth";
import HealthControlCenterV2 from "../../health-control-center-v2";

export const dynamic = "force-dynamic";

export default async function ChildHealthAdminPage() {
  const user = await requireChatGPTUser("/apps/suc-khoe-tre");
  return <HealthControlCenterV2 user={{ displayName: user.displayName, email: user.email }} />;
}
