"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Credential = { version: 1; privateKey: CryptoKey | null; publicKey: JsonWebKey };
type EditorDevice = { deviceId: string; deviceCode: string; email: string; displayName: string };
type EditSection = "content" | "practice" | "analysis" | "review" | "quiz";
type Scope = { lessonNumber: string; section: EditSection; sectionLabel: string; label: string; value: string };
type VersionStatus = "permission_requested" | "draft" | "review" | "published" | "changes_requested" | "denied" | "cancelled" | "archived";
type Version = {
  id: string;
  version_number: number;
  status: VersionStatus;
  summary: string | null;
  created_by: string;
  editor_device_code: string | null;
  edit_scope: string | null;
  edit_lesson: string | null;
  edit_section: EditSection | null;
  edit_scope_label: string | null;
  permission_note: string | null;
  created_at: string;
  updated_at: string;
};
type Question = { q: string; options: [string, string, string, string]; answer: number; explain: string };
type ContentSection = { html: string; safety: string[] };
type PracticeSection = { steps: string[] };
type AnalysisSection = { html: string };
type ReviewSection = { points: string[] };
type QuizSection = { questions: Question[] };
type EditableSection = ContentSection | PracticeSection | AnalysisSection | ReviewSection | QuizSection;
type ApiData = { device?: EditorDevice; challenge?: string; versions?: Version[]; activeContent?: EditableSection; activeScope?: Scope; versionId?: string; validationErrors?: string[]; error?: string; code?: string };

const lessonNames: Record<string, string> = {
  "01": "Hồ sơ sức khỏe & tăng trưởng", "02": "Dinh dưỡng & chống hóc", "03": "Ngủ, vận động & phát triển", "04": "Ho, sổ mũi & đường hô hấp",
  "05": "Sốt & sử dụng thuốc an toàn", "06": "Tiêu hóa, da & vệ sinh", "07": "An toàn & sơ cứu cần nhớ", "08": "Tiêm chủng, khám định kỳ & kế hoạch gia đình",
};
const sectionOptions: { id: EditSection; label: string; description: string }[] = [
  { id: "content", label: "Nội dung", description: "Kiến thức chính và cảnh báo an toàn." },
  { id: "practice", label: "Thực hành", description: "Checklist cha mẹ có thể thực hiện." },
  { id: "analysis", label: "Phân tích", description: "Tình huống và cách đọc diễn biến." },
  { id: "review", label: "Ôn tập", description: "Điểm cần ghi nhớ cuối bài." },
  { id: "quiz", label: "Kiểm tra", description: "10 câu, 4 lựa chọn, đáp án và giải thích." },
];
const statusLabels: Record<VersionStatus, string> = {
  permission_requested: "Đang chờ Trung tâm cấp quyền", draft: "Được phép chỉnh sửa", review: "Đã gửi Trung tâm kiểm tra", published: "Đã xuất bản",
  changes_requested: "Trung tâm yêu cầu sửa lại", denied: "Bị từ chối", cancelled: "Đã hủy", archived: "Phiên bản cũ",
};

class ApiError extends Error { data: ApiData; constructor(message: string, data: ApiData) { super(message); this.data = data; } }

