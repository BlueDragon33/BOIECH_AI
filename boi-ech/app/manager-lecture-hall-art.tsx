"use client";
import {useId} from "react";

/** Large, self-contained, isometric academic lecture hall. Pure vector art, never a photograph or inventory data. */
export function MainLectureHallArt(){
 const id=useId().replace(/:/g,"");
 const url=(suffix:string)=>`url(#${id}${suffix})`;
 return <svg viewBox="0 0 520 378" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={id+"roof"} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#b8ecff"/><stop offset=".43" stopColor="#3b90d9"/><stop offset="1" stopColor="#173a86"/></linearGradient>
   <linearGradient id={id+"facade"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#f1f7ff"/><stop offset=".58" stopColor="#b6cbee"/><stop offset="1" stopColor="#7c94c8"/></linearGradient>
   <linearGradient id={id+"side"} x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#b8cdee"/><stop offset="1" stopColor="#5c7fae"/></linearGradient>
   <linearGradient id={id+"glass"} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff9a8"/><stop offset=".65" stopColor="#ffc45a"/><stop offset="1" stopColor="#9e5b24"/></linearGradient>
   <linearGradient id={id+"base"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#2d6496"/><stop offset="1" stopColor="#09284d"/></linearGradient>
   <filter id={id+"glow"} x="-40%" y="-100%" width="180%" height="300%"><feGaussianBlur stdDeviation="6"/></filter>
   <filter id={id+"warmGlow"} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10"/></filter>
   <linearGradient id={id+"roofHighlight"} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e4faff" stopOpacity=".64"/><stop offset=".45" stopColor="#60b6fa" stopOpacity=".13"/><stop offset="1" stopColor="#10255c" stopOpacity=".31"/></linearGradient>
   <linearGradient id={id+"pillar"} x1="0" y1="0" x2="1" y2="0"><stop stopColor="#6481b4"/><stop offset=".22" stopColor="#ddeaff"/><stop offset=".47" stopColor="#fff"/><stop offset=".74" stopColor="#d0dff4"/><stop offset="1" stopColor="#637fae"/></linearGradient>
   <radialGradient id={id+"lightBloom"}><stop stopColor="#fff0b8" stopOpacity=".9"/><stop offset="1" stopColor="#ffb958" stopOpacity="0"/></radialGradient>
   <pattern id={id+"shingles"} width="16" height="10" patternUnits="userSpaceOnUse" patternTransform="skewX(-16)"><path d="M0 1H16M8 1v4M0 9H16" fill="none" stroke="#d7f5ff" strokeWidth=".85" opacity=".29"/><path d="M0 5H16" stroke="#0c3774" strokeWidth=".75" opacity=".24"/></pattern>
   <clipPath id={id+"leftRoof"}><path d="M76 150 171 80 261 127 210 164 171 121 88 166Z"/></clipPath>
   <clipPath id={id+"rightRoof"}><path d="M252 127 356 80 453 150 439 170 356 121 303 164Z"/></clipPath>
    </defs>
  <ellipse cx="258" cy="323" rx="221" ry="37" fill="#000c2a" opacity=".45"/>
  <path d="M14 276 260 176 504 279 263 370Z" fill={url("base")} stroke="#79dbff" strokeWidth="4" strokeLinejoin="round"/>
  <path d="M14 276 260 176 504 279 263 370Z" fill="none" stroke="#12c9ff" strokeWidth="10" opacity=".43" filter={url("glow")}/>
  <path d="M15 276v14l247 81 242-80v-12" fill="none" stroke="#2cb7f9" strokeWidth="4"/>
  <path d="M42 268 261 182 470 269 259 350Z" fill="#244b70" stroke="#5c91c3" strokeWidth="2"/>
  {/* Rear wings, with fully articulated facades and a coherent 3D roof plane */}
  <path d="M86 152 170 107 211 132 211 252 86 301Z" fill={url("facade")} stroke="#e0edff" strokeWidth="3"/>
  <path d="M211 132 254 103 254 239 211 252Z" fill={url("side")} stroke="#a3c3ed" strokeWidth="2"/>
  <path d="M302 135 356 106 442 151 442 299 302 250Z" fill={url("facade")} stroke="#e0edff" strokeWidth="3"/>
  <path d="M302 135 260 105 260 241 302 250Z" fill={url("side")} stroke="#a3c3ed" strokeWidth="2"/>
  <path d="M76 150 171 80 261 127 210 164 171 121 88 166Z" fill={url("roof")} stroke="#d0f1ff" strokeWidth="4"/>
  <path d="M252 127 356 80 453 150 439 170 356 121 303 164Z" fill={url("roof")} stroke="#c1e9ff" strokeWidth="4"/>
  <g clipPath={`url(#${id}leftRoof)`}><path d="M67 78h215v105H67Z" fill={url("shingles")}/><path d="M70 78h210v105H70Z" fill={url("roofHighlight")}/></g>
  <g clipPath={`url(#${id}rightRoof)`}><path d="M240 70h225v110H240Z" fill={url("shingles")}/><path d="M240 70h225v110H240Z" fill={url("roofHighlight")}/></g>
  <path d="M76 150 171 80 261 127M252 127 356 80 453 150" fill="none" stroke="#edfbff" strokeWidth="2" opacity=".85"/>
    <path d="M94 170 170 128 201 147 201 261 94 299Z" fill={url("facade")} stroke="#a4bff1" strokeWidth="2"/>
  <path d="M319 145 357 128 432 169 432 299 319 258Z" fill={url("facade")} stroke="#acc9ed" strokeWidth="2"/>
  <ellipse cx="143" cy="221" rx="65" ry="87" fill={url("lightBloom")} opacity=".12"/>
  <ellipse cx="379" cy="215" rx="65" ry="80" fill={url("lightBloom")} opacity=".12"/>
    {/* Illuminated side windows, warm like the reference rendering */}
  {[0,1,2].map(n=>(
   <g key={n}>
    <path d={`M${102+n*27} ${184+n*2} l14 -6 v32 l-14 6 Z`} fill={url("glass")} stroke="#315d92" strokeWidth="3"/>
    <path d={`M${102+n*27} ${228+n*2} l14 -6 v32 l-14 6 Z`} fill={url("glass")} stroke="#315d92" strokeWidth="3"/>
    <path d={`M${332+n*29} ${184+n*2} l14 6 v31 l-14 -6 Z`} fill={url("glass")} stroke="#315d92" strokeWidth="3"/>
    <path d={`M${332+n*29} ${228+n*2} l14 6 v31 l-14 -6 Z`} fill={url("glass")} stroke="#315d92" strokeWidth="3"/>
   </g>
  ))}
  {/* Central pediment, iconic clock-like university entrance */}
  <path d="M168 152 258 85 349 154 333 165 259 117 183 168Z" fill={url("roof")} stroke="#dbf5ff" strokeWidth="4"/>
  <path d="M185 165 260 119 332 163 332 283 185 282Z" fill={url("facade")} stroke="#e4efff" strokeWidth="3"/>
  <path d="M169 164 258 104 351 166 351 178 258 128 169 181Z" fill="#285d9c" stroke="#b9eaff" strokeWidth="3"/>
  <path d="M204 166 259 138 312 166Z" fill="#f1f6ff" stroke="#6e97ce" strokeWidth="2"/>
  <path d="M205 169h107" stroke="#7893bc" strokeWidth="3"/>
  <path d="M226 155h65" stroke="#bdccec" strokeWidth="1.5"/>
  <circle cx="259" cy="151" r="11" fill="#235e9b" stroke="#f5faff" strokeWidth="3"/>
  <path d="m248 151 11-6 12 6-12 6Z m3 3v5 q8 6 17 0v-5" fill="none" stroke="#dff6ff" strokeWidth="2"/>
  <path d="M185 177h148v6H185Z" fill="#d8e8fb" stroke="#6f95bc" strokeWidth="1.3"/>
  <path d="M205 170h108" stroke="#c8dff7" strokeWidth="1"/>
    {/* Tall glass entrance and four monumental columns */}
  <path d="M230 200q29-37 57 0v82h-57Z" fill={url("glass")} stroke="#385d91" strokeWidth="4"/>
  <ellipse cx="258" cy="246" rx="39" ry="68" fill={url("lightBloom")} filter={url("warmGlow")} opacity=".44"/>
    <path d="M239 199q19-24 39 0v76h-39Z" fill="#ffd779" stroke="#fff2bc" strokeWidth="1"/>
  <path d="M258 182v95M230 216h57" stroke="#8d663f" strokeWidth="2" opacity=".8"/>
  {[193,214,306,327].map(x=>(
    <g key={x}>
     <path d={`M${x-7} 193 h14 l-2 89 h-10Z`} fill={url("pillar")} stroke="#738eb4" strokeWidth="1.8"/>
     <path d={`M${x-9} 187 h18 v8 h-18Z M${x-10} 280h20v7h-20Z`} fill="#f0f5ff" stroke="#7b95c2" strokeWidth="1.5"/>
    </g>
  ))}
  <path d="M181 187 335 187v7H181Z M174 285h172v8H174Z" fill="#dbe7f8" stroke="#6b89b6" strokeWidth="2"/>
  {/* Broad illuminated stairs, directly facing the viewer */}
  <path d="M227 291 289 291 332 336 184 336Z" fill="#a3bde0" stroke="#e3f5ff" strokeWidth="3"/>
  <path d="M221 300h77M211 309h96M198 320h120M187 331h143" stroke="#eaf5ff" strokeWidth="4"/>
  <path d="M223 293 260 311 293 293" fill="none" stroke="#f8e7bf" strokeWidth="2"/>
  <path d="M239 304 280 304M224 314h72M205 324h109" stroke="#fff4cf" strokeWidth="2.2" opacity=".55"/>
  <ellipse cx="258" cy="312" rx="88" ry="31" fill={url("lightBloom")} opacity=".2"/>
    {/* Decorative blue flags and trees on the campus platform */}
  <path d="M174 220h14v65h-14Z M333 220h14v65h-14Z" fill="#1c5da2" stroke="#8bc4ff" strokeWidth="1"/>
  <path d="M258 65v23" stroke="#f2fbff" strokeWidth="2.5"/>
  <path d="m260 65 21 6-21 9Z" fill="#82d6ff"/>
  {[{x:75,y:282},{x:127,y:312},{x:379,y:311},{x:442,y:281},{x:62,y:258},{x:453,y:258}].map((tree,i)=>(
   <g key={i}>
    <path d={`M${tree.x} ${tree.y-30}v34`} stroke="#28583a" strokeWidth="5"/>
    <ellipse cx={tree.x} cy={tree.y-24} rx="12" ry="18" fill="#267244" stroke="#78d16e" strokeWidth="2"/>
    <circle cx={tree.x-8} cy={tree.y-27} r="9" fill="#267c4a"/>
    <circle cx={tree.x+7} cy={tree.y-33} r="13" fill="#348d53"/>
    <circle cx={tree.x-2} cy={tree.y-38} r="8" fill="#69be6b"/>
    <circle cx={tree.x+12} cy={tree.y-20} r="10" fill="#246f42"/>
    <ellipse cx={tree.x+7} cy={tree.y-15} rx="10" ry="13" fill="#2c744a" stroke="#86cb6b" strokeWidth="1"/>
   </g>
  ))}
  {[66,448].map(x=>(
   <g key={x}><path d={`M${x} 295v-39`} stroke="#c7e8fa" strokeWidth="3"/><ellipse cx={x} cy="253" rx="20" ry="23" fill={url("lightBloom")} opacity=".49"/><circle cx={x} cy="253" r="5" fill="#ffe8a5" stroke="#fff5d3" strokeWidth="2"/></g>
  ))}
 </svg>;
}
