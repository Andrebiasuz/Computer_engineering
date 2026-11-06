# Sprint Board

A scrum / kanban board that looks like sticky notes pinned to a corkboard.
Plain HTML, CSS and JavaScript: there's no build step and no server, and the
page makes no network requests except to load its two Google Fonts.

## Features

- Columns (Backlog → To Do → In Progress → Review → Done by default). You can rename, add and delete them.
- **WIP limits** per column. A column over its limit turns red.
- Sticky notes with a title, details, owner (with an initials avatar), story points and one of six colours.
- Drag notes between and within columns. On phones and tablets, long-press a note to pick it up.
- Drag a note onto the trash bin to remove it. Every delete can be undone.
- Sprint name, sprint goal and a progress bar showing done points over total points.
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

`.github/workflows/pages.yml` deploys this folder to GitHub Pages whenever
`main` changes something under `scrum-board/`. It can also be run by hand
from the Actions tab.

One-time setup: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The site will be served at
`https://<user>.github.io/<repo>/`.
