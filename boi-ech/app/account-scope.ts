// Once protected modules mount, a document must never point at another person's local database.
export function accountTransitionNeedsReload(currentAccountId: string, nextAccountId: string) {
  return Boolean(currentAccountId && currentAccountId !== nextAccountId);
}

/** Only skip an IndexedDB setup after this same document has completed it.
 * A claim is never skipped because it may have to import an old local vault. */
export function mayReusePreparedAccountScope(existing: string | undefined, requested: string, claim: boolean) {
  return !claim && existing === requested;
}
