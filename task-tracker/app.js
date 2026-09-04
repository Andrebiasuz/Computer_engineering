"use strict";

/* ---------- id + storage helpers ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const STORAGE_KEY = "task-tracker-state-v1";
const LABEL_COLORS = ["#61bd4f", "#f2d600", "#ff9f1a", "#eb5a46", "#c377e0", "#0079bf"];

function defaultState() {
  const todoId = uid(), doingId = uid(), doneId = uid();
  return {
    boardTitle: "My Board",
    listOrder: [todoId, doingId, doneId],
    lists: {
      [todoId]: { id: todoId, title: "To Do" },
      [doingId]: { id: doingId, title: "In Progress" },
      [doneId]: { id: doneId, title: "Done" },
    },
    cardOrder: { [todoId]: [], [doingId]: [], [doneId]: [] },
    cards: {},
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.lists || !parsed.cardOrder || !parsed.cards) return defaultState();
    return parsed;
  } catch (e) {
    console.error("Failed to load board state, starting fresh.", e);
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

/* ---------- IndexedDB for file attachments ---------- */

const DB_NAME = "task-tracker-files";
const STORE_NAME = "files";
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not available in this browser/context."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function putFile(id, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteFile(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ---------- utils ---------- */

function fmtBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, type) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type });
}

/* ---------- DOM refs ---------- */

const boardEl = document.getElementById("board");
const boardTitleInput = document.getElementById("board-title");
const searchInput = document.getElementById("search-input");
const listTemplate = document.getElementById("list-template");
const cardTemplate = document.getElementById("card-template");

const modalOverlay = document.getElementById("modal-overlay");
const modalCloseBtn = document.getElementById("modal-close");
const cardTitleInput = document.getElementById("card-title-input");
const labelPicker = document.getElementById("label-picker");
const dueInput = document.getElementById("card-due-input");
const dueClearBtn = document.getElementById("card-due-clear");
const descInput = document.getElementById("card-desc-input");
const linkListEl = document.getElementById("link-list");
const linkForm = document.getElementById("link-form");
const linkUrlInput = document.getElementById("link-url-input");
const linkLabelInput = document.getElementById("link-label-input");
const attachmentListEl = document.getElementById("attachment-list");
const fileInput = document.getElementById("file-input");
const deleteCardBtn = document.getElementById("delete-card-btn");

let activeCardId = null;
let draggedCardId = null;

/* ---------- rendering ---------- */

function render() {
  boardTitleInput.value = state.boardTitle;
  boardEl.innerHTML = "";

  for (const listId of state.listOrder) {
    const list = state.lists[listId];
    if (!list) continue;
    boardEl.appendChild(renderList(list));
  }

  boardEl.appendChild(renderAddList());
  applySearchFilter();
}

function renderList(list) {
  const node = listTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.listId = list.id;

  const titleInput = node.querySelector(".list-title-input");
  titleInput.value = list.title;
  titleInput.addEventListener("change", () => {
    list.title = titleInput.value.trim() || "Untitled list";
    titleInput.value = list.title;
    saveState();
  });
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") titleInput.blur();
  });

  node.querySelector(".list-menu-btn").addEventListener("click", () => {
    const cardCount = (state.cardOrder[list.id] || []).length;
    const msg = cardCount
      ? `Delete "${list.title}" and its ${cardCount} card(s)?`
      : `Delete "${list.title}"?`;
    if (!confirm(msg)) return;
    deleteList(list.id);
  });

  const cardListEl = node.querySelector(".card-list");
  cardListEl.dataset.listId = list.id;
  for (const cardId of state.cardOrder[list.id] || []) {
    const card = state.cards[cardId];
    if (card) cardListEl.appendChild(renderCard(card));
  }

  cardListEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    node.classList.add("drag-over");
    const afterEl = getDragAfterElement(cardListEl, e.clientY);
    const dragged = document.querySelector(".card.dragging");
    if (!dragged) return;
    if (afterEl == null) cardListEl.appendChild(dragged);
    else cardListEl.insertBefore(dragged, afterEl);
  });
  cardListEl.addEventListener("dragleave", (e) => {
    if (!cardListEl.contains(e.relatedTarget)) node.classList.remove("drag-over");
  });
  cardListEl.addEventListener("drop", (e) => {
    e.preventDefault();
    node.classList.remove("drag-over");
    commitCardOrderFromDom();
  });

  const addBtn = node.querySelector(".add-card-btn");
  addBtn.addEventListener("click", () => showAddCardForm(node, cardListEl, list.id));

  return node;
}

