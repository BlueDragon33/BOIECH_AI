import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trung tâm quản trị học tập",
  description: "Quản lý thiết bị, tiến độ, nội dung và phiên bản của hệ thống học tập.",
  applicationName: "Trung tâm quản trị học tập",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Quản trị học tập", statusBarStyle: "default" },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = { themeColor: "#173b33" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
