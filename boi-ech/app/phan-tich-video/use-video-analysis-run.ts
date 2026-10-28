"use client";

import { useEffect, useRef } from "react";
import { createVideoAnalysisRun } from "./video-analysis-run.mjs";

type Run = ReturnType<typeof createVideoAnalysisRun>;

export function useVideoAnalysisRun() {
  const mounted = useRef(false);
  const current = useRef<Run | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      current.current?.cancel();
      current.current = null;
    };
  }, []);
  return {
    begin(video: HTMLVideoElement | null = null) {
      current.current?.cancel();
      const run = createVideoAnalysisRun(video);
      current.current = run;
      return run;
    },
    isCurrent(run: Run) { return mounted.current && current.current === run; },
    end(run: Run) {
      run.finish();
      if (!mounted.current || current.current !== run) return false;
      current.current = null;
      return true;
    },
  };
}
