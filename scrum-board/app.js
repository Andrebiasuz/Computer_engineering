"use strict";

/* =========================================================
   Project Board — sticky notes on a corkboard.
   All data lives in localStorage; no network requests.
   ========================================================= */

const STORAGE_KEY = "scrum-board-v1";
const COLORS = ["yellow", "pink", "blue", "green", "orange", "purple"];
const PIN_COLORS = ["#e03131", "#1c7ed6", "#2f9e44", "#f08c00", "#ae3ec9", "#495057"];
const AVATAR_COLORS = ["#e8590c", "#1971c2", "#2b8a3e", "#c2255c", "#6741d9", "#0c8599", "#5c940d", "#862e9c"];

const $ = (sel, root = document) => root.querySelector(sel);

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function randTilt() {
  return +(Math.random() * 5 - 2.5).toFixed(2);
}
function hash(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/* ---------------- state ---------------- */

function makeNote(title, opts = {}) {
  return {
    id: uid(),
    title,
    body: opts.body || "",
    owner: opts.owner || "",
    project: opts.project || "",
    points: opts.points || "",
    color: opts.color || "yellow",
    tilt: randTilt(),
    pin: PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)],
  };
}

function sampleState() {
  const cols = [
    { id: uid(), title: "Backlog", wip: 0 },
    { id: uid(), title: "Next", wip: 6 },
    { id: uid(), title: "Doing", wip: 3 },
    { id: uid(), title: "Waiting", wip: 0 },
    { id: uid(), title: "Done", wip: 0 },
  ];
  const n = (t, o) => makeNote(t, o);
  const notes = [
    [n("Dark mode toggle", { project: "Website", body: "Respect system setting by default", points: "3", color: "yellow" }),
     n("Export to CSV", { project: "Reports", points: "5", color: "blue" })],
    [n("Login rate limiting", { project: "Website", body: "5 attempts / minute per IP", owner: "Ana", points: "3", color: "yellow" }),
     n("Write onboarding docs", { project: "Mobile app", owner: "Leo", points: "2", color: "pink" })],
    [n("Search API", { project: "Website", body: "Full-text over titles + descriptions", owner: "Sam", points: "8", color: "yellow" }),
     n("Fix flaky CI test", { project: "Mobile app", owner: "Ana", points: "1", color: "pink" })],
    [n("Monthly sales chart", { project: "Reports", owner: "Leo", points: "3", color: "blue" })],
    [n("Set up repo + CI", { project: "Mobile app", owner: "Sam", points: "2", color: "pink" }),
     n("Pick a name for the project", { project: "Website", body: "✨ decided!", points: "1", color: "yellow" })],
  ];
  const state = { title: "My Projects", focus: "Website search + catch up on Reports", columns: cols, notes: {}, order: {}, archive: [] };
  cols.forEach((c, i) => {
    state.order[c.id] = notes[i].map((note) => note.id);
    notes[i].forEach((note) => (state.notes[note.id] = note));
  });
  notes[notes.length - 1].forEach((note) => (note.doneAt = Date.now()));
  return state;
}

function emptyState() {
  const cols = ["Backlog", "Next", "Doing", "Waiting", "Done"].map((t) => ({ id: uid(), title: t, wip: t === "Doing" ? 3 : 0 }));
  const order = {};
  cols.forEach((c) => (order[c.id] = []));
  return { title: "My Projects", focus: "", columns: cols, notes: {}, order, archive: [] };
}

function isValidState(s) {
  return s && typeof s === "object" && Array.isArray(s.columns) &&
    s.notes && typeof s.notes === "object" && s.order && typeof s.order === "object";
}

function normalize(s) {
  // older boards used "sprint" + "goal"; the untouched default sprint name becomes a board title
  if (s.title == null) s.title = s.sprint == null || s.sprint === "Sprint 1" ? "My Projects" : s.sprint;
  if (s.focus == null) s.focus = s.goal ?? "";
  delete s.sprint;
  delete s.goal;
  s.title = String(s.title);
  s.focus = String(s.focus);
  s.archive = Array.isArray(s.archive) ? s.archive.filter((a) => a && a.id && a.title != null) : [];
  s.columns = s.columns.filter((c) => c && c.id).map((c) => ({ id: String(c.id), title: String(c.title ?? ""), wip: Math.max(0, parseInt(c.wip, 10) || 0) }));
  const seen = new Set();
  for (const c of s.columns) {
    const ids = Array.isArray(s.order[c.id]) ? s.order[c.id] : [];
    s.order[c.id] = ids.filter((id) => s.notes[id] && !seen.has(id) && seen.add(id));
  }
  // orphan notes (not in any column) go to the first column
  for (const id of Object.keys(s.notes)) {
    if (!seen.has(id)) {
      if (s.columns.length) s.order[s.columns[0].id].push(id);
      else delete s.notes[id];
    }
  }
  for (const note of Object.values(s.notes)) {
    if (!COLORS.includes(note.color)) note.color = "yellow";
    if (typeof note.tilt !== "number") note.tilt = randTilt();
    if (!note.pin) note.pin = PIN_COLORS[0];
    note.project = String(note.project ?? "").trim();
  }
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (isValidState(s)) return normalize(s);
    }
  } catch (_) { /* storage blocked or corrupt — fall through */ }
  return sampleState();
}

