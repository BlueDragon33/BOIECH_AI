"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EditorWorkspace from "./editor-workspace";

type EditorUser = { displayName: string; email: string };
type SessionReply = { user?: EditorUser; error?: string; code?: string };
type GateState =
  | { kind: "loading" }
  | { kind: "ready"; user: EditorUser }
  | { kind: "denied"; message: string }
  | { kind: "unavailable"; message: string; code: string };

function verifiedUser(value: unknown): value is EditorUser {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.displayName === "string" && candidate.displayName.length > 0 &&
    typeof candidate.email === "string" && candidate.email.length > 0;
}

/**
 * A separate authenticated GET avoids crashing the whole Next.js RSC tree
 * when the editor's database/identity bootstrap is temporarily unavailable.
 * POST mutation routes independently revalidate role + P-256 proof.
 */
export default function EditorSessionGate({
  initialLesson,
  returnHref,
}: {
  initialLesson: string;
  returnHref: string;
}) {
  const [state, setState] = useState<GateState>({ kind: "loading" });

  const checkSession = useCallback(async (signal?: AbortSignal) => {
    setState({ kind: "loading" });
    try {
      const response = await fetch("/api/editor/session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
        headers: { accept: "application/json" },
      });
      const payload = await response.json() as SessionReply;
      if (signal?.aborted) return;
      if (response.ok && verifiedUser(payload.user)) {
        setState({ kind: "ready", user: payload.user });
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setState({
          kind: "denied",
          message: typeof payload.error === "string" ? payload.error : "Tài khoản hiện tại chưa có quyền Biên tập nội dung.",
        });
        return;
      }
      setState({
        kind: "unavailable",
        message: typeof payload.error === "string" ? payload.error : "Không thể kiểm tra phiên biên tập trên máy chủ.",
        code: typeof payload.code === "string" ? payload.code : "EDITOR_SESSION_INVALID_REPLY",
      });
    } catch {
      if (signal?.aborted) return;
      setState({
        kind: "unavailable",
        message: "Không kết nối được dịch vụ biên tập. Không cần xóa dữ liệu hoặc đăng nhập lại.",
        code: "EDITOR_SESSION_NETWORK",
      });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkSession(controller.signal);
    return () => controller.abort();
  }, [checkSession]);

  if (state.kind === "ready") {
    return <EditorWorkspace user={state.user} initialLesson={initialLesson} returnHref={returnHref} />;
  }

  return (
    <main role={state.kind === "unavailable" ? "alert" : "status"} style={{
      minHeight: "80vh", display: "grid", placeItems: "center",
      padding: "2rem 1rem", color: "#f3fbff", background: "#082439",
    }}>
      <section style={{ width: "min(100%, 38rem)", padding: "1.5rem",
        border: "1px solid #5a9ab2", borderRadius: "1rem", background: "#0c3046",
      }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: "0.75rem" }}>
          {state.kind === "loading" ? "Đang xác minh phiên biên tập…" :
            state.kind === "denied" ? "Chưa có quyền biên tập" : "Không tải được phiên biên tập"}
        </h1>
        <p style={{ lineHeight: 1.6, marginBottom: "1rem" }}>
          {state.kind === "loading"
            ? "Đang kiểm tra quyền Giảng viên trên máy chủ, không tạo phiên đăng nhập mới."
            : state.message}
        </p>
        {state.kind === "unavailable" ? (
          <p style={{ fontSize: "0.8rem", color: "#b7dce8" }}>Mã kiểm tra: {state.code}</p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.2rem" }}>
          {state.kind === "unavailable" || state.kind === "denied" ? (
            <button type="button" onClick={() => void checkSession()}
              style={{ borderRadius: "0.7rem", padding: "0.8rem 1.2rem",
                background: "#10b9bd", color: "#05212d", fontWeight: 800 }}>
              Kiểm tra lại
            </button>
          ) : null}
          <Link href={returnHref} style={{ padding: "0.8rem 1.2rem", borderRadius: "0.7rem",
            border: "1px solid #78b3c9", color: "#f3fbff" }}>
            Về lớp học
          </Link>
        </div>
      </section>
    </main>
  );
}
