"use client";
export function RegistrationRoles({value,onChange}:{value:"learner"|"manager"|"teacher";onChange:(value:"learner"|"manager"|"teacher")=>void}) {
 const roles=[{id:"learner" as const,label:"Học viên",note:"Học, làm bài và nhận chứng chỉ"},{id:"manager" as const,label:"Cán bộ quản lý",note:"Điều phối lớp và lịch sau khi được quản trị cấp quyền"},{id:"teacher" as const,label:"Giảng viên",note:"Giảng dạy và theo dõi lớp phụ trách"}];
 return <fieldset className="person-role-field"><legend>Vai trò sử dụng</legend><div>{roles.map(role=><label key={role.id} className={value===role.id?"selected":""}><input type="radio" name="person-role" value={role.id} checked={value===role.id} onChange={()=>onChange(role.id)}/><span><b>{role.label}</b><small>{role.note}</small></span></label>)}</div></fieldset>;
}
