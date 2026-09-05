import Link from "next/link";
import { requireChatGPTUser } from "../../chatgpt-auth";
import styles from "../../application-admin.module.css";

export const dynamic = "force-dynamic";

export default async function BaumanAdminPage() {
  const user = await requireChatGPTUser("/apps/bauman-master-ai");
  return <main className={styles.appShell}><div className={styles.appFrame}>
    <Link href="/" className={styles.backLink}>← Trung tâm · chọn ứng dụng</Link>
    <header className={styles.appHeader}><div><span>Ứng dụng độc lập</span><h1>Quản trị Bauman Master AI</h1><p>Khu vực này được giữ riêng để kết nối contract quản trị của Bauman Master AI. Không dùng dữ liệu, API thiết bị hay hàng đợi nội dung của Bơi ếch và Sức khỏe trẻ.</p></div><div className={styles.userCard}><strong>{user.displayName}</strong><small>{user.email}</small></div></header>
    <section className={styles.panel}><span className={styles.sectionEyebrow}>Trạng thái</span><h2>Khung quản trị riêng đã được tách tuyến.</h2><p>Chỉ khi backend quản trị Bauman được nối vào Trung tâm thì các tab chức năng của ứng dụng này mới được bật. Việc này không ảnh hưởng hai ứng dụng còn lại.</p></section>
  </div></main>;
}
