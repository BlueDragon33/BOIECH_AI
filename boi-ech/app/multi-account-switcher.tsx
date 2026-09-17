"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const DB_NAME = "boi-ech-doc-lap";
const DB_VERSION = 4;
const DEVICE_STORE = "thiet-bi";
const ACTIVE_KEY = "chinh";
const ACCOUNT_PREFIX = "tai-khoan:";
const SESSION_KEY = "boi-ech-account-session-v1";
const ADDITIONAL_REVIEW_TOKEN = "boi-ech-additional-account-manual-review-v1";
const VIDEO_DB = "boi-ech-video-ai-v1";

type StoredDeviceCredential = {
  version: 2;
  privateKey: CryptoKey | null;
  publicKey: JsonWebKey;
};

type KeyedValue = { key: IDBValidKey; value: unknown };

type LocalAccountState = {
  progress?: unknown;
  offlineActions: unknown[];
  personalContent: KeyedValue[];
  studyStats?: unknown;
};

type AccountMeta = {
  name: string;
  role: "learner" | "teacher" | "unknown";
  personCode: string;
  deviceCode: string;
  status: string;
};

type AccountVaultRecord = {
  version: 1;
  deviceId: string;
  credential: StoredDeviceCredential;
  meta: AccountMeta;
  localState: LocalAccountState;
  savedAt: string;
};

const EMPTY_META: AccountMeta = {
  name: "Tài khoản đã lưu",
  role: "unknown",
  personCode: "",
  deviceCode: "",
  status: "Đã lưu trên thiết bị",
};

function openAccountDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("tien-do")) db.createObjectStore("tien-do");
      if (!db.objectStoreNames.contains(DEVICE_STORE)) db.createObjectStore(DEVICE_STORE);
      if (!db.objectStoreNames.contains("noi-dung")) db.createObjectStore("noi-dung");
      if (!db.objectStoreNames.contains("dong-bo")) db.createObjectStore("dong-bo", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ban-rieng")) db.createObjectStore("ban-rieng");
      if (!db.objectStoreNames.contains("thong-ke-hoc")) db.createObjectStore("thong-ke-hoc");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function readActiveCredential() {
  const db = await openAccountDb();
  const value = await requestValue(db.transaction(DEVICE_STORE, "readonly").objectStore(DEVICE_STORE).get(ACTIVE_KEY));
  return value as StoredDeviceCredential | undefined;
}

async function writeActiveCredential(credential: StoredDeviceCredential) {
  const db = await openAccountDb();
  const transaction = db.transaction(DEVICE_STORE, "readwrite");
  transaction.objectStore(DEVICE_STORE).put(credential, ACTIVE_KEY);
  await transactionDone(transaction);
}

async function canonicalDeviceId(credential: StoredDeviceCredential) {
  const source = credential.publicKey;
  const canonical = JSON.stringify({ kty: source.kty, crv: source.crv, x: source.x, y: source.y });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function readKeyedValues(storeName: string) {
  const db = await openAccountDb();
  const store = db.transaction(storeName, "readonly").objectStore(storeName);
  return new Promise<KeyedValue[]>((resolve, reject) => {
    const values: KeyedValue[] = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(values); return; }
      values.push({ key: cursor.key, value: cursor.value });
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function snapshotLocalState(): Promise<LocalAccountState> {
  const db = await openAccountDb();
  const progress = await requestValue(db.transaction("tien-do", "readonly").objectStore("tien-do").get("bai-03"));
  const offlineActions = await requestValue(db.transaction("dong-bo", "readonly").objectStore("dong-bo").getAll());
  const studyStats = await requestValue(db.transaction("thong-ke-hoc", "readonly").objectStore("thong-ke-hoc").get("current"));
  const personalContent = await readKeyedValues("ban-rieng");
  return { progress, offlineActions, personalContent, studyStats };
}

async function restoreLocalState(state: LocalAccountState) {
  const db = await openAccountDb();
  const transaction = db.transaction(["tien-do", "dong-bo", "ban-rieng", "thong-ke-hoc"], "readwrite");
  const progress = transaction.objectStore("tien-do");
  const offline = transaction.objectStore("dong-bo");
  const personal = transaction.objectStore("ban-rieng");
  const study = transaction.objectStore("thong-ke-hoc");
  progress.clear(); offline.clear(); personal.clear(); study.clear();
  if (state.progress !== undefined) progress.put(state.progress, "bai-03");
  state.offlineActions.forEach((value) => offline.put(value));
  state.personalContent.forEach(({ key, value }) => personal.put(value, key));
  if (state.studyStats !== undefined) study.put(state.studyStats, "current");
  await transactionDone(transaction);
}

async function clearAccountLocalState() {
  await restoreLocalState({ offlineActions: [], personalContent: [] });
}

async function storeVaultRecord(record: AccountVaultRecord) {
  const db = await openAccountDb();
  const transaction = db.transaction(DEVICE_STORE, "readwrite");
  transaction.objectStore(DEVICE_STORE).put(record, `${ACCOUNT_PREFIX}${record.deviceId}`);
  await transactionDone(transaction);
}

async function listVaultRecords() {
  const db = await openAccountDb();
  const store = db.transaction(DEVICE_STORE, "readonly").objectStore(DEVICE_STORE);
  return new Promise<AccountVaultRecord[]>((resolve, reject) => {
    const records: AccountVaultRecord[] = [];
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        records.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
        resolve(records);
        return;
      }
      if (typeof cursor.key === "string" && cursor.key.startsWith(ACCOUNT_PREFIX)) {
        const value = cursor.value as AccountVaultRecord;
        if (value?.version === 1 && value.credential?.version === 2) records.push(value);
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function archiveActiveAccount(meta: AccountMeta) {
  const credential = await readActiveCredential();
  if (!credential?.publicKey || !crypto.subtle) return null;
  const deviceId = await canonicalDeviceId(credential);
  const existing = (await listVaultRecords()).find((item) => item.deviceId === deviceId);
  const localState = await snapshotLocalState();
  const mergedMeta = {
    ...(existing?.meta ?? EMPTY_META),
    ...Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== "" && value !== "unknown")),
  } as AccountMeta;
  const record: AccountVaultRecord = {
    version: 1,
    deviceId,
    credential,
    meta: mergedMeta,
    localState,
    savedAt: new Date().toISOString(),
  };
  await storeVaultRecord(record);
  return record;
}

async function generateCredential(): Promise<StoredDeviceCredential> {
  if (!crypto.subtle) {
    const random = () => {
      let binary = "";
      crypto.getRandomValues(new Uint8Array(32)).forEach((byte) => { binary += String.fromCharCode(byte); });
      return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    };
    return { version: 2, privateKey: null, publicKey: { kty: "EC", crv: "P-256", x: random(), y: random() } };
  }
  const generated = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const publicKey = await crypto.subtle.exportKey("jwk", generated.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", generated.privateKey);
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { version: 2, privateKey, publicKey };
}

function clearVideoHistoryForPrivacy() {
  try { indexedDB.deleteDatabase(VIDEO_DB); } catch { /* Không chặn đổi tài khoản nếu DB đang bận. */ }
}

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function metaFromDom(): AccountMeta {
  const chip = document.querySelector<HTMLElement>(".learner-chip");
  const roleText = text(chip?.querySelector("small"));
  const name = text(chip?.querySelector("strong")).replace(/^Chào\s+/i, "") || "";
  const title = chip?.getAttribute("title") ?? "";
  const personCode = title.includes("·") ? title.split("·").slice(1).join("·").trim() : "";
  const gateStatus = text(document.querySelector(".device-gate-status"));
  const deviceCode = text(document.querySelector(".device-code-box strong"));
  return {
    name: name || (gateStatus ? "Tài khoản đang đăng ký" : EMPTY_META.name),
    role: roleText === "Giảng viên" ? "teacher" : roleText === "Học viên" ? "learner" : "unknown",
    personCode,
    deviceCode,
    status: gateStatus || (chip ? "Đã vào học" : "Đã lưu trên thiết bị"),
  };
}

function roleLabel(role: AccountMeta["role"]) {
  return role === "teacher" ? "Giảng viên" : role === "learner" ? "Học viên" : "Chưa chọn vai trò";
}

export default function MultiAccountSwitcher() {
  const [accounts, setAccounts] = useState<AccountVaultRecord[]>([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [topbarMount, setTopbarMount] = useState<HTMLElement | null>(null);
  const [hasGate, setHasGate] = useState(false);
  const [activeDeviceId, setActiveDeviceId] = useState("");

  async function refreshAccounts() {
    try {
      const credential = await readActiveCredential();
      const currentId = credential?.publicKey && crypto.subtle ? await canonicalDeviceId(credential) : "";
      setActiveDeviceId(currentId);
      setAccounts(await listVaultRecords());
    } catch { /* UI chính vẫn hoạt động nếu kho cục bộ tạm lỗi. */ }
  }

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    const loggedOut = window.localStorage.getItem(SESSION_KEY) === "logged-out";
    setChooserOpen(loggedOut);
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setTopbarMount(document.querySelector<HTMLElement>(".topbar-actions"));
        setHasGate(Boolean(document.querySelector(".device-gate")));
        if (document.querySelector(".learner-chip") || document.querySelector(".device-code-box")) {
          void archiveActiveAccount(metaFromDom()).then(() => refreshAccounts()).catch(() => undefined);
        } else {
          void refreshAccounts();
        }
      }, 180);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  const activeRecord = useMemo(() => accounts.find((item) => item.deviceId === activeDeviceId), [accounts, activeDeviceId]);

  async function logout() {
    setBusy(true); setError("");
    try {
      await archiveActiveAccount(metaFromDom());
      await refreshAccounts();
      window.localStorage.setItem(SESSION_KEY, "logged-out");
      setChooserOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể mở bộ đổi tài khoản.");
    } finally { setBusy(false); }
  }

  async function activate(record: AccountVaultRecord) {
    setBusy(true); setError("");
    try {
      await archiveActiveAccount(metaFromDom()).catch(() => undefined);
      await restoreLocalState(record.localState);
      await writeActiveCredential(record.credential);
      clearVideoHistoryForPrivacy();
      window.localStorage.removeItem("boi-ech-device-token-v1");
      window.localStorage.setItem(SESSION_KEY, "logged-in");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể chuyển tài khoản.");
      setBusy(false);
    }
  }

  async function addAccount() {
    setBusy(true); setError("");
    try {
      await archiveActiveAccount(metaFromDom()).catch(() => undefined);
      const credential = await generateCredential();
      await clearAccountLocalState();
      await writeActiveCredential(credential);
      clearVideoHistoryForPrivacy();
      window.localStorage.setItem("boi-ech-device-token-v1", ADDITIONAL_REVIEW_TOKEN);
      window.localStorage.setItem(SESSION_KEY, "logged-in");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể tạo hồ sơ đăng ký mới.");
      setBusy(false);
    }
  }

  const trigger = (
    <button className="multi-account-trigger" type="button" onClick={() => void logout()} disabled={busy} title="Đăng xuất hoặc đổi tài khoản trên thiết bị này">
      <span aria-hidden="true">⇄</span><b>Đổi tài khoản</b>
    </button>
  );

  return (
    <>
      {topbarMount ? createPortal(trigger, topbarMount) : hasGate ? <div className="multi-account-floating">{trigger}</div> : null}
      {chooserOpen ? (
        <div className="multi-account-overlay" role="dialog" aria-modal="true" aria-labelledby="multi-account-title">
          <section className="multi-account-dialog">
            <header><div><span>Tài khoản trên thiết bị này</span><h2 id="multi-account-title">Đăng xuất · Đổi tài khoản</h2></div></header>
            <p className="multi-account-intro">Mỗi tài khoản có khóa, tiến độ, hàng đợi offline và bản chỉnh sửa riêng. Tài khoản mới phải được quản trị duyệt trước khi sử dụng.</p>
            <div className="multi-account-list">
              {accounts.length ? accounts.map((account) => (
                <button key={account.deviceId} className={account.deviceId === activeDeviceId ? "current" : ""} disabled={busy} onClick={() => void activate(account)}>
                  <span className="multi-account-avatar">{account.meta.name.slice(0, 1).toUpperCase()}</span>
                  <span className="multi-account-copy"><strong>{account.meta.name}</strong><small>{roleLabel(account.meta.role)}{account.meta.personCode ? ` · ${account.meta.personCode}` : ""}</small><em>{account.meta.status}{account.meta.deviceCode ? ` · ${account.meta.deviceCode}` : ""}</em></span>
                  <b>{account.deviceId === activeDeviceId ? "Đang dùng" : "Vào"}</b>
                </button>
              )) : <div className="multi-account-empty">Chưa có tài khoản nào được lưu. Bạn có thể đăng ký tài khoản đầu tiên ngay trên thiết bị này.</div>}
            </div>
            <button className="multi-account-add" type="button" onClick={() => void addAccount()} disabled={busy}><span>＋</span><div><strong>Đăng ký tài khoản mới</strong><small>Chọn Học viên hoặc Giảng viên ở bước đăng ký tiếp theo</small></div><b>→</b></button>
            {activeRecord ? <p className="multi-account-note">Tài khoản vừa đăng xuất vẫn được lưu cục bộ và có thể quay lại mà không trộn tiến độ.</p> : null}
            {error ? <div className="multi-account-error" role="alert">{error}</div> : null}
            {busy ? <div className="multi-account-working">Đang chuyển vùng dữ liệu tài khoản…</div> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
