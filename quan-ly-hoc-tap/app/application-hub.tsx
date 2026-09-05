"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  connectAdminDevice,
  roleLabels,
  type AdminAccess,
  type AdminBootstrap,
} from "./admin-device-client";
import styles from "./application-admin.module.css";

const registry = {
  "boi-ech": {
    href: "/apps/boi-ech",
    icon: "BE",
    description: "Quản lý thiết bị học, tiến độ, AI, thanh toán, quyền truy cập và nội dung Bơi ếch.",
    capabilities: ["Thiết bị & tiến độ", "Điều hành AI", "Thanh toán & thời hạn", "Duyệt nội dung Bơi ếch"],
  },
  "child-health": {
    href: "/apps/suc-khoe-tre",
    icon: "SK",
    description: "Quản lý riêng nội dung Sức khỏe trẻ, quyền biên tập, kiểm duyệt, xuất bản và lịch sử phiên bản.",
    capabilities: ["Yêu cầu quyền biên tập", "Kiểm duyệt nội dung sức khỏe", "Xuất bản & rollback", "Không nhận hồ sơ sức khỏe cá nhân"],
  },
  "bauman-master-ai": {
    href: "/apps/bauman-master-ai",
    icon: "BM",
    description: "Không gian quản trị riêng dành cho hệ thống Bauman Master AI.",
    capabilities: ["Quản trị độc lập", "Không dùng tab Bơi ếch", "Kết nối theo contract riêng"],
  },
} as const;

function Gate({ access, busy, error, retry }: { access: AdminAccess | null; busy: boolean; error: string; retry: () => void }) {
  return <main className={styles.gateShell}><section className={styles.gateCard}>
    <span className={styles.sectionEyebrow}>Trung tâm quản trị</span>
    <h1>{access?.status === "pending" ? "Thiết bị đang chờ cấp quyền." : access?.status === "blocked" ? "Thiết bị quản trị đã bị khóa." : "Đang xác thực thiết bị quản trị…"}</h1>
    <p>{error || "Mỗi máy quản trị dùng khóa riêng. Sau khi được duyệt, cùng thiết bị này có thể mở các khu quản trị ứng dụng được cấp quyền."}</p>
    {access?.deviceCode ? <div className={styles.gateCode}><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong></div> : null}
    <button className={styles.primaryButton} onClick={retry} disabled={busy}>{busy ? "Đang kiểm tra…" : "Kiểm tra lại quyền"}</button>
  </section></main>;
}

export default function ApplicationHub({ user }: { user: { displayName: string; email: string } }) {
  const [access, setAccess] = useState<AdminAccess | null>(null);
  const [bootstrap, setBootstrap] = useState<AdminBootstrap | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  async function initialize() {
    setBusy(true);
    setError("");
    try {
      const result = await connectAdminDevice();
      setAccess(result.access);
      setBootstrap(result.bootstrap);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở Trung tâm quản trị.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void initialize(); }, []);

  if (!access || access.status !== "approved" || !bootstrap) return <Gate access={access} busy={busy} error={error} retry={() => void initialize()} />;

  return <main className={styles.hubShell}>
    <header className={styles.hubHeader}>
      <div>
        <span>Hệ thống trung tâm</span>
        <h1>Chọn ứng dụng để quản trị</h1>
        <p>Trung tâm chỉ xác thực người quản trị, hiển thị trạng thái ứng dụng và điều hướng. Mỗi ứng dụng có giao diện, dữ liệu, API và quy trình quản trị riêng.</p>
      </div>
      <div className={styles.userCard}><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small><small>{access.deviceCode}</small></div>
    </header>

    {error || bootstrap.upstreamError ? <div className={styles.error} style={{ maxWidth: 1180, margin: "0 auto 16px" }}>{error || bootstrap.upstreamError}</div> : null}

    <section className={styles.appGrid}>
      {bootstrap.applications.map((app) => {
        const config = registry[app.id as keyof typeof registry];
        if (!config) return null;
        return <Link key={app.id} href={config.href} className={styles.appCard}>
          <div className={styles.appCardTop}><div className={styles.appIcon}>{config.icon}</div><span className={`${styles.status} ${app.status === "warning" ? styles.warning : app.status === "planned" ? styles.planned : ""}`}>{app.status === "online" ? "Đang hoạt động" : app.status === "warning" ? "Cần kiểm tra" : "Đang chuẩn bị"}</span></div>
          <h2>{app.name}</h2>
          <p>{config.description}</p>
          <ul>{config.capabilities.map((item) => <li key={item}>{item}</li>)}</ul>
          <span className={styles.openLabel}>Mở quản trị riêng →</span>
        </Link>;
      })}
    </section>
  </main>;
}
