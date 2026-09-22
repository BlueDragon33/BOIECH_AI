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
    const timer = window.setTimeout(() => {
      try {
        setConsented(window.localStorage.getItem(CONSENT_KEY) === "accepted");
      } catch {
        setConsented(false);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
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
      <section className="video-consent-shell-v37">
        <div className="video-consent-card-v37">Đang kiểm tra lựa chọn quyền riêng tư…</div>
      </section>
    );
  }

  if (!consented) {
    return (
      <section className="video-consent-shell-v37">
        <div className="video-consent-card-v37">
          <span>QUYỀN RIÊNG TƯ TRƯỚC KHI BẬT AI</span>
          <h1>Video vẫn xử lý trên thiết bị, MediaPipe có telemetry riêng.</h1>
          <p>Video, ảnh khung hình và pose landmarks dùng để phân tích không được Bơi ếch AI tải lên máy chủ và MediaPipe không gửi dữ liệu đầu vào đó tới Google. Tuy nhiên, MediaPipe Tasks có thể gửi số liệu về mức sử dụng, hiệu năng, môi trường hệ thống và đặc tính chung của loại dữ liệu được xử lý tới Google.</p>
          <p className="secondary">Chỉ sau khi đồng ý, trang mới khởi tạo bộ AI MediaPipe. Kết quả kỹ thuật Bơi ếch đồng bộ về hệ thống vẫn chỉ là JSON đã chuẩn hóa, không chứa video, ảnh, base64 hoặc blob.</p>
          <label className="video-consent-check-v37">
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>Tôi đã đọc thông tin trên và đồng ý khởi tạo MediaPipe Tasks cùng cơ chế số liệu sử dụng/hiệu năng của MediaPipe.</span>
          </label>
          <div className="video-consent-actions-v37">
            <button type="button" onClick={accept} disabled={!checked}>Đồng ý và mở AI video</button>
            <a href="https://developers.google.com/edge/mediapipe/solutions/tasks" target="_blank" rel="noreferrer">Xem thông báo MediaPipe</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="video-consent-shell-v37">
        <div className="video-consent-active-v37">
          <span><strong>MediaPipe đã được cho phép.</strong> Video/ảnh vẫn xử lý cục bộ; MediaPipe có thể gửi telemetry sử dụng và hiệu năng.</span>
          <button type="button" onClick={revoke}>Thu hồi</button>
        </div>
      </section>
      {children}
    </>
  );
}
