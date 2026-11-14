"use client";

import { useEffect } from "react";
import { flushVerifiedSync, readPendingSync } from "./verified-sync-client";

type Scope = "learning-progress" | "study-preferences";
type Consent = { scope: string; enabled: number };
type StatusResponse = { ok?: boolean; result?: { grants?: Consent[] } };

/**
 * No interval/polling. Only runs when actual local queued data arrives,
 * an eligible cross-tab message arrives, connectivity returns, or a tab resumes.
 * Never writes without current server consent and account/device verification.
 */
export default function ConditionalSyncAgent({ accountId }: { accountId: string }) {
  useEffect(() => {
    let active = true;
    let inFlight = false;
    let queuedWhileRunning = false;

    const flushWhenPermitted = async () => {
      if (!active || document.hidden || !navigator.onLine) return;
      if (inFlight) { queuedWhileRunning = true; return; }
      inFlight = true;
      try {
        const local = await readPendingSync(accountId);
        const pending = local.events.filter(item => item.status === "pending");
        if (!active || pending.length === 0) return;
        // No blanket sync: server consent and the selected account are mandatory.
        const response = await fetch("/api/accounts/sync", {
          method: "POST", cache: "no-store", credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "status", accountId }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok || !active) return;
        const data = await response.json() as StatusResponse;
        if (data.ok !== true) return;
        const allowedScopes = new Set<Scope>();
        for (const grant of data.result?.grants ?? []) {
          if (grant.enabled === 1 && (grant.scope === "learning-progress" || grant.scope === "study-preferences")) {
            allowedScopes.add(grant.scope);
          }
        }
        if (!pending.some(item => allowedScopes.has(item.scope))) return;
        const result = await flushVerifiedSync(accountId, undefined, allowedScopes);
        if (active && result.sent > 0) {
          window.dispatchEvent(new CustomEvent("boi:sync:completed", { detail: { accountId, sent: result.sent } }));
        }
      } catch {
        // Durable queue is retained; no blind retry loops, only the next real event.
      } finally {
        inFlight = false;
        if (queuedWhileRunning && active) {
          queuedWhileRunning = false;
          void flushWhenPermitted();
        }
      }
    };

    const localEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ accountId?: string }>).detail;
      if (detail?.accountId === accountId) void flushWhenPermitted();
    };
    const onVisibility = () => { if (!document.hidden) void flushWhenPermitted(); };
    const onResume = () => { void flushWhenPermitted(); };
    const onRemoteEvent = (event: MessageEvent) => {
      if (event.data?.type === "queued" && event.data?.accountId === accountId) void flushWhenPermitted();
    };
    const onServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "boi-ech-sync-available") void flushWhenPermitted();
    };
    window.addEventListener("boi:sync:queued", localEvent);
    window.addEventListener("boi:sync:grant-changed", localEvent);
    window.addEventListener("online", onResume);
    window.addEventListener("focus", onResume);
    window.addEventListener("pageshow", onResume);
    document.addEventListener("visibilitychange", onVisibility);
    navigator.serviceWorker?.addEventListener("message", onServiceWorkerMessage);
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("boiech-verified-sync");
        channel.onmessage = onRemoteEvent;
      }
    } catch { /* Online, focus, manual sync and local queue events remain. */ }
    // One read of the *local* durable queue on mount; no periodic server GET.
    void flushWhenPermitted();
    return () => {
      active = false;
      window.removeEventListener("boi:sync:queued", localEvent);
      window.removeEventListener("boi:sync:grant-changed", localEvent);
      window.removeEventListener("online", onResume);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("pageshow", onResume);
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker?.removeEventListener("message", onServiceWorkerMessage);
      channel?.close();
    };
  }, [accountId]);
  return null;
}
