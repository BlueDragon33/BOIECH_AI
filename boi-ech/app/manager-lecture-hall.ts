import type {TrainingResource} from "./training-types";

/** Main hall is optional until created by an authorized manager. The illustration is not inventory. */
export const MAIN_LECTURE_HALL_ID="boiech_main_lecture_hall_v1";
export const MAIN_LECTURE_HALL_NAME="Tòa giảng đường";
const normalize=(text:string)=>text.trim().normalize("NFC").toLocaleLowerCase("vi");
export function isMainLectureHall(r:Pick<TrainingResource,"id"|"name"|"kind">){
 return r.kind==="building"&&(r.id===MAIN_LECTURE_HALL_ID||normalize(r.name)===normalize(MAIN_LECTURE_HALL_NAME));
}
export function existingMainLectureHall(resources:TrainingResource[]){
 return resources.find(isMainLectureHall);
}
export const CAMPUS_CLASSROOM_LABELS=["Tòa học A","Tòa học B","Tòa học C"] as const;
