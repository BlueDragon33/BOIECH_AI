"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type StoredDeviceCredential = { version: 2; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type AdaptiveAlert = { level: "info" | "warning" | "critical"; code: string; text: string };
type AdaptiveCompetency = {
  lessonNumber: string;
  label: string;
  mastery: number;
  attempts: number;
  score: number | null;
  unlocked: boolean;
};
type AdaptivePlanItem = {
  id: string;
  minutes: number;
  lessonNumber: string;
  section: string;
  title: string;
  reason: string;
};
type AdaptiveIntelligence = {
  generatedAt: string;
  engineVersion: string;
  profileVersion: string;
  priorityLesson: string;
  priorityPart: string;
  competencies: AdaptiveCompetency[];
  alerts: AdaptiveAlert[];
  todayPlan: AdaptivePlanItem[];
};
type AdaptiveBootstrap = {
  settings?: {
    enabled: boolean;
    adaptiveEnabled: boolean;
    engineVersion: string;
    dataPolicy: string;
    deviceReason: string | null;
  };
  intelligence?: AdaptiveIntelligence;
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

async function signedProof(credential: StoredDeviceCredential, deviceId: string) {
  const response = await fetch("/api/device", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "challenge", deviceId }),
  });
  const data = await response.json() as { challenge?: string; error?: string };
  if (!response.ok || !data.challenge) throw new Error(data.error ?? "Không thể xác thực hồ sơ học viên.");
  const message = new TextEncoder().encode(`boi-ech:${deviceId}:${data.challenge}`);
  const signature = credential.privateKey && crypto.subtle
    ? await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message)
    : crypto.getRandomValues(new Uint8Array(64)).buffer;
  return { deviceId, challenge: data.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function loadAdaptiveProfile(deviceId: string) {
  const credential = await readCredential();
  if (!credential) throw new Error("Không tìm thấy khóa thiết bị học viên.");
  const proof = await signedProof(credential, deviceId);
  const response = await fetch("/api/ai/mentor", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "bootstrap", ...proof }),
  });
  const data = await response.json() as AdaptiveBootstrap;
  if (!response.ok) throw new Error(data.error ?? "Không thể tải Learner Model.");
  return data;
}

function clickOriginalNav(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"))
    .find((item) => text(item.querySelector("b")) === label);
  button?.click();
}

function openLesson(number: string) {
  const cards = Array.from(document.querySelectorAll<HTMLButtonElement>(".page-overview .lesson-card"));
  const card = cards.find((item) => text(item.querySelector(".lesson-number")) === number);
  if (card && !card.disabled) card.click();
}

const sectionNav: Record<string, string> = {
  "hoc-tap": "Học tập",
  "thuc-hanh": "Thực hành",
  "phan-tich": "Phân tích",
  "on-tap": "Ôn tập",
  "kiem-tra": "Kiểm tra",
};

function openPlanItem(item: AdaptivePlanItem) {
  openLesson(item.lessonNumber);
  const target = sectionNav[item.section] ?? "Học tập";
  window.setTimeout(() => clickOriginalNav(target), 70);
}