function showAddCardForm(listNode, cardListEl, listId) {
  const addBtn = listNode.querySelector(".add-card-btn");
  addBtn.hidden = true;

  const form = document.createElement("div");
  form.className = "add-card-form";
  form.innerHTML = `
    <textarea placeholder="Enter a title for this card..." rows="2"></textarea>
    <div class="form-actions">
      <button type="button" class="btn btn-primary btn-small">Add card</button>
      <button type="button" class="form-cancel" title="Cancel">&times;</button>
    </div>
  `;
  listNode.insertBefore(form, addBtn);

  const textarea = form.querySelector("textarea");
  textarea.focus();

  function cleanup() {
    form.remove();
    addBtn.hidden = false;
  }

  function submit() {
    const title = textarea.value.trim();
    if (!title) { cleanup(); return; }
    const card = createCard(listId, title);
    cardListEl.appendChild(renderCard(card));
    saveState();
    textarea.value = "";
    textarea.focus();
  }

  form.querySelector(".btn-primary").addEventListener("click", submit);
  form.querySelector(".form-cancel").addEventListener("click", cleanup);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
    if (e.key === "Escape") cleanup();
  });
  textarea.addEventListener("blur", () => {
    setTimeout(() => { if (document.activeElement !== textarea && !textarea.value.trim()) cleanup(); }, 150);
  });
}

function renderAddList() {
  const wrap = document.createElement("div");
  wrap.className = "add-list-wrap";
  const btn = document.createElement("button");
  btn.className = "add-list-btn";
  btn.textContent = "+ Add another list";
  wrap.appendChild(btn);

  btn.addEventListener("click", () => {
    wrap.innerHTML = `
      <form class="add-list-form">
        <input type="text" placeholder="Enter list title..." required>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary btn-small">Add list</button>
          <button type="button" class="form-cancel" title="Cancel">&times;</button>
        </div>
      </form>
    `;
    const form = wrap.querySelector("form");
    const input = wrap.querySelector("input");
    input.focus();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (!title) return;
      createList(title);
      render();
    });
    wrap.querySelector(".form-cancel").addEventListener("click", () => render());
  });

  return wrap;
}

function renderCard(card) {
  const node = cardTemplate.content.firstElementChild.cloneNode(true);
  node.dataset.cardId = card.id;

  const labelsEl = node.querySelector(".card-labels");
  for (const color of card.labels || []) {
    const chip = document.createElement("span");
    chip.className = "label-chip";
    chip.style.background = color;
    labelsEl.appendChild(chip);
  }

  node.querySelector(".card-title").textContent = card.title;
  node.querySelector(".meta-desc").textContent = card.desc && card.desc.trim() ? "☰" : "";
  node.querySelector(".meta-links").textContent = card.links && card.links.length ? `\u{1F517} ${card.links.length}` : "";
  node.querySelector(".meta-files").textContent = card.attachments && card.attachments.length ? `\u{1F4CE} ${card.attachments.length}` : "";
  node.querySelector(".meta-due").textContent = card.due ? `\u{1F4C5} ${card.due}` : "";

  node.addEventListener("click", () => openCardModal(card.id));
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter") openCardModal(card.id);
  });

  node.addEventListener("dragstart", () => {
    draggedCardId = card.id;
    node.classList.add("dragging");
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
    document.querySelectorAll(".list.drag-over").forEach((el) => el.classList.remove("drag-over"));
    draggedCardId = null;
  });

  return node;
}

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".card:not(.dragging)")];
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

function commitCardOrderFromDom() {
  const newCardOrder = {};
  document.querySelectorAll(".card-list").forEach((cardListEl) => {
    const listId = cardListEl.dataset.listId;
    newCardOrder[listId] = [...cardListEl.querySelectorAll(".card")].map((c) => c.dataset.cardId);
  });
  for (const [listId, order] of Object.entries(newCardOrder)) {
    state.cardOrder[listId] = order;
  }
  if (draggedCardId && state.cards[draggedCardId]) {
    const newListId = Object.keys(newCardOrder).find((lid) => newCardOrder[lid].includes(draggedCardId));
    if (newListId) state.cards[draggedCardId].listId = newListId;
  }
  saveState();
}

