import Link from "next/link";
import { adminPasswordScheme } from "../admin-session.server";
import { googleClientId } from "../google-auth.server";
import styles from "../application-admin.module.css";

export const dynamic = "force-dynamic";

const GOOGLE_LOGIN_URI = "https://learning-management.boiech-ai.workers.dev/api/auth/google";

const googleErrorMessages: Record<string, string> = {
  csrf: "Phiên Google Sign-In không hợp lệ. Hãy tải lại trang và thử lại.",
  not_allowed: "Tài khoản Google này không nằm trong danh sách chủ hệ thống hoặc token Google không hợp lệ.",
  session: "Google đã xác thực nhưng Worker chưa thể tạo phiên quản trị.",
  runtime: "Không thể hoàn tất đăng nhập Google. Hãy thử lại hoặc dùng mật khẩu dự phòng.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; google_error?: string }> }) {
  const params = await searchParams;
  const [scheme, clientId] = await Promise.all([adminPasswordScheme(), googleClientId()]);
  const passwordReady = scheme === "sha256" || scheme === "pbkdf2-sha256";
  const googleReady = Boolean(clientId);
  const googleError = params.google_error ? googleErrorMessages[params.google_error] ?? googleErrorMessages.runtime : "";

  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>Trung tâm quản trị · Cloudflare Workers</span>
    <h1>Đăng nhập quản trị</h1>
    <p>Ưu tiên đăng nhập bằng tài khoản Google/Gmail của chủ hệ thống. Quyền thao tác vẫn tiếp tục bị ràng buộc với thiết bị quản trị và khóa ECDSA của máy.</p>

    {googleError ? <div className={styles.error}>{googleError}</div> : null}
    {googleReady ? <>
      <script src="https://accounts.google.com/gsi/client" async defer />
      <div style={{ margin: "20px 0 8px" }}>
        <div
          id="g_id_onload"
          data-client_id={clientId}
          data-context="signin"
          data-ux_mode="redirect"
          data-login_uri={GOOGLE_LOGIN_URI}
          data-auto_prompt="false"
        />
        <div
          className="g_id_signin"
          data-type="standard"
          data-shape="rectangular"
          data-theme="outline"
          data-text="signin_with"
          data-size="large"
          data-logo_alignment="left"
          data-width="360"
        />
      </div>
      <p style={{ margin: "8px 0 18px", fontSize: 13, opacity: .82 }}>Chỉ Gmail/Google Account có email nằm trong <code>CONTROL_OWNER_EMAILS</code> mới được vào Trung tâm.</p>
    </> : <div style={{ margin: "18px 0", padding: "12px 14px", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10 }}>
      <strong style={{ display: "block", marginBottom: 5 }}>Đăng nhập bằng Google đang chờ cấu hình một lần.</strong>
      <span style={{ fontSize: 13, opacity: .82 }}>Cần thêm <code>GOOGLE_CLIENT_ID</code> của Web OAuth Client cho domain <code>learning-management.boiech-ai.workers.dev</code>. Sau khi cấu hình, nút Google sẽ tự xuất hiện.</span>
    </div>}

    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}><span style={{ height: 1, background: "rgba(255,255,255,.14)", flex: 1 }} /><small style={{ opacity: .7 }}>hoặc dùng phương án dự phòng</small><span style={{ height: 1, background: "rgba(255,255,255,.14)", flex: 1 }} /></div>

    {params.error ? <div className={styles.error}>Mật khẩu quản trị không đúng hoặc phiên đăng nhập chưa được cấu hình đầy đủ.</div> : null}
    {!passwordReady ? <div className={styles.error}>Cấu hình `ADMIN_PASSWORD_HASH` hiện chưa ở định dạng được hỗ trợ. Hệ thống không mở quyền truy cập thay thế.</div> : null}
    <form method="post" action="/api/auth/login">
      <label style={{ display: "block", fontWeight: 800, marginBottom: 7 }} htmlFor="password">Mật khẩu quản trị</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={!passwordReady} style={{ width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cfc9bd", borderRadius: 10, font: "inherit", marginBottom: 14 }} />
      <button className={styles.primaryButton} type="submit" disabled={!passwordReady}>Đăng nhập dự phòng</button>
    </form>
    <p style={{ marginTop: 18 }}><Link href="/">Quay lại Trung tâm</Link></p>
  </section></main>;
}
