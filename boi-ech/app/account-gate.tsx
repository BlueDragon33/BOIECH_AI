"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import RegistrantReader from "./registrant-reader";
import { accountTransitionNeedsReload } from "./account-scope";
import { RegistrationRoles } from "./registration-roles";
import { portableCredential, preparePortableAccount } from "./multi-account-switcher";
import styles from "./account-gate.module.css";
type Account = { accountId: string; status: string; role: string; name: string; expiresAt: string | null; canReadRegistrants?: boolean };
type Device = { device_id: string; revoked: number; created_at: string };
type Mode = "login" | "register" | "claim" | "recover";
async function send(body: Record<string, unknown>) {
  const response = await fetch("/api/accounts", { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Chưa xác minh được thao tác tài khoản.");
  return data as { recoveryCode?: string; accountId?: string; account?: Account };
}
export default function AccountGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const bypass = pathname === "/xem-thu-can-bo-quan-ly" || pathname.startsWith("/quan-ly-thiet-bi") || pathname.startsWith("/bien-tap-");
  const [account, setAccount] = useState<Account | null>(null), [devices, setDevices] = useState<Device[]>([]);
  const [observedNow,setObservedNow] = useState(0);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("login"), [role, setRole] = useState<"learner" | "manager" | "teacher">("learner");
  const [recovery, setRecovery] = useState(""), [notice, setNotice] = useState("");
  const recoveryOwner = useRef("");
  const lock = useRef(false), mounted = useRef(false), current = useRef("");
  const reload = useCallback(async (claim = false) => {
    const response = await fetch("/api/accounts", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json() as { account?: Account | null; devices?: Device[]; error?: string };
    if (!response.ok) {
      if (response.status === 401) { setRecovery(""); recoveryOwner.current = ""; if(current.current){setReady(false);window.location.reload();return;} await preparePortableAccount(null); current.current = ""; if (mounted.current) { setAccount(null); setReady(true); } return; }
      throw new Error(data.error ?? "Không đọc được phiên đăng nhập.");
    }
    // Keep a document's namespace immutable: old async completions can only write its old account store.
    if (accountTransitionNeedsReload(current.current,data.account?.accountId ?? "")) {
      setReady(false); setRecovery(""); recoveryOwner.current=""; window.location.reload(); return;
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
  useEffect(() => {
    if (!enabled || bypass) return;
    mounted.current = true;
    document.documentElement.dataset.accountFirst = "true";
    const refresh = () => { if (!document.hidden && !lock.current) void reload().catch(e => { if (mounted.current) setError(e instanceof Error ? e.message : "Chưa đồng bộ."); }); };
    refresh(); window.addEventListener("focus", refresh); window.addEventListener("pageshow",refresh);
    const timer = window.setInterval(() => { if(mounted.current) setObservedNow(Date.now()); refresh(); },60000);
    const channel = new BroadcastChannel("boiech-account-auth"); channel.onmessage = refresh;
    return () => { mounted.current = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("pageshow",refresh); channel.close(); };
  }, [enabled, bypass, reload]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Chưa hoàn tất thao tác."); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function broadcast() { const c = new BroadcastChannel("boiech-account-auth"); c.postMessage("changed"); c.close(); }
  async function submit(form: HTMLFormElement) {
    const fields = Object.fromEntries(new FormData(form));
    // Password is used for this HTTPS submission only, then cleared from the input.
    const password = fields.password; const field = form.elements.namedItem("password") as HTMLInputElement | null;
    if (field) field.value = "";
    await run(async () => {
      const key = mode === "recover" ? {} : await portableCredential(mode === "claim");
      const result = await send({ ...fields, password, ...key, action: mode, role, privacyAccepted: fields.privacyAccepted === "on" });
      if (result.recoveryCode) { recoveryOwner.current = result.account?.accountId ?? result.accountId ?? ""; setRecovery(result.recoveryCode); }
      if (mode === "recover") { setMode("login"); setNotice("Đã đổi mật khẩu và thu hồi các phiên cũ. Hãy lưu mã khôi phục mới."); }
      await reload(mode === "claim"); broadcast();
    });
  }
  if (!enabled || bypass) return children;
  const active = account?.status === "approved" && (!account.expiresAt || Date.parse(account.expiresAt) > observedNow);
  return <>
    <section className={styles.root} aria-label="Tài khoản Bơi Ếch">
      <h1>{account ? "Tài khoản Bơi Ếch" : "Đăng nhập Bơi Ếch"}</h1>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {recovery && <section className={styles.recovery}><h2>Lưu mã khôi phục một lần</h2>
        <p>Mã này dùng để đặt mật khẩu mới khi quên. Giữ riêng ở nơi an toàn; hệ thống không hiển thị lại.</p>
        <code>{recovery}</code><button type="button" onClick={() => setRecovery("")}>Tôi đã lưu mã an toàn</button></section>}
      {!ready ? <p role="status">Đang kiểm tra phiên…</p> : account ? <>
        <p>{account.name} · {account.role === "manager" ? "Cán bộ quản lý" : account.role === "teacher" ? "Giảng viên" : "Học viên"}</p>
        {!active && <p role="status" className={styles.pending}>{account.status === "pending" ? "Chờ duyệt tài khoản. Bạn chỉ cần đăng ký một lần; trạng thái sẽ dùng chung trên mọi thiết bị." : "Tài khoản đã bị khóa hoặc hết hạn. Liên hệ cán bộ có thẩm quyền."}</p>}
        <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void run(() => reload())}>Đồng bộ trạng thái</button>
          <button type="button" disabled={busy} onClick={() => void run(async () => { await send({ action: "rotate" }); await reload(); setNotice("Đã đổi vé phiên an toàn; tối đa 8 giờ kể từ khi đăng nhập."); })}>Gia hạn phiên</button>
          <button type="button" disabled={busy} onClick={() => void run(async () => { setReady(false); setRecovery(""); recoveryOwner.current=""; await send({ action: "logout" }); broadcast(); window.location.reload(); })}>Đăng xuất / đổi tài khoản</button></div>
        {active&&account.canReadRegistrants?<RegistrantReader/>:null}
        <details><summary>Thiết bị đã đăng nhập</summary>{devices.map(d => <p key={d.device_id}><span>{d.device_id.slice(0, 12)} · {d.revoked ? "Đã thu hồi" : "Đang được phép"}</span>{!d.revoked && <button type="button" disabled={busy} onClick={() => void run(async () => { await send({ action: "revoke-device", deviceId: d.device_id }); await reload(); broadcast(); })}>Thu hồi thiết bị này</button>}</p>)}</details>
      </> : <>
        <div className={styles.actions}>{([["login", "Đăng nhập"], ["register", "Đăng ký một lần"], ["claim", "Chuyển hồ sơ cũ"], ["recover", "Quên mật khẩu"]] as [Mode, string][]).map(([id, label]) => <button type="button" key={id} aria-pressed={mode === id} disabled={busy} onClick={() => setMode(id)}>{label}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); void submit(e.currentTarget); }}>
          <label>Tên đăng nhập<input name="login" required minLength={3} maxLength={64} autoComplete="username" pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,63}" disabled={busy}/></label>
          <label>{mode === "recover" ? "Mật khẩu mới" : "Mật khẩu"}<input name="password" type="password" required minLength={mode === "login" ? 1 : 15} maxLength={1024} autoComplete={mode === "login" ? "current-password" : "new-password"} disabled={busy}/></label>
          {mode === "recover" && <label>Mã khôi phục<input name="recoveryCode" required minLength={64} maxLength={64} autoComplete="off" disabled={busy}/></label>}
          {mode === "claim" && <p>Chỉ chuyển hồ sơ bằng trình duyệt đã đăng ký và còn giữ khóa gốc. Tiến độ, quyền và thanh toán cũ được giữ nguyên.</p>}
          {mode === "register" && <><RegistrationRoles value={role} onChange={setRole}/>{[["familyName", "Họ"], ["givenName", "Tên"], ["personCode", "Mã học viên / cán bộ / giảng viên"], ["className", "Lớp / đơn vị"], ["phone", "Số điện thoại"]].map(([name, label]) => <label key={name}>{label}<input name={name} required maxLength={name === "personCode" || name === "phone" ? 32 : 60} disabled={busy} autoComplete={name === "phone" ? "tel" : "off"}/></label>)}
            <p>Dữ liệu đăng ký được cán bộ được cấp quyền xử lý để xét duyệt, phân lớp và hỗ trợ. Chỉ cán bộ được Owner cấp quyền xem mở rộng mới được xem danh sách ngoài phạm vi được phân công; mỗi lần truy cập đều được ghi nhận.</p>
            <label><input type="checkbox" name="privacyAccepted" required disabled={busy}/>Tôi đã đọc thông báo xử lý dữ liệu đăng ký.</label></>}
          <button type="submit" disabled={busy}>{busy ? "Đang xử lý…" : mode === "register" ? "Gửi đăng ký chờ duyệt" : mode === "claim" ? "Xác minh và chuyển hồ sơ" : mode === "recover" ? "Khôi phục tài khoản" : "Đăng nhập"}</button>
        </form>
      </>}
    </section>
    {ready && active && !recovery ? <div key={account.accountId}>{children}</div> : null}
  </>;
}