function openFrogAi(adaptive = false) {
  clickOriginalNav("Frog AI");
  if (adaptive) {
    window.setTimeout(() => document.querySelector(".ai-adaptive-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }
}

function masteryTone(value: number) {
  if (value >= 75) return "strong";
  if (value >= 45) return "developing";
  return "focus";
}

function AdaptiveCoach({
  data,
  reload,
}: {
  data: AdaptiveBootstrap;
  reload: () => void;
}) {
  const intelligence = data.intelligence;
  if (!data.settings?.enabled || !intelligence) return null;

  const priority = intelligence.competencies.find((item) => item.lessonNumber === intelligence.priorityLesson);
  const unlocked = intelligence.competencies.filter((item) => item.unlocked);
  const averageMastery = unlocked.length
    ? Math.round(unlocked.reduce((sum, item) => sum + item.mastery, 0) / unlocked.length)
    : 0;
  const alerts = intelligence.alerts.filter((item) => item.level !== "info").slice(0, 2);

  return (
    <section className="student-adaptive-coach" aria-label="Lộ trình học thích ứng">
      <header>
        <div>
          <span>LEARNER MODEL · LỘ TRÌNH THÍCH ỨNG</span>
          <h2>AI đang ưu tiên Bài {intelligence.priorityLesson}</h2>
          <p>{priority?.label ?? "Bài đang cần củng cố"} · dữ liệu được suy ra từ tiến độ, điểm, lượt làm và tự đánh giá.</p>
        </div>
        <div className={`student-adaptive-score ${masteryTone(priority?.mastery ?? 0)}`}>
          <strong>{priority?.mastery ?? 0}%</strong>
          <span>Nắm vững bài ưu tiên</span>
        </div>
      </header>

      <div className="student-adaptive-body">
        <div className="student-adaptive-plan">
          <div className="student-adaptive-heading">
            <div><span>3 VIỆC NÊN LÀM TIẾP</span><strong>Kế hoạch ngắn, có lý do rõ ràng</strong></div>
            <button type="button" onClick={reload}>Cập nhật</button>
          </div>
          <div className="student-adaptive-plan-grid">
            {intelligence.todayPlan.slice(0, 3).map((item, index) => (
              <button key={item.id} type="button" onClick={() => openPlanItem(item)}>
                <span>{String(index + 1).padStart(2, "0")} · {item.minutes} phút</span>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <em>Mở đúng phần học →</em>
              </button>
            ))}
          </div>
        </div>

        <aside className="student-adaptive-insight">
          <div className="student-adaptive-average">
            <span>NĂNG LỰC CÁC BÀI ĐÃ MỞ</span>
            <strong>{averageMastery}%</strong>
            <div><i style={{ width: `${averageMastery}%` }} /></div>
          </div>
          <div className="student-adaptive-competencies">
            {unlocked.slice(0, 4).map((item) => (
              <div key={item.lessonNumber}>
                <span>Bài {item.lessonNumber}</span>
                <strong>{item.mastery}%</strong>
                <i><b style={{ width: `${item.mastery}%` }} /></i>
              </div>
            ))}
          </div>
          {alerts.length ? (
            <div className="student-adaptive-alerts">
              <span>Cần chú ý</span>
              {alerts.map((alert) => <p key={alert.code} className={alert.level}>{alert.text}</p>)}
            </div>
          ) : (
            <div className="student-adaptive-stable"><span>✓</span><p>Chưa có cảnh báo học tập nổi bật từ Learner Model.</p></div>
          )}
        </aside>
      </div>

      <footer>
        <span>{data.settings.dataPolicy || "Không dùng camera, ảnh hoặc video cho Learner Model."}</span>
        <div>
          <button type="button" onClick={() => openFrogAi(false)}>Mở Frog AI</button>
          <button type="button" onClick={() => openFrogAi(true)} disabled={!data.settings.adaptiveEnabled}>Bài luyện thích ứng →</button>
        </div>
      </footer>
    </section>
  );
}

export default function StudentAdaptiveCoach() {
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [data, setData] = useState<AdaptiveBootstrap | null>(null);
  const [loading, setLoading] = useState(false);
  const deviceRef = useRef("");
  const requestRef = useRef(0);

  const refresh = () => {
    const deviceId = deviceRef.current;
    if (!deviceId || loading) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    loadAdaptiveProfile(deviceId)
      .then((next) => { if (requestRef.current === requestId) setData(next); })
      .catch(() => { if (requestRef.current === requestId) setData(null); })
      .finally(() => { if (requestRef.current === requestId) setLoading(false); });
  };

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let timer = 0;

    const sync = () => {
      timer = 0;
      const role = text(document.querySelector(".learner-chip small"));
      const nextMount = role === "Học viên"
        ? document.querySelector<HTMLElement>("[data-student-adaptive-mount]")
        : null;
      setMount(nextMount);

      if (!nextMount) {
        deviceRef.current = "";
        setData(null);
        return;
      }

      deriveDeviceId().then((deviceId) => {
        if (!deviceId || deviceRef.current === deviceId) return;
        deviceRef.current = deviceId;
        const requestId = ++requestRef.current;
        setLoading(true);
        loadAdaptiveProfile(deviceId)
          .then((next) => { if (requestRef.current === requestId) setData(next); })
          .catch(() => { if (requestRef.current === requestId) setData(null); })
          .finally(() => { if (requestRef.current === requestId) setLoading(false); });
      }).catch(() => undefined);
    };

    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "title", "data-device-id"],
    });

    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      requestRef.current += 1;
      deviceRef.current = "";
      setData(null);
    };
  }, []);

  if (!mount) return null;
  if (loading && !data) {
    return createPortal(
      <section className="student-adaptive-coach student-adaptive-loading" role="status">
        <span>LEARNER MODEL</span>
        <strong>Đang tính lộ trình phù hợp từ dữ liệu học tập…</strong>
      </section>,
      mount,
    );
  }
  return data ? createPortal(<AdaptiveCoach data={data} reload={refresh} />, mount) : null;
}
