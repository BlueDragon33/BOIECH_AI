import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./student-role-shell.css";
import "./teacher-role-shell.css";
import "./role-typography.css";
import "./teacher-action-bridge.css";
import "./multi-account-switcher.css";
import "./teacher-dashboard-reference.css";
import "./teacher-dashboard-blueprint.css";
import "./teacher-dashboard-scale-v3.css";
import "./teacher-dashboard-structure-v4.css";
import "./teacher-dashboard-visual-v5.css";
import "./teacher-dashboard-data-v6.css";
import StudentRoleShell from "./student-role-shell";
import TeacherRoleShell from "./teacher-role-shell";
import TeacherActionBridge from "./teacher-action-bridge";
import MultiAccountSwitcher from "./multi-account-switcher";
import TeacherDashboardBlueprint from "./teacher-dashboard-blueprint";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ứng dụng AI trong dạy và học môn Bơi ếch",
  description: "Ứng dụng dạy và học Bơi ếch với trợ giảng AI có nguồn dẫn, lộ trình cá nhân hóa, bài luyện thích ứng và quản trị có kiểm soát.",
  applicationName: "Bơi ếch AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bơi ếch AI",
    statusBarStyle: "default",
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#0c6f75",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <StudentRoleShell />
        <TeacherRoleShell />
        <TeacherActionBridge />
        <MultiAccountSwitcher />
        <TeacherDashboardBlueprint />
      </body>
    </html>
  );
}
