"use strict";

/*
 * Study timer in the header. Stopwatch by default; "25m" runs a Pomodoro
 * countdown. "Log" turns the elapsed time into a session for today.
 * Timer state lives in this browser's localStorage so a refresh doesn't lose it.
 */

const TIMER_KEY = "study-tracker-timer-v1";

const Timer = {
  el: document.getElementById("timer"),
  select: document.getElementById("timer-resource"),
  display: document.getElementById("timer-display"),
  startBtn: document.getElementById("timer-start"),
  pomoBtn: document.getElementById("timer-pomo"),
  stopBtn: document.getElementById("timer-stop"),
  t: { resourceId: "", startedAt: null, accumulated: 0, target: null },
  tick: null,

  init() {
    try { Object.assign(this.t, JSON.parse(localStorage.getItem(TIMER_KEY)) || {}); } catch (e) { /* ignore */ }

    this.select.addEventListener("change", () => { this.t.resourceId = this.select.value; this.persist(); });
    this.startBtn.addEventListener("click", () => (this.running() ? this.pause() : this.start()));
    this.pomoBtn.addEventListener("click", () => {
      this.t.target = this.t.target ? null : 25 * 60000;
      if (this.t.target && !this.running()) this.start();
      this.persist();
      this.update();
    });
    this.stopBtn.addEventListener("click", () => this.finish());

    // Drop a resource from any list onto the timer to select it.
    this.el.addEventListener("dragover", (e) => {
      if (e.dataTransfer.types.includes("text/resource-id")) { e.preventDefault(); this.el.classList.add("drop-target"); }
    });
    this.el.addEventListener("dragleave", () => this.el.classList.remove("drop-target"));
    this.el.addEventListener("drop", (e) => {
      e.preventDefault();
      this.el.classList.remove("drop-target");
      const id = e.dataTransfer.getData("text/resource-id");
      if (id) { this.t.resourceId = id; this.persist(); this.renderOptions(); }
    });

    this.tick = setInterval(() => this.update(), 1000);
    this.update();
  },

  running() { return this.t.startedAt != null; },

  elapsed() {
    return this.t.accumulated + (this.running() ? Date.now() - this.t.startedAt : 0);
  },

  persist() {
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(this.t)); } catch (e) { /* ignore */ }
  },

  start() {
    if (!this.t.resourceId) { toast("Pick a resource for the timer first (or drop one on it)."); this.select.focus(); return; }
    if ("Notification" in window && Notification.permission === "default" && this.t.target) Notification.requestPermission();
    this.t.startedAt = Date.now();
    this.persist();
    this.update();
  },

  pause() {
    this.t.accumulated = this.elapsed();
    this.t.startedAt = null;
    this.persist();
    this.update();
  },

  reset() {
    this.t.startedAt = null;
    this.t.accumulated = 0;
    this.t.target = null;
    this.persist();
    this.update();
  },

  finish() {
    const minutes = Math.max(1, Math.round(this.elapsed() / 60000));
    const resourceId = this.t.resourceId;
    this.pause();
    if (!Store.state.resources[resourceId]) { this.reset(); return; }
    openLogEditor(null, { resourceId, date: todayISO(), minutes });
    this.reset();
  },

  alarm() {
    toast("Focus block done — take a 5 minute break.");
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.2);
      });
    } catch (e) { /* no audio */ }
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Study Tracker", { body: "Focus block done. Log it and take a break." });
    }
  },

  update() {
    let ms = this.elapsed();
    if (this.t.target && this.running() && ms >= this.t.target) {
      this.t.accumulated = this.t.target;
      this.t.startedAt = null;
      this.persist();
      this.alarm();
      ms = this.t.target;
    }
    const shown = this.t.target ? Math.max(0, this.t.target - ms) : ms;
    const s = Math.floor(shown / 1000);
    const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    this.display.textContent = (hh ? hh + ":" + pad2(mm) : pad2(mm)) + ":" + pad2(ss);
    this.display.classList.toggle("countdown", !!this.t.target);
    this.startBtn.textContent = this.running() ? "Pause" : (ms ? "Resume" : "Start");
    this.pomoBtn.classList.toggle("active", !!this.t.target);
    this.stopBtn.disabled = ms < 1000;
    this.el.classList.toggle("is-running", this.running());
    document.title = this.running() ? this.display.textContent + " · Study Tracker" : "Study Tracker";
    const sb = document.getElementById("sb-timer");
    const r = Store.state.resources[this.t.resourceId];
    sb.hidden = !ms;
    sb.textContent = (this.running() ? "▶ " : "❚❚ ") + this.display.textContent + (r ? " · " + r.title : "");
    sb.title = r ? r.title : "";
  },

  renderOptions() {
    this.select.innerHTML = "";
    this.select.append(h("option", { value: "" }, "Timer: pick resource…"));
    const open = Store.resourceList().filter((r) => r.status !== "done" || r.id === this.t.resourceId);
    for (const r of open) this.select.append(h("option", { value: r.id }, r.title));
    this.select.value = Store.state.resources[this.t.resourceId] ? this.t.resourceId : "";
  },
};
