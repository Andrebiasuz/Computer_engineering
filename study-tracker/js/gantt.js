"use strict";

/*
 * Gantt built from the study log.
 *   dashed outline  = planned start → planned end (from the resource)
 *   light fill      = actual span, first → last logged session
 *   solid ticks     = each study day; tick height = minutes that day
 */

const Gantt = {
  chart: document.getElementById("gt-chart"),
  legend: document.getElementById("gt-legend"),
  rangeSel: document.getElementById("gt-range"),
  zoomSel: document.getElementById("gt-zoom"),
  catSel: document.getElementById("gt-category"),
  showPlanned: document.getElementById("gt-show-planned"),
  hideDone: document.getElementById("gt-hide-done"),

  init() {
    [this.rangeSel, this.zoomSel, this.catSel, this.showPlanned, this.hideDone]
      .forEach((c) => c.addEventListener("change", () => this.render()));
  },

  rows() {
    const cat = this.catSel.value;
    const planned = this.showPlanned.checked;
    const out = [];
    for (const r of Store.resourceList()) {
      if (this.hideDone.checked && r.status === "done") continue;
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
        total: logs.reduce((s, l) => s + l.minutes, 0),
      });
    }
    // Group by category (in category order), then by when the work starts.
    const catIndex = (id) => { const i = Store.state.categories.findIndex((c) => c.id === id); return i < 0 ? 1e9 : i; };
    out.sort((a, b) => catIndex(a.r.categoryId) - catIndex(b.r.categoryId) || (a.first || a.ps).localeCompare(b.first || b.ps));
    return out;
  },

  render() {
    fillCategoryFilter(this.catSel);
    this.renderLegend();
    const rows = this.rows();
    this.chart.innerHTML = "";
    if (!rows.length) {
      this.chart.append(h("div", { class: "empty big" }, "Nothing to draw yet. Log a study session on the Daily log page (or give resources planned dates) and it shows up here."));
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
    const width = days * dw;
    const x = (iso) => daysBetween(start, iso) * dw;

    const scroller = h("div", { class: "gt-scroll" });
    const inner = h("div", { class: "gt-inner" });
    scroller.append(inner);

    // Header: months + days (or week starts when compact).
    const months = h("div", { class: "gt-track gt-months", style: { width: width + "px" } });
    const dayRow = h("div", { class: "gt-track gt-days", style: { width: width + "px" } });
    for (let i = 0; i < days; i++) {
      const iso = addDays(start, i), d = fromISO(iso);
      // Skip the first month label if its month is nearly over (it would be clipped).
      if (d.getDate() === 1 || (i === 0 && d.getDate() < 22)) {
        months.append(h("span", { class: "gt-month", style: { left: i * dw + "px" } }, MONTHS[d.getMonth()] + " " + d.getFullYear()));
      }
      const isMonday = d.getDay() === 1;
      if (dw >= 18 || isMonday) {
        dayRow.append(h("span", { class: "gt-day" + (iso === today ? " is-today" : "") + (d.getDay() % 6 === 0 ? " is-weekend" : ""),
          style: { left: i * dw + "px", width: (dw >= 18 ? dw : dw * 7) + "px" } }, String(d.getDate())));
      }
    }
    inner.append(h("div", { class: "gt-row gt-head" }, h("div", { class: "gt-label" }, ""), h("div", {}, months, dayRow)));

    const gridStyle = { width: width + "px", "--dw": dw + "px" };
    const maxDay = Math.max(1, ...rows.flatMap((row) => Object.values(row.byDay).map((v) => v.minutes)));
    let lastCat;

    for (const row of rows) {
      const r = row.r;
      if (r.categoryId !== lastCat) {
        lastCat = r.categoryId;
        const cat = Store.category(r.categoryId);
        inner.append(h("div", { class: "gt-row gt-group" },
          h("div", { class: "gt-label" }, h("span", { class: "swatch", style: { background: Store.categoryColor(r.categoryId) } }), cat ? cat.name : "Uncategorised"),
          h("div", { class: "gt-track", style: gridStyle })));
      }
      const color = Store.categoryColor(r.categoryId);
      const track = h("div", { class: "gt-track gt-grid", style: gridStyle });

      if (row.ps) {
        const bar = h("div", { class: "gt-plan", style: { left: x(row.ps) + "px", width: (daysBetween(row.ps, row.pe) + 1) * dw + "px", "--c": color } });
        bindTooltip(bar, () => this.tip(row));
        track.append(bar);
      }
      if (row.first) {
        const span = h("div", { class: "gt-span", style: { left: x(row.first) + "px", width: (daysBetween(row.first, row.last) + 1) * dw + "px", "--c": color } });
        bindTooltip(span, () => this.tip(row));
        track.append(span);
        for (const [date, v] of Object.entries(row.byDay)) {
          if (date < start) continue;
          const hgt = Math.max(4, Math.round(v.minutes / maxDay * 22));
          const tick = h("div", { class: "gt-tick", style: { left: x(date) + 1 + "px", width: Math.max(2, dw - 2) + "px", height: hgt + "px", "--c": color } });
          bindTooltip(tick, () => `<strong>${esc(r.title)}</strong><br>${fmtDate(date)} · ${fmtMinutes(v.minutes)}` +
            (v.notes.length ? `<div class="tip-note">${v.notes.map(esc).join("<br>")}</div>` : ""));
          track.append(tick);
        }
      }
      if (r.status === "done" && r.doneAt && r.doneAt >= start) {
        track.append(h("div", { class: "gt-done", style: { left: x(r.doneAt) + dw / 2 + "px" }, title: "Finished " + fmtDate(r.doneAt) }, "✓"));
      }
      const overdue = r.plannedEnd && r.status !== "done" && r.plannedEnd < today;
      const label = h("div", { class: "gt-label gt-res", title: "Edit " + r.title, tabindex: "0" },
        h("span", { class: "gt-res-title" }, r.title),
        h("span", { class: "muted small" + (overdue ? " overdue" : "") }, overdue ? "overdue" : (row.total ? fmtHours(row.total) : "")));
      label.addEventListener("click", () => openResourceEditor(r.id));
      inner.append(h("div", { class: "gt-row" }, label, track));
    }

    const todayLine = h("div", { class: "gt-today", title: "Today" });
    inner.append(todayLine);
    this.chart.append(scroller);
    // The label column is narrower on small screens, so measure it.
    const labelW = inner.querySelector(".gt-label").offsetWidth;
    todayLine.style.left = labelW + x(today) + dw / 2 + "px";

    // Start scrolled so today is visible with some history on screen.
    scroller.scrollLeft = Math.max(0, x(today) - scroller.clientWidth * 0.6);
  },

  tip(row) {
    const r = row.r;
    const parts = [`<strong>${esc(r.title)}</strong>`];
    if (row.ps) parts.push(`Planned: ${fmtShortDate(row.ps)} – ${fmtDate(row.pe)}`);
    if (row.first) parts.push(`Studied: ${fmtShortDate(row.first)} – ${fmtDate(row.last)}`);
    parts.push(`${fmtMinutes(row.total)} over ${Object.keys(row.byDay).length} day(s)` + (r.estHours ? ` · est. ${r.estHours}h` : ""));
    if (row.pe && row.last > row.pe) parts.push(`<span class="overdue">${daysBetween(row.pe, row.last)} day(s) past plan</span>`);
    return parts.join("<br>");
  },

  renderLegend() {
    this.legend.innerHTML = "";
    const used = new Set(Store.resourceList().map((r) => r.categoryId));
    for (const c of Store.state.categories.filter((c) => used.has(c.id))) {
      this.legend.append(h("span", { class: "legend-item" }, h("span", { class: "swatch", style: { background: Store.categoryColor(c.id) } }), c.name));
    }
    this.legend.append(
      h("span", { class: "legend-sep" }),
      h("span", { class: "legend-item" }, h("span", { class: "key-plan" }), "planned"),
      h("span", { class: "legend-item" }, h("span", { class: "key-span" }), "actual span"),
      h("span", { class: "legend-item" }, h("span", { class: "key-tick" }), "study day (taller = longer)"),
      h("span", { class: "legend-item" }, h("span", { class: "key-today" }), "today"));
  },
};
