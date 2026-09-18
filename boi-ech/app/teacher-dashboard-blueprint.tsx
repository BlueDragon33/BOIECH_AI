"use client";

import { useEffect } from "react";

type AttentionFilter = "all" | "support" | "slow" | "weak-ai";

type BlueprintState = {
  attentionFilter: AttentionFilter;
  classFilter: string;
  notes: Map<string, string>;
};

function clean(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function numericPercent(value: string) {
  const match = value.match(/(\d{1,3})\s*%/);
  return match ? Number(match[1]) : null;
}

function learnerRows() {
  return Array.from(document.querySelectorAll<HTMLTableRowElement>(".teacher-watchlist .teacher-table tbody tr"));
}

function rowClassName(row: HTMLTableRowElement) {
  return clean(row.querySelector(".teacher-student small")?.textContent);
}

function rowNeedsSupport(row: HTMLTableRowElement) {
  return Boolean(row.querySelector(".teacher-status.warn"));
}

function rowProgress(row: HTMLTableRowElement) {
  return numericPercent(clean(row.querySelector(".teacher-progress")?.textContent));
}

function rowHasWeakAi(row: HTMLTableRowElement) {
  const warning = clean(row.querySelector(".teacher-status")?.textContent).toLocaleLowerCase("vi");
  return warning.includes("tin cậy") || warning.includes("ai");
}

function scrollTo(selector: string) {
  const target = document.querySelector<HTMLElement>(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.remove("teacher-blueprint-focus");
  requestAnimationFrame(() => target.classList.add("teacher-blueprint-focus"));
  window.setTimeout(() => target.classList.remove("teacher-blueprint-focus"), 1500);
}

function openLocalNote(article: HTMLElement, state: BlueprintState) {
  const learner = clean(article.querySelector(".teacher-analysis-copy strong")?.textContent) || "Học viên";
  const key = learner.toLocaleLowerCase("vi");
  document.querySelector(".teacher-note-backdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "teacher-note-backdrop";
  backdrop.dataset.teacherBlueprint = "note";
  backdrop.innerHTML = `
    <section class="teacher-note-dialog" role="dialog" aria-modal="true" aria-label="Ghi chú Giảng viên cho ${learner}">
      <header>
        <div><small>GHI CHÚ PHIÊN HIỆN TẠI</small><strong>${learner}</strong></div>
        <button type="button" data-note-close aria-label="Đóng">×</button>
      </header>
      <p>Ghi chú này chỉ tồn tại trong phiên đang mở, chưa gửi tới học viên và không thay đổi kết quả AI.</p>
      <textarea rows="6" maxlength="1200" placeholder="Nhập nhận xét chuyên môn để đối chiếu trong phiên này..."></textarea>
      <footer><span>Không đồng bộ máy chủ</span><button type="button" data-note-save>Lưu ghi chú cục bộ</button></footer>
    </section>`;
  document.body.append(backdrop);
  const textarea = backdrop.querySelector<HTMLTextAreaElement>("textarea");
  if (textarea) {
    textarea.value = state.notes.get(key) ?? "";
    textarea.focus();
  }
  const close = () => backdrop.remove();
  backdrop.querySelector("[data-note-close]")?.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector("[data-note-save]")?.addEventListener("click", () => {
    const value = clean(textarea?.value);
    if (value) state.notes.set(key, value);
    else state.notes.delete(key);
    article.classList.toggle("has-local-note", Boolean(value));
    let marker = article.querySelector<HTMLElement>(".teacher-local-note-marker");
    if (value && !marker) {
      marker = document.createElement("span");
      marker.className = "teacher-local-note-marker";
      marker.textContent = "Đã ghi chú";
      article.querySelector(".teacher-analysis-copy")?.append(marker);
    }
    if (!value) marker?.remove();
    close();
  });
}

function applyAttentionFilters(state: BlueprintState) {
  const rows = learnerRows();
  let visible = 0;
  rows.forEach((row) => {
    const classMatches = !state.classFilter || rowClassName(row) === state.classFilter;
    const filterMatches = state.attentionFilter === "all"
      || (state.attentionFilter === "support" && rowNeedsSupport(row))
      || (state.attentionFilter === "slow" && (rowProgress(row) ?? 100) < 50)
      || (state.attentionFilter === "weak-ai" && rowHasWeakAi(row));
    const show = classMatches && filterMatches;
    row.hidden = !show;
    if (show) visible += 1;
  });

  document.querySelectorAll<HTMLButtonElement>(".teacher-watch-filters button[data-watch-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.watchFilter === state.attentionFilter);
    button.setAttribute("aria-pressed", String(button.dataset.watchFilter === state.attentionFilter));
  });

  const counter = document.querySelector<HTMLElement>("[data-visible-attention-count]");
  if (counter) counter.textContent = `${visible} hiển thị`;
  const empty = document.querySelector<HTMLElement>(".teacher-blueprint-filter-empty");
  if (empty) empty.hidden = visible !== 0;
}

function ensureAttentionToolbar(state: BlueprintState) {
  const card = document.querySelector<HTMLElement>(".teacher-watchlist");
  const table = card?.querySelector<HTMLElement>(".teacher-table-wrap");
  if (!card || !table) return;
  let toolbar = card.querySelector<HTMLElement>(".teacher-watch-toolbar");
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.className = "teacher-watch-toolbar";
    toolbar.dataset.teacherBlueprint = "attention-toolbar";
    toolbar.innerHTML = `
      <div class="teacher-watch-filters" role="group" aria-label="Lọc học viên cần chú ý">
        <button type="button" data-watch-filter="all" class="active">Tất cả</button>
        <button type="button" data-watch-filter="support">Cần hỗ trợ</button>
        <button type="button" data-watch-filter="slow">Chậm tiến độ</button>
        <button type="button" data-watch-filter="weak-ai">AI kém tin cậy</button>
      </div>
      <div class="teacher-watch-tools">
        <span data-visible-attention-count></span>
        <select aria-label="Lọc theo lớp"><option value="">Tất cả lớp</option></select>
      </div>`;
    table.insertAdjacentElement("beforebegin", toolbar);
    const empty = document.createElement("div");
    empty.className = "teacher-blueprint-filter-empty";
    empty.hidden = true;
    empty.textContent = "Không có học viên phù hợp với bộ lọc này.";
    table.insertAdjacentElement("afterend", empty);

    toolbar.querySelectorAll<HTMLButtonElement>("button[data-watch-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        state.attentionFilter = (button.dataset.watchFilter as AttentionFilter) || "all";
        applyAttentionFilters(state);
      });
    });
    toolbar.querySelector<HTMLSelectElement>("select")?.addEventListener("change", (event) => {
      state.classFilter = (event.currentTarget as HTMLSelectElement).value;
      applyAttentionFilters(state);
    });
  }

  const select = toolbar.querySelector<HTMLSelectElement>("select");
  if (select) {
    const current = select.value;
    const classes = Array.from(new Set(learnerRows().map(rowClassName).filter(Boolean))).sort((a, b) => a.localeCompare(b, "vi"));
    const signature = classes.join("|");
    if (select.dataset.classes !== signature) {
      select.dataset.classes = signature;
      select.innerHTML = `<option value="">Tất cả lớp</option>${classes.map((name) => `<option value="${name.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">${name}</option>`).join("")}`;
      select.value = classes.includes(current) ? current : "";
      state.classFilter = select.value;
    }
  }
  applyAttentionFilters(state);
}

