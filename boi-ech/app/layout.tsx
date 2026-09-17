import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./student-role-shell.css";
import "./teacher-role-shell.css";
import "./multi-account-switcher.css";
import StudentRoleShell from "./student-role-shell";
import TeacherRoleShell from "./teacher-role-shell";
import TeacherActionBridge from "./teacher-action-bridge";
import MultiAccountSwitcher from "./multi-account-switcher";

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
      </body>
    </html>
  );
}
