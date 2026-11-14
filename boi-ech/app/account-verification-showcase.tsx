"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./account-verification-showcase.module.css";

type Props = {
  phase: "checking" | "verified";
  accountName?: string;
  role?: string;
  error?: string;
  busy?: boolean;
  onRetry: () => void;
  onGo: () => void;
};

const steps = [
  ["01", "Nhận diện phiên", "Đối chiếu phiên đăng nhập với máy chủ"],
  ["02", "Xác thực quyền và thiết bị", "Kiểm tra vai trò, thời hạn và trạng thái thiết bị"],
  ["03", "Chuẩn bị không gian làm việc", "Sẵn sàng mở giao diện đúng quyền"],
] as const;

/** UI ceremony only. Authorization MUST be confirmed by AccountGate on the server. */
export default function AccountVerificationShowcase({
  phase, accountName, role, error = "", busy = false, onRetry, onGo,
}: Props) {
  const [stage, setStage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const goRef = useRef(onGo);
  useEffect(() => { goRef.current = onGo; }, [onGo]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    change();
    media.addEventListener?.("change", change);
    return () => media.removeEventListener?.("change", change);
  }, []);

  useEffect(() => {
    if (phase !== "verified" || error) return;
    const timeouts: number[] = [];
    const schedule = (callback: () => void, ms: number) => {
      timeouts.push(window.setTimeout(callback, ms));
    };
    // The progress is deliberately visible, but its timing can never authorize a user.
    if (reducedMotion) {
      schedule(() => setStage(4), 0);
      schedule(() => setStage(5), 500);
      schedule(() => goRef.current(), 1500); // GO stays visible for exactly 1s
    } else {
      schedule(() => setStage(1), 1100);
      schedule(() => setStage(2), 2500);
      schedule(() => setStage(3), 3900);
      schedule(() => setStage(4), 4950); // READY
      schedule(() => setStage(5), 6100); // GO
      schedule(() => goRef.current(), 7100); // automatic entry, no manual click
    }
    return () => { timeouts.forEach(window.clearTimeout); };
  }, [phase, error, reducedMotion]);

  const done = phase === "verified" ? Math.min(stage, 3) : 0;
  const isReady = phase === "verified" && stage >= 4 && !error;
  const isGo = isReady && stage === 5;

  return (
    <main className={styles.stage} aria-label="Cổng xác thực Bơi Ếch AI">
      <section className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.logo} aria-hidden="true"><i/><i/><i/></span>
            <span><strong>BƠI ẾCH AI</strong><small>PREMIUM · SECURE ACCESS</small></span>
          </div>
          <span className={styles.security}>◈ CỔNG XÁC THỰC AN TOÀN</span>
        </header>
        <div className={styles.grid}>
          <div className={styles.content}>
            <span className={styles.eyebrow}>✧ TRẢI NGHIỆM XÁC THỰC</span>
            <h1>{isReady ? "Sẵn sàng bắt đầu." : "Chào mừng đến Bơi Ếch AI."}</h1>
            <p className={styles.lead}>
              {phase === "verified"
                ? "Máy chủ đã xác nhận quyền truy cập. Theo dõi ba bước trước khi ứng dụng tự mở."
                : "Đang kiểm tra phiên tài khoản và thiết bị. Không cần làm mới hay xóa dữ liệu trình duyệt."}
            </p>
            <ol className={styles.steps}>
              {steps.map(([number, title, subtitle], index) => (
                <li key={number} className={`${styles.step} ${index < done ? styles.done : index === done && !isReady ? styles.current : styles.waiting}`}>
                  <span className={styles.number}>{number}</span>
                  <span className={styles.wording}><strong>{title}</strong><small>{subtitle}</small></span>
                  <span className={styles.indicator} aria-hidden="true">{index < done ? "✓" : index === done && !isReady ? "◌" : "—"}</span>
                </li>
              ))}
            </ol>
            {phase === "verified" && accountName ? (
              <p className={styles.identity}>Đã xác nhận: <strong>{accountName}</strong>{role ? ` · ${role}` : ""}</p>
            ) : null}
            {error ? <div className={styles.error} role="alert">{error}</div> : null}
            <div className={styles.actions}>
              {isReady ? <span role="status" aria-live="polite" className={styles.ready} data-go={isGo}>{isGo ? "GO" : "READY"}</span>
                : !error ? <span role="status" aria-live="polite" className={styles.waitingLabel}>
                    {phase === "checking" ? "Đang chờ kết quả máy chủ..." : "Đang chuyển từng bước..."}
                  </span> : null}
              {error ? <button type="button" disabled={busy} onClick={onRetry} className={styles.retry}>
                {busy ? "Đang kết nối..." : "Thử xác thực lại"}
              </button> : null}
            </div>
            <p className={styles.foot}>Các bước trình chiếu không tạo quyền truy cập. Mọi quyền được xác nhận trên máy chủ.</p>
          </div>
          <aside className={styles.visual} aria-hidden="true">
            <div className={styles.ring}><div className={styles.ringInside}><div className={styles.shield}>✓</div></div></div>
            <strong className={styles.visualStatus}>{error ? "RETRY REQUIRED" : isGo ? "GO" : isReady ? "READY" : phase === "verified" ? "ACCESS VERIFIED" : "VERIFYING"}</strong>
            <small>SECURE · PREMIUM · BOI ECH AI</small>
          </aside>
        </div>
        <footer className={styles.footer}>Bảo vệ tài khoản · Khóa thiết bị không rời khỏi trình duyệt · Đồng bộ có điều kiện</footer>
      </section>
    </main>
  );
}
