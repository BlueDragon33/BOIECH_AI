import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trung tâm quản trị ứng dụng",
  description: "Điều phối ứng dụng, thiết bị quản trị, phân quyền và nhật ký bảo mật của hệ thống.",
  applicationName: "Trung tâm quản trị ứng dụng",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Quản trị ứng dụng", statusBarStyle: "default" },
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
