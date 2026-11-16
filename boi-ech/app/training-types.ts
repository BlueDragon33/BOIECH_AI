export type ResourceKind = "building" | "room" | "class";
export type ResourceStatus = "active" | "unavailable" | "archived";
export type TrainingResource = { id:string; kind:ResourceKind; name:string; parentId:string|null; capacity:number; requiredTeachers:number; status:ResourceStatus; version:number; learnerCount:number; teacherCount:number; remaining:number; missingTeachers:number; bookingCount:number; state:"available"|"full"|"missing"|"overloaded"|"inactive"; roomCount:number };
export type TrainingPerson = { id:string; name:string; code:string; role:"learner"|"teacher"; className:string; status:"pending"|"approved"|"blocked"; expired:boolean; registered:boolean; bookingCount:number; recordSource?:"legacy"|"account-first"; deviceType:"phone"|"tablet"|"desktop"|"unknown"; devicePlatform:string|null; deviceLastSeenAt:string|null };
export type TrainingSession = { id:string; title:string; classId:string; roomId:string; teacherId:string; assistantTeacherId:string|null; periodStart:number|null; periodEnd:number|null; startsAt:string; endsAt:string; status:"scheduled"|"completed"|"cancelled"; version:number };
export type TrainingClassLeader = {
 classId:string;slot:"cadre"|"student";source:"none"|"cadre"|"class"|"outside";memberDeviceId:string|null;
 displayName:string|null;birthDate:string|null;militaryRank:string|null;battalion:string|null;version:number;
 updatedAt:string;
};
export type TrainingPeriod = {number:number;startTime:string;endTime:string;timezone:string;version:number};
export type TrainingLeaderHistory = {id:string;classId:string;slot:"cadre"|"student";previousVersion:number;previousSource:string;
 previousMemberDeviceId:string|null;previousDisplayName:string|null;previousBirthDate:string|null;
 previousMilitaryRank:string|null;previousBattalion:string|null;replacedAt:string};
export type TrainingTeacherClassTerm={teacherDeviceId:string;classId:string;startedAt:string;plannedEndAt:string|null;endedAt:string|null;version:number};
export type TrainingBoard = { teacherClassTerms:TrainingTeacherClassTerm[];leaderHistory:TrainingLeaderHistory[];leaders:TrainingClassLeader[];periods:TrainingPeriod[];resources:TrainingResource[]; people:TrainingPerson[]; sessions:TrainingSession[]; from:string; to:string; observedAt:string; summary:{ freeRooms:number; occupiedRooms:number; missingLearners:number; missingTeachers:number; unassignedLearners:number; unassignedTeachers:number } };
export function classNames(value:string) { return value.split(/[;,\n]+/).map(s=>s.trim()).filter(Boolean); }
// Match SQLite's built-in lower() exactly; manager assignments write canonical names.
export function classKey(value:string) { return value.trim().replace(/[A-Z]/g,c=>c.toLowerCase()); }
