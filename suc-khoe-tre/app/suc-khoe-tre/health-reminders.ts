import type { Reminder } from "./health-local-store";

const dayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

function parseLocal(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  const result = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isFinite(result.getTime()) ? result : null;
}

function formatLocal(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

export function recurrenceRule(reminder: Reminder) {
  if (reminder.repeat === "daily") return "RRULE:FREQ=DAILY";
  if (reminder.repeat === "weekdays") return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (reminder.repeat === "weekly") {
    const start = parseLocal(reminder.date, reminder.time);
    return start ? `RRULE:FREQ=WEEKLY;BYDAY=${dayCodes[start.getDay()]}` : "RRULE:FREQ=WEEKLY";
  }
  return "";
}

export function nextReminderOccurrence(reminder: Reminder, from = new Date()) {
  if (!reminder.enabled) return null;
  const start = parseLocal(reminder.date, reminder.time);
  if (!start) return null;
  if (reminder.repeat === "once") return start >= from ? start : null;
  if (reminder.repeat === "daily") {
    const candidate = new Date(from);
    candidate.setHours(start.getHours(), start.getMinutes(), 0, 0);
    if (candidate < from) candidate.setDate(candidate.getDate() + 1);
    if (candidate < start) return start;
    return candidate;
  }
  if (reminder.repeat === "weekdays") {
    const candidate = new Date(from);
    candidate.setHours(start.getHours(), start.getMinutes(), 0, 0);
    for (let i = 0; i < 8; i += 1) {
      if (candidate >= start && candidate >= from && candidate.getDay() >= 1 && candidate.getDay() <= 5) return candidate;
      candidate.setDate(candidate.getDate() + 1);
    }
    return null;
  }
  const targetDay = start.getDay();
  const candidate = new Date(from);
  candidate.setHours(start.getHours(), start.getMinutes(), 0, 0);
  const delta = (targetDay - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + delta);
  if (candidate < from) candidate.setDate(candidate.getDate() + 7);
  if (candidate < start) return start;
  return candidate;
}

export function occurrenceDueNow(reminder: Reminder, now = new Date(), graceMinutes = 2) {
  const from = new Date(now.getTime() - graceMinutes * 60_000);
  const occurrence = nextReminderOccurrence(reminder, from);
  if (!occurrence || occurrence > now) return null;
  return occurrence;
}

export function reminderIcs(reminder: Reminder) {
  const start = parseLocal(reminder.date, reminder.time);
  if (!start) return "";
  const end = new Date(start.getTime() + 30 * 60_000);
  const rule = recurrenceRule(reminder);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Suc Khoe Y Te//Reminder 9-10//VI",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(reminder.id)}@suc-khoe-y-te`,
    `DTSTAMP:${formatLocal(new Date())}`,
    `DTSTART:${formatLocal(start)}`,
    `DTEND:${formatLocal(end)}`,
    `SUMMARY:${escapeIcs(reminder.title)}`,
    "DESCRIPTION:Nhắc việc từ Web App Sức khỏe Y tế 9–10 tuổi.",
  ];
  if (rule) lines.push(rule);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function downloadReminderIcs(reminder: Reminder) {
  const content = reminderIcs(reminder);
  if (!content || typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `suc-khoe-${reminder.id}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(reminder: Reminder) {
  const start = parseLocal(reminder.date, reminder.time);
  if (!start) return "";
  const end = new Date(start.getTime() + 30 * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: reminder.title,
    dates: `${formatLocal(start)}/${formatLocal(end)}`,
    details: "Nhắc việc từ Web App Sức khỏe Y tế 9–10 tuổi.",
  });
  const rule = recurrenceRule(reminder);
  if (rule) params.set("recur", rule.replace(/^RRULE:/, "RRULE:"));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
