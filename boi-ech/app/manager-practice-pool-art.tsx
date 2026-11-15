"use client";

import {useId} from "react";

/** Decorative schematic of a swimming training hall; all labels and capacity come from real records. */
export function PracticePoolBuildingArt(){
 const uid=useId().replace(/:/g,"");
 const url=(name:string)=>`url(#${uid}${name})`;
 return <svg viewBox="0 0 280 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Minh họa tòa bể bơi có hồ bơi thực hành">
  <defs>
   <linearGradient id={uid+"deck"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#2b73a1"/><stop offset="1" stopColor="#092d5a"/></linearGradient>
   <linearGradient id={uid+"water"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#7af3ff"/><stop offset=".42" stopColor="#209ee2"/><stop offset="1" stopColor="#044c99"/></linearGradient>
   <linearGradient id={uid+"wall"} x1="0" y1="0" x2="1" y2=".6"><stop stopColor="#edfbff"/><stop offset="1" stopColor="#799cc6"/></linearGradient>
   <linearGradient id={uid+"glass"} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#e5fcff" stopOpacity=".73"/><stop offset=".4" stopColor="#249acd" stopOpacity=".5"/><stop offset="1" stopColor="#124374" stopOpacity=".87"/></linearGradient>
   <linearGradient id={uid+"roof"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#c0f3ff"/><stop offset=".35" stopColor="#3c94cc"/><stop offset="1" stopColor="#1a376e"/></linearGradient>
   <filter id={uid+"glow"} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="5"/></filter>
   <radialGradient id={uid+"bloom"}><stop stopColor="#ffe9b2" stopOpacity=".85"/><stop offset="1" stopColor="#fbbb6b" stopOpacity="0"/></radialGradient>
  </defs>
  <ellipse cx="140" cy="177" rx="123" ry="23" fill="#000c2a" opacity=".52"/>
  <path d="M12 149 142 91 267 149 143 203Z" fill={url("deck")} stroke="#68e5ff" strokeWidth="3"/>
  <path d="M12 149 142 91 267 149 143 203Z" fill="none" stroke="#07caff" strokeWidth="10" opacity=".68" filter={url("glow")}/>
  <path d="M12 149v9l131 55 124-55v-9" fill="#0c315b" stroke="#23bfff" strokeWidth="3"/>
  <path d="M39 146 142 103 238 147 144 191Z" fill="#264f6a" stroke="#6ab7dc" strokeWidth="1.8"/>
  {/* Enclosed teaching pool hall, modern glass facade */}
  <path d="M57 117 144 78 211 111 126 148Z" fill={url("roof")} stroke="#d1f7ff" strokeWidth="2.5"/>
  <path d="M57 117 126 148 126 172 57 143Z" fill={url("wall")} stroke="#d4efff" strokeWidth="2"/>
  <path d="M126 148 211 111 211 143 126 172Z" fill="#537fa9" stroke="#a9d8ef" strokeWidth="2"/>
  <path d="M59 114 145 72 216 110 129 150Z" fill={url("roof")} stroke="#bfeeff" strokeWidth="3.5"/>
  <path d="M64 114 145 80 208 109 127 143Z" fill="#3a8ec6" opacity=".45"/>
  <path d="M57 122 125 153v19l-68-29Z" fill={url("glass")} stroke="#a3ddf7" strokeWidth="1.3"/>
  <path d="M127 153 211 116v26l-84 32Z" fill={url("glass")} stroke="#b2e7ff" strokeWidth="1.4"/>
  {[0,1,2,3].map(i=><g key={i}>
   <path d={`M${62+i*16} ${124+i*7}v23`} stroke="#c4e9ff" strokeWidth="2" opacity=".88"/>
   <path d={`M${140+i*17} ${149-i*7}v20`} stroke="#acd7f8" strokeWidth="2" opacity=".8"/>
  </g>)}
  <path d="M61 129 120 156 120 168 61 141Z" fill="#fff3ba" opacity=".18"/>
  <path d="M139 149 205 120 205 141 139 164Z" fill="#ffe99f" opacity=".2"/>
  <path d="M68 112 146 82 203 111" fill="none" stroke="#ebfcff" strokeWidth="1.5" opacity=".65"/>
  {/* Open tiled lap pool in the foreground, showing swim lane lines */}
  <path d="M28 154 127 112 247 159 145 198Z" fill="#e7faff" stroke="#f2ffff" strokeWidth="3"/>
  <path d="M38 155 128 119 235 160 146 192Z" fill={url("water")} stroke="#69ddff" strokeWidth="2"/>
  <path d="M53 155 150 189M75 146 172 181M97 138 193 172M120 128 219 163" stroke="#dffcff" strokeWidth="2.3" strokeDasharray="11 6" opacity=".9"/>
  <path d="M38 155 146 193 236 160" fill="none" stroke="#efffff" strokeWidth="2" opacity=".87"/>
  <path d="M33 163 145 202 246 165" fill="none" stroke="#00c8ff" strokeWidth="2.6"/>
  {/* Handrails and poolside warm lamps */}
  <path d="M42 148v-11q0-8 8-8t8 8v16M50 151v-13M205 163v-11q0-9 8-9t8 9v10" fill="none" stroke="#e0f4ff" strokeWidth="2.2"/>
  {[{x:46,y:164},{x:239,y:164}].map((p,i)=><g key={i}>
   <path d={`M${p.x} ${p.y+7}v-18`} stroke="#d5f0ff" strokeWidth="2.2"/>
   <ellipse cx={p.x} cy={p.y-13} rx="17" ry="17" fill={url("bloom")} opacity=".6"/>
   <circle cx={p.x} cy={p.y-13} r="4" fill="#fff3b5" stroke="#f6ffff" strokeWidth="1.4"/>
  </g>)}
  {[{x:34,y:132},{x:246,y:147},{x:223,y:186}].map((p,i)=><g key={i}>
   <path d={`M${p.x} ${p.y}v18`} stroke="#2b5740" strokeWidth="3"/>
   <circle cx={p.x-5} cy={p.y-12} r="8" fill="#307d4c"/>
   <circle cx={p.x+4} cy={p.y-17} r="10" fill="#42985a"/>
   <circle cx={p.x-2} cy={p.y-20} r="5" fill="#86c97b" opacity=".7"/>
  </g>)}
 </svg>;
}

/** Pool basin illustration for a single physical training room/pool. */
export function PracticePoolBasinArt(){
 return <svg viewBox="0 0 160 108" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bể bơi có các làn thực hành">
  <path d="M12 54 93 18 151 49 69 92Z" fill="#b4e3f7" stroke="#d9f7ff" strokeWidth="3"/>
  <path d="M20 53 93 24 141 49 69 84Z" fill="#159ad2" stroke="#88eafd" strokeWidth="2"/>
  <path d="M35 47 81 71M53 39 102 63M72 30 124 56" stroke="#f6ffff" strokeWidth="2.5" strokeDasharray="8 3" opacity=".9"/>
  <path d="M12 54v15l57 31V92M151 49v16L69 100" fill="none" stroke="#84b6d4" strokeWidth="4"/>
  <path d="M93 18 151 49 69 92 12 54Z" fill="none" stroke="#edffff" strokeWidth="2"/>
 </svg>;
}
