"use strict";

/*
 * Deliverables: one deliverable (a document or drawing you issue) can be made of
 * several cards of the same project. Cards link to it with resource.deliverableId;
 * hours, estimate, due date and issue date roll up (see Store.deliverableSummary).
 */

function numOrNull(v) { return v === "" || v == null ? null : Number(v); }

function openDeliverableManager() {
  const body = h("div", { class: "dlv-manager" });

  const render = () => {
    body.innerHTML = "";
    const projects = Store.projects();
    const byProject = new Map();
    for (const d of Store.deliverableList()) (byProject.get(d.project) || byProject.set(d.project, []).get(d.project)).push(d);
    if (!byProject.size) {
      body.append(h("p", { class: "muted" }, "No deliverables yet. Type one in a card's Deliverable field, or add one below."));
    }
    const keys = [...byProject.keys()].sort((a, b) => Store.projectLabel(a).localeCompare(Store.projectLabel(b)));
    for (const key of keys) {
      const rows = byProject.get(key).map((d) => {
        const sm = Store.deliverableSummary(d);
        const name = h("input", { value: d.name, "aria-label": "Deliverable name" });
        name.addEventListener("change", () => Store.commit(() => { d.name = name.value.trim() || d.name; }));
        const est = h("input", { type: "number", min: "0", step: "0.25", value: d.estHours == null ? "" : d.estHours, placeholder: sm.estHours && d.estHours == null ? String(sm.estHours) : "", "aria-label": "Estimate (h)" });
        est.addEventListener("change", () => Store.commit(() => { d.estHours = numOrNull(est.value); }));
        const due = h("input", { type: "date", value: d.dueDate || "", "aria-label": "Due date" });
        due.addEventListener("change", () => Store.commit(() => { d.dueDate = due.value; }));
        const issued = h("input", { type: "date", value: d.issuedAt || "", "aria-label": "Issued on" });
        issued.addEventListener("change", () => Store.commit(() => { d.issuedAt = issued.value; }));
        return h("tr", {},
          h("td", {}, name),
          h("td", { class: "num" }, h("button", { type: "button", class: "link-btn", title: "Open", onclick: () => openDeliverableEditor(d.id) }, sm.cards.length + " card" + (sm.cards.length === 1 ? "" : "s"))),
          h("td", { class: "num" }, fmtMinutes(sm.minutes)),
          h("td", {}, est),
          h("td", {}, due),
          h("td", {}, issued, !d.issuedAt && sm.issued ? h("div", { class: "field-hint" }, "issued: all cards done") : null),
          h("td", {}, h("button", { type: "button", class: "btn btn-ghost btn-small", title: "Delete deliverable (its cards stay)", onclick: () => {
            if (!confirm(`Delete deliverable "${d.name}"? Its ${sm.cards.length} card(s) stay, without a deliverable.`)) return;
            Store.commit((s) => {
              for (const r of Object.values(s.resources)) if (r.deliverableId === d.id) r.deliverableId = null;
              delete s.deliverables[d.id];
            });
          } }, "×")));
      });
      body.append(h("h3", { class: "dlv-project" }, h("span", { class: "swatch", style: { background: Store.projectColor(key) } }), " ", Store.projectLabel(key)),
        h("div", { class: "table-wrap" }, h("table", { class: "data-table dlv-table" },
          h("thead", {}, h("tr", {}, ["Deliverable", "Cards", "Hours", "Estimate (h)", "Due", "Issued", ""].map((t, i) => h("th", { class: i === 1 || i === 2 ? "num" : "" }, t)))),
          h("tbody", {}, rows))));
    }

    // Add a deliverable directly (cards can join it later from their editor).
    const proj = h("input", { placeholder: "Project", list: "dlv-project-list", required: true });
    const name = h("input", { placeholder: "New deliverable, e.g. E-301 Short-circuit study", required: true });
    const add = h("form", { class: "form-row dlv-add" },
      h("datalist", { id: "dlv-project-list" }, projects.map((p) => h("option", { value: p.label }))),
      proj, name, h("button", { type: "submit", class: "btn btn-primary btn-small" }, "Add"));
    add.addEventListener("submit", (e) => {
      e.preventDefault();
      Store.commit((s) => Store.findOrCreateDeliverable(s, proj.value.trim().toLowerCase(), name.value));
    });
    body.append(h("h3", {}, "Add a deliverable"), add);
  };

  const unsub = () => { Store.listeners = Store.listeners.filter((f) => f !== render); };
  Store.subscribe(render);
  render();
  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Deliverables"),
    h("p", { class: "small muted" }, "A deliverable groups several cards of one project. Hours add up from its cards; estimate and due date can be set here, otherwise they come from its cards. It counts as issued when you set the date, or when all its cards are done."),
    body), { wide: true, onClose: unsub });
}

function openDeliverableEditor(id) {
  const d = Store.deliverable(id);
  if (!d) return;
  const sm = Store.deliverableSummary(d);
  const name = h("input", { name: "name", value: d.name, required: true });
  const est = h("input", { name: "est", type: "number", min: "0", step: "0.25", value: d.estHours == null ? "" : d.estHours, placeholder: sm.estHours != null && d.estHours == null ? "from cards: " + sm.estHours : "" });
  const due = h("input", { name: "due", type: "date", value: d.dueDate || "" });
  const issued = h("input", { name: "issued", type: "date", value: d.issuedAt || "" });
  const cards = h("div", { class: "dlv-cards" }, sm.cards.length ? sm.cards.map((r) => h("button", { type: "button", class: "task-log-row", onclick: () => openResourceEditor(r.id) },
    h("span", { class: "tok-num" }, fmtMinutes(Store.minutesFor(r.id))),
    h("span", { class: "task-log-note" }, r.title),
    h("span", { style: { color: "var(--tok-" + Store.column(r.status).color + ")" } }, r.archived ? "archived" : Store.column(r.status).label))) : h("div", { class: "empty" }, "No cards yet."));
  const form = h("form", { class: "form" },
    h("h2", {}, "Deliverable"),
    h("p", { class: "muted small" }, Store.projectLabel(d.project) + " · " + sm.cards.length + " card(s) · " + fmtMinutes(sm.minutes) + " logged" +
      (sm.estHours ? " of " + sm.estHours + "h" : "") + (sm.issued ? " · issued " + (sm.issuedAt ? fmtDate(sm.issuedAt) : "") : "")),
    field("Name", name),
    h("div", { class: "form-row" }, field("Estimate (h)", est, "Empty = sum of card estimates"), field("Due", due, "Empty = latest card end"), field("Issued on", issued, "Empty = when all cards are done")),
    h("div", { class: "task-log" }, h("div", { class: "task-log-head" }, h("span", { class: "field-label" }, "Cards")), cards),
    h("div", { class: "form-actions" }, h("span"), h("button", { type: "submit", class: "btn btn-primary" }, "Save")));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    Store.commit((s) => {
      const x = s.deliverables[id];
      if (!x) return;
      x.name = name.value.trim() || x.name;
      x.estHours = numOrNull(est.value);
      x.dueDate = due.value;
      x.issuedAt = issued.value;
    });
    Modal.close();
  });
  Modal.open(form);
}
