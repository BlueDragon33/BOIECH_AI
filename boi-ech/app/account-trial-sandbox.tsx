"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import styles from "./account-trial-sandbox.module.css";

export type TrialLease = {
  state:"available"|"active"|"expired";
  role:"learner"|"teacher"|"manager";
  serverNowMs:number;
  startedAtMs:number|null;
  expiresAtMs:number|null;
};
type Props={lease:TrialLease;onExit:()=>void;onExpired:()=>void};
const navigation={
  manager:[["overview","Tổng quan"],["approval","Kiểm duyệt"],["facility","Cơ sở / Lớp"],["people","Nhân sự"],["security","Bảo mật"]],
  teacher:[["overview","Trang chủ"],["lesson","Bài giảng"],["schedule","Ca dạy"],["analysis","AI / Video"],["security","Bảo mật"]],
  learner:[["overview","Trang chủ"],["lesson","Bài học"],["practice","Luyện tập"],["analysis","AI / Video"],["security","Bảo mật"]],
} as const;
const sec=(value:number)=>Math.max(0,Math.ceil(value/1000));
function formatRemaining(value:number){
  const seconds=sec(value),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);
  return `${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
}
export default function AccountTrialSandbox({lease,onExit,onExpired}:Props){
  const [page,setPage]=useState("overview");
  const [remaining,setRemaining]=useState(Math.max(0,(lease.expiresAtMs??0)-lease.serverNowMs));
  const [verified,setVerified]=useState(true);
  const [taskDone,setTaskDone]=useState<string[]>([]);
  const [plan,setPlan]=useState("");
  const [plans,setPlans]=useState<string[]>([]);
  const anchor=useRef({server:lease.serverNowMs,mono:0});
  const ended=useRef(false);
  const onExpiredRef=useRef(onExpired);
  // Synchronize the latest callback after commit; never mutate a ref during render.
  useEffect(()=>{onExpiredRef.current=onExpired;},[onExpired]);
  const expires=lease.expiresAtMs??0;
  useEffect(()=>{
    // The clock starts from an authenticated server anchor; wall-clock changes
    // in the browser do not reset or extend the one-time trial.
    anchor.current={server:lease.serverNowMs,mono:performance.now()};
    let live=true;
    const end=()=>{
      if(ended.current)return;
      ended.current=true;
      // Only ephemeral React memory contained trial work. Unmount purges it.
      setTaskDone([]);setPlans([]);setPlan("");
      onExpiredRef.current();
    };
    const tick=()=>{
      if(!live || ended.current)return;
      const milliseconds=expires-(anchor.current.server+performance.now()-anchor.current.mono);
      if(milliseconds<=0){setRemaining(0);end();return;}
      setRemaining(milliseconds);
    };
    const verify=async()=>{
      if(!live || ended.current)return;
      try{
        const response=await fetch("/api/accounts",{method:"POST",credentials:"same-origin",cache:"no-store",
          headers:{"content-type":"application/json"},body:JSON.stringify({action:"trial-status"})});
        const data=await response.json() as {trial?:TrialLease};
        if(!response.ok||!data.trial||data.trial.state!=="active"||
          data.trial.role!==lease.role||data.trial.expiresAtMs!==expires){end();return;}
        if(!live)return;
        anchor.current={server:data.trial.serverNowMs,mono:performance.now()};
        setVerified(true);tick();
      }catch{
        if(live){setVerified(false);setTaskDone([]);setPlans([]);setPlan("");}
      }
    };
    const visible=()=>{if(!document.hidden)void verify();};
    const timer=window.setInterval(tick,1000);
    const serverCheck=window.setInterval(()=>void verify(),60000);
    window.addEventListener("focus",visible);
    document.addEventListener("visibilitychange",visible);
    tick();
    return ()=>{live=false;window.clearInterval(timer);window.clearInterval(serverCheck);
      window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
  },[lease.role,lease.serverNowMs,expires]);
  const isManager=lease.role==="manager",isTeacher=lease.role==="teacher";
  const roleLabel=isManager?"Cán bộ quản lý":isTeacher?"Giảng viên":"Học viên";
  const nav=navigation[lease.role];
  const canInteract=verified&&remaining>0&&!isManager;
  function toggle(value:string){
    if(!canInteract)return;
    setTaskDone(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
  }
  function addPlan(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!canInteract)return;
    const value=plan.trim().slice(0,120);
    if(value){setPlans(old=>[value,...old].slice(0,8));setPlan("");}
  }
  return <main className={styles.shell} aria-label="Trải nghiệm thử Bơi Ếch AI">
    <header className={styles.top}>
      <div><span className={styles.kicker}>BƠI ẾCH AI · PREMIUM SANDBOX</span><h1>Trải nghiệm thử · {roleLabel}</h1>
        <p>DỮ LIỆU THỬ — KHÔNG LƯU VÀO HỒ SƠ THẬT</p></div>
      <div className={styles.timer} role="timer" aria-label="Thời gian trải nghiệm còn lại">
        <small>Thời gian còn lại</small><strong>{formatRemaining(remaining)}</strong></div>
    </header>
    {remaining<=15*60000?<p role="alert" className={styles.warning}>Lượt thử sắp hết hạn. Nội dung thử chưa lưu sẽ bị xóa khi hết giờ.</p>:null}
    {!verified?<p role="alert" className={styles.warning}>Mất kết nối xác minh thời gian máy chủ. Đã tạm khóa thao tác và xóa hoạt động thử trong bộ nhớ; hãy đóng và mở lại để xác minh.</p>:null}
    <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Điều hướng giao diện thử">
        {nav.map(([id,label])=><button key={id} type="button" data-active={page===id}
          onClick={()=>setPage(id)} aria-current={page===id?"page":undefined}>{label}</button>)}
      </nav>
      <section className={styles.content}>
        {page==="overview"?<div className={styles.panel}><span className={styles.eyebrow}>GIAO DIỆN TRẢI NGHIỆM</span>
          <h2>{isManager?"Trung tâm điều hành Premium":isTeacher?"Không gian Giảng viên":"Không gian Học viên"}</h2>
          <p>Đây là không gian thử tách biệt. Không sử dụng tài khoản thật để truy cập dữ liệu đào tạo, danh sách nhân sự, video hay quyền duyệt.</p>
          <div className={styles.tiles}>
            <div><strong>{isManager?"Kiểm duyệt tài khoản":isTeacher?"Bài giảng":"Bài học"}</strong><small>{isManager?"Chỉ xem bố cục · Không có hồ sơ thật":"Thử thao tác cục bộ trong bộ nhớ"}</small></div>
            <div><strong>{isManager?"Cơ sở → Phòng → Lớp":isTeacher?"Lịch giảng dạy":"Tiến trình học tập"}</strong><small>Không thay đổi dữ liệu thật</small></div>
            <div><strong>AI / Video</strong><small>Không hỗ trợ trong sandbox — không tạo kết quả AI giả</small></div>
          </div>
        </div>:null}
        {isManager&&page!=="overview"?<div className={styles.panel}>
          <span className={styles.eyebrow}>CHỈ XEM · KHÔNG CẤP QUYỀN</span>
          <h2>{nav.find(([id])=>id===page)?.[1]}</h2>
          <p>Chỉ trình bày luồng điều hướng Premium. Dữ liệu nhân sự, hồ sơ, quyết định duyệt và thống kê thực không được cung cấp cho tài khoản chờ xét duyệt.</p>
          <div className={styles.readonly}><strong>Chế độ xem thử có giới hạn</strong><p>Phê duyệt, phân công, xuất dữ liệu và quản lý thiết bị bị vô hiệu hóa. Chỉ sau khi Owner duyệt và tài khoản ACTIVE mới truy cập nguồn dữ liệu thật.</p></div>
        </div>:null}
        {!isManager&&page==="lesson"?<div className={styles.panel}>
          <span className={styles.eyebrow}>THAO TÁC THỬ · BỘ NHỚ TẠM</span>
          <h2>{isTeacher?"Soạn kế hoạch bài dạy thử":"Làm quen quy trình học Bơi Ếch"}</h2>
          <p>Thao tác không ghi D1, không lưu tiến độ hoặc chỉnh sửa nội dung chính thức.</p>
          {isTeacher?<form onSubmit={addPlan} className={styles.planForm}><label>Ý tưởng ca dạy (tối đa 120 ký tự)
            <input maxLength={120} value={plan} disabled={!canInteract} onChange={e=>setPlan(e.target.value)} placeholder="Ví dụ: Hướng dẫn phối hợp nhịp thở"/></label>
            <button disabled={!canInteract||!plan.trim()} type="submit">Thêm bản nháp thử</button></form>
          :<div className={styles.checks}>{["Đọc hướng dẫn an toàn khi xuống nước","Xem mục tiêu của bài học","Chọn bước luyện tập phù hợp"].map(x=>
            <label key={x}><input type="checkbox" checked={taskDone.includes(x)} disabled={!canInteract}
              onChange={()=>toggle(x)}/>{x}</label>)}</div>}
          {isTeacher?<div className={styles.notes}>{plans.map((p,i)=><p key={i}>{p}</p>)}{!plans.length?<p>Chưa có bản nháp thử nào.</p>:null}</div>:null}
        </div>:null}
        {!isManager&&["schedule","practice"].includes(page)?<div className={styles.panel}>
          <span className={styles.eyebrow}>MÔ PHỎNG KHÔNG KẾT NỐI LỊCH THẬT</span>
          <h2>{isTeacher?"Chuẩn bị ca dạy":"Tự kiểm tra kiến thức"}</h2>
          <p>Hãy tích chọn các bước làm quen. Đây không phải đánh giá, điểm số hay lịch học chính thức.</p>
          <div className={styles.checks}>{(isTeacher?["Chuẩn bị kế hoạch học","Kiểm tra an toàn hồ bơi","Xem lại mục tiêu ca dạy"]:["Khởi động đúng cách","Nhận biết yêu cầu an toàn","Thực hành phối hợp tay/chân"]).map(x=>
            <label key={x}><input type="checkbox" checked={taskDone.includes(x)} disabled={!canInteract}
              onChange={()=>toggle(x)}/>{x}</label>)}</div>
        </div>:null}
        {!isManager&&["analysis","security"].includes(page)?<div className={styles.panel}>
          <span className={styles.eyebrow}>KHÔNG KHẢ DỤNG TRONG LƯỢT THỬ</span><h2>{page==="analysis"?"Phân tích AI và video":"Bảo mật và thiết bị"}</h2>
          <p>{page==="analysis"?"Không tải video, không gửi yêu cầu phân tích, không tạo AI giả. Chức năng này chỉ dành cho tài khoản ACTIVE với các quyền và đồng ý cần thiết.":"Trong sandbox không thể thêm/gỡ thiết bị, gia hạn tài khoản hay cập nhật thông tin bảo mật thật. Quản lý thiết bị thực nằm tại Trang cá nhân sau khi kích hoạt."}</p>
        </div>:null}
      </section>
    </div>
    <footer className={styles.footer}><span>Thời hạn cấp một lần từ máy chủ · Không gia hạn khi tải lại · Không thay đổi hồ sơ đăng ký.</span>
      <button type="button" onClick={onExit}>Quay về hồ sơ đăng ký</button></footer>
  </main>;
}
