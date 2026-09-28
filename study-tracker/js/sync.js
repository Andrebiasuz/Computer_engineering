"use strict";

/*
 * Optional cloud sync through a secret GitHub Gist, so the GitHub Pages
 * version shares one data set across machines.
 *
 * - Each browser is connected once with a GitHub token that has only the
 *   "gist" scope. The token stays in that browser's localStorage and is
 *   sent only to api.github.com.
 * - The data lives in a secret gist with one file, study-tracker-data.json.
 *   The first browser creates it; the others find it by that file name.
 * - Last change wins: every save stamps meta.updatedAt, and on load / when
 *   the tab regains focus the newer copy (cloud or browser) is kept.
 */

const SYNC_KEY = "study-tracker-sync-v1";
const GIST_FILE = "study-tracker-data.json";
const GH_API = "https://api.github.com";

const Sync = {
  cfg: null, // { token, gistId, login }
  status: "off", // off | syncing | ok | error
  error: "",
  pushTimer: null,
  lastPushed: "",

  enabled() { return !!(this.cfg && this.cfg.token && this.cfg.gistId) && Store.mode !== "server"; },

  loadCfg() {
    try { this.cfg = JSON.parse(localStorage.getItem(SYNC_KEY)) || null; } catch (e) { this.cfg = null; }
  },

  saveCfg() {
    try {
      if (this.cfg) localStorage.setItem(SYNC_KEY, JSON.stringify(this.cfg));
      else localStorage.removeItem(SYNC_KEY);
    } catch (e) { /* storage blocked; sync lasts for this tab only */ }
  },

  async api(path, opts) {
    const res = await fetch(GH_API + path, Object.assign({}, opts, {
      headers: Object.assign({
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + this.cfg.token,
        "X-GitHub-Api-Version": "2022-11-28",
      }, opts && opts.body ? { "Content-Type": "application/json" } : {}),
      cache: "no-store",
    }));
    if (res.status === 401) throw new Error("GitHub rejected the token (expired or revoked?)");
    if (res.status === 403 || res.status === 404) throw new Error("GitHub denied access (the token needs the \"gist\" scope)");
    if (!res.ok) throw new Error("GitHub error " + res.status);
    return res.status === 204 ? null : res.json();
  },

  setStatus(status, error) {
    this.status = status;
    this.error = error || "";
    App.renderSyncStatus();
  },

  /* ---------- reading / writing the gist ---------- */

  async readRemote() {
    const gist = await this.api("/gists/" + this.cfg.gistId);
    const f = gist.files && gist.files[GIST_FILE];
    if (!f) return null;
    // Large files come back truncated; the raw URL has the full content.
    const text = f.truncated ? await (await fetch(f.raw_url, { cache: "no-store" })).text() : f.content;
    try { return JSON.parse(text); } catch (e) { return null; }
  },

  async push() {
    if (!this.enabled()) return;
    const body = JSON.stringify(Store.state);
    if (body === this.lastPushed) return;
    this.setStatus("syncing");
    try {
      await this.api("/gists/" + this.cfg.gistId, {
        method: "PATCH",
        body: JSON.stringify({ files: { [GIST_FILE]: { content: body } } }),
      });
      this.lastPushed = body;
      this.setStatus("ok");
    } catch (e) {
      this.setStatus("error", e.message);
    }
  },

  schedulePush() {
    if (!this.enabled()) return;
    clearTimeout(this.pushTimer);
    this.setStatus("syncing");
    this.pushTimer = setTimeout(() => this.push(), 1500);
  },

  // Pull the cloud copy if it is newer than this browser's; push if older.
  async pull() {
    if (!this.enabled()) return;
    this.setStatus("syncing");
    try {
      const remote = await this.readRemote();
      const localAt = (Store.state.meta && Store.state.meta.updatedAt) || "";
      const remoteAt = (remote && remote.meta && remote.meta.updatedAt) || "";
      if (remote && remoteAt > localAt) {
        Store.state = normalizeState(remote);
        Store.cacheLocally();
        this.lastPushed = JSON.stringify(Store.state);
        App.render();
        this.setStatus("ok");
      } else if (!remote || localAt > remoteAt) {
        await this.push();
      } else {
        this.setStatus("ok");
      }
    } catch (e) {
      this.setStatus("error", e.message);
    }
  },

  async init() {
    this.loadCfg();
    if (!this.enabled()) { this.setStatus("off"); return; }
    await this.pull();
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.pull();
      // Leaving the tab: send any pending change straight away.
      else if (this.pushTimer) { clearTimeout(this.pushTimer); this.push(); }
    });
  },

  /* ---------- connect / disconnect ---------- */

  async findOrCreateGist() {
    // Look through the account's gists for our data file.
    for (let page = 1; page <= 10; page++) {
      const gists = await this.api(`/gists?per_page=100&page=${page}`);
      const hit = gists.find((g) => g.files && g.files[GIST_FILE]);
      if (hit) return { id: hit.id, created: false };
      if (gists.length < 100) break;
    }
    const created = await this.api("/gists", {
      method: "POST",
      body: JSON.stringify({
        description: "Study Tracker data (synced by the Study Tracker app)",
        public: false,
        files: { [GIST_FILE]: { content: JSON.stringify(Store.state) } },
      }),
    });
    return { id: created.id, created: true };
  },

  async connect(token) {
    this.cfg = { token: token.trim() };
    const user = await this.api("/user");
    const { id, created } = await this.findOrCreateGist();
    this.cfg = { token: this.cfg.token, gistId: id, login: user.login };
    if (created) {
      this.lastPushed = JSON.stringify(Store.state);
      this.saveCfg();
      this.setStatus("ok");
      return { created: true, remote: null };
    }
    return { created: false, remote: await this.readRemote() };
  },

  disconnect() {
    clearTimeout(this.pushTimer);
    this.cfg = null;
    this.saveCfg();
    this.setStatus("off");
  },
};