let state = load();

/* ---------------- done dates + weeks ---------------- */

// the last column is the Done column
function doneColumn() {
  return state.columns[state.columns.length - 1];
}
// stamp notes when they reach Done, clear the stamp when they leave it
function syncDoneDates() {
  const done = doneColumn();
  const inDone = new Set(done ? state.order[done.id] : []);
  for (const n of Object.values(state.notes)) {
    if (inDone.has(n.id)) { if (!n.doneAt) n.doneAt = Date.now(); }
    else delete n.doneAt;
  }
}
// Monday 00:00 of the week containing t
function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}
function fmtDay(t) {
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function save() {
  syncDoneDates();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

function findColumnOf(noteId) {
  return state.columns.find((c) => state.order[c.id].includes(noteId));
}

/* ---------------- rendering ---------------- */

const board = $("#board");
let filterText = "";
const NO_PROJECT = "\u0000none";
const PROJECT_FILTER_KEY = "scrum-board-project-filter";
let projectFilter = "";
const LANES_KEY = "scrum-board-lanes";
const COLLAPSED_KEY = "scrum-board-collapsed-lanes";
let lanesOn = false;
let collapsedLanes = new Set();
try {
  lanesOn = localStorage.getItem(LANES_KEY) === "1";
  collapsedLanes = new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]"));
} catch (_) { /* ignore */ }
try { projectFilter = localStorage.getItem(PROJECT_FILTER_KEY) || ""; } catch (_) { /* ignore */ }

// every project name in use, case-insensitively de-duplicated, A→Z
function projectNames() {
  const byKey = new Map();
  for (const n of Object.values(state.notes)) {
    if (n.project && !byKey.has(n.project.toLowerCase())) byKey.set(n.project.toLowerCase(), n.project);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
function inProjectFilter(note) {
  if (!projectFilter) return true;
  if (projectFilter === NO_PROJECT) return !note.project;
  return note.project.toLowerCase() === projectFilter.toLowerCase();
}
function isVisible(note) {
  return inProjectFilter(note) && (!filterText || matches(note));
}
function setProjectFilter(value) {
  projectFilter = value;
  try { localStorage.setItem(PROJECT_FILTER_KEY, value); } catch (_) { /* ignore */ }
  render();
}
let freshId = null;

function avatarFor(name) {
  const el = document.createElement("span");
  el.className = "avatar";
  const parts = name.trim().split(/\s+/);
  el.textContent = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
  el.style.background = AVATAR_COLORS[hash(name.toLowerCase()) % AVATAR_COLORS.length];
  return el;
}

function renderNote(note) {
  const el = document.createElement("article");
  el.className = "note";
  el.tabIndex = 0;
  el.dataset.id = note.id;
  el.dataset.color = note.color;
  el.style.setProperty("--tilt", note.tilt + "deg");
  el.style.setProperty("--pin", note.pin);
  el.setAttribute("aria-label", note.title);

  if (note.project) {
    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "note-project";
    tag.textContent = note.project;
    tag.title = `Show only ${note.project}`;
    tag.addEventListener("click", (e) => { e.stopPropagation(); setProjectFilter(note.project); });
    el.append(tag);
  }

  const title = document.createElement("h3");
  title.className = "note-title";
  title.textContent = note.title;
  el.append(title);

  if (note.body) {
    const body = document.createElement("p");
    body.className = "note-body";
    body.textContent = note.body;
    el.append(body);
  }

  if (note.owner || note.points) {
    const foot = document.createElement("div");
    foot.className = "note-foot";
    const owner = document.createElement("span");
    owner.className = "owner";
    if (note.owner) {
      const name = document.createElement("span");
      name.className = "owner-name";
      name.textContent = note.owner;
      owner.append(avatarFor(note.owner), name);
    }
    foot.append(owner);
    if (note.points) {
      const pts = document.createElement("span");
      pts.className = "points";
      pts.title = note.points + " story points";
      pts.textContent = note.points;
      foot.append(pts);
    }
    el.append(foot);
  }

  if (note.id === freshId) el.classList.add("fresh");
  if (!isVisible(note)) el.classList.add("is-hidden");
  return el;
}

function matches(note) {
  const q = filterText;
  return [note.title, note.body, note.owner, note.project].some((v) => v && v.toLowerCase().includes(q));
}

function pointsOf(ids) {
  return ids.reduce((sum, id) => sum + (parseInt(state.notes[id]?.points, 10) || 0), 0);
}

// a filter for a project that no longer exists falls back to "all"
function dropStaleProjectFilter() {
  if (!projectFilter) return;
  const stale = projectFilter === NO_PROJECT
    ? Object.values(state.notes).every((n) => n.project)
    : !projectNames().some((p) => p.toLowerCase() === projectFilter.toLowerCase());
  if (stale) {
    projectFilter = "";
    try { localStorage.setItem(PROJECT_FILTER_KEY, ""); } catch (_) { /* ignore */ }
  }
}

function render() {
  dropStaleProjectFilter();
  board.textContent = "";
  board.classList.toggle("lanes", lanesOn);
  $("#lanes-toggle").setAttribute("aria-pressed", String(lanesOn));
  if (lanesOn) renderLanes();
  else renderColumns();
  freshId = null;
  renderProjectFilter();
  renderHeader();
}

// the paper label taped to the top of a column (counts always cover every project)
function buildColLabel(col, i) {
  const ids = state.order[col.id];
  const label = document.createElement("header");
  label.className = "col-label";
  label.style.setProperty("--label-tilt", (i % 2 ? 1.2 : -1.5) + "deg");
  const t = document.createElement("span");
  t.className = "col-title";
  t.textContent = col.title;
  const meta = document.createElement("span");
  meta.className = "col-meta";
  const pts = pointsOf(ids);
  const word = (col.wip ? col.wip : ids.length) === 1 ? "note" : "notes";
  meta.textContent = `${ids.length}${col.wip ? " / " + col.wip : ""} ${word}${pts ? " · " + pts + " pts" : ""}`;
  label.append(t, meta);

  const menu = document.createElement("button");
  menu.className = "col-menu";
  menu.type = "button";
  menu.title = "Column settings";
  menu.setAttribute("aria-label", `Settings for ${col.title}`);
  menu.textContent = "⋯";
  menu.addEventListener("click", () => openColumnEditor(col.id));
  label.append(menu);
  return label;
}

function overWip(col) {
  return col.wip && state.order[col.id].length > col.wip;
}

function renderColumns() {
  state.columns.forEach((col, i) => {
    const ids = state.order[col.id];
    const sec = document.createElement("section");
    sec.className = "column";
    sec.dataset.col = col.id;
    if (overWip(col)) sec.classList.add("over-wip");

    const label = buildColLabel(col, i);

    const list = document.createElement("div");
    list.className = "col-notes drop-zone";
    list.dataset.col = col.id;
    ids.forEach((id) => list.append(renderNote(state.notes[id])));
    if (!ids.length) {
      const hint = document.createElement("p");
      hint.className = "empty-hint";
      hint.textContent = "nothing here yet";
      list.append(hint);
    }

    const add = document.createElement("button");
    add.className = "add-note";
    add.type = "button";
    add.textContent = "+ add note";
    add.addEventListener("click", () => openNoteEditor(null, col.id));

    sec.append(label, list, add);
    board.append(sec);
  });
}

/* ---- swimlanes: one row per project, same columns ---- */

// lane keys: each project name, plus "" for notes without a project
function laneKeys() {
  if (projectFilter === NO_PROJECT) return [""];
  const names = projectNames();
  if (projectFilter) return names.filter((p) => p.toLowerCase() === projectFilter.toLowerCase());
  const keys = [...names];
  if (!names.length || Object.values(state.notes).some((n) => !n.project)) keys.push("");
  return keys;
}
function inLane(note, key) {
  return key === "" ? !note.project : note.project.toLowerCase() === key.toLowerCase();
}
function setCollapsed(key, collapsed) {
  const k = key.toLowerCase();
  if (collapsed) collapsedLanes.add(k); else collapsedLanes.delete(k);
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsedLanes])); } catch (_) { /* ignore */ }
  render();
}

