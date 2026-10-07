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
| **Board** | Kanban of tasks (Backlog → In progress → Paused → Done). Each card has a **status** (a few words on where it stands, highlighted on the card with the date you last changed it), category, type, **project**, an optional **deliverable**, priority, link, estimated hours, planned start/end and notes. Drag cards between columns to move them. Click **Select** (or Ctrl/Cmd+click a card) to multi-select: Shift+click selects a range, the checkbox in a column header selects the whole column, and the bulk bar can move, re-categorise, re-prioritise or **delete** everything selected (Delete key works too, and deletions can be undone from the pop-up). |
| **Daily log** | Your backlog sits in a sidebar next to a Mon–Sun week. Drag a task onto a day to log a session (duration, focus 1–5, notes). Drag a session to another day to move it (hold Ctrl/Alt to copy it). On a phone, tap a task to log it for today. Each day ends with a **summary of hours by project and by category** (untick **day summaries** to hide them), and a **week summary** table below the days shows projects or categories × days with totals and shares. |
| **Gantt** | Built from the log. The dashed outline is the planned window, the light bar is the actual span (first → last session), and the ticks are the individual work days (taller = more minutes). Also shows a today line, ✓ on finished items and an "overdue" flag. **Show** cards or **deliverables** (a deliverable's cards rolled into one row; click it to open the deliverable). **Sort** groups rows by category (default) or by project (A→Z, "No project" last; bars keep their category color), and works together with the category filter. Each group header shows the total hours of the tasks under it (hover for task and session counts); it follows the filter, "hide finished" and "archived". Untick **weekends** to drop Saturday/Sunday columns (weekend work still shows as a thin mark between Friday and Monday), and tick **archived** to include archived tasks. Both choices are remembered. |
| **Reports** | Reports for your team manager and project managers, on a white A4 sheet; **Print / Save as PDF** uses the browser's print, and **CSV** downloads the tables. **Weekly status update**: hours vs capacity, project vs internal time, your highlights note (saved per week), hours by project × day, progress per deliverable, items waiting on others, plan for next week, optional session-notes appendix. **Project status**: red/amber/green for schedule and budget, budget (set per project, otherwise the sum of estimates) vs forecast at completion, hours burn-up, decisions/inputs needed, deliverables table, next 2 weeks. **Monthly capacity & delivery**: utilization per week vs capacity, hours by project with rating, estimate accuracy, time lost waiting, by category, internal time, next month's deadlines. **Task / deliverable history**: hours vs estimate, status, time per column, work log. Set your weekly capacity and name in the report toolbar. Use the project **Internal** for non-project time. |
| **Archive** | Finished tasks you've sent to the archive, newest first, with search, Restore and Delete. |
| **Stats** | Today vs daily goal, this week vs last week, current/best streak, 30-day totals, minutes-per-day chart, hours by category, a 26-week consistency heatmap, and a per-task table (estimate vs actual, sessions, average focus, projected finish date). |

Work-tracker additions:

- **Asked when pausing or finishing**: moving a card into **Paused** or
  **Done** (any column whose behavior is *On hold* or *Finished*), by
  dragging, the bulk **Move to…**, or the editor's **Column**, opens a dialog
  asking how many hours you worked since the last update, in how many
  sessions, on which date, with an optional note. You can update the status
  text there too. Both numbers are optional: leave them empty to just move
  the card, enter sessions with 0 hours to count them without adding time
  (they show in the card's work log), or enter hours without sessions to log
  them as one session. **Cancel** (or Esc) leaves the card where it was. Moving several cards asks for each
  one in turn. Moves to other columns (Backlog, In progress) happen straight
  away, and are still recorded in the card's work log.
- **Work log on each card**: the task editor lists every session day by day
  (hours, focus, note), together with the card's column moves and status
  updates. Click a session to edit it, or **+ Log session** to add one.
- **Deliverables**: one deliverable (a document or drawing you issue) can be
  split into several cards. Type it in a card's **Deliverable** field (pick an
  existing one of that project, or type a new name), or manage them with
  **Deliverables** on the Board page: estimate, due date and issue date, cards
  and hours. Hours add up from the cards; estimate and due date fall back to the
  cards' values; a deliverable counts as issued when you set the date or when all
  its cards are done. Reports and the Gantt (Show: Deliverables) use them.
- The card work log shows sessions and status updates only. Column moves are
  still recorded (the reports use them to measure waiting time) but not listed.
- **Archive**: cards in a Done column get a **Send to archive** button (also
  in the task editor). Archived cards leave the board, the Daily log sidebar,
  the timer and the Gantt (unless you tick **archived** there), but their time still counts in Stats. The
  **archive** tab lists them with hours, sessions, finish and archive dates;
  search them, click one to open it with its full work log, **Restore** it to
  the board, or **Delete** it for good. Archiving can be undone from the
  pop-up.

Also included (same as the study tracker):

- **Work timer** in the header, as a stopwatch or a 25-minute Pomodoro countdown. Start it, and press **Log** to turn the elapsed time into a session.
- **Your own columns and priority levels** (**Columns & priorities** on the Board page), with the same *To do* / *In progress* / *On hold* / *Finished* behaviors and priority presets.
- **Import backlog** from Excel / Google Sheets / CSV (**Data ▾ → Import backlog**). Task types are guessed from a Type column (bug, feature, meeting, review, …, English or Portuguese).
- **Sort and filter the board** by any field, plus free-text search. With a sort active, each card shows a ribbon with the sort field and its value for that card (e.g. *Hours worked · 4h 30m*).
- **Editable totals**: change **Hours worked** and **Sessions** in a task's editor; the difference is logged as real sessions.
- **Backup**: export and restore everything as JSON, or export the work log as CSV.
- **Convert logged hours** (**Data ▾**): multiplies the hours of every
  session in a date range you pick (default: last week) by a factor you enter
  per category, e.g. to turn logged time into timesheet hours. Shows a
  before/after preview per category, downloads a full backup first, keeps each
  session's original minutes, and leaves converted sessions out of later runs
  (tick "also convert sessions converted before" to multiply them again).
  Categories left at 1.00 are not touched.
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
    ├── archive.js  Archive tab
    ├── deliverables.js deliverable manager / editor
    ├── reports.js  Reports tab (weekly, project, monthly, history)
    ├── convert.js  convert logged hours over a date range
    └── app.js      routing + wiring
```
