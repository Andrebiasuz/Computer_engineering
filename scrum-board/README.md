# Project Board

A kanban board for running several projects at once, made to look like sticky
notes pinned to a corkboard. It works as continuous flow: there are no sprints.
Plain HTML, CSS and JavaScript: there's no build step and no server, and the
page makes no network requests except to load its two Google Fonts.

## Features

- Columns (Backlog → Next → Doing → Waiting → Done by default). You can rename, add and delete them.
  The last column is the Done column; new columns are added just before it.
- **WIP limits** per column. A column over its limit turns red.
- Sticky notes with a title, details, owner (with an initials avatar), story points and one of six colours.
- **Projects**: give a note a project and it shows as a label on the card. The
  project menu in the toolbar shows one project at a time (or notes with no
  project), and the progress bar then shows that project's progress. Click a
  card's project label to jump to that project. New notes start in the
  project you're viewing, using that project's usual colour. Column counts and
  WIP limits always include every project, so the limit covers your total workload.
- **Swimlanes**: the ☰ Swimlanes button switches to one row (lane) per
  project, with the same columns. Drag a note sideways to change its stage,
  or up/down into another lane to change its project. Each lane shows its own
  progress, has a "+ note" button, and can be collapsed to a row of counts.
  Notes without a project get a "No project" lane. The on/off choice and
  collapsed lanes are remembered per browser.
- **Note size**: the − / + buttons in the toolbar make every note smaller or bigger
  (XS, S, M, L, XL; XS shows titles only). To resize one note, drag the small grip in
  its bottom-right corner up or down; double-click the grip to return it to automatic.
- Drag notes between and within columns. On phones and tablets, long-press a note to pick it up.
- Drag a note onto the trash bin to remove it. Every delete can be undone.
- Board title, a "This week" focus line, and a progress bar showing how many
  notes you finished this week (Monday to Sunday) against how many are still open.
  It follows the project filter.
- **Archive done**: in your weekly review, one click moves everything in Done to
  the archive (with undo). **History** lists archived notes week by week, where
  you can restore or delete them. Notes are stamped when they reach Done, so the
  weekly count stays right after archiving.
- Story points are optional; leave them empty and the board just counts notes.
- Filter notes by text.
- Keyboard: Tab to focus a note, Enter to edit, Delete to remove, Shift/Alt + arrows to move it.
- Export and import the board as JSON.

Data is saved in your browser's `localStorage`, so each browser/device has
its own board. Use **Export** to back it up or move it somewhere else.

## Run locally

```bash
cd scrum-board
python3 -m http.server 8000
```

Open <http://localhost:8000>. You can also open `index.html` directly.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` publishes this folder, together with the
other apps in the repo, whenever `main` changes. It can also be run by
hand from the Actions tab. The board is served at
<https://andrebiasuz.github.io/Computer_engineering/scrum-board/>.
