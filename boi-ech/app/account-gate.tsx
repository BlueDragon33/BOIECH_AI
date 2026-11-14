"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {createPortal} from "react-dom";
import RegistrantReader from "./registrant-reader";
import ManagerWorkspace from "./manager-workspace";
import AccountProfileDialog, {type ProfileSection} from "./account-profile-dialog";
import VerifiedSyncSettings from "./verified-sync-settings";
import AccountTrialSandbox, {type TrialLease} from "./account-trial-sandbox";
import { accountTransitionNeedsReload } from "./account-scope";
import { isUnlimitedAccountExpiry } from "./account-term";
import { accountServerActive, recoveryMustRemainVisible } from "./account-lifecycle-client";
import AccountVerificationShowcase from "./account-verification-showcase";
import ConditionalSyncAgent from "./conditional-sync-agent";
import { RegistrationRoles } from "./registration-roles";
import { portableCredential, portableManagerProof, portableChildhoodRecoveryProof, preparePortableAccount } from "./multi-account-switcher";
import styles from "./account-gate.module.css";
type Account = { accountId: string; status: string; role: string; name: string; expiresAt: string | null;
  storageDeviceId?:string|null; primaryContactKind?:"email"|"phone"|null;
  deviceId?: string; deviceApproved?: boolean; onboardingStage?: string|null; onboardingRevision?: number|null;
  onboardingNote?: string|null; entitlementActive?: boolean; profileDraftReady?:boolean;
  profileDraftFields?:Record<string,string>|null;
  canReadRegistrants?: boolean; securityQuestionConfigured?:boolean;
  sessionExpiresAt?:number; sessionIdleExpiresAt?:number };
type Device = { device_id: string; revoked: number; approved?: number; created_at: string; device_label?:string|null };
type Mode = "login" | "register" | "claim" | "recover" | "devices";
type AuthContact = "email" | "phone";
type DeviceDisplay={label:string;browser:string};
function currentDeviceDisplay():DeviceDisplay{
 if(typeof navigator==="undefined")return {label:"Thiết bị đang sử dụng",browser:"Trình duyệt hiện tại"};
 const ua=navigator.userAgent;
 const browser=/coc_coc_browser|coc coc|coc_coc/i.test(ua)?"Cốc Cốc":
  /Edg\//.test(ua)?"Edge":/Firefox\//.test(ua)?"Firefox":
  /OPR\//.test(ua)?"Opera":/Chrome\//.test(ua)?"Chrome":
  /Safari\//.test(ua)?"Safari":"Trình duyệt";
 const category=/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)?"Máy tính bảng":
  /Mobile|iPhone|Android/i.test(ua)?"Điện thoại":"Máy tính";
 return {label:category+" · "+browser,browser};
}

const fieldLabels: Record<string,string> = {
  login:"tên đăng nhập", password:"mật khẩu", passwordConfirm:"mật khẩu xác nhận",
  contactValue:"thông tin liên hệ", securityAnswer:"câu trả lời bảo mật",
  privacyAccepted:"xác nhận xử lý dữ liệu", recoveryCode:"mã khôi phục"
};
function authFieldError(input: HTMLInputElement, form: HTMLFormElement, contactType: AuthContact): string {
  const name=input.name, value=input.value;
  if (input.validity.valueMissing || (input.required && input.type!=="checkbox" && !value.trim()))
    return "Vui lòng nhập " + (fieldLabels[name] ?? "thông tin bắt buộc") + ".";
  if (input.validity.tooShort || input.validity.tooLong)
    return name==="password" || name==="passwordConfirm"
      ? "Mật khẩu phải có ít nhất 15 ký tự khi đăng ký và tối đa 1.024 ký tự."
      : "Độ dài thông tin chưa hợp lệ.";
  if (name==="login" && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}$/.test(value))
    return "Tên đăng nhập cần 3–64 ký tự, bắt đầu bằng chữ hoặc số; chỉ dùng chữ, số, dấu chấm, _ hoặc -.";
  if (name==="passwordConfirm" && value !== (form.elements.namedItem("password") as HTMLInputElement|null)?.value)
    return "Mật khẩu nhập lại không khớp. Hãy kiểm tra ô này.";
  if (name==="contactValue" && contactType==="email" &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || /[<>(),;:]/.test(value)))
    return "Email không hợp lệ. Ví dụ: ten@example.com.";
  if (name==="contactValue" && contactType==="phone" &&
    !/^\+?[0-9]{7,16}$/.test(value.replace(/[\s().-]/g,"")))
    return "Số điện thoại phải có 7–16 chữ số, có thể bắt đầu bằng dấu +.";
  if (name==="securityAnswer" && value.trim().length<2)
    return "Câu trả lời bảo mật cần ít nhất 2 ký tự.";
  if (input.validity.patternMismatch || input.validity.typeMismatch || input.validity.badInput)
    return "Giá trị " + (fieldLabels[name] ?? "này") + " chưa đúng định dạng.";
  return "";
}
function accountNetworkError(error: unknown) {
  const raw=error instanceof Error?error.message:"";
  if (/timeout|timed out|aborted due to timeout|TimeoutError/i.test(raw) || (error instanceof Error && error.name === "TimeoutError"))
    return "Máy chủ xác thực phản hồi quá thời gian. Hãy thử Đồng bộ trạng thái, không gửi đăng ký lại.";
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(raw))
    return "Không kết nối được máy chủ tài khoản. Nếu vừa đăng ký, hãy thử Đăng nhập hoặc Đồng bộ trạng thái trước khi gửi lại để tránh trùng yêu cầu.";
  return raw || "Chưa xác minh được kết nối tài khoản.";
}
// Cloudflare or an upstream outage may return HTML (or no body). Never display
// raw infrastructure errors or leave account onboarding waiting for JSON.
// A 401 still means "no active session", even if its response has no JSON.
async function readAccountPayload(response: Response): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try { parsed=await response.json(); } catch { /* Non-JSON body, handled below. */ }
  if(parsed && typeof parsed==="object" && !Array.isArray(parsed))
    return parsed as Record<string, unknown>;
  if(response.status===401) return {};
  if(response.status===429)
    throw new Error("Hệ thống đang giới hạn lượt thử. Không gửi liên tiếp; hãy thử lại sau 15 phút.");
  if(response.status>=500)
    throw new Error("Máy chủ tài khoản tạm gián đoạn. Nếu vừa đăng ký, hãy kiểm tra lại trạng thái trước khi gửi lại để tránh tạo yêu cầu trùng.");
  throw new Error("Máy chủ trả dữ liệu không đúng định dạng. Hãy chọn Đồng bộ trạng thái hoặc thử lại sau.");
}

/** Bound all account-auth network waits so a dead request cannot freeze sign-in. */
async function accountReadWithinDeadline<T extends Record<string, unknown>>(
  url: string, options: RequestInit = {}, timeoutMs = 15000
): Promise<{ response: Response; data: T }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    // Keep the deadline active while parsing the body; network headers alone
    // do not guarantee that a readable authorization verdict has arrived.
    const data = await readAccountPayload(response) as T;
    return { response, data };
  } catch (cause) {
    if (controller.signal.aborted) {
      throw new Error("Máy chủ tài khoản chưa phản hồi trong 15 giây. Chọn Đồng bộ trạng thái hoặc Thử đọc lại phiên, không đăng ký lại.");
    }
    throw cause;
  } finally {
    window.clearTimeout(timeout);
  }
}
async function send(body: Record<string, unknown>) {
  // Keep this send helper self-contained for the existing runtime failure harness.
  // AbortSignal.timeout remains active while the response body is parsed.
  const response = await fetch("/api/accounts", { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000) });
  const data = await readAccountPayload(response) as { error?: string; code?: string; [key:string]:unknown };
  if (!response.ok) throw Object.assign(new Error(data.error ?? "Chưa xác minh được thao tác tài khoản."), {
    code: typeof data.code==="string" ? data.code : "ACCOUNT_SERVICE_UNAVAILABLE"
  });
  return data as { ok?:boolean; recoveryCode?: string; accountId?: string; account?: Account; matched?:boolean; verified?:boolean;
    devices?:Array<{device_id:string;approved:number;created_at:string}>;trial?:TrialLease;challenge?:string };
}
function reloadPreservingPendingManagerInvite(token: string) {
  const oneUseFragment=/^[a-f0-9]{64}$/.test(token) ? "#manager-invite="+token : "";
  if(oneUseFragment){
    // Fragment-only transfer: it is excluded from the HTTP request and scrubbed
    // immediately by the next AccountGate mount. Never write it to Web Storage.
    window.location.replace(window.location.pathname+window.location.search+oneUseFragment);
  } else window.location.reload();
}