function renderLanes() {
  const cols = state.columns;
  const grid = document.createElement("div");
  grid.className = "lane-grid";
  grid.style.setProperty("--cols", cols.length);

  const corner = document.createElement("div");
  corner.className = "lane-corner";
  grid.append(corner);
  cols.forEach((col, i) => {
    const head = document.createElement("div");
    head.className = "lane-colhead";
    if (overWip(col)) head.classList.add("over-wip");
    head.append(buildColLabel(col, i));
    grid.append(head);
  });

  const doneCol = cols[cols.length - 1];
  for (const key of laneKeys()) {
    const collapsed = collapsedLanes.has(key.toLowerCase());
    const name = key || "No project";
    const laneIds = cols.flatMap((c) => state.order[c.id]).filter((id) => inLane(state.notes[id], key));
    const doneIds = doneCol ? state.order[doneCol.id].filter((id) => inLane(state.notes[id], key)) : [];

    // lane header (sticky on the left)
    const head = document.createElement("div");
    head.className = "lane-head" + (collapsed ? " collapsed" : "");
    const card = document.createElement("div");
    card.className = "lane-card";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "lane-name";
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.title = collapsed ? "Expand lane" : "Collapse lane";
    toggle.textContent = (collapsed ? "▸ " : "▾ ") + name;
    toggle.addEventListener("click", () => setCollapsed(key, !collapsed));
    const meta = document.createElement("span");
    meta.className = "lane-meta";
    const total = pointsOf(laneIds), done = pointsOf(doneIds);
    const notesWord = laneIds.length === 1 ? "note" : "notes";
    meta.textContent = total
      ? `${laneIds.length} ${notesWord} · ${done}/${total} pts`
      : `${laneIds.length} ${notesWord} · ${doneIds.length} done`;
    const bar = document.createElement("div");
    bar.className = "lane-bar";
    const fill = document.createElement("i");
    const pct = total ? done / total : laneIds.length ? doneIds.length / laneIds.length : 0;
    fill.style.width = pct * 100 + "%";
    bar.append(fill);
    const add = document.createElement("button");
    add.type = "button";
    add.className = "lane-add";
    add.textContent = "+ note";
    add.title = `Add a note to ${name}`;
    add.addEventListener("click", () => cols.length && openNoteEditor(null, cols[0].id, key));
    card.append(toggle, meta, bar, add);
    head.append(card);
    grid.append(head);

    // one cell per column
    cols.forEach((col) => {
      const cell = document.createElement("div");
      cell.className = "lane-cell drop-zone" + (collapsed ? " collapsed" : "") + (overWip(col) ? " over-wip" : "");
      cell.dataset.col = col.id;
      cell.dataset.lane = key;
      const ids = state.order[col.id].filter((id) => inLane(state.notes[id], key));
      if (collapsed) {
        if (ids.length) {
          const count = document.createElement("span");
          count.className = "lane-count";
          count.textContent = ids.length;
          count.title = `${ids.length} ${ids.length === 1 ? "note" : "notes"}`;
          cell.append(count);
        }
      } else {
        ids.forEach((id) => cell.append(renderNote(state.notes[id])));
      }
      grid.append(cell);
    });
  }
  board.append(grid);
}

