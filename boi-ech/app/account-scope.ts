// Once protected modules mount, a document must never point at another person's local database.
export function accountTransitionNeedsReload(currentAccountId: string, nextAccountId: string) {
  return Boolean(currentAccountId && currentAccountId !== nextAccountId);
}
