import {summarizeGroundTruth,GROUND_TRUTH_PHASES} from "../app/phan-tich-video/phase-ground-truth.mjs";

const VIEWS=new Set(["front","side","rear"]);
const LIGHTS=new Set(["bright","indoor","low"]);
const PHASES=new Set([...GROUND_TRUTH_PHASES,"unclear"]);
const allowedTop=new Set(["schema","clips"]);
const allowedClip=new Set(["id","cameraView","lighting","engineVersion","frames","labelsByTime","reviewedByRef"]);
const allowedFrame=new Set(["time","phase","armFlexion","kneeFlexion","wristSpread","ankleSpread","visibility"]);
const record=(value)=>value&&typeof value==="object"&&!Array.isArray(value);
function requireExactKeys(value,keys,scope){
 if(!record(value)||Object.keys(value).some(k=>!keys.has(k)))
  throw new Error(scope+": unexpected field (no PII or raw media allowed)");
}
export function evaluateLocalVideoCorpus(input,{minClips=5,minPerPhase=20}={}){
 requireExactKeys(input,allowedTop,"Manifest");
 if(input.schema!=="boi-ech-local-groundtruth/v1"||!Array.isArray(input.clips)||
  input.clips.length===0||input.clips.length>200)throw new Error("Invalid corpus schema or bounded clip count");
 if(!Number.isSafeInteger(minClips)||minClips<1||
  !Number.isSafeInteger(minPerPhase)||minPerPhase<1)throw new Error("Invalid evidence thresholds");
 const perPhase=Object.fromEntries(GROUND_TRUTH_PHASES.map(x=>[x,{truth:0,predicted:0,correct:0,clips:0}]));
 const results=[],ids=new Set();
 for(const clip of input.clips){
  requireExactKeys(clip,allowedClip,"Clip");
  if(!/^clip-[a-z0-9_-]{6,40}$/.test(clip.id)||ids.has(clip.id)||
     !VIEWS.has(clip.cameraView)||!LIGHTS.has(clip.lighting)||
     typeof clip.engineVersion!=="string"||!/^[a-z0-9._-]{2,80}$/.test(clip.engineVersion)||
     typeof clip.reviewedByRef!=="string"||!/^[A-Za-z0-9._:-]{8,80}$/.test(clip.reviewedByRef))
   throw new Error("Invalid anonymous provenance/view/engine or repeated clip ID");
  ids.add(clip.id);
  if(!Array.isArray(clip.frames)||clip.frames.length<1||clip.frames.length>6000||
    !record(clip.labelsByTime)||Object.keys(clip.labelsByTime).length>6000)
   throw new Error("Invalid bounded frames or labels");
  let previous=-Infinity;
  for(const frame of clip.frames){
   requireExactKeys(frame,allowedFrame,"Frame");
   if(!Number.isFinite(frame.time)||frame.time<0||frame.time<=previous||
      !PHASES.has(frame.phase))throw new Error("Invalid frame time order or phase");
   previous=frame.time;
  }
  const times=new Set(clip.frames.map(x=>Number(x.time).toFixed(3)));
  if(Object.entries(clip.labelsByTime).some(([k,v])=>!times.has(k)||
   !GROUND_TRUTH_PHASES.includes(v)))throw new Error("Unmatched or invalid labeled frame");
  const report=summarizeGroundTruth(clip.frames,clip.labelsByTime);
  for(const phase of GROUND_TRUTH_PHASES){
   const entries=report.phaseMetrics[phase];
   perPhase[phase].truth+=entries.annotated;
   perPhase[phase].correct+=entries.correct;
   perPhase[phase].predicted+=report.annotations.filter(a=>a.aiPhase===phase).length;
   if(entries.annotated)perPhase[phase].clips++;
  }
  results.push({id:clip.id,cameraView:clip.cameraView,lighting:clip.lighting,
    engineVersion:clip.engineVersion,annotated:report.annotated,
    labelCoverage:report.labelCoverage,abstained:report.abstained,
    macroF1:report.macroF1,transitions:report.transitions});
 }
 const phases=Object.fromEntries(GROUND_TRUTH_PHASES.map(phase=>{
  const p=perPhase[phase];
  const enough=p.truth>=minPerPhase&&p.clips>=Math.min(3,minClips);
  return [phase,{labeled:p.truth,clips:p.clips,
    f1:enough&&p.truth+p.predicted>0?2*p.correct/(p.truth+p.predicted):null,
    evidenceStatus:enough?"coverage-met":"insufficient-evidence"}];
 }));
 const covered=results.length>=minClips&&Object.values(phases).every(x=>x.evidenceStatus==="coverage-met");
 return {schema:"boi-ech-video-corpus-report/v1",clipCount:results.length,phases,clips:results,
  evidenceStatus:covered?"REVIEW_REQUIRED":"INSUFFICIENT_DATA",
  independentHumanValidation:"NOT_VERIFIED",
  limitations:[
   "Chỉ thống kê nhãn trong tệp cục bộ; không chứng minh nhãn do chuyên gia độc lập tạo ra.",
   "Không có video gốc, danh tính, ảnh, token hay dữ liệu cá nhân trong báo cáo.",
   "Không tự thay ngưỡng AI, không chấm chứng chỉ hoặc khẳng định độ chính xác thực địa."
  ]};
}
