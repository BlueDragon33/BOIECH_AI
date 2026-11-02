"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {TrainingProof} from "./training-client";
import styles from "./manager-approval-panel.module.css";

type Role="learner"|"teacher";
type ManagedDevice={
  deviceId:string;deviceCode:string;role:Role;name:string;personCode:string;
  className:string;status:"pending"|"approved"|"blocked";assignedToMe:boolean;
  registrationComplete:boolean;
};
type Board={
  managerDeviceId:string;
  quotas:{learner:{limit:number;used:number};teacher:{limit:number;used:number}};
  devices:ManagedDevice[];
};
const PREVIEW_BOARD:Board={
  managerDeviceId:"preview-only",
  quotas:{learner:{limit:50,used:1},teacher:{limit:5,used:0}},
  devices:[
    {deviceId:"demo-learner-1",deviceCode:"DEMO-HV-001",role:"learner",name:"Học viên mẫu",
      personCode:"HV-MAU-01",className:"Lớp mẫu",status:"pending",assignedToMe:false,registrationComplete:true},
    {deviceId:"demo-teacher-1",deviceCode:"DEMO-GV-001",role:"teacher",name:"Giảng viên mẫu",
      personCode:"GV-MAU-01",className:"Lớp mẫu",status:"pending",assignedToMe:false,registrationComplete:true},
    {deviceId:"demo-learner-2",deviceCode:"DEMO-HV-002",role:"learner",name:"Học viên đã duyệt",
      personCode:"HV-MAU-02",className:"Lớp mẫu",status:"approved",assignedToMe:true,registrationComplete:true}
  ]
};
export default function ManagerApprovalPanel({getProof,previewOnly=false}:{getProof?:(signal?:AbortSignal)=>Promise<TrainingProof>;previewOnly?:boolean}){
  const [board,setBoard]=useState<Board|null>(previewOnly?PREVIEW_BOARD:null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState(false);
  const lock=useRef(false);
  const request=useCallback(async(action:"list"|"approve"|"block",targetDeviceId?:string,signal?:AbortSignal)=>{
    if(previewOnly || !getProof)throw new Error("Chế độ xem thử không thể gọi API ghi hoặc đọc D1.");
    const controller=new AbortController();
    const abort=()=>controller.abort();
    signal?.addEventListener("abort",abort,{once:true});
    if(signal?.aborted)controller.abort();
    const timer=setTimeout(abort,20000);
    try{
      const proof=await getProof(controller.signal);
      const response=await fetch("/api/manager/device-approvals",{
        method:"POST",credentials:"same-origin",cache:"no-store",signal:controller.signal,
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,targetDeviceId,...proof})
      });
      const data=await response.json() as {ok?:boolean;board?:Board;error?:string;code?:string};
      if(!response.ok||data.ok!==true||!data.board)throw new Error(data.error||data.code||"Không xác minh được dữ liệu xét duyệt.");
      return data.board;
    }finally{
      clearTimeout(timer);
      signal?.removeEventListener("abort",abort);
    }
  },[getProof,previewOnly]);
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    if(previewOnly){setNotice("Đang xem thử: không truy cập hệ thống chung và không thay đổi dữ liệu.");return;}
    if(lock.current)return;
    lock.current=true;setBusy(true);setError(false);setNotice("");
    try{setBoard(await request("list",undefined,signal));}
    catch(e){if(!signal?.aborted){setError(true);setNotice(e instanceof Error?e.message:"Không tải được danh sách.");}}
    finally{lock.current=false;if(!signal?.aborted)setBusy(false);}
  },[request,previewOnly]);
  useEffect(()=>{
    if(previewOnly)return;
    const controller=new AbortController();
    queueMicrotask(()=>{if(!controller.signal.aborted)void refresh(controller.signal);});
    return()=>controller.abort();
  },[refresh,previewOnly]);
  async function decide(action:"approve"|"block",device:ManagedDevice){
    if(previewOnly){setNotice("CHẾ ĐỘ TEST: thao tác minh họa bị vô hiệu hóa, không ghi dữ liệu hệ thống chung.");return;}
    if(lock.current)return;
    if(action==="block"&&!window.confirm("Khóa thiết bị "+device.deviceCode+" đang được bạn quản lý?"))return;
    lock.current=true;setBusy(true);setError(false);setNotice("");
    try{
      const next=await request(action,device.deviceId);
      const verified=next.devices.find(d=>d.deviceId===device.deviceId);
      if(!verified||!verified.assignedToMe||verified.status!==(action==="approve"?"approved":"blocked"))
        throw new Error("Chưa xác minh trạng thái thiết bị sau thao tác. Đồng bộ lại trước khi tiếp tục.");
      setBoard(next);
      setNotice(action==="approve"?"Đã duyệt và đọc lại D1 của ứng dụng Bơi Ếch.":"Đã khóa và đọc lại D1 của ứng dụng Bơi Ếch.");
    }catch(e){
      setError(true);setNotice(e instanceof Error?e.message:"Thao tác chưa được xác minh.");
    }finally{lock.current=false;setBusy(false);}
  }
  const queued=board?.devices.filter(d=>d.status==="pending"&&!d.assignedToMe)??[];
  const owned=board?.devices.filter(d=>d.assignedToMe)??[];
  return <section className={styles.root} aria-label="Duyệt thiết bị học viên và giảng viên">
    {previewOnly?<p role="status" className={styles.notice}><strong>CHẾ ĐỘ XEM THỬ — DỮ LIỆU MẪU, KHÔNG CÓ QUYỀN GHI</strong></p>:null}
    <header className={styles.head}>
      <div><h2>Kiểm duyệt thiết bị</h2><p>Chỉ cán bộ quản lý đã được Chủ hệ thống cấp quyền mới có thể duyệt hồ sơ học viên và giảng viên.</p></div>
      <button type="button" onClick={()=>void refresh()} disabled={busy||previewOnly}>{previewOnly?"Không kết nối D1":"Đồng bộ LIVE"}</button>
    </header>
    {board?<div className={styles.quotas}>
      <p><strong>Học viên: {board.quotas.learner.used}/{board.quotas.learner.limit}</strong><span>Số hồ sơ đã duyệt</span></p>
      <p><strong>Giảng viên: {board.quotas.teacher.used}/{board.quotas.teacher.limit}</strong><span>Số hồ sơ đã duyệt</span></p>
      <p><strong>Đang chờ: {queued.length}</strong><span>Hồ sơ chưa nhận quản lý</span></p>
    </div>:null}
    {notice?<p role={error?"alert":"status"} className={error?styles.error:styles.notice}>{notice}</p>:null}
    {!board?<p>{busy?"Đang xác minh quyền và D1…":"Chưa có dữ liệu LIVE. Chọn Đồng bộ LIVE."}</p>:null}
    {board?<div className={styles.groups}>
      <section><h3>Chờ cán bộ xét duyệt</h3>
        {queued.map(device=><article key={device.deviceId} className={styles.device}>
          <div><strong>{device.name} · {device.role==="teacher"?"Giảng viên":"Học viên"}</strong>
            <small>{device.deviceCode} · {device.personCode} · {device.className}</small></div>
          <button type="button" disabled={busy||previewOnly||board.quotas[device.role].used>=board.quotas[device.role].limit||
            !device.registrationComplete} onClick={()=>void decide("approve",device)}>Duyệt thiết bị</button>
        </article>)}
        {!queued.length?<p>Không có hồ sơ chờ duyệt được xác minh.</p>:null}
      </section>
      <section><h3>Đã nhận quản lý</h3>
        {owned.map(device=><article key={device.deviceId} className={styles.device}>
          <div><strong>{device.name} · {device.role==="teacher"?"Giảng viên":"Học viên"}</strong>
            <small>{device.deviceCode} · {device.status==="approved"?"Đã duyệt":"Đã khóa"}</small></div>
          {device.status==="approved"?<button type="button" disabled={busy||previewOnly}
            onClick={()=>void decide("block",device)}>Khóa</button>:null}
        </article>)}
        {!owned.length?<p>Chưa duyệt thiết bị nào.</p>:null}
      </section>
    </div>:null}
    <p className={styles.info}>Hạn mức mặc định chung cho toàn bộ cấp cán bộ quản lý: 50 học viên và 5 giảng viên (không nhân theo số cán bộ). Chủ hệ thống có thể chỉnh. {previewOnly?"Toàn bộ nội dung đang hiển thị là minh họa, không đọc hoặc ghi D1.":"Thiết bị bị khóa thủ công không tự mở lại."}</p>
  </section>;
}
