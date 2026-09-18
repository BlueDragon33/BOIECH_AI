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

function Inbox({ actions }: { actions: TeacherInboxAction[] }) {
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
            {item.type === "assignment" && item.lessonNumber ? <button type="button" onClick={() => document.querySelector<HTMLButtonElement>(".sidebar nav button:nth-of-type(3)")?.click()}>Mở thực hành →</button> : null}
            {item.type === "review" ? <button type="button" onClick={() => window.location.assign("/phan-tich-video")}>Mở phân tích →</button> : null}
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
        if (!deviceId || deviceRef.current === deviceId) return;
        deviceRef.current = deviceId;
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
  }, []);

  return mount ? createPortal(<Inbox actions={actions}/>, mount) : null;
}