function base64Url(bytes: Uint8Array) {
  let binary = ""; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("child-health-content-editor", 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("credential")) request.result.createObjectStore("credential"); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function readCredential() {
  const db = await openDb(); return new Promise<Credential | undefined>((resolve, reject) => {
    const request = db.transaction("credential", "readonly").objectStore("credential").get("primary");
    request.onsuccess = () => resolve(request.result as Credential | undefined); request.onerror = () => reject(request.error);
  });
}
async function writeCredential(value: Credential) {
  const db = await openDb(); return new Promise<void>((resolve, reject) => {
    const request = db.transaction("credential", "readwrite").objectStore("credential").put(value, "primary");
    request.onsuccess = () => resolve(); request.onerror = () => reject(request.error);
  });
}
async function credentialForEditor() {
  const current = await readCredential(); if (current?.version === 1 && current.privateKey && current.publicKey) return current;
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const credential = { version: 1, privateKey, publicKey } satisfies Credential; await writeCredential(credential); return credential;
}
async function api(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json() as ApiData;
  if (!response.ok) throw new ApiError(data.validationErrors?.join("\n") || data.error || "Không thể xử lý yêu cầu.", data);
  return data;
}
async function register(credential: Credential) {
  const data = await api("/api/editor/device", { action: "register", publicKey: credential.publicKey });
  if (!data.device) throw new ApiError("Máy chủ chưa trả về laptop biên tập.", data); return data.device;
}
async function proof(credential: Credential, device: EditorDevice) {
  const data = await api("/api/editor/device", { action: "challenge", deviceId: device.deviceId });
  if (!data.challenge || !credential.privateKey) throw new ApiError("Không thể xác thực laptop.", data);
  const message = new TextEncoder().encode(`boi-ech-editor:${device.deviceId}:${data.challenge}`);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, credential.privateKey, message);
  return { deviceId: device.deviceId, challenge: data.challenge, signature: base64Url(new Uint8Array(signature)) };
}
async function secureApi(credential: Credential, device: EditorDevice, body: Record<string, unknown>) {
  return api("/api/editor/health-content", { ...body, ...await proof(credential, device) });
}
function formatDate(value: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date) : "—"; }
function stripMarkup(value: string) { return value.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\s*\/p\s*>/gi, "\n\n").replace(/<\s*li[^>]*>/gi, "\n• ").replace(/<[^>]*>/g, "").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&").replace(/\n{3,}/g, "\n\n").trim(); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

