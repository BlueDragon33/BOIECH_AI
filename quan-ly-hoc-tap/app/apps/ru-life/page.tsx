import Link from "next/link";
import RuLifeAdminClient from "../../ru-life-admin-client";
import { requireChatGPTUser } from "../../chatgpt-auth";
import styles from "../../application-admin.module.css";

export const dynamic = "force-dynamic";

export default async function RuLifeAdminPage() {
  const user = await requireChatGPTUser("/apps/ru-life");
  return <main className={styles.appShell}><div className={styles.appFrame}>
    <Link href="/?view=client-devices" className={styles.backLink}>← Trung tâm · thiết bị mới</Link>
    <header className={styles.appHeader}><div><span>Ứng dụng độc lập · Control API</span><h1>Quản trị Hòa nhập Nga</h1><p>Thiết bị HN, người dùng, phiên và audit vẫn thuộc RU_LIFE. Dùng khu này khi thao tác ở Trung tâm cần bổ sung thông tin như Họ tên và Mã người dùng trước khi duyệt.</p></div><div className={styles.userCard}><strong>{user.displayName}</strong><small>{user.email}</small></div></header>
    <RuLifeAdminClient user={{ displayName: user.displayName, email: user.email }} />
  </div></main>;
}
