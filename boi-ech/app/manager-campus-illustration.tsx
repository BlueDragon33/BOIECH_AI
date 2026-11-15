"use client";

import {useId} from "react";

/** Decorative isometric campus illustration. No invented building data or external imagery. */
export function CampusBuildingArt({variant=0}:{variant?:number}){
 const id=useId().replace(/:/g,"");
 const roof=["#2c82ce","#637fcb","#1d9eac","#5680b3"][((variant%4)+4)%4];
 return <svg viewBox="0 0 280 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+"roof"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b5e7ff"/><stop offset=".55" stopColor={roof}/><stop offset="1" stopColor="#173b78"/></linearGradient>
   <linearGradient id={id+"front"} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e3eeff"/><stop offset="1" stopColor="#7d94ba"/></linearGradient>
   <linearGradient id={id+"side"} x1="0" y1="0" x2="1" y2=".7"><stop stopColor="#899ec3"/><stop offset="1" stopColor="#536c9a"/></linearGradient>
   <linearGradient id={id+"ground"} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#275486"/><stop offset="1" stopColor="#0a2c58"/></linearGradient>
   <filter id={id+"glow"} x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <ellipse cx="141" cy="178" rx="118" ry="22" fill="#01122c" opacity=".5"/>
  <path d="M14 141 140 85 267 140 141 198Z" fill={`url(#${id}ground)`} stroke="#56c9ff" strokeWidth="3"/>
  <path d="M14 141 140 85 267 140 141 198Z" fill="none" stroke="#3fbdff" opacity=".6" strokeWidth="8" filter={`url(#${id}glow)`}/>
  <path d="M42 148 140 105 237 148 140 186Z" fill="#1b385b" stroke="#367fa5" strokeWidth="1.5"/>
  <path d="M72 99 141 70 206 99 140 131Z" fill={`url(#${id}roof)`} stroke="#b6e8ff" strokeWidth="2"/>
  <path d="M72 99 140 131 140 178 72 147Z" fill={`url(#${id}front)`} stroke="#bdd7f5" strokeWidth="1.5"/>
  <path d="M140 131 206 99 206 146 140 178Z" fill={`url(#${id}side)`} stroke="#a2c4ef" strokeWidth="1.5"/>
  <path d="M68 99 141 48 211 99 141 135Z" fill={`url(#${id}roof)`} stroke="#b8e8ff" strokeWidth="3"/>
  <path d="M141 48 211 99 202 103 141 60 75 104 68 99Z" fill="#174c89" stroke="#8dcaf7" strokeWidth="1"/>
  <path d="M141 48 141 135" stroke="#b9dfff" strokeWidth="1" opacity=".5"/>
  <path d="M95 110 109 117 109 136 95 129Z M119 122 132 128 132 148 119 141Z M95 137 109 144 109 160 95 153Z"
    fill="#ffe4a3" stroke="#4c7294" strokeWidth="2"/>
  <path d="M157 135 174 126 174 144 157 154Z M184 122 197 116 197 134 184 141Z M184 145 197 139 197 153 184 160Z"
    fill="#ffdf97" stroke="#365987" strokeWidth="2"/>
  <path d="M157 158 179 146 179 160 157 173Z" fill="#193e69" stroke="#c2dffa" strokeWidth="2"/>
  <path d="M154 158 182 144 182 166 154 180Z" fill="none" stroke="#2b4f7b" strokeWidth="1"/>
  <path d="M141 35 141 51" stroke="#e7f4ff" strokeWidth="2"/><path d="M142 35 157 41 142 46Z" fill="#5dd6ff"/>
  <path d="M51 153c-8-9-5-16 2-18 10 0 14 13 9 20Z M224 156c-7-12-2-19 4-18 9 2 12 12 7 21Z" fill="#40995c" stroke="#80d17b" strokeWidth="2"/>
  <path d="M56 150v15M228 151v18" stroke="#27573c" strokeWidth="3"/>
  <path d="M42 169 140 210 241 170" fill="none" stroke="#1cc6ff" strokeWidth="2" opacity=".7"/>
 </svg>;
}
export default CampusBuildingArt;