function ensureTopbarTools() {
  const actions = document.querySelector<HTMLElement>("body[data-teacher-role-ui='active'] .topbar-actions");
  const chip = actions?.querySelector<HTMLElement>(".learner-chip");
  if (!actions || !chip) return;
  if (!actions.querySelector(".teacher-mode-badge")) {
    const badge = document.createElement("span");
    badge.className = "teacher-mode-badge";
    badge.dataset.teacherBlueprint = "mode-badge";
    badge.textContent = "Giảng viên Pro";
    actions.insertBefore(badge, chip);
  }
  if (!actions.querySelector(".teacher-alert-shortcut")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "teacher-alert-shortcut";
    button.dataset.teacherBlueprint = "alert-shortcut";
    button.setAttribute("aria-label", "Mở cảnh báo nhanh");
    button.innerHTML = `<span>!</span>`;
    button.addEventListener("click", () => scrollTo(".teacher-alert-list"));
    actions.insertBefore(button, chip);
  }
}

function ensureHeroDetails() {
  const hero = document.querySelector<HTMLElement>(".teacher-hero");
  if (!hero) return;
  if (!hero.querySelector(".teacher-hero-value-stack")) {
    const values = document.createElement("div");
    values.className = "teacher-hero-value-stack";
    values.dataset.teacherBlueprint = "hero-values";
    values.innerHTML = `<span>KỸ THUẬT TỐT</span><span>HỌC VIÊN TIẾN BỘ</span><span>CỘNG ĐỒNG KHỎE HƠN</span>`;
    hero.append(values);
  }
  if (!hero.querySelector(".teacher-hero-dots")) {
    const dots = document.createElement("div");
    dots.className = "teacher-hero-dots";
    dots.dataset.teacherBlueprint = "hero-dots";
    dots.innerHTML = `<i class="active"></i><i></i><i></i>`;
    hero.append(dots);
  }
}

