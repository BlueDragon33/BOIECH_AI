import { accountConfiguration, accountErrorResponse } from "../../../account-runtime.server";
import { DeviceAccessError, getCourseDatabase } from "../../../device-auth.server";
import { controlPreflight, controlResponse, requireControlService, withControlCors } from "../../../control-auth.server";

export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) { return controlPreflight(request); }

/**
 * boi-account-summary.v2: read-only, aggregate-only handshake for the
 * Application-Management Bơi Ếch module. Never return account/device rows.
 * It deliberately does not implement legacy payment or device operations.
 */
export async function GET(request: Request) {
  try {
    if (!/^Bearer\s+\S+$/.test(request.headers.get("authorization") ?? "")) {
      throw new DeviceAccessError("Cần vé quản trị hợp lệ.", 401, "CONTROL_AUTH_REQUIRED");
    }
    const caller = await requireControlService(request);
    if (caller.role !== "owner" && caller.role !== "publisher") {
      throw new DeviceAccessError("Chỉ Owner/Publisher được xem tổng hợp tài khoản.", 403, "ACCOUNT_SUMMARY_FORBIDDEN");
    }
    if (!(await accountConfiguration()).v2) {
      throw new DeviceAccessError("Account-first V2 chưa sẵn sàng.", 409, "ACCOUNT_V2_REQUIRED");
    }

    const asOf = new Date().toISOString();
    const db = await getCourseDatabase();
    // Only PKs, workflow stage and entitlement state/expiry participate in
    // aggregation; no names, phone, person codes, device keys or payment data.
    const row = await db.prepare(`
      SELECT COUNT(*) AS total_accounts,
        COALESCE(SUM(CASE WHEN o.stage IN
          ('requested','profile_required','profile_review','changes_requested')
          THEN 1 ELSE 0 END), 0) AS pending,
        COALESCE(SUM(CASE WHEN o.stage='active' AND e.state='active'
          AND e.expires_at > ? THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN o.stage='suspended' OR e.state='suspended'
          THEN 1 ELSE 0 END), 0) AS suspended,
        COALESCE(SUM(CASE WHEN e.state='active' AND e.expires_at <= ?
          THEN 1 ELSE 0 END), 0) AS expired,
        COALESCE(SUM(CASE WHEN o.stage IS NULL OR o.stage='legacy_hold'
          OR e.account_id IS NULL THEN 1 ELSE 0 END), 0) AS unverified
      FROM accounts a
      LEFT JOIN account_onboarding o ON o.account_id=a.account_id
      LEFT JOIN account_entitlements e ON e.account_id=a.account_id
    `).bind(asOf, asOf).first<{
      total_accounts: number; pending: number; active: number;
      suspended: number; expired: number; unverified: number;
    }>();
    if (!row) throw new DeviceAccessError("Không xác minh được tổng hợp tài khoản.", 503, "ACCOUNT_SUMMARY_UNAVAILABLE");
    const safe = (value: number) => Number.isSafeInteger(value) && value >= 0;
    const counts = {
      totalAccounts: row.total_accounts,
      pending: row.pending,
      active: row.active,
      suspended: row.suspended,
      expired: row.expired,
      unverified: row.unverified,
    };
    if (!Object.values(counts).every(safe) ||
        Object.entries(counts).some(([name, value]) => name !== "totalAccounts" && value > counts.totalAccounts)) {
      throw new DeviceAccessError("Tổng hợp tài khoản không hợp lệ.", 503, "ACCOUNT_SUMMARY_UNAVAILABLE");
    }
    return controlResponse({
      contract: "boi-account-summary.v2",
      verified: true,
      asOf,
      counts,
    }, 200, request);
  } catch (error) {
    return withControlCors(request, accountErrorResponse(error));
  }
}
