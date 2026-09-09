import Link from "next/link";
import BaumanAdminClient from "../../bauman-admin-client";
import { requireChatGPTUser } from "../../chatgpt-auth";
import styles from "../../application-admin.module.css";

export const dynamic = "force-dynamic";

export default async function BaumanAdminPage() {
  const user = await requireChatGPTUser("/apps/bauman-master-ai");
  return <main className={styles.appShell}><div className={styles.appFrame}>
    <Link href="/" className={styles.backLink}>← Trung tâm · chọn ứng dụng</Link>
    <header className={styles.appHeader}><div><span>Ứng dụng độc lập · Control API</span><h1>Quản trị Bauman Master AI</h1><p>Quản trị Bauman được tách khỏi runtime học tập. Thiết bị, sub-client và contract chỉ được đọc hoặc điều khiển qua Bauman Control API; không dùng registry hay hàng đợi của Bơi ếch/Sức khỏe Y tế.</p></div><div className={styles.userCard}><strong>{user.displayName}</strong><small>{user.email}</small></div></header>
    <BaumanAdminClient user={{ displayName: user.displayName, email: user.email }} />
  </div></main>;
}
