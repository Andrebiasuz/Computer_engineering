"use strict";

/*
 * Data model
 *
 *   categories: [{ id, name, slot }]          slot = fixed color slot 0..7 (8+ = "other" gray)
 *   resources:  { id: { id, title, type, platform (shown as "Project"), categoryId, url, estHours, lengthHours, pages, priority,
 *                        extraSessions (sessions counted without time; hours are always real logs),
 *                        status, plannedStart, plannedEnd, notes, createdAt, doneAt, order,
 *                        statusNote, statusUpdatedAt (free-text "where this stands", shown on the card),
 *                        archived, archivedAt (archived tasks leave the board; they live on the Archive page),
 *                        history: [{ at, date, kind: "move", from, to } | { at, date, kind: "status", text }
 *                                  | { at, date, kind: "sessions", count, text } | { at, date, kind: "archive" | "restore" }] } }
 *   logs:       { id: { id, resourceId, date, minutes, note, focus } }
 *   deliverables: { id: { id, project (lower-case project key), name, estHours, dueDate, issuedAt, createdAt } }
 *               a deliverable groups several cards (resource.deliverableId) of one project
 *   columns:    [{ id, label, kind, color }]  board columns, in order. kind drives behaviour:
 *               todo (not started) | doing (in progress) | hold (paused) | done (finished)
 *   priorities: [{ id, label, color }]        highest first; resource.priority holds an id
 *   settings:   { dailyGoal, theme, uiVersion }
 *   meta:       { updatedAt }  ISO time of the last change
 *
 * Persistence: always cached in localStorage. When the page is served by
 * server.py, the JSON file on the server is the source of truth.
 */

const STORAGE_KEY = "work-tracker-state-v1";
const COLUMN_KINDS = [
  { id: "todo", label: "To do", hint: "not started; logging a session moves it to the first In-progress column" },
  { id: "doing", label: "In progress", hint: "shown in the timer" },
  { id: "hold", label: "On hold", hint: "shown in the timer" },
  { id: "done", label: "Finished", hint: "counts as finished in Gantt and Stats" },
];
// Text colors a column / priority can use (see --tok-* in style.css).
const TOKEN_COLORS = ["comment", "fn", "type", "str", "keyword", "const", "num", "err"];
const DEFAULT_COLUMNS = [
  { id: "backlog", label: "Backlog", kind: "todo", color: "comment" },
  { id: "active", label: "In progress", kind: "doing", color: "fn" },
  { id: "paused", label: "Paused", kind: "hold", color: "type" },
  { id: "done", label: "Done", kind: "done", color: "str" },
];
const DEFAULT_PRIORITIES = [
  { id: 1, label: "high", color: "err" },
  { id: 2, label: "med", color: "num" },
  { id: 3, label: "low", color: "comment" },
];
const RESOURCE_TYPES = ["Task", "Feature", "Bug", "Project", "Meeting", "Review", "Documentation", "Research", "Support", "Admin", "Other"];
const CATEGORY_SLOTS = 8;

function defaultState() {
  return {
    version: 1,
    settings: { dailyGoal: 60, theme: "dark", uiVersion: 2 },
    categories: [],
    columns: DEFAULT_COLUMNS.map((c) => Object.assign({}, c)),
    priorities: DEFAULT_PRIORITIES.map((p) => Object.assign({}, p)),
    resources: {},
    logs: {},
    deliverables: {},
  };
}

// A short-lived version stored hand-entered hours as resource.extraMinutes,
// which kept them out of the daily log, Gantt and daily stats. Turn them into
// real sessions dated today (the only day that version was live).
function migrateManualMinutes(s) {
  if (!s || !s.resources) return;
  s.logs = s.logs || {};
  for (const r of Object.values(s.resources)) {
    if (r.extraMinutes > 0) {
      const n = Math.max(1, Math.min(r.extraSessions || 1, r.extraMinutes));
      splitMinutes(r.extraMinutes, n).forEach((m) => {
        const id = uid();
        s.logs[id] = { id, resourceId: r.id, date: todayISO(), minutes: m, note: "Added in resource editor", focus: null, createdAt: new Date().toISOString() };
      });
      r.extraSessions = Math.max(0, (r.extraSessions || 0) - n);
    }
    delete r.extraMinutes;
  }
}

// Splits a total into n near-equal whole-minute parts.
function splitMinutes(total, n) {
  const base = Math.floor(total / n), rest = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}

