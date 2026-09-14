"use client";

import { useEffect, useState, type ReactNode } from "react";

const CONSENT_KEY = "boi-ech-mediapipe-metrics-consent-v1";

type Props = {
  children: ReactNode;
};

export default function MediaPipeConsentGate({ children }: Props) {
  const [hydrated, setHydrated] = useState(false);
  const [consented, setConsented] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setConsented(window.localStorage.getItem(CONSENT_KEY) === "accepted");
    } catch {
      setConsented(false);
    }
    setHydrated(true);
  }, []);

  function accept() {
    if (!checked) return;
    try {
      window.localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {
      // Consent still applies for this browser session even if storage is unavailable.
    }
    setConsented(true);
  }

  function revoke() {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      // Keep the UI revocation effective for this browser session.
    }
    setChecked(false);
    setConsented(false);
  }

  if (!hydrated) {
    return (
      <section style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ padding: 22, border: "1px solid #dbe8ea", borderRadius: 18, background: "#ffffff", color: "#183648" }}>
          Đang kiểm tra lựa chọn quyền riêng tư…
        </div>
      </section>
    );
  }

  if (!consented) {
    return (
      <section style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ padding: 24, border: "1px solid #c9dfe2", borderRadius: 20, background: "#ffffff", color: "#163346", boxShadow: "0 12px 30px rgba(16, 58, 70, .06)" }}>
          <span style={{ display: "inline-block", marginBottom: 8, color: "#08727b", fontSize: 12, fontWeight: 900, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Quyền riêng tư trước khi bật AI
          </span>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, lineHeight: 1.25 }}>Video vẫn xử lý trên thiết bị, nhưng MediaPipe có telemetry riêng.</h1>
          <p style={{ margin: "0 0 12px", lineHeight: 1.65, fontSize: 14 }}>
            Video, ảnh khung hình và pose landmarks dùng để phân tích không được Bơi ếch AI tải lên máy chủ và MediaPipe không gửi dữ liệu đầu vào đó tới Google. Tuy nhiên, MediaPipe Tasks có thể gửi số liệu về mức sử dụng, hiệu năng, môi trường hệ thống và đặc tính chung của loại dữ liệu được xử lý tới Google.
          </p>
          <p style={{ margin: "0 0 18px", lineHeight: 1.65, fontSize: 13, color: "#526d78" }}>
            Chỉ sau khi đồng ý, trang mới khởi tạo bộ AI MediaPipe. Kết quả kỹ thuật Bơi ếch đồng bộ về hệ thống vẫn chỉ là JSON đã chuẩn hóa, không chứa video, ảnh, base64 hoặc blob.
          </p>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 14, background: "#f3f9f9", cursor: "pointer", fontSize: 13, lineHeight: 1.5 }}>
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} style={{ marginTop: 3 }} />
            <span>Tôi đã đọc thông tin trên và đồng ý khởi tạo MediaPipe Tasks cùng cơ chế số liệu sử dụng/hiệu năng của MediaPipe.</span>
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            <button type="button" onClick={accept} disabled={!checked} style={{ border: 0, borderRadius: 12, padding: "11px 16px", background: checked ? "#08727b" : "#b8c8cb", color: "white", fontWeight: 800, cursor: checked ? "pointer" : "not-allowed" }}>
              Đồng ý và mở AI video
            </button>
            <a href="https://developers.google.com/edge/mediapipe/solutions/tasks" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", border: "1px solid #c9dfe2", borderRadius: 12, padding: "10px 14px", color: "#075568", textDecoration: "none", fontSize: 13, fontWeight: 800 }}>
              Xem thông báo MediaPipe
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section style={{ maxWidth: 1240, margin: "14px auto -2px", padding: "0 28px", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 13px", border: "1px solid #d7e7e8", borderRadius: 13, background: "#f8fbfb", color: "#49656f", fontSize: 12 }}>
          <span><strong style={{ color: "#17616a" }}>MediaPipe đã được cho phép.</strong> Video/ảnh vẫn xử lý cục bộ; MediaPipe có thể gửi telemetry sử dụng và hiệu năng.</span>
          <button type="button" onClick={revoke} style={{ border: "1px solid #cbdedf", borderRadius: 9, padding: "7px 10px", background: "#ffffff", color: "#075568", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            Thu hồi
          </button>
        </div>
      </section>
      {children}
    </>
  );
}
