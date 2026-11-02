"use client";
import {useState} from "react";
import ManagerApprovalPanel from "../manager-approval-panel";

export default function ManagerRolePreviewPage(){
  const [enabled,setEnabled]=useState(false);
  return <main style={{maxWidth:1080,margin:"0 auto",padding:20,fontFamily:"system-ui,sans-serif"}}>
    <p><a href="/">← Trở về Bơi Ếch</a></p>
    <h1>Xem thử cấp Cán bộ quản lý</h1>
    <p>Chỉ xem bố cục và quy trình bằng dữ liệu mẫu. Không sử dụng phiên đăng nhập, không kết nối D1,
      không cấp quyền, không tự động duyệt thiết bị và không thay đổi dữ liệu hệ thống chung.</p>
    <label style={{display:"flex",gap:10,alignItems:"center",margin:"20px 0"}}>
      <input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/>
      Bật chế độ xem thử Cán bộ quản lý (chỉ đọc)
    </label>
    {enabled?<ManagerApprovalPanel previewOnly/>:<p>Chưa bật chế độ xem thử. Mọi tài khoản và thiết bị thực tế giữ nguyên.</p>}
  </main>;
}
