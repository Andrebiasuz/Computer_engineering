"use strict";

const PAGES = ["backlog", "logger", "gantt", "stats"];

const App = {
  page: "backlog",

  async init() {
    await Store.load();

    Backlog.init();
    Logger.init();
    Gantt.init();
    Timer.init();

    document.getElementById("bulk-import-btn").addEventListener("click", () => { this.closeMenu(); openImporter(); });
    document.getElementById("export-json-btn").addEventListener("click", () => { this.closeMenu(); exportJSON(); });
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

    if (this.page === "backlog") Backlog.render();
    else if (this.page === "logger") Logger.render();
    else if (this.page === "gantt") Gantt.render();
    else if (this.page === "stats") Stats.render();
  },

  renderSyncStatus() {
    const el = document.getElementById("sync-status");
    if (Store.mode === "server") {
      el.textContent = Store.serverError ? "● not saved" : "● saved to server";
      el.className = "sync-status " + (Store.serverError ? "bad" : "good");
      el.title = Store.serverError ? "Could not reach server.py — changes are kept in this browser and will be sent on the next change." : "Data is stored in data/study-data.json on the server";
    } else {
      el.textContent = "● this browser only";
      el.className = "sync-status";
      el.title = "Running without server.py: data lives in this browser's localStorage. Use Data ▸ Export to back it up.";
    }
  },
};

App.init();
