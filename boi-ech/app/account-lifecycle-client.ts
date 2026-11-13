/** Public account metadata is *not* an authorization token: the server still
 * enforces signed sessions, trust, onboarding and entitlements on every API.
 * This helper only controls UI transitions after the GET /api/accounts readback. */
export type AccountLifecycle = {
  accountId: string;
  status: string;
  expiresAt?: string | null;
  onboardingStage?: string | null;
  deviceApproved?: boolean;
  entitlementActive?: boolean;
};
export type ObservedLifecycle = { accountId: string; active: boolean };

export function accountServerActive(account: AccountLifecycle | null | undefined, v2: boolean, now: number) {
  if (!account || account.status !== "approved") return false;
  if (account.expiresAt && (!Number.isFinite(Date.parse(account.expiresAt)) || Date.parse(account.expiresAt) <= now))
    return false;
  return !v2 || (account.onboardingStage === "active" &&
    account.deviceApproved === true && account.entitlementActive === true);
}

/** Only a server-observed transition for the same account can trigger a
 * one-time document bootstrap. New login, revoked/blocked accounts and
 * a different account never qualify. */
export function shouldAutoResumeDocument(previous: ObservedLifecycle | null,
  next: ObservedLifecycle) {
  return Boolean(previous && previous.accountId === next.accountId &&
    previous.accountId !== "" && !previous.active && next.active);
}

export function recoveryMustRemainVisible(active: boolean, recovery: string) {
  return active && recovery.length > 0;
}
