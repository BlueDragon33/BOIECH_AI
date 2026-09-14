"use client";

import PhaseCycleAnalyzer from "./phase-cycle-analyzer";
import VideoAnalyzerImpl from "./video-analyzer-impl";

export default function VideoAnalyzer({ lessonNumber = "03" }: { lessonNumber?: string }) {
  return (
    <div data-breaststroke-vision>
      <VideoAnalyzerImpl lessonNumber={lessonNumber} />
      <PhaseCycleAnalyzer />
    </div>
  );
}
