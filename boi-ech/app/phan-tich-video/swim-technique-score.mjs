/**
 * Heuristic, local-only form score. Accept/reject eligibility is decided separately.
 * High pose confidence is NOT high swimming-skill confidence.
 * These preliminary thresholds must be calibrated with coach-labeled real video.
 */
export const LOW_SWIM_SCORE_BELOW=50; // 0–100 internal points; below 5/10 triggers the prompt.
const cap=(value)=>Math.max(0,Math.min(100,Number.isFinite(value)?value:0));
const signal=(value,lower,upper)=>Math.round(cap(100*(Number(value)-lower)/(upper-lower)));
/**
 * @param {{legs:number;arms:number;coordination:number;bodyLine:number}} baseline
 * @param {{kneeExcursion:number;armExcursion:number;movingRatio:number;horizontalRatio:number}} evidence
 * @param {"side"|"rear"} view
 */
export function scoreSwimmingTechnique(baseline,evidence,view){
 // Don't award perfect technique merely because no >threshold error was detected.
 // A novice doing incomplete arm/leg actions should receive a low but valid score.
 const legs=Math.min(cap(baseline.legs),signal(evidence.kneeExcursion,6,55));
 const arms=Math.min(cap(baseline.arms),signal(evidence.armExcursion,8,65));
 const coordination=Math.min(cap(baseline.coordination),signal(evidence.movingRatio,8,52));
 // Body orientation is only meaningful from the side; don't apply this penalty rear-on.
 const bodyLine=view==="side"
  ?Math.min(cap(baseline.bodyLine),signal(evidence.horizontalRatio,28,75))
  :cap(baseline.bodyLine);
 const categories={legs,arms,coordination,bodyLine};
 const score=Math.round(legs*.35+arms*.2+coordination*.3+bodyLine*.15);
 return {categories,score,needsLearningCheck:score<LOW_SWIM_SCORE_BELOW};
}
