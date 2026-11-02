"use client";
import {useState} from "react";
import ManagerApprovalPanel from "../manager-approval-panel";
import {TrainingDashboard} from "../manager-workspace";
import type {TrainingBoard} from "../training-types";
type Tab="overview"|"schedule"|"people"|"building"|"room"|"class";

const DEMO_BOARD:TrainingBoard={
  from:"2026-11-02T08:00:00.000Z",to:"2026-11-02T18:00:00.000Z",
  observedAt:"2026-11-02T08:00:00.000Z",
  summary:{freeRooms:1,occupiedRooms:0,missingLearners:0,missingTeachers:0,unassignedLearners:1,unassignedTeachers:0},
  resources:[
    {id:"demo-building",kind:"building",name:"Tòa học mẫu",parentId:null,capacity:100,
      requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,
      remaining:1,missingTeachers:0,bookingCount:0,state:"available",roomCount:1},
    {id:"demo-room",kind:"room",name:"Phòng 101",parentId:"demo-building",capacity:50,
      requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,
      remaining:50,missingTeachers:0,bookingCount:0,state:"available",roomCount:0},
    {id:"demo-class",kind:"class",name:"Lớp Bơi Ếch A",parentId:null,capacity:50,
      requiredTeachers:1,status:"active",version:1,learnerCount:1,teacherCount:1,
      remaining:49,missingTeachers:0,bookingCount:0,state:"available",roomCount:0}
  ],
  people:[
    {id:"demo-learner",name:"Học viên mẫu",code:"DEMO-HV-01",role:"learner",className:"Lớp Bơi Ếch A",
      status:"pending",expired:false,registered:true,bookingCount:0},
    {id:"demo-teacher",name:"Giảng viên mẫu",code:"DEMO-GV-01",role:"teacher",className:"Lớp Bơi Ếch A",
      status:"approved",expired:false,registered:true,bookingCount:0}
  ],
  sessions:[{id:"demo-session",title:"Buổi học minh họa",classId:"demo-class",
    roomId:"demo-room",teacherId:"demo-teacher",startsAt:"2026-11-02T09:00:00.000Z",
    endsAt:"2026-11-02T10:00:00.000Z",status:"scheduled",version:1}]
};

export default function ManagerRolePreviewPage(){
  const [enabled,setEnabled]=useState(false);
  const [tab,setTab]=useState<Tab>("overview");
  const [notice,setNotice]=useState("");
  return <main style={{maxWidth:1080,margin:"0 auto",padding:20,fontFamily:"system-ui,sans-serif"}}>
    <p><a href="/">← Trở về Bơi Ếch</a></p>
    <h1>Xem thử cấp Cán bộ quản lý</h1>
    <p><strong>Chế độ mô phỏng tách biệt:</strong> không dùng phiên đăng nhập, không gọi API/D1,
      không phê duyệt, không sửa lịch hoặc dữ liệu thực. Mọi số liệu dưới đây là dữ liệu mẫu.</p>
    <label style={{display:"flex",gap:10,alignItems:"center",margin:"20px 0"}}>
      <input type="checkbox" checked={enabled} onChange={event=>{setEnabled(event.target.checked);setNotice("");}}/>
      Bật chế độ xem thử Cán bộ quản lý (không có quyền ghi)
    </label>
    {enabled?<>
      <ManagerApprovalPanel previewOnly/>
      <section style={{border:"1px solid #aaa",borderRadius:14,marginTop:16,padding:16}}>
        <p><strong>Điều phối lớp, giảng viên, học viên và lịch học — XEM THỬ</strong></p>
        <p>Có thể mở tab và biểu mẫu để kiểm tra giao diện. Nút Lưu sẽ không ghi dữ liệu.</p>
        {notice?<p role="status">{notice}</p>:null}
        <TrainingDashboard board={DEMO_BOARD} tab={tab} setTab={setTab} busy={false}
          notice="DỮ LIỆU MẪU · KHÔNG ĐỒNG BỘ D1" onWindowChange={()=>setNotice("Chế độ xem thử: không thay đổi khoảng thời gian hệ thống.")}
          onCommand={async()=>{setNotice("CHẾ ĐỘ TEST: thao tác không lưu, không thay đổi dữ liệu chung.");return false;}}/>
      </section>
    </>:<p>Chưa bật chế độ xem thử. Mọi tài khoản và thiết bị thực tế giữ nguyên.</p>}
  </main>;
}
