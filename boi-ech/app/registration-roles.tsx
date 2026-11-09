"use client";
export function RegistrationRoles({value,onChange,includeManager=true}:{value:"learner"|"manager"|"teacher";onChange:(value:"learner"|"manager"|"teacher")=>void;includeManager?:boolean}) {
 const roles=[{id:"learner" as const,label:"Học viên",note:"Học, làm bài và nhận chứng chỉ"},
 ...(includeManager?[{id:"manager" as const,label:"Cán bộ quản lý",note:"Vai trò quản trị cũ: chỉ dùng sau khi Owner cấp quyền riêng"}]:[]),
 {id:"teacher" as const,label:"Giảng viên",note:"Giảng dạy và theo dõi lớp phụ trách"}];
 return <fieldset className="person-role-field"><legend>Vai trò sử dụng</legend><div>{roles.map(role=><label key={role.id} className={value===role.id?"selected":""}><input type="radio" name="person-role" value={role.id} checked={value===role.id} onChange={()=>onChange(role.id)}/><span><b>{role.label}</b><small>{role.note}</small></span></label>)}</div></fieldset>;
}
