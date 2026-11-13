"use client";
import {Component,type ReactNode} from "react";
import styles from "./manager-workspace.module.css";

type Props={children:ReactNode};
type State={crashed:boolean};
/** A malformed historic profile must not strand the entire app on white. */
export default class ManagerRenderBoundary extends Component<Props,State>{
 state:State={crashed:false};
 static getDerivedStateFromError():State{return {crashed:true};}
 componentDidCatch(error:Error){
  // Diagnostic only; never include the personnel roster or account identity.
  console.error("Manager workspace rendering failed:",error.name);
 }
 render(){
  if(!this.state.crashed)return this.props.children;
  return <main className={styles.managerRenderFallback} role="alert">
   <h1>Không thể hiển thị giao diện Cán bộ quản lý</h1>
   <p>Dữ liệu Nhân sự hoặc phiên giao diện có thể chưa đồng bộ. Hệ thống không xóa hay thay đổi hồ sơ.</p>
   <button type="button" onClick={()=>window.location.reload()}>Đồng bộ lại và tải trang</button>
   <p>Nếu vẫn xảy ra, báo quản trị kiểm tra log Worker; không cần đăng ký tài khoản mới.</p>
  </main>;
 }
}
