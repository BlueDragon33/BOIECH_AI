"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./account-verification-showcase.module.css";

type Props = {
  phase: "checking" | "verified";
  /** Server-session, server device/entitlement, real initial workspace readback. */
  checks?: readonly [boolean, boolean, boolean];
  accountName?: string;
  role?: string;
  error?: string;
  busy?: boolean;
  onRetry: () => void;
  onGo: () => void;
};

const steps = [
  ["01", "Nhận diện phiên", "Máy chủ xác nhận phiên đăng nhập hiện tại"],
  ["02", "Xác thực quyền và thiết bị", "Máy chủ kiểm tra vai trò, quyền và khóa thiết bị"],
  ["03", "Tải không gian làm việc", "Dữ liệu cần thiết đã được đọc và xác minh"],
] as const;

/** Visual pacing cannot grant permissions. Each step waits for actual server evidence. */
export default function AccountVerificationShowcase({
  phase, checks, accountName, role, error = "", busy = false, onRetry, onGo,
}: Props) {
  const [stage, setStage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const goRef = useRef(onGo);
  useEffect(() => { goRef.current = onGo; }, [onGo]);
  const approved = checks ?? (phase === "verified" ? [true, true, true] as const : [false, false, false] as const);
  const [sessionOk, accessOk, workspaceOk] = approved;
  const allVerified = phase === "verified" && sessionOk && accessOk && workspaceOk && !error;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(media.matches);
    change();
    media.addEventListener?.("change", change);
    return () => media.removeEventListener?.("change", change);
  }, []);

  // A revocation/failed readback invalidates any previously displayed READY/GO.
  useEffect(() => {
    // State recovery is scheduled after the current render; this avoids a
    // synchronous effect cascade and immediately invalidates any GO callback.
    const completed = [sessionOk, accessOk, workspaceOk];
    const firstMissing = completed.findIndex(verified => !verified);
    if (!error && phase === "verified" && firstMissing === -1) return;
    const timer = window.setTimeout(() => {
      if (error || phase !== "verified") setStage(0);
      else setStage(previous => Math.min(previous, firstMissing));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [error, phase, sessionOk, accessOk, workspaceOk]);

  useEffect(() => {
    if (error || phase !== "verified") return;
    let timer: number | undefined;
    if (stage < 3) {
      const realCheckPassed = [sessionOk, accessOk, workspaceOk][stage];
      if (realCheckPassed) timer = window.setTimeout(() => setStage(stage + 1), reducedMotion ? 0 : 1100);
    } else if (allVerified && stage === 3) {
      timer = window.setTimeout(() => setStage(4), reducedMotion ? 0 : 850); // READY
    } else if (allVerified && stage === 4) {
      timer = window.setTimeout(() => setStage(5), reducedMotion ? 300 : 1100); // GO
    } else if (allVerified && stage === 5) {
      timer = window.setTimeout(() => goRef.current(), 1000); // GO always remains visible for 1 second
    }
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [stage, phase, error, sessionOk, accessOk, workspaceOk, allVerified, reducedMotion]);

  const done = Math.min(stage, 3);
  const isReady = allVerified && stage >= 4;
  const isGo = isReady && stage === 5;
  const orbitState = error ? "error" : isGo ? "go" : isReady ? "ready" : "checking";

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
              {isReady
                ? "Quyền truy cập và dữ liệu khởi tạo đã được xác minh. Hệ thống sẽ tự mở sau GO."
                : "Máy chủ đang thực hiện từng bước xác thực thực tế. Dữ liệu chưa xong sẽ được giữ ở bước đang kiểm tra."}
            </p>
            <ol className={styles.steps}>
              {steps.map(([number, title, subtitle], index) => {
                const passed = index < done && approved[index];
                const current = index === stage && !error;
                return (
                  <li key={number} className={`${styles.step} ${passed ? styles.done : current ? styles.current : styles.waiting}`}>
                    <span className={styles.number}>{number}</span>
                    <span className={styles.wording}><strong>{title}</strong><small>{subtitle}</small></span>
                    <span className={styles.indicator} aria-hidden="true">{passed ? "✓" : current ? "◌" : "—"}</span>
                  </li>
                );
              })}
            </ol>
            {sessionOk && accountName ? (
              <p className={styles.identity}>Đã xác nhận: <strong>{accountName}</strong>{role ? ` · ${role}` : ""}</p>
            ) : null}
            {error ? <div className={styles.error} role="alert">{error}</div> : null}
            <div className={styles.actions}>
              {!error && !isReady ? <span role="status" aria-live="polite" className={styles.waitingLabel}>
                {stage === 0 ? "Đang xác minh phiên..." : stage === 1 ? "Đang kiểm tra quyền từ máy chủ..." : "Đang tải dữ liệu thật..."}
              </span> : null}
              {error ? <button type="button" disabled={busy} onClick={onRetry} className={styles.retry}>
                {busy ? "Đang kết nối..." : "Thử xác thực lại"}
              </button> : null}
            </div>
            <p className={styles.foot}>READY chỉ xuất hiện khi đủ quyền và dữ liệu thực đã sẵn sàng; GO tự chuyển sau 1 giây.</p>
          </div>
          <aside className={styles.visual}>
            <div className={styles.ring} data-mode={orbitState}>
              <span className={styles.gear} aria-hidden="true"/>
              <span className={styles.tinyOrbit} aria-hidden="true"/>
              <span className={styles.innerOrbit} aria-hidden="true"/>
              <div className={styles.ringInside}>
                <strong role="status" aria-live="polite" className={styles.orbitWord}>
                  {error ? "ERROR" : isGo ? "GO" : isReady ? "READY" : "CHECKING..."}
                </strong>
              </div>
            </div>
            <small>SECURE · PREMIUM · BOI ECH AI</small>
          </aside>
        </div>
        <footer className={styles.footer}>Bảo vệ tài khoản · Xác minh máy chủ · Đồng bộ thủ công khi người quản lý yêu cầu</footer>
      </section>
    </main>
  );
}
