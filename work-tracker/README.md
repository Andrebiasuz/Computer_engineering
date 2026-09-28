# Work Tracker

A self-hosted work tracker, cloned from the Study Tracker
with the same structure: a **backlog** of tasks, a **daily work log**, a
**Gantt chart** and **stats** built from the time you actually logged. It's
plain HTML/CSS/JS plus a tiny standard-library Python server.

## Confidentiality

This copy is meant for company data, so it is locked down compared to the
study tracker:

- **Your data never goes to GitHub.** Only the code lives in the repo. Tasks
  and logs are saved in `work-tracker/data/`, which is git-ignored, along with
  any `.json` / `.csv` backups or exports you save inside this folder.
- **No cloud sync.** The study tracker's GitHub Gist sync has been removed
  entirely.
- **No external requests.** The Google Fonts link was removed (system fonts
  are used instead), and `server.py` sends a Content-Security-Policy that only
  lets the page talk to itself. Even a future change that tried to call an
  outside service would be blocked by the browser.
- **Local only by default.** The server listens on `127.0.0.1`, so only this
  computer can open it. It prints a warning if you bind it to anything else.
- The data folder can't be downloaded through the web server, including with
  `../` or URL-encoded path tricks, or through `HEAD` requests.
- It refuses requests made under a hostname it doesn't know, so a malicious
  website can't use your browser to read or overwrite your data (DNS
  rebinding). See `--allow-host` below.

Keep backups on company-approved storage (e.g. your work laptop's encrypted
disk or the company's file share), not in personal cloud drives.

## Pages

| Page | What it does |
|---|---|
| **Backlog** | Kanban of tasks (Backlog → In progress → Paused → Done). Each card has a category, type, platform (use it for client / team / system), priority, link, estimated hours, planned start/end and notes. Drag cards between columns to change status. Click **Select** (or Ctrl/Cmd+click a card) to multi-select: Shift+click selects a range, the checkbox in a column header selects the whole column, and the bulk bar can move, re-categorise, re-prioritise or **delete** everything selected (Delete key works too, and deletions can be undone from the pop-up). |
| **Daily log** | Your backlog sits in a sidebar next to a Mon–Sun week. Drag a task onto a day to log a session (duration, focus 1–5, notes). Drag a session to another day to move it (hold Ctrl/Alt to copy it). On a phone, tap a task to log it for today. |
| **Gantt** | Built from the log. The dashed outline is the planned window, the light bar is the actual span (first → last session), and the ticks are the individual work days (taller = more minutes). Also shows a today line, ✓ on finished items and an "overdue" flag. |
| **Stats** | Today vs daily goal, this week vs last week, current/best streak, 30-day totals, minutes-per-day chart, hours by category, a 26-week consistency heatmap, and a per-task table (estimate vs actual, sessions, average focus, projected finish date). |

Also included (same as the study tracker):

- **Work timer** in the header, as a stopwatch or a 25-minute Pomodoro countdown. Start it, and press **Log** to turn the elapsed time into a session.
- **Your own columns and priority levels** (**Columns & priorities** on the Backlog page), with the same *To do* / *In progress* / *On hold* / *Finished* behaviors and priority presets.
- **Import backlog** from Excel / Google Sheets / CSV (**Data ▾ → Import backlog**). Task types are guessed from a Type column (bug, feature, meeting, review, …, English or Portuguese).
- **Sort and filter the backlog** by any field, plus free-text search.
- **Editable totals**: change **Hours worked** and **Sessions** in a task's editor; the difference is logged as real sessions.
- **Backup**: export and restore everything as JSON, or export the work log as CSV.
- Dark IDE-style theme by default (light and "follow system" in **Data ▾ → Theme**).

Task types: Task, Feature, Bug, Project, Meeting, Review, Documentation,
Research, Support, Admin, Other.

## Running it

```bash
cd work-tracker
python3 server.py                      # opens http://localhost:8081 in your browser
```

It uses port **8081** so it can run next to the study tracker (8080). Data is
saved to `work-tracker/data/work-data.json`, with one snapshot per day kept in
`data/backups/` (last 14 days). Use `--data /some/other/path.json` to keep the
file somewhere else, e.g. an encrypted folder.

The server has **no authentication**, so leave `--host` at its default. Only
use `--host 0.0.0.0` if your company allows it, on a trusted network, ideally
behind a reverse proxy with login (or over the company VPN).

The app only answers when it's opened by IP address or as `localhost`, which
stops a malicious website from reaching it through your browser (DNS
rebinding). To open it by a name instead (this machine's hostname, or a
reverse proxy's domain), allow that name explicitly, e.g.
`python3 server.py --allow-host mypc.local`. Otherwise you'll get
"403 Host not allowed".

To run it as a service on Linux, create `~/.config/systemd/user/work-tracker.service`:

```ini
[Unit]
Description=Work Tracker

[Service]
WorkingDirectory=%h/Computer_engineering/work-tracker
ExecStart=/usr/bin/python3 server.py --no-browser
Restart=on-failure

[Install]
WantedBy=default.target
```

Then run `systemctl --user enable --now work-tracker`.

### Without the server

You can also open `index.html` directly. Data is then kept only in that
browser's `localStorage` (the status bar says "this browser only"), and the
Content-Security-Policy header isn't applied. Use **Data ▸ Export** for
backups. If you later start `server.py`, the first load pushes this browser's
data up to the server.

Don't publish this folder on GitHub Pages or any public host. The app would
still keep data in each visitor's browser, but there's no reason to expose it.

## Files

```
work-tracker/
├── index.html      page shell
├── style.css       styles + light/dark tokens
├── server.py       static server + JSON persistence (GET/PUT /api/state)
├── data/           created on first save (git-ignored, never commit it)
└── js/
    ├── util.js     dates, DOM helper, tooltip, toast
    ├── store.js    data model + persistence (server or localStorage)
    ├── modals.js   task / session / category editors
    ├── backlog.js  Kanban board
    ├── logger.js   weekly log + drag and drop
    ├── timer.js    stopwatch / Pomodoro
    ├── gantt.js    Gantt chart
    ├── stats.js    tiles, charts, heatmap, table
    ├── importer.js Excel/CSV import, JSON backup, CSV export
    └── app.js      routing + wiring
```
