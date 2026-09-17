"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Role = "learner" | "teacher" | "";
type MenuPosition = { top: number; left: number };

function text(node: Element | null | undefined) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function teacherNav(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".teacher-role-nav-list button"))
    .find((item) => text(item.querySelector("span")) === label);
  button?.click();
}

function learnerNav(label: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".student-role-nav-list button"))
    .find((item) => text(item.querySelector("span")) === label);
  button?.click();
}

function accountSwitcherTrigger() {
  return document.querySelector<HTMLButtonElement>(".multi-account-trigger");
}

function openAccountChooser() {
  accountSwitcherTrigger()?.click();
}

function registerAnotherAccount() {
  openAccountChooser();
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    const add = document.querySelector<HTMLButtonElement>(".multi-account-add");
    if (add) {
      window.clearInterval(timer);
      add.click();
      return;
    }
    if (attempts >= 30) window.clearInterval(timer);
  }, 50);
}

function openTeacherEditor() {
  const localEditor = document.querySelector<HTMLButtonElement>(".personal-edit-trigger");
  if (localEditor && !localEditor.disabled) {
    localEditor.click();
    return;
  }
  const requestLink = document.querySelector<HTMLAnchorElement>(".editor-request-link");
  if (requestLink?.href) {
    window.location.assign(requestLink.href);
    return;
  }
  window.location.assign("/bien-tap-noi-dung");
}

const capabilityActions: Record<string, () => void> = {
  "Theo dõi học viên": () => teacherNav("Học viên"),
  "Giám sát AI": () => teacherNav("Phân tích video"),
  "Phát hiện cần hỗ trợ": () => teacherNav("Báo cáo"),
  "Biên tập bài giảng": openTeacherEditor,
};

export default function RoleInteractionBridge() {
  const [chipMount, setChipMount] = useState<HTMLElement | null>(null);
  const [role, setRole] = useState<Role>("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const chipRef = useRef<HTMLElement | null>(null);

  function placeMenu() {
    const chip = chipRef.current;
    if (!chip) return;
    const rect = chip.getBoundingClientRect();
    const width = 272;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
    setMenuPosition({ top: rect.bottom + 8, left });
  }

  function toggleMenu() {
    if (!menuOpen) placeMenu();
    setMenuOpen((value) => !value);
  }

  useEffect(() => {
    if (window.location.pathname !== "/") return;
    let timer = 0;
    const sync = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const chip = document.querySelector<HTMLElement>(".learner-chip");
        const roleText = text(chip?.querySelector("small"));
        const nextRole: Role = roleText === "Giảng viên" ? "teacher" : roleText === "Học viên" ? "learner" : "";
        chipRef.current = chip;
        setChipMount(chip);
        setRole(nextRole);

        document.querySelectorAll<HTMLElement>(".teacher-capabilities article").forEach((card) => {
          const title = text(card.querySelector("strong"));
          if (!capabilityActions[title]) return;
          card.dataset.teacherAction = title;
          card.setAttribute("role", "button");
          card.setAttribute("tabindex", "0");
          card.setAttribute("aria-label", title);
        });
      }, 0);
    };
    sync();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-role-interaction-ui]"))) return;
      sync();
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "title"] });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const editorLink = target.closest<HTMLAnchorElement>(".teacher-editor-shortcut, .teacher-profile-actions a[href^='/bien-tap-noi-dung']");
      if (editorLink) {
        event.preventDefault();
        openTeacherEditor();
        return;
      }

      const capability = target.closest<HTMLElement>(".teacher-capabilities article[data-teacher-action]");
      if (capability) {
        event.preventDefault();
        capabilityActions[capability.dataset.teacherAction ?? ""]?.();
        return;
      }

      if (menuOpen && !menuRef.current?.contains(target) && !chipRef.current?.contains(target)) setMenuOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target instanceof Element ? event.target : null;
      const capability = target?.closest<HTMLElement>(".teacher-capabilities article[data-teacher-action]");
      if (!capability) return;
      event.preventDefault();
      capabilityActions[capability.dataset.teacherAction ?? ""]?.();
    };
    const reposition = () => { if (menuOpen) placeMenu(); };
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKey, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKey, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [menuOpen]);

  const trigger = chipMount && role ? createPortal(
    <div className="role-account-chip-mount" data-role-interaction-ui>
      <button className="role-account-chip-trigger" type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={toggleMenu} title="Tài khoản">
        <span aria-hidden="true">⌄</span>
      </button>
    </div>,
    chipMount,
  ) : null;

  return <>
    {trigger}
    {menuOpen && role ? <div ref={menuRef} className="role-account-menu" style={{ top: menuPosition.top, left: menuPosition.left }} role="menu" data-role-interaction-ui>
      <header><span>{role === "teacher" ? "Giảng viên" : "Học viên"}</span><strong>{text(chipMount?.querySelector("strong")) || "Tài khoản"}</strong></header>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); openAccountChooser(); }}><span>⇄</span><div><strong>Đổi tài khoản</strong><small>Chọn một tài khoản đã lưu trên thiết bị</small></div></button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); registerAnotherAccount(); }}><span>＋</span><div><strong>Đăng ký tài khoản mới</strong><small>Tạo thêm Học viên hoặc Giảng viên để quản trị duyệt</small></div></button>
      <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); role === "teacher" ? teacherNav("Hồ sơ") : learnerNav("Hồ sơ"); }}><span>◎</span><div><strong>Hồ sơ</strong><small>Mở thông tin và quyền của tài khoản hiện tại</small></div></button>
    </div> : null}
  </>;
}
