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
  const status = h("select", { name: "status" }, STATUSES.map((s) => h("option", { value: s.id, selected: s.id === r.status }, s.label)));
  const priority = h("select", { name: "priority" },
    [[1, "High"], [2, "Medium"], [3, "Low"]].map(([v, l]) => h("option", { value: v, selected: v === Number(r.priority) }, l)));
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

  let stats = null;
  if (existing) {
    const mins = Store.minutesFor(r.id);
    const logs = Store.logsFor(r.id);
    stats = h("div", { class: "resource-stats" },
      h("span", {}, h("strong", {}, fmtMinutes(mins)), " studied"),
      h("span", {}, h("strong", {}, logs.length), " sessions"),
      logs.length ? h("span", {}, "first ", h("strong", {}, fmtShortDate(logs[0].date)),
        " · last ", h("strong", {}, fmtShortDate(logs[logs.length - 1].date))) : null);
  }

  const form = h("form", { class: "form" },
    h("h2", {}, existing ? "Edit resource" : "Add resource"),
    stats,
    field("Title", title),
    h("div", { class: "form-row" }, field("Type", type), field("Category", cat), field("Priority", priority)),
    h("div", { class: "form-row" }, field("Status", status), field("Platform", platform), platformList),
    h("div", { class: "form-row" }, field("Study estimate (h)", est, "Used for progress"), field("Course length (h)", lengthH), field("Pages", pages)),
    h("div", { class: "form-row" }, field("Planned start", ps), field("Planned end", pe, "Drawn as the plan bar on the Gantt")),
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
    if (next.status === "done" && r.status !== "done") next.doneAt = todayISO();
    Store.commit((s) => { s.resources[r.id] = Object.assign(r, next); });
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
  const markDone = res && res.status !== "done"
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
        s.resources[l.resourceId].status = "done";
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
