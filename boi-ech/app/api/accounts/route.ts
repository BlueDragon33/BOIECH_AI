import { AccountError } from "../../account-core.server";
import { accountRequest, accountErrorResponse, sessionCookie } from "../../account-runtime.server";
import { createDeviceChallenge, verifyDeviceIdentityRequest } from "../../device-auth.server";
export const dynamic = "force-dynamic";
const json = (data: unknown, cookie?: string) => Response.json(data, { headers: { "cache-control": "no-store, private",
  "x-content-type-options": "nosniff", ...(cookie ? { "set-cookie": cookie } : {}) } });
export async function GET(request: Request) {
  try { const { service, token } = await accountRequest(request);
    if (!token) return json({ enabled: true, account: null });
    const account = await service.session(token);
    let canReadRegistrants=false;
    if(account.role==="manager"&&account.status==="approved") {
      try { await service.capability(account,"registrants.read.all"); canReadRegistrants=true; }
      catch(error) { if(!(error instanceof AccountError)||error.code!=="ACCOUNT_PERMISSION_REQUIRED") throw error; }
    }
    // Only public account fields leave the server, never the principal/session hash.
    return json({ enabled: true, account: { accountId: account.accountId, status: account.status, role: account.role,
      name: account.name, storageDeviceId: account.storageDeviceId, expiresAt: account.expiresAt, canReadRegistrants }, devices: await service.devices(token) });
  } catch (error) { return accountErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const { service, token } = await accountRequest(request);
    const raw = await request.text();
    if (raw.length > 16384) throw new AccountError("ACCOUNT_INPUT", 413);
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || Array.isArray(p) || typeof p !== "object") throw new AccountError("ACCOUNT_INPUT", 400);
    // Peer identity is supplied by the trusted edge; never accept an arbitrary payload identity.
    const peer = request.headers.get("cf-connecting-ip") ?? "unavailable-edge-peer";
    if (p.action === "legacy-challenge") return json(await createDeviceChallenge(p.deviceId, true));
    if (p.action === "register" || p.action === "login" || p.action === "claim") {
      let legacyId: string | null = null;
      if (p.action === "claim") {
        // This dedicated proof path MUST retain original P-256 verification even in account mode.
        const device = await verifyDeviceIdentityRequest(p, false, true);
        legacyId = device.deviceId;
      }
      const result = p.action === "register" ? await service.register(p, peer) : p.action === "login" ? await service.login(p, peer) : await service.claim(p, legacyId, peer);
      const { token: session, ...safe } = result;
      return json({ ok: true, ...safe }, sessionCookie(session));
    }
    if (p.action === "rotate") { const result = await service.rotate(token); return json({ ok: true }, sessionCookie(result.token)); }
    if (p.action === "recover") return json({ ok: true, ...await service.recover(p, peer) }, sessionCookie(""));
    if (p.action === "logout") { if (token) await service.logout(token); return json({ ok: true }, sessionCookie("")); }
    if (p.action === "revoke-device") { await service.revokeDevice(token, p.deviceId); return json({ ok: true }); }
    if (p.action === "review-list") return json({ board: await service.reviewBoard(token) });
    if (p.action === "review") return json({ account: await service.review(token, String(p.accountId), String(p.operation)) });
    if (p.action === "read-registrants") return json(await service.readRegistrants(token, p.purpose, Number(p.offset ?? 0), Number(p.limit ?? 50)));
    throw new AccountError("ACCOUNT_INPUT", 400);
  } catch (error) { return accountErrorResponse(error); }
}