function renderProjectFilter() {
  const sel = $("#project-filter");
  const names = projectNames();
  sel.textContent = "";
  sel.append(new Option("All projects", ""));
  names.forEach((p) => sel.append(new Option(p, p)));
  if (Object.values(state.notes).some((n) => !n.project)) sel.append(new Option("No project", NO_PROJECT));
  const current = names.find((p) => p.toLowerCase() === projectFilter.toLowerCase()) ?? projectFilter;
  sel.value = current;
  sel.classList.toggle("active", !!projectFilter);

  const list = $("#project-list");
  list.textContent = "";
  names.forEach((p) => list.append(new Option(p)));
}

function renderHeader() {
  const titleEl = $("#board-title");
  const focusEl = $("#week-focus");
  if (document.activeElement !== titleEl) titleEl.textContent = state.title;
  if (document.activeElement !== focusEl) focusEl.textContent = state.focus;
  document.title = `${state.title} · Project Board`;

  // "finished this week" vs what's still open, following the project filter
  const thisWeek = weekStart(Date.now());
  const done = doneColumn();
  const doneSet = new Set(done ? state.order[done.id] : []);
  const open = Object.values(state.notes).filter((n) => !doneSet.has(n.id) && inProjectFilter(n)).length;
  const finished = [
    ...Object.values(state.notes).filter((n) => doneSet.has(n.id)),
    ...state.archive,
  ].filter((n) => n.doneAt && n.doneAt >= thisWeek && inProjectFilter(n)).length;
  const pct = finished + open ? (finished / (finished + open)) * 100 : 0;
  let text = `${finished} finished this week · ${open} open`;
  if (projectFilter) text = `${projectFilter === NO_PROJECT ? "No project" : $("#project-filter").selectedOptions[0]?.text || projectFilter}: ${text}`;
  $("#progress-fill").style.width = pct + "%";
  $("#progress-text").textContent = text;
}

/* ---------------- header editing ---------------- */

function bindEditable(el, key, fallback) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { el.textContent = state[key]; el.blur(); }
  });
  el.addEventListener("blur", () => {
    const v = el.textContent.replace(/\s+/g, " ").trim();
    state[key] = v || fallback;
    save();
    renderHeader();
  });
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text");
    document.execCommand("insertText", false, text.replace(/\s+/g, " "));
  });
}
bindEditable($("#board-title"), "title", "My Projects");
bindEditable($("#week-focus"), "focus", "");

/* ---------------- note editor ---------------- */

const noteDialog = $("#note-dialog");
const noteForm = $("#note-form");
let editing = { id: null, col: null, color: "yellow", colorTouched: false };

const colorRow = $("#f-colors");
COLORS.forEach((c) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "swatch";
  b.dataset.color = c;
  b.style.background = `var(--c-${c})`;
  b.setAttribute("aria-label", c);
  b.addEventListener("click", () => { editing.colorTouched = true; setSwatch(c); });
  colorRow.append(b);
});
function setSwatch(c) {
  editing.color = c;
  colorRow.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === c)));
}

/* editor size: remembered per browser */
const SIZE_KEY = "scrum-board-editor-size";
const SIZE_STEP = 80;
function readSize() {
  try { return JSON.parse(localStorage.getItem(SIZE_KEY)) || {}; } catch (_) { return {}; }
}
function writeSize(size) {
  try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch (_) { /* ignore */ }
}
let resizeSaveTimer = null;
function applySize(size) {
  clearTimeout(resizeSaveTimer);
  if (size.w) noteDialog.style.setProperty("--ed-w", size.w + "px");
  if (size.h) noteDialog.style.setProperty("--ed-h", size.h + "px");
  noteDialog.style.width = noteDialog.style.height = ""; // drop any drag-resize so the vars take effect
  noteDialog.classList.toggle("maximized", !!size.max);
  $("#note-max").setAttribute("aria-pressed", String(!!size.max));
}
function currentSize() {
  return { w: Math.round(noteDialog.offsetWidth), h: Math.round(noteDialog.offsetHeight), max: noteDialog.classList.contains("maximized") };
}
document.querySelectorAll(".size-controls [data-size]").forEach((b) =>
  b.addEventListener("click", () => {
    const step = SIZE_STEP * Number(b.dataset.size);
    const s = currentSize();
    const size = {
      w: Math.max(320, Math.min(window.innerWidth - 16, s.w + step)),
      h: Math.max(540, Math.min(window.innerHeight - 16, s.h + step)),
      max: false,
    };
    applySize(size);
    writeSize(size);
  }));
