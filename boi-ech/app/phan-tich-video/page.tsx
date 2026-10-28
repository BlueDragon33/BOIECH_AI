"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import MediaPipeConsentGate from "./privacy-consent";
import { cancelVideoAnalysisRuns } from "./video-analysis-run.mjs";

const VideoAnalyzer = dynamic(() => import("./video-analyzer"), {
  ssr: false,
  loading: () => (
    <section className="video-analysis-loading-v37">
      <div>Đang mở bộ phân tích video cục bộ…</div>
    </section>
  ),
});

export default function LocalVideoAnalysisPage() {
  useEffect(() => {
    window.addEventListener("pagehide", cancelVideoAnalysisRuns);
    return () => window.removeEventListener("pagehide", cancelVideoAnalysisRuns);
  }, []);
  const searchParams = useSearchParams();
  const returnMode = searchParams.get("return");
  const requestedTab = searchParams.get("tab") ?? "analysis";
  const requestedClass = (searchParams.get("class") ?? "").trim().slice(0, 100);
  const teacherTabs = new Set(["overview","class","learners","tasks","reports","messages","schedule","profile","analysis"]);
  const returnTab = teacherTabs.has(requestedTab) ? requestedTab : "analysis";
  const classQuery = requestedClass ? `&class=${encodeURIComponent(requestedClass)}` : "";
  const returnHref = returnMode === "teacher" ? `/?workspace=teacher&tab=${encodeURIComponent(returnTab)}${classQuery}` : "/";

  return (
    <main data-video-analysis-v37>
      <div className="video-analysis-topbar-v37">
        <div className="video-analysis-topbar-inner-v37">
          {/* The home role shells initialize per document; remount them on return. */}
          <a href={returnHref} onClick={cancelVideoAnalysisRuns} className="video-analysis-back-v37">← Quay lại Bơi ếch AI</a>
          <div className="video-analysis-topbar-state-v37"><i/>Xử lý video cục bộ · không tải video gốc lên máy chủ</div>
        </div>
      </div>
      <MediaPipeConsentGate>
        <VideoAnalyzer lessonNumber="03" />
      </MediaPipeConsentGate>
    </main>
  );
}
