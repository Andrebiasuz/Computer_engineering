"use strict";

/* ---------- ids ---------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* ---------- dates (always local calendar days, stored as YYYY-MM-DD) ---------- */

function pad2(n) { return String(n).padStart(2, "0"); }

function toISO(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function fromISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayISO() { return toISO(new Date()); }

function addDays(iso, n) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

function daysBetween(a, b) {
  return Math.round((fromISO(b) - fromISO(a)) / 86400000);
}

function startOfWeek(iso) {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtDate(iso) {
  if (!iso) return "";
  const d = fromISO(iso);
  return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}

function fmtShortDate(iso) {
  const d = fromISO(iso);
  return d.getDate() + " " + MONTHS[d.getMonth()];
}

/* ---------- durations ---------- */

function fmtMinutes(min) {
  min = Math.round(min || 0);
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m ? h + "h " + m + "m" : h + "h";
}

function fmtHours(min) {
  const h = (min || 0) / 60;
  return (h >= 10 ? h.toFixed(0) : h.toFixed(1)).replace(/\.0$/, "") + "h";
}

/* ---------- DOM ---------- */

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style" && typeof v === "object") {
      // setProperty is needed for CSS custom properties like "--c".
      for (const [prop, val] of Object.entries(v)) node.style.setProperty(prop.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase()), val);
    }
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(c));
  }
  return node;
}

/* ---------- tooltip (shared by every chart) ---------- */

const tooltipEl = document.getElementById("tooltip");

function showTooltip(evt, html) {
  tooltipEl.innerHTML = html;
  tooltipEl.hidden = false;
  const pad = 14;
  const r = tooltipEl.getBoundingClientRect();
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
  tooltipEl.style.left = Math.max(8, x) + "px";
  tooltipEl.style.top = Math.max(8, y) + "px";
}

function hideTooltip() { tooltipEl.hidden = true; }

function bindTooltip(node, htmlFn) {
  node.addEventListener("mousemove", (e) => showTooltip(e, htmlFn()));
  node.addEventListener("mouseleave", hideTooltip);
}

/* ---------- toast ---------- */

let toastTimer = null;
// opts: { action: "Undo", onAction: fn } shows a button and keeps the toast up longer.
function toast(msg, opts) {
  const el = document.getElementById("toast");
  el.innerHTML = "";
  el.append(h("span", {}, msg));
  if (opts && opts.action) {
    el.append(h("button", { class: "toast-action", onclick: () => { el.hidden = true; opts.onAction(); } }, opts.action));
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, opts && opts.action ? 8000 : 2600);
}

/* ---------- files ---------- */

function downloadFile(name, text, type) {
  const blob = new Blob([text], { type: type || "application/octet-stream" });
  const a = h("a", { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
