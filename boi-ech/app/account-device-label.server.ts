/** Only persist coarse device category and browser, never a raw User-Agent. */
export function friendlyDeviceLabel(userAgent:string|null):string{
 const ua=(userAgent??"").slice(0,700);
 const browser=/coc_coc_browser|coc_coc|coc coc/i.test(ua)?"Cốc Cốc":
  /EdgA?\/|EdgiOS\//.test(ua)?"Edge":
  /Firefox\/|FxiOS\//.test(ua)?"Firefox":
  /OPR\/|Opera/i.test(ua)?"Opera":
  /CriOS\/|Chrome\//.test(ua)?"Chrome":
  /Safari\//.test(ua)?"Safari":"Trình duyệt khác";
 const category=/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?"Máy tính bảng":
  /Mobile|iPhone|Android/i.test(ua)?"Điện thoại":"Máy tính";
 return category+" · "+browser;
}
