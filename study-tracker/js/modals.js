"use strict";

const Modal = {
  overlay: document.getElementById("modal-overlay"),
  box: document.getElementById("modal"),
  onClose: null,

  open(content, opts) {
    this.box.innerHTML = "";
    this.box.className = "modal" + (opts && opts.wide ? " modal-wide" : "");
    this.box.append(h("button", { class: "modal-close", title: "Close", onclick: () => this.close() }, "×"), content);
    this.overlay.hidden = false;
    this.onClose = (opts && opts.onClose) || null;
    const first = this.box.querySelector("input:not([type=hidden]), textarea, select");
    if (first) setTimeout(() => first.focus(), 0);
  },

  close() {
    if (this.overlay.hidden) return;
    this.overlay.hidden = true;
    this.box.innerHTML = "";
    const cb = this.onClose;
    this.onClose = null;
    if (cb) cb();
  },
};

Modal.overlay.addEventListener("mousedown", (e) => { if (e.target === Modal.overlay) Modal.close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") Modal.close(); });

function field(label, input, hint) {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), input,
    hint ? h("span", { class: "field-hint" }, hint) : null);
}

function categorySelect(selectedId, allowNew) {
  const sel = h("select", { name: "categoryId" },
    h("option", { value: "" }, "— none —"),
    Store.state.categories.map((c) => h("option", { value: c.id, selected: c.id === selectedId }, c.name)),
    allowNew ? h("option", { value: "__new" }, "+ New category…") : null);
  return sel;
}

/* ---------- resource editor ---------- */

