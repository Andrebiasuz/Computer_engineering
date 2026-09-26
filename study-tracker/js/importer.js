"use strict";

/*
 * Bulk backlog import. Paste straight from Excel / Google Sheets (tab separated),
 * or load a .csv. Columns are auto-mapped from their header names (English or
 * Portuguese) and can be re-mapped before importing.
 */

// Tested in order against the normalised header (lower case, no accents);
// the first unused field that matches wins.
const IMPORT_FIELDS = [
  { id: "", label: "— ignore —" },
  { id: "title", label: "Title", match: /\b(title|name|resource|task|item|topic|course|titulo|nome|tarefa|recurso|atividade|assunto|curso)\b/ },
  { id: "status", label: "Status", match: /\b(status|state|situacao|estado)\b/ },
  { id: "platform", label: "Platform", match: /\b(platform|plataforma|provider|vendor|school|escola)\b/ },
  { id: "category", label: "Category", match: /\b(category|subject|segment|segmento|area|group|phase|module|track|categoria|materia|disciplina|grupo|fase|modulo)\b/ },
  { id: "priority", label: "Priority", match: /\b(priority|prio|prioridade)\b/ },
  { id: "pages", label: "Pages", match: /\b(pages|paginas|pgs)\b/ },
  { id: "estHours", label: "Estimated study hours", match: /(study|estudo|estimate|effort|esforco)/ },
  { id: "lengthHours", label: "Course length (h)", match: /\b(hours|horas|hrs|carga)\b/ },
  { id: "durationDays", label: "Duration (days)", match: /\b(days|dias)\b|^(duration|duracao)$/ },
  { id: "plannedStart", label: "Planned start", match: /\b(start|begin|inicio|comeco)\b/ },
  { id: "plannedEnd", label: "Planned end", match: /\b(end|finish|due|deadline|fim|termino|prazo|target)\b/ },
  { id: "percent", label: "% complete", match: /(%|percent|progress|progresso|concluido|complete)/ },
  { id: "type", label: "Type", match: /\b(type|kind|format|tipo|formato)\b/ },
  { id: "url", label: "Link", match: /\b(url|link|website|site)\b/ },
  { id: "notes", label: "Notes", match: /\b(notes?|description|comments?|obs|observacoes|notas?|descricao|comentarios?)\b/ },
];

