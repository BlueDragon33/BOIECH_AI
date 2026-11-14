"use client";

import {createContext, useContext, type ReactNode} from "react";
import {portableManagerProof,portableWorkspaceCredential} from "./multi-account-switcher";
import type {LessonContentPayload,LessonOutline,ServerCourseState} from "./course-types";

export type AccountWorkspaceDevice = {
  deviceId:string;accountId?:string;deviceCode:string;status:"pending"|"approved"|"blocked";
  deviceType:"desktop"|"phone"|"tablet";platform:string|null;browser:string|null;label:string|null;
  learnerName:string|null;learnerFamilyName:string|null;learnerGivenName:string|null;
  personRole:"learner"|"teacher"|"manager"|null;managementEnabled:boolean;
  personCode:string|null;className:string|null;phone:string|null;registrationComplete:boolean;
  accessGroup:"unassigned"|"free"|"paid";
  paymentStatus:"unassigned"|"awaiting_payment"|"proof_submitted"|"free_approved"|"paid_verified";
  paymentAmount:number;paymentSubmittedAt:string|null;paymentRejectedAt:string|null;paymentReviewNote:string|null;
  accessExpiresAt:string|null;accessExpired:boolean;accessExpiringSoon:boolean;accessDaysRemaining:number|null;
  personalEditEnabled:boolean;autoConfirmedAt:string|null;
};
export type AccountWorkspaceCredential={version:2;privateKey:CryptoKey|null;publicKey:JsonWebKey};
export type AccountCourseBootstrap={state:ServerCourseState;content:LessonContentPayload;outlines:LessonOutline[]};
export type AccountWorkspaceBootstrap={
 accountId:string; role:"learner"|"teacher";device:AccountWorkspaceDevice;
 credential:AccountWorkspaceCredential;course?:AccountCourseBootstrap;teacherOverview?:unknown;
};
const Context=createContext<AccountWorkspaceBootstrap|null>(null);
export function AccountWorkspaceProvider({workspace,children}:{workspace:AccountWorkspaceBootstrap;children:ReactNode}){
 return <Context.Provider value={workspace}>{children}</Context.Provider>;
}
export function useAccountWorkspace(){return useContext(Context);}
const idPattern=/^acc_[a-f0-9]{64}$/;
const devicePattern=/^[a-f0-9]{64}$/;
function fail(error:string):never{throw new Error(error);}
async function postJson<T>(url:string,body:Record<string,unknown>,signal:AbortSignal):Promise<T>{
 signal.throwIfAborted();
 const response=await fetch(url,{method:"POST",credentials:"same-origin",cache:"no-store",
  headers:{"content-type":"application/json"},body:JSON.stringify(body),signal});
 let data:Record<string,unknown>;
 try{data=await response.json() as Record<string,unknown>;}
 catch{throw new Error("Máy chủ trả dữ liệu không hợp lệ. Chưa thể mở trang chính.");}
 signal.throwIfAborted();
 if(!response.ok)throw new Error(typeof data.error==="string"?data.error:"Không xác minh được dữ liệu từ máy chủ.");
 return data as T;
}
/**
 * Every milestone is an authenticated operation, not a simulated progress bar.
 * The caller must have a previously authorized Account-first session.
 * The entire bootstrap is readback-only except for the canonical /api/course
 * bootstrap's existing audit of lesson_open (unchanged course semantics).
 */
export async function loadAccountWorkspace(
 accountId:string,storageDeviceId:string,role:"learner"|"teacher",signal:AbortSignal,
 onDeviceVerified:(state:AccountWorkspaceDevice)=>void,
):Promise<AccountWorkspaceBootstrap>{
 if(!idPattern.test(accountId)||!devicePattern.test(storageDeviceId))return fail("Phiên tài khoản không có mã liên kết hợp lệ.");
 const credential=await portableWorkspaceCredential();
 signal.throwIfAborted();
 // The existing device-register action resolves the authorized account's
 // storage anchor on the server in Account-first mode; it MUST NOT create
 // an additional legacy device. No client-declared role can grant access.
 const identity=await postJson<{device?:AccountWorkspaceDevice}>("/api/device",{
  action:"register",publicKey:credential.publicKey,
 },signal);
 const device=identity.device;
 if(!device||device.accountId!==accountId||device.deviceId!==storageDeviceId
   ||device.personRole!==role||device.status!=="approved"||!device.registrationComplete){
  return fail("Thông tin tài khoản, vai trò hoặc hồ sơ thiết bị chưa được máy chủ xác nhận đầy đủ.");
 }
 // Account-first V2 entitlement is authoritative; never trust a decorative
 // badge nor use a cookie-free, guessed deviceId to enter the workspace.
 onDeviceVerified(device);
 signal.throwIfAborted();
 const proof=await portableManagerProof(storageDeviceId,signal);
 signal.throwIfAborted();
 if(role==="learner"){
  const data=await postJson<{state?:ServerCourseState;content?:LessonContentPayload;outlines?:LessonOutline[]}>(
   "/api/course",{action:"bootstrap",lessonNumber:"01",...proof},signal);
  if(!data.state||!data.content||!Array.isArray(data.outlines)||data.outlines.length!==8)
   return fail("Máy chủ chưa trả đầy đủ nội dung bài học đầu tiên. Chưa mở GO.");
  await import("./learner-enhancements");
  signal.throwIfAborted();
  return {accountId,role,credential,device,course:{state:data.state,content:data.content,outlines:data.outlines}};
 }
 const overview=await postJson<{teacher?:{name?:string|null};summary?:unknown;learners?:unknown[]}>(
  "/api/teacher/overview",proof,signal);
 if(!overview.teacher||!overview.summary||!Array.isArray(overview.learners))
  return fail("Bảng điều phối Giảng viên trả về chưa đầy đủ. Chưa mở GO.");
 await import("./teacher-enhancements");
 signal.throwIfAborted();
 return {accountId,role,credential,device,teacherOverview:overview};
}