function openResourceEditor(resourceId) {
  const existing = resourceId ? Store.state.resources[resourceId] : null;
  const r = existing ? Object.assign({}, existing) : Store.newResource({});

  const title = h("input", { name: "title", value: existing ? r.title : "", placeholder: "e.g. CS50 Introduction to Computer Science", required: true });
  const type = h("select", { name: "type" }, RESOURCE_TYPES.map((t) => h("option", { selected: t === r.type }, t)));
  const cat = categorySelect(r.categoryId, true);
  const curCol = Store.column(r.status).id, curPrio = Store.priority(r.priority).id;
  const status = h("select", { name: "status" }, Store.columns().map((s) => h("option", { value: s.id, selected: s.id === curCol }, s.label)));
  const priority = h("select", { name: "priority" },
    Store.priorities().map((p) => h("option", { value: p.id, selected: p.id === curPrio }, p.label)));
  const url = h("input", { name: "url", value: r.url, placeholder: "https://…", type: "url" });
  const est = h("input", { name: "estHours", type: "number", min: "0", step: "0.25", value: r.estHours == null ? "" : r.estHours });
  const platforms = [...new Set(Object.values(Store.state.resources).map((x) => x.platform).filter(Boolean))].sort();
  const platform = h("input", { name: "platform", value: r.platform || "", placeholder: "Udemy, UTFPR, Book…", list: "platform-list" });
  const platformList = h("datalist", { id: "platform-list" }, platforms.map((p) => h("option", { value: p })));
  const lengthH = h("input", { name: "lengthHours", type: "number", min: "0", step: "0.25", value: r.lengthHours == null ? "" : r.lengthHours });
  const pages = h("input", { name: "pages", type: "number", min: "0", step: "1", value: r.pages == null ? "" : r.pages });
  const ps = h("input", { name: "plannedStart", type: "date", value: r.plannedStart });
  const pe = h("input", { name: "plannedEnd", type: "date", value: r.plannedEnd });
  const notes = h("textarea", { name: "notes", rows: "4", placeholder: "Why this resource, key takeaways, chapters left…" }, r.notes);

  cat.addEventListener("change", () => {
    if (cat.value !== "__new") return;
    const name = prompt("New category name:");
    if (!name) { cat.value = r.categoryId || ""; return; }
    let id;
    Store.commit((s) => { id = Store.findOrCreateCategory(s, name); });
    // Rebuild the options in place so the new category is selected.
    cat.replaceChildren(...categorySelect(id, true).children);
    cat.value = id;
  });

  // Studied time / sessions. Raising the hours creates real logged sessions on
  // the chosen date, so the daily log, Gantt and stats all see the work.
  const logs = existing ? Store.logsFor(r.id) : [];
  const loggedMin = logs.reduce((s, l) => s + l.minutes, 0);
  const initHours = String(Math.round(loggedMin / 60 * 100) / 100);
  const initSessions = String(logs.length + (r.extraSessions || 0));
  const studied = h("input", { name: "studiedHours", type: "number", min: "0", step: "0.25", value: initHours });
  const sessions = h("input", { name: "sessions", type: "number", min: "0", step: "1", value: initSessions });
  const workDate = h("input", { name: "workDate", type: "date", value: todayISO() });
  const workDateField = field("Date of added time", workDate);
  const studiedHint = h("p", { class: "field-hint form-note" });
  const updateStudiedHint = () => {
    const delta = Math.round((Number(studied.value) || 0) * 60) - loggedMin;
    workDateField.hidden = delta <= 0;
    studiedHint.textContent = delta > 0
      ? `+${fmtMinutes(delta)} will be logged as ${Math.max(1, Math.min(delta, (Number(sessions.value) || 0) - Number(initSessions)) || 1)} session(s) on the date you pick; you can edit or move it on the Daily log.`
      : delta < 0
        ? `${fmtMinutes(-delta)} will be removed from the most recent sessions.`
        : logs.length
          ? `${fmtMinutes(loggedMin)} in ${logs.length} logged session${logs.length === 1 ? "" : "s"} (${fmtShortDate(logs[0].date)} – ${fmtShortDate(logs[logs.length - 1].date)}). Change the hours to add or remove time.`
          : "Nothing logged yet. Enter hours to log time you already studied.";
  };
  studied.addEventListener("input", updateStudiedHint);
  sessions.addEventListener("input", updateStudiedHint);
  updateStudiedHint();

  const form = h("form", { class: "form" },
    h("h2", {}, existing ? "Edit resource" : "Add resource"),
    field("Title", title),
    h("div", { class: "form-row" }, field("Type", type), field("Category", cat), field("Priority", priority)),
    h("div", { class: "form-row" }, field("Status", status), field("Platform", platform), platformList),
    h("div", { class: "form-row" }, field("Hours studied", studied), field("Sessions", sessions), workDateField),
    studiedHint,
    h("div", { class: "form-row" }, field("Study estimate (h)", est, "Drives the progress bar"), field("Course length (h)", lengthH), field("Pages", pages)),
    h("div", { class: "form-row" }, field("Planned start", ps), field("Planned end", pe)),
    h("p", { class: "field-hint form-note" }, "Planned dates are drawn as the plan bar on the Gantt."),
    field("Link", url),
    field("Notes", notes),
    h("div", { class: "form-actions" },
      existing ? h("button", { type: "button", class: "btn btn-danger", onclick: () => {
        const n = Store.logsFor(r.id).length;
        if (!confirm(`Delete "${r.title}"` + (n ? ` and its ${n} logged session(s)?` : "?"))) return;
        Store.commit((s) => {
          delete s.resources[r.id];
          for (const l of Object.values(s.logs)) if (l.resourceId === r.id) delete s.logs[l.id];
        });
        Modal.close();
      } }, "Delete") : h("span"),
      h("button", { type: "submit", class: "btn btn-primary" }, existing ? "Save" : "Add")));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const catVal = fd.get("categoryId");
    const next = {
      title: fd.get("title").trim() || "Untitled",
      type: fd.get("type"),
      categoryId: catVal && catVal !== "__new" ? catVal : null,
      status: fd.get("status"),
      priority: Number(fd.get("priority")),
      url: fd.get("url").trim(),
      estHours: fd.get("estHours") === "" ? null : Number(fd.get("estHours")),
      platform: fd.get("platform").trim(),
      lengthHours: fd.get("lengthHours") === "" ? null : Number(fd.get("lengthHours")),
      pages: fd.get("pages") === "" ? null : Number(fd.get("pages")),
      plannedStart: fd.get("plannedStart"),
      plannedEnd: fd.get("plannedEnd"),
      notes: fd.get("notes"),
    };
    // Only act on the numbers if the user changed them (avoids rounding drift).
    const hoursChanged = fd.get("studiedHours") !== initHours;
    const sessionsChanged = fd.get("sessions") !== initSessions;
    const deltaMin = hoursChanged ? Math.round((Number(fd.get("studiedHours")) || 0) * 60) - loggedMin : 0;
    const wantSessions = Math.max(0, Math.round(Number(fd.get("sessions")) || 0));
    if (deltaMin < 0 && !confirm(`Remove ${fmtMinutes(-deltaMin)} from the most recent sessions of this resource?`)) return;
    const date = fd.get("workDate") || todayISO();
    const newStatus = next.status;
    delete next.status;
    Store.commit((s) => {
      s.resources[r.id] = Object.assign(r, next);
      if (!existing || Store.column(r.status).id !== newStatus) Store.setStatus(r, newStatus);
      if (deltaMin > 0) {
        // New sessions = how many the session count went up by (at least one).
        const n = Math.max(1, Math.min(deltaMin, sessionsChanged ? wantSessions - Number(initSessions) : 1));
        splitMinutes(deltaMin, n).forEach((m) => Store.addLog(s, { resourceId: r.id, date, minutes: m, note: "Added in resource editor" }));
      } else if (deltaMin < 0) {
        // Take time off the newest sessions first; sessions that reach zero are removed.
        let left = -deltaMin;
        const newestFirst = Object.values(s.logs).filter((l) => l.resourceId === r.id)
          .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
        for (const l of newestFirst) {
          if (left <= 0) break;
          const take = Math.min(left, l.minutes);
          l.minutes -= take;
          left -= take;
          if (l.minutes <= 0) delete s.logs[l.id];
        }
      }
      // Any remaining difference in the session count is kept as a count-only adjustment.
      const logCount = Object.values(s.logs).filter((l) => l.resourceId === r.id).length;
      if (sessionsChanged) r.extraSessions = wantSessions - logCount;
      else r.extraSessions = Math.max(0, (r.extraSessions || 0));
    });
    Modal.close();
  });

  Modal.open(form);
}

