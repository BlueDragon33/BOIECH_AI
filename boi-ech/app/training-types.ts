export type ResourceKind = "building" | "room" | "class";
export type ResourceStatus = "active" | "unavailable" | "archived";
export type TrainingResource = { id:string; kind:ResourceKind; name:string; parentId:string|null; capacity:number; requiredTeachers:number; status:ResourceStatus; version:number; learnerCount:number; teacherCount:number; remaining:number; missingTeachers:number; bookingCount:number; state:"available"|"full"|"missing"|"overloaded"|"inactive"; roomCount:number };
export type TrainingPerson = { id:string; name:string; code:string; role:"learner"|"teacher"; className:string; status:"pending"|"approved"|"blocked"; expired:boolean; registered:boolean; bookingCount:number };
export type TrainingSession = { id:string; title:string; classId:string; roomId:string; teacherId:string; startsAt:string; endsAt:string; status:"scheduled"|"completed"|"cancelled"; version:number };
export type TrainingBoard = { resources:TrainingResource[]; people:TrainingPerson[]; sessions:TrainingSession[]; from:string; to:string; observedAt:string; summary:{ freeRooms:number; occupiedRooms:number; missingLearners:number; missingTeachers:number; unassignedLearners:number; unassignedTeachers:number } };
export function classNames(value:string) { return value.split(/[;,\n]+/).map(s=>s.trim()).filter(Boolean); }
// Match SQLite's built-in lower() exactly; manager assignments write canonical names.
export function classKey(value:string) { return value.trim().replace(/[A-Z]/g,c=>c.toLowerCase()); }
