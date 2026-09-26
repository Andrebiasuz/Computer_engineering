"use strict";

/*
 * Data model
 *
 *   categories: [{ id, name, slot }]          slot = fixed color slot 0..7 (8+ = "other" gray)
 *   resources:  { id: { id, title, type, platform, categoryId, url, estHours, lengthHours, pages, priority,
 *                        status, plannedStart, plannedEnd, notes, createdAt, doneAt, order } }
 *   logs:       { id: { id, resourceId, date, minutes, note, focus } }
 *   settings:   { dailyGoal, theme }
 *
 * Persistence: always cached in localStorage. When the page is served by
 * server.py, the JSON file on the server is the source of truth.
 */

const STORAGE_KEY = "study-tracker-state-v1";
const STATUSES = [
  { id: "backlog", label: "Backlog" },
  { id: "active", label: "In progress" },
  { id: "paused", label: "Paused" },
  { id: "done", label: "Done" },
];
const RESOURCE_TYPES = ["Course", "Book", "Video", "Article", "Documentation", "Project", "Exercise", "Certification", "Other"];
const CATEGORY_SLOTS = 8;

function defaultState() {
  return {
    version: 1,
    settings: { dailyGoal: 60, theme: "auto" },
    categories: [],
    resources: {},
    logs: {},
  };
}

function normalizeState(s) {
  const base = defaultState();
  if (!s || typeof s !== "object") return base;
  return {
    version: 1,
    settings: Object.assign(base.settings, s.settings || {}),
    categories: Array.isArray(s.categories) ? s.categories : [],
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
      priority: 2,
      status: "backlog",
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
    if (r && r.status === "backlog") r.status = "active";
    return log;
  },
};
