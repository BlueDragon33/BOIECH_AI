import { requireChatGPTUser } from "./chatgpt-auth";
import ApplicationHub from "./application-hub";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <ApplicationHub user={{ displayName: user.displayName, email: user.email }} />;
}