function normHeader(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function looksLikeUrl(v) { return /^(https?:\/\/|www\.)\S+$/i.test(String(v || "").trim()); }

// Numbers like "266,25", "1.065", "-" and "" (empty / dash = unknown).
function parseNumberCell(v) {
  const n = parseNumber(v);
  return n == null || n === 0 ? null : n;
}

function guessMapping(header, dataRows) {
  const used = new Set();
  const mapping = header.map((name) => {
    const key = normHeader(name);
    const f = IMPORT_FIELDS.find((f) => f.match && !used.has(f.id) && f.match.test(key));
    if (f) used.add(f.id);
    return f ? f.id : "";
  });
  if (!mapping.includes("title")) mapping[0] = "title";
  // A lone "Hours" column is the estimate, not the course length.
  if (!mapping.includes("estHours") && mapping.includes("lengthHours")) mapping[mapping.indexOf("lengthHours")] = "estHours";
  // Any column that is mostly links becomes the Link column (e.g. "Domain").
  if (!mapping.includes("url")) {
    header.forEach((_, i) => {
      if (mapping.includes("url") || ["title", "notes"].includes(mapping[i])) return;
      const vals = dataRows.map((r) => r[i]).filter((v) => v && v !== "-");
      if (vals.length && vals.filter(looksLikeUrl).length / vals.length >= 0.6) mapping[i] = "url";
    });
  }
  return mapping;
}

// Maps a priority column onto the board's own priority levels (highest first).
// Numbers: a 1–3 scale is read as 1 = most important; anything with values
// above 3 (e.g. 0–5) as "bigger = more important". So with six levels a 0–5
// column maps one-to-one, and with three levels it is spread evenly.
function priorityMapper(values) {
  const levels = Store.priorities();
  const last = levels.length - 1;
  const nums = values.map(parseNumber).filter((n) => n != null);
  const max = Math.max(...nums, 0);
  const at = (i) => levels[Math.max(0, Math.min(last, Math.round(i)))].id;
  return (v) => {
    const s = String(v || "").trim().toLowerCase();
    const byLabel = levels.find((p) => p.label.toLowerCase() === s);
    if (byLabel) return byLabel.id;
    const n = parseNumber(s);
    if (n != null && /^[\d.,\s-]+$/.test(s)) {
      if (max > 3) return at((1 - n / max) * last);
      return at(((n - 1) / 2) * last);
    }
    if (/^(high|alta|urgent|p1)/.test(s)) return at(0);
    if (/^(low|baixa|p3)/.test(s)) return at(last);
    return Store.defaultPriority();
  };
}

// Picks a board column: a column with the same name wins, otherwise the
// first column whose kind matches what the text/percentage suggests.
function mapStatusColumn(v, percent) {
  const s = String(v || "").trim().toLowerCase();
  const byLabel = Store.columns().find((c) => c.label.toLowerCase() === s);
  if (byLabel) return byLabel.id;
  const kind = mapStatus(v, percent);
  return Store.firstColumnOfKind(kind) || Store.columns()[0].id;
}

function cleanTitle(title) {
  const t = String(title).trim();
  const m = t.match(/^(.*)\.(pdf|epub|mobi|djvu)$/i);
  return m ? { title: m[1].trim(), file: t } : { title: t, file: "" };
}

function detectDelimiter(firstLine) {
  if (firstLine.includes("\t")) return "\t";
  const semis = (firstLine.match(/;/g) || []).length, commas = (firstLine.match(/,/g) || []).length;
  return semis > commas ? ";" : ",";
}

function parseDelimited(text) {
  text = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const delim = detectDelimiter(text.split("\n")[0] || "");
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

function parseDateLoose(v, dayFirst) {
  v = String(v || "").trim();
  if (!v) return "";
  let m;
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
  if ((m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) {
    let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
    let day = dayFirst ? a : b, mon = dayFirst ? b : a;
    if (mon > 12 && day <= 12) [day, mon] = [mon, day];
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return "";
    return y + "-" + pad2(mon) + "-" + pad2(day);
  }
  // Excel serial date (days since 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + Math.floor(Number(v)));
    return toISO(d);
  }
  const d = new Date(v);
  return isNaN(d) ? "" : toISO(d);
}

function parseNumber(v) {
  v = String(v || "").trim().replace(/[^\d,.\-]/g, "");
  if (!v) return null;
  if (v.includes(",") && !v.includes(".")) v = v.replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function mapStatus(v, percent) {
  const s = String(v || "").toLowerCase();
  if (/done|complete|finished|conclu|feito|finaliz|✓|✔/.test(s)) return "done";
  if (/\bwip\b|progress|doing|ongoing|started|andamento|fazendo|iniciad|cursando|active/.test(s)) return "doing";
  if (/pause|hold|parad|pausad|suspen/.test(s)) return "hold";
  if (percent != null) {
    const p = percent <= 1 && String(percent).includes(".") ? percent * 100 : percent;
    if (p >= 100) return "done";
    if (p > 0) return "doing";
  }
  return "todo";
}

function mapType(v) {
  const s = String(v || "").toLowerCase();
  const table = [
    [/book|livro|ebook|\.pdf$/, "Book"], [/course|curso|mooc|udemy|coursera|hotmart|learning|university|utfpr/, "Course"], [/video|v[ií]deo|youtube/, "Video"],
    [/article|artigo|blog|post/, "Article"], [/doc|manual|reference/, "Documentation"], [/project|projeto/, "Project"],
    [/exercise|exerc[ií]cio|practice|lab/, "Exercise"], [/cert/, "Certification"],
  ];
  for (const [re, t] of table) if (re.test(s)) return t;
  return s ? "Other" : "Course";
}

// Excel on Windows often saves CSV as Windows-1252 rather than UTF-8.
async function readTextFile(f) {
  const buf = await f.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch (e) {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function openImporter() {
  const ta = h("textarea", { rows: "8", class: "mono", placeholder:
    "Select the cells in Excel (including the header row), copy, and paste here.\n\nExample:\nTask\tCategory\tStart\tEnd\tHours\tStatus\nCS50 week 1\tC\t01/10/2026\t07/10/2026\t10\tIn progress" });
  const file = h("input", { type: "file", accept: ".csv,.tsv,.txt,text/csv,text/plain" });
  const dayFirst = h("input", { type: "checkbox", checked: true });
  const skipDupes = h("input", { type: "checkbox", checked: true });
  const preview = h("div", { class: "import-preview" });
  const importBtn = h("button", { class: "btn btn-primary", disabled: true }, "Import");
  let rows = [], mapping = [];

  const build = () => {
    rows = parseDelimited(ta.value);
    preview.innerHTML = "";
    importBtn.disabled = rows.length < 2;
    if (rows.length < 2) {
      if (ta.value.trim()) preview.append(h("p", { class: "muted" }, "Need a header row plus at least one data row."));
      return;
    }
    const header = rows[0];
    mapping = guessMapping(header, rows.slice(1));

    const table = h("table", { class: "data-table" });
    table.append(h("thead", {},
      h("tr", {}, header.map((name, i) => {
        const sel = h("select", {}, IMPORT_FIELDS.map((f) => h("option", { value: f.id, selected: f.id === mapping[i] }, f.label)));
        sel.addEventListener("change", () => { mapping[i] = sel.value; });
        return h("th", {}, h("div", { class: "muted small" }, name), sel);
      }))));
    table.append(h("tbody", {}, rows.slice(1, 8).map((r) => h("tr", {}, header.map((_, i) => h("td", {}, r[i] || ""))))));
    preview.append(h("p", { class: "small" }, `${rows.length - 1} rows found. Check the column mapping, then import.` + (rows.length > 8 ? " (showing first 7)" : "")),
      h("div", { class: "table-wrap" }, table));
  };

  ta.addEventListener("input", build);
  file.addEventListener("change", async () => {
    if (!file.files[0]) return;
    ta.value = await readTextFile(file.files[0]);
    build();
  });

  importBtn.addEventListener("click", () => {
    if (!mapping.includes("title")) { toast("Map one column to Title."); return; }
    let count = 0, skipped = 0;
    const header = rows[0];
    const dataRows = rows.slice(1);
    const prio = priorityMapper(dataRows.map((r) => r[mapping.indexOf("priority")]));
    Store.commit((s) => {
      let order = Math.max(0, ...Object.values(s.resources).map((r) => r.order || 0));
      const existing = new Set(Object.values(s.resources).map((r) => r.title.toLowerCase()));
      for (const row of dataRows) {
        const v = {};
        const extraNotes = [];
        mapping.forEach((f, i) => {
          const cell = (row[i] || "").trim();
          if (!f || !cell || cell === "-") return;
          // Keep anything that isn't a link, instead of silently dropping it.
          if (f === "url" && !looksLikeUrl(cell)) {
            const platformCell = row[mapping.indexOf("platform")] || "";
            if (cell.toLowerCase() !== platformCell.trim().toLowerCase()) extraNotes.push(header[i] + ": " + cell);
            return;
          }
          v[f] = cell;
        });
        if (!v.title) continue;
        const { title, file: fileName } = cleanTitle(v.title);
        if (skipDupes.checked && existing.has(title.toLowerCase())) { skipped++; continue; }
        existing.add(title.toLowerCase());
        if (fileName) extraNotes.push("File: " + fileName);
        const url = v.url && /^www\./i.test(v.url) ? "https://" + v.url : (v.url || "");
        let plannedStart = parseDateLoose(v.plannedStart, dayFirst.checked);
        let plannedEnd = parseDateLoose(v.plannedEnd, dayFirst.checked);
        const dur = parseNumber(v.durationDays);
        if (plannedStart && !plannedEnd && dur) plannedEnd = addDays(plannedStart, Math.max(0, Math.round(dur) - 1));
        const percent = parseNumber(v.percent);
        const status = mapStatusColumn(v.status, percent);
        const r = Store.newResource({
          title,
          // An explicit Type column wins; otherwise guess from the platform, defaulting to Course.
          type: v.type ? mapType(v.type) : fileName ? "Book" : (v.platform ? mapType(v.platform).replace("Other", "Course") : "Course"),
          platform: v.platform || "",
          categoryId: Store.findOrCreateCategory(s, v.category),
          url,
          estHours: parseNumberCell(v.estHours),
          lengthHours: parseNumberCell(v.lengthHours),
          pages: parseNumberCell(v.pages),
          priority: v.priority == null ? Store.defaultPriority() : prio(v.priority),
          status,
          plannedStart, plannedEnd,
          notes: [v.notes, ...extraNotes].filter(Boolean).join("\n"),
          doneAt: Store.kindOf(status) === "done" ? (plannedEnd || todayISO()) : "",
          order: ++order,
        });
        s.resources[r.id] = r;
        count++;
      }
    });
    Modal.close();
    toast(`Imported ${count} resource${count === 1 ? "" : "s"}` + (skipped ? `, skipped ${skipped} already in the backlog.` : "."));
    location.hash = "#backlog";
  });

  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Import backlog"),
    h("p", { class: "muted small" }, "Paste rows copied from Excel / Google Sheets, or load a CSV. Recognised columns: title, status, platform, category/segment, priority (your level names, 1–3, or 0–5), pages, study hours, course hours, duration (days), start, end, % complete, link, notes — English or Portuguese headers. A column full of links is used as the Link."),
    ta,
    h("div", { class: "form-row" }, field("…or load a file", file),
      h("label", { class: "small check" }, dayFirst, " Dates are day/month/year (dd/mm/yyyy)"),
      h("label", { class: "small check" }, skipDupes, " Skip titles already in the backlog")),
    preview,
    h("div", { class: "form-actions" }, h("span"), importBtn)), { wide: true });
}

/* ---------- JSON backup / CSV export ---------- */

function exportJSON() {
  downloadFile("study-tracker-backup-" + todayISO() + ".json", JSON.stringify(Store.state, null, 2), "application/json");
}

async function importJSON(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || !("resources" in data)) throw new Error("not a Study Tracker backup");
    if (!confirm("Replace ALL current data with this backup?")) return;
    Store.replaceAll(data);
    toast("Backup restored.");
  } catch (e) {
    alert("Could not restore backup: " + e.message);
  }
}

function exportLogCSV() {
  const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const lines = [["date", "resource", "category", "minutes", "focus", "note"].join(",")];
  for (const l of Store.logList().sort((a, b) => a.date.localeCompare(b.date))) {
    const r = Store.state.resources[l.resourceId] || {};
    const c = Store.category(r.categoryId);
    lines.push([l.date, q(r.title), q(c ? c.name : ""), l.minutes, l.focus || "", q(l.note)].join(","));
  }
  downloadFile("study-log-" + todayISO() + ".csv", lines.join("\n"), "text/csv");
}
