"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type EditorDevice = { deviceId: string; deviceCode: string; email: string; displayName: string };
type VersionStatus = "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
type ContentVersion = {
  id: string;
  version_number: number;
  status: VersionStatus;
  summary: string | null;
  created_by: string;
  editor_device_code: string | null;
  edit_scope: string | null;
  edit_lesson: string | null;
  edit_section: EditSection | "lesson" | null;
  edit_scope_label: string | null;
  permission_note: string | null;
  permission_reviewed_by: string | null;
  permission_reviewed_at: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
type ApiData = {
  device?: EditorDevice;
  challenge?: string;
  versions?: ContentVersion[];
  activeContent?: unknown;
  activeScope?: EditScopeInfo;
  versionId?: string;
  validationErrors?: string[];
  aiReview?: AiDraftReview;
  error?: string;
};

type AiDraftSuggestion = {
  id: string;
  path: (string | number)[] | null;
  before: string | null;
  after: string | null;
  reason: string;
  severity: "improve" | "warning";
};
type AiDraftReview = {
  interactionId: string;
  engineVersion: string;
  promptVersion: string;
  scope: string;
  suggestions: AiDraftSuggestion[];
};

type EditSection = "content" | "practice" | "analysis" | "review" | "quiz";
type EditScopeInfo = {
  lessonNumber: string;
  section: EditSection | "lesson";
  sectionLabel: string;
  label: string;
  value: string;
};

const editSectionOptions: { id: EditSection; label: string; eyebrow: string; description: string }[] = [
  { id: "content", label: "Nội dung", eyebrow: "Phần 1/5", description: "Tiêu đề, mục tiêu, kiến thức, an toàn và ghi nhớ." },
  { id: "practice", label: "Thực hành", eyebrow: "Phần 2/5", description: "Bài tập, khối lượng và kế hoạch buổi tập." },
  { id: "analysis", label: "Phân tích", eyebrow: "Phần 3/5", description: "Các điểm quan sát, khẩu lệnh và lỗi cần chặn." },
  { id: "review", label: "Ôn tập", eyebrow: "Phần 4/5", description: "Lỗi thường gặp, nguyên nhân và cách sửa." },
  { id: "quiz", label: "Kiểm tra", eyebrow: "Phần 5/5", description: "Mười câu hỏi, phương án, đáp án và giải thích." },
];

function scopeInfo(version: ContentVersion | null, fallbackLesson = "01", fallbackSection: EditSection = "content"): EditScopeInfo {
  if (version?.edit_scope_label && version.edit_lesson && version.edit_section) {
    return {
      lessonNumber: version.edit_lesson,
      section: version.edit_section,
      sectionLabel: version.edit_section === "lesson" ? "Toàn bài · yêu cầu cũ" : editSectionOptions.find((item) => item.id === version.edit_section)?.label ?? version.edit_section,
      label: version.edit_scope_label,
      value: version.edit_scope ?? version.edit_lesson,
    };
  }
  const [lessonValue, sectionValue] = (version?.edit_scope ?? fallbackLesson).split(":");
  const section = editSectionOptions.some((item) => item.id === sectionValue) ? sectionValue as EditSection : version ? "lesson" : fallbackSection;
  const sectionLabel = section === "lesson" ? "Toàn bài · yêu cầu cũ" : editSectionOptions.find((item) => item.id === section)?.label ?? "Nội dung";
  return { lessonNumber: lessonValue || fallbackLesson, section, sectionLabel, label: `Bài ${lessonValue || fallbackLesson} · ${sectionLabel}`, value: version?.edit_scope ?? `${fallbackLesson}:${fallbackSection}` };
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
    const request = indexedDB.open("boi-ech-content-editor", 1);
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

async function credentialForEditor() {
  const current = await readCredential();
  if (current?.version === 1 && current.privateKey && current.publicKey) return current;
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential;
  await writeCredential(credential);
  return credential;
}

async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as ApiData;
  if (!response.ok) throw new ApiError(data.validationErrors?.join("\n") || data.error || "Không thể xử lý yêu cầu.", data);
  return data;
}

async function proof(credential: Credential, device: EditorDevice) {
  const challenge = await api("/api/editor/device", { action: "challenge", deviceId: device.deviceId });
  if (!challenge.challenge || !credential.privateKey) throw new ApiError("Không thể xác thực laptop biên tập.", challenge);
  const message = new TextEncoder().encode(`boi-ech-editor:${device.deviceId}:${challenge.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: device.deviceId, challenge: challenge.challenge, signature: base64Url(new Uint8Array(signature)) };
}

async function secureApi(credential: Credential, device: EditorDevice, body: Record<string, unknown>) {
  return api("/api/editor/content", { ...body, ...await proof(credential, device) });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—";
}

const statusLabel: Record<VersionStatus, string> = {
  permission_requested: "Đang xin quyền",
  draft: "Được phép chỉnh sửa",
  review: "Đã gửi Trung tâm kiểm tra",
  published: "Đã cập nhật máy chủ",
  changes_requested: "Trung tâm yêu cầu sửa lại",
  denied: "Không được cấp quyền",
  cancelled: "Đã hủy",
  archived: "Phiên bản cũ",
};

type EditableLesson = Record<string, unknown>;
type FieldPath = (string | number)[];

const fieldLabels: Record<string, string> = {
  outline: "Thông tin hiển thị của bài",
  content: "Nội dung chi tiết",
  title: "Tiêu đề",
  meta: "Thông tin ngắn",
  status: "Nhãn trạng thái",
  group: "Nhóm bài học",
  summary: "Giới thiệu bài",
  duration: "Thời lượng",
  target: "Mục tiêu đạt",
  objectives: "Mục tiêu học tập",
  core: "Nội dung cốt lõi",
  practice: "Bài tập thực hành",
  pass: "Tiêu chí đạt",
  bridge: "Kết nối lộ trình",
  safety: "An toàn bắt buộc",
  knowledge: "Phần học",
  analysis: "Điểm phân tích kỹ thuật",
  drills: "Bài tập",
  mistakes: "Phân tích lỗi",
  session: "Kế hoạch buổi tập",
  sessionPlan: "Kế hoạch buổi tập",
  questions: "Bài kiểm tra 10 câu",
  memory: "Ghi nhớ cuối bài",
  practiceEyebrow: "Nhãn phần thực hành",
  practiceTitle: "Tiêu đề phần thực hành",
  practiceText: "Giới thiệu phần thực hành",
  sessionEyebrow: "Nhãn kế hoạch buổi tập",
  sessionTitle: "Tiêu đề kế hoạch buổi tập",
  sessionText: "Giới thiệu kế hoạch buổi tập",
  body: "Nội dung",
  steps: "Các bước thực hiện",
  cue: "Khẩu lệnh ghi nhớ",
  avoid: "Điều cần tránh",
  code: "Mã bài tập",
  goal: "Mục tiêu",
  volume: "Khối lượng",
  sign: "Dấu hiệu nhận biết",
  cause: "Nguyên nhân",
  fix: "Cách sửa",
  time: "Thời gian",
  phases: "Các pha kỹ thuật",
  analysisPhases: "Các pha dùng trong phần phân tích",
  short: "Tên ngắn",
  action: "Cách thực hiện",
  purpose: "Mục đích",
  name: "Tên",
  drill: "Bài tập sửa lỗi",
  q: "Nội dung câu hỏi",
  options: "Bốn phương án",
  answer: "Đáp án đúng",
  explain: "Giải thích đáp án",
};

const multilineFields = new Set([
  "summary", "target", "body", "bridge", "action", "purpose", "cue", "avoid",
  "goal", "safety", "sign", "cause", "fix", "drill", "q", "explain", "memory",
  "practiceText", "sessionText",
]);

function isEditableLesson(value: unknown): value is EditableLesson {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyLesson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function replaceAtPath(root: EditableLesson, path: FieldPath, value: unknown) {
  const next = copyLesson(root);
  let cursor: Record<string | number, unknown> | unknown[] = next;
  path.slice(0, -1).forEach((segment) => {
    cursor = (cursor as Record<string | number, Record<string | number, unknown> | unknown[]>)[segment];
  });
  (cursor as Record<string | number, unknown>)[path.at(-1)!] = value;
  return next;
}

function labelFor(key: string) {
  return fieldLabels[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

function itemHeading(value: unknown, index: number, parentKey: string) {
  if (parentKey === "questions") return `Câu ${index + 1}`;
  if (isEditableLesson(value)) {
    const title = value.title ?? value.name ?? value.short ?? value.code ?? value.number;
    if (typeof title === "string" && title.trim()) return `${String(index + 1).padStart(2, "0")} · ${title}`;
  }
  return `Mục ${index + 1}`;
}

function VisualField({
  fieldKey,
  value,
  path,
  onChange,
  depth = 0,
}: {
  fieldKey: string;
  value: unknown;
  path: FieldPath;
  onChange: (path: FieldPath, value: unknown) => void;
  depth?: number;
}) {
  const label = labelFor(fieldKey);
  if (Array.isArray(value)) {
    return (
      <section className={`visual-group visual-depth-${Math.min(depth, 2)}`}>
        <header><span>{label}</span><small>{value.length} mục · giữ cố định cấu trúc</small></header>
        <div className="visual-list">
          {value.map((item, index) => (
            <article className="visual-item" key={`${fieldKey}-${index}`}>
              <h4>{itemHeading(item, index, fieldKey)}</h4>
              {isEditableLesson(item)
                ? Object.entries(item).map(([childKey, childValue]) => (
                    <VisualField key={childKey} fieldKey={childKey} value={childValue} path={[...path, index, childKey]} onChange={onChange} depth={depth + 1} />
                  ))
                : <label className="visual-field"><span>{`Mục ${index + 1}`}</span><textarea value={String(item ?? "")} onChange={(event) => onChange([...path, index], event.target.value)} /></label>}
            </article>
          ))}
        </div>
      </section>
    );
  }
  if (isEditableLesson(value)) {
    return (
      <section className={`visual-group visual-depth-${Math.min(depth, 2)}`}>
        <header><span>{label}</span></header>
        <div className="visual-object">
          {Object.entries(value).map(([childKey, childValue]) => (
            <VisualField key={childKey} fieldKey={childKey} value={childValue} path={[...path, childKey]} onChange={onChange} depth={depth + 1} />
          ))}
        </div>
      </section>
    );
  }
  if (fieldKey === "answer" && typeof value === "number") {
    return (
      <label className="visual-field compact"><span>{label}</span><select value={value} onChange={(event) => onChange(path, Number(event.target.value))}>{[0, 1, 2, 3].map((index) => <option key={index} value={index}>{String.fromCharCode(65 + index)}</option>)}</select></label>
    );
  }
  const readonly = fieldKey === "id" || fieldKey === "n" || fieldKey === "number";
  const text = String(value ?? "");
  return (
    <label className={`visual-field ${readonly ? "readonly" : ""}`}>
      <span>{readonly ? `${label} · cố định` : label}</span>
      {multilineFields.has(fieldKey) || text.length > 90
        ? <textarea value={text} readOnly={readonly} onChange={(event) => onChange(path, event.target.value)} />
        : <input value={text} readOnly={readonly} onChange={(event) => onChange(path, event.target.value)} />}
    </label>
  );
}

function VisualSectionEditor({ content, scope, onChange }: { content: EditableLesson; scope: EditScopeInfo; onChange: (next: EditableLesson) => void }) {
  return (
    <div className="visual-editor" aria-label={`Biên tập trực quan ${scope.label}`}>
      <div className="visual-editor-banner"><div><span>Đang chỉnh đúng phạm vi</span><strong>{scope.label}</strong></div><p>Chỉ dữ liệu thuộc phần này được mở. Số bài, mã nội bộ và cấu trúc 10 câu được khóa để bảo vệ hệ thống.</p></div>
      {Object.entries(content).map(([fieldKey, value]) => (
        <VisualField key={fieldKey} fieldKey={fieldKey} value={value} path={[fieldKey]} onChange={(path, value) => onChange(replaceAtPath(content, path, value))} />
      ))}
    </div>
  );
}

export default function EditorWorkspace({ user, initialLesson }: { user: { displayName: string; email: string }; initialLesson: string }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [device, setDevice] = useState<EditorDevice | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [activeContent, setActiveContent] = useState<EditableLesson | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editLesson, setEditLesson] = useState(initialLesson);
  const [editSection, setEditSection] = useState<EditSection>("content");
  const [summary, setSummary] = useState("");
  const [notice, setNotice] = useState("");
  const [aiReview, setAiReview] = useState<AiDraftReview | null>(null);
  const [busy, setBusy] = useState(true);
  const activeContentRef = useRef<EditableLesson | null>(null);
  const dirtyRef = useRef(false);

  const openRequest = useMemo(() => versions.find((item) => ["permission_requested", "draft", "changes_requested", "review"].includes(item.status)) ?? null, [versions]);
  const activeScope = useMemo(() => scopeInfo(openRequest, editLesson, editSection), [openRequest, editLesson, editSection]);

  function updateContent(next: EditableLesson | null, changed = false) {
    activeContentRef.current = next;
    dirtyRef.current = changed;
    setActiveContent(next);
    setDirty(changed);
  }

  function acceptData(data: ApiData, preserveLocalDraft = false) {
    if (data.versions) setVersions(data.versions);
    if (data.activeScope) {
      setEditLesson(data.activeScope.lessonNumber);
      if (data.activeScope.section !== "lesson") setEditSection(data.activeScope.section);
    }
    const hasEditableRequest = data.versions?.some((item) => ["draft", "changes_requested"].includes(item.status));
    if (data.versions && !hasEditableRequest) updateContent(null);
    if (isEditableLesson(data.activeContent) && (!preserveLocalDraft || !dirtyRef.current || !activeContentRef.current)) {
      updateContent(copyLesson(data.activeContent));
    }
  }

  async function refresh(currentCredential = credential, currentDevice = device, quiet = false) {
    if (!currentCredential || !currentDevice) return;
    if (!quiet) setBusy(true);
    try {
      const data = await secureApi(currentCredential, currentDevice, { action: "bootstrap" });
      acceptData(data, quiet);
      if (!quiet) setNotice("");
    } catch (error) { if (!quiet) setNotice(error instanceof Error ? error.message : "Không thể tải trạng thái chỉnh sửa."); }
    finally { if (!quiet) setBusy(false); }
  }

  async function initialize() {
    setBusy(true);
    try {
      const key = await credentialForEditor();
      const registered = await api("/api/editor/device", { action: "register", publicKey: key.publicKey });
      if (!registered.device) throw new ApiError("Máy chủ chưa trả về laptop biên tập.", registered);
      setCredential(key);
      setDevice(registered.device);
      await refresh(key, registered.device);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể khởi tạo vùng chỉnh sửa."); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void initialize(), 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!credential || !device) return;
    const timer = window.setInterval(() => void refresh(credential, device, true), 30_000);
    return () => window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credential, device?.deviceId]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function run(body: Record<string, unknown>, success: string) {
    if (!credential || !device) return null;
    setBusy(true);
    setNotice("");
    try {
      const data = await secureApi(credential, device, body);
      acceptData(data);
      setNotice(success);
      return data;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể cập nhật yêu cầu.");
      return null;
    } finally { setBusy(false); }
  }

  async function requestEdit() {
    const data = await run({ action: "request-edit", editLesson, editSection, summary }, "Đã gửi yêu cầu xin chỉnh sửa về Trung tâm quản trị.");
    if (data) setSummary("");
  }

  async function requestAiReview() {
    if (!openRequest || !activeContent) return;
    const data = await run({ action: "ai-suggest", versionId: openRequest.id, sectionContent: activeContent }, "AI đã kiểm tra bản đang mở; chưa có thay đổi nào được tự động áp dụng.");
    if (data?.aiReview) setAiReview(data.aiReview);
  }

  function applyAiSuggestion(suggestion: AiDraftSuggestion) {
    if (!activeContent || !suggestion.path || suggestion.after === null) return;
    updateContent(replaceAtPath(activeContent, suggestion.path, suggestion.after), true);
    setAiReview((current) => current ? { ...current, suggestions: current.suggestions.filter((item) => item.id !== suggestion.id) } : null);
    setNotice("Đã áp dụng một gợi ý vào bản nháp cục bộ. Hãy đọc lại trước khi lưu.");
  }

  async function saveDraft(submit: boolean) {
    if (!openRequest || !activeContent) return;
    const saved = await run({ action: "save-draft", versionId: openRequest.id, sectionContent: activeContent }, submit ? "Đã kiểm tra bản sửa." : "Đã lưu bản nháp trên Site Bơi ếch.");
    if (saved) updateContent(isEditableLesson(saved.activeContent) ? copyLesson(saved.activeContent) : activeContent);
    if (saved && submit) await run({ action: "submit-review", versionId: openRequest.id }, "Chỉnh sửa xong. Bản mới đã được gửi về Trung tâm để kiểm tra.");
  }

  return (
    <main className="edit-workspace">
      <header className="edit-topbar"><Link href="/">← Trở lại khóa học</Link><div><span>Biên tập tại Site nội dung</span><strong>Bơi ếch</strong></div><div className="edit-user"><span>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{user.email}</small></div><a href="/signout-with-chatgpt?return_to=/">Đăng xuất</a></div></header>
      <section className="edit-shell">
        <aside className="edit-rail">
          <div className="edit-device"><span>Laptop biên tập</span><strong>{device?.deviceCode || "Đang đăng ký…"}</strong><small>Yêu cầu chỉ có hiệu lực trên đúng laptop và tài khoản này.</small></div>
          <h2>Lịch sử yêu cầu</h2>
          <div className="edit-history">{versions.map((item) => <article key={item.id} className={openRequest?.id === item.id ? "active" : ""}><span>{scopeInfo(item).label}</span><strong>{statusLabel[item.status]}</strong><small>{formatDate(item.updated_at)}</small></article>)}{versions.length === 0 ? <p>Chưa có yêu cầu chỉnh sửa.</p> : null}</div>
        </aside>

        <section className="edit-main">
          <div className="edit-heading"><span>Quy trình có kiểm soát</span><h1>{openRequest ? statusLabel[openRequest.status] : "Yêu cầu quyền chỉnh sửa"}</h1><p>Nội dung chỉ được sửa tại đây. Trung tâm quản trị chỉ cấp phép, kiểm tra bản gửi lên và quyết định có cập nhật máy chủ hay không.</p></div>
          {notice ? <div className="edit-notice" role="status">{notice}</div> : null}

          {!openRequest ? (
            <section className="edit-request-card">
              <div className="edit-flow"><span className="active">1. Xin quyền</span><i /><span>2. Chỉnh sửa</span><i /><span>3. Gửi kiểm tra</span><i /><span>4. Cập nhật</span></div>
              <div className="edit-request-intro"><span>Phân cấp quyền chỉnh sửa</span><h2>Chọn đúng bài, sau đó chọn đúng một phần</h2><p>Trung tâm chỉ cấp quyền cho phạm vi bên dưới. Các phần còn lại không được mở trong trình biên tập.</p></div>
              <div className="edit-request-grid">
                <label className="lesson-selector"><span>Cấp 1 · Bài học</span><select value={editLesson} onChange={(event) => setEditLesson(event.target.value)}>{["01","02","03","04","05","06","07","08"].map((number) => <option key={number} value={number}>Bài {number}</option>)}</select></label>
                <fieldset className="section-selector"><legend>Cấp 2 · Phần được phép sửa</legend><div className="section-choice-grid">{editSectionOptions.map((item) => <button key={item.id} type="button" aria-pressed={editSection === item.id} className={editSection === item.id ? "selected" : ""} onClick={() => setEditSection(item.id)}><small>{item.eyebrow}</small><strong>{item.label}</strong><span>{item.description}</span></button>)}</div></fieldset>
              </div>
              <div className="scope-confirm"><span>Phạm vi sẽ gửi</span><strong>{activeScope.label}</strong><small>Không thể mở hoặc gửi dữ liệu ngoài phạm vi này.</small></div>
              <label className="summary-field"><span>Mô tả nội dung dự định sửa</span><textarea value={summary} maxLength={300} onChange={(event) => setSummary(event.target.value)} placeholder={`Ví dụ: cập nhật ${activeScope.sectionLabel.toLowerCase()} của Bài ${activeScope.lessonNumber}`} /><small>{summary.trim().length}/300 ký tự · tối thiểu 5 ký tự</small></label>
              <button className="edit-primary" onClick={() => void requestEdit()} disabled={busy || summary.trim().length < 5}>Xin chỉnh sửa {activeScope.label}</button>
            </section>
          ) : null}

          {openRequest?.status === "permission_requested" ? (
            <section className="edit-state-card pending"><div className="edit-state-icon">⌛</div><span className="scope-pill">{activeScope.label}</span><h2>Đang chờ Trung tâm cấp quyền</h2><p>Yêu cầu đã được gửi. Chưa có nội dung mới nào được chuyển sang Trung tâm và các phần khác vẫn bị khóa.</p><dl><div><dt>Mô tả</dt><dd>{openRequest.summary}</dd></div><div><dt>Laptop</dt><dd>{openRequest.editor_device_code}</dd></div><div><dt>Gửi lúc</dt><dd>{formatDate(openRequest.created_at)}</dd></div></dl><div><button onClick={() => void refresh()} disabled={busy}>Kiểm tra lại</button><button className="edit-danger" onClick={() => void run({ action: "withdraw", versionId: openRequest.id }, "Đã rút yêu cầu chỉnh sửa.")} disabled={busy}>Rút yêu cầu</button></div></section>
          ) : null}

          {openRequest && ["draft", "changes_requested"].includes(openRequest.status) ? (
            <section className="edit-editor">
              <div className="edit-flow"><span>1. Đã cấp quyền</span><i /><span className="active">2. {activeScope.label}</span><i /><span>3. Gửi kiểm tra</span><i /><span>4. Cập nhật</span></div>
              {openRequest.status === "changes_requested" ? <div className="edit-review-note"><strong>Trung tâm yêu cầu sửa lại</strong><p>{openRequest.permission_note || "Hãy kiểm tra lại nội dung đã gửi."}</p></div> : null}
              <div className="edit-editor-head"><div><span>Phạm vi đã được cấp</span><h2>{activeScope.label}</h2></div><div className="editor-ai-trigger"><small>{dirty ? "Có thay đổi chưa lưu" : "Bản nháp đã đồng bộ"} · Chỉ phần này được tải vào vùng biên tập.</small><button onClick={() => void requestAiReview()} disabled={busy || !activeContent}>Frog AI kiểm tra bản nháp</button></div></div>
              {aiReview ? <section className="editor-ai-review"><header><div><span>Trợ lý soạn nội dung</span><strong>{aiReview.suggestions.length} gợi ý cần giáo viên quyết định</strong></div><small>{aiReview.engineVersion}</small></header><p>AI không được xuất bản và không tự thay đáp án. Chọn “Áp dụng” chỉ sửa bản nháp đang mở; bản mới vẫn phải gửi Trung tâm kiểm tra.</p><div>{aiReview.suggestions.map((suggestion) => <article key={suggestion.id} className={suggestion.severity}><span>{suggestion.severity === "warning" ? "Cần kiểm tra" : "Đề xuất"}</span><strong>{suggestion.reason}</strong>{suggestion.before && suggestion.after ? <details><summary>Xem trước thay đổi</summary><div><del>{suggestion.before}</del><ins>{suggestion.after}</ins></div></details> : null}{suggestion.path && suggestion.after ? <button onClick={() => applyAiSuggestion(suggestion)}>Áp dụng vào bản nháp</button> : null}</article>)}</div><footer><button onClick={() => setAiReview(null)}>Đóng gợi ý</button><span>Quyết định cuối cùng thuộc người biên tập và Trung tâm quản trị.</span></footer></section> : null}
              {activeContent ? <VisualSectionEditor content={activeContent} scope={activeScope} onChange={(next) => updateContent(next, true)} /> : <div className="edit-loading">Đang tải đúng phần nội dung được cấp phép…</div>}
              <div className="edit-actions"><button onClick={() => void run({ action: "withdraw", versionId: openRequest.id }, "Đã hủy bản chỉnh sửa.")} disabled={busy}>Hủy bản nháp</button><button onClick={() => void saveDraft(false)} disabled={busy || !activeContent || !dirty}>Lưu bản nháp</button><button className="edit-primary" onClick={() => void saveDraft(true)} disabled={busy || !activeContent}>Chỉnh sửa xong · gửi Trung tâm</button></div>
            </section>
          ) : null}

          {openRequest?.status === "review" ? (
            <section className="edit-state-card review"><div className="edit-state-icon">✓</div><span className="scope-pill">{activeScope.label}</span><h2>Bản mới đã gửi về Trung tâm</h2><p>Toàn bộ nội dung của phần đã sửa đang chờ đối chiếu. Máy chủ vẫn sử dụng phiên bản cũ cho tới khi người có quyền xuất bản đồng ý.</p><dl><div><dt>Phạm vi đã sửa</dt><dd>{activeScope.label}</dd></div><div><dt>Gửi kiểm tra</dt><dd>{formatDate(openRequest.submitted_at)}</dd></div><div><dt>Trạng thái máy chủ</dt><dd>Chưa cập nhật</dd></div></dl><button onClick={() => void refresh()} disabled={busy}>Cập nhật trạng thái</button></section>
          ) : null}
        </section>
      </section>
    </main>
  );
}
