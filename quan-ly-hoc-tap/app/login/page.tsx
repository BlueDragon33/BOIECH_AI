import Link from "next/link";
import { adminPasswordScheme } from "../admin-session.server";
import styles from "../application-admin.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const scheme = await adminPasswordScheme();
  const ready = scheme === "sha256" || scheme === "pbkdf2-sha256";

  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>Trung tâm quản trị · Cloudflare Workers</span>
    <h1>Đăng nhập quản trị</h1>
    <p>Phiên đăng nhập này chỉ dùng trên Worker quản trị trực tiếp. Sau khi đăng nhập, quyền thao tác vẫn tiếp tục bị ràng buộc với tài khoản chủ và khóa ECDSA của laptop.</p>
    {params.error ? <div className={styles.error}>Mật khẩu quản trị không đúng hoặc phiên đăng nhập chưa được cấu hình đầy đủ.</div> : null}
    {!ready ? <div className={styles.error}>Cấu hình `ADMIN_PASSWORD_HASH` hiện chưa ở định dạng được hỗ trợ. Hệ thống không mở quyền truy cập thay thế.</div> : null}
    <form method="post" action="/api/auth/login">
      <label style={{ display: "block", fontWeight: 800, marginBottom: 7 }} htmlFor="password">Mật khẩu quản trị</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={!ready} style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cfc9bd", borderRadius: 10, font: "inherit", marginBottom: 14 }} />
      <button className={styles.primaryButton} type="submit" disabled={!ready}>Đăng nhập</button>
    </form>
    <p style={{ marginTop: 18 }}><Link href="/">Quay lại Trung tâm</Link></p>
  </section></main>;
}
