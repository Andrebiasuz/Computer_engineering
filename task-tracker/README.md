# Task Tracker

A completely local, offline, Trello-style Kanban board for tracking tasks. No
account, no server, no internet connection required — everything runs in
your browser and your data never leaves your machine.

## Features

- Lists (columns) and cards, fully editable (add/rename/delete)
- Drag and drop cards between and within lists
- Card details: description, due date, color labels
- **Links**: attach any number of URLs to a card
- **Files**: attach any number of files to a card (stored locally, downloadable, removable)
- Search box to filter cards by title/description
- Export the whole board (including attached files) to a single `.json`
  file for backup, and import it back later — or move it to another machine

## Running it

Everything is static HTML/CSS/JS, so there's nothing to install. Pick one:

**Option A — just open the file**

Double-click `index.html` (or open it via `File > Open` in your browser).

**Option B — serve it locally (recommended)**

Some browsers restrict `IndexedDB` (used to store file attachments) when a
page is opened directly from disk (`file://`). If attaching files doesn't
work in Option A, serve the folder instead:

```bash
cd task-tracker
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## How data is stored

- Board structure (lists, cards, labels, links, dates) is stored in your
  browser's `localStorage`.
- File attachments are stored in your browser's `IndexedDB`, keyed to this
  page, so they don't bloat `localStorage` and can handle larger files.
- Nothing is sent over the network — this app makes no network requests at all.

Because storage is tied to the browser you're using, use **Export** (top
right) regularly to save a portable backup, and **Import** to restore it or
load it in a different browser/machine.

## Notes

- Clearing your browser's site data for this page (or "Clear browsing
  data") will delete your board and attachments — export first if you
  care about the data.
- There is no size limit enforced by the app; very large files are
  constrained only by your browser's storage quota.
