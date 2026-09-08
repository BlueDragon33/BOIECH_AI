import { getCourseDatabase } from "./device-auth.server";

export type SiteDeviceType = "desktop" | "phone" | "tablet";

function cleanHeader(value: string | null, max = 500) {
  return (value ?? "").trim().slice(0, max);
}

function deviceTypeFromHeaders(request: Request): SiteDeviceType {
  const ua = cleanHeader(request.headers.get("user-agent")).toLowerCase();
  const platform = cleanHeader(request.headers.get("sec-ch-ua-platform"), 80).replaceAll('"', "").toLowerCase();
  const mobileHint = cleanHeader(request.headers.get("sec-ch-ua-mobile"), 10) === "?1";
  const ipadLike = ua.includes("ipad") || (ua.includes("macintosh") && ua.includes("mobile"));
  if (ipadLike || ua.includes("tablet") || (ua.includes("android") && !ua.includes("mobile"))) return "tablet";
  if (mobileHint || ua.includes("iphone") || ua.includes("ipod") || ua.includes("mobile") || /android.+mobile/.test(ua)) return "phone";
  if (platform.includes("android") && !mobileHint) return "tablet";
  return "desktop";
}

function browserFromUa(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("crios/") || ua.includes("chrome/")) return "Chrome";
  if (ua.includes("fxios/") || ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  return "Khác";
}

function platformFromRequest(request: Request) {
  const hinted = cleanHeader(request.headers.get("sec-ch-ua-platform"), 80).replaceAll('"', "");
  if (hinted) return hinted;
  const ua = cleanHeader(request.headers.get("user-agent")).toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || (ua.includes("macintosh") && ua.includes("mobile"))) return "iOS/iPadOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("macintosh") || ua.includes("mac os")) return "macOS";
  if (ua.includes("linux")) return "Linux";
  return "Khác";
}

export async function captureDeviceMetadata(request: Request, deviceId: string) {
  const userAgent = cleanHeader(request.headers.get("user-agent"));
  const database = await getCourseDatabase();
  await database.prepare(
    `UPDATE device_access
        SET device_type = ?, platform = ?, browser = ?, user_agent = ?, updated_at = CURRENT_TIMESTAMP
      WHERE device_id = ?`,
  ).bind(
    deviceTypeFromHeaders(request),
    platformFromRequest(request),
    browserFromUa(userAgent),
    userAgent || null,
    deviceId,
  ).run();
}
