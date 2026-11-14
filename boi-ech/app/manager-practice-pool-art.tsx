"use client";

import {useId} from "react";

/** Decorative schematic of a swimming training hall; all labels and capacity come from real records. */
export function PracticePoolBuildingArt(){
 const uid=useId().replace(/:/g,"");
 return <svg viewBox="0 0 280 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Minh họa tòa bể bơi có hồ bơi thực hành">
  <defs>
   <linearGradient id={uid+"deck"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#275e96"/><stop offset="1" stopColor="#102e5b"/></linearGradient>
   <linearGradient id={uid+"water"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#3fe5ff"/><stop offset=".6" stopColor="#1388d2"/><stop offset="1" stopColor="#075391"/></linearGradient>
   <linearGradient id={uid+"wall"} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#caecff"/><stop offset="1" stopColor="#4e719f"/></linearGradient>
  </defs>
  <ellipse cx="140" cy="180" rx="128" ry="23" fill="#00152e" opacity=".45"/>
  <path d="M13 135 137 77 269 136 142 199Z" fill={`url(#${uid}deck)`} stroke="#48cfff" strokeWidth="3"/>
  <path d="M40 123 128 82 204 116 114 157Z" fill={`url(#${uid}wall)`} stroke="#b9e5ff" strokeWidth="1.8"/>
  <path d="M114 157 204 116 204 148 114 185Z" fill="#5e84b4" stroke="#a8d4f6" strokeWidth="1.8"/>
  <path d="M40 123 114 157 114 185 40 151Z" fill="#a8bedc" stroke="#ecfaff" strokeWidth="1.6"/>
  <path d="M35 121 127 58 213 108 114 157Z" fill="#1c75a8" opacity=".72" stroke="#b4eaff" strokeWidth="3"/>
  <path d="M40 121 127 69 204 110 114 151Z" fill="#296c9d" opacity=".46" stroke="#9de4ff" strokeWidth="1"/>
  <path d="M70 106 89 95 107 104 87 116Z M100 89 120 77 138 86 117 98Z M150 95 169 104 148 114 130 105Z"
   fill="#dff7ff" opacity=".8"/>
  <path d="M124 127 185 100 213 116 152 146Z" fill="#ffffff" opacity=".24"/>
  <path d="M79 145 95 152 95 172 79 165Z M50 134 66 141 66 160 50 154Z" fill="#ffdd91" stroke="#48709a" strokeWidth="2"/>
  <path d="M151 149 188 131 188 150 151 168Z" fill="#0b345d" stroke="#9bd5f9" strokeWidth="2"/>
  <path d="M151 150 151 166M160 145 160 162M169 141 169 158" stroke="#61c4e6" strokeWidth="1"/>
  <path d="M28 155 129 111 250 158 145 202Z" fill="#153b66" stroke="#5bc5f1" strokeWidth="2"/>
  <path d="M46 157 130 122 231 159 145 193Z" fill="#d0e8f6" stroke="#effaff" strokeWidth="2"/>
  <path d="M53 157 131 126 222 159 145 187Z" fill={`url(#${uid}water)`} stroke="#b9f8ff" strokeWidth="1.5"/>
  <path d="M65 154 149 185 M84 146 168 178 M105 137 189 170 M125 128 211 161" stroke="#daffff" strokeWidth="2" strokeDasharray="8 4" opacity=".9"/>
  <path d="M42 176 145 211 250 176" fill="none" stroke="#27d9ff" strokeWidth="2" opacity=".8"/>
  <path d="M50 145v8M230 145v7" stroke="#e3faff" strokeWidth="2"/>
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
