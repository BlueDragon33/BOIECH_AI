import type { Metadata } from "next";

// Certificate links contain high-entropy bearer codes and must not be indexed.
// The verification endpoint is intentionally public; it returns minimal data.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CertificateLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
