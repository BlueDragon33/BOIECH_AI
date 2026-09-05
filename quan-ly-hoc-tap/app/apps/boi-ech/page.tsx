import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import ControlCenter from "../../control-center";
import styles from "../../application-admin.module.css";

export const dynamic = "force-dynamic";

export default async function BoiEchAdminPage() {
  const user = await requireChatGPTUser("/apps/boi-ech");
  return <div className={styles.boiRoute}>
    <Link href="/" className={styles.boiBack}>← Chọn ứng dụng</Link>
    <ControlCenter user={{ displayName: user.displayName, email: user.email }} />
  </div>;
}
