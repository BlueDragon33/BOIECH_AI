"use client";

import {isRoleChunkLoadFailure,refreshRoleAssetsManually} from "./role-asset-recovery";

/**
 * Runtime errors after GO (e.g. a lazy role module loaded during a rollout)
 * must not trap an authenticated learner on an empty page.
 */
export default function WorkspaceError({
  error,reset,
}:{
  error:Error&{digest?:string};
  reset:()=>void;
}){
  const staleBundle=isRoleChunkLoadFailure(error);
  // After GO, unsaved lesson answers may exist: never auto-reload here.
  // An explicit button confirms the learner chooses to refresh.
  return <main role="alert" style={{
    minHeight:"80vh",display:"grid",placeItems:"center",
    padding:"2rem 1rem",background:"#082439",color:"#f3fbff"
  }}>
    <section style={{
      width:"min(100%,38rem)",border:"1px solid #5a9ab2",
      borderRadius:"1rem",padding:"1.5rem",background:"#0c3046"
    }}>
      <h1 style={{fontSize:"1.5rem",fontWeight:800,marginBottom:"0.75rem"}}>
        {staleBundle?"Ứng dụng có phiên bản mới":"Không thể hiển thị màn hình này"}
      </h1>
      <p style={{lineHeight:1.6,marginBottom:"1.25rem"}}>
        {staleBundle
          ? "Máy chủ đã cập nhật giao diện. Hãy lưu phần đang làm nếu có rồi chọn tải bản mới. Tài khoản và dữ liệu đã lưu được giữ nguyên."
          : "Có lỗi hiển thị tạm thời. Bạn có thể thử mở lại màn hình, không cần đăng ký hoặc đăng nhập lại."}
      </p>
      <button type="button"
        onClick={()=>{if(!staleBundle||!refreshRoleAssetsManually())reset();}}
        style={{background:"#10b9bd",color:"#05212d",fontWeight:800,
          borderRadius:"0.7rem",padding:"0.8rem 1.2rem",cursor:"pointer"}}>
        {staleBundle?"Tải bản ứng dụng mới":"Thử lại"}
      </button>
    </section>
  </main>;
}
