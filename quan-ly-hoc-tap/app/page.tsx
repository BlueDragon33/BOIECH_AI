import { requireChatGPTUser } from "./chatgpt-auth";
import ControlCenter from "./control-center";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <ControlCenter user={{ displayName: user.displayName, email: user.email }} />;
}
