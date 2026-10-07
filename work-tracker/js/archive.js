"use strict";

/* Archive: finished tasks sent off the board with "Send to archive". */

const Archive = {
  table: document.getElementById("ar-table"),
  search: document.getElementById("ar-search"),

  init() {
    this.search.addEventListener("input", () => this.render());
  },

  matches(r) {
    const q = this.search.value.trim().toLowerCase();
    if (!q) return true;
    const cat = (Store.category(r.categoryId) || {}).name || "";
    return [r.title, r.statusNote, r.notes, r.type, r.platform, cat].join(" ").toLowerCase().includes(q);
  },

  render() {
    const all = Store.archivedList();
    const rows = all.filter((r) => this.matches(r));
    const totalMin = all.reduce((s, r) => s + Store.minutesFor(r.id), 0);
    document.getElementById("ar-summary").textContent = all.length
      ? `${all.length} archived task${all.length === 1 ? "" : "s"} · ${fmtHours(totalMin)} logged`
      : "";

    const el = this.table;
    el.innerHTML = "";
    el.append(h("thead", {}, h("tr", {},
      ["Task", "Category", "Type", "Project", "Hours", "Sessions", "Finished", "Archived", ""].map((c) =>
        h("th", { class: ["Hours", "Sessions"].includes(c) ? "num" : "" }, c)))));
    const body = h("tbody");
    if (!rows.length) {
      body.append(h("tr", {}, h("td", { colspan: 9, class: "muted" }, all.length
        ? "No archived task matches your search."
        : "Nothing archived yet. Cards in Done get a “Send to archive” button.")));
    }
    for (const r of rows) {
      const cat = Store.category(r.categoryId);
      body.append(h("tr", { class: "clickable", onclick: () => openResourceEditor(r.id) },
        h("td", { class: "ar-title" }, h("div", {}, r.title),
          r.statusNote ? h("div", { class: "ar-status" }, r.statusNote) : null),
        h("td", {}, h("span", { class: "swatch", style: { background: Store.categoryColor(r.categoryId) } }), " ", cat ? cat.name : "—"),
        h("td", { class: "tok-type" }, r.type || "—"),
        h("td", { class: "tok-str" }, r.platform || "—"),
        h("td", { class: "num" }, fmtMinutes(Store.minutesFor(r.id)) || "0m"),
        h("td", { class: "num" }, Store.sessionsFor(r.id)),
        h("td", {}, r.doneAt ? fmtDate(r.doneAt) : "—"),
        h("td", {}, r.archivedAt ? fmtDate(r.archivedAt) : "—"),
        h("td", { class: "ar-actions" },
          h("button", { type: "button", class: "btn btn-ghost btn-small", title: "Put it back on the board, in " + Store.column(r.status).label,
            onclick: (e) => {
              e.stopPropagation();
              Store.commit((s) => Store.restore(s.resources[r.id]));
              toast("Restored to " + Store.column(r.status).label + ".");
            } }, "Restore"),
          h("button", { type: "button", class: "btn btn-ghost btn-small btn-danger-text", title: "Delete this task and its sessions for good",
            onclick: (e) => {
              e.stopPropagation();
              const n = Store.logsFor(r.id).length;
              if (!confirm(`Delete "${r.title}"` + (n ? ` and its ${n} logged session${n === 1 ? "" : "s"}` : "") + "? This can't be undone.")) return;
              Store.commit((s) => {
                delete s.resources[r.id];
                for (const l of Object.values(s.logs)) if (l.resourceId === r.id) delete s.logs[l.id];
              });
            } }, "Delete"))));
    }
    el.append(body);
  },
};