$("#note-max").addEventListener("click", () => {
  const size = { ...readSize(), max: !noteDialog.classList.contains("maximized") };
  applySize(size);
  writeSize(size);
});
// remember a size the user set by dragging the corner
new ResizeObserver(() => {
  clearTimeout(resizeSaveTimer);
  resizeSaveTimer = setTimeout(() => {
    if (!noteDialog.open || noteDialog.classList.contains("maximized")) return;
    const s = currentSize();
    if (s.w && s.h) writeSize(s);
  }, 200);
}).observe(noteDialog);

// the colour most notes of a project already use, so a project keeps one colour
function projectColor(name) {
  const counts = {};
  for (const n of Object.values(state.notes)) {
    if (n.project && n.project.toLowerCase() === name.toLowerCase()) counts[n.color] = (counts[n.color] || 0) + 1;
  }
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
}
// reuse the existing spelling of a project ("website" -> "Website")
function canonicalProject(value) {
  const v = value.replace(/\s+/g, " ").trim();
  return projectNames().find((p) => p.toLowerCase() === v.toLowerCase()) || v;
}
$("#f-project").addEventListener("input", (e) => {
  if (editing.colorTouched) return;
  const c = projectColor(e.target.value.trim());
  if (c) setSwatch(c);
});

function openNoteEditor(id, colId, laneProject) {
  const note = id ? state.notes[id] : null;
  editing = { id, col: note ? findColumnOf(id).id : colId, color: note ? note.color : COLORS[Math.floor(Math.random() * COLORS.length)], colorTouched: !!note };
  // a new note starts in the project you're looking at
  const startProject = note ? note.project
    : laneProject !== undefined ? laneProject
    : (projectFilter && projectFilter !== NO_PROJECT ? $("#project-filter").selectedOptions[0]?.text || "" : "");
  $("#f-project").value = startProject;
  if (!note && startProject) editing.color = projectColor(startProject) || editing.color;
  $("#note-dialog-title").textContent = note ? "Edit note" : "New note";
  $("#f-title").value = note ? note.title : "";
  $("#f-body").value = note ? note.body : "";
  $("#f-owner").value = note ? note.owner : "";
  $("#f-points").value = note ? note.points : "";
  const sel = $("#f-column");
  sel.textContent = "";
  state.columns.forEach((c) => sel.append(new Option(c.title, c.id, false, c.id === editing.col)));
  setSwatch(editing.color);
  $("#note-delete").hidden = !note;
  applySize(readSize());
  noteDialog.showModal();
  $("#f-title").focus();
}

noteForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#f-title").value.trim();
  if (!title) return;
  const fields = {
    title,
    body: $("#f-body").value.trim(),
    owner: $("#f-owner").value.trim(),
    project: canonicalProject($("#f-project").value),
    points: $("#f-points").value,
    color: editing.color,
  };
  const targetCol = $("#f-column").value;
  if (editing.id) {
    Object.assign(state.notes[editing.id], fields);
    const from = findColumnOf(editing.id).id;
    if (from !== targetCol) {
      state.order[from] = state.order[from].filter((x) => x !== editing.id);
      state.order[targetCol].push(editing.id);
    }
  } else {
    const note = makeNote(title, fields);
    state.notes[note.id] = note;
    state.order[targetCol].push(note.id);
    freshId = note.id;
  }
  save();
  noteDialog.close();
  render();
});

$("#note-delete").addEventListener("click", () => {
  const id = editing.id;
  noteDialog.close();
  if (id) deleteNote(id);
});

document.querySelectorAll("dialog [data-close]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close()));

// a click on the dimmed backdrop closes a dialog. The press has to start
// outside the box too, so dragging the resize corner never closes it.
function outsideBox(d, e) {
  const r = d.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}
document.querySelectorAll("dialog").forEach((d) => {
  let downOutside = false;
  d.addEventListener("pointerdown", (e) => { downOutside = e.target === d && outsideBox(d, e); });
  d.addEventListener("click", (e) => {
    if (downOutside && e.target === d && outsideBox(d, e)) d.close();
    downOutside = false;
  });
});

/* ---------------- delete + undo ---------------- */

let undoSnapshot = null;
let toastTimer = null;

function snapshot() { return JSON.parse(JSON.stringify(state)); }

function showToast(text) {
  // an open dialog blocks clicks everywhere else, so show the toast inside it
  const toast = $("#toast");
  const host = document.querySelector("dialog[open]") || document.body;
  if (toast.parentElement !== host) host.append(toast);
  $("#toast-text").textContent = text;
  $("#toast-undo").hidden = !undoSnapshot;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; undoSnapshot = null; }, 6000);
}

$("#toast-undo").addEventListener("click", () => {
  if (undoSnapshot) {
    state = undoSnapshot;
    undoSnapshot = null;
    save();
    render();
    if (historyDialog.open) renderHistory();
  }
  $("#toast").hidden = true;
});