/* ---------- list / card mutations ---------- */

function createList(title) {
  const id = uid();
  state.lists[id] = { id, title };
  state.cardOrder[id] = [];
  state.listOrder.push(id);
  saveState();
  return state.lists[id];
}

function deleteList(listId) {
  for (const cardId of state.cardOrder[listId] || []) {
    deleteCardAttachments(state.cards[cardId]);
    delete state.cards[cardId];
  }
  delete state.cardOrder[listId];
  delete state.lists[listId];
  state.listOrder = state.listOrder.filter((id) => id !== listId);
  saveState();
  render();
}

function createCard(listId, title) {
  const id = uid();
  const card = { id, listId, title, desc: "", due: "", labels: [], links: [], attachments: [] };
  state.cards[id] = card;
  state.cardOrder[listId].push(id);
  return card;
}

function deleteCardAttachments(card) {
  if (!card) return;
  for (const att of card.attachments || []) {
    deleteFile(att.id).catch(() => {});
  }
}

function deleteCard(cardId) {
  const card = state.cards[cardId];
  if (!card) return;
  deleteCardAttachments(card);
  state.cardOrder[card.listId] = (state.cardOrder[card.listId] || []).filter((id) => id !== cardId);
  delete state.cards[cardId];
  saveState();
}

/* ---------- card modal ---------- */

function openCardModal(cardId) {
  activeCardId = cardId;
  const card = state.cards[cardId];
  if (!card) return;

  cardTitleInput.value = card.title;
  descInput.value = card.desc || "";
  dueInput.value = card.due || "";

  labelPicker.innerHTML = "";
  for (const color of LABEL_COLORS) {
    const sw = document.createElement("button");
    sw.type = "button";
    sw.className = "label-swatch" + (card.labels.includes(color) ? " selected" : "");
    sw.style.background = color;
    sw.addEventListener("click", () => {
      const idx = card.labels.indexOf(color);
      if (idx >= 0) card.labels.splice(idx, 1);
      else card.labels.push(color);
      saveState();
      openCardModal(cardId);
      refreshCardInBoard(cardId);
    });
    labelPicker.appendChild(sw);
  }

  renderLinkList(card);
  renderAttachmentList(card);

  modalOverlay.hidden = false;
  cardTitleInput.focus();
}

function closeCardModal() {
  modalOverlay.hidden = true;
  activeCardId = null;
  render();
}

function refreshCardInBoard(cardId) {
  const card = state.cards[cardId];
  const node = boardEl.querySelector(`.card[data-card-id="${cardId}"]`);
  if (card && node) node.replaceWith(renderCard(card));
  applySearchFilter();
}

function renderLinkList(card) {
  linkListEl.innerHTML = "";
  for (const link of card.links) {
    const row = document.createElement("div");
    row.className = "link-row";
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = link.label || link.url;
    row.appendChild(a);
    const rm = document.createElement("button");
    rm.className = "row-remove-btn";
    rm.textContent = "✕";
    rm.title = "Remove link";
    rm.addEventListener("click", () => {
      card.links = card.links.filter((l) => l.id !== link.id);
      saveState();
      renderLinkList(card);
      refreshCardInBoard(card.id);
    });
    row.appendChild(rm);
    linkListEl.appendChild(row);
  }
}

function renderAttachmentList(card) {
  attachmentListEl.innerHTML = "";
  for (const att of card.attachments) {
    const row = document.createElement("div");
    row.className = "attachment-row";
    const nameSpan = document.createElement("a");
    nameSpan.className = "file-name";
    nameSpan.textContent = att.name;
    nameSpan.href = "#";
    nameSpan.title = "Download";
    nameSpan.addEventListener("click", async (e) => {
      e.preventDefault();
      const blob = await getFile(att.id);
      if (!blob) { alert("File data not found."); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    row.appendChild(nameSpan);

    const meta = document.createElement("span");
    meta.className = "file-meta";
    meta.textContent = fmtBytes(att.size);
    row.appendChild(meta);

    const rm = document.createElement("button");
    rm.className = "row-remove-btn";
    rm.textContent = "✕";
    rm.title = "Remove attachment";
    rm.addEventListener("click", async () => {
      card.attachments = card.attachments.filter((a) => a.id !== att.id);
      await deleteFile(att.id).catch(() => {});
      saveState();
      renderAttachmentList(card);
      refreshCardInBoard(card.id);
    });
    row.appendChild(rm);

    attachmentListEl.appendChild(row);
  }
}

/* ---------- modal event wiring ---------- */

modalCloseBtn.addEventListener("click", closeCardModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeCardModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.hidden) closeCardModal();
});

cardTitleInput.addEventListener("change", () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  card.title = cardTitleInput.value.trim() || "Untitled card";
  cardTitleInput.value = card.title;
  saveState();
  refreshCardInBoard(card.id);
});

