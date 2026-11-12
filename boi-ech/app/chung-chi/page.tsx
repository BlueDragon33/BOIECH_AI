"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Certificate = {
  verificationCode: string;
  learnerName: string;
  className: string;
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

  return (
    <main className="certificate-page">
      <div className="certificate-actions no-print"><Link href="/">← Về ứng dụng</Link><button onClick={() => window.print()}>In / Lưu PDF</button></div>
      <article className="certificate-sheet">
        <div className="certificate-border">
          <header><span className="certificate-seal">BE</span><div><small>HỆ THỐNG HỌC TẬP BƠI ẾCH AI</small><strong>Chứng chỉ điện tử có thể xác minh</strong></div><b>✓ Hợp lệ</b></header>
          <section className="certificate-copy"><span>CHỨNG NHẬN HOÀN THÀNH</span><h1>{certificate.learnerName}</h1><p>Học viên lớp <strong>{certificate.className}</strong> đã hoàn thành đầy đủ chương trình</p><h2>{certificate.courseTitle}</h2><p>Hoàn thành 8/8 bài, đủ 40 phần học tuần tự và đạt tối thiểu 8/10 trong từng bài kiểm tra.</p></section>
          <section className="certificate-metrics"><div><span>Kết quả</span><strong>Đã hoàn thành 8/8 bài</strong></div><div><span>Ngày hoàn thành</span><strong>{displayDate(certificate.completedAt)}</strong></div><div><span>Ngày cấp</span><strong>{displayDate(certificate.issuedAt)}</strong></div></section>
          <section className="certificate-scores" aria-label="Tám bài học đã đạt yêu cầu">{Array.from({length:8},(_,index)=><div key={index}><span>Bài {String(index+1).padStart(2,"0")}</span><strong>Đạt</strong></div>)}</section>
          <footer><div><span>Mã xác minh</span><strong>{certificate.verificationCode}</strong><small>Phiên bản nội dung V{certificate.courseVersion}</small></div><div className="certificate-signature"><i /> <strong>Frog AI Learning Center</strong><span>Cấp ngày {displayDate(certificate.issuedAt)}</span></div></footer>
        </div>
      </article>
      <p className="certificate-verification no-print">Ai có mã xác minh đều có thể xem chứng nhận hoàn thành này. Điểm số chi tiết, thời lượng học và mã thiết bị không hiển thị công khai.</p>
    </main>
  );
}