function countItems(state) {
  return state ? Object.keys(state.resources || {}).length : 0;
}

function openSyncDialog() {
  const body = h("div", { class: "form" }, h("h2", {}, "Sync across machines"));

  if (Store.mode === "server") {
    body.append(h("p", {}, "This copy is running on server.py, which already shares one data file with every device that opens it. Cloud sync is for the GitHub Pages version."));
    Modal.open(body);
    return;
  }

  if (Sync.enabled()) {
    body.append(
      h("p", {}, "Synced with a secret gist on GitHub account ", h("b", {}, Sync.cfg.login || "?"), "."),
      h("p", { class: "muted small" }, "Changes are uploaded a moment after you make them. Other machines pick them up when the page loads or when you switch back to its tab. If two machines edit at the same time, the most recent save wins."),
      Sync.error ? h("p", { class: "bad small" }, "Last error: " + Sync.error) : null,
      h("div", { class: "form-actions" },
        h("button", { type: "button", class: "btn btn-danger", onclick: () => {
          if (!confirm("Stop syncing this browser? Your data stays here and in the gist; this only removes the token from this browser.")) return;
          Sync.disconnect();
          Modal.close();
          toast("Sync turned off for this browser.");
        } }, "Disconnect this browser"),
        h("span", { class: "sort-group" },
          h("a", { class: "btn btn-ghost", href: "https://gist.github.com/" + Sync.cfg.gistId, target: "_blank", rel: "noopener" }, "View gist ↗"),
          h("button", { type: "button", class: "btn btn-primary", onclick: async () => { await Sync.pull(); toast(Sync.status === "ok" ? "Synced." : "Sync failed: " + Sync.error); } }, "Sync now"))));
    Modal.open(body);
    return;
  }

  const token = h("input", { type: "password", placeholder: "ghp_… or github_pat_…", autocomplete: "off", spellcheck: "false" });
  const msg = h("p", { class: "small" });
  const connect = h("button", { type: "submit", class: "btn btn-primary" }, "Connect");
  const form = h("form", { class: "form" },
    h("h2", {}, "Sync across machines"),
    h("p", {}, "GitHub Pages only serves the app. Your data is saved in each browser separately, which is why another machine starts empty. Connect each browser to the same GitHub account to share one copy of your data, kept in a ", h("b", {}, "secret gist"), "."),
    h("ol", { class: "small steps" },
      h("li", {}, "Create a token: ", h("a", { href: "https://github.com/settings/tokens/new?scopes=gist&description=Study%20Tracker%20sync", target: "_blank", rel: "noopener" }, "github.com/settings/tokens/new"), ". Tick only the ", h("code", {}, "gist"), " scope and pick an expiry you're happy with."),
      h("li", {}, "Paste it below and connect. The first browser creates the gist; on other machines, paste a token for the same account and it finds the same gist.")),
    field("GitHub token (gist scope only)", token),
    h("p", { class: "muted small" }, "The token is stored only in this browser and only sent to api.github.com. A secret gist isn't listed publicly, but anyone with its link can read it, so don't put anything confidential in your notes."),
    msg,
    h("div", { class: "form-actions" }, h("span"), connect));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!token.value.trim()) return;
    connect.disabled = true;
    msg.className = "small muted";
    msg.textContent = "Connecting…";
    try {
      const { created, remote } = await Sync.connect(token.value);
      if (created) {
        Modal.close();
        toast(`Connected. Uploaded ${countItems(Store.state)} items to a new secret gist.`);
        return;
      }
      chooseSyncDirection(remote);
    } catch (err) {
      Sync.cfg = null;
      msg.className = "small bad";
      msg.textContent = err.message;
      connect.disabled = false;
    }
  });
  Modal.open(form);
}

