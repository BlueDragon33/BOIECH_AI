import type {TrainingResource} from "./training-types";

// Stable, intentional names and IDs for the optional practice-facility starter template.
// The template is previewed in UI without counting as a persisted training resource.
// Only an explicitly authorized manager action creates the actual building + pool.
export const PRACTICE_POOL_BUILDING_ID="boiech_pool_building_v1";
export const PRACTICE_POOL_ROOM_ID="boiech_pool_room_v1";
export const PRACTICE_POOL_BUILDING_NAME="Tòa bể bơi";
export const PRACTICE_POOL_ROOM_NAME="Bể bơi thực hành";
export const PRACTICE_POOL_DRAFT_CAPACITY=1;

function sameName(value:string,canonical:string){
 return value.trim().normalize("NFC").toLocaleLowerCase("vi")===canonical.toLocaleLowerCase("vi");
}
export function isPracticePoolBuilding(resource:Pick<TrainingResource,"id"|"name"|"kind">){
 return resource.kind==="building"&&
  (resource.id===PRACTICE_POOL_BUILDING_ID||sameName(resource.name,PRACTICE_POOL_BUILDING_NAME));
}
export function isPracticePoolRoom(resource:Pick<TrainingResource,"id"|"name"|"kind">){
 return resource.kind==="room"&&
  (resource.id===PRACTICE_POOL_ROOM_ID||sameName(resource.name,PRACTICE_POOL_ROOM_NAME));
}
export function existingPracticePoolBuilding(resources:TrainingResource[]){
 return resources.find(isPracticePoolBuilding);
}
export function existingPracticePoolRoom(resources:TrainingResource[],buildingId:string){
 return resources.find(room=>room.parentId===buildingId&&isPracticePoolRoom(room));
}
