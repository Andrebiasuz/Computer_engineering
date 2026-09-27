"use strict";

const Stats = {
  render() {
    this.tiles();
    this.daily();
    this.categories();
    this.heatmap();
    this.table();
  },

  /* ---------- KPI tiles ---------- */

  streaks() {
    const byDate = Store.minutesByDate();
    const today = todayISO();
    // Current streak may start yesterday: today isn't over yet.
    let d = byDate[today] ? today : addDays(today, -1), current = 0;
    while (byDate[d]) { current++; d = addDays(d, -1); }
    const dates = Object.keys(byDate).sort();
    let best = 0, run = 0, prev = null;
    for (const x of dates) {
      run = prev && daysBetween(prev, x) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = x;
    }
    return { current, best };
  },

  sumRange(from, to) {
    return Store.logList().filter((l) => l.date >= from && l.date <= to).reduce((s, l) => s + l.minutes, 0);
  },

  tiles() {
    const el = document.getElementById("st-tiles");
    const today = todayISO();
    const wk = startOfWeek(today);
    const thisWeek = this.sumRange(wk, today);
    const lastWeekSameDays = this.sumRange(addDays(wk, -7), addDays(today, -7));
    const total = Store.logList().reduce((s, l) => s + l.minutes, 0) + Store.extraMinutesTotal();
    const last30 = this.sumRange(addDays(today, -29), today);
    const studyDays30 = Object.entries(Store.minutesByDate()).filter(([d]) => d >= addDays(today, -29)).length;
    const { current, best } = this.streaks();
    const res = Store.resourceList();
    const done = res.filter((r) => Store.isDone(r)).length;
    const todayMin = this.sumRange(today, today);
    const goal = Number(Store.state.settings.dailyGoal) || 0;

    const delta = thisWeek - lastWeekSameDays;
    const tile = (label, value, sub, subClass) => h("div", { class: "tile" },
      h("div", { class: "tile-label" }, label),
      h("div", { class: "tile-value" }, value),
      sub ? h("div", { class: "tile-sub " + (subClass || "") }, sub) : null);

    el.innerHTML = "";
    el.append(
      tile("Today", fmtMinutes(todayMin), goal ? (todayMin >= goal ? "✓ daily goal met" : fmtMinutes(goal - todayMin) + " to goal") : null, todayMin >= goal && goal ? "good" : ""),
      tile("This week", fmtHours(thisWeek),
        lastWeekSameDays || thisWeek ? (delta >= 0 ? "▲ " : "▼ ") + fmtMinutes(Math.abs(delta)) + " vs same point last week" : null,
        delta > 0 ? "good" : delta < 0 ? "bad" : ""),
      tile("Streak", current + (current === 1 ? " day" : " days"), "best: " + best + " days"),
      tile("Last 30 days", fmtHours(last30), studyDays30 + " study days · avg " + fmtMinutes(studyDays30 ? last30 / studyDays30 : 0) + "/day"),
      tile("All time", fmtHours(total), Store.resourceList().reduce((s, r) => s + Store.sessionsFor(r.id), 0) + " sessions"),
      tile("Finished", done + " / " + res.length, "resources"));
  },

  /* ---------- minutes per day, last 30 days ---------- */

  daily() {
    const el = document.getElementById("st-daily");
    const byDate = Store.minutesByDate();
    const today = todayISO();
    const N = 30;
    const data = Array.from({ length: N }, (_, i) => { const d = addDays(today, i - N + 1); return { d, m: byDate[d] || 0 }; });
    const goal = Number(Store.state.settings.dailyGoal) || 0;

    const W = Math.max(320, el.clientWidth || 800), H = 220;
    const m = { l: 48, r: 8, t: 10, b: 24 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const rawMax = Math.max(goal, ...data.map((x) => x.m), 30);
    const step = rawMax <= 60 ? 15 : rawMax <= 180 ? 30 : rawMax <= 360 ? 60 : 120;
    const yMax = Math.ceil(rawMax / step) * step;
    const y = (v) => m.t + ih - v / yMax * ih;
    const bw = iw / N;
    const barW = Math.max(3, Math.min(24, bw - 2)); // 2px gap between neighbours

    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "chart");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Minutes studied per day for the last 30 days");
    const add = (tag, attrs, text) => {
      const n = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
      if (text != null) n.textContent = text;
      svg.append(n);
      return n;
    };

    for (let v = 0; v <= yMax; v += step) {
      add("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: v ? "grid" : "axis" });
      add("text", { x: m.l - 6, y: y(v) + 4, "text-anchor": "end", class: "tick" }, fmtMinutes(v));
    }
    data.forEach((p, i) => {
      const cx = m.l + i * bw + bw / 2;
      if (p.m) {
        const top = y(p.m), bh = Math.max(1, m.t + ih - top), rr = Math.min(4, barW / 2, bh);
        // Rounded data end, square at the baseline.
        add("path", {
          class: "bar",
          d: `M${cx - barW / 2},${m.t + ih} V${top + rr} Q${cx - barW / 2},${top} ${cx - barW / 2 + rr},${top} H${cx + barW / 2 - rr} Q${cx + barW / 2},${top} ${cx + barW / 2},${top + rr} V${m.t + ih} Z`,
        });
      }
      if (i % 7 === (N - 1) % 7) add("text", { x: cx, y: H - 6, "text-anchor": "middle", class: "tick" }, fmtShortDate(p.d));
      const hit = add("rect", { x: m.l + i * bw, y: m.t, width: bw, height: ih, class: "hit" });
      hit.addEventListener("mousemove", (e) => {
        const logs = Store.logList().filter((l) => l.date === p.d);
        showTooltip(e, `<strong>${fmtDate(p.d)}</strong><br>${fmtMinutes(p.m)}` + (goal ? ` of ${fmtMinutes(goal)} goal` : "") +
          logs.map((l) => `<br><span class="muted">${esc((Store.state.resources[l.resourceId] || {}).title || "?")} · ${fmtMinutes(l.minutes)}</span>`).join(""));
      });
      hit.addEventListener("mouseleave", hideTooltip);
    });
    if (goal) add("line", { x1: m.l, x2: W - m.r, y1: y(goal), y2: y(goal), class: "goal-line" });
    el.innerHTML = "";
    el.append(svg);
  },

  /* ---------- hours by category ---------- */

  categories() {
    const el = document.getElementById("st-cats");
    const totals = {};
    for (const l of Store.logList()) {
      const r = Store.state.resources[l.resourceId];
      const key = (r && r.categoryId) || "";
      totals[key] = (totals[key] || 0) + l.minutes;
    }
    for (const r of Store.resourceList()) {
      if (r.extraMinutes) totals[r.categoryId || ""] = (totals[r.categoryId || ""] || 0) + r.extraMinutes;
    }
    const rows = Object.entries(totals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    el.innerHTML = "";
    if (!rows.length) { el.append(h("p", { class: "muted" }, "No sessions logged yet.")); return; }
    const max = rows[0][1];
    const sum = rows.reduce((s, [, v]) => s + v, 0);
    for (const [catId, mins] of rows) {
      const c = Store.category(catId);
      const bar = h("div", { class: "hbar-fill", style: { width: Math.max(1, mins / max * 100) + "%", background: Store.categoryColor(catId || null) } });
      const row = h("div", { class: "hbar" },
        h("span", { class: "hbar-label" }, c ? c.name : "Uncategorised"),
        h("div", { class: "hbar-track" }, bar),
        h("span", { class: "hbar-value" }, fmtHours(mins)));
      bindTooltip(row, () => `<strong>${esc(c ? c.name : "Uncategorised")}</strong><br>${fmtMinutes(mins)} · ${Math.round(mins / sum * 100)}% of all study time`);
      el.append(row);
    }
  },

  /* ---------- consistency heatmap ---------- */

  heatmap() {
    const el = document.getElementById("st-heatmap");
    const byDate = Store.minutesByDate();
    const goal = Number(Store.state.settings.dailyGoal) || 60;
    const today = todayISO();
    const start = addDays(startOfWeek(today), -25 * 7);
    const level = (m) => (!m ? 0 : m < goal * 0.25 ? 1 : m < goal * 0.5 ? 2 : m < goal ? 3 : 4);

    const grid = h("div", { class: "heat" });
    for (let w = 0; w < 26; w++) {
      const col = h("div", { class: "heat-col" });
      for (let d = 0; d < 7; d++) {
        const iso = addDays(start, w * 7 + d);
        if (iso > today) { col.append(h("div", { class: "heat-cell future" })); continue; }
        const m = byDate[iso] || 0;
        const cell = h("div", { class: "heat-cell l" + level(m) });
        bindTooltip(cell, () => `<strong>${WEEKDAYS[d]} ${fmtDate(iso)}</strong><br>${m ? fmtMinutes(m) : "no study"}`);
        col.append(cell);
      }
      grid.append(col);
    }
    el.innerHTML = "";
    el.append(grid, h("div", { class: "heat-legend" }, "none",
      [0, 1, 2, 3, 4].map((i) => h("span", { class: "heat-cell l" + i })), "≥ goal"));
  },

  /* ---------- per-resource table ---------- */

  projectFinish(r, mins) {
    if (Store.isDone(r) || !r.estHours) return "";
    const remaining = r.estHours * 60 - mins;
    if (remaining <= 0) return "over estimate";
    const today = todayISO();
    const recent = Store.logsFor(r.id).filter((l) => l.date > addDays(today, -28)).reduce((s, l) => s + l.minutes, 0);
    if (!recent) return "—";
    const perDay = recent / 28;
    return fmtDate(addDays(today, Math.ceil(remaining / perDay)));
  },

  table() {
    const el = document.getElementById("st-table");
    const rows = Store.resourceList().map((r) => {
      const logs = Store.logsFor(r.id);
      const mins = Store.minutesFor(r.id);
      const focus = logs.filter((l) => l.focus);
      return { r, logs, mins, avgFocus: focus.length ? focus.reduce((s, l) => s + l.focus, 0) / focus.length : null };
    }).filter((x) => x.mins || x.logs.length || x.r.estHours || Store.kindOf(x.r.status) !== "todo")
      .sort((a, b) => b.mins - a.mins);

    el.innerHTML = "";
    el.append(h("thead", {}, h("tr", {},
      ["Resource", "Category", "Status", "Est.", "Actual", "Progress", "Sessions", "Avg focus", "Last studied", "Projected finish"].map((t) => h("th", {}, t)))));
    const body = h("tbody");
    if (!rows.length) body.append(h("tr", {}, h("td", { colspan: 10, class: "muted" }, "Log some study sessions to see this table fill up.")));
    for (const { r, logs, mins, avgFocus } of rows) {
      const cat = Store.category(r.categoryId);
      const pct = r.estHours ? Math.round(mins / (r.estHours * 60) * 100) : null;
      const tr = h("tr", { class: "clickable", onclick: () => openResourceEditor(r.id) },
        h("td", {}, r.title),
        h("td", {}, h("span", { class: "swatch", style: { background: Store.categoryColor(r.categoryId) } }), " ", cat ? cat.name : "—"),
        h("td", { style: { color: "var(--tok-" + Store.column(r.status).color + ")" } }, Store.column(r.status).label),
        h("td", { class: "num" }, r.estHours ? r.estHours + "h" : "—"),
        h("td", { class: "num" }, fmtMinutes(mins)),
        h("td", { class: "num" }, pct == null ? "—" : pct + "%"),
        h("td", { class: "num" }, Store.sessionsFor(r.id)),
        h("td", { class: "num" }, avgFocus == null ? "—" : avgFocus.toFixed(1)),
        h("td", {}, logs.length ? fmtDate(logs[logs.length - 1].date) : "—"),
        h("td", {}, this.projectFinish(r, mins)));
      body.append(tr);
    }
    el.append(body);
  },
};
