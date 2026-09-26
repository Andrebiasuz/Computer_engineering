"use strict";

/* Backlog: a Kanban of resources grouped by status. Drag to reorder or change status. */

const Backlog = {
  board: document.getElementById("bl-board"),
  search: document.getElementById("bl-search"),
  catFilter: document.getElementById("bl-category"),
  selecting: false,
  selected: new Set(),
  lastClicked: null,

  init() {
    this.search.addEventListener("input", () => this.render());
    this.catFilter.addEventListener("change", () => this.render());
    document.getElementById("bl-add").addEventListener("click", () => openResourceEditor(null));
    document.getElementById("bl-manage-cats").addEventListener("click", openCategoryManager);
    document.getElementById("bl-board-settings").addEventListener("click", openBoardSettings);
    this.initBulk();
  },

  /* ---------- multi-select + bulk actions ---------- */

  initBulk() {
    const $id = (id) => document.getElementById(id);
    $id("bl-select").addEventListener("click", () => this.setSelecting(!this.selecting));
    $id("bl-bulk-done").addEventListener("click", () => this.setSelecting(false));
    $id("bl-bulk-none").addEventListener("click", () => { this.selected.clear(); this.render(); });
    $id("bl-bulk-all").addEventListener("click", () => {
      Store.resourceList().filter((r) => this.matches(r)).forEach((r) => this.selected.add(r.id));
      this.render();
    });
    $id("bl-bulk-delete").addEventListener("click", () => this.deleteSelected());

    const status = $id("bl-bulk-status");
    status.addEventListener("change", () => {
      const v = status.value;
      status.value = "";
      if (!v) return;
      this.applyToSelected((r) => Store.setStatus(r, v), "Moved");
    });
    const cat = $id("bl-bulk-category");
    cat.addEventListener("change", () => {
      const v = cat.value;
      cat.value = "";
      if (!v) return;
      this.applyToSelected((r) => { r.categoryId = v === "__none" ? null : v; }, "Re-categorised");
    });
    const prio = $id("bl-bulk-priority");
    prio.addEventListener("change", () => {
      const v = Number(prio.value);
      prio.value = "";
      if (v) this.applyToSelected((r) => { r.priority = v; }, "Re-prioritised");
    });

    document.addEventListener("keydown", (e) => {
      if (App.page !== "backlog" || !this.selecting || !Modal.overlay.hidden) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "Escape") this.setSelecting(false);
      else if (!typing && (e.key === "Delete" || e.key === "Backspace") && this.selected.size) { e.preventDefault(); this.deleteSelected(); }
      else if (!typing && e.key.toLowerCase() === "a" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $id("bl-bulk-all").click(); }
    });
  },

  setSelecting(on) {
    this.selecting = on;
    if (!on) this.selected.clear();
    this.lastClicked = null;
    this.render();
  },

  toggleSelect(id, e) {
    // Shift+click selects the range between the last clicked card and this one.
    if (e.shiftKey && this.lastClicked) {
      const ids = $$(".res-card", this.board).map((c) => c.dataset.id);
      const a = ids.indexOf(this.lastClicked), b = ids.indexOf(id);
      if (a >= 0 && b >= 0) {
        ids.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((x) => this.selected.add(x));
        this.lastClicked = id;
        this.render();
        return;
      }
    }
    if (this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.lastClicked = id;
    this.render();
  },

  renderBulkBar() {
    const bar = document.getElementById("bl-bulk");
    bar.hidden = !this.selecting;
    document.getElementById("bl-select").classList.toggle("active", this.selecting);
    this.board.classList.toggle("selecting", this.selecting);
    if (!this.selecting) return;
    const n = this.selected.size;
    document.getElementById("bl-bulk-count").textContent = n + " selected";
    for (const id of ["bl-bulk-status", "bl-bulk-category", "bl-bulk-priority", "bl-bulk-delete"]) document.getElementById(id).disabled = !n;

    const status = document.getElementById("bl-bulk-status");
    status.innerHTML = "";
    status.append(h("option", { value: "" }, "Move to…"), Store.columns().map((s) => h("option", { value: s.id }, s.label)));
    const prio = document.getElementById("bl-bulk-priority");
    prio.innerHTML = "";
    prio.append(h("option", { value: "" }, "Set priority…"), Store.priorities().map((p) => h("option", { value: p.id }, p.label)));
    const cat = document.getElementById("bl-bulk-category");
    cat.innerHTML = "";
    cat.append(h("option", { value: "" }, "Set category…"),
      Store.state.categories.map((c) => h("option", { value: c.id }, c.name)),
      h("option", { value: "__none" }, "Uncategorised"));
  },

  applyToSelected(fn, verb) {
    const ids = [...this.selected];
    Store.commit((s) => ids.forEach((id) => { if (s.resources[id]) fn(s.resources[id]); }));
    toast(`${verb} ${ids.length} resource${ids.length === 1 ? "" : "s"}.`);
  },

  deleteSelected() {
    const ids = new Set(this.selected);
    if (!ids.size) return;
    const logs = Store.logList().filter((l) => ids.has(l.resourceId));
    const msg = `Delete ${ids.size} resource${ids.size === 1 ? "" : "s"}` +
      (logs.length ? ` and their ${logs.length} logged session${logs.length === 1 ? "" : "s"}?` : "?");
    if (!confirm(msg)) return;

    // Keep copies so the deletion can be undone from the toast.
    const backup = { resources: [...ids].map((id) => JSON.parse(JSON.stringify(Store.state.resources[id]))), logs: JSON.parse(JSON.stringify(logs)) };
    Store.commit((s) => {
      ids.forEach((id) => delete s.resources[id]);
      logs.forEach((l) => delete s.logs[l.id]);
    });
    this.selected.clear();
    this.render();
    toast(`Deleted ${backup.resources.length} resource${backup.resources.length === 1 ? "" : "s"}.`, {
      action: "Undo",
      onAction: () => {
        Store.commit((s) => {
          backup.resources.forEach((r) => { s.resources[r.id] = r; });
          backup.logs.forEach((l) => { s.logs[l.id] = l; });
        });
        toast("Restored.");
      },
    });
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
    // Forget selections for cards that no longer exist.
    for (const id of this.selected) if (!Store.state.resources[id]) this.selected.delete(id);
    this.renderBulkBar();
    this.board.innerHTML = "";
    const all = Store.resourceList();

    const cols = Store.columns();
    for (const st of cols) {
      const items = all.filter((r) => Store.column(r.status).id === st.id && this.matches(r));
      const totalMin = items.reduce((s, r) => s + Store.minutesFor(r.id), 0);
      const list = h("div", { class: "kanban-cards", "data-status": st.id });
      const allSel = items.length && items.every((r) => this.selected.has(r.id));
      const colCheck = this.selecting && items.length ? h("input", { type: "checkbox", class: "col-check", title: "Select all in " + st.label, checked: allSel,
        onclick: (e) => { e.stopPropagation(); items.forEach((r) => (allSel ? this.selected.delete(r.id) : this.selected.add(r.id))); this.render(); } }) : null;
      items.forEach((r) => list.append(this.card(r)));
      if (!items.length) list.append(h("div", { class: "empty" }, st === cols[0] && !all.length
        ? "Nothing here yet. Add a resource, or use Data ▸ Import backlog to paste your old spreadsheet."
        : "Drop resources here"));

      this.bindDrop(list, st.id);
      this.board.append(h("section", { class: "kanban-col", style: { "--st": "var(--tok-" + st.color + ")" } },
        h("header", { class: "kanban-head" },
          h("span", { class: "kanban-title" }, colCheck, h("span", { class: "status-dot" }), st.label),
          h("span", { class: "muted small" }, items.length + (totalMin ? " · " + fmtHours(totalMin) : ""))),
        list));
    }
  },

  card(r) {
    const mins = Store.minutesFor(r.id);
    const cat = Store.category(r.categoryId);
    const pct = r.estHours ? Math.min(100, Math.round(mins / (r.estHours * 60) * 100)) : null;
    const overdue = r.plannedEnd && !Store.isDone(r) && r.plannedEnd < todayISO();
    const prio = Store.priority(r.priority);
    const sel = this.selected.has(r.id);
    const showPlatform = r.platform && r.platform.toLowerCase() !== r.type.toLowerCase();

    const node = h("article", { class: "res-card" + (sel ? " is-selected" : ""), draggable: "true", tabindex: "0", "data-id": r.id,
      style: { "--c": Store.categoryColor(r.categoryId) } },
      h("div", { class: "res-top" },
        this.selecting ? h("input", { type: "checkbox", class: "card-check", checked: sel, tabindex: "-1", "aria-label": "Select " + r.title }) : null,
        h("span", { class: "cat-tag" }, cat ? cat.name : "uncategorised"),
        h("span", { class: "prio", style: { "--pc": "var(--tok-" + prio.color + ")" } }, prio.label)),
      h("div", { class: "res-title" }, r.title),
      h("div", { class: "res-meta" },
        h("span", { class: "tok-type" }, r.type),
        showPlatform ? h("span", { class: "tok-str" }, r.platform) : null,
        r.pages ? h("span", { class: "tok-num" }, r.pages + "p") : null,
        mins ? h("span", { class: "tok-num" }, fmtMinutes(mins) + (r.estHours ? " / " + r.estHours + "h" : ""))
          : (r.estHours ? h("span", { class: "tok-num" }, "~" + r.estHours + "h") : null),
        r.plannedEnd ? h("span", { class: overdue ? "overdue" : "tok-const" }, (overdue ? "⚠ due " : "due ") + fmtShortDate(r.plannedEnd)) : null,
        r.url ? h("a", { class: "tok-fn", href: r.url, target: "_blank", rel: "noopener", onclick: (e) => e.stopPropagation(), title: r.url }, "link ↗") : null),
      pct != null ? h("div", { class: "progress", title: pct + "% of estimate" }, h("div", { style: { width: pct + "%" } })) : null);

    node.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      if (this.selecting || e.ctrlKey || e.metaKey) {
        if (!this.selecting) this.selecting = true;
        this.toggleSelect(r.id, e);
        return;
      }
      openResourceEditor(r.id);
    });
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openResourceEditor(r.id);
      else if (e.key === " " && this.selecting) { e.preventDefault(); this.toggleSelect(r.id, e); }
    });
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
      // Dragging one of several selected cards moves the whole selection.
      if (this.selected.size > 1 && this.selected.has(id)) {
        this.applyToSelected((r) => Store.setStatus(r, status), "Moved");
        return;
      }

      // Find the card we dropped above, to keep a manual order within a column.
      const cards = $$(".res-card", list).filter((c) => c.dataset.id !== id);
      const after = cards.find((c) => {
        const box = c.getBoundingClientRect();
        return e.clientY < box.top + box.height / 2;
      });

      Store.commit((s) => {
        const r = s.resources[id];
        if (!r) return;
        if (Store.column(r.status).id !== status) Store.setStatus(r, status);
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
