"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * UI-only event inbox for manually refreshed Bơi Ếch administration screens.
 * Stores only opaque event identifiers (no names, account secrets or payloads).
 * Incoming notices NEVER start network requests or authorize any mutation.
 */
const channelName = "boiech-manual-sync-notices";
const pingKey = "boiech-manual-sync-notice-ping-v1";
const signalName = "boi:manual-sync:notice";
type Notice = { id: string; scope: string; at: number };
const maxNotices = 199;
const validId = (id:unknown) => typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id);
const storageKey = (scope:string) => "boiech-manual-sync-inbox-v1:" + scope;

function read(scope:string): Notice[] {
  try {
    const raw=sessionStorage.getItem(storageKey(scope));
    const value:unknown=raw?JSON.parse(raw):[];
    if(!Array.isArray(value))return [];
    return value.filter((entry):entry is Notice=>{
      if(!entry||typeof entry!=="object")return false;
      const n=entry as Partial<Notice>;
      return validId(n.id)&&n.scope===scope&&typeof n.at==="number"&&Number.isFinite(n.at);
    }).slice(-maxNotices);
  } catch { return []; }
}
function store(scope:string, entries:Notice[]) {
  try { sessionStorage.setItem(storageKey(scope),JSON.stringify(entries.slice(-maxNotices))); }
  catch { /* Storage may be disabled; the count still works for this mounted tab. */ }
}
const scopeValid=(scope:string)=>/^(owner|manager:acc_[a-f0-9]{64})$/.test(scope);

export function broadcastBoiChange(scope:string) {
  if(typeof window==="undefined"||!scopeValid(scope))return;
  const event:Notice={id:crypto.randomUUID(),scope,at:Date.now()};
  // Only OTHER tabs need a notice: this tab already received the verified write.
  try { const ch=new BroadcastChannel(channelName);ch.postMessage(event);ch.close(); }
  catch { /* A localStorage event is the fallback. */ }
  try {localStorage.setItem(pingKey,JSON.stringify(event));}catch{ /* no cross-tab transport */ }
}

/** Do not treat the number as a server-wide queue count: it counts actual notices received here. */
export function useBoiSyncNotices(scope:string) {
  const [ids,setIds]=useState<string[]>([]);
  useEffect(()=>{
    if(!scopeValid(scope))return;
    let live=true;
    const syncFromStorage=()=>{if(live)setIds(read(scope).map(item=>item.id));};
    const receive=(value:unknown)=>{
      if(!live||!value||typeof value!=="object")return;
      const item=value as Partial<Notice>;
      if(!validId(item.id)||item.scope!==scope||typeof item.at!=="number"||!Number.isFinite(item.at))return;
      const existing=read(scope);
      if(existing.some(row=>row.id===item.id))return;
      store(scope,[...existing,item as Notice]);
      syncFromStorage();
    };
    const onWindow=(e:Event)=>receive((e as CustomEvent<Notice>).detail);
    const onStorage=(e:StorageEvent)=>{if(e.key===pingKey&&e.newValue){try{receive(JSON.parse(e.newValue));}catch{}}};
    const onServiceWorker=(e:MessageEvent)=>{if(e.data?.type==="boi-sync-notice")receive(e.data.notice);};
    let channel:BroadcastChannel|null=null;
    try {
      if(typeof BroadcastChannel!=="undefined"){
        channel=new BroadcastChannel(channelName);
        channel.onmessage=(event:MessageEvent)=>receive(event.data);
      }
    } catch { /* Cross-tab storage event remains available. */ }
    window.addEventListener(signalName,onWindow);
    window.addEventListener("boi:manual-sync:acknowledged",syncFromStorage);
    window.addEventListener("storage",onStorage);
    navigator.serviceWorker?.addEventListener("message",onServiceWorker);
    queueMicrotask(syncFromStorage);
    return()=>{
      live=false;
      window.removeEventListener(signalName,onWindow);
      window.removeEventListener("boi:manual-sync:acknowledged",syncFromStorage);
      window.removeEventListener("storage",onStorage);
      navigator.serviceWorker?.removeEventListener("message",onServiceWorker);
      channel?.close();
    };
  },[scope]);
  /** Clear only the notices that existed at the start of a verified manual refresh. */
  const acknowledge=useCallback((observedIds:readonly string[])=>{
    const seen=new Set(observedIds);
    store(scope,read(scope).filter(event=>!seen.has(event.id)));
    setIds(previous=>previous.filter(id=>!seen.has(id)));
    window.dispatchEvent(new CustomEvent("boi:manual-sync:acknowledged",{detail:{scope}}));
  },[scope]);
  return {count:ids.length,ids,acknowledge};
}
