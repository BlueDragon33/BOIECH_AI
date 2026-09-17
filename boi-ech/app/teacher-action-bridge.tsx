"use client";

import { useEffect } from "react";

function label(node: Element | null) {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function clickTeacherNav(targetLabel: string) {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>(".teacher-role-nav-list button"))
    .find((item) => label(item.querySelector("span")) === targetLabel);
  button?.click();
}

function openTeacherEditor() {
  const personalEditor = document.querySelector<HTMLButtonElement>(".personal-edit-trigger");
  if (personalEditor) {
    personalEditor.click();
    return;
  }

  const permissionLink = document.querySelector<HTMLAnchorElement>(".editor-request-link");
  if (permissionLink) {
    permissionLink.click();
    return;
  }

  window.location.assign("/bien-tap-noi-dung");
}

const CAPABILITY_TARGETS = ["Học viên", "Phân tích video", "Báo cáo", "Biên tập bài giảng"] as const;

export default function TeacherActionBridge() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;

    const decorate = () => {
      document.querySelectorAll<HTMLElement>(".teacher-capabilities article").forEach((card, index) => {
        card.dataset.teacherCapabilityAction = CAPABILITY_TARGETS[index] ?? "";
        card.setAttribute("role", "button");
        card.tabIndex = 0;
      });
    };

    const activate = (target: HTMLElement) => {
      if (target.closest(".teacher-editor-shortcut")) {
        openTeacherEditor();
        return true;
      }

      const capability = target.closest<HTMLElement>(".teacher-capabilities article");
      if (!capability) return false;
      const action = capability.dataset.teacherCapabilityAction;
      if (action === "Biên tập bài giảng") openTeacherEditor();
      else if (action) clickTeacherNav(action);
      return true;
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target) return;
      if (target.closest(".teacher-editor-shortcut")) event.preventDefault();
      activate(target);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (!target?.closest(".teacher-capabilities article")) return;
      event.preventDefault();
      activate(target);
    };

    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
