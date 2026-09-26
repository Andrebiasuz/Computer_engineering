"use strict";

/*
 * Data model
 *
 *   categories: [{ id, name, slot }]          slot = fixed color slot 0..7 (8+ = "other" gray)
 *   resources:  { id: { id, title, type, platform, categoryId, url, estHours, lengthHours, pages, priority,
 *                        status, plannedStart, plannedEnd, notes, createdAt, doneAt, order } }
 *   logs:       { id: { id, resourceId, date, minutes, note, focus } }
 *   columns:    [{ id, label, kind, color }]  board columns, in order. kind drives behaviour:
 *               todo (not started) | doing (in progress) | hold (paused) | done (finished)
 *   priorities: [{ id, label, color }]        highest first; resource.priority holds an id
 *   settings:   { dailyGoal, theme, uiVersion }
 *
 * Persistence: always cached in localStorage. When the page is served by
 * server.py, the JSON file on the server is the source of truth.
 */

const STORAGE_KEY = "study-tracker-state-v1";
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
const RESOURCE_TYPES = ["Course", "Book", "Video", "Article", "Documentation", "Project", "Exercise", "Certification", "Other"];
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
  };
}

function normalizeState(s) {
  const base = defaultState();
  if (!s || typeof s !== "object") return base;
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

  commit(mutator) {
    mutator(this.state);
    this.save();
    this.listeners.forEach((fn) => fn());
  },

  replaceAll(newState) {
    this.state = normalizeState(newState);
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
  setStatus(r, statusId) {
    const wasDone = this.isDone(r);
    r.status = statusId;
    const isDone = this.isDone(r);
    if (isDone && !wasDone) r.doneAt = todayISO();
    if (!isDone) r.doneAt = "";
  },

  /* ---------- resources ---------- */

  resourceList() {
    return Object.values(this.state.resources).sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  newResource(fields) {
    const maxOrder = Math.max(0, ...Object.values(this.state.resources).map((r) => r.order || 0));
    return Object.assign({
      id: uid(),
      title: "Untitled",
      type: "Course",
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

  minutesByDate() {
    const map = {};
    for (const l of this.logList()) map[l.date] = (map[l.date] || 0) + (l.minutes || 0);
    return map;
  },

  // Adding a log to a backlog item implicitly starts it.
  addLog(state, fields) {
    const log = Object.assign({ id: uid(), minutes: 30, note: "", focus: null, createdAt: new Date().toISOString() }, fields);
    state.logs[log.id] = log;
    const r = state.resources[log.resourceId];
    if (r && this.kindOf(r.status) === "todo") {
      const doing = this.firstColumnOfKind("doing");
      if (doing) r.status = doing;
    }
    return log;
  },
};
