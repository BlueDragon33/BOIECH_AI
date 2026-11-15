"use client";
import {useId} from "react";

/** Atmospheric SVG diorama for satellite teaching buildings: scalable, interactive parent, no remote assets. */
export function CampusBuildingArt({variant=0}:{variant?:number}){
 const id=useId().replace(/:/g,"");
 const palette=[
  {roof:"#256fbb",light:"#aee8ff"},
  {roof:"#5b6eb1",light:"#d1d6ff"},
  {roof:"#138d9f",light:"#b3faf6"},
  {roof:"#337ca6",light:"#c3ebff"}
 ][((variant%4)+4)%4];
 const url=(key:string)=>`url(#${id}${key})`;
 return <svg viewBox="0 0 280 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+"roof"} x1="0" y1="0" x2="1" y2="1"><stop stopColor={palette.light}/><stop offset=".23" stopColor={palette.roof}/><stop offset="1" stopColor="#132b68"/></linearGradient>
   <linearGradient id={id+"left"} x1="0" y1="0" x2="1" y2=".75"><stop stopColor="#eff8ff"/><stop offset=".55" stopColor="#d0dff3"/><stop offset="1" stopColor="#899fc5"/></linearGradient>
   <linearGradient id={id+"right"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9db6d6"/><stop offset="1" stopColor="#43618e"/></linearGradient>
   <linearGradient id={id+"gold"} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff5ba"/><stop offset=".55" stopColor="#ffd678"/><stop offset="1" stopColor="#b46e30"/></linearGradient>
   <linearGradient id={id+"base"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#26649d"/><stop offset="1" stopColor="#092853"/></linearGradient>
   <filter id={id+"glow"} x="-55%" y="-130%" width="210%" height="360%"><feGaussianBlur stdDeviation="4"/></filter>
   <radialGradient id={id+"bloom"}><stop stopColor="#ffe69b" stopOpacity=".72"/><stop offset="1" stopColor="#ffc168" stopOpacity="0"/></radialGradient>
   <pattern id={id+"tiles"} width="11" height="8" patternUnits="userSpaceOnUse"><path d="M0 1H11M5 1v4M0 7H11" fill="none" stroke="#caecff" strokeWidth=".8" opacity=".37"/></pattern>
   <clipPath id={id+"roofMask"}><path d="M59 105 139 54 219 105 139 153Z"/></clipPath>
  </defs>
  <ellipse cx="141" cy="178" rx="126" ry="24" fill="#000d29" opacity=".57"/>
  <path d="M13 143 142 82 268 144 143 205Z" fill={url("base")} stroke="#8ddaff" strokeWidth="3" strokeLinejoin="round"/>
  <path d="M13 143 142 82 268 144 143 205Z" fill="none" stroke="#23c7ff" strokeWidth="11" opacity=".65" filter={url("glow")}/>
  <path d="M14 144v9l129 60 125-61v-8" fill="#0b2e56" stroke="#19aefc" strokeWidth="3"/>
  <path d="M29 145 142 94 246 144 142 193Z" fill="#23627c" stroke="#60abd0" strokeWidth="1.5"/>
  <path d="M73 105 139 73 201 101 201 159 140 191 73 156Z" fill={url("right")} stroke="#a7c7eb" strokeWidth="2"/>
  <path d="M73 105 140 137 140 191 73 156Z" fill={url("left")} stroke="#d6e9ff" strokeWidth="2"/>
  <path d="M140 137 201 104 201 159 140 191Z" fill={url("right")} stroke="#94bce9" strokeWidth="2"/>
  <path d="M60 103 140 54 221 105 140 153Z" fill={url("roof")} stroke="#ddf7ff" strokeWidth="3"/>
  <path d="M60 103 140 54 221 105 140 153Z" fill={url("tiles")} clipPath={url("roofMask")} opacity=".65"/>
  <path d="M58 103 140 53 223 105M141 54v99" fill="none" stroke="#a3e0ff" strokeWidth="1.8"/>
  <path d="M69 104 140 147 211 103" fill="none" stroke="#144e8f" strokeWidth="2"/>
  <path d="M83 117 98 125v24l-15-8ZM112 131l15 8v24l-15-8ZM83 148l15 8v19l-15-9Z"
    fill={url("gold")} stroke="#416999" strokeWidth="2.6"/>
  <path d="M155 140 170 132v23l-15 9ZM181 125l13-7v23l-13 8ZM181 152l13-7v18l-13 7Z"
    fill={url("gold")} stroke="#42699c" strokeWidth="2.5"/>
  <path d="M88 120v25M117 133v26M160 140v19M186 126v18M186 151v15" stroke="#fff5ce" strokeWidth="2" opacity=".65"/>
  <ellipse cx="159" cy="171" rx="42" ry="28" fill={url("bloom")} opacity=".35"/>
  <path d="M146 162 172 147 172 178 146 191Z" fill="#17375b" stroke="#9bd0eb" strokeWidth="2.5"/>
  <path d="M151 164 168 155v18l-17 10Z" fill={url("gold")} stroke="#c1defa" strokeWidth="1"/>
  <path d="M160 160v19" stroke="#ad723c" strokeWidth="1.5"/>
  <path d="M138 186 167 171 192 182 163 199Z" fill="#859ec2" stroke="#c8e2fa" strokeWidth="2"/>
  <path d="M145 188 165 179M153 193 174 183" stroke="#e8f5ff" strokeWidth="2"/>
  {/* Sculpted foliage is part of the diorama, never an availability indicator. */}
  {[{x:38,y:150},{x:229,y:151},{x:218,y:181},{x:62,y:179}].map((p,i)=><g key={i}>
    <path d={`M${p.x} ${p.y-4}v22`} stroke="#315e41" strokeWidth="3.5"/>
    <circle cx={p.x-6} cy={p.y-18} r="9" fill="#32824d"/>
    <circle cx={p.x+4} cy={p.y-25} r="11" fill="#3b9756"/>
    <circle cx={p.x+10} cy={p.y-16} r="8" fill="#286f43"/>
    <circle cx={p.x-5} cy={p.y-24} r="4" fill="#84c67b" opacity=".65"/>
  </g>)}
  {[{x:54,y:170},{x:220,y:169}].map((p,i)=><g key={i}>
    <path d={`M${p.x} ${p.y+9}v-20`} stroke="#bfe9fe" strokeWidth="2"/>
    <ellipse cx={p.x} cy={p.y-13} rx="16" ry="17" fill={url("bloom")} opacity=".5"/>
    <circle cx={p.x} cy={p.y-13} r="4" fill="#fff2ba" stroke="#d9faff" strokeWidth="1.5"/>
  </g>)}
  <path d="M16 143 142 83 267 144" fill="none" stroke="#d6f9ff" strokeWidth="1.6" opacity=".4"/>
  <path d="M48 189 143 207 229 183" fill="none" stroke="#46d5ff" strokeWidth="2.1" opacity=".77"/>
  <path d="M138 38v16" stroke="#e8f9ff" strokeWidth="2"/>
  <path d="m139 38 16 6-16 7Z" fill="#79ddff"/>
 </svg>;
}
export default CampusBuildingArt;