// First connection on a browser when the cloud already has data.
function chooseSyncDirection(remote) {
  const localN = countItems(Store.state), remoteN = countItems(remote);
  const remoteAt = remote && remote.meta && remote.meta.updatedAt;
  let done = false;
  const finish = (useCloud) => {
    done = true;
    Sync.saveCfg();
    if (useCloud && remote) {
      Store.state = normalizeState(remote);
      Store.cacheLocally();
      Sync.lastPushed = JSON.stringify(Store.state);
      App.render();
      Sync.setStatus("ok");
    } else {
      Store.state.meta = { updatedAt: new Date().toISOString() };
      Store.cacheLocally();
      Sync.push();
    }
    Modal.close();
    toast(useCloud ? `Loaded ${remoteN} items from the cloud.` : `Uploaded ${localN} items from this browser.`);
  };
  // Nothing in this browser yet: just take the cloud copy.
  if (!localN) { finish(true); return; }
  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Which data should be kept?"),
    h("p", {}, "Found your Study Tracker gist. ",
      h("b", {}, `Cloud: ${remoteN} items`), remoteAt ? ` (last saved ${new Date(remoteAt).toLocaleString()})` : "", ". ",
      h("b", {}, `This browser: ${localN} items`), "."),
    h("p", { class: "muted small" }, "The other copy is replaced. To be safe, use Data ▸ Export full backup first if this browser has anything you need."),
    h("div", { class: "form-actions" },
      h("button", { type: "button", class: "btn btn-ghost", onclick: () => {
        if (remoteN && !confirm(`Replace the ${remoteN} items in the cloud with this browser's ${localN}?`)) return;
        finish(false);
      } }, "Upload this browser's data"),
      h("button", { type: "button", class: "btn btn-primary", onclick: () => finish(true) }, "Use cloud data (recommended)"))),
    // Closing without choosing leaves this browser unconnected.
    { onClose: () => { if (!done) { Sync.cfg = null; Sync.setStatus("off"); } } });
}
