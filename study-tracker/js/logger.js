"use strict";

/* Daily log: backlog sidebar + a week of days. Drop a resource on a day to log a session. */

const Logger = {
  weekStart: startOfWeek(todayISO()),
  listEl: document.getElementById("lg-resources"),
  weekEl: document.getElementById("lg-week"),
  search: document.getElementById("lg-search"),
  showDone: document.getElementById("lg-show-done"),

  init() {
    this.search.addEventListener("input", () => this.renderSidebar());
    this.showDone.addEventListener("change", () => this.renderSidebar());
    document.getElementById("lg-prev").addEventListener("click", () => { this.weekStart = addDays(this.weekStart, -7); this.renderWeek(); });
    document.getElementById("lg-next").addEventListener("click", () => { this.weekStart = addDays(this.weekStart, 7); this.renderWeek(); });
    document.getElementById("lg-today").addEventListener("click", () => { this.weekStart = startOfWeek(todayISO()); this.renderWeek(); });
  },

  render() {
    this.renderSidebar();
    this.renderWeek();
  },

  renderSidebar() {
    const q = this.search.value.trim().toLowerCase();
    // In-progress work first, then to-do, on hold, finished; board order within each kind.
    const kindRank = { doing: 0, todo: 1, hold: 2, done: 3 };
    const cols = Store.columns();
    const rank = (r) => { const c = Store.column(r.status); return kindRank[c.kind] * 100 + cols.indexOf(c); };
    const items = Store.resourceList()
      .filter((r) => this.showDone.checked || !Store.isDone(r))
      .filter((r) => !q || r.title.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || Store.priorityRank(a.priority) - Store.priorityRank(b.priority));

    this.listEl.innerHTML = "";
    if (!items.length) {
      this.listEl.append(h("p", { class: "muted small" }, Store.resourceList().length ? "No matches." : "Your backlog is empty. Add resources on the Backlog page."));
      return;
    }
    let lastCol = null;
    for (const r of items) {
      const col = Store.column(r.status);
      if (col !== lastCol) {
        lastCol = col;
        this.listEl.append(h("div", { class: "sidebar-group", style: { color: "var(--tok-" + col.color + ")" } }, col.label));
      }
      const mins = Store.minutesFor(r.id);
      const node = h("div", { class: "side-res", draggable: "true", tabindex: "0", title: "Drag onto a day, or click to log today" },
        h("span", { class: "swatch", style: { background: Store.categoryColor(r.categoryId) } }),
        h("span", { class: "side-title" }, r.title),
        mins ? h("span", { class: "muted small" }, fmtHours(mins)) : null);
      node.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/resource-id", r.id);
        e.dataTransfer.effectAllowed = "copy";
      });
      // Tap/click fallback (drag and drop does not work on touch screens).
      node.addEventListener("click", () => openLogEditor(null, { resourceId: r.id, date: todayISO() }));
      node.addEventListener("keydown", (e) => { if (e.key === "Enter") node.click(); });
      this.listEl.append(node);
    }
  },

  renderWeek() {
    const end = addDays(this.weekStart, 6);
    document.getElementById("lg-range").textContent = fmtShortDate(this.weekStart) + " – " + fmtDate(end);
    const goal = Number(Store.state.settings.dailyGoal) || 0;
    const byDay = {};
    for (const l of Store.logList()) {
      if (l.date >= this.weekStart && l.date <= end) (byDay[l.date] = byDay[l.date] || []).push(l);
    }
    const weekTotal = Object.values(byDay).flat().reduce((s, l) => s + l.minutes, 0);
    document.getElementById("lg-week-total").textContent = weekTotal ? "· " + fmtMinutes(weekTotal) + " this week" : "";

    this.weekEl.innerHTML = "";
    const today = todayISO();
    for (let i = 0; i < 7; i++) {
      const date = addDays(this.weekStart, i);
      const logs = (byDay[date] || []).sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
      const total = logs.reduce((s, l) => s + l.minutes, 0);
      const pct = goal ? Math.min(100, total / goal * 100) : 0;

      const body = h("div", { class: "day-body" });
      logs.forEach((l) => body.append(this.entry(l)));
      body.append(h("div", { class: "day-drop-hint" }, logs.length ? "+ drop to add" : "Drop a resource here"));

      const col = h("section", { class: "day" + (date === today ? " is-today" : "") + (date > today ? " is-future" : "") },
        h("header", { class: "day-head" },
          h("div", {}, h("strong", {}, WEEKDAYS[i]), " ", h("span", { class: "muted" }, fmtShortDate(date))),
          h("div", { class: "day-total" }, total ? fmtMinutes(total) : "—", goal ? h("span", { class: "muted" }, " / " + fmtMinutes(goal)) : null),
          goal ? h("div", { class: "goal-meter", title: Math.round(total / goal * 100) + "% of daily goal" },
            h("div", { class: total >= goal ? "met" : "", style: { width: pct + "%" } })) : null),
        body);
      this.bindDrop(col, date);
      this.weekEl.append(col);
    }
  },

  entry(l) {
    const r = Store.state.resources[l.resourceId];
    const node = h("div", { class: "log-entry", draggable: "true", tabindex: "0", style: { "--c": Store.categoryColor(r && r.categoryId) } },
      h("div", { class: "log-title" }, r ? r.title : "(deleted)"),
      h("div", { class: "log-meta" },
        h("strong", {}, fmtMinutes(l.minutes)),
        l.focus ? h("span", { title: "Focus " + l.focus + "/5" }, "●".repeat(l.focus) + "○".repeat(5 - l.focus)) : null),
      l.note ? h("div", { class: "log-note" }, l.note) : null);
    node.addEventListener("click", () => openLogEditor(l.id));
    node.addEventListener("keydown", (e) => { if (e.key === "Enter") openLogEditor(l.id); });
    node.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/log-id", l.id);
      e.dataTransfer.effectAllowed = "move";
      e.stopPropagation();
    });
    return node;
  },

  bindDrop(col, date) {
    const accepts = (e) => e.dataTransfer.types.includes("text/resource-id") || e.dataTransfer.types.includes("text/log-id");
    col.addEventListener("dragover", (e) => {
      if (!accepts(e)) return;
      e.preventDefault();
      col.classList.add("drop-target");
    });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop-target"); });
    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.classList.remove("drop-target");
      const logId = e.dataTransfer.getData("text/log-id");
      if (logId) {
        // Moving a session to another day; hold Ctrl/Alt to copy it instead.
        Store.commit((s) => {
          const l = s.logs[logId];
          if (!l) return;
          if (e.ctrlKey || e.altKey) Store.addLog(s, Object.assign({}, l, { id: uid(), date }));
          else l.date = date;
        });
        return;
      }
      const resId = e.dataTransfer.getData("text/resource-id");
      if (resId) openLogEditor(null, { resourceId: resId, date });
    });
  },
};
