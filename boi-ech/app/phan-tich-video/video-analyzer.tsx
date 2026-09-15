"use client";

import CameraGuidancePanel from "./camera-guidance-panel";
import PhaseCycleAnalyzer from "./phase-cycle-analyzer";
import PreflightEnforcementPanel from "./preflight-enforcement-panel";
import VideoAnalyzerImpl from "./video-analyzer-impl";

export default function VideoAnalyzer({ lessonNumber = "03" }: { lessonNumber?: string }) {
  return (
    <div data-breaststroke-vision>
      <VideoAnalyzerImpl lessonNumber={lessonNumber} />
      <CameraGuidancePanel />
      <PreflightEnforcementPanel />
      <PhaseCycleAnalyzer />
    </div>
  );
}