function AccountLeaseCountdown({expiresAt,role}:{expiresAt:string;role:string}) {
 const [slot,setSlot]=useState<HTMLElement|null>(null);
 const [now,setNow]=useState(0);
 useEffect(()=>{
  const update=()=>setSlot(document.getElementById("boi-account-lease-slot"));
  update();
  const observer=new MutationObserver(update);
  observer.observe(document.body,{childList:true,subtree:true});
  return()=>observer.disconnect();
 },[role]);
 const unlimited=isUnlimitedAccountExpiry(expiresAt);
 useEffect(()=>{
  if(unlimited)return; // Permanent grants do not need a ticking countdown.
  queueMicrotask(()=>setNow(Date.now()));
  const tick=window.setInterval(()=>setNow(Date.now()),1000);
  return()=>window.clearInterval(tick);
 },[unlimited]);
 const ms=unlimited?0:Math.max(0,new Date(expiresAt).getTime()-now);
 const days=Math.floor(ms/86400000),hours=Math.floor(ms%86400000/3600000);
 const minutes=Math.floor(ms%3600000/60000),seconds=Math.floor(ms%60000/1000);
 const left=`${days} ngày ${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
 const expiry=unlimited?null:new Intl.DateTimeFormat("vi-VN",{dateStyle:"short",timeStyle:"short"}).format(new Date(expiresAt));
 return slot?createPortal(<aside className={`${styles.leaseClock} ${styles.leaseClockHeader}`} role="status"
   aria-label={unlimited?"Thời hạn sử dụng: Không giới hạn":"Thời gian sử dụng còn lại"}
   data-expiring={!unlimited&&ms<=86400000} data-unlimited={unlimited}>
   <strong>{unlimited||ms>0?"Thời hạn sử dụng":"Đã hết hạn"}</strong>
   <output aria-live="off">{unlimited?"Không giới hạn":ms>0?left:"00 ngày 00:00:00"}</output>
   <small>{unlimited?"Quyền sử dụng vĩnh viễn":`Đến ${expiry} · ${role==="manager"?"Owner gia hạn":"Cán bộ quản lý gia hạn"}`}</small>
 </aside>,slot):null;
}
export default function AccountGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  // Certificate verification is public and read-only; issuance remains protected by signed device proof.
  const bypass = pathname === "/chung-chi" || pathname === "/xem-thu-can-bo-quan-ly" || pathname.startsWith("/quan-ly-thiet-bi") || pathname.startsWith("/bien-tap-");
  const [account, setAccount] = useState<Account | null>(null), [devices, setDevices] = useState<Device[]>([]);
  const [v2,setV2]=useState(false);
  const [singleReview,setSingleReview]=useState(false);
  const [trialEnabled,setTrialEnabled]=useState(false);
  const [trial,setTrial]=useState<TrialLease|null>(null);
  const [trialUsed,setTrialUsed]=useState(false);
  const [profileOpen,setProfileOpen]=useState(false);
  const closeProfile=useCallback(()=>setProfileOpen(false),[]);
  // Sync a privacy-safe label on a trusted device; no raw UA leaves the edge.
  // The remote device list will gain names as each device signs in again.
  useEffect(()=>{
   if(!profileOpen)return;
   let cancelled=false;
   void send({action:"device-label-update"}).then(()=>{
     if(!cancelled)void reload();
   }).catch(()=>{/* A label failure must never lock account access. */});
   return()=>{cancelled=true;};
  },[profileOpen]);
  const [recoveryDevices,setRecoveryDevices]=useState<Array<{device_id:string;approved:number;created_at:string}>>([]);
  const [observedNow,setObservedNow] = useState(0);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [enteredAccountId, setEnteredAccountId] = useState("");
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [mode, setMode] = useState<Mode>("login"), [role, setRole] = useState<"learner" | "manager" | "teacher">("learner");
  const [contactType,setContactType]=useState<"email"|"phone">("email");
  const [recoveryMethod,setRecoveryMethod]=useState<"code"|"question">("code");
  const [recovery, setRecovery] = useState(""), [notice, setNotice] = useState("");
  const [managerInvite,setManagerInvite]=useState("");
  const managerInviteRef=useRef("");
  const recoveryOwner = useRef("");
  const lock = useRef(false), mounted = useRef(false), current = useRef("");
  const refreshInFlight=useRef(false);
  const lastUserEngagementAt=useRef(0);
  const lastLeaseRenewalAttemptAt=useRef(0);
  const readbackGeneration=useRef(0);
  const attemptedAutoActivation=useRef(new Set<string>());
  const reload = useCallback(async (claim = false) => {
    const readbackId=++readbackGeneration.current;
    const {response,data} = await accountReadWithinDeadline<{ account?: Account | null; devices?: Device[]; accountV2?:boolean; accountSingleReview?:boolean; accountUiTrial?:boolean; error?: string }>("/api/accounts", { credentials: "same-origin", cache: "no-store" });
    // A polling GET can finish after a successful profile submit/readback.
    // Never allow that stale reply to roll the UI back to a pending state.
    if (!mounted.current || readbackId !== readbackGeneration.current) return;
    setV2(data.accountV2 === true); setSingleReview(data.accountSingleReview === true);
    setTrialEnabled(data.accountUiTrial === true);
    if (!response.ok) {
      if (response.status === 401) { setRecovery(""); recoveryOwner.current = ""; if(current.current){setReady(false);reloadPreservingPendingManagerInvite(managerInviteRef.current);return;} await preparePortableAccount(null); current.current = ""; if (mounted.current) { setAccount(null); setReady(true); } return; }
      throw new Error(data.error ?? "Không đọc được phiên đăng nhập.");
    }
    // Keep a document's namespace immutable: old async completions can only write its old account store.
    if (accountTransitionNeedsReload(current.current,data.account?.accountId ?? "")) {
      setReady(false); setRecovery(""); recoveryOwner.current=""; reloadPreservingPendingManagerInvite(managerInviteRef.current); return;
    }
    if ((current.current && data.account?.accountId !== current.current) ||
      (recoveryOwner.current && data.account && data.account.accountId !== recoveryOwner.current)) {
      setRecovery(""); recoveryOwner.current = "";
      if(mounted.current) setReady(false);
    }
    await preparePortableAccount(data.account?.accountId ?? null, claim);
    if (!mounted.current || readbackId !== readbackGeneration.current) return;
    current.current = data.account?.accountId ?? "";
    setObservedNow(Date.now()); setAccount(data.account ?? null);
    setDevices(data.devices ?? []); setReady(true); setError("");
  }, []);
  useEffect(()=>{
    if(!enabled||bypass)return;
    // Read the invitation from the browser fragment, not from a server URL or a log.
    let live=true;
    queueMicrotask(()=>{
      if(!live)return;
      const params=new URLSearchParams(window.location.hash.slice(1));
      const invite=params.get("manager-invite");
      if(invite!==null){
        window.history.replaceState(window.history.state,"",window.location.pathname+window.location.search);
        if(/^[a-f0-9]{64}$/.test(invite)){
          managerInviteRef.current=invite;setManagerInvite(invite);setRole("manager");setMode("register");
        }else setError("Liên kết mời quản lý không hợp lệ. Hãy xin lại từ Owner.");
      }
    });
    return ()=>{live=false};
  },[enabled,bypass]);
  const waitingForApproval = Boolean(account && (account.status !== "approved" ||
    account.onboardingStage !== "active" || account.deviceApproved === false || account.entitlementActive === false));
  useEffect(() => {
    if (!enabled || bypass) return;
    mounted.current = true;
    document.documentElement.dataset.accountFirst = "true";
    // Activity signals are UX hints, not authentication. Only a valid,
    // non-revoked server cookie can refresh its bounded lease. A hidden or
    // abandoned tab must not keep the session alive indefinitely.
    const engagement=()=>{if(!document.hidden)lastUserEngagementAt.current=Date.now();};
    const keepAliveIfEngaged=async()=>{
      const now=Date.now();
      if(!current.current || now-lastLeaseRenewalAttemptAt.current<4*60_000)return;
      const mediaPlaying=Array.from(document.querySelectorAll("video")).some(video=>
        !video.paused && !video.ended && video.readyState>1);
      // Users awaiting the one-time review must stay signed in while the page
      // receives a real refresh signal. Approved users renew while actively interacting or
      // watching a lesson, not after abandoning a background tab.
      if(!waitingForApproval && !mediaPlaying &&
        now-lastUserEngagementAt.current>15*60_000)return;
      lastLeaseRenewalAttemptAt.current=now;
      try{await send({action:"keepalive"});}
      catch{
        // Never treat an uncertain keepalive transport as logout. The
        // authoritative readback below distinguishes expired from unavailable.
      }
    };
    // Conditional sync: no recurring server polling. Only real external
    // notifications, cross-tab changes, manual refresh, reconnect or resume.
    // An incoming event is a hint: the server always revalidates authorization.
    let queuedAfterCurrent = false;
    const refresh = () => {
      if (document.hidden || lock.current) return;
      if (refreshInFlight.current) { queuedAfterCurrent = true; return; }
      refreshInFlight.current = true;
      void keepAliveIfEngaged().then(() => reload())
        .catch(e => { if (mounted.current) setError(accountNetworkError(e)); })
        .finally(() => {
          refreshInFlight.current = false;
          if (queuedAfterCurrent && mounted.current) {
            queuedAfterCurrent = false;
            refresh();
          }
        });
    };
    const onVisibility = () => { if (!document.hidden) refresh(); };
    const onRemoteNotification = (event: MessageEvent) => {
      if (event.data?.type === "boi-ech-account-changed") refresh();
    };
    lastUserEngagementAt.current = Date.now();
    window.addEventListener("pointerdown",engagement,{passive:true});
    window.addEventListener("keydown",engagement);
    window.addEventListener("wheel",engagement,{passive:true});
    window.addEventListener("touchstart",engagement,{passive:true});
    window.addEventListener("scroll",engagement,{passive:true,capture:true});
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("pageshow",refresh);
    window.addEventListener("online",refresh);
    document.addEventListener("visibilitychange",onVisibility);
    window.addEventListener("boi:account:changed",refresh);
    navigator.serviceWorker?.addEventListener("message",onRemoteNotification);
    // A cross-tab mutation propagates instantly without background GET polling.
    // Cloudflare cannot push remote approvals without an active push transport.
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel("boiech-account-auth");
        channel.onmessage = refresh;
      }
    } catch { /* Focus/online/manual refresh remain available. */ }
    return () => {
      mounted.current = false;
      window.removeEventListener("pointerdown",engagement);
      window.removeEventListener("keydown",engagement);
      window.removeEventListener("wheel",engagement);
      window.removeEventListener("touchstart",engagement);
      window.removeEventListener("scroll",engagement,true);
      window.removeEventListener("focus", refresh); window.removeEventListener("pageshow",refresh);
      window.removeEventListener("online",refresh);
      document.removeEventListener("visibilitychange",onVisibility);
      window.removeEventListener("boi:account:changed",refresh);
      navigator.serviceWorker?.removeEventListener("message",onRemoteNotification);
      channel?.close();
    };
  }, [enabled, bypass, reload, waitingForApproval]);
  useEffect(()=>{
    if(!ready||!v2||!singleReview||!account?.accountId||
      account.onboardingStage!=="profile_required"||account.profileDraftReady!==true||
      account.deviceApproved!==true)return;
    const key=account.accountId+":"+account.onboardingRevision;
    if(attemptedAutoActivation.current.has(key))return;
    attemptedAutoActivation.current.add(key);
    // Exactly one server-side human review has happened. The canonical
    // complete profile is already stored in D1, so there is no second review.
    void send({action:"profile-draft-activate"})
      .then(async()=>{await reload();if(mounted.current)setNotice("Hồ sơ đã tự kích hoạt sau lần duyệt duy nhất.");})
      .catch(e=>{attemptedAutoActivation.current.delete(key);
        if(mounted.current)setError(accountNetworkError(e));});
  },[ready,v2,singleReview,account?.accountId,account?.onboardingStage,
     account?.profileDraftReady,account?.onboardingRevision,account?.deviceApproved,reload,observedNow]);
  useEffect(()=>{
    const open=()=>setProfileOpen(true);
    window.addEventListener("boi:account:open",open);
    return()=>window.removeEventListener("boi:account:open",open);
  },[]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { if (mounted.current) setError(accountNetworkError(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function broadcast() {
    // Same-page state refresh already completed. Cross-tab notification is
    // best effort and must not turn a successful login into an error.
    try {
      if (typeof BroadcastChannel === "undefined") return;
      const channel=new BroadcastChannel("boiech-account-auth");
      channel.postMessage("changed"); channel.close();
    } catch { /* Other tabs will refresh on focus or the current polling cycle. */ }
  }
  useEffect(()=>{ queueMicrotask(()=>setFieldErrors({})); },[mode,contactType]);
  function onAuthInvalid(input:HTMLInputElement,form:HTMLFormElement) {
    const message=authFieldError(input,form,contactType);
    if(message)setFieldErrors(previous=>({...previous,[input.name]:message}));
  }
  function onAuthBlur(input:HTMLInputElement,form:HTMLFormElement) {
    if(!input.name||input.type==="hidden")return;
    const message=authFieldError(input,form,contactType);
    setFieldErrors(previous=>{
      if(!message && !previous[input.name])return previous;
      const next={...previous};if(message)next[input.name]=message;else delete next[input.name];
      return next;
    });
  }
  function onAuthInput(input:HTMLInputElement) {
    if(!input.name)return;
    setFieldErrors(previous=>{
      if(!previous[input.name] && !(input.name==="password"&&previous.passwordConfirm))return previous;
      const next={...previous};delete next[input.name];
      if(input.name==="password")delete next.passwordConfirm;
      return next;
    });
  }
  async function submit(form: HTMLFormElement) {
    const issues:Record<string,string>={};
    for(const input of Array.from(form.querySelectorAll<HTMLInputElement>("input[name]"))){
      if(input.type==="hidden")continue;
      const message=authFieldError(input,form,contactType);
      if(message)issues[input.name]=message;
    }
    if(Object.keys(issues).length){
      setFieldErrors(issues);
      (form.elements.namedItem(Object.keys(issues)[0]) as HTMLInputElement|null)?.focus();
      return;
    }
    const fields = Object.fromEntries(new FormData(form));
    // Keep the legacy cross-field invariant even when browser validation was bypassed.
    if(mode==="register" && fields.password!==fields.passwordConfirm){
      setFieldErrors(previous=>({...previous,passwordConfirm:"Mật khẩu nhập lại không khớp. Hãy kiểm tra ô này."}));
      (form.elements.namedItem("passwordConfirm") as HTMLInputElement|null)?.focus();
      return;
    }
    delete fields.passwordConfirm;
    // Password is used for this HTTPS submission only, then cleared from the input.
    const password = fields.password; const field = form.elements.namedItem("password") as HTMLInputElement | null;
    if (field) field.value = "";
    const answerInput=form.elements.namedItem("securityAnswer") as HTMLInputElement|null;
    if(answerInput) answerInput.value="";
    await run(async () => {
      if(mode==="recover"&&v2&&recoveryMethod==="question"){
        const login=String(fields.login||"").trim().toLowerCase();
        const challenge=await send({action:"security-recovery-challenge",login});
        const proof=await portableChildhoodRecoveryProof(login,challenge.challenge||"");
        const result=await send({...fields,password,...proof,action:"security-recover",login});
        setRecovery(result.recoveryCode??"");setMode("login");
        setNotice("Đã đặt lại mật khẩu bằng câu trả lời và khóa P-256 gốc. Tất cả phiên cũ bị thu hồi; lưu mã khôi phục mới.");
        await reload();broadcast();return;
      }
      const key = mode === "recover" || mode==="devices" ? {} : await portableCredential(mode === "claim");
      if(mode==="devices"){
        const action=recoveryDevices.length ? fields.approvePending==="on" ? "approve-recovered-device" : "recover-lost-device" : "recovery-devices";
        const result=await send({...fields,password,action});
        if(action==="recovery-devices"){setRecoveryDevices(result.devices??[]);
          setNotice("Đã xác minh bằng mật khẩu và mã khôi phục. Chọn một thiết bị để thu hồi.");}
        else{setRecoveryDevices([]);setRecovery(result.recoveryCode??"");setMode("login");
          setNotice(action==="approve-recovered-device"?"Thiết bị được khôi phục bằng mã một lần. Hãy lưu mã mới.":"Đã thu hồi thiết bị và đổi mã khôi phục. Hãy lưu mã mới rồi đăng nhập lại.");}
        return;
      }
      const invited=mode==="register"&&Boolean(managerInvite);
      let result:Awaited<ReturnType<typeof send>>;
      try {
        result = await send({ ...fields, password, ...key,
          action:invited?"manager-register":mode,
          role:invited?"manager":role,
          ...(invited?{managerInviteToken:managerInvite}:{}),
          privacyAccepted: fields.privacyAccepted === "on" });
      } catch(caught) {
        const code=(caught as {code?:string})?.code;
        const target=code==="AUTH_FAILED"?"password"
          : code==="PASSWORD_POLICY"?"password"
          : code==="ACCOUNT_CONTACT_INVALID"?"contactValue"
          : code==="SECURITY_ANSWER_INVALID"?"securityAnswer":null;
        if(!target)throw caught;
        setFieldErrors(previous=>({...previous,[target]:code==="AUTH_FAILED"
          ? "Tên đăng nhập hoặc mật khẩu chưa đúng. Hãy kiểm tra hai ô trên."
          : accountNetworkError(caught)}));
        return;
      }
      if(invited){managerInviteRef.current="";setManagerInvite("");}
      if (result.recoveryCode) { recoveryOwner.current = result.account?.accountId ?? result.accountId ?? ""; setRecovery(result.recoveryCode); }
      if (mode === "recover") { setMode("login"); setNotice("Đã đổi mật khẩu và thu hồi các phiên cũ. Hãy lưu mã khôi phục mới."); }
      await reload(mode === "claim"); broadcast();
    });
  }
  async function compareContact(form:HTMLFormElement) {
    const fields=Object.fromEntries(new FormData(form));
    await run(async()=>{
      const result=await send({action:"contact-check",...fields});
      setNotice(result.matched
        ? "Thông tin liên hệ khớp. Thiết bị vẫn chưa được tin cậy: hãy xác nhận từ thiết bị cũ hoặc dùng mã khôi phục."
        : "Thông tin liên hệ chưa khớp. Kiểm tra lại hoặc sử dụng quy trình khôi phục an toàn.");
    });
  }
  const managerStorageId=account?.storageDeviceId??"";
  const getManagerProof=useCallback((signal?:AbortSignal)=>{
    signal?.throwIfAborted();
    return portableManagerProof(managerStorageId);
  },[managerStorageId]);
  const active = accountServerActive(account, v2, observedNow);
  if (!enabled || bypass) return children;
  const managerDashboard=Boolean(ready && active && v2 && account?.role==="manager"
    && account.storageDeviceId && pathname==="/");
  async function submitProfile(form:HTMLFormElement) {
    const fields=Object.fromEntries(new FormData(form));
    await run(async()=>{
      const pending=account?.onboardingStage==="requested";
      const action="submit-profile";
      let alreadyActivated=false;
      try {
        await send({...fields,action,expectedRevision:account?.onboardingRevision});
      } catch(caught) {
        if((caught as {code?:string})?.code==="PROFILE_PHONE_IN_USE"){
          // A phone entered at signup is not repeated in the profile form.
          // In either case the global error remains visible; only focus a
          // field when the user can actually correct the phone here.
          const fieldName=account?.role==="manager"&&account.primaryContactKind==="email"
            ?"secondaryContact":"phone";
          const phoneInput=form.elements.namedItem(fieldName);
          if(phoneInput instanceof HTMLInputElement){
            setFieldErrors(previous=>({...previous,[fieldName]:accountNetworkError(caught)}));
            phoneInput.focus();
          }
        }
        if((caught as {code?:string})?.code!=="ACCOUNT_CAS_CONFLICT")throw caught;
        // Review can finish while a user is filling the form. Read the
        // canonical state, then retry this one profile submission once with
        // the new revision; never resubmit an account registration.
        const {response,data:fresh}=await accountReadWithinDeadline<{account?:Account|null}>("/api/accounts",{credentials:"same-origin",cache:"no-store"});
        const verified=fresh.account;
        if(!response.ok || !verified || verified.accountId!==account?.accountId ||
          verified.deviceApproved!==true)throw caught;
        const stage=verified.onboardingStage;
        if(accountServerActive(verified,v2,Date.now())) alreadyActivated=true;
        else if(Number.isInteger(verified.onboardingRevision) &&
          (stage==="requested" || stage==="profile_required" ||
          stage==="changes_requested" || (singleReview && stage==="profile_review"))) {
          await send({...fields,action:"submit-profile",
            expectedRevision:verified.onboardingRevision});
        } else {
          await reload();
          throw new Error("Trạng thái xét duyệt đã thay đổi. Đã đồng bộ hồ sơ mới; vui lòng kiểm tra lại.");
        }
      }
      await reload();
      setNotice(alreadyActivated?"Hồ sơ đã được kích hoạt trên máy chủ."
        :pending?"Đã xác minh đầy đủ hồ sơ và tự kích hoạt tài khoản."
        :singleReview?"Đã lưu hồ sơ hợp lệ và kích hoạt tài khoản.":"Đã gửi hồ sơ để xét duyệt.");
    });
  }
  async function openTrial(){
    await run(async()=>{
      const status=await send({action:"trial-status"});
      const lease=status.trial?.state==="available"?(await send({action:"trial-start"})).trial:status.trial;
      if(!lease||lease.state!=="active"){
        if(lease?.state==="expired")setTrialUsed(true);
        throw new Error(lease?.state==="expired"?"Lượt trải nghiệm 8 giờ đã hết, không thể gia hạn.":"Không xác minh được thời hạn thử trên máy chủ.");
      }
      if(lease.role!==account?.role)throw new Error("Vai trò thử không khớp với tài khoản.");
      setTrial(lease);
    });
  }
  async function extendCurrentSession(){
    await run(async()=>{
      const result=await send({action:"keepalive"});
      if(result.ok!==true)throw new Error("Máy chủ chưa xác nhận gia hạn phiên.");
      lastLeaseRenewalAttemptAt.current=Date.now();
      lastUserEngagementAt.current=Date.now();
      await reload();
      setNotice("Phiên đăng nhập đã được gia hạn an toàn từ máy chủ.");
    });
  }
  async function logoutAccount(){
    await run(async()=>{
      // Keep the current validated UI usable if network logout fails.
      await send({action:"logout"});
      closeProfile();setReady(false);setRecovery("");recoveryOwner.current="";
      broadcast();
      reloadPreservingPendingManagerInvite(managerInviteRef.current);
    });
  }
  const profileSections:ProfileSection[]=[
    {id:"overview",label:"Thông tin tài khoản",hint:"Trạng thái tài khoản và quyền sử dụng",content:
      <div className={styles.accountSettingPane}>
        <div className={styles.profileSummary}>
          <span className={styles.profileLargeAvatar}>{(account?.name?.trim()[0]||"B").toLocaleUpperCase("vi")}</span>
          <div><small>HỒ SƠ ĐÃ XÁC THỰC</small><h3>{account?.name||"Tài khoản Bơi Ếch"}</h3>
            <p>{account?.role==="manager"?"Cán bộ quản lý":account?.role==="teacher"?"Giảng viên":"Học viên"}</p></div>
        </div>
        <div className={styles.settingDataGrid}>
          <div><small>Trạng thái tài khoản</small><strong>{active?"Đang hoạt động":"Chờ kích hoạt"}</strong></div>
          <div><small>Quyền truy cập</small><strong>{account?.entitlementActive?"Đã xác nhận thời hạn":"Chưa xác nhận"}</strong></div>
          <div><small>Thời hạn truy cập</small><strong>{isUnlimitedAccountExpiry(account?.expiresAt)?"Không giới hạn":account?.expiresAt?
            new Intl.DateTimeFormat("vi-VN",{dateStyle:"medium"}).format(new Date(account.expiresAt)):"Chưa có dữ liệu"}</strong></div>
          <div><small>Thiết bị liên kết</small><strong>{devices.filter(d=>!d.revoked).length}/3</strong></div>
        </div>
        <div className={styles.settingInfo}>Thông tin nhận dạng nội bộ không cần nhập hoặc hiển thị.
          Muốn thay đổi mật khẩu/quản lý thiết bị, mở các mục Bảo mật và thiết bị bên trái.</div>
        {active&&account?.canReadRegistrants?<RegistrantReader/>:null}
      </div>},
    {id:"security",label:"Bảo mật cá nhân",hint:"Khôi phục mật khẩu và bảo vệ tài khoản",content:
      <div className={styles.accountSettingPane}>
        <div className={styles.settingSectionTitle}><span>◆</span><div><h3>Câu hỏi khôi phục mật khẩu</h3>
          <p>Tên lúc nhỏ của bạn là gì?</p></div></div>
        <div className={styles.settingInfo}>{account?.securityQuestionConfigured?"Câu trả lời đã được thiết lập và mã hóa một chiều bằng scrypt.":"Chưa có câu trả lời bảo mật cho tài khoản này."}
          {" "}Đáp án cũ không thể xem lại; bạn có thể thiết lập câu trả lời mới bên dưới.</div>
        <form className={styles.securityUpdateForm} onSubmit={e=>{
          e.preventDefault();const form=e.currentTarget;const fields=Object.fromEntries(new FormData(form));
          void run(async()=>{
            await send({action:"security-question-set",password:fields.currentPassword,securityAnswer:fields.securityAnswer});
            form.reset();await reload();setNotice("Đã cập nhật câu trả lời khôi phục.");
          });
        }}>
          <label>Mật khẩu hiện tại<input name="currentPassword" type="password" required autoComplete="current-password" disabled={busy}/></label>
          <label>Câu trả lời mới<input name="securityAnswer" type="password" minLength={2} maxLength={120}
            required autoComplete="new-password" disabled={busy} placeholder="Nhập tên lúc nhỏ"/></label>
          <button type="submit" disabled={busy}>Lưu câu trả lời bảo mật</button>
        </form>
        <p className={styles.securityFinePrint}>Khôi phục bằng câu hỏi còn yêu cầu khóa P-256 trên thiết bị tin cậy gốc;
          nếu mất thiết bị, hãy dùng mã khôi phục một lần đã cấp.</p>
        {error?<p role="alert" className={styles.error}>{error}</p>:null}
        {notice?<p role="status" className={styles.settingSuccess}>{notice}</p>:null}
      </div>},
    {id:"devices",label:"Bảo mật và thiết bị",hint:"Kiểm tra tối đa ba thiết bị tin cậy",content:
      <div className={styles.accountSettingPane}>
        <div className={styles.settingSectionTitle}><span>▣</span><div><h3>Thiết bị đã liên kết</h3>
          <p>{devices.filter(d=>!d.revoked).length}/3 thiết bị · Dữ liệu lấy từ phiên hiện tại</p></div></div>
        <div className={styles.deviceList}>{devices.map((device,index)=>{
          const inUse=!device.revoked && Boolean(account?.deviceId) && device.device_id===account?.deviceId;
          const name=device.device_label?.trim() || (inUse?currentDeviceDisplay().label:"Thiết bị khác "+(index+1)+" · Chưa có thông tin trình duyệt");
          return <article className={styles.deviceItem} key={device.device_id}>
          <div><strong>{name}</strong>
            <small>{device.revoked?"Đã thu hồi":inUse?"Thiết bị hiện tại":v2&&device.approved===0?"Đang chờ xác nhận":"Thiết bị tin cậy"}
              {" · "}{device.created_at}</small></div>
          {inUse?<span className={styles.deviceInUse} role="status">● In use</span>:null}
          {!device.revoked&&v2&&device.approved===0&&account?.deviceApproved===true?
            <form onSubmit={e=>{e.preventDefault();const el=e.currentTarget;const password=new FormData(el).get("password");
              void run(async()=>{await send({action:"approve-device",deviceId:device.device_id,password});
                el.reset();await reload();setNotice("Đã xác nhận thiết bị mới.");});}}>
              <label>Mật khẩu xác nhận<input name="password" type="password" required autoComplete="current-password" disabled={busy}/></label>
              <button disabled={busy} type="submit">Xác nhận thiết bị</button>
            </form>:null}
          {!inUse&&!device.revoked&&(!v2||account?.deviceApproved===true)?
            <button type="button" className={styles.revokeButton} disabled={busy}
              onClick={()=>{if(window.confirm("Thu hồi thiết bị này? Các phiên của thiết bị sẽ bị vô hiệu hóa."))void run(async()=>{
                await send({action:"revoke-device",deviceId:device.device_id});await reload();broadcast();
              });}}>Thu hồi</button>:null}
        </article>;})}</div>
        {!devices.length?<p role="status">Không đọc được thiết bị nào từ máy chủ.</p>:null}
        {error?<p role="alert" className={styles.error}>{error}</p>:null}
        {notice?<p role="status" className={styles.settingSuccess}>{notice}</p>:null}
      </div>},
    {id:"sync",label:"Đồng bộ dữ liệu",hint:"Theo dõi và thiết lập dữ liệu được đồng bộ",content:
      <div className={styles.accountSettingPane}>
        <div className={styles.settingSectionTitle}><span>↻</span><div><h3>Đồng bộ có xác minh</h3>
          <p>Thực hiện trong phạm vi quyền và thiết bị của tài khoản.</p></div></div>
        {active&&v2&&account?<VerifiedSyncSettings accountId={account.accountId}/>:
          <p>Đồng bộ chỉ khả dụng sau khi tài khoản được kích hoạt.</p>}
      </div>}
  ];
  const accountPanel = <section className={account ? styles.root : `${styles.root} ${styles.authRoot} ${mode==="register" ? styles.authRegister : ""}`} aria-label="Tài khoản Bơi Ếch">
      {!account?<div className={styles.authBrand}><span className={styles.authMark} aria-hidden="true">◉</span><strong>Bơi Ếch</strong><small>HỌC BƠI HIỆU QUẢ · AN TOÀN · BÀI BẢN</small></div>:null}
      <h1>{account ? (account.onboardingStage==="requested"?"Hoàn thiện hồ sơ để bắt đầu sử dụng":"Tài khoản Bơi Ếch") : mode==="register" ? "Đăng ký" : mode==="recover" ? "Khôi phục tài khoản" : "Đăng nhập"}</h1>
      {!account?<p className={styles.authSubtitle}>{mode==="register" ? "Tạo tài khoản bảo mật. Hoàn tất hồ sơ để sử dụng ngay." : mode==="recover" ? "Sử dụng mã khôi phục an toàn đã được cấp." : "Đăng nhập để tiếp tục học tập và giảng dạy."}</p>:null}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {recovery && <section className={styles.recovery}><h2>Lưu mã khôi phục một lần</h2>
        <p>Mã này dùng để đặt mật khẩu mới khi quên. Giữ riêng ở nơi an toàn; hệ thống không hiển thị lại.</p>
        <code>{recovery}</code><button type="button" onClick={() => setRecovery("")}>Tôi đã lưu mã an toàn</button></section>}
      {!ready ? <><p role="status">{error ? "Chưa kết nối được máy chủ tài khoản." : "Đang kiểm tra phiên…"}</p>
          {error && <button type="button" disabled={busy} onClick={() => void run(() => reload())}>Thử đọc lại phiên</button>}</> : account ? <>
        <p>{account.name} · {account.role === "manager" ? "Cán bộ quản lý" : account.role === "teacher" ? "Giảng viên" : "Học viên"}</p>
        {managerInvite?<p role="status">Bạn đang đăng nhập bằng tài khoản khác. Để sử dụng thư mời Cán bộ quản lý, chọn “Đăng xuất / đổi tài khoản”. Sau khi đăng xuất, biểu mẫu từ link mời sẽ xuất hiện mà không cần xin mã mới.</p>:null}
        {!active && <p role="status" className={styles.pending}>
          {v2 ? account.deviceApproved===false ? "Thiết bị mới chưa được xác nhận. Hãy phê duyệt từ thiết bị đã tin cậy trước khi mở dữ liệu."
            : account.onboardingStage==="requested" ? "Đã đăng ký. Hoàn thiện hồ sơ bắt buộc để kích hoạt ngay, không phải chờ duyệt."
            : account.onboardingStage==="profile_required" ? singleReview?(account.profileDraftReady?"Đã được duyệt. Hồ sơ khai trước đã lưu; chỉ cần xác nhận kích hoạt.":"Đã được duyệt. Điền đủ hồ sơ bắt buộc để kích hoạt và vào ứng dụng."):"Đã duyệt lần một. Hãy hoàn thiện hồ sơ để gửi duyệt lần hai."
            : account.onboardingStage==="profile_review" ? (singleReview ? "Hồ sơ đã qua lần duyệt đầu. Xác nhận lại thông tin để hoàn tất kích hoạt." : "Hồ sơ đang được xét duyệt lần hai.")
            : account.onboardingStage==="changes_requested" ? "Hồ sơ cần bổ sung. Hãy cập nhật và gửi lại."
            : account.onboardingStage==="legacy_hold" ? "Hồ sơ cũ cần được đối chiếu trước khi chuyển sang V2."
            : account.onboardingStage==="active" && account.entitlementActive===false ? "Thời hạn tài khoản đã hết, chưa được cấp hoặc tài khoản đang tạm khóa. Học viên/Giảng viên liên hệ Cán bộ quản lý; Cán bộ quản lý liên hệ Owner để gia hạn."
            : "Chưa đủ điều kiện truy cập."
            : account.status === "pending" ? "Chờ duyệt tài khoản. Bạn chỉ cần đăng ký một lần; trạng thái sẽ dùng chung trên mọi thiết bị."
            : "Tài khoản đã bị khóa hoặc hết hạn. Liên hệ cán bộ có thẩm quyền."}</p>}
        {v2 && account.onboardingStage==="requested" ? <section className={styles.pendingJourney} aria-label="Tiến độ đăng ký">
          <div className={styles.pendingTitle}><span aria-hidden="true">◎</span><div><h2>Yêu cầu đang được xử lý</h2>
           <p>Không cần xét duyệt thủ công. Cán bộ quản lý đăng ký qua lời mời của Owner; hoàn thành thông tin bắt buộc sẽ sử dụng ngay.</p></div></div>
          <ol className={styles.pendingSteps}><li data-state="done">Đã đăng ký</li><li data-state={account.profileDraftReady?"done":undefined}>{account.profileDraftReady?"Đã lưu hồ sơ":"Khai hồ sơ"}</li><li data-state="current">Hoàn thiện hồ sơ</li><li>Kích hoạt tự động</li></ol>
          <p className={styles.pendingHelp}>Bạn có thể đồng bộ trạng thái mà không đăng ký lại. Hồ sơ và thời hạn sử dụng được kiểm tra tại máy chủ.</p>
        </section> : null}
        {v2&&account.deviceApproved===false?<form className={styles.deviceContactCheck}
          onSubmit={e=>{e.preventDefault();void compareContact(e.currentTarget);}}>
          <h2>Thiết bị mới · Đối chiếu liên hệ</h2>
          <p>Nhập lại Email hoặc SĐT đã đăng ký. Đây chỉ là bước đối chiếu, không tự phê duyệt thiết bị.</p>
          <div className={styles.contactMethods} aria-label="Loại liên hệ đã đăng ký">
            <button type="button" aria-pressed={contactType==="email"} disabled={busy}
              onClick={()=>setContactType("email")}>✉ Email</button>
            <button type="button" aria-pressed={contactType==="phone"} disabled={busy}
              onClick={()=>setContactType("phone")}>☎ Số điện thoại</button>
          </div>
          <input type="hidden" name="contactType" value={contactType}/>
          <label>{contactType==="email"?"Email đã đăng ký *":"Số điện thoại đã đăng ký *"}
            <input key={contactType} name="contactValue" required
              type={contactType==="email"?"email":"tel"} autoComplete={contactType==="email"?"email":"tel"}
              maxLength={254} disabled={busy}/>
          </label>
          <button type="submit" disabled={busy}>Đối chiếu liên hệ</button>
          <p>Để mở dữ liệu, cần xác nhận từ thiết bị tin cậy hoặc mã khôi phục an toàn.</p>
        </form>:null}
        {v2 && account.onboardingStage==="changes_requested" && account.onboardingNote ? <p role="status">
          Yêu cầu bổ sung của người xét duyệt: {account.onboardingNote}</p>:null}
        {v2 && account.onboardingStage==="profile_required" && account.profileDraftReady ? <section role="status" className={styles.savedProfile}>
          <h2>Hồ sơ đã lưu trước khi xét duyệt</h2><p>Không cần nhập lại. Hãy xác nhận kích hoạt sau khi hồ sơ đã được phê duyệt một lần.</p>
          <button type="button" disabled={busy} onClick={()=>void run(async()=>{await send({action:"profile-draft-activate"});await reload();setNotice("Đã kích hoạt bằng hồ sơ đã lưu và xác nhận trạng thái máy chủ.");})}>Kích hoạt bằng hồ sơ đã lưu</button>
        </section>:null}
        {v2 && account.deviceApproved!==false && (["requested","profile_required","changes_requested"].includes(account.onboardingStage||"")
          || (singleReview && account.onboardingStage==="profile_review")) ? <form
          key={`${account.accountId}:${account.onboardingStage}:${account.profileDraftReady}`}
          className={styles.profileForm} onSubmit={e=>{e.preventDefault();void submitProfile(e.currentTarget);}}>
          <header className={styles.profileHeading}>
            <span className={styles.profileEyebrow}>{account.onboardingStage==="requested"?"BƯỚC 01 · HOÀN THIỆN ĐỂ KÍCH HOẠT":"BƯỚC 02 · HỒ SƠ ĐỊNH DANH"}</span>
            <h2>{account.role==="manager"?"Hồ sơ Cán bộ quản lý":"Hoàn thiện hồ sơ cá nhân"}</h2>
            <p>{account.role==="manager"
              ?"Bổ sung thông tin công tác và phương thức liên hệ còn thiếu. Không cần mã cá nhân hoặc nhập lại liên hệ đã đăng ký."
              :"Điền thông tin cần thiết để phân lớp và quản lý học tập."}</p>
          </header>
          <div className={styles.profileGrid}>
            {(account.role==="manager"
              ?([["familyName","Họ và tên lót","text"],["givenName","Tên","text"],["facultyUnit","Khoa / Đơn vị","text"],
                ["jobTitle","Chức danh","text"],["jobPosition","Chức vụ","text"]] as const)
              :([["familyName","Họ và tên lót","text"],["givenName","Tên","text"],["className","Lớp / đơn vị","text"],["phone","Số điện thoại bổ sung","tel"]] as const).filter(([name])=>name!=="phone"||account.primaryContactKind!=="phone")
            ).map(([name,label,kind])=><label key={name} className={name==="facultyUnit"||name==="className"?styles.profileFieldWide:styles.profileField}>
              <span>{label} {name==="phone"&&!singleReview?<small>(không bắt buộc)</small>:<span className={styles.requiredMark} aria-label="Bắt buộc">*</span>}</span>
              <input name={name} type={kind} defaultValue={account.profileDraftFields?.[name]??""} required={name!=="phone"||singleReview} aria-required={name!=="phone"||singleReview} minLength={name==="phone"?7:2}
                maxLength={name==="phone"?32:name==="familyName"||name==="givenName"?60:name==="facultyUnit"||name==="className"?80:120}
                autoComplete={name==="familyName"?"family-name":name==="givenName"?"given-name":name==="phone"?"tel":"off"}
                placeholder={name==="facultyUnit"?"Ví dụ: Khoa Công nghệ thông tin":name==="jobTitle"?"Ví dụ: Giảng viên":name==="jobPosition"?"Ví dụ: Trưởng bộ môn":undefined}
                aria-invalid={Boolean(fieldErrors[name])}
                aria-describedby={fieldErrors[name]?`profile-${name}-error`:undefined}
                onInput={()=>setFieldErrors(previous=>{if(!previous[name])return previous;
                  const next={...previous};delete next[name];return next;})}
                disabled={busy}/>
              {fieldErrors[name]?<small id={`profile-${name}-error`} role="alert" className={styles.fieldError}>
                {fieldErrors[name]}</small>:null}
            </label>)}
            {account.role==="manager" && account.primaryContactKind ? <label className={styles.profileFieldWide}>
              <span>{account.primaryContactKind==="email"?"Số điện thoại bổ sung":"Email bổ sung"} <small>(không bắt buộc)</small></span>
              <input name="secondaryContact" type={account.primaryContactKind==="email"?"tel":"email"}
                inputMode={account.primaryContactKind==="email"?"tel":"email"}
                autoComplete={account.primaryContactKind==="email"?"tel":"email"}
                maxLength={account.primaryContactKind==="email"?32:254}
                placeholder={account.primaryContactKind==="email"?"Ví dụ: +84 912 345 678":"Ví dụ: ten@example.com"}
                aria-invalid={Boolean(fieldErrors.secondaryContact)}
                aria-describedby={fieldErrors.secondaryContact?"profile-secondary-contact-error":undefined}
                onInput={()=>setFieldErrors(previous=>{if(!previous.secondaryContact)return previous;
                  const next={...previous};delete next.secondaryContact;return next;})}
                disabled={busy}/>
              {fieldErrors.secondaryContact?<small id="profile-secondary-contact-error" role="alert"
                className={styles.fieldError}>{fieldErrors.secondaryContact}</small>:null}
              <small>Chỉ là thông tin liên hệ tự khai; không dùng thay xác minh thiết bị hoặc cấp quyền truy cập.</small>
            </label> : null}
          </div>
          <footer className={styles.profileFooter}>
            <p>Thông tin được lưu vào hồ sơ Bơi Ếch. Chỉ tài khoản đủ quyền mới được xem hoặc xử lý.</p>
            <button type="submit" disabled={busy}>{busy?"Đang xác minh…":account.onboardingStage==="requested"?"Hoàn tất hồ sơ · Vào ứng dụng":singleReview?"Hoàn tất hồ sơ và kích hoạt":"Gửi hồ sơ để xét duyệt"}</button>
          </footer>
        </form> : null}
        {v2&&singleReview&&trialEnabled&&!trialUsed&&!active&&account.deviceApproved===true&&
         ["requested","profile_required","changes_requested"].includes(account.onboardingStage||"")?
          <section className={styles.trialInvitation}><div><strong>Trải nghiệm thử giao diện — 8 giờ</strong>
            <p>Thời hạn máy chủ cấp một lần. Không cấp quyền tài khoản, không dùng dữ liệu thật hoặc AI; nội dung thử chỉ ở bộ nhớ và sẽ bị xóa khi hết hạn.</p></div>
            <button type="button" disabled={busy} onClick={()=>void openTrial()}>Mở trải nghiệm thử 8 giờ</button></section>:null}
        {trialUsed&&!active?<p role="status">Lượt trải nghiệm thử đã kết thúc. Hồ sơ đăng ký và quyền xét duyệt vẫn được giữ nguyên.</p>:null}
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void run(() => reload())}>Đồng bộ trạng thái</button>
          <button type="button" disabled={busy} onClick={() => void run(async () => { setReady(false); setRecovery(""); recoveryOwner.current=""; await send({ action: "logout" }); broadcast();
            // Keep a pending one-use invitation ONLY in the URL fragment during the
            // cross-account navigation. Fragments are not sent in HTTP requests, and
            // the mount effect immediately scrubs the token from the address bar.
            // Never persist it in local/session storage or put it in the query string.
            reloadPreservingPendingManagerInvite(managerInviteRef.current); })}>Đăng xuất / đổi tài khoản</button></div>

      </> : <>

        <form key={mode} className={styles.authForm} noValidate
          onInvalidCapture={e=>{const input=e.target as unknown as HTMLInputElement;
            if(input.tagName==="INPUT"){e.preventDefault();onAuthInvalid(input,e.currentTarget);}}}
          onBlurCapture={e=>{const input=e.target as unknown as HTMLInputElement;
            if(input.tagName==="INPUT")onAuthBlur(input,e.currentTarget);}}
          onInputCapture={e=>{const input=e.target as unknown as HTMLInputElement;
            if(input.tagName==="INPUT")onAuthInput(input);}}
          onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
          <label>Tên đăng nhập<input name="login" required minLength={3} maxLength={64} autoComplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" disabled={busy} aria-invalid={Boolean(fieldErrors.login)} aria-describedby={fieldErrors.login?"auth-login-error":undefined}/>{fieldErrors.login?<small id="auth-login-error" role="alert" className={styles.fieldError}>{fieldErrors.login}</small>:null}</label>
          <label>{mode === "recover" ? "Mật khẩu mới" : "Mật khẩu"}<input name="password" type="password" required minLength={mode === "login"||mode==="devices" ? 1 : 15} maxLength={1024} autoComplete={mode === "login"||mode==="devices" ? "current-password" : "new-password"} disabled={busy} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password?"auth-password-error":undefined}/>{fieldErrors.password?<small id="auth-password-error" role="alert" className={styles.fieldError}>{fieldErrors.password}</small>:null}</label>
          {mode==="register"?<label>Nhập lại mật khẩu<input name="passwordConfirm" type="password" required minLength={15} maxLength={1024} autoComplete="new-password" disabled={busy} aria-invalid={Boolean(fieldErrors.passwordConfirm)} aria-describedby={fieldErrors.passwordConfirm?"auth-password-confirm-error":undefined}/>{fieldErrors.passwordConfirm?<small id="auth-password-confirm-error" role="alert" className={styles.fieldError}>{fieldErrors.passwordConfirm}</small>:null}</label>:null}
          {mode==="register"?<fieldset className={styles.contactChoice}>
            <legend>Thông tin liên hệ <span aria-hidden="true">*</span></legend>
            <div className={styles.contactMethods} aria-label="Chọn phương thức liên hệ">
              <button type="button" aria-pressed={contactType==="email"} onClick={()=>setContactType("email")} disabled={busy}>✉ Email</button>
              <button type="button" aria-pressed={contactType==="phone"} onClick={()=>setContactType("phone")} disabled={busy}>☎ Số điện thoại</button>
            </div>
            <input type="hidden" name="contactType" value={contactType}/>
            <label>{contactType==="email"?"Địa chỉ email *":"Số điện thoại *"}
              <input key={contactType} name="contactValue" type={contactType==="email"?"email":"tel"}
                placeholder={contactType==="email"?"ten@gmail.com":"+84 / +7 ..."}
                autoComplete={contactType==="email"?"email":"tel"} required maxLength={254} disabled={busy} aria-invalid={Boolean(fieldErrors.contactValue)} aria-describedby={fieldErrors.contactValue?"auth-contact-error":undefined}/>
              {fieldErrors.contactValue?<small id="auth-contact-error" role="alert" className={styles.fieldError}>{fieldErrors.contactValue}</small>:null}
            </label>
            <small>Chỉ lưu liên hệ đã cung cấp; không gửi mã xác minh lúc đăng ký.</small>
          </fieldset>:null}
          {mode==="login"?<div className={styles.authInlineLinks}><button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("recover")}>Quên mật khẩu?</button></div>:null}
          {mode==="recover"&&v2?<fieldset className={styles.contactChoice}><legend>Chọn cách khôi phục mật khẩu</legend>
            <div className={styles.contactMethods}><button type="button" aria-pressed={recoveryMethod==="code"} onClick={()=>setRecoveryMethod("code")}>Mã khôi phục</button>
            <button type="button" aria-pressed={recoveryMethod==="question"} onClick={()=>setRecoveryMethod("question")}>Tên lúc nhỏ + thiết bị gốc</button></div>
            <small>Chỉ câu trả lời bảo mật không đủ khôi phục. Cần khóa P-256 trong trình duyệt gốc; nếu mất thiết bị, dùng mã khôi phục một lần.</small>
          </fieldset>:null}
          {(mode==="devices" || mode==="recover"&&(!v2||recoveryMethod==="code")) && <label>Mã khôi phục<input name="recoveryCode" required minLength={64} maxLength={64} autoComplete="off" disabled={busy} aria-invalid={Boolean(fieldErrors.recoveryCode)} aria-describedby={fieldErrors.recoveryCode?"auth-recovery-error":undefined}/>{fieldErrors.recoveryCode?<small id="auth-recovery-error" role="alert" className={styles.fieldError}>{fieldErrors.recoveryCode}</small>:null}</label>}
          {mode==="recover"&&v2&&recoveryMethod==="question"?<label>Tên lúc nhỏ của bạn là gì?
            <input name="securityAnswer" type="password" required minLength={2} maxLength={120} autoComplete="off" disabled={busy} aria-invalid={Boolean(fieldErrors.securityAnswer)} aria-describedby={fieldErrors.securityAnswer?"auth-security-error":undefined}/>{fieldErrors.securityAnswer?<small id="auth-security-error" role="alert" className={styles.fieldError}>{fieldErrors.securityAnswer}</small>:null}</label>:null}
          {mode==="devices" && recoveryDevices.length>0 ? <label>Thiết bị cần gỡ
            <select name="deviceId" required disabled={busy}>
              {recoveryDevices.map(d=><option key={d.device_id} value={d.device_id}>{d.device_id.slice(0,16)} · {d.created_at}</option>)}
            </select></label>:null}
          {mode==="devices" && recoveryDevices.length>0 ? <label><input type="checkbox" name="approvePending" disabled={busy}/>
            Phê duyệt thiết bị chờ xác nhận thay vì gỡ thiết bị đã liên kết</label>:null}
          {mode === "claim" && <p>Chỉ chuyển hồ sơ bằng trình duyệt đã đăng ký và còn giữ khóa gốc. Tiến độ, quyền và thanh toán cũ được giữ nguyên.</p>}
          {mode === "register" && <>{managerInvite
           ? <p role="status">Lời mời Cán bộ quản lý do Owner cấp. Mật khẩu và khóa thiết bị được tạo riêng tại trang này; không cần chờ Owner duyệt sau khi hoàn thiện hồ sơ, nhưng lời mời vẫn bắt buộc.</p>
           : <><RegistrationRoles value={role} onChange={setRole} includeManager={false}/><p role="note">Cán bộ quản lý chỉ đăng ký bằng thư mời do Owner cấp trên Application-Management.</p></>}{!v2?<p role="alert">Đăng ký mới yêu cầu Account-first V2. Hiện hệ thống chưa bật V2; không thể tạo hồ sơ bằng biểu mẫu cũ.</p>:<p>Chỉ tạo tài khoản và thiết lập bảo mật tại bước này. Sau khi nhập đủ hồ sơ bắt buộc, tài khoản tự kích hoạt. Không cần chờ xét duyệt.</p>}
             {v2?<label>Câu hỏi bảo mật: Tên lúc nhỏ của bạn là gì?
               <input name="securityAnswer" type="password" required minLength={2} maxLength={120} autoComplete="new-password" disabled={busy} aria-invalid={Boolean(fieldErrors.securityAnswer)} aria-describedby={fieldErrors.securityAnswer?"auth-security-error":undefined}/>
               {fieldErrors.securityAnswer?<small id="auth-security-error" role="alert" className={styles.fieldError}>{fieldErrors.securityAnswer}</small>:null}
               <small>Hãy ghi nhớ đáp án. Đáp án được mã băm, không thể xem lại; có thể thay đổi tại Trang cá nhân.</small></label>:null}
            <p>Dữ liệu đăng ký được cán bộ được cấp quyền xử lý để xét duyệt, phân lớp và hỗ trợ. Chỉ cán bộ được Owner cấp quyền xem mở rộng mới được xem danh sách ngoài phạm vi được phân công; mỗi lần truy cập đều được ghi nhận.</p>
            <label><input type="checkbox" name="privacyAccepted" required disabled={busy} aria-invalid={Boolean(fieldErrors.privacyAccepted)} aria-describedby={fieldErrors.privacyAccepted?"auth-privacy-error":undefined}/>Tôi đã đọc thông báo xử lý dữ liệu đăng ký.{fieldErrors.privacyAccepted?<small id="auth-privacy-error" role="alert" className={styles.fieldError}>{fieldErrors.privacyAccepted}</small>:null}</label></>}
          <button type="submit" disabled={busy||(mode==="register"&&!v2)}>{busy ? "Đang xử lý…" : mode === "register" ? "Tạo tài khoản bảo mật" : mode === "claim" ? "Xác minh và chuyển hồ sơ" : mode === "recover" ? "Khôi phục tài khoản" : mode==="devices" ? recoveryDevices.length?"Gỡ thiết bị đã chọn":"Xác minh để xem thiết bị" : "Đăng nhập"}</button>
        </form>
        <div className={styles.authFooter}>
          {mode==="register"?<>Đã có tài khoản? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("login")}>Đăng nhập</button></>
          :mode==="recover"?<>Đã nhớ mật khẩu? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("login")}>Trở về đăng nhập</button></>
          :<>Chưa có tài khoản? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("register")}>Đăng ký</button></>}
        </div>
        <p className={styles.authFootnote}>Hồ sơ cũ được bảo toàn. Việc liên kết tài khoản cần xác minh quyền sở hữu trước khi chuyển dữ liệu.</p>
      </>}
    </section>;
  // The legacy loading login card is replaced by the full-screen verification
  // ceremony. An error never advances to READY/GO without server approval.
  if (!ready) return <AccountVerificationShowcase phase="checking" error={error} busy={busy}
    onRetry={() => void run(() => reload())} onGo={() => undefined}/>;
  // Show the ceremony once per validated account in this mounted document.
  // Once GO has appeared for 1s, enter automatically; still no auth bypass.
  if (active && account && enteredAccountId !== account.accountId) {
    return <AccountVerificationShowcase phase="verified" accountName={account.name}
      role={account.role==="manager"?"Cán bộ quản lý":account.role==="teacher"?"Giảng viên":"Học viên"}
      error={error} busy={busy}
      onRetry={() => void run(() => reload())}
      onGo={() => {
        if (accountServerActive(account, v2, Date.now())) setEnteredAccountId(account.accountId);
        else { setError("Quyền truy cập đã thay đổi. Hãy xác thực lại với máy chủ."); void reload().catch(() => undefined); }
      }}/>;
  }
  if(ready&&account&&!active&&trial?.state==="active"&&account.role===trial.role){
    return <AccountTrialSandbox key={account.accountId} lease={trial}
      onExit={()=>setTrial(null)}
      onExpired={()=>{setTrial(null);setTrialUsed(true);void reload().catch(e=>setError(accountNetworkError(e)));}}/>;
  }
  const idleTimeLeft=(account?.sessionIdleExpiresAt??0)-observedNow;
  const absoluteTimeLeft=(account?.sessionExpiresAt??0)-observedNow;
  const warnSession=ready&&active&&Boolean(account?.sessionIdleExpiresAt) &&
    (idleTimeLeft<=5*60_000 || absoluteTimeLeft<=5*60_000);
  return <>
    {ready && active && account && enteredAccountId === account.accountId ? <ConditionalSyncAgent accountId={account.accountId}/> : null}
    {warnSession ? <aside className={styles.sessionLeaseWarning} role="status" aria-live="polite">
      <strong>Phiên đăng nhập sắp hết hạn</strong>
      <span>{absoluteTimeLeft<=5*60_000
        ? "Phiên đã gần giới hạn bảo mật 7 ngày. Hãy lưu các thay đổi và đăng nhập lại khi được yêu cầu."
        : "Hệ thống chưa ghi nhận hoạt động gần đây. Bạn có thể gia hạn phiên mà không tải lại trang."}</span>
      {absoluteTimeLeft>5*60_000 ? <button type="button" disabled={busy} onClick={()=>void extendCurrentSession()}>
        {busy?"Đang xác minh…":"Giữ phiên đăng nhập"}</button>:null}
    </aside> : null}
    {ready&&active&&v2&&account?.expiresAt?<AccountLeaseCountdown expiresAt={account.expiresAt} role={account.role}/>:null}
    {managerDashboard && account?.storageDeviceId ? <div key={account.accountId}>
      <ManagerWorkspace deviceId={account.storageDeviceId} accountId={account.accountId} getProof={getManagerProof}
        onOpenAccount={()=>setProfileOpen(true)} onLogout={()=>void logoutAccount()}
        accountName={account.name||"Cán bộ quản lý"}/>
    </div> : null}
    {!managerDashboard && ready && active && account ? <div key={account.accountId}>{children}</div> : null}
    {!managerDashboard && ready && active && pathname!=="/" && account?
      <button type="button" className={styles.accountCornerButton} onClick={()=>setProfileOpen(true)}
        aria-label="Mở Trang cá nhân và bảo mật">Trang cá nhân</button>:null}
    {!managerDashboard && !(ready && active && account) ? accountPanel : null}
    {ready && account && recoveryMustRemainVisible(active,recovery) ?
      <aside className={styles.activeRecovery} aria-label="Mã khôi phục tài khoản cần lưu" role="region">
        <h2>Mã khôi phục một lần · hãy lưu riêng</h2>
        <p>Bạn đã được vào ứng dụng. Mã này chỉ hiển thị một lần; hãy lưu ở nơi an toàn để khôi phục tài khoản khi cần.</p>
        <code>{recovery}</code>
        <button type="button" onClick={()=>setRecovery("")}>Tôi đã lưu mã an toàn</button>
      </aside>:null}
    {ready&&active&&account?<AccountProfileDialog open={profileOpen}
      name={account.name||"Tài khoản Bơi Ếch"}
      role={account.role==="manager"?"manager":account.role==="teacher"?"teacher":"learner"}
      sections={profileSections} onClose={closeProfile}
      onLogout={()=>void logoutAccount()} busy={busy}/>:null}
  </>;
}
