"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminApiError,
  clientDeviceAdminAction,
  type ClientDeviceApiResponse,
  type ClientDevicePolicy,
  type ClientDeviceSource,
  type ClientDeviceView,
  type ControlRole,
} from "./admin-device-client";
import styles from "./client-device-center.module.css";

type Fallback = { message: string; adminHref: string | null };

const statusLabels = { pending: "Chờ duyệt", approved: "Đã duyệt", blocked: "Đã loại bỏ" } as const;
const policyLabels: Record<string, string> = {
  "child-health": "Sức khỏe Y tế",
  "bauman-master-ai": "Bauman Hub",
  "ru-life": "Hòa nhập Nga",
  "boi-ech": "Bơi ếch AI",
};
const policyIcons: Record<string, string> = { "child-health": "YT", "bauman-master-ai": "BM", "ru-life": "RU", "boi-ech": "BE" };

function relativeTime(value: string | null) {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";
  const minutes = Math.max(0, Math.round((Date.now() - parsed) / 60000));
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

function mergeState(current: ClientDeviceApiResponse | null, next: ClientDeviceApiResponse) {
  return {
    devices: next.devices ?? current?.devices ?? [],
    sources: next.sources ?? current?.sources ?? [],
    policies: next.policies ?? current?.policies ?? [],
    syncedAt: next.syncedAt ?? current?.syncedAt ?? new Date().toISOString(),
    notice: next.notice,
    automationOutcomes: next.automationOutcomes,
    bulkOutcomes: next.bulkOutcomes,
  } satisfies ClientDeviceApiResponse;
}

export default function ClientDeviceCenter({ role }: { role: ControlRole }) {
  const [state, setState] = useState<ClientDeviceApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [warning, setWarning] = useState("");
  const [fallbacks, setFallbacks] = useState<Record<string, Fallback>>({});
  const [appFilter, setAppFilter] = useState("all");
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("168");
  const [showAutomation, setShowAutomation] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<Record<string, { mode: "off" | "approve" | "remove"; removeAfterHours: number }>>({});

  const absorb = useCallback((next: ClientDeviceApiResponse) => {
    setState((current) => mergeState(current, next));
    setPolicyDraft((current) => {
      const updated = { ...current };
      for (const policy of next.policies ?? []) updated[policy.applicationId] = { mode: policy.mode, removeAfterHours: policy.removeAfterHours };
      return updated;
    });
    if (next.notice) setNotice(next.notice);
    const failedAutomation = (next.automationOutcomes ?? []).filter((item) => !item.ok);
    if (failedAutomation.length) setWarning(`${failedAutomation.length} thiết bị không thể xử lý tự động tại Trung tâm; hãy dùng nút Vào quản trị app ở dòng tương ứng.`);
  }, []);

  const sync = useCallback(async (quiet = false) => {
    if (!quiet) setBusy(true);
    try {
      const next = await clientDeviceAdminAction({ action: "sync" });
      absorb(next);
      if (!quiet) { setNotice("Đã đồng bộ lại trạng thái thật từ registry từng ứng dụng."); setWarning(""); }
    } catch (error) {
      if (!quiet) setWarning(error instanceof Error ? error.message : "Không thể đồng bộ thiết bị client.");
    } finally { if (!quiet) setBusy(false); }
  }, [absorb]);

  useEffect(() => {
    void sync(false);
    const onFocus = () => void sync(true);
    const onVisibility = () => { if (document.visibilityState === "visible") void sync(true); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onVisibility); };
  }, [sync]);

  const pending = useMemo(() => (state?.devices ?? []).filter((device) => device.status === "pending"), [state?.devices]);
  const appOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const source of state?.sources ?? []) map.set(source.applicationId, source.applicationName);
    for (const device of state?.devices ?? []) map.set(device.applicationId, device.applicationName);
    return [...map.entries()].filter(([id]) => id !== "growup-mychildren");
  }, [state]);

  const visible = useMemo(() => {
    const horizon = timeFilter === "all" ? Infinity : Number(timeFilter) * 60 * 60 * 1000;
    return (state?.devices ?? []).filter((device) => {
      if (appFilter !== "all" && device.applicationId !== appFilter) return false;
      if (deviceFilter !== "all" && device.deviceType !== deviceFilter) return false;
      const timestamp = Date.parse(device.lastSeenAt || device.createdAt || "");
      if (Number.isFinite(timestamp) && Date.now() - timestamp > horizon) return false;
      return true;
    });
  }, [state?.devices, appFilter, deviceFilter, timeFilter]);

  function sourceFor(applicationId: string): ClientDeviceSource | undefined {
    return state?.sources.find((source) => source.applicationId === applicationId);
  }

  async function manage(device: ClientDeviceView, operation: "approve" | "remove") {
    const mode = operation === "approve" ? device.approveMode : device.removeMode;
    if (mode !== "direct") {
      setFallbacks((current) => ({ ...current, [device.deviceId]: { message: device.actionNote || "Thao tác này cần hoàn tất trong quản trị app.", adminHref: device.adminHref } }));
      return;
    }
    if (operation === "remove" && !window.confirm(`Loại bỏ/khóa thiết bị ${device.deviceCode} khỏi ${device.applicationName}?`)) return;
    setRowBusy(device.deviceId); setNotice(""); setWarning("");
    try {
      const next = await clientDeviceAdminAction({ action: "manage", applicationId: device.applicationId, targetDeviceId: device.deviceId, operation });
      absorb(next);
      setFallbacks((current) => { const copy = { ...current }; delete copy[device.deviceId]; return copy; });
    } catch (error) {
      if (error instanceof AdminApiError) {
        const fallback = { message: error.message, adminHref: typeof error.data.adminHref === "string" ? error.data.adminHref : device.adminHref };
        setFallbacks((current) => ({ ...current, [device.deviceId]: fallback }));
        if (error.data.devices && error.data.sources && error.data.policies && error.data.syncedAt) absorb(error.data as ClientDeviceApiResponse);
        setWarning(error.message);
      } else setWarning(error instanceof Error ? error.message : "Không thể xử lý thiết bị.");
    } finally { setRowBusy(""); }
  }

  async function bulk(operation: "approve" | "remove") {
    const targetCount = pending.filter((device) => appFilter === "all" || device.applicationId === appFilter).length;
    if (!targetCount) { setNotice("Không có thiết bị chờ duyệt trong phạm vi đang chọn."); return; }
    if (operation === "remove" && !window.confirm(`Loại bỏ tất cả ${targetCount} thiết bị đang chờ trong phạm vi đã chọn? Thao tác có hiệu lực trực tiếp với app hỗ trợ Control API.`)) return;
    setBusy(true); setNotice(""); setWarning("");
    try {
      const next = await clientDeviceAdminAction({ action: "bulk", applicationId: appFilter, operation });
      absorb(next);
      const failed = (next.bulkOutcomes ?? []).filter((item) => !item.ok);
      if (failed.length) {
        const map: Record<string, Fallback> = {};
        for (const item of failed) map[item.deviceId] = { message: item.message || "Cần xử lý trong app.", adminHref: item.adminHref ?? null };
        setFallbacks((current) => ({ ...current, ...map }));
        setWarning(`${failed.length} thiết bị chưa thể xử lý trực tiếp. Các dòng tương ứng đã chuyển sang Vào quản trị app.`);
      }
    } catch (error) { setWarning(error instanceof Error ? error.message : "Không thể xử lý hàng loạt."); }
    finally { setBusy(false); }
  }

  async function savePolicy(policy: ClientDevicePolicy) {
    const draft = policyDraft[policy.applicationId] ?? { mode: policy.mode, removeAfterHours: policy.removeAfterHours };
    setRowBusy(`policy:${policy.applicationId}`); setWarning("");
    try {
      const next = await clientDeviceAdminAction({ action: "set-policy", applicationId: policy.applicationId, mode: draft.mode, removeAfterHours: draft.removeAfterHours });
      absorb(next);
    } catch (error) { setWarning(error instanceof Error ? error.message : "Không thể lưu policy tự động."); }
    finally { setRowBusy(""); }
  }

  return <div className={styles.shell}>
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <button className={styles.primary} onClick={() => setShowAutomation((value) => !value)} disabled={role !== "owner"}>Duyệt tự động</button>
        <button className={styles.danger} onClick={() => void bulk("remove")} disabled={busy || (role !== "publisher" && role !== "owner")}>Loại bỏ tất cả</button>
        <button className={styles.secondary} onClick={() => void sync(false)} disabled={busy}>{busy ? "Đang đồng bộ…" : "Đồng bộ"}</button>
      </div>
      <span className={styles.syncMeta}>Registry vẫn thuộc client · {state?.syncedAt ? `đồng bộ ${relativeTime(state.syncedAt)}` : "chưa đồng bộ"}</span>
    </div>

    <div className={styles.filters}>
      <select value={appFilter} onChange={(event) => setAppFilter(event.target.value)}><option value="all">Tất cả ứng dụng</option>{appOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}><option value="all">Tất cả thiết bị</option><option value="Máy tính">Máy tính</option><option value="Điện thoại">Điện thoại</option><option value="Máy tính bảng">Máy tính bảng</option><option value="Chưa xác định">Chưa xác định</option></select>
      <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}><option value="24">Thời gian: 24 giờ</option><option value="168">Thời gian: 7 ngày</option><option value="720">Thời gian: 30 ngày</option><option value="all">Thời gian: Tất cả</option></select>
    </div>

    {notice ? <div className={styles.notice}>{notice}</div> : null}
    {warning ? <div className={styles.warning}>{warning}</div> : null}

    {showAutomation ? <section className={styles.automation}>
      <div className={styles.automationHeader}><div><h3>Tự động xử lý theo từng ứng dụng</h3><p>Mỗi app chọn một chế độ duy nhất: Tắt, Tự động duyệt hoặc Tự động loại bỏ. Quy tắc chạy khi Trung tâm đồng bộ; registry và quyết định cuối vẫn được ghi ở app sở hữu.</p></div><button className={styles.secondary} onClick={() => setShowAutomation(false)}>Đóng</button></div>
      <div className={styles.policyList}>{(state?.policies ?? []).map((policy) => {
        const draft = policyDraft[policy.applicationId] ?? { mode: policy.mode, removeAfterHours: policy.removeAfterHours };
        const source = sourceFor(policy.applicationId);
        const direct = source?.state === "ready";
        return <article key={policy.applicationId} className={styles.policyRow}>
          <div className={styles.policyApp}><b>{policyIcons[policy.applicationId] ?? "AP"}</b><div><strong>{policyLabels[policy.applicationId] ?? policy.applicationId}</strong><small>{source?.message || "Chưa có Control API trực tiếp"}</small></div></div>
          <select value={draft.mode} disabled={!direct || role !== "owner"} onChange={(event) => setPolicyDraft((current) => ({ ...current, [policy.applicationId]: { ...draft, mode: event.target.value as "off" | "approve" | "remove" } }))}><option value="off">Tắt tự động</option><option value="approve">Tự động duyệt</option><option value="remove">Tự động loại bỏ</option></select>
          <select value={draft.removeAfterHours} disabled={!direct || draft.mode !== "remove" || role !== "owner"} onChange={(event) => setPolicyDraft((current) => ({ ...current, [policy.applicationId]: { ...draft, removeAfterHours: Number(event.target.value) } }))}><option value={24}>Loại sau 24 giờ</option><option value={168}>Loại sau 7 ngày</option><option value={720}>Loại sau 30 ngày</option></select>
          {direct ? <button className={styles.policySave} disabled={rowBusy === `policy:${policy.applicationId}` || role !== "owner"} onClick={() => void savePolicy(policy)}>{rowBusy === `policy:${policy.applicationId}` ? "Đang lưu…" : "Lưu"}</button> : source?.adminHref ? <Link className={styles.adminButton} href={source.adminHref}>Vào quản trị app</Link> : <span className={styles.done}>Chưa hỗ trợ</span>}
        </article>;
      })}</div>
    </section> : null}

    <div className={styles.table}>
      <div className={styles.head}><span>Ứng dụng</span><span>Thiết bị</span><span>Người dùng / mã</span><span>Thời gian</span><span>Thao tác</span></div>
      {visible.map((device) => {
        const fallback = fallbacks[device.deviceId];
        return <article className={styles.row} key={`${device.applicationId}:${device.deviceId}`}>
          <div className={styles.app}><span className={styles.appMark}>{device.applicationIcon}</span><div><strong>{device.applicationName}</strong><small>{device.deviceCode}</small></div></div>
          <div className={styles.device}><span className={styles.deviceIcon}>▱</span><div><strong>{device.deviceType}</strong><span className={styles.status} data-state={device.status}>{statusLabels[device.status]}</span></div></div>
          <div className={styles.identity}><strong>{device.userName || device.displayName}</strong><small>{device.userCode || device.deviceCode}</small>{device.actionNote ? <small>{device.actionNote}</small> : null}</div>
          <div className={styles.time}><strong>{relativeTime(device.lastSeenAt || device.createdAt)}</strong><small>{device.active ? "Đang online" : "Theo tín hiệu client"}</small></div>
          <div className={styles.actions}>{device.status === "pending" ? <>
            {!fallback && device.approveMode === "direct" ? <button className={styles.rowButton} disabled={rowBusy === device.deviceId} onClick={() => void manage(device, "approve")}>Duyệt</button> : null}
            {!fallback && device.removeMode === "direct" ? <button className={`${styles.rowButton} ${styles.rowDanger}`} disabled={rowBusy === device.deviceId} onClick={() => void manage(device, "remove")}>Loại bỏ</button> : null}
            {(fallback || device.approveMode === "app-admin") ? <Link className={styles.adminButton} href={fallback?.adminHref || device.adminHref}>Vào quản trị app</Link> : null}
          </> : <><span className={styles.done}>{statusLabels[device.status]}</span><Link className={styles.adminButton} href={device.adminHref}>Vào quản trị app</Link></>}{fallback ? <small title={fallback.message}>Cần xử lý trong app</small> : null}</div>
        </article>;
      })}
      {!visible.length ? <div className={styles.empty}>{busy ? "Đang tải registry từ các ứng dụng…" : "Không có thiết bị phù hợp bộ lọc."}</div> : null}
    </div>

    <div className={styles.sources}>{(state?.sources ?? []).map((source) => <article className={styles.source} key={source.applicationId}><strong>{source.applicationName} · {source.state === "ready" ? "Control API" : source.state === "app-admin" ? "Xử lý trong app" : source.state === "unreachable" ? "Mất kết nối" : "Chưa hỗ trợ"}</strong><small>{source.message}</small>{source.state !== "ready" && source.adminHref ? <Link href={source.adminHref}>Vào quản trị app →</Link> : null}</article>)}</div>
  </div>;
}
