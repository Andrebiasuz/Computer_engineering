"use strict";

/*
 * Gantt built from the work log.
 *   dashed outline  = planned start → planned end (from the resource)
 *   light fill      = actual span, first → last logged session
 *   solid ticks     = each work day; tick height = minutes that day
 */

const Gantt = {
  chart: document.getElementById("gt-chart"),
  legend: document.getElementById("gt-legend"),
  rangeSel: document.getElementById("gt-range"),
  zoomSel: document.getElementById("gt-zoom"),
  catSel: document.getElementById("gt-category"),
  sortSel: document.getElementById("gt-sort"),
  showPlanned: document.getElementById("gt-show-planned"),
  hideDone: document.getElementById("gt-hide-done"),
  showWeekends: document.getElementById("gt-weekends"),
  showArchived: document.getElementById("gt-archived"),
  VIEW_KEY: "work-tracker-gantt-view",

  init() {
    [this.rangeSel, this.zoomSel, this.catSel, this.showPlanned, this.hideDone]
      .forEach((c) => c.addEventListener("change", () => this.render()));
    try { this.sortSel.value = localStorage.getItem("work-tracker-gantt-sort") || "category"; } catch (e) { /* ignore */ }
    if (!this.sortSel.value) this.sortSel.value = "category";
    // Weekends / archived toggles are remembered.
    try {
      const v = JSON.parse(localStorage.getItem(this.VIEW_KEY)) || {};
      if (typeof v.weekends === "boolean") this.showWeekends.checked = v.weekends;
      if (typeof v.archived === "boolean") this.showArchived.checked = v.archived;
    } catch (e) { /* ignore */ }
    [this.showWeekends, this.showArchived].forEach((c) => c.addEventListener("change", () => {
      try { localStorage.setItem(this.VIEW_KEY, JSON.stringify({ weekends: this.showWeekends.checked, archived: this.showArchived.checked })); } catch (e) { /* ignore */ }
      this.render();
    }));
    this.sortSel.addEventListener("change", () => {
      try { localStorage.setItem("work-tracker-gantt-sort", this.sortSel.value); } catch (e) { /* ignore */ }
      this.render();
    });
  },

  byPlatform() { return this.sortSel.value === "platform"; },

  // Group key and header for a row: its category, or its platform when sorting by platform.
  groupOf(r) {
    if (!this.byPlatform()) {
      const cat = Store.category(r.categoryId);
      return { key: "c:" + (r.categoryId || ""), label: cat ? cat.name : "Uncategorised", color: Store.categoryColor(r.categoryId) };
    }
    const p = (r.platform || "").trim();
    return { key: "p:" + p.toLowerCase(), label: p || "No platform", color: null };
  },

  rows() {
    const cat = this.catSel.value;
    const planned = this.showPlanned.checked;
    const out = [];
    // Archived tasks only appear when "archived" is ticked ("hide finished" doesn't apply to them).
    for (const r of Store.resourceList(this.showArchived.checked)) {
      if (this.hideDone.checked && Store.isDone(r) && !r.archived) continue;
      if (cat && (r.categoryId || "") !== (cat === "__none" ? "" : cat)) continue;
      const logs = Store.logsFor(r.id);
      const byDay = {};
      logs.forEach((l) => { byDay[l.date] = byDay[l.date] || { minutes: 0, notes: [] }; byDay[l.date].minutes += l.minutes; if (l.note) byDay[l.date].notes.push(l.note); });
      let ps = planned ? r.plannedStart : "", pe = planned ? r.plannedEnd : "";
      if (ps && !pe) pe = ps;
      if (pe && !ps) ps = logs.length ? logs[0].date : pe;
      if (ps > pe) [ps, pe] = [pe, ps];
      if (!logs.length && !ps) continue;
      out.push({
        r, byDay, logs, ps, pe,
        first: logs.length ? logs[0].date : "",
        last: logs.length ? logs[logs.length - 1].date : "",
        total: Store.minutesFor(r.id),
      });
    }
    // Group by category (in category order), then by when the work starts.
    // Sorting by platform groups by platform A→Z (none last), then category, then start.
    const catIndex = (id) => { const i = Store.state.categories.findIndex((c) => c.id === id); return i < 0 ? 1e9 : i; };
    const byStart = (a, b) => (a.first || a.ps).localeCompare(b.first || b.ps);
    const byCat = (a, b) => catIndex(a.r.categoryId) - catIndex(b.r.categoryId);
    if (this.byPlatform()) {
      const plat = (r) => (r.platform || "").trim();
      out.sort((a, b) => {
        const pa = plat(a.r), pb = plat(b.r);
        if (!pa !== !pb) return pa ? -1 : 1;
        return pa.localeCompare(pb, undefined, { sensitivity: "base" }) || byCat(a, b) || byStart(a, b);
      });
    } else {
      out.sort((a, b) => byCat(a, b) || byStart(a, b));
    }
    return out;
  },

  render() {
    fillCategoryFilter(this.catSel);
    this.renderLegend();
    const rows = this.rows();
    this.chart.innerHTML = "";
    if (!rows.length) {
      this.chart.append(h("div", { class: "empty big" }, "Nothing to draw yet. Log a work session on the Daily log page (or give items planned dates) and it shows up here."));
      return;
    }

    const today = todayISO();
    let min = today, max = today;
    for (const row of rows) {
      for (const d of [row.first, row.last, row.ps, row.pe, row.r.doneAt]) {
        if (!d) continue;
        if (d < min) min = d;
        if (d > max) max = d;
      }
    }
    const range = this.rangeSel.value;
    let start = addDays(min, -2);
    if (range !== "all") {
      const floor = addDays(today, -Number(range));
      if (start < floor) start = floor;
    }
    start = startOfWeek(start);
    const end = addDays(max > today ? max : today, 7);
    const days = daysBetween(start, end) + 1;
    const dw = Number(this.zoomSel.value);
    // With weekends hidden, Saturday and Sunday take no columns. `start` is a
    // Monday, so each whole week is 5 columns, and a weekend date sits on the
    // boundary before the next Monday.
    const weekends = this.showWeekends.checked;
    const isWeekend = (iso) => { const g = fromISO(iso).getDay(); return g === 0 || g === 6; };
    const shown = (iso) => weekends || !isWeekend(iso);
    const col = (iso) => {
      const n = daysBetween(start, iso);
      if (weekends) return n;
      const w = Math.floor(n / 7);
      return w * 5 + Math.min(n - w * 7, 5);
    };
    const x = (iso) => col(iso) * dw;                          // left edge of a day
    const xEnd = (iso) => (col(iso) + (shown(iso) ? 1 : 0)) * dw; // right edge (boundary if hidden)
    const xMid = (iso) => (shown(iso) ? x(iso) + dw / 2 : x(iso));
    const width = xEnd(end);

    const scroller = h("div", { class: "gt-scroll" });
    const inner = h("div", { class: "gt-inner" });
    scroller.append(inner);

    // Header: months + days (or week starts when compact).
    const months = h("div", { class: "gt-track gt-months", style: { width: width + "px" } });
    const dayRow = h("div", { class: "gt-track gt-days", style: { width: width + "px" } });
    let lastMonth = -1;
    for (let i = 0; i < days; i++) {
      const iso = addDays(start, i), d = fromISO(iso);
      if (!shown(iso)) continue;
      // Label each month at its first visible day; skip the first label if
      // that month is nearly over (it would be clipped).
      if (d.getMonth() !== lastMonth) {
        lastMonth = d.getMonth();
        if (i > 0 || d.getDate() < 22) {
          months.append(h("span", { class: "gt-month", style: { left: x(iso) + "px" } }, MONTHS[d.getMonth()] + " " + d.getFullYear()));
        }
      }
      const isMonday = d.getDay() === 1;
      if (dw >= 18 || isMonday) {
        dayRow.append(h("span", { class: "gt-day" + (iso === today ? " is-today" : "") + (d.getDay() % 6 === 0 ? " is-weekend" : ""),
          style: { left: x(iso) + "px", width: (dw >= 18 ? dw : dw * (weekends ? 7 : 5)) + "px" } }, String(d.getDate())));
      }
    }
    inner.append(h("div", { class: "gt-row gt-head" }, h("div", { class: "gt-label" }, ""), h("div", {}, months, dayRow)));

    const gridStyle = { width: width + "px", "--dw": dw + "px", "--wk": weekends ? 7 : 5 };
    const maxDay = Math.max(1, ...rows.flatMap((row) => Object.values(row.byDay).map((v) => v.minutes)));
    let lastGroup;

    for (const row of rows) {
      const r = row.r;
      const g = this.groupOf(r);
      if (g.key !== lastGroup) {
        lastGroup = g.key;
        inner.append(h("div", { class: "gt-row gt-group" },
          h("div", { class: "gt-label" }, g.color ? h("span", { class: "swatch", style: { background: g.color } }) : h("span", { class: "tok-str" }, "▸"), g.label),
          h("div", { class: "gt-track", style: gridStyle })));
      }
      const color = Store.categoryColor(r.categoryId);
      const track = h("div", { class: "gt-track gt-grid", style: gridStyle });

      if (row.ps) {
        const bar = h("div", { class: "gt-plan", style: { left: x(row.ps) + "px", width: Math.max(3, xEnd(row.pe) - x(row.ps)) + "px", "--c": color } });
        bindTooltip(bar, () => this.tip(row));
        track.append(bar);
      }
      if (row.first) {
        const span = h("div", { class: "gt-span", style: { left: x(row.first) + "px", width: Math.max(3, xEnd(row.last) - x(row.first)) + "px", "--c": color } });
        bindTooltip(span, () => this.tip(row));
        track.append(span);
        for (const [date, v] of Object.entries(row.byDay)) {
          if (date < start) continue;
          const hgt = Math.max(4, Math.round(v.minutes / maxDay * 22));
          // Weekend work with weekends hidden: a thin mark between Friday and Monday.
          const tick = shown(date)
            ? h("div", { class: "gt-tick", style: { left: x(date) + 1 + "px", width: Math.max(2, dw - 2) + "px", height: hgt + "px", "--c": color } })
            : h("div", { class: "gt-tick is-weekend-work", style: { left: x(date) - 1 + "px", width: "3px", height: hgt + "px", "--c": color } });
          bindTooltip(tick, () => `<strong>${esc(r.title)}</strong><br>${fmtDate(date)} · ${fmtMinutes(v.minutes)}` +
            (v.notes.length ? `<div class="tip-note">${v.notes.map(esc).join("<br>")}</div>` : ""));
          track.append(tick);
        }
      }
      if (Store.isDone(r) && r.doneAt && r.doneAt >= start) {
        track.append(h("div", { class: "gt-done", style: { left: xMid(r.doneAt) + "px" }, title: "Finished " + fmtDate(r.doneAt) }, "✓"));
      }
      const overdue = r.plannedEnd && !Store.isDone(r) && r.plannedEnd < today;
      const label = h("div", { class: "gt-label gt-res" + (r.archived ? " is-archived" : ""), title: (r.archived ? "Archived · " : "Edit ") + r.title, tabindex: "0" },
        h("span", { class: "gt-res-title" }, r.archived ? h("span", { class: "gt-archived-tag" }, "archived") : null, r.title),
        h("span", { class: "muted small" + (overdue ? " overdue" : "") }, overdue ? "overdue" : (row.total ? fmtHours(row.total) : "")));
      label.addEventListener("click", () => openResourceEditor(r.id));
      inner.append(h("div", { class: "gt-row" }, label, track));
    }

    const todayLine = h("div", { class: "gt-today", title: "Today" });
    inner.append(todayLine);
    this.chart.append(scroller);
    // The label column is narrower on small screens, so measure it.
    const labelW = inner.querySelector(".gt-label").offsetWidth;
    todayLine.style.left = labelW + xMid(today) + "px";

    // Start scrolled so today is visible with some history on screen.
    scroller.scrollLeft = Math.max(0, x(today) - scroller.clientWidth * 0.6);
  },

  tip(row) {
    const r = row.r;
    const parts = [`<strong>${esc(r.title)}</strong>`];
    if (row.ps) parts.push(`Planned: ${fmtShortDate(row.ps)} – ${fmtDate(row.pe)}`);
    if (row.first) parts.push(`Worked: ${fmtShortDate(row.first)} – ${fmtDate(row.last)}`);
    parts.push(`${fmtMinutes(row.total)} over ${Object.keys(row.byDay).length} day(s)` + (r.estHours ? ` · est. ${r.estHours}h` : ""));
    if (row.pe && row.last > row.pe) parts.push(`<span class="overdue">${daysBetween(row.pe, row.last)} day(s) past plan</span>`);
    return parts.join("<br>");
  },

  renderLegend() {
    this.legend.innerHTML = "";
    const used = new Set(Store.resourceList(this.showArchived.checked).map((r) => r.categoryId));
    for (const c of Store.state.categories.filter((c) => used.has(c.id))) {
      this.legend.append(h("span", { class: "legend-item" }, h("span", { class: "swatch", style: { background: Store.categoryColor(c.id) } }), c.name));
    }
    this.legend.append(
      h("span", { class: "legend-sep" }),
      h("span", { class: "legend-item" }, h("span", { class: "key-plan" }), "planned"),
      h("span", { class: "legend-item" }, h("span", { class: "key-span" }), "actual span"),
      h("span", { class: "legend-item" }, h("span", { class: "key-tick" }), "work day (taller = longer)"),
      h("span", { class: "legend-item" }, h("span", { class: "key-today" }), "today"));
  },
};
