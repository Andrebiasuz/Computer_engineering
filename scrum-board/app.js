"use strict";

/* =========================================================
   Sprint Board — sticky notes on a corkboard.
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
    { id: uid(), title: "To Do", wip: 0 },
    { id: uid(), title: "In Progress", wip: 3 },
    { id: uid(), title: "Review", wip: 2 },
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
  const state = { sprint: "Sprint 1", goal: "Ship a usable MVP", columns: cols, notes: {}, order: {} };
  cols.forEach((c, i) => {
    state.order[c.id] = notes[i].map((note) => note.id);
    notes[i].forEach((note) => (state.notes[note.id] = note));
  });
  return state;
}

function emptyState() {
  const cols = ["To Do", "In Progress", "Done"].map((t) => ({ id: uid(), title: t, wip: 0 }));
  const order = {};
  cols.forEach((c) => (order[c.id] = []));
  return { sprint: "Sprint 1", goal: "", columns: cols, notes: {}, order };
}

function isValidState(s) {
  return s && typeof s === "object" && Array.isArray(s.columns) &&
    s.notes && typeof s.notes === "object" && s.order && typeof s.order === "object";
}

function normalize(s) {
  s.sprint = String(s.sprint ?? "Sprint");
  s.goal = String(s.goal ?? "");
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

function save() {
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
  state.columns.forEach((col, i) => {
    const ids = state.order[col.id];
    const sec = document.createElement("section");
    sec.className = "column";
    sec.dataset.col = col.id;
    if (col.wip && ids.length > col.wip) sec.classList.add("over-wip");

    const label = document.createElement("header");
    label.className = "col-label";
    label.style.setProperty("--label-tilt", (i % 2 ? 1.2 : -1.5) + "deg");
    const t = document.createElement("span");
    t.className = "col-title";
    t.textContent = col.title;
    const meta = document.createElement("span");
    meta.className = "col-meta";
    const pts = pointsOf(ids);
    meta.textContent = `${ids.length}${col.wip ? " / " + col.wip : ""} notes${pts ? " · " + pts + " pts" : ""}`;
    label.append(t, meta);

    const menu = document.createElement("button");
    menu.className = "col-menu";
    menu.type = "button";
    menu.title = "Column settings";
    menu.setAttribute("aria-label", `Settings for ${col.title}`);
    menu.textContent = "⋯";
    menu.addEventListener("click", () => openColumnEditor(col.id));
    label.append(menu);

    const list = document.createElement("div");
    list.className = "col-notes";
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
  freshId = null;
  renderProjectFilter();
  renderHeader();
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
  const sprintEl = $("#sprint-name");
  const goalEl = $("#sprint-goal");
  if (document.activeElement !== sprintEl) sprintEl.textContent = state.sprint;
  if (document.activeElement !== goalEl) goalEl.textContent = state.goal;
  document.title = `${state.sprint} · Sprint Board`;

  // progress follows the project filter, so you can see how each project is doing
  const inScope = (id) => inProjectFilter(state.notes[id]);
  const all = state.columns.flatMap((c) => state.order[c.id]).filter(inScope);
  const doneCol = state.columns[state.columns.length - 1];
  const doneIds = doneCol ? state.order[doneCol.id].filter(inScope) : [];
  const totalPts = pointsOf(all);
  let pct, text;
  if (totalPts) {
    const donePts = pointsOf(doneIds);
    pct = (donePts / totalPts) * 100;
    text = `${donePts} / ${totalPts} pts done`;
  } else {
    pct = all.length ? (doneIds.length / all.length) * 100 : 0;
    text = `${doneIds.length} / ${all.length} done`;
  }
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
bindEditable($("#sprint-name"), "sprint", "Sprint");
bindEditable($("#sprint-goal"), "goal", "");

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

function openNoteEditor(id, colId) {
  const note = id ? state.notes[id] : null;
  editing = { id, col: note ? findColumnOf(id).id : colId, color: note ? note.color : COLORS[Math.floor(Math.random() * COLORS.length)], colorTouched: !!note };
  // a new note starts in the project you're looking at
  const startProject = note ? note.project : (projectFilter && projectFilter !== NO_PROJECT ? $("#project-filter").selectedOptions[0]?.text || "" : "");
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
  $("#toast-text").textContent = text;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $("#toast").hidden = true; undoSnapshot = null; }, 6000);
}

$("#toast-undo").addEventListener("click", () => {
  if (undoSnapshot) { state = undoSnapshot; undoSnapshot = null; save(); render(); }
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
  const col = { id: uid(), title: "New column", wip: 0 };
  state.columns.push(col);
  state.order[col.id] = [];
  save();
  render();
  board.scrollTo({ left: board.scrollWidth, behavior: "smooth" });
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

$("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${state.sprint.replace(/[^\w-]+/g, "-").toLowerCase() || "board"}.json`;
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
  } else if (e.key === "ArrowUp" && pos > 0) {
    [ids[pos - 1], ids[pos]] = [ids[pos], ids[pos - 1]]; moved = true;
  } else if (e.key === "ArrowDown" && pos < ids.length - 1) {
    [ids[pos + 1], ids[pos]] = [ids[pos], ids[pos + 1]]; moved = true;
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
  let column = under?.closest(".column");
  if (!column) {
    // pick the column horizontally nearest the pointer
    let best = Infinity;
    board.querySelectorAll(".column").forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = drag.x < r.left ? r.left - drag.x : drag.x > r.right ? drag.x - r.right : 0;
      if (d < best) { best = d; column = c; }
    });
  }
  if (!column) return;
  const list = column.querySelector(".col-notes");
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
  const newCol = el.closest(".column")?.dataset.col;
  const newIndex = [...el.parentElement.querySelectorAll(".note")].indexOf(el);
  endDrag();
  if (dropOnTrash) { deleteNote(id); return; }
  if (!newCol) { render(); return; }

  const from = findColumnOf(id).id;
  state.order[from] = state.order[from].filter((x) => x !== id);
  // map the placeholder's DOM position back onto the column's order array
  const domIds = [...board.querySelectorAll(`.column[data-col="${CSS.escape(newCol)}"] .note`)]
    .map((n) => n.dataset.id).filter((x) => x !== id);
  const anchor = domIds[newIndex];
  const dest = state.order[newCol];
  const at = anchor ? dest.indexOf(anchor) : dest.length;
  dest.splice(at < 0 ? dest.length : at, 0, id);
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