descInput.addEventListener("change", () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  card.desc = descInput.value;
  saveState();
  refreshCardInBoard(card.id);
});

dueInput.addEventListener("change", () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  card.due = dueInput.value;
  saveState();
  refreshCardInBoard(card.id);
});

dueClearBtn.addEventListener("click", () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  card.due = "";
  dueInput.value = "";
  saveState();
  refreshCardInBoard(card.id);
});

linkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const card = state.cards[activeCardId];
  if (!card) return;
  let url = linkUrlInput.value.trim();
  if (!url) return;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = "https://" + url;
  card.links.push({ id: uid(), url, label: linkLabelInput.value.trim() });
  saveState();
  linkUrlInput.value = "";
  linkLabelInput.value = "";
  renderLinkList(card);
  refreshCardInBoard(card.id);
  linkUrlInput.focus();
});

fileInput.addEventListener("change", async () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  const files = [...fileInput.files];
  fileInput.value = "";
  for (const file of files) {
    const id = uid();
    try {
      await putFile(id, file);
      card.attachments.push({ id, name: file.name, type: file.type, size: file.size });
    } catch (err) {
      alert(`Could not store "${file.name}": ${err.message}\nTip: if you opened this file directly (file://), try serving the folder with a local static server instead (see README).`);
    }
  }
  saveState();
  renderAttachmentList(card);
  refreshCardInBoard(card.id);
});

deleteCardBtn.addEventListener("click", () => {
  const card = state.cards[activeCardId];
  if (!card) return;
  if (!confirm(`Delete card "${card.title}"?`)) return;
  deleteCard(card.id);
  modalOverlay.hidden = true;
  activeCardId = null;
  render();
});

/* ---------- header: title, search, export/import ---------- */

boardTitleInput.addEventListener("change", () => {
  state.boardTitle = boardTitleInput.value.trim() || "My Board";
  boardTitleInput.value = state.boardTitle;
  saveState();
});

searchInput.addEventListener("input", applySearchFilter);

function applySearchFilter() {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll(".card").forEach((node) => {
    const card = state.cards[node.dataset.cardId];
    if (!card) return;
    const haystack = (card.title + " " + (card.desc || "")).toLowerCase();
    node.classList.toggle("hidden-by-search", !!q && !haystack.includes(q));
  });
}

document.getElementById("export-btn").addEventListener("click", async () => {
  const exportData = { boardTitle: state.boardTitle, listOrder: state.listOrder, lists: state.lists, cardOrder: state.cardOrder, cards: {} };
  for (const [cardId, card] of Object.entries(state.cards)) {
    const attachments = [];
    for (const att of card.attachments || []) {
      const blob = await getFile(att.id).catch(() => null);
      if (!blob) continue;
      const base64 = await blobToBase64(blob);
      attachments.push({ ...att, data: base64 });
    }
    exportData.cards[cardId] = { ...card, attachments };
  }
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (state.boardTitle || "board").replace(/[^a-z0-9_-]+/gi, "_");
  a.download = `${safeName}-export.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

document.getElementById("import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  if (!confirm("Importing will replace your current board. Continue?")) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const newState = {
      boardTitle: data.boardTitle || "My Board",
      listOrder: data.listOrder || [],
      lists: data.lists || {},
      cardOrder: data.cardOrder || {},
      cards: {},
    };
    for (const [cardId, card] of Object.entries(data.cards || {})) {
      const attachments = [];
      for (const att of card.attachments || []) {
        if (att.data) {
          const blob = base64ToBlob(att.data, att.type || "application/octet-stream");
          await putFile(att.id, blob);
        }
        attachments.push({ id: att.id, name: att.name, type: att.type, size: att.size });
      }
      newState.cards[cardId] = { ...card, attachments };
    }
    state = newState;
    saveState();
    render();
  } catch (err) {
    alert("Failed to import board: " + err.message);
  }
});

/* ---------- init ---------- */

render();