function normalizeState(s) {
  const base = defaultState();
  if (!s || typeof s !== "object") return base;
  migrateManualMinutes(s);
  // v2 made the IDE-style dark theme the default; move older saves onto it once.
  if (s.settings && !(s.settings.uiVersion >= 2)) {
    s.settings.theme = "dark";
    s.settings.uiVersion = 2;
  }
  return {
    version: 1,
    settings: Object.assign(base.settings, s.settings || {}),
    categories: Array.isArray(s.categories) ? s.categories : [],
    columns: Array.isArray(s.columns) && s.columns.length ? s.columns : base.columns,
    priorities: Array.isArray(s.priorities) && s.priorities.length ? s.priorities : base.priorities,
    resources: s.resources && typeof s.resources === "object" ? s.resources : {},
    logs: s.logs && typeof s.logs === "object" ? s.logs : {},
    deliverables: s.deliverables && typeof s.deliverables === "object" ? s.deliverables : {},
    meta: s.meta && typeof s.meta === "object" ? s.meta : { updatedAt: "" },
  };
}

const Store = {
  state: defaultState(),
  mode: "local", // "local" | "server"
  listeners: [],
  saveTimer: null,
  serverError: false,

  async load() {
    let local = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) local = JSON.parse(raw);
    } catch (e) {
      console.warn("Could not read localStorage", e);
    }

    if (location.protocol.startsWith("http")) {
      try {
        const res = await fetch("api/state", { cache: "no-store" });
        if (res.ok) {
          this.mode = "server";
          this.state = normalizeState(await res.json());
          this.cacheLocally();
          return;
        }
        if (res.status === 404 && (res.headers.get("Content-Type") || "").includes("json")) {
          // Server is running but has no data yet: seed it from this browser.
          this.mode = "server";
          this.state = normalizeState(local);
          this.save(true);
          return;
        }
      } catch (e) {
        // No server (e.g. plain static hosting) - fall through to local mode.
      }
    }
    this.mode = "local";
    this.state = normalizeState(local);
  },

  cacheLocally() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("Could not write localStorage", e);
    }
  },

  save(immediate) {
    this.cacheLocally();
    if (this.mode !== "server") return;
    clearTimeout(this.saveTimer);
    const push = async () => {
      try {
        const res = await fetch("api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.state),
        });
        this.serverError = !res.ok;
      } catch (e) {
        this.serverError = true;
      }
      App.renderSyncStatus();
    };
    if (immediate) push();
    else this.saveTimer = setTimeout(push, 400);
  },

  subscribe(fn) { this.listeners.push(fn); },

  touch() { this.state.meta = { updatedAt: new Date().toISOString() }; },

  commit(mutator) {
    mutator(this.state);
    this.touch();
    this.save();
    this.listeners.forEach((fn) => fn());
  },

  replaceAll(newState) {
    this.state = normalizeState(newState);
    this.touch();
    this.save(true);
    this.listeners.forEach((fn) => fn());
  },

  /* ---------- categories ---------- */

  category(id) {
    return this.state.categories.find((c) => c.id === id) || null;
  },

  categoryColor(id) {
    const c = this.category(id);
    if (!c || c.slot >= CATEGORY_SLOTS) return "var(--cat-other)";
    return "var(--cat-" + c.slot + ")";
  },

  nextSlot() {
    const used = new Set(this.state.categories.map((c) => c.slot));
    for (let i = 0; i < CATEGORY_SLOTS; i++) if (!used.has(i)) return i;
    return CATEGORY_SLOTS; // folds into "other"
  },

  // Must be called inside commit() when it may create a category.
  findOrCreateCategory(state, name) {
    name = (name || "").trim();
    if (!name) return null;
    const hit = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit.id;
    const cat = { id: uid(), name, slot: this.nextSlot() };
    state.categories.push(cat);
    return cat.id;
  },

  /* ---------- columns (statuses) ---------- */

  columns() { return this.state.columns; },

  // Unknown status ids (e.g. from a deleted column) fall back to the first column.
  column(id) { return this.state.columns.find((c) => c.id === id) || this.state.columns[0]; },

  kindOf(statusId) { return this.column(statusId).kind; },

  isDone(r) { return this.kindOf(r.status) === "done"; },

  // Moving a card into a Paused (on hold) or Done (finished) column asks for the work done.
  asksForWork(statusId) { const k = this.kindOf(statusId); return k === "hold" || k === "done"; },

  firstColumnOfKind(kind) { const c = this.state.columns.find((x) => x.kind === kind); return c ? c.id : null; },

  /* ---------- priorities ---------- */

  priorities() { return this.state.priorities; },

  priority(id) {
    const ps = this.state.priorities;
    return ps.find((p) => p.id === Number(id)) || ps[Math.floor((ps.length - 1) / 2)];
  },

  // 0 = most important. Used for sorting.
  priorityRank(id) { return this.state.priorities.indexOf(this.priority(id)); },

  defaultPriority() { const ps = this.state.priorities; return ps[Math.floor((ps.length - 1) / 2)].id; },

  // Moves a resource to another column, stamping/clearing the finish date.
  // Column changes are kept in the task's history unless record === false.
  setStatus(r, statusId, record) {
    const wasDone = this.isDone(r);
    const from = this.column(r.status), to = this.column(statusId);
    if (record !== false && from.id !== to.id) this.addHistory(r, { kind: "move", from: from.label, to: to.label });
    r.status = statusId;
    const isDone = this.isDone(r);
    if (isDone && !wasDone) r.doneAt = todayISO();
    if (!isDone) r.doneAt = "";
  },

  addHistory(r, entry) {
    if (!Array.isArray(r.history)) r.history = [];
    r.history.push(Object.assign({ at: new Date().toISOString(), date: todayISO() }, entry));
  },

  // Free-text status shown on the card. Each change is kept in the history.
  setStatusNote(r, text) {
    text = String(text || "").trim();
    if (text === (r.statusNote || "")) return;
    r.statusNote = text;
    r.statusUpdatedAt = todayISO();
    this.addHistory(r, { kind: "status", text });
  },

  // Logs time reported for a task as `sessions` sessions on `date`.
  // Time with no session count is one session. Sessions with no time (0h) are
  // counted without adding logged hours, and noted in the task's history.
  // keepStatus stops a To-do task from being moved to In progress.
  logWork(state, resourceId, minutes, sessions, date, note, keepStatus) {
    sessions = Math.max(0, Math.round(sessions) || 0);
    if (minutes > 0) {
      const n = Math.max(1, Math.min(sessions || 1, minutes));
      splitMinutes(minutes, n).forEach((m) => this.addLog(state, { resourceId, date, minutes: m, note: note || "" }, keepStatus));
      return;
    }
    const r = state.resources[resourceId];
    if (!sessions || !r) return;
    r.extraSessions = Math.max(0, r.extraSessions || 0) + sessions;
    this.addHistory(r, { kind: "sessions", count: sessions, text: note || "", date });
  },

  archive(r) {
    if (r.archived) return;
    r.archived = true;
    r.archivedAt = todayISO();
    this.addHistory(r, { kind: "archive" });
  },

  restore(r) {
    if (!r.archived) return;
    r.archived = false;
    r.archivedAt = "";
    this.addHistory(r, { kind: "restore" });
  },

  /* ---------- projects (stored in resource.platform, shown as "Project") ---------- */

  projectName(r) { return ((r && r.platform) || "").trim(); },

  // Projects grouped case-insensitively; label is the first spelling seen (A→Z order).
  projects() {
    const seen = new Map();
    for (const r of Object.values(this.state.resources)) {
      const n = this.projectName(r);
      if (n && !seen.has(n.toLowerCase())) seen.set(n.toLowerCase(), n);
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" })).map(([key, label]) => ({ key, label }));
  },

  projectKey(r) { return this.projectName(r).toLowerCase(); },

  projectLabel(key) {
    if (!key) return "No project";
    const p = this.projects().find((x) => x.key === key);
    return p ? p.label : key;
  },

  projectColor(key) {
    if (!key) return "var(--cat-other)";
    const i = this.projects().findIndex((x) => x.key === key);
    return i < 0 ? "var(--cat-other)" : "var(--cat-" + (i % CATEGORY_SLOTS) + ")";
  },

  /* ---------- deliverables (several cards of one project) ---------- */

  deliverable(id) { return (id && this.state.deliverables[id]) || null; },

  deliverableList(projectKey) {
    return Object.values(this.state.deliverables)
      .filter((d) => projectKey == null || d.project === projectKey)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  },

  cardsOf(deliverableId) {
    return Object.values(this.state.resources).filter((r) => r.deliverableId === deliverableId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  // Must be called inside commit(). Same name (any case) in the same project = same deliverable.
  findOrCreateDeliverable(state, projectKey, name) {
    name = (name || "").trim();
    if (!name) return null;
    const hit = Object.values(state.deliverables).find((d) => d.project === projectKey && d.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit.id;
    const d = { id: uid(), project: projectKey, name, estHours: null, dueDate: "", issuedAt: "", createdAt: todayISO() };
    state.deliverables[d.id] = d;
    return d.id;
  },

  // Rolled-up view of a deliverable. Estimate and due date fall back to its cards;
  // it counts as issued when marked, or when every card is done.
  deliverableSummary(d) {
    const cards = this.cardsOf(d.id);
    const logs = cards.flatMap((r) => this.logsFor(r.id)).sort((a, b) => a.date.localeCompare(b.date));
    const cardEst = cards.reduce((s, r) => s + (Number(r.estHours) || 0), 0);
    const doneCards = cards.filter((r) => this.isDone(r));
    const allDone = cards.length > 0 && doneCards.length === cards.length;
    const latest = (key) => cards.map((r) => r[key]).filter(Boolean).sort().pop() || "";
    const earliest = (key) => cards.map((r) => r[key]).filter(Boolean).sort()[0] || "";
    const noted = cards.filter((r) => r.statusNote).sort((a, b) => (b.statusUpdatedAt || "").localeCompare(a.statusUpdatedAt || ""))[0];
    return {
      d, cards, logs,
      minutes: logs.reduce((s, l) => s + l.minutes, 0),
      sessions: cards.reduce((s, r) => s + this.sessionsFor(r.id), 0),
      estHours: d.estHours != null && d.estHours !== "" ? Number(d.estHours) : (cardEst || null),
      dueDate: d.dueDate || latest("plannedEnd"),
      startDate: earliest("plannedStart"),
      issued: !!d.issuedAt || allDone,
      issuedAt: d.issuedAt || (allDone ? latest("doneAt") : ""),
      doneCards: doneCards.length,
      statusNote: noted ? noted.statusNote : "",
      statusUpdatedAt: noted ? noted.statusUpdatedAt : "",
      onHold: cards.filter((r) => !this.isDone(r) && this.kindOf(r.status) === "hold"),
      archived: cards.length > 0 && cards.every((r) => r.archived),
    };
  },

  /* ---------- resources ---------- */

  // Tasks on the board. Pass true to include archived ones (Stats counts all work).
  resourceList(includeArchived) {
    return Object.values(this.state.resources).filter((r) => includeArchived || !r.archived)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  archivedList() {
    return Object.values(this.state.resources).filter((r) => r.archived)
      .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || "") || (b.doneAt || "").localeCompare(a.doneAt || ""));
  },

  newResource(fields) {
    const maxOrder = Math.max(0, ...Object.values(this.state.resources).map((r) => r.order || 0));
    return Object.assign({
      id: uid(),
      title: "Untitled",
      type: "Task",
      platform: "",
      categoryId: null,
      url: "",
      estHours: null,
      lengthHours: null,
      pages: null,
      priority: this.defaultPriority(),
      status: this.firstColumnOfKind("todo") || this.state.columns[0].id,
      plannedStart: "",
      plannedEnd: "",
      notes: "",
      statusNote: "",
      statusUpdatedAt: "",
      history: [],
      createdAt: todayISO(),
      doneAt: "",
      order: maxOrder + 1,
    }, fields);
  },

  /* ---------- logs ---------- */

  logList() { return Object.values(this.state.logs); },

  logsFor(resourceId) {
    return this.logList().filter((l) => l.resourceId === resourceId)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  minutesFor(resourceId) {
    return this.logsFor(resourceId).reduce((s, l) => s + (l.minutes || 0), 0);
  },

  sessionsFor(resourceId) {
    const r = this.state.resources[resourceId];
    return Math.max(0, this.logsFor(resourceId).length + ((r && r.extraSessions) || 0));
  },


  minutesByDate() {
    const map = {};
    for (const l of this.logList()) map[l.date] = (map[l.date] || 0) + (l.minutes || 0);
    return map;
  },

  // Adding a log to a backlog item implicitly starts it.
  addLog(state, fields, keepStatus) {
    const log = Object.assign({ id: uid(), minutes: 30, note: "", focus: null, createdAt: new Date().toISOString() }, fields);
    state.logs[log.id] = log;
    const r = state.resources[log.resourceId];
    if (r && !keepStatus && this.kindOf(r.status) === "todo") {
      const doing = this.firstColumnOfKind("doing");
      if (doing) this.setStatus(r, doing);
    }
    return log;
  },
};
