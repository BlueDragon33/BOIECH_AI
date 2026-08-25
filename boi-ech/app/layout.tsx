import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      </body>
    </html>
  );
}
