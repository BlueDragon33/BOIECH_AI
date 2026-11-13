/** Best-effort device display name. A browser user agent is not an authentication factor. */
export function deviceDisplayLabel(userAgent:string|null|undefined){
 const ua=String(userAgent??"").slice(0,500);
 const browser=/coc_coc|cococ|coccoc/i.test(ua)?"Cốc Cốc":
  /Edg\//i.test(ua)?"Edge":/Firefox\//i.test(ua)?"Firefox":
  /OPR\//i.test(ua)?"Opera":
  /CriOS\//i.test(ua)?"Chrome":/Chrome\//i.test(ua)?"Chrome":
  /Safari\//i.test(ua)?"Safari":"Trình duyệt";
 const device=/iPad/i.test(ua)?"Máy tính bảng iPad":
  /Android/i.test(ua)?(/Mobile/i.test(ua)?"Điện thoại Android":"Máy tính bảng Android"):
  /iPhone/i.test(ua)?"Điện thoại iPhone":
  /Windows/i.test(ua)?"Máy tính Windows":
  /Macintosh|Mac OS X/i.test(ua)?"Máy tính macOS":
  /Linux/i.test(ua)?"Máy tính Linux":"Thiết bị khác";
 return device+" · "+browser;
}