function deleteNote(id) {
  undoSnapshot = snapshot();
  const col = findColumnOf(id);
  if (col) state.order[col.id] = state.order[col.id].filter((x) => x !== id);
  const title = state.notes[id]?.title || "note";
  delete state.notes[id];
  save();
  render();
  showToast(`Removed “${title}”`);
}

/* ---------------- column editor ---------------- */

const colDialog = $("#col-dialog");
let editingCol = null;

function openColumnEditor(colId) {
  editingCol = colId;
  const col = state.columns.find((c) => c.id === colId);
  $("#c-title").value = col.title;
  $("#c-wip").value = col.wip || 0;
  $("#col-delete").hidden = state.columns.length <= 1;
  colDialog.showModal();
  $("#c-title").select();
}

$("#col-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const col = state.columns.find((c) => c.id === editingCol);
  col.title = $("#c-title").value.trim() || col.title;
  col.wip = Math.max(0, parseInt($("#c-wip").value, 10) || 0);
  save();
  colDialog.close();
  render();
});

$("#col-delete").addEventListener("click", () => {
  const idx = state.columns.findIndex((c) => c.id === editingCol);
  if (idx < 0 || state.columns.length <= 1) return;
  undoSnapshot = snapshot();
  const [col] = state.columns.splice(idx, 1);
  // notes in a deleted column slide into its neighbour so nothing is lost silently
  const neighbour = state.columns[Math.max(0, idx - 1)];
  state.order[neighbour.id].push(...state.order[col.id]);
  delete state.order[col.id];
  save();
  colDialog.close();
  render();
  showToast(`Removed column “${col.title}”`);
});

