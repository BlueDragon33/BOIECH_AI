"use client";

import { useEffect, useState } from "react";
import type { LessonContentPayload } from "./course-types";

type FieldPath = (string | number)[];
type JsonRecord = Record<string | number, unknown>;

const labels: Record<string, string> = {
  title: "Tiêu đề", body: "Nội dung", summary: "Giới thiệu", target: "Mục tiêu",
  safety: "An toàn", knowledge: "Nội dung học", analysis: "Phân tích", drills: "Thực hành",
  mistakes: "Lỗi thường gặp", session: "Kế hoạch buổi tập", sessionPlan: "Kế hoạch buổi tập",
  questions: "Câu hỏi", q: "Câu hỏi", options: "Phương án", memory: "Ghi nhớ",
  steps: "Các bước", cue: "Khẩu lệnh", avoid: "Cần tránh", action: "Cách thực hiện",
  purpose: "Mục đích", goal: "Mục tiêu", pass: "Tiêu chí đạt", sign: "Dấu hiệu",
  cause: "Nguyên nhân", fix: "Cách sửa", volume: "Khối lượng", time: "Thời gian",
  phases: "Các pha kỹ thuật", analysisPhases: "Các pha phân tích", practice: "Thực hành",
  practiceText: "Giới thiệu thực hành", sessionText: "Giới thiệu buổi tập", short: "Tên ngắn",
  name: "Tên", meta: "Thông tin ngắn", status: "Trạng thái", group: "Nhóm",
  duration: "Thời lượng", objectives: "Mục tiêu học tập", core: "Nội dung cốt lõi",
  bridge: "Kết nối lộ trình",
};

const protectedFields = new Set(["id", "n", "number", "lessonNumber", "kind", "code"]);

function titleFor(key: string) {
  return labels[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function updateAtPath(root: LessonContentPayload, path: FieldPath, value: unknown) {
  const next = copy(root);
  let cursor: JsonRecord | unknown[] = next as unknown as JsonRecord;
  for (const segment of path.slice(0, -1)) cursor = (cursor as JsonRecord)[segment] as JsonRecord | unknown[];
  (cursor as JsonRecord)[path.at(-1)!] = value;
  return next;
}

function EditableField({ fieldKey, value, path, onChange, depth = 0 }: {
  fieldKey: string;
  value: unknown;
  path: FieldPath;
  onChange: (path: FieldPath, value: unknown) => void;
  depth?: number;
}) {
  if (Array.isArray(value)) {
    return <section className={`local-edit-group depth-${Math.min(depth, 2)}`}><header><strong>{titleFor(fieldKey)}</strong><small>{value.length} mục</small></header><div>{value.map((item, index) => isRecord(item)
      ? <article key={index}><span>Mục {index + 1}</span>{Object.entries(item).map(([key, child]) => <EditableField key={key} fieldKey={key} value={child} path={[...path, index, key]} onChange={onChange} depth={depth + 1} />)}</article>
      : <EditableField key={index} fieldKey={`${titleFor(fieldKey)} ${index + 1}`} value={item} path={[...path, index]} onChange={onChange} depth={depth + 1} />)}</div></section>;
  }
  if (isRecord(value)) {
    return <section className={`local-edit-group depth-${Math.min(depth, 2)}`}><header><strong>{titleFor(fieldKey)}</strong></header><div>{Object.entries(value).map(([key, child]) => <EditableField key={key} fieldKey={key} value={child} path={[...path, key]} onChange={onChange} depth={depth + 1} />)}</div></section>;
  }
  const readonly = protectedFields.has(fieldKey) || typeof value === "number" || typeof value === "boolean";
  const text = String(value ?? "");
  return <label className={`local-edit-field ${readonly ? "readonly" : ""}`}><span>{titleFor(fieldKey)}{readonly ? " · cố định" : ""}</span>{text.length > 80
    ? <textarea value={text} readOnly={readonly} onChange={(event) => onChange(path, event.target.value)} />
    : <input value={text} readOnly={readonly} onChange={(event) => onChange(path, event.target.value)} />}</label>;
}

export default function LocalContentStudio({ lessonNumber, content, onSave, onReset, onClose, hasLocalOverride }: {
  lessonNumber: string;
  content: LessonContentPayload;
  onSave: (next: LessonContentPayload) => Promise<void>;
  onReset: () => Promise<void>;
  onClose: () => void;
  hasLocalOverride: boolean;
}) {
  const [draft, setDraft] = useState(() => copy(content));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  async function save() {
    setBusy(true);
    setNotice("");
    try { await onSave(draft); setNotice("Đã lưu bản riêng trên thiết bị này."); }
    catch { setNotice("Trình duyệt chưa thể lưu bản riêng."); }
    finally { setBusy(false); }
  }

  async function reset() {
    if (!window.confirm(`Khôi phục Bài ${lessonNumber} về đúng nội dung hiện tại trên máy chủ?`)) return;
    setBusy(true);
    try { await onReset(); onClose(); }
    finally { setBusy(false); }
  }

  return <div className="local-studio-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><aside className="local-studio" role="dialog" aria-modal="true" aria-labelledby="local-studio-title"><header><div><span>BẢN RIÊNG TRÊN THIẾT BỊ</span><h2 id="local-studio-title">Chỉnh nội dung Bài {lessonNumber}</h2></div><button onClick={onClose} aria-label="Đóng">×</button></header><div className="local-studio-guard"><strong>Chỉ thay đổi trên thiết bị hiện tại</strong><p>Nội dung chính thức trên máy chủ luôn được giữ nguyên và bản riêng không gửi tới Trung tâm. Khi lưu, nút “Khôi phục bản máy chủ” sẽ xuất hiện để quay lại bản chính thức bất cứ lúc nào.</p></div><div className="local-studio-fields">{Object.entries(draft).map(([key, value]) => <EditableField key={key} fieldKey={key} value={value} path={[key]} onChange={(path, value) => setDraft((current) => updateAtPath(current, path, value))} />)}</div>{notice ? <div className="local-studio-notice" role="status">{notice}</div> : null}<footer>{hasLocalOverride ? <button className="danger" onClick={() => void reset()} disabled={busy}>Khôi phục bản máy chủ</button> : <span className="local-studio-server-state">Đang dùng nội dung máy chủ</span>}<div><button onClick={onClose}>Đóng</button><button className="primary" onClick={() => void save()} disabled={busy}>{busy ? "Đang lưu…" : "Lưu trên thiết bị"}</button></div></footer></aside></div>;
}
