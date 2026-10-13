/** CRM vocabularies (mirror the backend enums — API.md › B3). Full Tailwind class names on purpose. */

export const LEAD_TYPES = ["buyer", "landowner"];
export const LEAD_SOURCES = ["website", "facebook", "instagram", "manual", "walk_in", "phone", "referral", "other"];
export const MANUAL_SOURCES = LEAD_SOURCES.filter((s) => s !== "website");
export const LOST_REASONS = ["price", "location", "not_interested", "unreachable", "bought_elsewhere", "budget", "timing", "invalid", "other"];
export const LAND_OWNERSHIP = ["sole", "joint", "inherited", "company", "other"];
export const MUTATION_STATUS = ["done", "pending", "not_started", "unknown"];
export const USER_ACTIVITY_TYPES = ["note", "call", "whatsapp", "sms", "email", "meeting", "site_visit"];
export const CALL_OUTCOMES = ["connected", "no_answer", "busy", "switched_off", "wrong_number", "call_back"];
export const TASK_TYPES = ["call", "visit", "meeting", "follow_up", "other"];
export const REMIND_OPTIONS = [0, 15, 30, 60, 120, 1440];
export const STAGE_KINDS = ["open", "won", "lost"];
export const STAGE_COLORS = ["neutral", "sage", "olive", "sand", "clay", "sky", "success", "danger"];

/** Stage colour → small swatch / column rule. Earthy, token-adjacent tints. */
export const STAGE_SWATCH = {
  neutral: "bg-ink-subtle",
  sage: "bg-accent",
  olive: "bg-primary",
  sand: "bg-warning",
  clay: "bg-status-sold",
  sky: "bg-info",
  success: "bg-success",
  danger: "bg-danger",
};

export const stageName = (stage, locale) => (stage ? (locale === "bn" && stage.nameBn) || stage.name : "");

/** Saved views (owner decision 2026-10-13): fixed presets + filters in the URL, no backend. */
export const PRESET_VIEWS = [
  { key: "all", filters: {} },
  { key: "mine", filters: { assignee: "me" } },
  { key: "unassigned", filters: { assignee: "unassigned" }, needs: "leads:read_all" },
  { key: "slaMissed", filters: { slaBreached: "true", status: "open" } },
  { key: "today", filters: { followUp: "today" } },
  { key: "overdue", filters: { followUp: "overdue" } },
];

/** URL filter keys shared by the leads table and the pipeline board. */
export const FILTER_KEYS = ["view", "type", "stageId", "status", "source", "assignee", "projectId", "tag", "q", "followUp", "slaBreached"];

export function readFilters(searchParams) {
  const out = {};
  for (const k of FILTER_KEYS) {
    const v = searchParams.get(k);
    if (v) out[k] = v;
  }
  return out;
}

/** Filters for the API (the preset view expands into its filters; explicit filters win). */
export function apiFilters(filters) {
  const preset = PRESET_VIEWS.find((v) => v.key === filters.view)?.filters ?? {};
  const { view: _view, ...rest } = filters;
  return { ...preset, ...rest };
}

export const whatsappLink = (e164) => (e164 ? `https://wa.me/${e164.replace(/^\+/, "")}` : null);
export const telLink = (e164) => (e164 ? `tel:${e164}` : null);

/**
 * First-response clock for an open lead: { state: 'ok'|'soon'|'late'|'done'|null, minutes }.
 * soon = ≤ 10 minutes left. Pure — pass `now` from a ticking hook.
 */
export function slaState(lead, now = Date.now()) {
  if (!lead?.slaDueAt || lead.status !== "open") return { state: null };
  if (lead.firstResponseAt) return { state: "done" };
  const left = Math.round((new Date(lead.slaDueAt).getTime() - now) / 60_000);
  if (left < 0) return { state: "late", minutes: -left };
  return { state: left <= 10 ? "soon" : "ok", minutes: left };
}

/** "2 h 05 m" style duration from minutes. */
export function minutesLabel(min, t, num = String) {
  if (min < 60) return t("minutes", { n: num(min) });
  if (min < 60 * 48) return t("hoursMinutes", { h: num(Math.floor(min / 60)), m: num(min % 60).padStart(2, num(0)) });
  return t("days", { n: num(Math.floor(min / 1440)) });
}

/** Date → value for <input type="datetime-local"> in Asia/Dhaka (UTC+6, no DST). */
export function toDhakaInput(date) {
  const d = new Date(new Date(date).getTime() + 6 * 3_600_000);
  return d.toISOString().slice(0, 16);
}
/** <input type="datetime-local"> value (Dhaka wall time) → ISO string. */
export function fromDhakaInput(value) {
  if (!value) return null;
  const d = new Date(`${value}:00+06:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
