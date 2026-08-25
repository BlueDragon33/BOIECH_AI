"use client";

/* Ảnh chuyển khoản được lấy qua endpoint bảo vệ và URL blob cục bộ. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import AiControlCenter, { type AiControlData } from "./ai-control-center";

type ControlRole = "viewer" | "reviewer" | "publisher" | "owner";
type DeviceStatus = "pending" | "approved" | "blocked";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type ActivityDay = { date: string; loginCount: number; studyMinutes: number; quizAttempts: number; progressPercent: number };
type AccessAutomation = {
  enabled: boolean;
  defaultAccessDays: number;
  defaultDeviceLimit: number;
  activeAutoFreeDeviceCount: number;
  remainingAutoFreeDeviceSlots: number;
  updatedBy: string | null;
  updatedAt: string | null;
};
type Access = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  label: string | null;
  owner: boolean;
};
type LearningDevice = {
  deviceId: string;
  deviceCode: string;
  status: DeviceStatus;
  label: string | null;
  learnerName: string | null;
  learnerFamilyName: string | null;
  learnerGivenName: string | null;
  personRole: "learner" | "teacher" | null;
  personCode: string | null;
  className: string | null;
  phone: string | null;
  registrationComplete: boolean;
  accessGroup: "unassigned" | "free" | "paid";
  paymentStatus: "unassigned" | "awaiting_payment" | "proof_submitted" | "free_approved" | "paid_verified";
  paymentAmount: number;
  paymentProofAvailable: boolean;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  paymentRejectedAt: string | null;
  paymentReviewNote: string | null;
  accessExpiresAt: string | null;
  accessExpired: boolean;
  accessExpiringSoon: boolean;
  accessDaysRemaining: number | null;
  personalEditEnabled: boolean;
  personalEditConfigured: boolean;
  autoConfirmedAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  lastActivityAt: string;
  lastPresenceAt: string;
  offlineSinceAt: string | null;
  lastLearningActivityAt: string | null;
  active: boolean;
  completedLessons: number;
  completedSteps: number;
  completionPercent: number;
  masteryPercent: number;
  attempts: number;
  totalActiveSeconds: number;
  lastLesson: string | null;
  lastPart: string | null;
  scores: Record<string, number>;
  activityTimeline: ActivityDay[];
};
type ControlDevice = {
  deviceId: string;
  deviceCode: string;
  email: string;
  displayName: string;
  status: DeviceStatus;
  role: ControlRole;
  label: string | null;
  createdAt: string;
  approvedAt: string | null;
  blockedAt: string | null;
  lastSeenAt: string;
  offlineSinceAt: string | null;
  memberStatus: "active" | "inactive" | "unregistered";
  active: boolean;
  owner: boolean;
};
type DeletedLearningDevice = {
  deviceId: string;
  deviceCode: string;
  reason: "spam" | "duplicate" | "test" | "other";
  learnerName: string | null;
  deletedBy: string;
  deletedAt: string;
};
type BoiBridge = { baseUrl: string; token: string; expiresAt: number };
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type AdminAppearance = {
  theme: "classic" | "soft" | "contrast";
  font: "classic" | "modern" | "readable";
  textSize: "normal" | "large" | "xlarge";
};

const defaultAdminAppearance: AdminAppearance = { theme: "classic", font: "classic", textSize: "normal" };

const adminThemes: { id: AdminAppearance["theme"]; name: string; paper: string; panel: string; ink: string; muted: string }[] = [
  { id: "classic", name: "Cổ điển", paper: "#f2eee5", panel: "#fffdf8", ink: "#182421", muted: "#64716c" },
  { id: "soft", name: "Xanh dịu", paper: "#eaf4f1", panel: "#fbfffd", ink: "#17352f", muted: "#58716a" },
  { id: "contrast", name: "Tương phản", paper: "#f4f6f7", panel: "#ffffff", ink: "#101820", muted: "#40515a" },
];

const adminFonts: { id: AdminAppearance["font"]; name: string; ui: string; heading: string; sample: string }[] = [
  { id: "classic", name: "Hiện đại & cổ điển", ui: "'Segoe UI', 'Noto Sans', Arial, sans-serif", heading: "'Noto Serif', 'Times New Roman', Georgia, serif", sample: "Tiêu đề trang trọng, nội dung rõ ràng" },
  { id: "modern", name: "Hiện đại", ui: "'Segoe UI', 'Noto Sans', Arial, sans-serif", heading: "'Segoe UI', 'Noto Sans', Arial, sans-serif", sample: "Đồng nhất và gọn trên màn hình" },
  { id: "readable", name: "Dễ đọc", ui: "Verdana, 'Noto Sans', Arial, sans-serif", heading: "Verdana, 'Noto Sans', Arial, sans-serif", sample: "Chữ thoáng, hỗ trợ tiếng Việt đầy đủ" },
];
type Dashboard = {
  actor: Access;
  application: { id: string; name: string; lessonCount: number };
  learningDevices: LearningDevice[];
  controlDevices: ControlDevice[];
  upstreamError: string | null;
  applications: { id: string; name: string; status: "online" | "warning" | "planned" }[];
  auditLog: AuditEntry[];
  boiBridge: BoiBridge;
  automation?: AccessAutomation;
  deletedDevices?: DeletedLearningDevice[];
};
type AuditEntry = {
  id: string;
  source: string;
  actor: string;
  action: string;
  target: string;
  detail: Record<string, unknown>;
  createdAt: string;
};
type ApiData = Dashboard & {
  device?: Access;
  challenge?: string;
  error?: string;
  code?: string;
  devices?: LearningDevice[];
  controlDevices?: ControlDevice[];
  validationErrors?: string[];
  versions?: ContentVersion[];
  versionId?: string;
  currentSection?: unknown;
  proposedSection?: unknown;
  editScope?: EditScopeInfo;
  boiBridge?: BoiBridge;
  automation?: AccessAutomation;
  deletedDeviceId?: string;
  deletedDeviceCode?: string;
  restoredDeviceId?: string;
};
type ContentVersion = {
  id: string;
  version_number: number;
  status: "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
  summary: string | null;
  created_by: string;
  editor_device_code?: string | null;
  edit_scope?: string | null;
  edit_lesson?: string | null;
  edit_section?: EditSection | "lesson" | null;
  edit_scope_label?: string | null;
  permission_note?: string | null;
  permission_reviewed_by?: string | null;
  permission_reviewed_at?: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
type EditSection = "content" | "practice" | "analysis" | "review" | "quiz";
type EditScopeInfo = {
  lessonNumber: string;
  section: EditSection | "lesson";
  sectionLabel: string;
  label: string;
  value: string;
};

const editSectionLabels: Record<EditSection, string> = {
  content: "Nội dung",
  practice: "Thực hành",
  analysis: "Phân tích",
  review: "Ôn tập",
  quiz: "Kiểm tra",
};

function contentScope(version: ContentVersion | null): EditScopeInfo {
  const fallbackLesson = version?.edit_lesson ?? version?.edit_scope?.split(":")[0] ?? "—";
  const fallbackSection = version?.edit_section ?? version?.edit_scope?.split(":")[1] as EditSection | undefined;
  const section = fallbackSection && Object.hasOwn(editSectionLabels, fallbackSection) ? fallbackSection : "lesson";
  const sectionLabel = section === "lesson" ? "Toàn bài · yêu cầu cũ" : editSectionLabels[section];
  return {
    lessonNumber: fallbackLesson,
    section,
    sectionLabel,
    label: version?.edit_scope_label ?? `Bài ${fallbackLesson} · ${sectionLabel}`,
    value: version?.edit_scope ?? fallbackLesson,
  };
}

class ApiError extends Error {
  data: ApiData;
  constructor(message: string, data: ApiData) { super(message); this.data = data; }
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("learning-control-device", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("credential")) request.result.createObjectStore("credential");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCredential() {
  const db = await openDb();
  return new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeCredential(value: Credential) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const request = db.transaction("credential", "readwrite").objectStore("credential").put(value, "primary");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function credentialForDevice() {
  const current = await readCredential();
  if (current?.version === 1 && current.publicKey && current.privateKey) return current;
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json() as ApiData;
  if (!response.ok) throw new ApiError(data.error ?? "Không thể kết nối dịch vụ quản trị.", data);
  return data;
}

async function register(credential: Credential) {
  const data = await api("/api/device", { action: "register", publicKey: credential.publicKey });
  if (!data.device) throw new ApiError("Máy chủ chưa trả về trạng thái thiết bị.", data);
  return data.device;
}

async function proof(credential: Credential, access: Access) {
  const challenge = await api("/api/device", { action: "challenge", deviceId: access.deviceId });
  if (!challenge.challenge || !credential.privateKey) throw new ApiError("Không thể tạo thử thách thiết bị.", challenge);
  const message = new TextEncoder().encode(`learning-control:${access.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: access.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function secureApi(path: string, credential: Credential, access: Access, body: Record<string, unknown>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await api(path, { ...body, ...await proof(credential, access) });
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.data.code !== "DEVICE_PROOF_EXPIRED") throw error;
    }
  }
  throw lastError;
}

async function boiApi<T = ApiData>(bridge: BoiBridge, path: "/api/control/overview" | "/api/control/content" | "/api/control/ai", init?: { method?: "GET" | "POST"; body?: Record<string, unknown>; query?: string }) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.")) {
    throw new ApiError("Vé kết nối Site Bơi ếch không hợp lệ.", {} as ApiData);
  }
  const response = await fetch(`${bridge.baseUrl}${path}${init?.query ?? ""}`, {
    method: init?.method ?? "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}`, "content-type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await response.json().catch(() => ({ error: "Phản hồi Site Bơi ếch không hợp lệ." })) as T & { error?: string };
  if (!response.ok) throw new ApiError(data.error ?? "Không thể kết nối Site Bơi ếch.", data as unknown as ApiData);
  return data as T;
}

async function boiBlob(bridge: BoiBridge, deviceId: string) {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(bridge.baseUrl) || !bridge.token.startsWith("v1.") || !/^[a-f0-9]{64}$/.test(deviceId)) {
    throw new Error("Thông tin xem ảnh chuyển khoản không hợp lệ.");
  }
  const response = await fetch(`${bridge.baseUrl}/api/control/payment-proof?deviceId=${encodeURIComponent(deviceId)}`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: { authorization: `Bearer ${bridge.token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: "Không thể đọc ảnh chuyển khoản." })) as { error?: string };
    throw new Error(data.error ?? "Không thể đọc ảnh chuyển khoản.");
  }
  return URL.createObjectURL(await response.blob());
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

function pendingLearnerLabel(device: LearningDevice) {
  const name = device.learnerName?.trim() || "Chưa nhập tên";
  const code = device.personCode?.trim()
    || (device.personRole === "teacher" ? "Chưa nhập số hiệu SQ/QNCN" : "Chưa nhập mã học viên");
  return `${name} - ${code}`;
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

function mergeLearningDevices(current: LearningDevice[], incoming: LearningDevice[], discoverNew: boolean, statusOnly = false) {
  const incomingById = new Map(incoming.map((device) => [device.deviceId, device]));
  const currentIds = new Set(current.map((device) => device.deviceId));
  const merged = current.map((device) => {
    const update = incomingById.get(device.deviceId);
    if (!update) return device;
    if (!statusOnly) return update;
    return {
      ...device,
      ...update,
      deviceId: device.deviceId,
      deviceCode: device.deviceCode,
      activityTimeline: device.activityTimeline,
    };
  });
  if (discoverNew) {
    for (const device of incoming) {
      if (!currentIds.has(device.deviceId)) merged.push(device);
    }
  }
  return merged;
}

const roleLabels: Record<ControlRole, string> = {
  viewer: "Chỉ xem",
  reviewer: "Kiểm duyệt viên",
  publisher: "Người xuất bản",
  owner: "Chủ hệ thống",
};

const roleCapabilities: { role: ControlRole; title: string; capabilities: string[] }[] = [
  { role: "viewer", title: "Chỉ xem", capabilities: ["Xem thiết bị, trạng thái, tiến độ và số liệu AI", "Không duyệt nội dung", "Không xử lý thanh toán hoặc cấu hình AI"] },
  { role: "reviewer", title: "Kiểm duyệt viên", capabilities: ["Cấp hoặc từ chối quyền sửa", "Đánh giá phản hồi và báo cáo sai của AI", "Không xuất bản, không xác minh thanh toán"] },
  { role: "publisher", title: "Người xuất bản", capabilities: ["Đầy đủ quyền kiểm duyệt", "Xác minh thanh toán, gia hạn và bật bản sửa riêng", "Xuất bản, cấu hình và tắt AI theo học viên"] },
  { role: "owner", title: "Chủ hệ thống", capabilities: ["Toàn bộ quyền xuất bản, AI và tự động xác nhận", "Cấp, đổi và thu hồi quyền quản trị", "Xóa thiết bị rác bằng mã xác nhận và lưu dấu vết kiểm soát", "Bảo vệ tài khoản chủ khỏi tự khóa"] },
];

const statusLabels: Record<DeviceStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã cấp quyền",
  blocked: "Đã khóa",
};

const actionLabels: Record<string, string> = {
  control_device_approved: "Cấp hoặc đổi quyền thiết bị quản trị",
  control_device_blocked: "Khóa thiết bị quản trị",
  control_member_deactivated: "Thu hồi toàn bộ quyền tài khoản quản trị",
  control_member_deleted: "Xóa vĩnh viễn tài khoản quản trị",
  learning_device_approve: "Cấp quyền thiết bị học",
  learning_device_free_approved: "Duyệt tài khoản miễn phí",
  learning_device_payment_required: "Yêu cầu thanh toán 50.000đ",
  learning_device_payment_verified: "Xác minh chuyển khoản và mở tài khoản",
  learning_device_payment_rejected: "Từ chối ảnh chuyển khoản và yêu cầu gửi lại",
  device_registration_submitted: "Người học gửi hồ sơ đăng ký",
  payment_proof_submitted: "Người học gửi ảnh chuyển khoản",
  learning_device_block: "Khóa thiết bị học",
  learning_device_unblocked: "Mở khóa thiết bị học",
  learning_device_profile: "Cập nhật hồ sơ thiết bị học",
  learning_device_reset_progress: "Đặt lại tiến độ học",
  learning_device_deleted: "Xóa vĩnh viễn thiết bị rác",
  learning_device_registration_reopened: "Cho phép thiết bị đã xóa đăng ký lại",
  learning_device_auto_confirmed: "Tự động xác nhận thiết bị mới",
  learning_device_auto_confirmation_deferred: "Chuyển hồ sơ sang chờ duyệt do đủ hạn mức tự động",
  learning_device_personal_edit_enabled: "Bật quyền sửa bản riêng trên thiết bị",
  learning_device_personal_edit_disabled: "Tắt quyền sửa bản riêng trên thiết bị",
  learning_device_access_renewed: "Duyệt lại và gia hạn quyền sử dụng",
  access_automation_updated: "Cập nhật quy tắc tự động xác nhận",
  course_certificate_issued: "Cấp chứng chỉ hoàn thành khóa học",
  content_edit_permission_requested: "Xin quyền chỉnh sửa tại Site Bơi ếch",
  content_edit_permission_approved: "Cho phép bắt đầu chỉnh sửa",
  content_edit_permission_denied: "Từ chối quyền chỉnh sửa",
  content_editor_draft_saved: "Lưu bản nháp tại Site Bơi ếch",
  content_editor_submitted: "Gửi bản sửa về Trung tâm",
  content_changes_requested: "Yêu cầu chỉnh sửa lại",
  content_edit_cancelled: "Trung tâm hủy bản chỉnh sửa",
  content_editor_withdrawn: "Người sửa rút yêu cầu",
  content_published: "Phê duyệt và xuất bản",
  content_rolled_back: "Khôi phục phiên bản",
  ai_settings_updated: "Cập nhật cấu hình AI",
  ai_device_enabled: "Bật AI cho thiết bị học",
  ai_device_disabled: "Tắt AI cho thiết bị học",
  ai_interaction_reviewed: "Giáo viên đánh giá phản hồi AI",
  ai_feedback_resolved: "Xử lý báo cáo chất lượng AI",
  ai_content_draft_reviewed: "AI kiểm tra bản nháp nội dung",
};

function Laptop({ active, status, badge }: { active: boolean; status: DeviceStatus; badge?: number }) {
  return (
    <div className={`laptop ${active ? "is-active" : "is-idle"} status-${status}`} aria-hidden="true">
      <div className="laptop-screen"><i /><span /></div>
      <div className="laptop-base"><i /></div>
      {badge ? <b className="laptop-badge">{badge}</b> : null}
    </div>
  );
}

function DeviceGate({ access, checking, error, retry }: { access: Access | null; checking: boolean; error: string; retry: () => void }) {
  return (
    <main className="gate-shell">
      <section className="gate-card">
        <div className="brand-seal">QT</div>
        <span className={`eyebrow gate-${access?.status ?? "checking"}`}>{access ? statusLabels[access.status] : "Đang xác thực"}</span>
        <h1>{access?.status === "pending" ? "Thiết bị đang chờ chủ hệ thống cấp quyền." : access?.status === "blocked" ? "Thiết bị này đã bị khóa." : "Đang chuẩn bị trung tâm quản trị…"}</h1>
        <p>{access?.status === "pending" ? "Gửi mã dưới đây cho chủ hệ thống. Sau khi được duyệt, trang sẽ tự kiểm tra lại mà không cần nhập mã lần nữa." : error || "Khóa riêng đang được kiểm tra trong trình duyệt hiện tại."}</p>
        {access?.deviceCode ? <div className="gate-code"><span>Mã thiết bị quản trị</span><strong>{access.deviceCode}</strong><button onClick={() => navigator.clipboard.writeText(access.deviceCode)}>Sao chép mã</button></div> : null}
        <button className="button primary" onClick={retry} disabled={checking}>{checking ? "Đang kiểm tra…" : "Kiểm tra lại quyền"}</button>
        <small>Đổi trình duyệt hoặc xóa dữ liệu trang sẽ tạo mã mới và cần duyệt lại.</small>
      </section>
    </main>
  );
}

const reviewFieldLabels: Record<string, string> = {
  outline: "Thông tin hiển thị", content: "Nội dung chi tiết", title: "Tiêu đề", meta: "Thông tin ngắn",
  status: "Nhãn trạng thái", group: "Nhóm bài", summary: "Giới thiệu", duration: "Thời lượng",
  target: "Mục tiêu đạt", objectives: "Mục tiêu học tập", core: "Nội dung cốt lõi", practice: "Thực hành",
  pass: "Tiêu chí đạt", bridge: "Kết nối lộ trình", safety: "An toàn", knowledge: "Phần học",
  analysis: "Điểm phân tích kỹ thuật",
  drills: "Bài tập", mistakes: "Phân tích lỗi", session: "Buổi tập", sessionPlan: "Buổi tập",
  questions: "Bài kiểm tra", memory: "Ghi nhớ", body: "Nội dung", steps: "Các bước", cue: "Khẩu lệnh",
  avoid: "Điều cần tránh", code: "Mã bài tập", goal: "Mục tiêu", volume: "Khối lượng", sign: "Dấu hiệu",
  cause: "Nguyên nhân", fix: "Cách sửa", time: "Thời gian", phases: "Các pha", analysisPhases: "Các pha dùng trong phần phân tích", short: "Tên ngắn",
  action: "Cách thực hiện", purpose: "Mục đích", name: "Tên", drill: "Bài tập sửa lỗi",
  q: "Câu hỏi", options: "Các phương án", answer: "Đáp án đúng", explain: "Giải thích",
};

function reviewLabel(key: string) {
  return reviewFieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

function isReviewRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameReviewValue(current: unknown, proposed: unknown) {
  return JSON.stringify(current) === JSON.stringify(proposed);
}

function changedLeafCount(current: unknown, proposed: unknown): number {
  if (Array.isArray(proposed)) {
    const previous = Array.isArray(current) ? current : [];
    return proposed.reduce((total, item, index) => total + changedLeafCount(previous[index], item), 0)
      + Math.max(0, previous.length - proposed.length);
  }
  if (isReviewRecord(proposed)) {
    const previous = isReviewRecord(current) ? current : {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(proposed)]);
    return [...keys].reduce((total, key) => total + changedLeafCount(previous[key], proposed[key]), 0);
  }
  return sameReviewValue(current, proposed) ? 0 : 1;
}

function reviewDisplay(fieldKey: string, value: unknown) {
  if (fieldKey === "answer" && typeof value === "number") return String.fromCharCode(65 + value);
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function DiffReviewValue({ fieldKey, current, proposed }: { fieldKey: string; current: unknown; proposed: unknown }) {
  const changed = !sameReviewValue(current, proposed);
  if (Array.isArray(proposed)) {
    const previous = Array.isArray(current) ? current : [];
    return <section className={`review-value group ${changed ? "changed-group" : ""}`}><h4>{reviewLabel(fieldKey)}{changed ? <small>Có thay đổi</small> : null}</h4><div>{proposed.map((item, index) => <article key={index}><strong>{fieldKey === "questions" ? `Câu ${index + 1}` : `Mục ${index + 1}`}</strong>{isReviewRecord(item) ? Object.entries(item).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={isReviewRecord(previous[index]) ? previous[index][key] : undefined} proposed={child} />) : <DiffReviewValue fieldKey={`Mục ${index + 1}`} current={previous[index]} proposed={item} />}</article>)}</div></section>;
  }
  if (isReviewRecord(proposed)) {
    const previous = isReviewRecord(current) ? current : {};
    return <section className={`review-value group ${changed ? "changed-group" : ""}`}><h4>{reviewLabel(fieldKey)}{changed ? <small>Có thay đổi</small> : null}</h4><div>{Object.entries(proposed).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={previous[key]} proposed={child} />)}</div></section>;
  }
  const nextDisplay = reviewDisplay(fieldKey, proposed);
  if (!changed) return <div className="review-value field"><span>{reviewLabel(fieldKey)}</span><p>{nextDisplay}</p></div>;
  return (
    <details className="review-value field changed">
      <summary><span>{reviewLabel(fieldKey)} <b>Đã thay đổi</b></span><p>{nextDisplay}</p><small>Nhấn để xem bản cũ</small></summary>
      <div className="previous-value"><span>Bản cũ đang trên máy chủ</span><p>{reviewDisplay(fieldKey, current)}</p></div>
    </details>
  );
}

function SectionDiffReview({ current, proposed }: { current: unknown; proposed: unknown }) {
  if (!isReviewRecord(proposed)) return <div className="lesson-review empty">Chưa có nội dung để đối chiếu.</div>;
  const previous = isReviewRecord(current) ? current : {};
  const changed = changedLeafCount(previous, proposed);
  return <div className="diff-review-shell"><div className="diff-review-summary"><div><span>Kết quả đối chiếu</span><strong>{changed} trường đã thay đổi</strong></div><p>Màu đỏ là nội dung mới. Nhấn vào từng trường màu đỏ để mở bản cũ ngay bên dưới.</p></div><div className="lesson-review diff-review">{Object.entries(proposed).map(([key, child]) => <DiffReviewValue key={key} fieldKey={key} current={previous[key]} proposed={child} />)}</div></div>;
}

function ContentReviewCenter({ bridge, access, automation, saveAutomation }: {
  bridge: BoiBridge;
  access: Access;
  automation?: AccessAutomation;
  saveAutomation: (enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) => void;
}) {
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [currentSection, setCurrentSection] = useState<unknown>(null);
  const [proposalSection, setProposalSection] = useState<unknown>(null);
  const [loadedScope, setLoadedScope] = useState<EditScopeInfo | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = versions.find((item) => item.id === selectedId) ?? null;
  const scope = loadedScope ?? contentScope(selected);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    setNotice("");
    try {
      const data = await boiApi(bridge, "/api/control/content", { method: "POST", body });
      if (data.versions) setVersions(data.versions);
      if (data.versionId) setSelectedId(data.versionId);
      setNotice(success);
      return data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật nội dung.");
      return null;
    } finally { setBusy(false); }
  }

  useEffect(() => {
    let cancelled = false;
    boiApi(bridge, "/api/control/content")
      .then(async (data) => {
        if (cancelled) return;
        setVersions(data.versions ?? []);
        const priority = (data.versions ?? []).find((item) => ["permission_requested", "review"].includes(item.status));
        if (!priority) return;
        setSelectedId(priority.id);
        const detail = await boiApi(bridge, "/api/control/content", { query: `?versionId=${encodeURIComponent(priority.id)}` });
        if (cancelled) return;
        setVersions(detail.versions ?? []);
        setCurrentSection(detail.currentSection ?? null);
        setProposalSection(detail.proposedSection ?? null);
        setLoadedScope(detail.editScope ?? null);
        setNote(priority.permission_note ?? "");
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Chưa thể tải xưởng nội dung."); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access.deviceId, bridge.token]);

  async function openVersion(id: string) {
    setBusy(true);
    setSelectedId(id);
    setLoadedScope(null);
    setCurrentSection(null);
    setProposalSection(null);
    try {
      const data = await boiApi(bridge, "/api/control/content", { query: `?versionId=${encodeURIComponent(id)}` });
      setVersions(data.versions ?? []);
      setCurrentSection(data.currentSection ?? null);
      setProposalSection(data.proposedSection ?? null);
      setLoadedScope(data.editScope ?? null);
      const version = data.versions?.find((item) => item.id === id);
      setNote(version?.permission_note ?? "");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể mở phiên bản."); }
    finally { setBusy(false); }
  }

  const statusLabel: Record<ContentVersion["status"], string> = {
    permission_requested: "Xin quyền chỉnh sửa",
    draft: "Đang chỉnh sửa tại Bơi ếch",
    review: "Chờ kiểm tra bản sửa",
    published: "Đã cập nhật máy chủ",
    changes_requested: "Yêu cầu sửa lại",
    denied: "Từ chối cấp quyền",
    cancelled: "Đã hủy",
    archived: "Phiên bản cũ",
  };

  return (
    <section className="content-review-layout">
      {automation ? <AutomationCenter key={`${automation.updatedAt}-${automation.enabled}-${automation.defaultAccessDays}-${automation.defaultDeviceLimit}`} automation={automation} canManage={["publisher", "owner"].includes(access.role)} save={saveAutomation} /> : null}
      <section className="studio-grid review-center">
      <aside className="version-panel">
        <header><span>Luồng từ Site nội dung</span><h2>Yêu cầu chỉnh sửa</h2></header>
        <div className="editor-note">Trung tâm không sửa bài học. Mọi bản sửa phải được tạo và gửi từ Site Bơi ếch.</div>
        <div className="version-list">
          {versions.map((item) => <button key={item.id} className={selectedId === item.id ? "selected" : ""} onClick={() => void openVersion(item.id)}><span>{item.edit_scope_label ?? contentScope(item).label}</span><strong>{statusLabel[item.status]}</strong><small>{item.created_by} · {item.summary || "Không có mô tả"}</small></button>)}
          {versions.length === 0 ? <p>Chưa có yêu cầu nào từ Site Bơi ếch.</p> : null}
        </div>
      </aside>

      <div className="editor-panel">
        <header className="editor-heading"><div><span>{selected ? statusLabel[selected.status] : "Chọn một yêu cầu"}</span><h2>{selected ? `${scope.label} · ${selected.summary || "Yêu cầu chỉnh sửa"}` : "Kiểm soát thay đổi nội dung"}</h2></div></header>
        {selected ? <div className="request-facts"><div><span>Người yêu cầu</span><strong>{selected.created_by}</strong></div><div><span>Thiết bị nội dung</span><strong>{selected.editor_device_code || "—"}</strong></div><div><span>Yêu cầu lúc</span><strong>{formatDate(selected.created_at)}</strong></div><div><span>Trạng thái</span><strong>{statusLabel[selected.status]}</strong></div></div> : null}
        {selected?.status === "permission_requested" ? <div className="decision-card"><span className="review-scope-pill">{scope.label}</span><h3>Cho phép bắt đầu sửa đúng phần này?</h3><p>Chỉ sau khi được chấp thuận, đúng người dùng và đúng laptop mới mở được <strong>{scope.sectionLabel}</strong> của Bài {scope.lessonNumber}. Bốn phần còn lại không được tải vào trình biên tập.</p></div> : null}
        {selected && ["review", "published", "archived", "changes_requested"].includes(selected.status) && proposalSection ? <section className="section-review-panel"><header><div><span>Phạm vi gửi từ Site Bơi ếch</span><h3>{scope.label}</h3></div><small>Toàn bộ phần được gửi để duyệt; chỉ những trường thực sự thay đổi được đánh dấu đỏ.</small></header><SectionDiffReview current={currentSection} proposed={proposalSection} /></section> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}
        <div className="editor-actions">
          {selected?.status === "permission_requested" ? <><textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú cấp quyền (không bắt buộc)" /><button className="button danger" onClick={() => void run({ action: "deny-edit", versionId: selected.id, note }, "Đã từ chối yêu cầu chỉnh sửa.")} disabled={busy}>Từ chối</button><button className="button primary" onClick={() => void run({ action: "approve-edit", versionId: selected.id, note }, "Đã cho phép chỉnh sửa trên Site Bơi ếch.")} disabled={busy}>Cho phép sửa {scope.sectionLabel}</button></> : null}
          {selected?.status === "review" ? <><textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nhận xét cụ thể cho người sửa" /><button className="button danger" onClick={() => void run({ action: "cancel", versionId: selected.id, note }, "Đã hủy bản chỉnh sửa.")} disabled={busy}>Hủy bỏ</button><button className="button accent" onClick={() => void run({ action: "request-changes", versionId: selected.id, note }, "Đã yêu cầu sửa lại trên Site Bơi ếch.")} disabled={busy}>Yêu cầu sửa lại</button></> : null}
          {selected?.status === "review" && ["publisher", "owner"].includes(access.role) ? <button className="button primary" onClick={() => void run({ action: "approve-publish", versionId: selected.id }, "Đã đồng ý cập nhật bản mới lên máy chủ.")} disabled={busy}>Đồng ý cập nhật</button> : null}
          {selected && ["archived", "published"].includes(selected.status) && ["publisher", "owner"].includes(access.role) ? <button className="button" onClick={() => void run({ action: "rollback", versionId: selected.id }, "Đã khôi phục phiên bản được chọn.")} disabled={busy}>Khôi phục phiên bản này</button> : null}
        </div>
      </div>
      </section>
    </section>
  );
}

const paymentStatusLabels: Record<LearningDevice["paymentStatus"], string> = {
  unassigned: "Chưa thanh toán",
  awaiting_payment: "Chưa thanh toán",
  proof_submitted: "Chưa thanh toán",
  free_approved: "Miễn phí",
  paid_verified: "Đã trả phí",
};

const deletedReasonLabels: Record<DeletedLearningDevice["reason"], string> = {
  spam: "Thiết bị rác / spam",
  duplicate: "Đăng ký trùng",
  test: "Thiết bị thử nghiệm",
  other: "Lý do khác",
};

const paymentStatusNotes: Record<LearningDevice["paymentStatus"], string> = {
  unassigned: "Chưa phân nhóm tài khoản.",
  awaiting_payment: "Đang chờ người học chuyển khoản 50.000đ.",
  proof_submitted: "Đã gửi ảnh chuyển khoản, đang chờ quản trị viên xác minh.",
  free_approved: "Tài khoản miễn phí đã được mở.",
  paid_verified: "Chuyển khoản đã được xác minh và tài khoản đã mở.",
};

function ActivityChart({
  title,
  data,
  value,
  summary,
  color,
}: {
  title: string;
  data: ActivityDay[];
  value: (day: ActivityDay) => number;
  summary: string;
  color: string;
}) {
  const values = data.map(value);
  const maximum = Math.max(1, ...values);
  return (
    <article className="activity-chart">
      <header><span>{title}</span><strong>{summary}</strong></header>
      <div className="activity-bars" aria-label={`${title} trong 30 ngày`}>
        {data.map((day) => <i key={day.date} title={`${day.date}: ${value(day)}`} style={{ height: `${Math.max(value(day) > 0 ? 8 : 2, value(day) / maximum * 100)}%`, background: color }} />)}
      </div>
      <footer><span>{data[0]?.date.slice(5).replace("-", "/") ?? "—"}</span><span>{data.at(-1)?.date.slice(5).replace("-", "/") ?? "—"}</span></footer>
    </article>
  );
}

function AutomationCenter({ automation, canManage, save }: {
  automation: AccessAutomation;
  canManage: boolean;
  save: (enabled: boolean, defaultAccessDays: number, defaultDeviceLimit: number) => void;
}) {
  const [enabled, setEnabled] = useState(automation.enabled);
  const [days, setDays] = useState(automation.defaultAccessDays);
  const [deviceLimit, setDeviceLimit] = useState(automation.defaultDeviceLimit);
  function toggleAutomation() {
    const next = !enabled;
    setEnabled(next);
    save(next, days, deviceLimit);
  }
  return (
    <section className="automation-inline" aria-labelledby="automatic-edit-title">
      <div className="automation-inline-copy">
        <span>Quy tắc tại tab Duyệt chỉnh sửa</span>
        <h2 id="automatic-edit-title">Tự động duyệt quyền sửa cục bộ</h2>
        <p>Khi bật, hồ sơ <strong>Giảng viên</strong> mới nhập đủ thông tin được dùng miễn phí và sửa bản riêng ngay trên thiết bị. Bản sửa chỉ lưu tại client; không gửi, không duyệt và không cập nhật nội dung máy chủ.</p>
      </div>
      <button className={`automation-switch ${enabled ? "on" : "off"}`} onClick={toggleAutomation} disabled={!canManage} aria-pressed={enabled}><i /><span>{enabled ? "Đang bật" : "Đang tắt"}</span></button>
      <label className="automation-days"><span>Thời hạn miễn phí</span><div><input type="number" min={1} max={365} value={days} onChange={(event) => setDays(Math.max(1, Math.min(365, Number(event.target.value) || 60)))} disabled={!canManage} /><b>ngày</b></div></label>
      <label className="automation-days automation-device-limit"><span>Số thiết bị tự động</span><div><input type="number" min={1} max={1000} value={deviceLimit} onChange={(event) => setDeviceLimit(Math.max(1, Math.min(1000, Number(event.target.value) || 20)))} disabled={!canManage} /><b>thiết bị</b></div></label>
      <button className="button" disabled={!canManage || (days === automation.defaultAccessDays && deviceLimit === automation.defaultDeviceLimit)} onClick={() => save(enabled, days, deviceLimit)}>Lưu quy tắc</button>
      <small className="automation-usage"><b>{automation.activeAutoFreeDeviceCount}/{automation.defaultDeviceLimit}</b> thiết bị tự động đang còn quyền · còn {automation.remainingAutoFreeDeviceSlots} suất</small>
      <small className="automation-boundary"><b>Không tự động xuất bản.</b> Khi đủ hạn mức, hồ sơ mới chuyển sang chờ duyệt thủ công. Học viên không được cấp quyền sửa; bản sửa của Giảng viên chỉ trở thành nội dung máy chủ sau một lần duyệt riêng.</small>
    </section>
  );
}

function DeletedDevicesPanel({ devices, restore }: {
  devices: DeletedLearningDevice[];
  restore: (device: DeletedLearningDevice, confirmation: string) => Promise<boolean>;
}) {
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [busyDeviceId, setBusyDeviceId] = useState("");
  if (devices.length === 0) return null;
  return (
    <details className="deleted-devices-panel">
      <summary><span>Danh sách đã loại bỏ</span><strong>{devices.length} thiết bị</strong><small>Có thể mở lại để chính thiết bị đó tạo một hồ sơ hoàn toàn mới.</small></summary>
      <div>{devices.map((device) => { const confirmation = confirmations[device.deviceId] ?? ""; return <article key={device.deviceId}><div><span>{device.learnerName || "Không có hồ sơ"}</span><strong>{device.deviceCode}</strong><small>{deletedReasonLabels[device.reason]} · Xóa lúc {formatDate(device.deletedAt)}</small><small>Người thực hiện: {device.deletedBy}</small></div><label><span>Nhập đúng mã để tạo lại từ đầu</span><input value={confirmation} onChange={(event) => setConfirmations((current) => ({ ...current, [device.deviceId]: event.target.value.toUpperCase() }))} placeholder={device.deviceCode} autoComplete="off" /></label><button className="button" disabled={busyDeviceId === device.deviceId || confirmation.trim().toUpperCase() !== device.deviceCode} onClick={async () => { setBusyDeviceId(device.deviceId); const ok = await restore(device, confirmation); if (!ok) setBusyDeviceId(""); }}>{busyDeviceId === device.deviceId ? "Đang xử lý…" : "Cho phép tạo hồ sơ mới"}</button></article>; })}</div>
    </details>
  );
}

function DeviceDrawer({
  device,
  bridge,
  canManage,
  canDelete,
  activityLoading,
  close,
  action,
}: {
  device: LearningDevice;
  bridge: BoiBridge;
  canManage: boolean;
  canDelete: boolean;
  activityLoading: boolean;
  close: () => void;
  action: (operation: string, success: string, extra?: Record<string, unknown>) => Promise<boolean>;
}) {
  const legacyNameParts = device.learnerName?.trim().split(/\s+/).filter(Boolean) ?? [];
  const [profile, setProfile] = useState({
    learnerFamilyName: device.learnerFamilyName ?? (legacyNameParts.length > 1 ? legacyNameParts.slice(0, -1).join(" ") : ""),
    learnerGivenName: device.learnerGivenName ?? legacyNameParts.at(-1) ?? "",
    label: device.label ?? "",
    accessExpiresAt: device.accessExpiresAt ? device.accessExpiresAt.slice(0, 10) : "",
  });
  const [paymentReviewNote, setPaymentReviewNote] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofError, setProofError] = useState("");
  const [proofLoading, setProofLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteReason, setDeleteReason] = useState("spam");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const timeline = device.activityTimeline ?? [];
  const loginTotal = timeline.reduce((total, day) => total + day.loginCount, 0);
  const studyTotal = timeline.reduce((total, day) => total + day.studyMinutes, 0);
  const quizTotal = timeline.reduce((total, day) => total + day.quizAttempts, 0);
  const lastProgress = timeline.at(-1)?.progressPercent ?? device.completionPercent;

  useEffect(() => () => { if (proofUrl) URL.revokeObjectURL(proofUrl); }, [proofUrl]);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  async function loadProof() {
    setProofLoading(true);
    setProofError("");
    try {
      const nextUrl = await boiBlob(bridge, device.deviceId);
      setProofUrl((current) => { if (current) URL.revokeObjectURL(current); return nextUrl; });
    } catch (caught) { setProofError(caught instanceof Error ? caught.message : "Không thể tải ảnh chuyển khoản."); }
    finally { setProofLoading(false); }
  }

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}>
      <aside className="device-drawer" role="dialog" aria-modal="true" aria-labelledby="device-drawer-title">
        <header><div><span>Hồ sơ thiết bị</span><h2 id="device-drawer-title">{device.learnerName || device.label || device.deviceCode}</h2></div><button onClick={close} aria-label="Đóng">×</button></header>
        <div className="drawer-hero"><Laptop active={device.active} status={device.status} /><div><span className={`state-chip ${device.active ? "online" : "offline"}`}>{device.active ? "Online" : "Offline"}</span><strong>{device.deviceCode}</strong><small>{device.active ? `Tín hiệu lúc ${formatDate(device.lastPresenceAt)}` : `Offline từ ${formatDate(device.offlineSinceAt)}`}</small></div><span className={`group-chip ${device.accessGroup}`}>{paymentStatusLabels[device.paymentStatus]}</span></div>

        <section className="progress-pair"><article><span>Hoàn thành</span><strong>{device.completionPercent}%</strong><div><i style={{ width: `${device.completionPercent}%` }} /></div><small>{device.completedSteps}/40 phần · {device.completedLessons}/8 bài đạt</small></article><article><span>Nắm vững</span><strong>{device.masteryPercent}%</strong><div><i style={{ width: `${device.masteryPercent}%` }} /></div><small>{device.attempts} lượt kiểm tra</small></article></section>

        <section className="activity-panel"><div><span>Hoạt động theo thiết bị</span><h3>{activityLoading ? "Đang tải biểu đồ…" : "Biểu đồ 30 ngày gần nhất"}</h3></div><div className="activity-grid"><ActivityChart title="Lần đăng nhập" data={timeline} value={(day) => day.loginCount} summary={`${loginTotal} lượt`} color="#247f77" /><ActivityChart title="Thời gian làm bài" data={timeline} value={(day) => day.studyMinutes} summary={`${studyTotal} phút`} color="#be7a3a" /><ActivityChart title="Lượt kiểm tra" data={timeline} value={(day) => day.quizAttempts} summary={`${quizTotal} lượt`} color="#7656a8" /><ActivityChart title="Tiến độ" data={timeline} value={(day) => day.progressPercent} summary={`${lastProgress}%`} color="#3b739b" /></div></section>

        <dl className="device-facts"><div><dt>Họ và tên</dt><dd>{device.learnerName || "Chưa gửi"}</dd></div><div><dt>Vai trò</dt><dd>{device.personRole === "teacher" ? "Giảng viên" : device.personRole === "learner" ? "Học viên" : "Chưa chọn"}</dd></div><div><dt>{device.personRole === "teacher" ? "Số hiệu SQ/QNCN" : "Mã số học viên"}</dt><dd>{device.personCode || "Chưa gửi"}</dd></div><div><dt>Lớp / đơn vị</dt><dd>{device.className || "Chưa gửi"}</dd></div><div><dt>Số điện thoại</dt><dd>{device.phone || "Chưa gửi"}</dd></div><div><dt>Đang ở</dt><dd>{device.lastLesson ? `Bài ${device.lastLesson} · ${device.lastPart ?? "—"}` : "Chưa bắt đầu"}</dd></div><div><dt>Thời gian học</dt><dd>{duration(device.totalActiveSeconds)}</dd></div><div><dt>Trạng thái quyền</dt><dd>{device.accessExpired ? "Đã hết hạn · cần duyệt lại" : device.accessExpiringSoon ? `Sắp hết hạn · còn ${device.accessDaysRemaining ?? 0} ngày` : statusLabels[device.status]}</dd></div><div><dt>Thanh toán</dt><dd>{paymentStatusLabels[device.paymentStatus]}</dd></div><div><dt>Sửa bản riêng</dt><dd>{device.personRole !== "teacher" ? "Không áp dụng cho Học viên" : device.personalEditConfigured ? device.accessExpired ? "Tạm dừng vì hết hạn" : "Đang bật · chỉ thiết bị này" : "Đang tắt"}</dd></div><div><dt>Tự xác nhận lúc</dt><dd>{formatDate(device.autoConfirmedAt)}</dd></div><div><dt>Chi tiết thanh toán</dt><dd>{device.paymentReviewNote || paymentStatusNotes[device.paymentStatus]}</dd></div><div><dt>Tín hiệu thiết bị cuối</dt><dd>{formatDate(device.lastPresenceAt)}</dd></div><div><dt>Offline từ</dt><dd>{device.active ? "—" : formatDate(device.offlineSinceAt)}</dd></div><div><dt>Hoạt động học cuối</dt><dd>{formatDate(device.lastLearningActivityAt)}</dd></div><div><dt>Hết hạn</dt><dd>{formatDate(device.accessExpiresAt)}</dd></div></dl>

        <section className={`payment-review ${device.accessGroup}`}><div><span>Trạng thái thanh toán</span><h3>{paymentStatusLabels[device.paymentStatus]}</h3><p>{device.paymentReviewNote || paymentStatusNotes[device.paymentStatus]} {device.accessGroup === "paid" ? `Mức phí tài khoản: ${device.paymentAmount.toLocaleString("vi-VN")}đ.` : ""}</p></div>{device.paymentProofAvailable && canManage ? <button className="button" onClick={() => void loadProof()} disabled={proofLoading}>{proofLoading ? "Đang tải ảnh…" : proofUrl ? "Tải lại ảnh" : "Xem ảnh chuyển khoản"}</button> : null}{proofError ? <div className="alert warning">{proofError}</div> : null}{proofUrl ? <figure><img src={proofUrl} alt={`Ảnh chuyển khoản của ${device.learnerName || device.deviceCode}`} /><figcaption>Ảnh do thiết bị gửi lúc {formatDate(device.paymentSubmittedAt)}. Người quản trị cần đối chiếu trước khi xác minh.</figcaption></figure> : null}{device.paymentStatus === "proof_submitted" && canManage ? <label className="payment-note"><span>Lý do nếu ảnh chưa hợp lệ</span><textarea value={paymentReviewNote} onChange={(event) => setPaymentReviewNote(event.target.value)} placeholder="Ví dụ: Chưa thấy đúng số tiền hoặc nội dung chuyển khoản…" maxLength={500} /></label> : null}</section>

        <section className="profile-form"><label><span>Họ</span><input value={profile.learnerFamilyName} onChange={(event) => setProfile({ ...profile, learnerFamilyName: event.target.value })} /></label><label><span>Tên</span><input value={profile.learnerGivenName} onChange={(event) => setProfile({ ...profile, learnerGivenName: event.target.value })} /></label><label><span>Tên gợi nhớ thiết bị</span><input value={profile.label} onChange={(event) => setProfile({ ...profile, label: event.target.value })} /></label><label><span>Ngày hết hạn</span><input type="date" value={profile.accessExpiresAt} onChange={(event) => setProfile({ ...profile, accessExpiresAt: event.target.value })} /></label></section>
        {!device.registrationComplete ? <div className="alert warning">Chưa thể duyệt: thiết bị phải gửi đủ vai trò, mã định danh, họ tên, lớp/đơn vị và số điện thoại.</div> : null}
        {canManage ? <>{device.personRole === "teacher" ? <section className={`personal-edit-control ${device.personalEditConfigured ? "enabled" : "disabled"}`}><div><span>Quyền sửa cục bộ của Giảng viên</span><h3>{device.personalEditConfigured ? "Đang cho phép sửa bản riêng" : "Chưa bật sửa bản riêng"}</h3><p>Khi bật: tự mở tài khoản miễn phí theo thời hạn mặc định; nội dung sửa chỉ có tác dụng trên thiết bị và không thể cập nhật máy chủ.</p></div><button className={`automation-switch ${device.personalEditConfigured ? "on" : "off"}`} onClick={() => void action("toggle-personal-edit", device.personalEditConfigured ? "Đã tắt quyền sửa bản riêng trên thiết bị." : "Đã bật tài khoản miễn phí và quyền sửa bản riêng theo thời hạn mặc định.", { enabled: !device.personalEditConfigured })} aria-pressed={device.personalEditConfigured}><i /><span>{device.personalEditConfigured ? "Đang bật" : "Đang tắt"}</span></button></section> : <div className="personal-edit-na"><strong>Hồ sơ Học viên</strong><span>Không có quyền xin hoặc sửa nội dung bài giảng.</span></div>}<div className="drawer-actions"><button className="button" onClick={() => void action("profile", "Đã lưu hồ sơ và thời hạn thiết bị.", profile)}>Lưu hồ sơ & thời hạn</button>{device.registrationComplete ? <button className="button primary" onClick={() => void action("renew-access", "Đã duyệt lại và gia hạn thiết bị theo thời hạn mặc định.")}>Duyệt lại · gia hạn</button> : null}{device.registrationComplete && device.accessGroup !== "free" && device.paymentStatus !== "paid_verified" ? <button className="button primary" onClick={() => void action("grant-free", "Đã mở tài khoản miễn phí và đưa vào nhóm Miễn phí.")}>Duyệt miễn phí</button> : null}{device.registrationComplete && device.accessGroup === "unassigned" ? <button className="button accent" onClick={() => void action("require-payment", "Đã gửi QR và yêu cầu thanh toán 50.000đ tới thiết bị.")}>Yêu cầu trả phí</button> : null}{device.paymentStatus === "proof_submitted" ? <button className="button danger" onClick={() => void action("reject-payment", "Đã từ chối ảnh và gửi lý do để người học nộp lại.", { note: paymentReviewNote })}>Yêu cầu gửi lại ảnh</button> : null}{device.paymentStatus === "proof_submitted" ? <button className="button primary" onClick={() => { if (window.confirm("Đã đối chiếu đúng giao dịch và mở tài khoản này?")) void action("verify-payment", "Đã xác minh chuyển khoản, mở tài khoản và đưa vào nhóm Trả phí."); }}>Xác minh & mở tài khoản</button> : null}{device.status === "blocked" ? <button className="button primary" onClick={() => void action("unblock", "Đã mở khóa thiết bị theo trạng thái tài khoản hiện tại.")}>Mở khóa thiết bị</button> : <button className="button danger" onClick={() => { if (window.confirm(`Khóa thiết bị ${device.deviceCode}?`)) void action("block", "Đã khóa thiết bị."); }}>Khóa thiết bị</button>}<button className="button danger" onClick={() => { if (window.confirm(`Đặt lại toàn bộ tiến độ của ${device.learnerName || device.deviceCode}?`)) void action("reset-progress", "Đã đặt lại tiến độ học."); }}>Đặt lại tiến độ</button></div></> : null}
        {canDelete ? <section className="device-danger-zone"><div><span>Quyền Chủ hệ thống</span><h3>Xóa thiết bị rác khỏi hệ thống</h3><p>Thao tác này xóa đăng ký, tiến độ, phiên học và dữ liệu AI của thiết bị. Nhật ký xóa vẫn được giữ. Tài khoản đã xác minh thanh toán hoặc đã có chứng chỉ sẽ được bảo vệ và không thể xóa.</p></div><label><span>Lý do xóa</span><select value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)}><option value="spam">Thiết bị rác / spam</option><option value="duplicate">Đăng ký trùng</option><option value="test">Thiết bị thử nghiệm</option><option value="other">Lý do khác</option></select></label><label><span>Nhập đúng mã <b>{device.deviceCode}</b></span><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())} placeholder={device.deviceCode} autoComplete="off" /></label><button className="button danger permanent-delete" disabled={deleteSubmitting || deleteConfirmation.trim().toUpperCase() !== device.deviceCode} onClick={async () => { setDeleteSubmitting(true); const ok = await action("delete-spam-device", `Đã xóa thiết bị ${device.deviceCode} và dữ liệu rác liên quan.`, { confirmDeviceCode: deleteConfirmation, deleteReason }); if (!ok) setDeleteSubmitting(false); }}>{deleteSubmitting ? "Đang xóa…" : "Xóa vĩnh viễn thiết bị"}</button></section> : null}
      </aside>
    </div>
  );
}

export default function ControlCenter({ user }: { user: { displayName: string; email: string } }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [boiOnline, setBoiOnline] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [tab, setTab] = useState<"devices" | "ai" | "content" | "approvals" | "audit">("devices");
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "incomplete" | "payment" | "paid" | "free" | "expired" | "blocked">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<LearningDevice | null>(null);
  const [selectedActivityLoading, setSelectedActivityLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [appearanceReady, setAppearanceReady] = useState(false);
  const [appearance, setAppearance] = useState<AdminAppearance>(defaultAdminAppearance);
  const refreshRunning = useRef(false);
  const dashboardRef = useRef<Dashboard | null>(null);
  const detailRequest = useRef(0);

  function commitDashboard(next: Dashboard) {
    dashboardRef.current = next;
    setDashboard(next);
  }

  async function loadBoi(currentDashboard: Dashboard, discoverNew: boolean, quiet = false) {
    try {
      const currentDevices = dashboardRef.current?.learningDevices ?? currentDashboard.learningDevices;
      if (!discoverNew && currentDevices.length === 0) {
        setBoiOnline(true);
        if (!quiet) setError("");
        return true;
      }
      const statusQuery = discoverNew
        ? "?activityDays=0"
        : `?deviceCodes=${encodeURIComponent(currentDevices.map((device) => device.deviceCode).join(","))}&activityDays=0`;
      const upstream = await boiApi(currentDashboard.boiBridge, "/api/control/overview", { query: statusQuery });
      const upstreamAudit = Array.isArray(upstream.auditLog) ? upstream.auditLog : [];
      const incomingDevices = upstream.devices ?? [];
      const devices = mergeLearningDevices(currentDevices, incomingDevices, discoverNew, !discoverNew);
      const knownIds = new Set(currentDevices.map((device) => device.deviceId));
      const added = discoverNew ? incomingDevices.filter((device) => !knownIds.has(device.deviceId)) : [];
      const addedPending = added.filter((device) => device.status === "pending" && device.registrationComplete).map(pendingLearnerLabel);
      if (addedPending.length > 0) setNotice(`Có thiết bị mới chờ duyệt: ${addedPending.join(", ")}`);
      const combinedAudit = [...upstreamAudit, ...currentDashboard.auditLog].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)).slice(0, 150);
      commitDashboard({
        ...currentDashboard,
        application: upstream.application ?? currentDashboard.application,
        learningDevices: devices,
        automation: upstream.automation ?? currentDashboard.automation,
        deletedDevices: upstream.deletedDevices ?? currentDashboard.deletedDevices,
        upstreamError: null,
        applications: currentDashboard.applications.map((app) => app.id === "boi-ech" ? { ...app, status: "online" } : app),
        auditLog: combinedAudit,
      });
      setSelected((current) => current ? devices.find((item) => item.deviceId === current.deviceId) ?? current : null);
      setBoiOnline(true);
      if (!quiet) setError("");
      return true;
    } catch (caught) {
      setBoiOnline(false);
      const message = caught instanceof Error ? caught.message : "Chưa thể đồng bộ Site Bơi ếch.";
      const previous = dashboardRef.current;
      commitDashboard({
        ...currentDashboard,
        learningDevices: previous?.learningDevices ?? [],
        automation: previous?.automation ?? currentDashboard.automation,
        deletedDevices: previous?.deletedDevices ?? currentDashboard.deletedDevices,
        auditLog: previous?.auditLog ?? currentDashboard.auditLog,
        upstreamError: message,
        applications: currentDashboard.applications.map((app) => app.id === "boi-ech" ? { ...app, status: "warning" } : app),
      });
      if (!quiet) setError(message);
      return false;
    }
  }

  async function refresh(currentCredential = credential, currentAccess = access, options: { discoverNew?: boolean; quiet?: boolean } = {}) {
    if (!currentCredential || !currentAccess || currentAccess.status !== "approved" || refreshRunning.current) return;
    const discoverNew = options.discoverNew ?? true;
    const quiet = options.quiet ?? false;
    refreshRunning.current = true;
    if (!quiet) setChecking(true);
    try {
      const data = await secureApi("/api/dashboard", currentCredential, currentAccess, { action: "bootstrap" });
      const fetched = data as Dashboard;
      const previous = dashboardRef.current;
      const next = {
        ...fetched,
        learningDevices: previous?.learningDevices ?? fetched.learningDevices,
        deletedDevices: previous?.deletedDevices ?? fetched.deletedDevices,
        auditLog: previous?.auditLog ?? fetched.auditLog,
      };
      commitDashboard(next);
      await loadBoi(next, discoverNew, quiet);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải bảng quản trị."); }
    finally { refreshRunning.current = false; if (!quiet) setChecking(false); }
  }

  async function initialize() {
    setChecking(true);
    setError("");
    try {
      const key = await credentialForDevice();
      setCredential(key);
      const state = await register(key);
      setAccess(state);
      if (state.status === "approved") await refresh(key, state, { discoverNew: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể đăng ký thiết bị quản trị."); }
    finally { setChecking(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const startupTimer = window.setTimeout(() => setOnline(navigator.onLine), 0);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstall);
    return () => {
      window.clearTimeout(startupTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("learning-control-appearance-v1");
        if (saved) setAppearance({ ...defaultAdminAppearance, ...JSON.parse(saved) });
      } catch {
        setAppearance(defaultAdminAppearance);
      } finally {
        setAppearanceReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!appearanceReady) return;
    window.localStorage.setItem("learning-control-appearance-v1", JSON.stringify(appearance));
  }, [appearance, appearanceReady]);

  useEffect(() => {
    if (!appearanceOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setAppearanceOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [appearanceOpen]);

  async function installWebApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  function downloadReport(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportDevices() {
    const rows = visibleDevices.map((device, index) => [
      index + 1,
      device.learnerName ?? "",
      device.personRole === "teacher" ? "Giảng viên" : device.personRole === "learner" ? "Học viên" : "",
      device.personCode ?? "",
      device.className ?? "",
      device.phone ?? "",
      device.deviceCode,
      device.active ? "Online" : "Offline",
      paymentStatusLabels[device.paymentStatus],
      device.completionPercent,
      device.masteryPercent,
      device.completedLessons,
      device.totalActiveSeconds,
      device.lastPresenceAt,
      device.accessExpiresAt ?? "",
      device.personalEditConfigured ? "Đang bật" : "Đang tắt",
      device.autoConfirmedAt ?? "",
    ]);
    const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["STT", "Họ và tên", "Vai trò", "Mã số HV/Số hiệu SQ-QNCN", "Lớp/đơn vị", "SĐT", "Mã thiết bị", "Kết nối", "Thanh toán", "Tiến độ %", "Nắm vững %", "Bài đạt", "Giây học", "Tín hiệu cuối", "Hết hạn", "Sửa bản riêng", "Tự xác nhận lúc"];
    downloadReport(`bao-cao-thiet-bi-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${[header, ...rows].map((row) => row.map(escape).join(",")).join("\n")}`, "text/csv;charset=utf-8");
  }

  function exportAudit() {
    downloadReport(`nhat-ky-quan-tri-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), entries: dashboard?.auditLog ?? [] }, null, 2), "application/json");
  }

  useEffect(() => {
    if (!credential || access?.status !== "pending") return;
    const timer = window.setInterval(() => {
      register(credential).then((state) => {
        setAccess(state);
        if (state.status === "approved") void refresh(credential, state, { discoverNew: true });
      }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.status, credential]);

  useEffect(() => {
    if (!credential || access?.status !== "approved") return;
    const timer = window.setInterval(() => void refresh(credential, access, { discoverNew: false, quiet: true }), 60_000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access?.deviceId, credential]);

  async function dashboardAction(body: Record<string, unknown>, success: string) {
    if (!credential || !access) return false;
    setNotice("");
    try {
      if (body.action === "manage-learning-device") {
        if (!dashboard?.boiBridge) throw new ApiError("Chưa có vé kết nối Site Bơi ếch.", {} as ApiData);
        const data = await boiApi(dashboard.boiBridge, "/api/control/overview", { method: "POST", body: {
          action: body.operation,
          deviceId: body.targetDeviceId,
          learnerName: body.learnerName,
          learnerFamilyName: body.learnerFamilyName,
          learnerGivenName: body.learnerGivenName,
          label: body.label,
          accessExpiresAt: body.accessExpiresAt,
          note: body.note,
          enabled: body.enabled,
          defaultAccessDays: body.defaultAccessDays,
          defaultDeviceLimit: body.defaultDeviceLimit,
          confirmDeviceCode: body.confirmDeviceCode,
          deleteReason: body.deleteReason,
        } });
        if (data.deletedDeviceId) {
          const devices = dashboard.learningDevices.filter((device) => device.deviceId !== data.deletedDeviceId);
          commitDashboard({ ...dashboard, learningDevices: devices });
          setSelected(null);
        } else if (data.devices) {
          const devices = mergeLearningDevices(dashboard.learningDevices, data.devices, false);
          const next = { ...dashboard, learningDevices: devices };
          commitDashboard(next);
          setSelected((current) => current ? devices.find((item) => item.deviceId === current.deviceId) ?? current : null);
        }
        if (data.deletedDevices) {
          const currentDashboard = dashboardRef.current ?? dashboard;
          commitDashboard({ ...currentDashboard, deletedDevices: data.deletedDevices });
        }
        if (data.automation) commitDashboard({ ...(dashboardRef.current ?? dashboard), automation: data.automation });
      } else {
        const data = await secureApi("/api/dashboard", credential, access, body);
        if (data.controlDevices && dashboard) commitDashboard({ ...dashboard, controlDevices: data.controlDevices });
      }
      setNotice(success);
      return true;
    } catch (caught) { setNotice(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác."); return false; }
  }

  async function locateManualCode() {
    const normalized = manualCode.trim().toUpperCase();
    setNotice("");
    if (normalized.startsWith("QT-")) {
      setTab("approvals");
      setNotice("Đây là mã quản trị QT. Đã chuyển tới mục Quyền quản trị.");
      return;
    }
    if (!/^BE-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(normalized)) {
      setNotice("Mã chưa đúng định dạng. Thiết bị học dùng mã BE-…, thiết bị quản trị dùng mã QT-…");
      return;
    }
    let found = dashboard?.learningDevices.find((item) => item.deviceCode === normalized);
    if (!found && dashboard?.boiBridge) {
      try {
        const result = await boiApi(dashboard.boiBridge, "/api/control/overview", { query: `?deviceCode=${encodeURIComponent(normalized)}&activityDays=30` });
        found = result.devices?.[0];
        if (found) commitDashboard({ ...dashboard, learningDevices: [...dashboard.learningDevices, found] });
      } catch (caught) {
        setNotice(caught instanceof Error ? caught.message : "Không thể tra cứu mã thiết bị.");
        return;
      }
    }
    if (!found) {
      setFilter("all");
      setSearch(normalized);
      setNotice(boiOnline ? "Mã chưa có trong dữ liệu Bơi ếch. Hãy kiểm tra lại mã rồi bấm Cập nhật." : "Chưa thể kiểm tra mã vì kết nối Bơi ếch đang gián đoạn.");
      return;
    }
    setFilter("all");
    setSearch(normalized);
    void openDetail(found);
    setNotice(`Đã tìm thấy ${normalized}.`);
  }

  async function openDetail(device: LearningDevice) {
    const requestNumber = ++detailRequest.current;
    setSelected(device);
    setSelectedActivityLoading(false);
    if (device.activityTimeline.length >= 30 || !dashboard?.boiBridge || !online) return;
    setSelectedActivityLoading(true);
    try {
      const result = await boiApi(dashboard.boiBridge, "/api/control/overview", { query: `?deviceCode=${encodeURIComponent(device.deviceCode)}&activityDays=30` });
      if (requestNumber !== detailRequest.current) return;
      const detailed = result.devices?.[0];
      if (!detailed) return;
      const currentDashboard = dashboardRef.current ?? dashboard;
      const devices = mergeLearningDevices(currentDashboard.learningDevices, [detailed], false);
      commitDashboard({ ...currentDashboard, learningDevices: devices });
      setSelected(detailed);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Chưa thể tải biểu đồ của thiết bị.");
    } finally {
      if (requestNumber === detailRequest.current) setSelectedActivityLoading(false);
    }
  }

  function closeDetail() {
    detailRequest.current += 1;
    setSelectedActivityLoading(false);
    setSelected(null);
  }

  const visibleDevices = useMemo(() => {
    const source = dashboard?.learningDevices ?? [];
    return source.filter((device) => {
      const matchesFilter = filter === "all"
        || (filter === "active" ? device.active
          : filter === "incomplete" ? !device.registrationComplete
          : filter === "payment" ? device.paymentStatus === "proof_submitted"
          : filter === "expired" ? device.accessExpired
            : filter === "paid" || filter === "free" ? device.accessGroup === filter
              : device.status === filter);
      const haystack = `${device.learnerName ?? ""} ${device.personCode ?? ""} ${device.className ?? ""} ${device.phone ?? ""} ${device.label ?? ""} ${device.deviceCode}`.toLowerCase();
      return matchesFilter && haystack.includes(search.trim().toLowerCase());
    });
  }, [dashboard?.learningDevices, filter, search]);

  if (!access || access.status !== "approved") return <DeviceGate access={access} checking={checking} error={error} retry={() => void initialize()} />;

  const counts = {
    total: dashboard?.learningDevices.length ?? 0,
    active: dashboard?.learningDevices.filter((item) => item.active).length ?? 0,
    pending: dashboard?.learningDevices.filter((item) => item.status === "pending").length ?? 0,
    paid: dashboard?.learningDevices.filter((item) => item.accessGroup === "paid").length ?? 0,
    free: dashboard?.learningDevices.filter((item) => item.accessGroup === "free").length ?? 0,
    blocked: dashboard?.learningDevices.filter((item) => item.status === "blocked").length ?? 0,
    expired: dashboard?.learningDevices.filter((item) => item.accessExpired).length ?? 0,
    expiring: dashboard?.learningDevices.filter((item) => item.accessExpiringSoon).length ?? 0,
    paymentReview: dashboard?.learningDevices.filter((item) => item.paymentStatus === "proof_submitted").length ?? 0,
    personalEdit: dashboard?.learningDevices.filter((item) => item.personalEditConfigured).length ?? 0,
    incomplete: dashboard?.learningDevices.filter((item) => !item.registrationComplete).length ?? 0,
    deleted: dashboard?.deletedDevices?.length ?? 0,
  };
  const activeTheme = adminThemes.find((item) => item.id === appearance.theme) ?? adminThemes[0];
  const activeFont = adminFonts.find((item) => item.id === appearance.font) ?? adminFonts[0];

  return (
    <main
      className="control-shell"
      data-text-size={appearance.textSize}
      style={{
        "--paper": activeTheme.paper,
        "--panel": activeTheme.panel,
        "--ink": activeTheme.ink,
        "--muted": activeTheme.muted,
        "--admin-ui-font": activeFont.ui,
        "--admin-heading-font": activeFont.heading,
      } as React.CSSProperties}
    >
      <aside className="control-sidebar">
        <div className="control-brand"><div className="brand-seal">QT</div><div><span>Hệ thống trung tâm</span><strong>Quản trị học tập</strong></div></div>
        <nav>
          <button className={tab === "devices" ? "active" : ""} onClick={() => setTab("devices")}><i>⌘</i>Thiết bị và tiến độ</button>
          <button className={tab === "ai" ? "active" : ""} onClick={() => setTab("ai")}><i>✦</i>Điều hành AI</button>
          {["reviewer", "publisher", "owner"].includes(access.role) ? <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}><i>⌁</i>Duyệt chỉnh sửa</button> : null}
          {access.role === "owner" ? <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}><i>✓</i>Quyền quản trị</button> : null}
          {["publisher", "owner"].includes(access.role) ? <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><i>≡</i>Nhật ký hệ thống</button> : null}
        </nav>
        <div className="application-list"><span>Ứng dụng</span>{dashboard?.applications.map((app) => <div key={app.id}><i className={app.status} /><strong>{app.name}</strong><small>{app.status === "online" ? "Đã kết nối trực tiếp" : app.status === "planned" ? "Đang chuẩn bị" : "Mất đồng bộ — dữ liệu cũ vẫn giữ"}</small></div>)}</div>
        <div className="signed-user"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabels[access.role]}</small></div><a href="/signout-with-chatgpt?return_to=/">Đăng xuất</a></div>
      </aside>

      <section className="control-main">
        <header className="topbar"><div><span>Trung tâm điều hành</span><h1>{tab === "devices" ? "Thiết bị học tập" : tab === "ai" ? "Điều hành AI" : tab === "content" ? "Duyệt chỉnh sửa" : tab === "approvals" ? "Quyền quản trị" : "Nhật ký hệ thống"}</h1></div><div className="topbar-actions"><span className={`sync-state ${boiOnline && online ? "" : "sync-warning"}`}><i /> {!online ? "Máy quản trị đang offline" : boiOnline ? "Trạng thái tự động · 60 giây/lần" : "Đang giữ dữ liệu gần nhất"}</span><button className="button appearance-control" onClick={() => setAppearanceOpen(true)} aria-expanded={appearanceOpen} aria-controls="admin-appearance-panel"><b>Aa</b> Giao diện</button><button className="button" onClick={() => void refresh(credential, access, { discoverNew: true })} disabled={checking || !online}>{checking ? "Đang cập nhật…" : "Cập nhật thiết bị"}</button></div></header>
        {appearanceOpen ? <><button className="admin-appearance-scrim" aria-label="Đóng bảng Giao diện" onClick={() => setAppearanceOpen(false)} /><aside id="admin-appearance-panel" className="admin-appearance-panel" role="dialog" aria-modal="true" aria-labelledby="admin-appearance-title"><header><div><span>Tùy chỉnh hiển thị</span><h2 id="admin-appearance-title">Giao diện quản trị</h2></div><button onClick={() => setAppearanceOpen(false)} aria-label="Đóng">×</button></header><section><label>Màu nền</label><p>Chỉ lưu trên máy quản trị hiện tại.</p><div className="admin-theme-options">{adminThemes.map((item) => <button key={item.id} className={appearance.theme === item.id ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, theme: item.id }))}><i style={{ background: item.paper }} /><span>{item.name}</span></button>)}</div></section><section><label>Font tiếng Việt</label><div className="admin-font-options">{adminFonts.map((item) => <button key={item.id} className={appearance.font === item.id ? "active" : ""} style={{ fontFamily: item.ui }} onClick={() => setAppearance((current) => ({ ...current, font: item.id }))}><strong>{item.name}</strong><span>{item.sample}</span></button>)}</div></section><section><label>Cỡ giao diện</label><div className="admin-size-options">{([{ id: "normal", label: "Tiêu chuẩn" }, { id: "large", label: "Lớn" }, { id: "xlarge", label: "Rất lớn" }] as const).map((item) => <button key={item.id} className={appearance.textSize === item.id ? "active" : ""} onClick={() => setAppearance((current) => ({ ...current, textSize: item.id }))}>{item.label}</button>)}</div></section><footer><button onClick={() => setAppearance(defaultAdminAppearance)}>Khôi phục mặc định</button><span>Tự lưu trên thiết bị</span></footer></aside></> : null}
        {error || dashboard?.upstreamError ? <div className="alert warning">{error || dashboard?.upstreamError}</div> : null}
        {notice ? <div className="notice" role="status">{notice}</div> : null}

        {tab === "devices" ? <>
          <section className="summary-grid"><article><span>Tổng thiết bị</span><strong>{counts.total}</strong><small>Bơi ếch</small></article><article><span>Online</span><strong>{counts.active}</strong><small>Tín hiệu ký số mỗi 60 giây</small></article><article><span>Chờ xử lý</span><strong>{counts.pending}</strong><small>Hồ sơ hoặc thanh toán</small></article><article><span>Nhóm trả phí</span><strong>{counts.paid}</strong><small>Tài khoản 50.000đ</small></article><article><span>Nhóm miễn phí</span><strong>{counts.free}</strong><small>Đã sàng lọc</small></article><article><span>Sửa bản riêng</span><strong>{counts.personalEdit}</strong><small>Không cập nhật máy chủ</small></article><article><span>Sắp/đã hết hạn</span><strong>{counts.expiring + counts.expired}</strong><small>{counts.expired} đã hết hạn</small></article><article><span>Đã khóa</span><strong>{counts.blocked}</strong><small>Không thể truy cập</small></article><article><span>Đã loại bỏ</span><strong>{counts.deleted}</strong><small>Không thể tự đăng ký lại</small></article></section>
          <section className="operations-inbox"><div><span>Hộp việc cần xử lý</span><strong>Ưu tiên những tài khoản đang chờ quyết định</strong></div><button onClick={() => setFilter("incomplete")}><span>Hồ sơ chưa đủ</span><strong>{counts.incomplete}</strong></button><button onClick={() => setFilter("payment")}><span>Ảnh chuyển khoản</span><strong>{counts.paymentReview}</strong></button><button onClick={() => setFilter("expired")}><span>Tài khoản hết hạn</span><strong>{counts.expired}</strong></button>{["reviewer", "publisher", "owner"].includes(access.role) ? <button onClick={() => setTab("content")}><span>Duyệt nội dung</span><strong>→</strong></button> : null}</section>
          <section className="manual-device-card"><div><span>Nhập mã dự phòng</span><strong>Thiết bị mới được quét khi bấm “Cập nhật thiết bị”; danh sách đang có luôn được giữ cố định.</strong><small><b>BE-…</b> là thiết bị học Bơi ếch · <b>QT-…</b> là thiết bị vào Trung tâm quản trị.</small></div><label><input value={manualCode} onChange={(event) => setManualCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") void locateManualCode(); }} placeholder="BE-1234-5678-9ABC-DEF0" aria-label="Mã thiết bị cần tìm" /><button className="button primary" onClick={() => void locateManualCode()}>Tìm thiết bị</button></label></section>
          <section className="device-toolbar"><div className="filter-pills">{(["all", "active", "pending", "incomplete", "paid", "free", "expired", "blocked"] as const).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Tất cả" : item === "active" ? "Đang hoạt động" : item === "pending" ? "Chờ xử lý" : item === "incomplete" ? "Chưa nhập thông tin" : item === "paid" ? "Trả phí" : item === "free" ? "Miễn phí" : item === "expired" ? "Hết hạn" : "Đã khóa"}</button>)}</div><div className="report-actions"><button className="button" onClick={exportDevices}>Xuất CSV</button><label><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã số, lớp, SĐT hoặc thiết bị" /></label></div></section>
          <section className="laptop-grid">
            {visibleDevices.map((device) => <button key={device.deviceId} className={`account-card ${device.active ? "active" : "idle"} ${device.status} ${device.accessExpired ? "expired" : device.accessExpiringSoon ? "expiring" : ""}`} onClick={() => void openDetail(device)}><Laptop active={device.active} status={device.status} /><div className="account-copy"><span>{device.status === "pending" ? "Hồ sơ mới chờ duyệt" : device.learnerName || device.label || "Chưa gửi hồ sơ"}</span><strong className={device.status === "pending" ? "learner-identity" : undefined}>{device.status === "pending" ? pendingLearnerLabel(device) : device.deviceCode}</strong><small>{device.personRole === "teacher" ? "Giảng viên" : device.personRole === "learner" ? "Học viên" : "Chưa chọn vai trò"}{device.status !== "pending" && device.personCode ? ` · ${device.personCode}` : ""}</small><small>{device.className ? `${device.className} · ` : ""}{device.accessExpired ? "Đã hết hạn" : device.accessExpiringSoon ? `Sắp hết hạn · ${formatDate(device.accessExpiresAt)}` : device.active ? "Online" : `Offline từ ${formatDate(device.offlineSinceAt)}`}</small>{!device.registrationComplete ? <em className="profile-warning">Chưa nhập đủ thông tin</em> : device.personalEditConfigured ? <em>Bản sửa riêng</em> : null}</div><span className={`group-chip ${device.accessGroup}`}>{paymentStatusLabels[device.paymentStatus]}</span><div className="account-progress"><span><i style={{ width: `${device.completionPercent}%` }} /></span><strong>{device.completionPercent}%</strong></div></button>)}
            {visibleDevices.length === 0 ? <div className="empty-state"><Laptop active={false} status="pending" /><h3>Chưa có thiết bị phù hợp</h3><p>Thay đổi bộ lọc hoặc chờ người học gửi yêu cầu mới.</p></div> : null}
          </section>
          {access.role === "owner" ? <DeletedDevicesPanel devices={dashboard?.deletedDevices ?? []} restore={(device, confirmation) => dashboardAction({ action: "manage-learning-device", operation: "restore-deleted-device", targetDeviceId: device.deviceId, confirmDeviceCode: confirmation }, `Đã cho phép ${device.deviceCode} đăng ký lại. Thiết bị sẽ xuất hiện như hồ sơ mới khi mở Site Bơi ếch.`)} /> : null}
        </> : null}

        {tab === "ai" && dashboard?.boiBridge ? <AiControlCenter role={access.role} api={(init) => boiApi<AiControlData>(dashboard.boiBridge, "/api/control/ai", init)} onNotice={setNotice} /> : null}

        {tab === "content" && dashboard?.boiBridge ? <ContentReviewCenter bridge={dashboard.boiBridge} access={access} automation={dashboard.automation} saveAutomation={(enabled, defaultAccessDays, defaultDeviceLimit) => void dashboardAction({ action: "manage-learning-device", operation: "update-automation", enabled, defaultAccessDays, defaultDeviceLimit }, `Đã ${enabled ? "bật" : "tắt"} tự động duyệt; mặc định ${defaultAccessDays} ngày cho tối đa ${defaultDeviceLimit} thiết bị.`)} /> : null}

        {tab === "approvals" ? <section className="approval-layout"><div className="approval-heading"><span>Kiểm soát truy cập theo vai trò</span><h2>Quyền rõ ràng, giới hạn ngay tại máy chủ</h2><p>Người sửa bài không cần vào đây. Họ chỉ biên tập trực quan đúng bài được cấp phép tại Site Bơi ếch; các vai trò dưới đây dùng để kiểm tra và phê duyệt.</p><small className="account-removal-note"><b>Thu hồi</b> giữ hồ sơ để có thể cấp lại. <b>Xóa tài khoản</b> chỉ hiện sau khi đã thu hồi và sẽ dọn toàn bộ thiết bị quản trị dùng chung email.</small></div><div className="role-matrix">{roleCapabilities.map((item) => <article key={item.role} className={access.role === item.role ? "current" : ""}><span>{item.title}</span><ul>{item.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul></article>)}</div><div className="approval-list">{(dashboard?.controlDevices ?? []).map((device) => <article key={device.deviceId}><Laptop active={device.active} status={device.status} /><div><span>{device.displayName}</span><strong>{device.email}</strong><small>{device.deviceCode} · {roleLabels[device.role]} · {device.active ? "Online" : `Offline từ ${formatDate(device.offlineSinceAt)}`}</small><small>{device.memberStatus === "inactive" ? "Tài khoản đã bị thu hồi" : statusLabels[device.status]}</small></div>{access.role === "owner" && !device.owner ? <div className="approval-actions"><button disabled={device.status === "approved" && device.role === "reviewer" && device.memberStatus === "active"} onClick={() => void dashboardAction({ action: "manage-control-device", operation: "approve", targetDeviceId: device.deviceId, role: "reviewer", displayName: device.displayName }, "Đã cấp quyền kiểm duyệt viên.")}>Kiểm duyệt</button><button disabled={device.status === "approved" && device.role === "publisher" && device.memberStatus === "active"} onClick={() => void dashboardAction({ action: "manage-control-device", operation: "approve", targetDeviceId: device.deviceId, role: "publisher", displayName: device.displayName }, "Đã cấp quyền xuất bản.")}>Xuất bản</button></div> : null}{access.role === "owner" && device.status !== "blocked" && !device.owner ? <button className="icon-danger" onClick={() => void dashboardAction({ action: "manage-control-device", operation: "block", targetDeviceId: device.deviceId }, "Đã khóa riêng thiết bị này.")}>Khóa máy</button> : null}{access.role === "owner" && device.memberStatus === "active" && !device.owner ? <button className="icon-danger revoke" onClick={() => { if (window.confirm(`Thu hồi toàn bộ quyền quản trị của ${device.email}?`)) void dashboardAction({ action: "manage-control-device", operation: "deactivate-member", targetDeviceId: device.deviceId }, "Đã thu hồi tài khoản và khóa mọi thiết bị quản trị liên quan."); }}>Thu hồi tài khoản</button> : null}{access.role === "owner" && device.memberStatus === "inactive" && !device.owner ? <button className="icon-danger delete-account" onClick={() => { const confirmation = window.prompt(`Xóa vĩnh viễn tài khoản ${device.email} và toàn bộ thiết bị quản trị cùng email.\n\nNhập chính xác email để xác nhận:`); if (confirmation?.trim().toLowerCase() === device.email.toLowerCase()) void dashboardAction({ action: "manage-control-device", operation: "delete-member", targetDeviceId: device.deviceId }, "Đã xóa tài khoản và toàn bộ thiết bị quản trị cùng email."); else if (confirmation !== null) setNotice("Email xác nhận không khớp; chưa xóa dữ liệu."); }}>Xóa tài khoản</button> : null}</article>)}</div></section> : null}

        {tab === "audit" ? <section className="audit-layout"><div className="approval-heading"><span>Dấu vết kiểm soát</span><h2>Mọi thay đổi quan trọng đều có người thực hiện và thời điểm</h2><p>Nhật ký được lấy từ cả trung tâm quản trị và ứng dụng Bơi ếch, mới nhất ở trên.</p><button className="button" onClick={exportAudit}>Xuất nhật ký JSON</button></div><div className="audit-list">{(dashboard?.auditLog ?? []).map((entry) => <article key={entry.id}><div className="audit-mark">{entry.source === "Bơi ếch" ? "BE" : "QT"}</div><div><span>{actionLabels[entry.action] ?? entry.action}</span><strong>{entry.actor}</strong><small>{entry.source} · {formatDate(entry.createdAt)} · {entry.target}</small></div></article>)}{(dashboard?.auditLog ?? []).length === 0 ? <div className="empty-state"><h3>Chưa có thay đổi quản trị</h3><p>Các thao tác cấp quyền, biên tập, phê duyệt và khôi phục sẽ xuất hiện tại đây.</p></div> : null}</div></section> : null}
      </section>

      {installPrompt ? <button className="install-fab" onClick={() => void installWebApp()} aria-label="Cài ứng dụng Quản trị học tập" title="Cài ứng dụng"><span aria-hidden="true">⇩</span><b>Cài ứng dụng</b></button> : null}
      {selected && dashboard?.boiBridge ? <DeviceDrawer key={selected.deviceId} device={selected} bridge={dashboard.boiBridge} canManage={["publisher", "owner"].includes(access.role)} canDelete={access.role === "owner"} activityLoading={selectedActivityLoading} close={closeDetail} action={(operation, success, extra = {}) => dashboardAction({ action: "manage-learning-device", operation, targetDeviceId: selected.deviceId, ...extra }, success)} /> : null}
    </main>
  );
}