$("#add-column").addEventListener("click", () => {
  // new columns go just before Done, so Done stays the last column
  const col = { id: uid(), title: "New column", wip: 0 };
  state.columns.splice(Math.max(0, state.columns.length - 1), 0, col);
  state.order[col.id] = [];
  save();
  render();
  board.querySelector(`[data-col="${CSS.escape(col.id)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  openColumnEditor(col.id);
});

/* ---------------- toolbar ---------------- */

$("#search").addEventListener("input", (e) => {
  filterText = e.target.value.trim().toLowerCase();
  board.querySelectorAll(".note").forEach((el) => {
    el.classList.toggle("is-hidden", !isVisible(state.notes[el.dataset.id]));
  });
});

$("#project-filter").addEventListener("change", (e) => setProjectFilter(e.target.value));

$("#lanes-toggle").addEventListener("click", () => {
  lanesOn = !lanesOn;
  try { localStorage.setItem(LANES_KEY, lanesOn ? "1" : "0"); } catch (_) { /* ignore */ }
  render();
});

$("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.title.replace(/[^\w-]+/g, "-").toLowerCase() || "board"}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$("#import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    if (!isValidState(s)) throw new Error("not a board file");
    undoSnapshot = snapshot();
    state = normalize(s);
    save();
    render();
    showToast("Board imported");
  } catch (err) {
    alert("Couldn't import that file: " + err.message);
  }
});

/* ---------------- archive + history ---------------- */

$("#archive-done").addEventListener("click", () => {
  const done = doneColumn();
  const ids = done ? state.order[done.id] : [];
  if (!ids.length) { undoSnapshot = null; showToast("Nothing in Done to archive"); return; }
  undoSnapshot = snapshot();
  const now = Date.now();
  for (const id of ids) {
    const n = state.notes[id];
    state.archive.push({ ...n, doneAt: n.doneAt || now, archivedAt: now });
    delete state.notes[id];
  }
  state.order[done.id] = [];
  save();
  render();
  showToast(`Archived ${ids.length} finished ${ids.length === 1 ? "note" : "notes"}`);
});

const historyDialog = $("#history-dialog");

function renderHistory() {
  const list = $("#history-list");
  list.textContent = "";
  const items = state.archive.filter(inProjectFilter).sort((a, b) => b.doneAt - a.doneAt);
  const scope = projectFilter ? ` in ${projectFilter === NO_PROJECT ? "No project" : $("#project-filter").selectedOptions[0]?.text}` : "";
  $("#history-summary").textContent = items.length
    ? `${items.length} archived ${items.length === 1 ? "note" : "notes"}${scope}, newest first.`
    : "";
  if (!items.length) {
    const p = document.createElement("p");
    p.className = "history-empty";
    p.textContent = `Nothing archived${scope} yet. Use “✓ Archive done” in your weekly review to clear the Done column; finished notes land here.`;
    list.append(p);
    return;
  }
  const weeks = new Map();
  for (const it of items) {
    const w = weekStart(it.doneAt);
    if (!weeks.has(w)) weeks.set(w, []);
    weeks.get(w).push(it);
  }
  const thisWeek = weekStart(Date.now());
  for (const [w, its] of weeks) {
    const sec = document.createElement("section");
    sec.className = "history-week";
    const h = document.createElement("h3");
    h.textContent = w === thisWeek ? "This week" : w === thisWeek - 7 * 864e5 ? "Last week" : `Week of ${fmtDay(w)}`;
    const count = document.createElement("small");
    count.textContent = `${its.length} finished`;
    h.append(count);
    sec.append(h);
    for (const it of its) {
      const row = document.createElement("div");
      row.className = "history-item";
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = `var(--c-${COLORS.includes(it.color) ? it.color : "yellow"})`;
      const title = document.createElement("span");
      title.className = "h-title";
      title.textContent = it.title;
      title.title = `Finished ${fmtDay(it.doneAt)}`;
      row.append(dot);
      if (it.project) {
        const tag = document.createElement("span");
        tag.className = "note-project";
        tag.textContent = it.project;
        row.append(tag);
      }
      row.append(title);
      const actions = document.createElement("span");
      actions.className = "h-actions";
      const restore = document.createElement("button");
      restore.type = "button";
      restore.className = "btn btn-small";
      restore.textContent = "Restore";
      restore.title = "Put it back in the Done column";
      restore.addEventListener("click", () => restoreArchived(it.id));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-small btn-danger";
      del.textContent = "Delete";
      del.addEventListener("click", () => deleteArchived(it.id));
      actions.append(restore, del);
      row.append(actions);
      sec.append(row);
    }
    list.append(sec);
  }
}

function restoreArchived(id) {
  const i = state.archive.findIndex((a) => a.id === id);
  const done = doneColumn();
  if (i < 0 || !done) return;
  undoSnapshot = snapshot();
  const [it] = state.archive.splice(i, 1);
  delete it.archivedAt;
  state.notes[it.id] = it;
  state.order[done.id].push(it.id);
  save();
  render();
  renderHistory();
  showToast(`Restored “${it.title}” to ${done.title}`);
}

function deleteArchived(id) {
  const i = state.archive.findIndex((a) => a.id === id);
  if (i < 0) return;
  undoSnapshot = snapshot();
  const [it] = state.archive.splice(i, 1);
  save();
  render();
  renderHistory();
  showToast(`Deleted “${it.title}” from history`);
}

$("#open-history").addEventListener("click", () => {
  renderHistory();
  historyDialog.showModal();
});

$("#reset").addEventListener("click", () => {
  if (!confirm("Clear the whole board and start fresh?")) return;
  undoSnapshot = snapshot();
  state = emptyState();
  save();
  render();
  showToast("Board cleared");
});

/* ---------------- keyboard ---------------- */

board.addEventListener("keydown", (e) => {
  const el = e.target.closest?.(".note");
  if (!el || e.target.closest(".note-project")) return;
  const id = el.dataset.id;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openNoteEditor(id); return; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteNote(id); return; }

  // Alt/Shift + arrows move notes between and within columns
  if (!(e.altKey || e.shiftKey)) return;
  const colIdx = state.columns.findIndex((c) => state.order[c.id].includes(id));
  const ids = state.order[state.columns[colIdx].id];
  const pos = ids.indexOf(id);
  let moved = false;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    const to = colIdx + (e.key === "ArrowLeft" ? -1 : 1);
    if (to >= 0 && to < state.columns.length) {
      ids.splice(pos, 1);
      const dest = state.order[state.columns[to].id];
      dest.splice(Math.min(pos, dest.length), 0, id);
      moved = true;
    }
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    // swap with the neighbour you can see: in swimlanes, the next note in the same lane
    const note = state.notes[id];
    const step = e.key === "ArrowUp" ? -1 : 1;
    let j = pos + step;
    while (lanesOn && j >= 0 && j < ids.length && note.project.toLowerCase() !== state.notes[ids[j]].project.toLowerCase()) j += step;
    if (j >= 0 && j < ids.length) { [ids[j], ids[pos]] = [ids[pos], ids[j]]; moved = true; }
  }
  if (moved) {
    e.preventDefault();
    save();
    render();
    board.querySelector(`.note[data-id="${CSS.escape(id)}"]`)?.focus();
  }
});

/* ---------------- drag and drop (mouse, pen and touch) ---------------- */

const trash = $("#trash");
const LONG_PRESS_MS = 280;
let drag = null;

board.addEventListener("pointerdown", (e) => {
  const el = e.target.closest(".note");
  if (!el || e.button > 0 || e.target.closest(".note-project")) return;
  drag = {
    id: el.dataset.id,
    el,
    pointerType: e.pointerType,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    active: false,
    armed: e.pointerType !== "touch", // touch needs a long-press first so the page can still scroll
    timer: null,
  };
  if (!drag.armed) {
    drag.timer = setTimeout(() => {
      if (!drag) return;
      drag.armed = true;
      navigator.vibrate?.(15);
      startDrag();
    }, LONG_PRESS_MS);
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
});

function onPointerMove(e) {
  if (!drag) return;
  drag.x = e.clientX;
  drag.y = e.clientY;
  const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
  if (!drag.active) {
    if (!drag.armed) {
      if (dist > 8) cleanupPointer(); // user is scrolling, not dragging
      return;
    }
    if (dist > 5) startDrag();
    else return;
  }
  moveGhost();
  updateDropTarget();
}

function startDrag() {
  if (!drag || drag.active) return;
  const rect = drag.el.getBoundingClientRect();
  const ghost = drag.el.cloneNode(true);
  ghost.classList.add("ghost");
  ghost.classList.remove("fresh");
  ghost.style.width = drag.el.offsetWidth + "px";
  ghost.style.height = drag.el.offsetHeight + "px";
  // offsets measured from the un-rotated box
  drag.offX = drag.startX - (rect.left + rect.width / 2 - drag.el.offsetWidth / 2);
  drag.offY = drag.startY - (rect.top + rect.height / 2 - drag.el.offsetHeight / 2);
  document.body.append(ghost);
  drag.ghost = ghost;
  drag.el.classList.add("placeholder");
  drag.active = true;
  document.body.classList.add("dragging");
  window.getSelection()?.removeAllRanges();
  moveGhost();
  autoScrollLoop();
}

function moveGhost() {
  drag.ghost.style.left = drag.x - drag.offX + "px";
  drag.ghost.style.top = drag.y - drag.offY + "px";
}

function overTrash() {
  const r = trash.getBoundingClientRect();
  return drag.x >= r.left && drag.x <= r.right && drag.y >= r.top && drag.y <= r.bottom;
}

function updateDropTarget() {
  const hot = overTrash();
  trash.classList.toggle("hot", hot);
  if (hot) return;

  const under = document.elementFromPoint(drag.x, drag.y);
  let list = under?.closest(".drop-zone") || under?.closest(".column")?.querySelector(".drop-zone");
  if (!list) {
    // pick the drop zone nearest the pointer
    let best = Infinity;
    board.querySelectorAll(".drop-zone").forEach((z) => {
      const r = z.getBoundingClientRect();
      const dx = drag.x < r.left ? r.left - drag.x : drag.x > r.right ? drag.x - r.right : 0;
      const dy = drag.y < r.top ? r.top - drag.y : drag.y > r.bottom ? drag.y - r.bottom : 0;
      const d = dx * dx + dy * dy;
      if (d < best) { best = d; list = z; }
    });
  }
  if (!list) return;
  const siblings = [...list.querySelectorAll(".note:not(.placeholder):not(.is-hidden)")];
  let before = null;
  for (const s of siblings) {
    const r = s.getBoundingClientRect();
    if (drag.y < r.top + r.height / 2) { before = s; break; }
  }
  if (before) {
    if (before.previousElementSibling !== drag.el) list.insertBefore(drag.el, before);
  } else if (list.lastElementChild !== drag.el) {
    list.append(drag.el);
  }
  list.querySelector(".empty-hint")?.remove();
}

function autoScrollLoop() {
  if (!drag || !drag.active) return;
  const edge = 60, speed = 14;
  const br = board.getBoundingClientRect();
  if (drag.x < br.left + edge) board.scrollLeft -= speed;
  else if (drag.x > br.right - edge) board.scrollLeft += speed;
  if (drag.y < edge) window.scrollBy(0, -speed);
  else if (drag.y > window.innerHeight - edge) window.scrollBy(0, speed);
  updateDropTarget();
  requestAnimationFrame(autoScrollLoop);
}

function onPointerUp() {
  if (!drag) return;
  if (!drag.active) {
    const id = drag.id;
    cleanupPointer();
    openNoteEditor(id);
    return;
  }
  const { id, el } = drag;
  const dropOnTrash = overTrash();
  const zone = el.parentElement?.closest(".drop-zone");
  const newCol = zone?.dataset.col;
  const newLane = zone?.dataset.lane; // undefined outside swimlanes
  const sibling = (dir) => {
    let n = el[dir];
    while (n && !n.classList.contains("note")) n = n[dir];
    return n;
  };
  const next = sibling("nextElementSibling");
  const prev = sibling("previousElementSibling");
  endDrag();
  if (dropOnTrash) { deleteNote(id); return; }
  if (!newCol || !state.order[newCol]) { render(); return; }

  const from = findColumnOf(id).id;
  state.order[from] = state.order[from].filter((x) => x !== id);
  // place it next to the note it landed beside, in the column's full order
  const dest = state.order[newCol];
  let at = dest.length;
  if (next && dest.includes(next.dataset.id)) at = dest.indexOf(next.dataset.id);
  else if (prev && dest.includes(prev.dataset.id)) at = dest.indexOf(prev.dataset.id) + 1;
  dest.splice(at, 0, id);
  if (newLane !== undefined) state.notes[id].project = newLane; // dropped into another project's lane
  state.notes[id].tilt = randTilt(); // re-pinning never lands perfectly straight
  save();
  render();
}

function onPointerCancel() {
  if (drag?.active) { endDrag(); render(); }
  else cleanupPointer();
}

function endDrag() {
  drag.ghost?.remove();
  drag.el.classList.remove("placeholder");
  document.body.classList.remove("dragging");
  trash.classList.remove("hot");
  cleanupPointer();
}

function cleanupPointer() {
  if (drag?.timer) clearTimeout(drag.timer);
  drag = null;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
}

// While a touch drag is active, stop the page from scrolling under the finger.
document.addEventListener("touchmove", (e) => { if (drag?.active || (drag && drag.armed)) e.preventDefault(); }, { passive: false });
board.addEventListener("contextmenu", (e) => { if (e.target.closest(".note")) e.preventDefault(); });

/* ---------------- go ---------------- */

render();
