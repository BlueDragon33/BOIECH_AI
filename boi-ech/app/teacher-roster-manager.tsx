"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StoredDeviceCredential = { version: 2; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type RosterStatus = "pending" | "approved" | "blocked";
type RosterItem = {
  name: string;
  personCode: string;
  className: string;
  status: RosterStatus;
  registrationComplete: boolean;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
};
type RosterResponse = {
  roster: RosterItem[];
  counts: { pending: number; approved: number; blocked: number };
  syncedAt: string;
  changed?: { action: "approve" | "remove"; personCode: string; name: string };
  error?: string;
};

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("boi-ech-doc-lap", 4);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return new Promise<StoredDeviceCredential | undefined>((resolve, reject) => {
    const request = db.transaction("thiet-bi", "readonly").objectStore("thiet-bi").get("chinh");
    request.onsuccess = () => resolve(request.result as StoredDeviceCredential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function deriveDeviceId() {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  const direct = shell?.getAttribute("data-device-id") ?? "";
  if (/^[a-f0-9]{64}$/i.test(direct)) return direct;
  const credential = await readCredential();
  if (!credential?.publicKey || !crypto.subtle) return "";
  const canonical = JSON.stringify({
    kty: credential.publicKey.kty,
    crv: credential.publicKey.crv,
    x: credential.publicKey.x,
    y: credential.publicKey.y,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function signedProof(deviceId: string) {
  const credential = await readCredential();
  if (!credential?.privateKey) throw new Error("Không tìm thấy khóa ký của thiết bị Giảng viên.");
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId }),
  });
  const data = await response.json() as { challenge?: string; error?: string };
  if (!response.ok || !data.challenge) throw new Error(data.error ?? "Không thể tạo phiên xác thực Giảng viên.");
  const message = new TextEncoder().encode(`boi-ech:${deviceId}:${data.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId, challenge: data.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function requestRoster(deviceId: string, action: "list" | "approve" | "remove", personCode = "") {
  const proof = await signedProof(deviceId);
  const response = await fetch("/api/teacher/roster", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...proof, action, personCode }),
  });
  const data = await response.json() as RosterResponse;
  if (!response.ok) throw new Error(data.error ?? "Không thể đồng bộ học viên.");
  return data;
}

function shortTime(value: string | null) {
  if (!value) return "Chưa đồng bộ";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa đồng bộ"
    : new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(date);
}

function statusLabel(status: RosterStatus) {
  if (status === "approved") return "Đang học";
  if (status === "blocked") return "Đã loại";
  return "Chờ duyệt";
}

function rosterSignature(items: RosterItem[]) {
  return items.map((item) => `${item.personCode}:${item.status}`).sort().join("|");
}

function approvedSignature(items: RosterItem[]) {
  return items.filter((item) => item.status === "approved").map((item) => item.personCode).sort().join("|");
}

function CompactSync({
  loading,
  syncedAt,
  pending,
  changedCount,
  onSync,
}: {
  loading: boolean;
  syncedAt: string | null;
  pending: number;
  changedCount: number;
  onSync: () => void;
}) {
  return (
    <div className="teacher-roster-sync-compact" data-teacher-roster-ui>
      <div>
        <small>Tự cập nhật 60 giây</small>
        <span>{shortTime(syncedAt)}{changedCount ? ` · +${changedCount} mới` : ""}</span>
      </div>
      {pending > 0 ? <b title="Học viên chờ duyệt">{pending}</b> : null}
      <button type="button" onClick={onSync} disabled={loading}>
        {loading ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}
      </button>
    </div>
  );
}

function RosterPanel({
  roster,
  counts,
  loading,
  error,
  syncedAt,
  onSync,
  onAction,
}: {
  roster: RosterItem[];
  counts: RosterResponse["counts"];
  loading: boolean;
  error: string;
  syncedAt: string | null;
  onSync: () => void;
  onAction: (action: "approve" | "remove", item: RosterItem) => void;
}) {
  const [filter, setFilter] = useState<"all" | RosterStatus>("all");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("vi");
    return roster.filter((item) => {
      const statusMatch = filter === "all" || item.status === filter;
      const queryMatch = !needle || [item.name, item.personCode, item.className].join(" ").toLocaleLowerCase("vi").includes(needle);
      return statusMatch && queryMatch;
    });
  }, [filter, query, roster]);

  return (
    <section className="teacher-roster-manager" data-teacher-roster-ui>
      <header>
        <div>
          <span>QUẢN LÝ HỌC VIÊN</span>
          <h2>Đồng bộ & quyền lớp phụ trách</h2>
          <p>Giảng viên chỉ phê duyệt hoặc loại học viên thuộc đúng lớp của mình. “Loại” là khóa có thể khôi phục, không xóa dữ liệu.</p>
        </div>
        <button type="button" onClick={onSync} disabled={loading}>{loading ? "Đang đồng bộ…" : "Đồng bộ dữ liệu"}</button>
      </header>
      <div className="teacher-roster-summary">
        <div><strong>{counts.approved}</strong><span>Đang học</span></div>
        <div className="pending"><strong>{counts.pending}</strong><span>Chờ duyệt</span></div>
        <div className="blocked"><strong>{counts.blocked}</strong><span>Đã loại</span></div>
        <div className="synced"><strong>{shortTime(syncedAt)}</strong><span>Lần đồng bộ cuối</span></div>
      </div>
      <div className="teacher-roster-toolbar">
        <div className="teacher-roster-filters">
          {([
            ["all", `Tất cả (${roster.length})`],
            ["pending", `Chờ duyệt (${counts.pending})`],
            ["approved", `Đang học (${counts.approved})`],
            ["blocked", `Đã loại (${counts.blocked})`],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên hoặc mã học viên…" aria-label="Tìm học viên trong danh sách quản lý"/>
      </div>
      {error ? <p className="teacher-roster-error" role="alert">{error}</p> : null}
      <div className="teacher-roster-table-wrap">
        <table className="teacher-roster-table">
          <thead><tr><th>Học viên</th><th>Mã</th><th>Trạng thái</th><th>Gần nhất</th><th>Thao tác</th></tr></thead>
          <tbody>
            {visible.map((item) => (
              <tr key={item.personCode}>
                <td><strong>{item.name}</strong><small>{item.className}</small></td>
                <td>{item.personCode}</td>
                <td><span className={`teacher-roster-status ${item.status}`}>{statusLabel(item.status)}</span></td>
                <td>{shortTime(item.lastSeenAt)}</td>
                <td>
                  {item.status === "pending" ? (
                    <button type="button" className="approve" disabled={loading || !item.registrationComplete} onClick={() => onAction("approve", item)}>
                      {item.registrationComplete ? "Phê duyệt" : "Thiếu hồ sơ"}
                    </button>
                  ) : item.status === "approved" ? (
                    <button type="button" className="remove" disabled={loading} onClick={() => onAction("remove", item)}>Loại khỏi lớp</button>
                  ) : (
                    <button type="button" className="restore" disabled={loading} onClick={() => onAction("approve", item)}>Khôi phục</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? <div className="teacher-roster-empty">Không có học viên phù hợp với bộ lọc hiện tại.</div> : null}
      </div>
    </section>
  );
}

export default function TeacherRosterManager() {
  const [compactMounts, setCompactMounts] = useState<HTMLElement[]>([]);
  const [panelMount, setPanelMount] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<RosterResponse>({ roster: [], counts: { pending: 0, approved: 0, blocked: 0 }, syncedAt: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [changedCount, setChangedCount] = useState(0);
  const deviceIdRef = useRef("");
  const syncedDeviceRef = useRef("");
  const rosterSignatureRef = useRef("");
  const approvedSignatureRef = useRef("");
  const syncingRef = useRef(false);
  const teacherActiveRef = useRef(false);
  const syncGenerationRef = useRef(0);

  const clearRosterState = () => {
    deviceIdRef.current = "";
    syncedDeviceRef.current = "";
    rosterSignatureRef.current = "";
    approvedSignatureRef.current = "";
    syncingRef.current = false;
    setData({ roster: [], counts: { pending: 0, approved: 0, blocked: 0 }, syncedAt: "" });
    setChangedCount(0);
    setError("");
    setLoading(false);
  };

  const syncRoster = async (
    source: "manual" | "auto" | "mutation" = "manual",
    forcedDeviceId = "",
  ) => {
    if (document.body.dataset.teacherRoleUi !== "active") return;
    if (syncingRef.current && !forcedDeviceId) return;
    const generation = syncGenerationRef.current;
    syncingRef.current = true;
    setLoading(true);
    if (source !== "auto") setError("");
    try {
      const deviceId = forcedDeviceId || deviceIdRef.current || await deriveDeviceId();
      if (!deviceId) throw new Error("Chưa xác định được thiết bị Giảng viên.");
      if (generation !== syncGenerationRef.current || document.body.dataset.teacherRoleUi !== "active") return;
      deviceIdRef.current = deviceId;
      const next = await requestRoster(deviceId, "list");
      if (generation !== syncGenerationRef.current || deviceIdRef.current !== deviceId) return;
      const nextRosterSignature = rosterSignature(next.roster);
      const nextApprovedSignature = approvedSignature(next.roster);
      if (rosterSignatureRef.current && nextRosterSignature !== rosterSignatureRef.current) {
        const previous = new Set(rosterSignatureRef.current.split("|"));
        const additions = nextRosterSignature.split("|").filter((item) => item && !previous.has(item)).length;
        if (additions > 0) setChangedCount(additions);
      }
      if (approvedSignatureRef.current && nextApprovedSignature !== approvedSignatureRef.current) {
        window.dispatchEvent(new CustomEvent("boi-ech:teacher-roster-changed"));
      }
      rosterSignatureRef.current = nextRosterSignature;
      approvedSignatureRef.current = nextApprovedSignature;
      syncedDeviceRef.current = deviceId;
      setData(next);
    } catch (caught) {
      if (generation === syncGenerationRef.current && source !== "auto") {
        setError(caught instanceof Error ? caught.message : "Không thể đồng bộ học viên.");
      }
    } finally {
      if (generation === syncGenerationRef.current) {
        syncingRef.current = false;
        setLoading(false);
      }
    }
  };

  const mutate = async (action: "approve" | "remove", item: RosterItem) => {
    if (document.body.dataset.teacherRoleUi !== "active") return;
    if (action === "remove") {
      const confirmed = window.confirm(`Loại ${item.name} khỏi lớp? Học viên sẽ bị khóa truy cập nhưng có thể được khôi phục sau.`);
      if (!confirmed) return;
    }
    if (syncingRef.current) return;
    const generation = syncGenerationRef.current;
    syncingRef.current = true;
    setLoading(true);
    setError("");
    try {
      const deviceId = deviceIdRef.current || await deriveDeviceId();
      if (!deviceId) throw new Error("Chưa xác định được thiết bị Giảng viên.");
      if (generation !== syncGenerationRef.current || document.body.dataset.teacherRoleUi !== "active") return;
      deviceIdRef.current = deviceId;
      const next = await requestRoster(deviceId, action, item.personCode);
      if (generation !== syncGenerationRef.current || deviceIdRef.current !== deviceId) return;
      rosterSignatureRef.current = rosterSignature(next.roster);
      approvedSignatureRef.current = approvedSignature(next.roster);
      syncedDeviceRef.current = deviceId;
      setData(next);
      setChangedCount(0);
      window.dispatchEvent(new CustomEvent("boi-ech:teacher-roster-changed", { detail: next.changed }));
    } catch (caught) {
      if (generation === syncGenerationRef.current) {
        setError(caught instanceof Error ? caught.message : "Không thể cập nhật quyền học viên.");
      }
    } finally {
      if (generation === syncGenerationRef.current) {
        syncingRef.current = false;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let timer = 0;
    let interval = 0;

    const resetForInactiveRole = () => {
      if (!teacherActiveRef.current && !deviceIdRef.current && !syncedDeviceRef.current) return;
      teacherActiveRef.current = false;
      syncGenerationRef.current += 1;
      clearRosterState();
    };

    const ensureTeacherDeviceSynced = async () => {
      if (document.body.dataset.teacherRoleUi !== "active") return;
      const deviceId = await deriveDeviceId().catch(() => "");
      if (!deviceId || document.body.dataset.teacherRoleUi !== "active") return;
      const changedDevice = Boolean(deviceIdRef.current && deviceIdRef.current !== deviceId);
      const needsInitialSync = syncedDeviceRef.current !== deviceId;
      if (changedDevice) {
        syncGenerationRef.current += 1;
        syncingRef.current = false;
        deviceIdRef.current = deviceId;
        syncedDeviceRef.current = "";
        rosterSignatureRef.current = "";
        approvedSignatureRef.current = "";
        setData({ roster: [], counts: { pending: 0, approved: 0, blocked: 0 }, syncedAt: "" });
        setChangedCount(0);
        setError("");
      } else {
        deviceIdRef.current = deviceId;
      }
      if (needsInitialSync || changedDevice) void syncRoster("auto", deviceId);
    };

    const updateMounts = () => {
      timer = 0;
      const active = document.body.dataset.teacherRoleUi === "active";
      if (!active) {
        setCompactMounts([]);
        setPanelMount(null);
        resetForInactiveRole();
        return;
      }
      const becameActive = !teacherActiveRef.current;
      teacherActiveRef.current = true;
      setCompactMounts(Array.from(document.querySelectorAll<HTMLElement>("[data-teacher-sync-mount]")));
      setPanelMount(document.querySelector<HTMLElement>("[data-teacher-roster-manager-mount]"));
      if (becameActive || syncedDeviceRef.current === "") void ensureTeacherDeviceSynced();
      else void deriveDeviceId().then((deviceId) => {
        if (deviceId && deviceIdRef.current && deviceId !== deviceIdRef.current) void ensureTeacherDeviceSynced();
      }).catch(() => undefined);
    };

    const schedule = () => {
      if (!timer) timer = window.setTimeout(updateMounts, 0);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-teacher-role-ui", "class", "title", "data-device-id"],
    });

    interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && document.body.dataset.teacherRoleUi === "active") {
        void ensureTeacherDeviceSynced().then(() => void syncRoster("auto"));
      }
    }, 60_000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && document.body.dataset.teacherRoleUi === "active") {
        void ensureTeacherDeviceSynced().then(() => void syncRoster("auto"));
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisible);
      syncGenerationRef.current += 1;
      teacherActiveRef.current = false;
      clearRosterState();
      setCompactMounts([]);
      setPanelMount(null);
    };
  }, []);

  const compact = compactMounts.map((mount) => createPortal(
    <CompactSync
      key={mount.dataset.teacherSyncMount || mount.className}
      loading={loading}
      syncedAt={data.syncedAt || null}
      pending={data.counts.pending}
      changedCount={changedCount}
      onSync={() => { setChangedCount(0); void syncRoster("manual"); }}
    />,
    mount,
  ));

  const panel = panelMount ? createPortal(
    <RosterPanel
      roster={data.roster}
      counts={data.counts}
      loading={loading}
      error={error}
      syncedAt={data.syncedAt || null}
      onSync={() => { setChangedCount(0); void syncRoster("manual"); }}
      onAction={(action, item) => void mutate(action, item)}
    />,
    panelMount,
  ) : null;

  return <>{compact}{panel}</>;
}
