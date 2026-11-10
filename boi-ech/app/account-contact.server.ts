import { AccountError } from "./account-core.server";

// Self-declared contact. Neither this check nor knowing the value proves ownership.
export type ContactKind = "email" | "phone";
export function normalizeRegistrationContact(kind: unknown, raw: unknown) {
  if (kind !== "email" && kind !== "phone") throw new AccountError("ACCOUNT_CONTACT_INVALID",400);
  if (typeof raw !== "string" || !raw.trim() || /[\x00-\x1f\x7f]/.test(raw)) {
    throw new AccountError("ACCOUNT_CONTACT_INVALID",400);
  }
  const candidate=raw.trim().normalize("NFC");
  if (kind === "email") {
    const value=candidate.toLowerCase();
    if(value.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      || /[<>(),;:]/.test(value)) throw new AccountError("ACCOUNT_CONTACT_INVALID",400);
    return {kind,value};
  }
  const value=candidate.replace(/[\s().-]/g,"");
  if(!/^\+?[0-9]{7,16}$/.test(value) || value.length>17) throw new AccountError("ACCOUNT_CONTACT_INVALID",400);
  return {kind,value};
}
