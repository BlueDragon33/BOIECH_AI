"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {assessLearnerEvidenceV48} from "./learner-evidence-readiness-v48";

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
    const request = indexedDB.open(document.documentElement.dataset.accountLocalDatabase || "boi-ech-doc-lap", 4);
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

async function signedProof(credential: StoredDeviceCredential, deviceId: string) {
  if (!credential.privateKey || !crypto.subtle) {
    throw new Error("Không tìm thấy khóa ký của thiết bị Học viên.");
  }
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
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
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
  loading,
  refreshError,
}: {
  data: AdaptiveBootstrap;
  reload: () => void;
  loading: boolean;
  refreshError: string;
}) {
  const intelligence = data.intelligence;
  if (!data.settings?.enabled || !intelligence) return null;

  const evidence=assessLearnerEvidenceV48(intelligence,Date.now());
  const priority = intelligence.competencies.find((item) => item.lessonNumber === intelligence.priorityLesson);
  const unlocked = intelligence.competencies.filter((item) => item.unlocked);
  const measured=unlocked.filter(item=>Number.isSafeInteger(item.attempts)&&item.attempts>0&&
    typeof item.score==="number"&&Number.isFinite(item.score)&&item.score>=0&&item.score<=100&&
    Number.isFinite(item.mastery)&&item.mastery>=0&&item.mastery<=100);
  const averageMastery=measured.length?
    Math.round(measured.reduce((sum,item)=>sum+item.mastery,0)/measured.length):null;
  const alerts = intelligence.alerts.filter((item) => item.level !== "info").slice(0, 2);

  return (
    <section className="student-adaptive-coach" aria-label="Lộ trình học thích ứng">
      <header>
        <div>
          <span>LEARNER MODEL · LỘ TRÌNH THÍCH ỨNG</span>
          <h2>AI đang ưu tiên Bài {intelligence.priorityLesson}</h2>
          <p>{priority?.label ?? "Bài đang cần củng cố"} · chỉ số gợi ý từ hoạt động học; không chứng nhận kỹ thuật bơi.</p>
        </div>
        <div className={`student-adaptive-score ${evidence.priorityMastery===null?"unknown":masteryTone(evidence.priorityMastery)}`}>
          <strong>{evidence.priorityMastery===null?"—":evidence.priorityMastery+"%"}</strong>
          <span>{evidence.priorityMastery===null?"Chưa đủ dữ liệu xác thực":"Chỉ số gợi ý bài ưu tiên"}</span>
        </div>
      </header>

      {refreshError ? (
        <div className="student-adaptive-stale" role="status">
          <strong>Chưa cập nhật được Learner Model.</strong>
          <span>Hệ thống đang giữ dữ liệu gần nhất để bạn tiếp tục học.</span>
        </div>
      ) : null}

      <div className="student-adaptive-evidence-v48" role="status" data-v48-learner-evidence={evidence.evidenceStatus}>
        <strong>{evidence.sourceStatus==="fresh"?
          evidence.evidenceStatus==="observed"?"Nguồn học tập đã ghi nhận — vẫn cần đối chiếu":"Chưa đủ bằng chứng để kết luận thành thạo":
          "Dữ liệu học tập không còn đủ mới hoặc sai mốc thời gian"}</strong>
        <p>{evidence.checkpoint}</p>
        <small>{evidence.observedLessons}/{evidence.unlockedLessons} bài đã mở có lượt kiểm tra và điểm hợp lệ.
          AI không chấm khả năng bơi thực tế.</small>
      </div>
      <div className="student-adaptive-body">
        <div className="student-adaptive-plan">
          <div className="student-adaptive-heading">
            <div><span>3 VIỆC NÊN LÀM TIẾP</span><strong>Kế hoạch ngắn, có lý do rõ ràng</strong></div>
            <button type="button" onClick={reload} disabled={loading}>{loading ? "Đang cập nhật…" : "Cập nhật"}</button>
          </div>
          <div className="student-adaptive-plan-grid">
            {evidence.usablePlan.map((item, index) => (
              <button key={item.id} type="button" onClick={() => openPlanItem(item)}>
                <span>{String(index + 1).padStart(2, "0")} · {item.minutes} phút</span>
                <strong>{item.title}</strong>
                <p>{item.reason}</p>
                <em>Mở đúng phần học →</em>
              </button>
            ))}
          </div>
          {evidence.planStatus==="paused"?<p role="status">Kế hoạch tạm dừng vì thiếu nguồn mới,
           bài học được mở hoặc dữ liệu kế hoạch hợp lệ. Cập nhật Learner Model để xem lại.</p>:null}
          {evidence.planStatus==="exploratory"?<small>Đây là lộ trình thăm dò;
           kết quả chỉ được đối chiếu sau lượt học và kiểm tra tiếp theo.</small>:null}
        </div>

        <aside className="student-adaptive-insight">
          <div className="student-adaptive-average">
            <span>NĂNG LỰC CÁC BÀI ĐÃ MỞ</span>
            <strong>{averageMastery===null?"—":averageMastery+"%"}</strong>
            <div><i style={{ width: `${averageMastery??0}%` }} /></div>
            <small>{measured.length}/{unlocked.length} bài có số liệu hợp lệ; không suy số 0 cho bài chưa kiểm tra.</small>
          </div>
          <div className="student-adaptive-competencies">
            {unlocked.slice(0, 4).map((item) => (
              <div key={item.lessonNumber}>
                <span>Bài {item.lessonNumber}</span>
                <strong>{measured.includes(item)?item.mastery+"%":"Chưa đủ dữ liệu"}</strong>
                <i><b style={{ width: `${measured.includes(item)?item.mastery:0}%` }} /></i>
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
  const [error, setError] = useState("");
  const deviceRef = useRef("");
  const requestRef = useRef(0);
  const loadingRef = useRef(false);

  const refresh = useCallback((preserveData = true) => {
    const deviceId = deviceRef.current;
    if (!deviceId || loadingRef.current) return;
    const requestId = ++requestRef.current;
    loadingRef.current = true;
    setLoading(true);
    if (!preserveData) setError("");
    loadAdaptiveProfile(deviceId)
      .then((next) => {
        if (requestRef.current === requestId && deviceRef.current === deviceId) {
          setData(next);
          setError("");
        }
      })
      .catch((caught) => {
        if (requestRef.current === requestId) {
          if (!preserveData) setData(null);
          setError(caught instanceof Error ? caught.message : "Không thể tải Learner Model.");
        }
      })
      .finally(() => {
        if (requestRef.current === requestId) {
          loadingRef.current = false;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let timer = 0;
    let interval = 0;

    const sync = () => {
      timer = 0;
      const role = text(document.querySelector(".learner-chip small"));
      const nextMount = role === "Học viên"
        ? document.querySelector<HTMLElement>("[data-student-adaptive-mount]")
        : null;
      setMount(nextMount);

      if (!nextMount) {
        requestRef.current += 1;
        loadingRef.current = false;
        deviceRef.current = "";
        setLoading(false);
        setData(null);
        setError("");
        return;
      }

      deriveDeviceId().then((deviceId) => {
        if (!deviceId || deviceRef.current === deviceId) return;
        requestRef.current += 1;
        loadingRef.current = false;
        deviceRef.current = deviceId;
        setLoading(false);
        setData(null);
        setError("");
        refresh(false);
      }).catch(() => undefined);
    };

    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };

    const refreshVisibleAdaptive = () => {
      if (document.visibilityState === "visible" && navigator.onLine) refresh(true);
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
    interval = window.setInterval(refreshVisibleAdaptive, 120_000);
    document.addEventListener("visibilitychange", refreshVisibleAdaptive);
    window.addEventListener("online", refreshVisibleAdaptive);

    return () => {
      if (timer) window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
      observer.disconnect();
      document.removeEventListener("visibilitychange", refreshVisibleAdaptive);
      window.removeEventListener("online", refreshVisibleAdaptive);
      requestRef.current += 1;
      loadingRef.current = false;
      deviceRef.current = "";
      setLoading(false);
      setData(null);
      setError("");
    };
  }, [refresh]);

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
  if (error && !data) {
    return createPortal(
      <section className="student-adaptive-coach student-adaptive-error" role="alert">
        <span>LEARNER MODEL</span>
        <strong>Chưa thể tải lộ trình thích ứng</strong>
        <p>{error}</p>
        <button type="button" onClick={() => refresh(false)}>Thử lại</button>
      </section>,
      mount,
    );
  }
  return data ? createPortal(<AdaptiveCoach data={data} reload={refresh} loading={loading} refreshError={error} />, mount) : null;
}
