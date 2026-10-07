"use strict";

const PAGES = ["backlog", "logger", "gantt", "stats", "archive", "reports"];

const App = {
  page: "backlog",

  async init() {
    await Store.load();

    Backlog.init();
    Logger.init();
    Gantt.init();
    Timer.init();
    Archive.init();
    Reports.init();

    document.getElementById("bulk-import-btn").addEventListener("click", () => { this.closeMenu(); openImporter(); });
    document.getElementById("export-json-btn").addEventListener("click", () => { this.closeMenu(); exportJSON(); });
    document.getElementById("convert-hours-btn").addEventListener("click", () => { this.closeMenu(); openConvertHours(); });
    document.getElementById("export-csv-btn").addEventListener("click", () => { this.closeMenu(); exportLogCSV(); });
    document.getElementById("import-json-input").addEventListener("change", (e) => {
      this.closeMenu();
      if (e.target.files[0]) importJSON(e.target.files[0]);
      e.target.value = "";
    });

    const goal = document.getElementById("goal-input");
    goal.addEventListener("change", () => Store.commit((s) => { s.settings.dailyGoal = Math.max(0, Number(goal.value) || 0); }));
    const theme = document.getElementById("theme-select");
    theme.addEventListener("change", () => Store.commit((s) => { s.settings.theme = theme.value; }));

    // Re-fetch when coming back to the tab, so two devices stay in step.
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || Store.mode !== "server") return;
      try {
        const res = await fetch("api/state", { cache: "no-store" });
        if (res.ok) { Store.state = normalizeState(await res.json()); Store.cacheLocally(); this.render(); }
      } catch (e) { /* offline, keep local copy */ }
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (this.page === "stats") Stats.render(); }, 150);
    });

    Store.subscribe(() => this.render());
    window.addEventListener("hashchange", () => this.route());
    this.route();
    this.renderSyncStatus();
  },

  closeMenu() { document.querySelector("details.menu").open = false; },

  route() {
    const p = location.hash.slice(1);
    this.page = PAGES.includes(p) ? p : "backlog";
    for (const name of PAGES) document.getElementById("page-" + name).hidden = name !== this.page;
    $$("#tabs a").forEach((a) => a.classList.toggle("active", a.dataset.page === this.page));
    hideTooltip();
    this.render();
  },

  render() {
    const s = Store.state.settings;
    if (s.theme === "light" || s.theme === "dark") document.documentElement.dataset.theme = s.theme;
    else delete document.documentElement.dataset.theme;
    document.getElementById("theme-select").value = s.theme || "auto";
    document.getElementById("goal-input").value = s.dailyGoal;
    Timer.renderOptions();
    this.renderStatusBar();

    if (this.page === "backlog") Backlog.render();
    else if (this.page === "logger") Logger.render();
    else if (this.page === "gantt") Gantt.render();
    else if (this.page === "stats") Stats.render();
    else if (this.page === "archive") Archive.render();
    else if (this.page === "reports") Reports.render();
  },

  // IDE-style bottom bar: quick numbers that are useful on every page.
  renderStatusBar() {
    const today = todayISO();
    const byDate = Store.minutesByDate();
    const goal = Number(Store.state.settings.dailyGoal) || 0;
    const t = byDate[today] || 0;
    let week = 0;
    for (let d = startOfWeek(today); d <= today; d = addDays(d, 1)) week += byDate[d] || 0;
    let streak = 0, d = byDate[today] ? today : addDays(today, -1);
    while (byDate[d]) { streak++; d = addDays(d, -1); }
    const res = Store.resourceList();
    document.getElementById("sb-today").textContent = "today " + fmtMinutes(t) + (goal ? " / " + fmtMinutes(goal) : "") + (goal && t >= goal ? " ✓" : "");
    document.getElementById("sb-week").textContent = "week " + fmtHours(week);
    document.getElementById("sb-streak").textContent = "streak " + streak + "d";
    document.getElementById("sb-count").textContent = res.filter((r) => Store.kindOf(r.status) === "doing").length + " in progress · " + res.length + " items";
  },

  renderSyncStatus() {
    const el = document.getElementById("sync-status");
    if (Store.mode === "server") {
      el.textContent = Store.serverError ? "● not saved" : "● saved to server";
      el.className = "sb-item " + (Store.serverError ? "bad" : "good");
      el.title = Store.serverError ? "Could not reach server.py — changes are kept in this browser and will be sent on the next change." : "Data is stored in data/work-data.json on the server";
    } else {
      el.textContent = "● this browser only";
      el.className = "sb-item";
      el.title = "Data lives only in this browser. Run server.py to keep it in a file on this machine.";
    }
  },
};

App.init();
