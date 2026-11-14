import type { AccountClientClass } from "./account-core.server";

// Edge request headers are hints about the browser client, NOT a proof of a
// physical device. This classification chooses account-session UX only.
// Never use it to bypass password, entitlement, RBAC, revocation or MFA.
export function classifyAccountClient(userAgent: string | null, mobileHint: string | null): AccountClientClass {
  const ua = (userAgent ?? "").slice(0, 700);
  if (/iPad|Tablet|Android(?!.*Mobile)|Macintosh.*Mobile\//i.test(ua)) return "tablet";
  if (/iPhone|iPod|Windows Phone|Android.*Mobile|Mobile\//i.test(ua)) return "phone";
  if (mobileHint === "?1") return "phone";
  return "desktop";
}
