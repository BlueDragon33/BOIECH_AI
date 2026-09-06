import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Sức khỏe trẻ 9 tháng–5 tuổi", description: "Giáo trình sức khỏe trẻ, công cụ offline và quy trình biên tập được kiểm duyệt độc lập." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }
