"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import RegistrantReader from "./registrant-reader";
import VerifiedSyncSettings from "./verified-sync-settings";
import { accountTransitionNeedsReload } from "./account-scope";
import { RegistrationRoles } from "./registration-roles";
import ManagerV2ReviewPanel from "./manager-v2-review-panel";
import { portableCredential, preparePortableAccount } from "./multi-account-switcher";
import styles from "./account-gate.module.css";
type Account = { accountId: string; status: string; role: string; name: string; expiresAt: string | null;
  deviceId?: string; deviceApproved?: boolean; onboardingStage?: string|null; onboardingRevision?: number|null;
  onboardingNote?: string|null; entitlementActive?: boolean;
  canReadRegistrants?: boolean };
type Device = { device_id: string; revoked: number; approved?: number; created_at: string };
type Mode = "login" | "register" | "claim" | "recover" | "devices";
function accountNetworkError(error: unknown) {
  const raw=error instanceof Error?error.message:"";
  if (/load failed|failed to fetch|networkerror|network request failed/i.test(raw))
    return "Không kết nối được máy chủ tài khoản. Nếu vừa đăng ký, hãy thử Đăng nhập hoặc Đồng bộ trạng thái trước khi gửi lại để tránh trùng yêu cầu.";
  return raw || "Chưa xác minh được kết nối tài khoản.";
}
async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/accounts", { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Chưa xác minh được thao tác tài khoản.");
  return data as { recoveryCode?: string; accountId?: string; account?: Account; matched?:boolean; verified?:boolean;
    devices?:Array<{device_id:string;approved:number;created_at:string}> };
}
function reloadPreservingPendingManagerInvite(token: string) {
  const oneUseFragment=/^[a-f0-9]{64}$/.test(token) ? "#manager-invite="+token : "";
  if(oneUseFragment){
    // Fragment-only transfer: it is excluded from the HTTP request and scrubbed
    // immediately by the next AccountGate mount. Never write it to Web Storage.
    window.location.replace(window.location.pathname+window.location.search+oneUseFragment);
  } else window.location.reload();
}
export default function AccountGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const bypass = pathname === "/xem-thu-can-bo-quan-ly" || pathname.startsWith("/quan-ly-thiet-bi") || pathname.startsWith("/bien-tap-");
  const [account, setAccount] = useState<Account | null>(null), [devices, setDevices] = useState<Device[]>([]);
  const [v2,setV2]=useState(false);
  const [singleReview,setSingleReview]=useState(false);
  const [recoveryDevices,setRecoveryDevices]=useState<Array<{device_id:string;approved:number;created_at:string}>>([]);
  const [observedNow,setObservedNow] = useState(0);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("login"), [role, setRole] = useState<"learner" | "manager" | "teacher">("learner");
  const [contactType,setContactType]=useState<"email"|"phone">("email");
  const [recovery, setRecovery] = useState(""), [notice, setNotice] = useState("");
  const [managerInvite,setManagerInvite]=useState("");
  const managerInviteRef=useRef("");
  const recoveryOwner = useRef("");
  const lock = useRef(false), mounted = useRef(false), current = useRef("");
  const reload = useCallback(async (claim = false) => {
    const response = await fetch("/api/accounts", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json() as { account?: Account | null; devices?: Device[]; accountV2?:boolean; accountSingleReview?:boolean; error?: string };
    if (mounted.current) { setV2(data.accountV2 === true); setSingleReview(data.accountSingleReview === true); }
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
    current.current = data.account?.accountId ?? "";
    if (mounted.current) { setObservedNow(Date.now()); setAccount(data.account ?? null); setDevices(data.devices ?? []); setReady(true); }
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
  useEffect(() => {
    if (!enabled || bypass) return;
    mounted.current = true;
    document.documentElement.dataset.accountFirst = "true";
    const refresh = () => { if (!document.hidden && !lock.current) void reload().catch(e => { if (mounted.current) setError(accountNetworkError(e)); }); };
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("pageshow",refresh);
    const timer = window.setInterval(() => { if(mounted.current) setObservedNow(Date.now()); refresh(); },60000);
    const channel = new BroadcastChannel("boiech-account-auth"); channel.onmessage = refresh;
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow",refresh); channel.close(); };
  }, [enabled, bypass, reload]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { if (mounted.current) setError(accountNetworkError(e)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function broadcast() { const c = new BroadcastChannel("boiech-account-auth"); c.postMessage("changed"); c.close(); }
  async function submit(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    if(mode==="register" && fields.password!==fields.passwordConfirm){
      setError("Mật khẩu nhập lại không khớp.");return;
    }
    delete fields.passwordConfirm;
    // Password is used for this HTTPS submission only, then cleared from the input.
    const password = fields.password; const field = form.elements.namedItem("password") as HTMLInputElement | null;
    if (field) field.value = "";
    await run(async () => {
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
      const result = await send({ ...fields, password, ...key,
        action:invited?"manager-register":mode,
        role:invited?"manager":role,
        ...(invited?{managerInviteToken:managerInvite}:{}),
        privacyAccepted: fields.privacyAccepted === "on" });
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
  if (!enabled || bypass) return children;
  const active = account?.status === "approved" && (!account.expiresAt || Date.parse(account.expiresAt) > observedNow)
    && (!v2 || (account.onboardingStage==="active" && account.deviceApproved===true && account.entitlementActive===true));
  async function submitProfile(form:HTMLFormElement) {
    const fields=Object.fromEntries(new FormData(form));
    await run(async()=>{
      await send({...fields,action:"submit-profile",expectedRevision:account?.onboardingRevision});
      await reload();
      setNotice(singleReview?"Đã lưu hồ sơ hợp lệ và kích hoạt tài khoản.":"Hồ sơ đã gửi chờ duyệt lần thứ hai. Chưa có quyền sử dụng chức năng chính.");
    });
  }
  return <>
    <section className={account ? styles.root : `${styles.root} ${styles.authRoot} ${mode==="register" ? styles.authRegister : ""}`} aria-label="Tài khoản Bơi Ếch">
      {!account?<div className={styles.authBrand}><span className={styles.authMark} aria-hidden="true">◉</span><strong>Bơi Ếch</strong><small>HỌC BƠI HIỆU QUẢ · AN TOÀN · BÀI BẢN</small></div>:null}
      <h1>{account ? "Tài khoản Bơi Ếch" : mode==="register" ? "Đăng ký" : mode==="recover" ? "Khôi phục tài khoản" : "Đăng nhập"}</h1>
      {!account?<p className={styles.authSubtitle}>{mode==="register" ? "Tạo tài khoản và gửi yêu cầu xét duyệt." : mode==="recover" ? "Sử dụng mã khôi phục an toàn đã được cấp." : "Đăng nhập để tiếp tục học tập và giảng dạy."}</p>:null}
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
            : account.onboardingStage==="requested" ? "Đã tiếp nhận đăng ký. Đang chờ người có thẩm quyền phê duyệt."
            : account.onboardingStage==="profile_required" ? singleReview?"Đã được duyệt. Điền đủ hồ sơ bắt buộc để kích hoạt và vào ứng dụng.":"Đã duyệt lần một. Hãy hoàn thiện hồ sơ để gửi duyệt lần hai."
            : account.onboardingStage==="profile_review" ? "Hồ sơ đang được xét duyệt lần hai."
            : account.onboardingStage==="changes_requested" ? "Hồ sơ cần bổ sung. Hãy cập nhật và gửi lại."
            : account.onboardingStage==="legacy_hold" ? "Hồ sơ cũ cần được đối chiếu trước khi chuyển sang V2."
            : account.onboardingStage==="active" && account.entitlementActive===false ? "Thời hạn tài khoản đã hết, chưa được cấp hoặc tài khoản đang tạm khóa. Hãy liên hệ Owner để kiểm tra và gia hạn trong Application-Management."
            : "Chưa đủ điều kiện truy cập."
            : account.status === "pending" ? "Chờ duyệt tài khoản. Bạn chỉ cần đăng ký một lần; trạng thái sẽ dùng chung trên mọi thiết bị."
            : "Tài khoản đã bị khóa hoặc hết hạn. Liên hệ cán bộ có thẩm quyền."}</p>}
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
        {v2 && account.deviceApproved!==false && ["profile_required","changes_requested"].includes(account.onboardingStage||"") ? <form
          className={styles.profileForm} onSubmit={e=>{e.preventDefault();void submitProfile(e.currentTarget);}}>
          <header className={styles.profileHeading}>
            <span className={styles.profileEyebrow}>BƯỚC 02 · HỒ SƠ ĐỊNH DANH</span>
            <h2>{account.role==="manager"?"Hồ sơ Cán bộ quản lý":"Hoàn thiện hồ sơ cá nhân"}</h2>
            <p>{account.role==="manager"
              ?"Bổ sung thông tin công tác. Không cần mã cá nhân hoặc nhập lại số điện thoại; thông tin liên hệ đã có từ bước đăng ký."
              :"Điền thông tin cần thiết để phân lớp và quản lý học tập."}</p>
          </header>
          <div className={styles.profileGrid}>
            {(account.role==="manager"
              ?([["familyName","Họ và tên lót","text"],["givenName","Tên","text"],["facultyUnit","Khoa / Đơn vị","text"],
                ["jobTitle","Chức danh","text"],["jobPosition","Chức vụ","text"]] as const)
              :([["familyName","Họ và tên lót","text"],["givenName","Tên","text"],["personCode","Mã học viên","text"],
                ["className","Lớp / đơn vị","text"],["phone","Số điện thoại","tel"]] as const)
            ).map(([name,label,kind])=><label key={name} className={name==="facultyUnit"||name==="className"?styles.profileFieldWide:styles.profileField}>
              <span>{label} <span className={styles.requiredMark} aria-label="Bắt buộc">*</span></span>
              <input name={name} type={kind} required aria-required="true" minLength={name==="phone"?7:2}
                maxLength={name==="phone"||name==="personCode"?32:name==="facultyUnit"?80:120}
                autoComplete={name==="familyName"?"family-name":name==="givenName"?"given-name":name==="phone"?"tel":"off"}
                placeholder={name==="facultyUnit"?"Ví dụ: Khoa Công nghệ thông tin":name==="jobTitle"?"Ví dụ: Giảng viên":name==="jobPosition"?"Ví dụ: Trưởng bộ môn":undefined}
                disabled={busy}/>
            </label>)}
          </div>
          <footer className={styles.profileFooter}>
            <p>Thông tin được lưu vào hồ sơ Bơi Ếch. Chỉ tài khoản đủ quyền mới được xem hoặc xử lý.</p>
            <button type="submit" disabled={busy}>{busy?"Đang xác minh…":singleReview?"Hoàn tất hồ sơ và kích hoạt":"Gửi hồ sơ để xét duyệt"}</button>
          </footer>
        </form> : null}
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void run(() => reload())}>Đồng bộ trạng thái</button>
          <button type="button" disabled={busy} onClick={() => void run(async () => { await send({ action: "rotate" }); await reload(); setNotice("Đã đổi vé phiên an toàn; tối đa 8 giờ kể từ khi đăng nhập."); })}>Gia hạn phiên</button>
          <button type="button" disabled={busy} onClick={() => void run(async () => { setReady(false); setRecovery(""); recoveryOwner.current=""; await send({ action: "logout" }); broadcast();
            // Keep a pending one-use invitation ONLY in the URL fragment during the
            // cross-account navigation. Fragments are not sent in HTTP requests, and
            // the mount effect immediately scrubs the token from the address bar.
            // Never persist it in local/session storage or put it in the query string.
            reloadPreservingPendingManagerInvite(managerInviteRef.current); })}>Đăng xuất / đổi tài khoản</button></div>
        {active&&account.canReadRegistrants?<RegistrantReader/>:null}
        {active&&v2&&account.role==="manager"?<details>
          <summary>Hàng chờ xét duyệt học viên và giảng viên · Account-first V2</summary>
          <ManagerV2ReviewPanel singleReview={singleReview}/>
        </details>:null}
        {active&&v2?<VerifiedSyncSettings accountId={account.accountId}/>:null}
        <details className={styles.profileDevices}><summary>Trang cá nhân · Bảo mật và thiết bị ({devices.filter(d=>!d.revoked).length}/3 đang liên kết)</summary><p>Quản lý tối đa 3 thiết bị; thu hồi thiết bị cũ tại đây. Thiết bị mới phải được xác nhận riêng.</p>{devices.map(d=><div key={d.device_id}>
          <span>{d.device_id.slice(0,12)} · {d.revoked?"Đã thu hồi":v2&&d.approved===0?"Chờ xác nhận":"Đã xác nhận"}</span>
          {v2 && !d.revoked && d.approved===0 && account.deviceApproved===true ? <form onSubmit={e=>{
            e.preventDefault();const el=e.currentTarget;const password=(new FormData(el)).get("password");
            void run(async()=>{await send({action:"approve-device",deviceId:d.device_id,password});
              el.reset();await reload();setNotice("Đã xác nhận thiết bị mới.");});
          }}><label>Nhập lại mật khẩu để xác nhận thiết bị<input name="password" type="password" required autoComplete="current-password" disabled={busy}/></label>
          <button type="submit" disabled={busy}>Xác nhận thiết bị này</button></form>:null}
          {!d.revoked && (!v2 || account.deviceApproved===true) ? <button type="button" disabled={busy}
            onClick={()=>void run(async()=>{await send({action:"revoke-device",deviceId:d.device_id});await reload();broadcast();})}>Thu hồi thiết bị này</button>:null}
        </div>)}</details>
      </> : <>

        <form key={mode} className={styles.authForm} onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
          <label>Tên đăng nhập<input name="login" required minLength={3} maxLength={64} autoComplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" disabled={busy}/></label>
          <label>{mode === "recover" ? "Mật khẩu mới" : "Mật khẩu"}<input name="password" type="password" required minLength={mode === "login"||mode==="devices" ? 1 : 15} maxLength={1024} autoComplete={mode === "login"||mode==="devices" ? "current-password" : "new-password"} disabled={busy}/></label>
          {mode==="register"?<label>Nhập lại mật khẩu<input name="passwordConfirm" type="password" required minLength={15} maxLength={1024} autoComplete="new-password" disabled={busy}/></label>:null}
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
                autoComplete={contactType==="email"?"email":"tel"} required maxLength={254} disabled={busy}/>
            </label>
            <small>Chỉ lưu liên hệ đã cung cấp; không gửi mã xác minh lúc đăng ký.</small>
          </fieldset>:null}
          {mode==="login"?<div className={styles.authInlineLinks}><button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("recover")}>Quên mật khẩu?</button></div>:null}
          {(mode === "recover" || mode==="devices") && <label>Mã khôi phục<input name="recoveryCode" required minLength={64} maxLength={64} autoComplete="off" disabled={busy}/></label>}
          {mode==="devices" && recoveryDevices.length>0 ? <label>Thiết bị cần gỡ
            <select name="deviceId" required disabled={busy}>
              {recoveryDevices.map(d=><option key={d.device_id} value={d.device_id}>{d.device_id.slice(0,16)} · {d.created_at}</option>)}
            </select></label>:null}
          {mode==="devices" && recoveryDevices.length>0 ? <label><input type="checkbox" name="approvePending" disabled={busy}/>
            Phê duyệt thiết bị chờ xác nhận thay vì gỡ thiết bị đã liên kết</label>:null}
          {mode === "claim" && <p>Chỉ chuyển hồ sơ bằng trình duyệt đã đăng ký và còn giữ khóa gốc. Tiến độ, quyền và thanh toán cũ được giữ nguyên.</p>}
          {mode === "register" && <>{managerInvite
           ? <p role="status">Lời mời Cán bộ quản lý do Owner cấp. Mật khẩu và khóa thiết bị được tạo riêng tại trang này; tài khoản vẫn phải chờ Owner duyệt và hoàn thiện hồ sơ.</p>
           : <><RegistrationRoles value={role} onChange={setRole} includeManager={false}/><p role="note">Cán bộ quản lý chỉ đăng ký bằng thư mời do Owner cấp trên Application-Management.</p></>}{!v2?[["familyName", "Họ"], ["givenName", "Tên"], ["personCode", "Mã học viên / cán bộ / giảng viên"], ["className", "Lớp / đơn vị"], ["phone", "Số điện thoại"]].map(([name, label]) => <label key={name}>{label}<input name={name} required maxLength={name === "personCode" || name === "phone" ? 32 : 60} disabled={busy} autoComplete={name === "phone" ? "tel" : "off"}/></label>):<p>Đăng ký ID và mật khẩu trước. Sau khi được duyệt, bạn hoàn thiện hồ sơ bắt buộc để vào ứng dụng.</p>}
            <p>Dữ liệu đăng ký được cán bộ được cấp quyền xử lý để xét duyệt, phân lớp và hỗ trợ. Chỉ cán bộ được Owner cấp quyền xem mở rộng mới được xem danh sách ngoài phạm vi được phân công; mỗi lần truy cập đều được ghi nhận.</p>
            <label><input type="checkbox" name="privacyAccepted" required disabled={busy}/>Tôi đã đọc thông báo xử lý dữ liệu đăng ký.</label></>}
          <button type="submit" disabled={busy}>{busy ? "Đang xử lý…" : mode === "register" ? "Gửi đăng ký chờ duyệt" : mode === "claim" ? "Xác minh và chuyển hồ sơ" : mode === "recover" ? "Khôi phục tài khoản" : mode==="devices" ? recoveryDevices.length?"Gỡ thiết bị đã chọn":"Xác minh để xem thiết bị" : "Đăng nhập"}</button>
        </form>
        <div className={styles.authFooter}>
          {mode==="register"?<>Đã có tài khoản? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("login")}>Đăng nhập</button></>
          :mode==="recover"?<>Đã nhớ mật khẩu? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("login")}>Trở về đăng nhập</button></>
          :<>Chưa có tài khoản? <button type="button" className={styles.authTextLink} disabled={busy} onClick={()=>setMode("register")}>Đăng ký</button></>}
        </div>
        <p className={styles.authFootnote}>Hồ sơ cũ được bảo toàn. Việc liên kết tài khoản cần xác minh quyền sở hữu trước khi chuyển dữ liệu.</p>
      </>}
    </section>
    {ready && active && !recovery ? <div key={account.accountId}>{children}</div> : null}
  </>;
}
