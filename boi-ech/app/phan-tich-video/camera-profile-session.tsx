"use client";

import { useSyncExternalStore } from "react";
import { ANALYSIS_VIEW_OPTIONS, viewProfile } from "./phase-view-profile.mjs";

type CameraView = "" | "side" | "rear" | "front-oblique";

let currentView: CameraView = "";
const listeners = new Set<() => void>();
const allowedViews = new Set<CameraView>(ANALYSIS_VIEW_OPTIONS.map((item: { value: CameraView }) => item.value));

function emit() {
  for (const listener of listeners) listener();
}

export function getCameraProfile() {
  return currentView;
}

export function setCameraProfile(nextView: string) {
  const normalized = allowedViews.has(nextView as CameraView) ? nextView as CameraView : "";
  if (normalized === currentView) return;
  currentView = normalized;
  emit();
}

export function subscribeCameraProfile(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCameraProfile() {
  return useSyncExternalStore(subscribeCameraProfile, getCameraProfile, () => "" as CameraView);
}

export function SharedCameraProfileControl({ compact = false }: { compact?: boolean }) {
  const view = useCameraProfile();
  const profile = viewProfile(view) as { label: string; summary: string } | null;

  return (
    <div data-shared-camera-profile-control style={{ border: "1px solid #c9d9df", borderRadius: 10, background: "#fff", padding: compact ? 8 : 10, minWidth: compact ? 220 : 260 }}>
      <label htmlFor="shared-camera-profile" style={{ display: "block", fontSize: 9, fontWeight: 900, color: "#536f79" }}>Góc quay chung cho toàn bộ phân tích</label>
      <select id="shared-camera-profile" aria-label="Góc quay chung cho toàn bộ phân tích" value={view} onChange={(event) => setCameraProfile(event.target.value)} style={{ marginTop: 5, width: "100%", border: "1px solid #cadbdd", borderRadius: 8, padding: "6px 8px", background: "#fff", fontSize: 10 }}>
        {ANALYSIS_VIEW_OPTIONS.map((item: { value: string; label: string }) => <option key={item.value || "unknown"} value={item.value}>{item.label}</option>)}
      </select>
      <span style={{ display: "block", marginTop: 4, fontSize: 8, color: view ? "#55717b" : "#806b4e", lineHeight: 1.35 }}>{profile ? `${profile.label} · ${profile.summary}` : "Chọn một lần; Coverage, Advisor, diễn giải chu kỳ và đối xứng sẽ dùng cùng profile."}</span>
    </div>
  );
}

export function SharedCameraProfileStatus() {
  const view = useCameraProfile();
  const profile = viewProfile(view) as { label: string } | null;
  return <span data-shared-camera-profile-consumer style={{ fontSize: 9, fontWeight: 800, color: view ? "#4d6c77" : "#806b4e" }}>{profile ? `Góc chung: ${profile.label}` : "Chưa chọn góc quay chung"}</span>;
}
