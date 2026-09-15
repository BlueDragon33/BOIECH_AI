"use client";

import CameraGuidancePanel from "./camera-guidance-panel";
import CrossModuleConsistencyPanel from "./cross-module-consistency-panel";
import EvidenceTracePanel from "./evidence-trace-panel";
import PhaseCycleAnalyzer from "./phase-cycle-analyzer";
import PreflightEnforcementPanel from "./preflight-enforcement-panel";
import TrustAwareInterpretationPanel from "./trust-aware-interpretation-panel";
import UnifiedTrustPanel from "./unified-trust-panel";
import VideoAnalyzerImpl from "./video-analyzer-impl";

export default function VideoAnalyzer({ lessonNumber = "03" }: { lessonNumber?: string }) {
  return (
    <div data-breaststroke-vision>
      <VideoAnalyzerImpl lessonNumber={lessonNumber} />
      <CameraGuidancePanel />
      <PreflightEnforcementPanel />
      <UnifiedTrustPanel />
      <TrustAwareInterpretationPanel />
      <PhaseCycleAnalyzer />
      <EvidenceTracePanel />
      <CrossModuleConsistencyPanel />
    </div>
  );
}