/* ---------- log (study session) editor ---------- */

function openLogEditor(logId, draft) {
  const existing = logId ? Store.state.logs[logId] : null;
  const l = existing ? Object.assign({}, existing) : Object.assign({ minutes: 30, note: "", focus: null }, draft);
  const res = Store.state.resources[l.resourceId];

  const date = h("input", { name: "date", type: "date", value: l.date, required: true });
  const hours = h("input", { name: "hours", type: "number", min: "0", step: "1", value: Math.floor(l.minutes / 60) });
  const mins = h("input", { name: "mins", type: "number", min: "0", max: "59", step: "5", value: l.minutes % 60 });
  const quick = h("div", { class: "chips" }, [15, 25, 30, 45, 60, 90, 120].map((m) =>
    h("button", { type: "button", class: "chip", onclick: () => { hours.value = Math.floor(m / 60); mins.value = m % 60; } }, fmtMinutes(m))));
  const focus = h("div", { class: "focus-picker", role: "radiogroup" }, [1, 2, 3, 4, 5].map((n) =>
    h("label", { class: "focus-opt" }, h("input", { type: "radio", name: "focus", value: n, checked: Number(l.focus) === n }), String(n))));
  const note = h("textarea", { name: "note", rows: "3", placeholder: "What did you cover? What should you review next time?" }, l.note);
  const doneCol = Store.firstColumnOfKind("done");
  const markDone = res && doneCol && !Store.isDone(res)
    ? h("label", { class: "small" }, h("input", { type: "checkbox", name: "markDone" }), " I finished this resource")
    : null;

  const form = h("form", { class: "form" },
    h("h2", {}, existing ? "Edit session" : "Log study session"),
    h("div", { class: "log-res" }, h("span", { class: "swatch", style: { background: Store.categoryColor(res && res.categoryId) } }), res ? res.title : "(deleted resource)"),
    h("div", { class: "form-row" }, field("Date", date), field("Hours", hours), field("Minutes", mins)),
    quick,
    field("Focus / quality (1–5)", focus),
    field("Notes", note),
    markDone,
    h("div", { class: "form-actions" },
      existing ? h("button", { type: "button", class: "btn btn-danger", onclick: () => {
        Store.commit((s) => { delete s.logs[l.id]; });
        Modal.close();
      } }, "Delete") : h("span"),
      h("button", { type: "submit", class: "btn btn-primary" }, existing ? "Save" : "Log it")));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const minutes = (Number(fd.get("hours")) || 0) * 60 + (Number(fd.get("mins")) || 0);
    if (minutes <= 0) { toast("Enter how long you studied."); return; }
    const fields = { date: fd.get("date"), minutes, note: fd.get("note"), focus: fd.get("focus") ? Number(fd.get("focus")) : null };
    Store.commit((s) => {
      if (existing) Object.assign(s.logs[l.id], fields);
      else Store.addLog(s, Object.assign({ resourceId: l.resourceId }, fields));
      if (fd.get("markDone") && s.resources[l.resourceId]) {
        Store.setStatus(s.resources[l.resourceId], doneCol);
        s.resources[l.resourceId].doneAt = fields.date;
      }
    });
    Modal.close();
  });

  Modal.open(form);
}

