"use strict";

/*
 * Bulk backlog import. Paste straight from Excel / Google Sheets (tab separated),
 * or load a .csv. Columns are auto-mapped from their header names (English or
 * Portuguese) and can be re-mapped before importing.
 */

const IMPORT_FIELDS = [
  { id: "", label: "— ignore —" },
  { id: "title", label: "Title", match: /^(title|name|resource|task|item|topic|course|t[ií]tulo|nome|tarefa|recurso|atividade|assunto|curso)/i },
  { id: "category", label: "Category", match: /^(category|subject|area|group|phase|module|track|categoria|mat[eé]ria|disciplina|[aá]rea|grupo|fase|m[oó]dulo)/i },
  { id: "type", label: "Type", match: /^(type|kind|format|tipo|formato)/i },
  { id: "url", label: "Link", match: /^(url|link|source|fonte)/i },
  { id: "estHours", label: "Estimated hours", match: /(hours|hrs|estimate|effort|horas|esfor[cç]o|carga)/i },
  { id: "durationDays", label: "Duration (days)", match: /^(duration|days|dura[cç][aã]o|dias)/i },
  { id: "plannedStart", label: "Planned start", match: /^(start|begin|in[ií]cio|come[cç]o|data de in[ií]cio|start date)/i },
  { id: "plannedEnd", label: "Planned end", match: /^(end|finish|due|deadline|fim|t[eé]rmino|prazo|conclus[aã]o|end date|data de fim)/i },
  { id: "priority", label: "Priority", match: /^(priority|prio|prioridade)/i },
  { id: "status", label: "Status", match: /^(status|state|situa[cç][aã]o|estado)/i },
  { id: "percent", label: "% complete", match: /(%|percent|progress|progresso|conclu[ií]do)/i },
  { id: "notes", label: "Notes", match: /^(notes?|description|comments?|obs|observa[cç][oõ]es|notas?|descri[cç][aã]o|coment[aá]rios?)/i },
];

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
  if (/progress|doing|ongoing|started|andamento|fazendo|iniciad|cursando|active/.test(s)) return "active";
  if (/pause|hold|parad|pausad|suspen/.test(s)) return "paused";
  if (percent != null) {
    const p = percent <= 1 && String(percent).includes(".") ? percent * 100 : percent;
    if (p >= 100) return "done";
    if (p > 0) return "active";
  }
  return "backlog";
}

function mapPriority(v) {
  const s = String(v || "").toLowerCase();
  if (/^(1|high|alta|urgent|p1)/.test(s)) return 1;
  if (/^(3|low|baixa|p3)/.test(s)) return 3;
  return 2;
}

function mapType(v) {
  const s = String(v || "").toLowerCase();
  const table = [
    [/course|curso|mooc|udemy|coursera/, "Course"], [/book|livro/, "Book"], [/video|v[ií]deo|youtube/, "Video"],
    [/article|artigo|blog|post/, "Article"], [/doc|manual|reference/, "Documentation"], [/project|projeto/, "Project"],
    [/exercise|exerc[ií]cio|practice|lab/, "Exercise"], [/cert/, "Certification"],
  ];
  for (const [re, t] of table) if (re.test(s)) return t;
  return s ? "Other" : "Course";
}

function openImporter() {
  const ta = h("textarea", { rows: "8", class: "mono", placeholder:
    "Select the cells in Excel (including the header row), copy, and paste here.\n\nExample:\nTask\tCategory\tStart\tEnd\tHours\tStatus\nCS50 week 1\tC\t01/10/2026\t07/10/2026\t10\tIn progress" });
  const file = h("input", { type: "file", accept: ".csv,.tsv,.txt,text/csv,text/plain" });
  const dayFirst = h("input", { type: "checkbox", checked: true });
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
    const used = new Set();
    mapping = header.map((name) => {
      const f = IMPORT_FIELDS.find((f) => f.match && !used.has(f.id) && f.match.test(name));
      if (f) used.add(f.id);
      return f ? f.id : "";
    });
    if (!mapping.includes("title")) mapping[0] = "title";

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
    ta.value = await file.files[0].text();
    build();
  });

  importBtn.addEventListener("click", () => {
    if (!mapping.includes("title")) { toast("Map one column to Title."); return; }
    let count = 0;
    Store.commit((s) => {
      let order = Math.max(0, ...Object.values(s.resources).map((r) => r.order || 0));
      for (const row of rows.slice(1)) {
        const v = {};
        mapping.forEach((f, i) => { if (f) v[f] = row[i] || ""; });
        if (!v.title) continue;
        let plannedStart = parseDateLoose(v.plannedStart, dayFirst.checked);
        let plannedEnd = parseDateLoose(v.plannedEnd, dayFirst.checked);
        const dur = parseNumber(v.durationDays);
        if (plannedStart && !plannedEnd && dur) plannedEnd = addDays(plannedStart, Math.max(0, Math.round(dur) - 1));
        const percent = parseNumber(v.percent);
        const status = mapStatus(v.status, percent);
        const r = Store.newResource({
          title: v.title,
          type: mapType(v.type),
          categoryId: Store.findOrCreateCategory(s, v.category),
          url: v.url || "",
          estHours: parseNumber(v.estHours),
          priority: mapPriority(v.priority),
          status,
          plannedStart, plannedEnd,
          notes: v.notes || "",
          doneAt: status === "done" ? (plannedEnd || todayISO()) : "",
          order: ++order,
        });
        s.resources[r.id] = r;
        count++;
      }
    });
    Modal.close();
    toast(`Imported ${count} resource${count === 1 ? "" : "s"}.`);
    location.hash = "#backlog";
  });

  Modal.open(h("div", { class: "form" },
    h("h2", {}, "Import backlog"),
    h("p", { class: "muted small" }, "Paste rows copied from Excel / Google Sheets, or load a CSV. Recognised columns: title, category, type, link, hours, duration (days), start, end, priority, status, % complete, notes — English or Portuguese headers."),
    ta,
    h("div", { class: "form-row" }, field("…or load a file", file),
      h("label", { class: "small check" }, dayFirst, " Dates are day/month/year (dd/mm/yyyy)")),
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
