import {useState} from "react";
import {createRoot} from "react-dom/client";
import {TrainingDashboard} from "../boi-ech/app/manager-workspace";
import type {TrainingBoard} from "../boi-ech/app/training-types";
import {defaultDisplay,type DisplayPreferences} from "../boi-ech/app/manager-status";

// Isolated visual fixture. No identity, API proof, network or mutation adapter.
const fixture:TrainingBoard={
 from:"2030-06-01T06:00:00Z",to:"2030-06-01T08:00:00Z",observedAt:"2030-06-01T05:55:00Z",
 resources:[
  {id:"building",kind:"building",name:"Tòa huấn luyện A",parentId:null,capacity:1,requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,remaining:1,missingTeachers:0,bookingCount:1,state:"available",roomCount:2},
  {id:"room-one",kind:"room",name:"Phòng 101",parentId:"building",capacity:30,requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,remaining:0,missingTeachers:0,bookingCount:1,state:"full",roomCount:0},
  {id:"room-two",kind:"room",name:"Phòng 102",parentId:"building",capacity:24,requiredTeachers:1,status:"active",version:1,learnerCount:0,teacherCount:0,remaining:1,missingTeachers:0,bookingCount:0,state:"available",roomCount:0},
  {id:"class-one",kind:"class",name:"Lớp Bơi ếch 01",parentId:null,capacity:30,requiredTeachers:2,status:"active",version:1,learnerCount:24,teacherCount:1,remaining:6,missingTeachers:1,bookingCount:1,state:"missing",roomCount:0},
  {id:"class-two",kind:"class",name:"Lớp Bơi ếch 02",parentId:null,capacity:24,requiredTeachers:1,status:"active",version:1,learnerCount:24,teacherCount:1,remaining:0,missingTeachers:0,bookingCount:0,state:"full",roomCount:0},
 ],
 people:[
  {id:"teacher-one",name:"Giảng viên mẫu 01",code:"DEMO-GV-01",role:"teacher",className:"Lớp Bơi ếch 01",status:"approved",expired:false,registered:true,bookingCount:1},
  {id:"learner-one",name:"Học viên mẫu 01",code:"DEMO-HV-01",role:"learner",className:"Lớp Bơi ếch 01",status:"approved",expired:false,registered:true,bookingCount:1},
  {id:"learner-two",name:"Học viên mẫu 02",code:"DEMO-HV-02",role:"learner",className:"",status:"approved",expired:false,registered:true,bookingCount:0},
  {id:"learner-three",name:"Học viên mẫu 03",code:"DEMO-HV-03",role:"learner",className:"Lớp Bơi ếch 02",status:"pending",expired:false,registered:true,bookingCount:0},
 ],
 sessions:[{id:"session-one",title:"Kỹ thuật chân và nhịp thở",classId:"class-one",roomId:"room-one",teacherId:"teacher-one",startsAt:"2030-06-01T06:15:00Z",endsAt:"2030-06-01T07:00:00Z",status:"scheduled",version:1}],
 summary:{freeRooms:1,occupiedRooms:1,missingLearners:6,missingTeachers:1,unassignedLearners:1,unassignedTeachers:0},
};
for(let i=2;i<=24;i++)fixture.people.push({id:`sample-a-${i}`,name:`Học viên mẫu A${String(i).padStart(2,"0")}`,code:`DEMO-A-${i}`,role:"learner",className:"Lớp Bơi ếch 01",status:"approved",expired:false,registered:true,bookingCount:1});
for(let i=1;i<=24;i++)fixture.people.push({id:`sample-b-${i}`,name:`Học viên mẫu B${String(i).padStart(2,"0")}`,code:`DEMO-B-${i}`,role:"learner",className:"Lớp Bơi ếch 02",status:"approved",expired:false,registered:true,bookingCount:0});
fixture.people.push({id:"teacher-two",name:"Giảng viên mẫu 02",code:"DEMO-GV-02",role:"teacher",className:"Lớp Bơi ếch 02",status:"approved",expired:false,registered:true,bookingCount:0});
function Preview(){
 const [tab,setTab]=useState<Parameters<typeof TrainingDashboard>[0]["tab"]>("overview");
 const [appearance,setAppearance]=useState<DisplayPreferences>(defaultDisplay);
 const [notice,setNotice]=useState("");
 return <><div style={{padding:"8px 14px",background:"#173e66",color:"#fff",font:"12px/1.5 system-ui",textAlign:"center"}}>DỮ LIỆU MẪU · XEM GIAO DIỆN · KHÔNG GHI DỮ LIỆU</div><TrainingDashboard board={fixture} tab={tab} setTab={setTab} busy={false} notice={notice} noticeError={Boolean(notice)} appearance={appearance} onAppearanceChange={setAppearance} onCommand={async()=>{setNotice("Bản xem thử không ghi dữ liệu. Thay đổi chưa được lưu.");return false;}} onWindowChange={()=>setNotice("Khoảng thời gian cố định của bản xem thử; chưa kết nối dữ liệu thật.")}/></>;
}
createRoot(document.getElementById("root")!).render(<Preview/>);
