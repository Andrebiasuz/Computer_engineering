# Study Tracker

A self-hosted study tracker: keep a **backlog** of resources, drag them onto a
**daily study log**, and get a **Gantt chart** and **stats** built from what
you actually studied. It's plain HTML/CSS/JS plus a tiny standard-library
Python server. There's nothing to install and no external requests.

## Pages

| Page | What it does |
|---|---|
| **Backlog** | Kanban of resources (Backlog → In progress → Paused → Done). Each card has a category, type, platform, priority, link, estimated hours, planned start/end and notes. Drag cards between columns to change status. Click **Select** (or Ctrl/Cmd+click a card) to multi-select: Shift+click selects a range, the checkbox in a column header selects the whole column, and the bulk bar can move, re-categorise, re-prioritise or **delete** everything selected (Delete key works too, and deletions can be undone from the pop-up). |
| **Daily log** | Your backlog sits in a sidebar next to a Mon–Sun week. Drag a resource onto a day to log a session (duration, focus 1–5, notes). Drag a session to another day to move it (hold Ctrl/Alt to copy it). On a phone, tap a resource to log it for today. |
| **Gantt** | Built from the log. The dashed outline is the planned window, the light bar is the actual span (first → last session), and the ticks are the individual study days (taller = more minutes). Also shows a today line, ✓ on finished items and an "overdue" flag. |
| **Stats** | Today vs daily goal, this week vs last week, current/best streak, 30-day totals, minutes-per-day chart, hours by category, a 26-week consistency heatmap, and a per-resource table (estimate vs actual, sessions, average focus, projected finish date). |

Also included:

- **Study timer** in the header, as a stopwatch or a 25-minute Pomodoro countdown. Its list only shows cards in "In progress" and "On hold" columns (you can also drop any card on it). Start it, and press **Log** to turn the elapsed time into a session.
- **Your own columns and priority levels** (**Columns & priorities** on the Backlog page): add, rename, recolor, reorder or delete board columns, and give each one a behavior: *To do* (logging a session moves it to the first In-progress column), *In progress* / *On hold* (shown in the timer) or *Finished* (✓ on the Gantt, counted in Stats). Priority levels work the same way, with presets for high/med/low, P1–P5, and a six-level 5…0 scale. Deleting a column or level moves its cards to a neighbor. Imports match column and level names, and spread numeric priorities over your levels (a 0–5 column maps one-to-one onto six levels).
- **Import backlog**: in **Data ▾**, choose **Import backlog**, then paste cells copied from Excel or Google Sheets, or load a CSV (comma or semicolon, UTF-8 or Windows-1252). Columns are auto-detected from English or Portuguese headers: title/course, status (WIP = in progress), platform, category/segment, priority (1–3 with 1 = high, or 0–5 with 5 = high), pages, study hours, course hours, duration in days, start, target end, % complete, link and notes. A column that's mostly URLs (like "Domain") becomes the link. `.pdf` file names become titles, and the file name is kept in the notes. Titles already in the backlog are skipped, so re-importing is safe. You can re-map any column before importing.
- **Sort and filter the backlog**: sort by manual order, priority, title, category, type, platform, hours studied, study estimate, hours remaining, progress %, course length, pages, sessions, last studied, planned start/end or date added (↑/↓ toggles direction, and the choice is remembered). Filter by category, type, platform and priority, plus free-text search. **Clear filters** resets them. With a sort active, dragging a card only changes its column. The Stats resource table sorts by clicking any column header.
- **Editable totals**: in a resource's editor, **Hours studied** and **Sessions** can be changed directly. Raising the hours logs the extra time as real sessions on the date you pick (split over the number of sessions you added), so it shows up in the daily log, Gantt, streak and every stat. You can edit or move those sessions like any other. Lowering the hours trims time from the most recent sessions.
- **Backup**: export and restore everything as JSON, or export the study log as CSV.
- IDE-style look: dark theme by default (light and "follow system" in **Data ▾ → Theme**), syntax-colored details (types, platforms, hours, priorities, statuses), editor-style tabs, and a status bar with today/week totals, streak and the running timer.
- Daily goal, and category colors that stay the same on every page.

## Running it

### Option A: self-hosted with the server (recommended)

```bash
cd study-tracker
python3 server.py                      # opens http://localhost:8080 in your browser
```

Data is saved to `study-tracker/data/study-data.json`, with one snapshot per
day kept in `data/backups/` (last 14 days). To open it from your phone or
another computer on the same network:

```bash
python3 server.py --host 0.0.0.0 --port 8080
```

Then browse to `http://<this-machine's-ip>:8080`.

The server has **no authentication**. Keep it on your home network, or put it
behind a reverse proxy with auth (Caddy, nginx + basic auth, or Tailscale) if
you want to reach it from outside.

To run it as a service on Linux, create `~/.config/systemd/user/study-tracker.service`:

```ini
[Unit]
Description=Study Tracker

[Service]
WorkingDirectory=%h/Computer_engineering/study-tracker
ExecStart=/usr/bin/python3 server.py --host 0.0.0.0 --port 8080 --no-browser
Restart=on-failure

[Install]
WantedBy=default.target
```

Then run `systemctl --user enable --now study-tracker`.

### Option B: GitHub Pages

Live at https://andrebiasuz.github.io/Computer_engineering/study-tracker/

Pages only serves static files, so the app runs in "this browser only" mode:
each device/browser keeps its own data in `localStorage`. Nothing you log is
uploaded to GitHub. Move data between devices with **Data ▸ Export** /
**Restore backup**.

To (re)configure: repo **Settings ▸ Pages ▸ Build and deployment**, Source
"Deploy from a branch", pick the branch that has `study-tracker/` and the
`/ (root)` folder. The empty `.nojekyll` file at the repo root tells Pages to
serve files as-is instead of running Jekyll over the whole repo.

### Option C: no server

Open `index.html` directly, or host the folder on any static host. Data is
then kept in that browser's `localStorage` (the header says "this browser
only"). Use **Data ▸ Export** for backups. If you later start `server.py`, the
first load pushes this browser's data up to the server.

## Files

```
study-tracker/
├── index.html      page shell
├── style.css       styles + light/dark tokens
├── server.py       static server + JSON persistence (GET/PUT /api/state)
├── data/           created on first save (git-ignored)
└── js/
    ├── util.js     dates, DOM helper, tooltip, toast
    ├── store.js    data model + persistence (server or localStorage)
    ├── modals.js   resource / session / category editors
    ├── backlog.js  Kanban board
    ├── logger.js   weekly log + drag and drop
    ├── timer.js    stopwatch / Pomodoro
    ├── gantt.js    Gantt chart
    ├── stats.js    tiles, charts, heatmap, table
    ├── importer.js Excel/CSV import, JSON backup, CSV export
    └── app.js      routing + wiring
```
