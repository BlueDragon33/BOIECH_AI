"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Certificate = {
  verificationCode: string;
  deviceCode: string;
  learnerName: string;
  className: string;
  scores: Record<string, number>;
  totalActiveSeconds: number;
  completedAt: string;
  courseVersion: number;
  issuedAt: string;
  courseTitle: string;
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "long" }).format(date)
    : "—";
}

function studyDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
}

export default function CertificatePage() {
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const code = new URLSearchParams(window.location.search).get("code")?.trim().toUpperCase() ?? "";
      if (!code) {
        setError("Liên kết chưa có mã chứng chỉ.");
        setLoading(false);
        return;
      }
      fetch(`/api/certificate?code=${encodeURIComponent(code)}`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json() as { certificate?: Certificate; error?: string };
          if (!response.ok || !data.certificate) throw new Error(data.error ?? "Không tìm thấy chứng chỉ.");
          setCertificate(data.certificate);
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Không thể xác minh chứng chỉ."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (loading) return <main className="certificate-status"><span>Đang xác minh</span><h1>Đang kiểm tra chứng chỉ…</h1></main>;
  if (!certificate) return <main className="certificate-status invalid"><span>Chưa xác thực</span><h1>{error}</h1><Link href="/">Về ứng dụng học</Link></main>;

  const scores = Object.entries(certificate.scores).sort(([left], [right]) => left.localeCompare(right));
  const average = scores.length > 0 ? scores.reduce((total, [, score]) => total + score, 0) / scores.length : 0;
  return (
    <main className="certificate-page">
      <div className="certificate-actions no-print"><Link href="/">← Về ứng dụng</Link><button onClick={() => window.print()}>In / Lưu PDF</button></div>
      <article className="certificate-sheet">
        <div className="certificate-border">
          <header><span className="certificate-seal">BE</span><div><small>HỆ THỐNG HỌC TẬP BƠI ẾCH AI</small><strong>Chứng chỉ điện tử có thể xác minh</strong></div><b>✓ Hợp lệ</b></header>
          <section className="certificate-copy"><span>CHỨNG NHẬN HOÀN THÀNH</span><h1>{certificate.learnerName}</h1><p>Học viên lớp <strong>{certificate.className}</strong> đã hoàn thành đầy đủ chương trình</p><h2>{certificate.courseTitle}</h2><p>Hoàn thành 8/8 bài, đủ 40 phần học tuần tự và đạt tối thiểu 8/10 trong từng bài kiểm tra.</p></section>
          <section className="certificate-metrics"><div><span>Điểm trung bình</span><strong>{average.toFixed(1)}/10</strong></div><div><span>Thời gian ghi nhận</span><strong>{studyDuration(certificate.totalActiveSeconds)}</strong></div><div><span>Ngày hoàn thành</span><strong>{displayDate(certificate.completedAt)}</strong></div></section>
          <section className="certificate-scores">{scores.map(([lesson, score]) => <div key={lesson}><span>Bài {lesson}</span><strong>{score}/10</strong></div>)}</section>
          <footer><div><span>Mã xác minh</span><strong>{certificate.verificationCode}</strong><small>Thiết bị {certificate.deviceCode} · Phiên bản nội dung V{certificate.courseVersion}</small></div><div className="certificate-signature"><i /> <strong>Frog AI Learning Center</strong><span>Cấp ngày {displayDate(certificate.issuedAt)}</span></div></footer>
        </div>
      </article>
      <p className="certificate-verification no-print">Giảng viên có thể mở lại đúng liên kết này để kiểm tra trạng thái hợp lệ của chứng chỉ.</p>
    </main>
  );
}
