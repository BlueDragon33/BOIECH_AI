export type TeacherPlanWindow = {start: number; end: number};
export type TeacherPlanClass = {
  classId: string;
  missing: number;
  windows: TeacherPlanWindow[];
  candidates: {teacherId: string; currentLoad: number; maxLoad: number}[];
};
export type TeacherPlan = {
  assignments: {classId: string; teacherId: string}[];
  positionsNeeded: number;
  searchComplete: boolean;
  visitedNodes: number;
};

/** Bounded search over the loaded, scoped schedule. Maximizes covered positions. */
export function planTeacherCoverage(classes: TeacherPlanClass[], nodeLimit = 12000): TeacherPlan {
  const positionsNeeded = classes.reduce((sum, item) => sum + item.missing, 0);
  const ordered = classes.filter(item => item.windows.length && item.candidates.length)
    .slice().sort((a, b) => a.candidates.length - b.candidates.length || a.classId.localeCompare(b.classId));
  const slots = ordered.flatMap(item => Array.from({length: Math.min(item.missing, item.candidates.length)}, () => item));
  const scopedSlots = slots.slice(0, 100);
  const selected: TeacherPlan["assignments"] = [];
  const windows = new Map<string, TeacherPlanWindow[]>();
  const addedLoad = new Map<string, number>();
  let best: TeacherPlan["assignments"] = [];
  let visitedNodes = 0;
  const budget = Math.max(1, Math.min(12000, Math.floor(nodeLimit) || 1));
  let exhausted = false;

  function search(index: number) {
    if (visitedNodes >= budget) { exhausted = true; return; }
    visitedNodes++;
    if (selected.length > best.length) best = selected.slice();
    // The first full solution respects deterministic load preferences. A tie
    // does not prove workload optimality and is deliberately not labelled so.
    if (index === scopedSlots.length || selected.length + scopedSlots.length - index <= best.length) return;
    const item = scopedSlots[index];
    const candidates = item.candidates.slice().sort((a, b) =>
      a.currentLoad + (addedLoad.get(a.teacherId) ?? 0) - b.currentLoad - (addedLoad.get(b.teacherId) ?? 0)
      || a.teacherId.localeCompare(b.teacherId));
    for (const candidate of candidates) {
      const load = addedLoad.get(candidate.teacherId) ?? 0;
      const prior = windows.get(candidate.teacherId) ?? [];
      const overlaps = item.windows.some(next => prior.some(old => next.start < old.end && old.start < next.end));
      if (candidate.currentLoad + load >= candidate.maxLoad || overlaps) continue;
      windows.set(candidate.teacherId, [...prior, ...item.windows]);
      addedLoad.set(candidate.teacherId, load + 1);
      selected.push({classId: item.classId, teacherId: candidate.teacherId});
      search(index + 1);
      selected.pop();
      windows.set(candidate.teacherId, prior);
      addedLoad.set(candidate.teacherId, load);
      if (exhausted || best.length === scopedSlots.length) break;
    }
    if (!exhausted && best.length < scopedSlots.length) search(index + 1);
  }
  search(0);
  return {assignments: best, positionsNeeded, searchComplete: !exhausted && scopedSlots.length === slots.length, visitedNodes};
}
