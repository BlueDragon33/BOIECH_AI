import { requireChatGPTUser } from "../../chatgpt-auth";
import BaumanControlCenter from "../../bauman-control-center";

export const dynamic = "force-dynamic";

export default async function BaumanAdminPage() {
  const user = await requireChatGPTUser("/apps/bauman-master-ai");
  return <BaumanControlCenter user={{ displayName: user.displayName, email: user.email }} />;
}