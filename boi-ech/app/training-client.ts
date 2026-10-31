import type {TrainingBoard} from "./training-types";
export type TrainingProof={deviceId:string;challenge:string;signature:string};
export type TrainingWindow={from:string;to:string};
export function createTrainingClient(getProof:(signal?:AbortSignal)=>Promise<TrainingProof>){
 let lastIntent="",lastCommand="";
 async function request(payload:Record<string,unknown>,external?:AbortSignal):Promise<TrainingBoard>{
  const controller=new AbortController();const cancel=()=>controller.abort();
  external?.addEventListener("abort",cancel,{once:true});if(external?.aborted)controller.abort();
  const timer=setTimeout(cancel,15_000);
  try{
   const proof=await getProof(controller.signal);controller.signal.throwIfAborted();
   const response=await fetch("/api/training-management",{method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,headers:{"content-type":"application/json"},body:JSON.stringify({...payload,...proof})});
   const data=await response.json() as {board?:TrainingBoard;error?:string};
   controller.signal.throwIfAborted();
   if(!response.ok||!data.board)throw new Error(data.error||"Không tải được dữ liệu điều phối.");
   return data.board;
  }catch(error){if(controller.signal.aborted)throw new Error("Kết nối quá thời gian hoặc đã hủy. Bản nháp được giữ; đồng bộ trước khi thử lại.");throw error;}
  finally{clearTimeout(timer);external?.removeEventListener("abort",cancel);}
 }
 return {read:(window:TrainingWindow,signal?:AbortSignal)=>request({action:"list",...window},signal),mutate:(payload:Record<string,unknown>,window:TrainingWindow)=>{
  const intent=JSON.stringify(payload,Object.keys(payload).sort());
  if(intent!==lastIntent){lastIntent=intent;lastCommand=crypto.randomUUID();}
  const commandId=lastCommand;
  return request({...payload,...window,commandId}).then(board=>{
   if(lastCommand===commandId){lastIntent="";lastCommand="";}
   return board;
  });
 }};
}
