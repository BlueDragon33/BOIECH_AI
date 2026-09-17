"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import MediaPipeConsentGate from "./privacy-consent";

const VideoAnalyzer = dynamic(() => import("./video-analyzer"), {
  ssr: false,
  loading: () => (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: 28, fontFamily: "Arial, Helvetica, sans-serif", color: "#102b3f" }}>
      <div style={{ padding: 24, border: "1px solid #dbe8ea", borderRadius: 20, background: "#f4fbfb" }}>
        Đang mở bộ phân tích video cục bộ…
      </div>
    </div>
  ),
});

export default function LocalVideoAnalysisPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f6fafb", paddingBottom: 48 }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "18px 28px 0", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#075568", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
          ← Quay lại Bơi ếch AI
        </Link>
      </div>
      <MediaPipeConsentGate>
        <VideoAnalyzer lessonNumber="03" />
      </MediaPipeConsentGate>
    </main>
  );
}
