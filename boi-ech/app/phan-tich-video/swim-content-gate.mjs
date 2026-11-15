/**
 * Conservative local-only evidence gate for breaststroke clips.
 * Pose landmarks are not a scene classifier: "pass" means motion is plausible,
 * NEVER that the model has proved water/swimming. Human declaration is separate.
 */
// Admission establishes evaluability, not correct stroke technique.
const LIMITS=Object.freeze({minimumSamples:14,minimumCoverage:.63,minimumVisibility:.58,
 minimumMovingRatio:.08});
const clamp=(x,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(x)?x:0));
const avg=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:0;
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function angle(a,b,c){
 const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
 const d=Math.hypot(ux,uy)*Math.hypot(vx,vy);
 return d<1e-6?NaN:Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/d)))*180/Math.PI;
}
const spread=v=>v.length?Math.max(...v)-Math.min(...v):0;
const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export function inspectSwimmingEvidence(frames,sampleCount,view="side"){
 const sorted=Array.isArray(frames)?frames.filter(x=>Array.isArray(x?.landmarks)&&x.landmarks.length>=33&&Number.isFinite(x.time)).sort((a,b)=>a.time-b.time):[];
 const coverage=clamp(sorted.length/Math.max(sampleCount||0,1));
 const good=sorted.filter(frame=>(frame.visibility??0)>=LIMITS.minimumVisibility);
 const signals=good.map(frame=>{
  const p=frame.landmarks,shoulder=mid(p[11],p[12]),hip=mid(p[23],p[24]);
  const leftKnee=angle(p[23],p[25],p[27]),rightKnee=angle(p[24],p[26],p[28]);
  const leftElbow=angle(p[11],p[13],p[15]),rightElbow=angle(p[12],p[14],p[16]);
  const body=dist(shoulder,hip);
  return {time:frame.time,knee:(leftKnee+rightKnee)/2,elbow:(leftElbow+rightElbow)/2,
   hip,hand:mid(p[15],p[16]),ankle:mid(p[27],p[28]),body,
   horizontal:Math.abs(shoulder.x-hip.x)/Math.max(body,.03)};
 }).filter(s=>Number.isFinite(s.knee)&&Number.isFinite(s.elbow)&&s.body>.025);
 const kneeExcursion=spread(signals.map(s=>s.knee));
 const armExcursion=spread(signals.map(s=>s.elbow));
 const horizontalRatio=avg(signals.map(s=>s.horizontal>.64?1:0));
 const moving=signals.slice(1).map((s,i)=>{
  const prev=signals[i],scale=Math.max(.04,(s.body+prev.body)/2);
  const wristShift=Math.hypot((s.hand.x-s.hip.x)-(prev.hand.x-prev.hip.x),(s.hand.y-s.hip.y)-(prev.hand.y-prev.hip.y));
  const footShift=Math.hypot((s.ankle.x-s.hip.x)-(prev.ankle.x-prev.hip.x),(s.ankle.y-s.hip.y)-(prev.ankle.y-prev.hip.y));
  return (wristShift+footShift)/scale>.075?1:0;
 });
 const movingRatio=avg(moving);
 const issues=[];
 if(sorted.length<LIMITS.minimumSamples||coverage<LIMITS.minimumCoverage)issues.push("Không thấy rõ người bơi liên tục; hãy quay toàn thân trong ít nhất vài giây.");
 if(good.length<10||signals.length<10)issues.push("Không đủ điểm khớp tay/chân rõ để đối chiếu động tác.");
 // Incorrect angles and poor timing are graded, not rejected.
 if(movingRatio<LIMITS.minimumMovingRatio)issues.push("Không có chuyển động tay/chân đủ rõ để chấm; hãy quay lại đoạn có thao tác tập bơi.");
 const obviouslyStatic=good.length>=10&&signals.length>=10
   &&movingRatio<.04&&kneeExcursion<6&&armExcursion<7;
 const status=obviouslyStatic?"reject":issues.length?"uncertain":"plausible";
 return {status,issues,coverage:Math.round(coverage*100),observedSamples:signals.length,
  kneeExcursion:Math.round(kneeExcursion),armExcursion:Math.round(armExcursion),
  movingRatio:Math.round(movingRatio*100),horizontalRatio:Math.round(horizontalRatio*100),
  note:status==="plausible"
   ?"Đã thấy người và chuyển động để chấm, kể cả động tác bơi sai; pose chưa xác thực được môi trường nước."
   :status==="reject"?"Video gần như đứng yên, chưa đủ dấu hiệu thực hiện động tác bơi; hãy gửi đoạn có cử động tay hoặc chân."
    :"Chưa đủ dữ liệu tư thế và chuyển động để chấm công bằng. Hãy quay rõ toàn thân và thử lại."};
}
