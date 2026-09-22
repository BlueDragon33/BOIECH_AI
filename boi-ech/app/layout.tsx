import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./student-role-shell.css";
import "./student-adaptive-coach.css";
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
import "./teacher-dashboard-actions-v7.css";
import "./teacher-dashboard-visual-v8.css";
import "./teacher-roster-sync-v9.css";
import "./teacher-learning-analytics-l7.css";
import "./teacher-smart-interventions-l8.css";
import "./two-way-messaging-l9.css";
import "./assignment-schedule-l10.css";
import "./teacher-secondary-tabs-v10.css";
import "./teacher-dashboard-usability-v29.css";
import "./teacher-control-center-v30.css";
import StudentRoleShell from "./student-role-shell";
import StudentTeacherInbox from "./student-teacher-inbox";
import StudentAdaptiveCoach from "./student-adaptive-coach";
import TeacherRoleShell from "./teacher-role-shell";
import TeacherActionBridge from "./teacher-action-bridge";
import MultiAccountSwitcher from "./multi-account-switcher";
import TeacherDashboardBlueprint from "./teacher-dashboard-blueprint";
import TeacherRosterManager from "./teacher-roster-manager";

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
        <StudentTeacherInbox />
        <StudentAdaptiveCoach />
        <TeacherRoleShell />
        <TeacherActionBridge />
        <MultiAccountSwitcher />
        <TeacherDashboardBlueprint />
        <TeacherRosterManager />
      </body>
    </html>
  );
}
