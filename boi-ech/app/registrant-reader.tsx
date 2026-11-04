"use client";
import {useRef,useState} from "react";
type Row={accountId:string;name:string;role:string;personCode:string;className:string;status:string};
export default function RegistrantReader(){
 const [purpose,setPurpose]=useState("");const [rows,setRows]=useState<Row[]>([]),[offset,setOffset]=useState<number|null>(0);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const lock=useRef(false);
 async function read(next=0){if(lock.current)return;lock.current=true;setBusy(true);setMessage("");try{
  const response=await fetch("/api/accounts",{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify({action:"read-registrants",purpose,offset:next,limit:20})});
  const data=await response.json() as {accounts?:Row[];nextOffset?:number|null;error?:string};
  if(!response.ok||!Array.isArray(data.accounts))throw new Error(data.error??"Chưa xác minh được quyền xem hồ sơ.");
  setRows(data.accounts);setOffset(data.nextOffset??null);setMessage("Mỗi hồ sơ hiển thị đã được ghi nhận cùng mục đích truy cập.");
 }catch(e){setRows([]);setMessage(e instanceof Error?e.message:"Không đọc được hồ sơ.")}finally{lock.current=false;setBusy(false)}}
 return <details><summary>Xem hồ sơ mở rộng · quyền được cấp riêng</summary><p>Chỉ hiển thị thông tin cần thiết; mỗi trang yêu cầu xác minh quyền và ghi audit mới.</p>
  <form onSubmit={e=>{e.preventDefault();void read()}}><label>Mục đích truy cập<input required minLength={3} maxLength={160} value={purpose} disabled={busy} onChange={e=>{setPurpose(e.target.value);setRows([])}}/></label><button disabled={busy} type="submit">Xem hồ sơ</button></form>
  {message?<p role="status">{message}</p>:null}<ul>{rows.map(r=><li key={r.accountId}><b>{r.name}</b> · {r.personCode} · {r.role} · {r.className} · {r.status}</li>)}</ul>
  {rows.length&&offset!==null?<button type="button" disabled={busy} onClick={()=>void read(offset)}>Trang tiếp theo</button>:null}
 </details>;
}
