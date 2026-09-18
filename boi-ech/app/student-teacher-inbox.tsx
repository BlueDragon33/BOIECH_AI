"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StoredDeviceCredential = { version: 2; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type TeacherInboxAction = {
  id: number;
  type: "feedback" | "assignment" | "review";
  teacherName: string;
  title: string;
  note: string;
  lessonNumber: string;
  reviewStatus: "" | "reviewed" | "follow-up";
  analysisAt: string;
  createdAt: string;
  replies: { id: number; message: string; createdAt: string }[];
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

async function signedLearnerProof(credential: StoredDeviceCredential, deviceId: string) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId }),
  });
  const data = await response.json() as { challenge?: string; error?: string };
  if (!response.ok || !data.challenge) throw new Error(data.error ?? "Không thể xác thực tài khoản Học viên.");
  const message = new TextEncoder().encode(`boi-ech:${deviceId}:${data.challenge}`);
  const signature = credential.privateKey && crypto.subtle
    ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message)
    : crypto.getRandomValues(new Uint8Array(64)).buffer;
  return { deviceId, challenge: data.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function loadInbox(deviceId: string) {
  const credential = await readCredential();
  if (!credential) return [] as TeacherInboxAction[];
  const proof = await signedLearnerProof(credential, deviceId);
  const response = await fetch("/api/course/teacher-actions", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(proof),
  });
  const data = await response.json() as { actions?: TeacherInboxAction[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Không thể tải hướng dẫn từ Giảng viên.");
  return Array.isArray(data.actions) ? data.actions : [];
}

async function sendLearnerReply(deviceId: string, actionId: number, message: string) {
  const credential = await readCredential();
  if (!credential) throw new Error("Không tìm thấy khóa thiết bị Học viên.");
  const proof = await signedLearnerProof(credential, deviceId);
  const response = await fetch("/api/course/teacher-actions/reply", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...proof,
      actionId,
      message,
      clientEventId: `learner-reply:${actionId}:${Date.now()}`,
    }),
  });
  const data = await response.json() as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Không thể gửi phản hồi tới Giảng viên.");
}

function ReplyComposer({ actionId, deviceId, onSent }: { actionId: number; deviceId: string; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!open) return <button type="button" className="student-reply-open" onClick={() => setOpen(true)}>Phản hồi Giảng viên →</button>;

  return (
    <form className="student-reply-composer" onSubmit={(event) => {
      event.preventDefault();
      if (!message.trim() || !deviceId) return;
      setSending(true);
      setError("");
      sendLearnerReply(deviceId, actionId, message.trim())
        .then(() => {
          setMessage("");
          setOpen(false);
          onSent();
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể gửi phản hồi."))
        .finally(() => setSending(false));
    }}>
      <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={3} placeholder="Viết câu hỏi, báo đã hoàn thành hoặc nêu khó khăn cần Giảng viên hỗ trợ…" />
      {error ? <p role="alert">{error}</p> : null}
      <div><button type="button" onClick={() => { setOpen(false); setError(""); }} disabled={sending}>Hủy</button><button type="submit" disabled={sending || !message.trim()}>{sending ? "Đang gửi…" : "Gửi phản hồi"}</button></div>
    </form>
  );
}

async function deriveDeviceId() {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  const direct = shell?.getAttribute("data-device-id") ?? "";
  if (direct) return direct;
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

function inboxDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function clickOriginalNav(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"))
    .find((item) => text(item.querySelector("b")) === label);
  button?.click();
}

function Inbox({ actions, deviceId, onRefresh }: { actions: TeacherInboxAction[]; deviceId: string; onRefresh: () => void }) {
  if (!actions.length) return null;
  return (
    <section className="student-teacher-inbox" aria-label="Hướng dẫn từ Giảng viên">
      <header>
        <div><span>TỪ GIẢNG VIÊN</span><h2>Hướng dẫn mới nhất dành cho bạn</h2></div>
        <strong>{actions.length} mục</strong>
      </header>
      <div>
        {actions.slice(0, 4).map((item) => (
          <article key={item.id} className={`teacher-inbox-item teacher-inbox-${item.type}`} data-teacher-action-type={item.type}>
            <span aria-hidden="true">{item.type === "assignment" ? "↗" : item.type === "review" ? "✓" : "✎"}</span>
            <div>
              <small>{item.type === "assignment" ? `BÀI LUYỆN · BÀI ${item.lessonNumber || "—"}` : item.type === "review" ? "REVIEW PHÂN TÍCH" : "NHẬN XÉT CHUYÊN MÔN"}</small>
              <strong>{item.type === "assignment" ? (item.title || "Bài luyện bổ sung") : item.type === "review" ? (item.reviewStatus === "follow-up" ? "Cần luyện / quay lại để đối chiếu" : "Giảng viên đã xem phân tích") : `Nhận xét từ ${item.teacherName}`}</strong>
              <p>{item.note || "Không có ghi chú bổ sung."}</p>
              <em>{item.teacherName} · {inboxDate(item.createdAt)}</em>
            </div>
            {item.replies?.length ? <div className="student-reply-history">{item.replies.map((reply) => <div key={reply.id}><span>Phản hồi của bạn</span><p>{reply.message}</p><small>{inboxDate(reply.createdAt)}</small></div>)}</div> : null}
            <div className="student-inbox-actions">
              {item.type === "assignment" && item.lessonNumber ? <button type="button" onClick={() => clickOriginalNav("Thực hành")}>Mở thực hành →</button> : null}
              {item.type === "review" ? <button type="button" onClick={() => window.location.assign("/phan-tich-video")}>Mở phân tích →</button> : null}
              <ReplyComposer actionId={item.id} deviceId={deviceId} onSent={onRefresh} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function StudentTeacherInbox() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [actions, setActions] = useState<TeacherInboxAction[]>([]);
  const deviceRef = useRef("");
  const requestRef = useRef(0);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let timer = 0;
    const sync = () => {
      timer = 0;
      const role = text(document.querySelector(".learner-chip small"));
      const nextMount = role === "Học viên"
        ? document.querySelector<HTMLElement>("[data-student-teacher-inbox-mount]")
        : null;
      setMount(nextMount);
      if (!nextMount) {
        deviceRef.current = "";
        setActions([]);
        return;
      }
      deriveDeviceId().then((deviceId) => {
        if (!deviceId) return;
        const changedDevice = deviceRef.current !== deviceId;
        if (changedDevice) deviceRef.current = deviceId;
        if (!changedDevice && refreshToken === 0) return;
        const requestId = ++requestRef.current;
        loadInbox(deviceId)
          .then((items) => { if (requestRef.current === requestId) setActions(items); })
          .catch(() => { if (requestRef.current === requestId) setActions([]); });
      }).catch(() => undefined);
    };
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "title", "data-device-id"] });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      requestRef.current += 1;
      deviceRef.current = "";
      setActions([]);
    };
  }, [refreshToken]);

  return mount ? createPortal(<Inbox actions={actions} deviceId={deviceRef.current} onRefresh={() => setRefreshToken((value) => value + 1)} />, mount) : null;
}