function ensureReviewActions(state: BlueprintState) {
  document.querySelectorAll<HTMLElement>(".teacher-analysis-queue-list article").forEach((article) => {
    if (!article.querySelector(".teacher-review-state")) {
      const stateTag = document.createElement("span");
      stateTag.className = "teacher-review-state";
      const quality = article.dataset.analysisQuality === "good" ? "good" : "review";
      stateTag.dataset.reviewQuality = quality;
      stateTag.textContent = quality === "good" ? "Đủ bằng chứng" : "Cần xem";
      article.querySelector(".teacher-analysis-thumb")?.append(stateTag);
    }
    const actions = article.querySelector<HTMLElement>(".teacher-analysis-actions");
    if (actions && !actions.querySelector(".teacher-local-note-action")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "teacher-local-note-action";
      button.textContent = "Ghi chú";
      button.addEventListener("click", () => openLocalNote(article, state));
      actions.append(button);
    }
  });
}

function ensureDashboardFooter() {
  const dashboard = document.querySelector<HTMLElement>(".teacher-dashboard");
  if (!dashboard || dashboard.querySelector(".teacher-dashboard-footer")) return;
  const footer = document.createElement("footer");
  footer.className = "teacher-dashboard-footer";
  footer.dataset.teacherBlueprint = "footer";
  footer.innerHTML = `<strong>Bơi ếch AI</strong><span>Vì thế hệ biết bơi an toàn</span><span>Giảng viên đồng hành</span><span>Học viên vững vàng</span>`;
  dashboard.append(footer);
}

export default function TeacherDashboardBlueprint() {
  useEffect(() => {
    if (window.location.pathname !== "/") return;
    const state: BlueprintState = { attentionFilter: "all", classFilter: "", notes: new Map() };
    let timer = 0;
    const sync = () => {
      timer = 0;
      if (document.body.dataset.teacherRoleUi !== "active") {
        delete document.body.dataset.teacherBlueprint;
        return;
      }
      document.body.dataset.teacherBlueprint = "active";
      ensureTopbarTools();
      ensureHeroDetails();
      ensureAttentionToolbar(state);
      ensureReviewActions(state);
      ensureDashboardFooter();
    };
    const schedule = () => {
      if (timer) return;
      timer = window.setTimeout(sync, 0);
    };
    schedule();
    const observer = new MutationObserver((mutations) => {
      if (mutations.every((mutation) => mutation.target instanceof Element && mutation.target.closest("[data-teacher-blueprint]"))) return;
      schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "data-teacher-role-ui"] });
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
      document.querySelectorAll("[data-teacher-blueprint]").forEach((node) => node.remove());
      delete document.body.dataset.teacherBlueprint;
    };
  }, []);
  return null;
}
