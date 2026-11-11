"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from "react";
import {createPortal} from "react-dom";
import styles from "./account-profile-dialog.module.css";

export type ProfileSection={id:"overview"|"security"|"devices"|"sync";label:string;hint:string;content:ReactNode};
type Props={open:boolean;name:string;role:"learner"|"teacher"|"manager";sections:ProfileSection[];
  onClose:()=>void;onLogout:()=>void;busy?:boolean};
const roles={learner:"Học viên",teacher:"Giảng viên",manager:"Cán bộ quản lý"};
const icons:Record<ProfileSection["id"],ReactNode>={
 overview:<><circle cx="12" cy="8" r="3.3"/><path d="M4.5 20c.6-4.5 3.1-6.5 7.5-6.5s6.9 2 7.5 6.5"/></>,
 security:<><path d="M12 2l8 3v6c0 5-3.2 8.4-8 11-4.8-2.6-8-6-8-11V5z"/><path d="m9 12 2 2 4-4"/></>,
 devices:<><rect x="2" y="4" width="14" height="12" rx="2"/><path d="M7 20h8m-4-4v4"/><rect x="17" y="7" width="5" height="11" rx="1.3"/></>,
 sync:<><path d="M20 7a8.6 8.6 0 0 0-14-2L3 8m0-5v5h5"/><path d="M4 17a8.6 8.6 0 0 0 14 2l3-3m0 5v-5h-5"/></>
};
const Icon=({name}:{name:ProfileSection["id"]})=>
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;

export default function AccountProfileDialog({open,name,role,sections,onClose,onLogout,busy=false}:Props){
 const [selected,setSelected]=useState<ProfileSection["id"]>("overview");
 const closeRef=useRef<HTMLButtonElement>(null);
 const priorFocus=useRef<HTMLElement|null>(null);
 const dialogId=useId();
 useEffect(()=>{
   if(!open)return;
   priorFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
   const previousOverflow=document.body.style.overflow;
   document.body.style.overflow="hidden";
   const onKey=(event:KeyboardEvent)=>{
     if(event.key==="Escape"){event.preventDefault();onClose();}
     if(event.key!=="Tab")return;
     const dialog=closeRef.current?.closest('[role="dialog"]');
     if(!dialog)return;
     const focusable=[...dialog.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
       .filter(node=>node.getClientRects().length>0);
     if(!focusable.length)return;
     const first=focusable[0],last=focusable[focusable.length-1];
     if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
     else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
   };
   document.addEventListener("keydown",onKey);
   queueMicrotask(()=>closeRef.current?.focus());
   return()=>{document.removeEventListener("keydown",onKey);document.body.style.overflow=previousOverflow;priorFocus.current?.focus();};
 },[open,onClose]);
 if(!open||typeof document==="undefined")return null;
 const active=sections.find(s=>s.id===selected)??sections[0];
 return createPortal(<div className={styles.backdrop} role="presentation"
   onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={dialogId}
      data-account-role={role}>
     <aside className={styles.sidebar}>
       <div className={styles.brand}><span className={styles.mark}>≋</span><span>BƠI ẾCH <b>PREMIUM</b></span></div>
       <div className={styles.identity}>
         <span className={styles.avatar}>{(name.trim()[0]||"B").toLocaleUpperCase("vi")}</span>
         <div><small>TÀI KHOẢN ĐÃ XÁC THỰC</small><strong>{name||"Tài khoản Bơi Ếch"}</strong><span>{roles[role]}</span></div>
       </div>
       <nav className={styles.navigation} aria-label="Các mục trong Trang cá nhân">
         {sections.map(section=><button type="button" key={section.id} className={styles.navButton}
           aria-current={active.id===section.id?"page":undefined}
           onClick={()=>setSelected(section.id)}>
           <Icon name={section.id}/><span><strong>{section.label}</strong><small>{section.hint}</small></span>
           <span aria-hidden="true">›</span></button>)}
       </nav>
       <div className={styles.sidebarFoot}>
         <button type="button" disabled={busy} className={styles.logout}
           onClick={onLogout}>Đăng xuất khỏi tài khoản</button>
         <small>Phiên đăng nhập và quyền truy cập được máy chủ kiểm tra.</small>
       </div>
     </aside>
     <div className={styles.main}>
       <header className={styles.heading}><div><small>TRANG CÁ NHÂN / {roles[role].toLocaleUpperCase("vi")}</small>
         <h2 id={dialogId}>{active.label}</h2><p>{active.hint}</p></div>
         <button ref={closeRef} type="button" className={styles.close}
           aria-label="Đóng Trang cá nhân" onClick={onClose}>×</button>
       </header>
       <div className={styles.scroll}>{active.content}</div>
       <footer className={styles.footer}>Bơi Ếch AI Premium · Quản lý tài khoản an toàn
         <span>Chỉ thao tác được trên tài khoản và thiết bị đã xác thực</span></footer>
     </div>
   </section>
 </div>,document.body);
}