export default function HealthEditorWorkspace({ user }: { user: { displayName: string; email: string } }) {
  const [credential, setCredential] = useState<Credential | null>(null);
  const [device, setDevice] = useState<EditorDevice | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [lesson, setLesson] = useState("04");
  const [section, setSection] = useState<EditSection>("content");
  const [summary, setSummary] = useState("");
  const [activeScope, setActiveScope] = useState<Scope | null>(null);
  const [draft, setDraft] = useState<EditableSection | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const activeVersion = versions.find((item) => ["permission_requested", "draft", "changes_requested", "review"].includes(item.status)) ?? null;

  async function bootstrap(key: Credential, editor: EditorDevice) {
    const data = await secureApi(key, editor, { action: "bootstrap" });
    setVersions(data.versions ?? []); setActiveScope(data.activeScope ?? null); setDraft(data.activeContent ? normalizeForEditor(data.activeContent) : null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = await credentialForEditor(); const editor = await register(key);
        if (cancelled) return; setCredential(key); setDevice(editor); await bootstrap(key, editor);
      } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : "Không thể mở trình biên tập."); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(body: Record<string, unknown>, success: string) {
    if (!credential || !device) return null; setBusy(true); setNotice(""); setError("");
    try {
      const data = await secureApi(credential, device, body);
      setVersions(data.versions ?? []); setActiveScope(data.activeScope ?? null); if (data.activeContent) setDraft(normalizeForEditor(data.activeContent)); setNotice(success); return data;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xử lý yêu cầu."); return null; }
    finally { setBusy(false); }
  }

  async function refresh() { if (!credential || !device) return; setBusy(true); setError(""); try { await bootstrap(credential, device); setNotice("Đã cập nhật trạng thái từ Trung tâm."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể cập nhật."); } finally { setBusy(false); } }

  return <main className="health-editor-shell">
    <header className="health-editor-top"><div><div className="health-editor-seal">BT</div><div><strong>Biên tập · Sức khỏe trẻ</strong><small>{user.displayName} · nội dung phải qua Trung tâm quản trị</small></div><Link href="/suc-khoe-tre">Về site Sức khỏe trẻ</Link></div></header>
    <div className="health-editor-layout">
      <aside className="health-editor-side">
        <span className="health-editor-eyebrow">Laptop biên tập</span><h2>{device?.deviceCode ?? "Đang xác thực…"}</h2><p className="health-editor-field">{user.email}</p>
        <div className="health-editor-boundary"><strong>Ranh giới an toàn:</strong> trình biên tập chỉ sửa nội dung giáo trình. Không được sửa `policyVersion`, ngưỡng thở nhanh, ngưỡng cấp cứu hoặc dữ liệu sức khỏe cá nhân.</div>
        {!activeVersion ? <><div className="health-editor-field"><label>Bài học</label><select value={lesson} onChange={(event) => setLesson(event.target.value)}>{Object.entries(lessonNames).map(([id, name]) => <option key={id} value={id}>Bài {id} · {name}</option>)}</select></div><div className="health-editor-field"><label>Phần cần sửa</label><select value={section} onChange={(event) => setSection(event.target.value as EditSection)}>{sectionOptions.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.description}</option>)}</select></div><div className="health-editor-field"><label>Lý do / nội dung dự kiến sửa</label><textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Ví dụ: cập nhật cách diễn đạt dấu hiệu thở nhanh theo nguồn WHO mới…" /></div><button className="health-editor-button primary" disabled={busy || summary.trim().length < 5} onClick={() => void run({ action: "request-edit", editLesson: lesson, editSection: section, summary }, "Đã gửi yêu cầu. Chờ Trung tâm cấp quyền trước khi sửa.")}>Xin quyền chỉnh sửa</button></> : <button className="health-editor-button" onClick={() => void refresh()} disabled={busy}>Cập nhật trạng thái</button>}
        <div className="health-editor-versions"><span className="health-editor-eyebrow">Lịch sử gần đây</span>{versions.map((version) => <div className={`health-editor-version ${version.id === activeVersion?.id ? "active" : ""}`} key={version.id}><strong>{version.edit_scope_label ?? version.edit_scope ?? "Sức khỏe trẻ"}</strong><small>{statusLabels[version.status]} · {formatDate(version.updated_at)}</small><small>{version.summary || "Không có mô tả"}</small></div>)}</div>
      </aside>

      <section className="health-editor-main">
        <span className="health-editor-eyebrow">Quy trình kiểm duyệt bắt buộc</span><h1>{activeVersion ? activeVersion.edit_scope_label ?? "Bản sửa Sức khỏe trẻ" : "Chọn đúng phạm vi rồi xin quyền"}</h1>
        {busy ? <div className="health-editor-status">Đang đồng bộ…</div> : null}{notice ? <div className="health-editor-notice">{notice}</div> : null}{error ? <div className="health-editor-error">{error}</div> : null}
        {!activeVersion ? <><div className="health-editor-diff-note"><strong>Luồng:</strong> Xin quyền → Trung tâm duyệt phạm vi → chỉnh sửa trên laptop này → lưu bản nháp → gửi kiểm tra → publisher/owner xuất bản. Không có đường tắt cập nhật máy chủ.</div><p>Chọn một bài và đúng một trong 5 phần. Trung tâm chỉ cấp quyền cho phạm vi đó; phần còn lại không được ghi bởi endpoint biên tập.</p></> : null}
        {activeVersion?.status === "permission_requested" ? <div className="health-editor-status wait"><strong>Đang chờ Trung tâm cấp quyền.</strong><p>Chưa có dữ liệu bài học nào được tải vào trình sửa. Nhấn “Cập nhật trạng thái” sau khi kiểm duyệt viên xử lý.</p><button className="health-editor-button danger" disabled={busy} onClick={() => void run({ action: "withdraw", versionId: activeVersion.id }, "Đã rút yêu cầu.")}>Rút yêu cầu</button></div> : null}
        {activeVersion?.status === "review" ? <div className="health-editor-status review"><strong>Bản sửa đang chờ Trung tâm kiểm tra.</strong><p>Trình sửa đã khóa. Reviewer có thể yêu cầu sửa lại; publisher/owner mới có quyền xuất bản.</p></div> : null}
        {activeVersion && ["draft", "changes_requested"].includes(activeVersion.status) && activeScope && draft ? <><div className={`health-editor-status ${activeVersion.status === "changes_requested" ? "change" : ""}`}><span className="health-editor-scope">{activeScope.label}</span><strong>{activeVersion.status === "changes_requested" ? "Trung tâm yêu cầu sửa lại" : "Đã được cấp quyền chỉnh sửa"}</strong>{activeVersion.permission_note ? <p>Nhận xét Trung tâm: {activeVersion.permission_note}</p> : null}</div><SectionEditor scope={activeScope} value={draft} onChange={setDraft} /><div className="health-editor-actions"><button className="health-editor-button" disabled={busy} onClick={() => void run({ action: "save-draft", versionId: activeVersion.id, sectionContent: draft }, "Đã lưu bản nháp hợp lệ.")}>Lưu bản nháp</button><button className="health-editor-button accent" disabled={busy || activeVersion.status !== "draft"} onClick={() => void run({ action: "submit-review", versionId: activeVersion.id }, "Đã gửi bản sửa về Trung tâm kiểm tra.")}>Gửi Trung tâm duyệt</button><button className="health-editor-button danger" disabled={busy} onClick={() => void run({ action: "withdraw", versionId: activeVersion.id }, "Đã hủy bản sửa.")}>Hủy yêu cầu</button></div><small>Muốn gửi duyệt sau khi Trung tâm yêu cầu sửa lại: hãy bấm “Lưu bản nháp” trước; trạng thái sẽ trở về bản nháp hợp lệ.</small></> : null}
      </section>
    </div>
    <footer className="health-editor-footer">Không có hồ sơ bé, nhiệt độ, SpO₂, nhật ký bệnh hay kết quả AI của gia đình trong trình biên tập này. Chỉ nội dung giáo trình được gửi lên máy chủ để kiểm duyệt.</footer>
  </main>;
}

function normalizeForEditor(value: EditableSection): EditableSection {
  const next = clone(value) as EditableSection;
  if ("html" in next) next.html = stripMarkup(next.html);
  return next;
}

function SectionEditor({ scope, value, onChange }: { scope: Scope; value: EditableSection; onChange: (v: EditableSection) => void }) {
  if (scope.section === "content" && "safety" in value && "html" in value) {
    return <><div className="health-editor-field"><label>Nội dung chính</label><textarea style={{ minHeight: 260 }} value={value.html} onChange={(event) => onChange({ ...value, html: event.target.value })} /></div><ArrayEditor label="Cảnh báo an toàn" values={value.safety} onChange={(safety) => onChange({ ...value, safety })} /></>;
  }
  if (scope.section === "practice" && "steps" in value) return <ArrayEditor label="Các bước thực hành" values={value.steps} onChange={(steps) => onChange({ ...value, steps })} />;
  if (scope.section === "analysis" && "html" in value) return <div className="health-editor-field"><label>Phân tích tình huống</label><textarea style={{ minHeight: 300 }} value={value.html} onChange={(event) => onChange({ ...value, html: event.target.value })} /></div>;
  if (scope.section === "review" && "points" in value) return <ArrayEditor label="Điểm ôn tập" values={value.points} onChange={(points) => onChange({ ...value, points })} />;
  if (scope.section === "quiz" && "questions" in value) return <QuizEditor value={value} onChange={onChange} />;
  return <div className="health-editor-error">Cấu trúc phần được cấp quyền không hợp lệ. Không thể chỉnh sửa.</div>;
}

function ArrayEditor({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  return <section className="health-editor-section"><h3>{label}</h3><div className="health-editor-array">{values.map((value, index) => <div className="health-editor-field" key={index}><label>Mục {index + 1}</label><textarea value={value} onChange={(event) => onChange(values.map((item, i) => i === index ? event.target.value : item))} /></div>)}</div></section>;
}

function QuizEditor({ value, onChange }: { value: QuizSection; onChange: (v: EditableSection) => void }) {
  function updateQuestion(index: number, question: Question) { onChange({ questions: value.questions.map((item, i) => i === index ? question : item) }); }
  return <section><div className="health-editor-diff-note"><strong>Cấu trúc khóa:</strong> phải giữ đúng 10 câu, mỗi câu 4 phương án, 1 đáp án và giải thích. Endpoint sẽ từ chối nếu thiếu.</div>{value.questions.map((question, index) => <article className="health-editor-question" key={index}><h4>Câu {index + 1}</h4><div className="health-editor-field"><label>Nội dung câu hỏi</label><textarea value={question.q} onChange={(event) => updateQuestion(index, { ...question, q: event.target.value })} /></div><div className="health-editor-grid">{question.options.map((option, optionIndex) => <div className="health-editor-field" key={optionIndex}><label>Phương án {String.fromCharCode(65 + optionIndex)}</label><input value={option} onChange={(event) => { const options = [...question.options] as [string, string, string, string]; options[optionIndex] = event.target.value; updateQuestion(index, { ...question, options }); }} /></div>)}</div><div className="health-editor-field"><label>Đáp án đúng</label><select value={question.answer} onChange={(event) => updateQuestion(index, { ...question, answer: Number(event.target.value) })}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>{String.fromCharCode(65 + optionIndex)}</option>)}</select></div><div className="health-editor-field"><label>Giải thích</label><textarea value={question.explain} onChange={(event) => updateQuestion(index, { ...question, explain: event.target.value })} /></div></article>)}</section>;
}
