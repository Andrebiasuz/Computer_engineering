"use strict";

/* Backlog: a Kanban of resources grouped by status. Drag to reorder or change status. */

const Backlog = {
  board: document.getElementById("bl-board"),
  search: document.getElementById("bl-search"),
  catFilter: document.getElementById("bl-category"),

  init() {
    this.search.addEventListener("input", () => this.render());
    this.catFilter.addEventListener("change", () => this.render());
    document.getElementById("bl-add").addEventListener("click", () => openResourceEditor(null));
    document.getElementById("bl-manage-cats").addEventListener("click", openCategoryManager);
  },

  matches(r) {
    const q = this.search.value.trim().toLowerCase();
    const cat = this.catFilter.value;
    if (cat && (r.categoryId || "") !== (cat === "__none" ? "" : cat)) return false;
    if (!q) return true;
    const catName = (Store.category(r.categoryId) || {}).name || "";
    return (r.title + " " + r.notes + " " + r.type + " " + (r.platform || "") + " " + catName).toLowerCase().includes(q);
  },

  render() {
    fillCategoryFilter(this.catFilter);
    this.board.innerHTML = "";
    const all = Store.resourceList();

    for (const st of STATUSES) {
      const items = all.filter((r) => r.status === st.id && this.matches(r));
      const totalMin = items.reduce((s, r) => s + Store.minutesFor(r.id), 0);
      const list = h("div", { class: "kanban-cards", "data-status": st.id });
      items.forEach((r) => list.append(this.card(r)));
      if (!items.length) list.append(h("div", { class: "empty" }, st.id === "backlog" && !all.length
        ? "Nothing here yet. Add a resource, or use Data ▸ Import backlog to paste your old spreadsheet."
        : "Drop resources here"));

      this.bindDrop(list, st.id);
      this.board.append(h("section", { class: "kanban-col" },
        h("header", { class: "kanban-head" },
          h("span", {}, st.label),
          h("span", { class: "muted small" }, items.length + (totalMin ? " · " + fmtHours(totalMin) : ""))),
        list));
    }
  },

  card(r) {
    const mins = Store.minutesFor(r.id);
    const cat = Store.category(r.categoryId);
    const pct = r.estHours ? Math.min(100, Math.round(mins / (r.estHours * 60) * 100)) : null;
    const overdue = r.plannedEnd && r.status !== "done" && r.plannedEnd < todayISO();
    const prio = { 1: "High", 2: "", 3: "Low" }[r.priority] || "";

    const node = h("article", { class: "res-card", draggable: "true", tabindex: "0", "data-id": r.id },
      h("div", { class: "res-top" },
        h("span", { class: "cat-tag" },
          h("span", { class: "swatch", style: { background: Store.categoryColor(r.categoryId) } }),
          cat ? cat.name : "Uncategorised"),
        prio ? h("span", { class: "prio prio-" + r.priority }, prio) : null),
      h("div", { class: "res-title" }, r.title),
      h("div", { class: "res-meta" },
        h("span", {}, r.platform && r.platform.toLowerCase() !== r.type.toLowerCase() ? r.type + " · " + r.platform : r.type),
        r.pages ? h("span", {}, r.pages + " p.") : null,
        mins ? h("span", {}, fmtMinutes(mins) + (r.estHours ? " / " + r.estHours + "h" : "")) : (r.estHours ? h("span", {}, "est. " + r.estHours + "h") : null),
        r.plannedEnd ? h("span", { class: overdue ? "overdue" : "" }, (overdue ? "⚠ due " : "due ") + fmtShortDate(r.plannedEnd)) : null,
        r.url ? h("a", { href: r.url, target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation(), title: r.url }, "link ↗") : null),
      pct != null ? h("div", { class: "progress", title: pct + "% of estimate" }, h("div", { style: { width: pct + "%" } })) : null);

    node.addEventListener("click", () => openResourceEditor(r.id));
    node.addEventListener("keydown", (e) => { if (e.key === "Enter") openResourceEditor(r.id); });
    node.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/resource-id", r.id);
      e.dataTransfer.effectAllowed = "move";
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => node.classList.remove("dragging"));
    return node;
  },

  bindDrop(list, status) {
    list.addEventListener("dragover", (e) => {
      if (!e.dataTransfer.types.includes("text/resource-id")) return;
      e.preventDefault();
      list.classList.add("drop-target");
    });
    list.addEventListener("dragleave", (e) => {
      if (!list.contains(e.relatedTarget)) list.classList.remove("drop-target");
    });
    list.addEventListener("drop", (e) => {
      e.preventDefault();
      list.classList.remove("drop-target");
      const id = e.dataTransfer.getData("text/resource-id");
      if (!id) return;

      // Find the card we dropped above, to keep a manual order within a column.
      const cards = $$(".res-card", list).filter((c) => c.dataset.id !== id);
      const after = cards.find((c) => {
        const box = c.getBoundingClientRect();
        return e.clientY < box.top + box.height / 2;
      });

      Store.commit((s) => {
        const r = s.resources[id];
        if (!r) return;
        if (r.status !== status && status === "done") r.doneAt = todayISO();
        r.status = status;
        const ordered = cards.map((c) => s.resources[c.dataset.id]);
        const idx = after ? ordered.indexOf(s.resources[after.dataset.id]) : ordered.length;
        ordered.splice(idx, 0, r);
        // Order only matters within a column, so re-number just this one.
        ordered.forEach((x, i) => { x.order = i + 1; });
      });
    });
  },
};

function fillCategoryFilter(select) {
  const prev = select.value;
  select.innerHTML = "";
  select.append(h("option", { value: "" }, "All categories"));
  for (const c of Store.state.categories) select.append(h("option", { value: c.id }, c.name));
  select.append(h("option", { value: "__none" }, "Uncategorised"));
  select.value = [...select.options].some((o) => o.value === prev) ? prev : "";
}