/* ---------- category manager ---------- */

function openCategoryManager() {
  const list = h("div", { class: "cat-list" });
  const render = () => {
    list.innerHTML = "";
    if (!Store.state.categories.length) list.append(h("p", { class: "muted" }, "No categories yet."));
    for (const c of Store.state.categories) {
      const count = Object.values(Store.state.resources).filter((r) => r.categoryId === c.id).length;
      const input = h("input", { value: c.name });
      input.addEventListener("change", () => Store.commit(() => { c.name = input.value.trim() || c.name; }));
      list.append(h("div", { class: "cat-row" },
        h("span", { class: "swatch", style: { background: Store.categoryColor(c.id) } }),
        input,
        h("span", { class: "muted small" }, count + " resources"),
        h("button", { class: "btn btn-ghost btn-small", onclick: () => {
          if (!confirm(`Delete category "${c.name}"? Its resources stay, uncategorised.`)) return;
          Store.commit((s) => {
            s.categories = s.categories.filter((x) => x.id !== c.id);
            for (const r of Object.values(s.resources)) if (r.categoryId === c.id) r.categoryId = null;
          });
          render();
        } }, "Delete")));
    }
  };
  const newInput = h("input", { placeholder: "New category, e.g. Embedded C" });
  const addForm = h("form", { class: "inline-form", onsubmit: (e) => {
    e.preventDefault();
    if (!newInput.value.trim()) return;
    Store.commit((s) => Store.findOrCreateCategory(s, newInput.value));
    newInput.value = "";
    render();
  } }, newInput, h("button", { class: "btn btn-primary btn-small" }, "Add"));
  render();
  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Categories"),
    h("p", { class: "muted small" }, "Each category keeps a fixed color everywhere (board, Gantt, stats). The first 8 get distinct colors; more fold into gray."),
    list, addForm));
}

/* ---------- board settings: columns + priority levels ---------- */

const TOKEN_COLOR_NAMES = { comment: "gray", fn: "blue", type: "yellow", str: "green", keyword: "purple", const: "cyan", num: "orange", err: "red" };

const PRIORITY_PRESETS = [
  { label: "high / med / low", levels: [["high", "err"], ["med", "num"], ["low", "comment"]] },
  { label: "P1 … P5", levels: [["P1", "err"], ["P2", "num"], ["P3", "type"], ["P4", "fn"], ["P5", "comment"]] },
  { label: "5 … 0 (six levels)", levels: [["5", "err"], ["4", "num"], ["3", "type"], ["2", "str"], ["1", "fn"], ["0", "comment"]] },
];

