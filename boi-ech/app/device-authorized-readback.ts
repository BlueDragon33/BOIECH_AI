/**
 * Resolve an authorized Account-first device after D1 metadata readback.
 *
 * registerDevice()/verifyDeviceIdentityRequest() resolve the cookie-bound
 * account through AccountService.authorize(). A subsequent raw device_access
 * read deliberately has no account_id or V2 entitlement fields. Never throw
 * away those server-authorized attributes while refreshing D1 metadata.
 *
 * The verified account identity MUST come from the server, never from client
 * request fields. Fresh D1 status/profile fields always win, so a blocked or
 * incomplete device cannot be visually promoted by this readback.
 */
export type DeviceReadbackIdentity = {
  deviceId:string;
  accountId?:string;
  accessExpiresAt:string|null;
  accessExpired:boolean;
  accessExpiringSoon:boolean;
  accessDaysRemaining:number|null;
};
export function preserveAccountDeviceReadback<T extends DeviceReadbackIdentity>(
  verified:T, fresh:T|null,
):T {
  if(!fresh)return verified;
  if(fresh.deviceId!==verified.deviceId){
    throw new Error("DEVICE_READBACK_IDENTITY_MISMATCH");
  }
  // Legacy / standalone mode has no trusted account identity to carry over.
  if(!verified.accountId)return fresh;
  return {
    ...fresh,
    accountId:verified.accountId,
    // V2 entitlement has already been checked by AccountService.authorize().
    // The raw device_access expiry is retired and must not re-block the user.
    accessExpiresAt:verified.accessExpiresAt,
    accessExpired:verified.accessExpired,
    accessExpiringSoon:verified.accessExpiringSoon,
    accessDaysRemaining:verified.accessDaysRemaining,
  };
}
