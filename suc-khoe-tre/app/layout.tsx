import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Sức khỏe trẻ 9 tháng–5 tuổi",
  description: "Web-app chăm sóc sức khỏe trẻ, công cụ offline và nội dung được kiểm duyệt độc lập.",
  applicationName: "Sức khỏe trẻ",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Sức khỏe trẻ", statusBarStyle: "default" },
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};
export const viewport = { themeColor: "#173b69" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="vi"><body>{children}</body></html>; }
