"use client";

import { useEffect } from "react";
import { readPendingSync } from "./verified-sync-client";

/**
 * Event-only observer. It reads the durable IndexedDB queue and updates numeric
 * badges. It NEVER calls /api/accounts/sync, flushVerifiedSync, or any write.
 * Network synchronization requires an explicit button click.
 */
export default function ConditionalSyncAgent({ accountId }: { accountId: string }) {
  useEffect(() => {
    let active = true;
    let generation = 0;
    const recount = () => {
      const request = ++generation;
      void readPendingSync(accountId).then(({pending,conflicts}) => {
        if(active && request === generation){
          window.dispatchEvent(new CustomEvent("boi:sync:queue-count",{
            detail:{accountId,pending,conflicts},
          }));
        }
      }).catch(() => {
        // Unknown queue state must not be presented as zero events.
        if(active && request === generation){
          window.dispatchEvent(new CustomEvent("boi:sync:queue-unavailable",{detail:{accountId}}));
        }
      });
    };
    const onLocal = (event:Event)=>{
      if((event as CustomEvent<{accountId?:string}>).detail?.accountId===accountId)recount();
    };
    const onRemote = (event:MessageEvent)=>{
      if(event.data?.accountId===accountId && event.data?.type==="queued")recount();
    };
    const onResume=()=>{if(!document.hidden)recount();};
    window.addEventListener("boi:sync:queued",onLocal);
    window.addEventListener("boi:sync:completed",onLocal);
    window.addEventListener("focus",onResume);
    document.addEventListener("visibilitychange",onResume);
    let channel:BroadcastChannel|null=null;
    try{
      if(typeof BroadcastChannel!=="undefined"){
        channel=new BroadcastChannel("boiech-verified-sync");
        channel.onmessage=onRemote;
      }
    }catch{ /* Local events and manual refresh still work. */ }
    recount(); // local read on mount, no polling and no server request
    return()=>{
      active=false;
      window.removeEventListener("boi:sync:queued",onLocal);
      window.removeEventListener("boi:sync:completed",onLocal);
      window.removeEventListener("focus",onResume);
      document.removeEventListener("visibilitychange",onResume);
      channel?.close();
    };
  },[accountId]);
  return null;
}