function openBoardSettings() {
  // Work on a copy; nothing changes until Save.
  const cols = Store.columns().map((c) => Object.assign({}, c));
  let prios = Store.priorities().map((p) => Object.assign({}, p));
  const colRemap = {};   // deleted column id -> column its cards move to
  let prioRemap = {};    // old priority id -> new priority id
  const counts = (key, id) => Object.values(Store.state.resources).filter((r) => r[key] === id).length;
  const body = h("div", { class: "settings-lists" });

  const colorPicker = (item) => {
    const dot = h("span", { class: "color-dot", style: { background: "var(--tok-" + item.color + ")" } });
    const sel = h("select", { class: "color-select", "aria-label": "Color" },
      TOKEN_COLORS.map((c) => h("option", { value: c, selected: c === item.color }, TOKEN_COLOR_NAMES[c])));
    sel.addEventListener("change", () => { item.color = sel.value; dot.style.background = "var(--tok-" + item.color + ")"; });
    return h("span", { class: "color-pick" }, dot, sel);
  };

  const moveBtns = (list, i) => h("span", { class: "move-btns" },
    h("button", { type: "button", class: "icon-btn", title: "Move up", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; render(); } }, "▲"),
    h("button", { type: "button", class: "icon-btn", title: "Move down", disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; render(); } }, "▼"));

  const render = () => {
    body.innerHTML = "";

    // Columns
    const colRows = cols.map((c, i) => {
      const n = counts("status", c.id) + Object.entries(colRemap).filter(([, to]) => to === c.id).reduce((s, [from]) => s + counts("status", from), 0);
      const label = h("input", { value: c.label, "aria-label": "Column name" });
      label.addEventListener("input", () => { c.label = label.value; });
      const kind = h("select", { "aria-label": "Behaviour", title: COLUMN_KINDS.map((k) => k.label + ": " + k.hint).join("\n") },
        COLUMN_KINDS.map((k) => h("option", { value: k.id, selected: k.id === c.kind }, k.label)));
      kind.addEventListener("change", () => { c.kind = kind.value; });
      return h("div", { class: "settings-row" },
        moveBtns(cols, i), colorPicker(c), label, kind,
        h("span", { class: "muted small count" }, n + " cards"),
        h("button", { type: "button", class: "icon-btn danger", title: "Delete column", disabled: cols.length === 1, onclick: () => {
          const target = cols[i - 1] || cols[i + 1];
          if (n && !confirm(`Delete "${c.label}"? Its ${n} card(s) move to "${target.label}".`)) return;
          colRemap[c.id] = target.id;
          for (const k of Object.keys(colRemap)) if (colRemap[k] === c.id) colRemap[k] = target.id;
          cols.splice(i, 1);
          render();
        } }, "×"));
    });

    // Priorities
    const prioRows = prios.map((p, i) => {
      const n = Object.values(Store.state.resources).filter((r) => (prioRemap[Store.priority(r.priority).id] ?? Store.priority(r.priority).id) === p.id).length;
      const label = h("input", { value: p.label, "aria-label": "Priority name" });
      label.addEventListener("input", () => { p.label = label.value; });
      return h("div", { class: "settings-row" },
        moveBtns(prios, i), colorPicker(p), label,
        h("span", { class: "prio", style: { "--pc": "var(--tok-" + p.color + ")" } }, i === 0 ? "most important" : i === prios.length - 1 ? "least important" : "#" + (i + 1)),
        h("span", { class: "muted small count" }, n + " cards"),
        h("button", { type: "button", class: "icon-btn danger", title: "Delete level", disabled: prios.length === 1, onclick: () => {
          const target = prios[i + 1] || prios[i - 1];
          if (n && !confirm(`Delete "${p.label}"? Its ${n} card(s) become "${target.label}".`)) return;
          const oldIds = Store.priorities().map((x) => x.id);
          for (const id of oldIds) if ((prioRemap[id] ?? id) === p.id) prioRemap[id] = target.id;
          prios.splice(i, 1);
          render();
        } }, "×"));
    });

    const presetBtns = PRIORITY_PRESETS.map((preset) => h("button", { type: "button", class: "chip", onclick: () => {
      // Spread existing cards over the new levels by relative rank.
      const newLevels = preset.levels.map(([label, color], i) => ({ id: i + 1, label, color }));
      const current = prios.slice();
      const oldIds = Store.priorities().map((x) => x.id);
      const next = {};
      for (const id of oldIds) {
        const cur = prioRemap[id] ?? id;
        const idx = current.findIndex((x) => x.id === cur);
        const rel = current.length > 1 ? Math.max(0, idx) / (current.length - 1) : 0;
        next[id] = newLevels[Math.round(rel * (newLevels.length - 1))].id;
      }
      prioRemap = next;
      prios = newLevels;
      render();
    } }, preset.label));

    body.append(
      h("section", {},
        h("h3", {}, "Board columns"),
        h("p", { class: "muted small" }, "Order here is left → right on the board. The behaviour decides what the app does with cards in that column: ",
          h("b", {}, "To do"), " (logging a session moves it to the first In-progress column), ",
          h("b", {}, "In progress"), " and ", h("b", {}, "On hold"), " (listed in the timer), ",
          h("b", {}, "Finished"), " (✓ on the Gantt, counted as finished in Stats)."),
        h("div", { class: "settings-list" }, colRows),
        h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: () => {
          cols.push({ id: uid(), label: "New column", kind: "doing", color: TOKEN_COLORS[(cols.length + 1) % TOKEN_COLORS.length] });
          render();
          const inputs = $$(".settings-list input", body);
          inputs[cols.length - 1].select();
        } }, "+ Add column")),
      h("section", {},
        h("h3", {}, "Priority levels"),
        h("p", { class: "muted small" }, "Most important first. Imports map numeric priorities onto these levels (a 0–5 column maps one-to-one onto six levels)."),
        h("div", { class: "chips" }, h("span", { class: "muted small" }, "Presets:"), presetBtns),
        h("div", { class: "settings-list" }, prioRows),
        h("button", { type: "button", class: "btn btn-ghost btn-small", onclick: () => {
          prios.push({ id: Math.max(0, ...prios.map((x) => x.id), ...Store.priorities().map((x) => x.id)) + 1, label: "new level", color: "comment" });
          render();
        } }, "+ Add level")));
  };

  const save = h("button", { type: "button", class: "btn btn-primary", onclick: () => {
    cols.forEach((c) => { c.label = c.label.trim() || "Untitled"; });
    prios.forEach((p) => { p.label = p.label.trim() || "level"; });
    Store.commit((s) => {
      s.columns = cols;
      s.priorities = prios;
      const colIds = new Set(cols.map((c) => c.id));
      const prioIds = new Set(prios.map((p) => p.id));
      for (const r of Object.values(s.resources)) {
        if (!colIds.has(r.status)) {
          let to = colRemap[r.status];
          while (to && !colIds.has(to)) to = colRemap[to];
          Store.setStatus(r, to || cols[0].id);
        }
        const mapped = prioRemap[r.priority] ?? r.priority;
        r.priority = prioIds.has(mapped) ? mapped : Store.defaultPriority();
        // Keep finish dates consistent if a column changed behaviour.
        if (Store.isDone(r) && !r.doneAt) r.doneAt = todayISO();
        if (!Store.isDone(r)) r.doneAt = "";
      }
    });
    Modal.close();
    toast("Board settings saved.");
  } }, "Save");

  render();
  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Columns & priorities"),
    body,
    h("div", { class: "form-actions" }, h("button", { type: "button", class: "btn btn-ghost", onclick: () => Modal.close() }, "Cancel"), save)), { wide: true });
}
