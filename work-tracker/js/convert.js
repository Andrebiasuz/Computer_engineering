"use strict";

/*
 * One-time conversion: multiply the hours of sessions logged up to a cutoff
 * date by a factor per category, so old logs are in the same "timesheet
 * hours" as everything logged from now on. A backup is downloaded first, and
 * converted sessions are marked (log.convertedFactor) so they are never
 * converted twice.
 */

function openConvertHours() {
  const cutoff = h("input", { type: "date", name: "cutoff", value: "2026-10-06", required: true });
  const rounding = h("select", { name: "rounding" },
    h("option", { value: "1" }, "nearest minute"),
    h("option", { value: "5" }, "nearest 5 minutes"),
    h("option", { value: "15" }, "nearest 15 minutes"));
  const table = h("table", { class: "data-table convert-table" });
  const summary = h("p", { class: "field-hint form-note" });
  const factors = {}; // category id ("" = uncategorised) -> input
  const submit = h("button", { type: "submit", class: "btn btn-primary" }, "Download backup & convert");

  const catKey = (l) => {
    const r = Store.state.resources[l.resourceId];
    return (r && r.categoryId && Store.category(r.categoryId)) ? r.categoryId : "";
  };
  const eligible = () => Store.logList().filter((l) => l.date <= cutoff.value && !l.convertedFactor && l.minutes > 0);
  const step = () => Number(rounding.value) || 1;
  const convert = (min, f) => {
    const s = step();
    const v = Math.round(min * f / s) * s;
    return Math.max(s, v);
  };
  const factorOf = (key) => {
    const v = Number(factors[key] ? factors[key].value : 1);
    return v > 0 ? v : NaN;
  };

  // Rows: every category with eligible sessions (rebuilt when the cutoff changes; factors are kept).
  const kept = {};
  const build = () => {
    for (const [k, inp] of Object.entries(factors)) kept[k] = inp.value;
    const groups = {};
    for (const l of eligible()) (groups[catKey(l)] = groups[catKey(l)] || []).push(l);
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = Store.state.categories.findIndex((c) => c.id === a), ib = Store.state.categories.findIndex((c) => c.id === b);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    });
    table.innerHTML = "";
    for (const k of Object.keys(factors)) delete factors[k];
    table.append(h("thead", {}, h("tr", {},
      h("th", {}, "Category"), h("th", { class: "num" }, "Sessions"), h("th", { class: "num" }, "Logged now"),
      h("th", { class: "num" }, "Factor"), h("th", { class: "num" }, "After"))));
    const body = h("tbody");
    if (!keys.length) body.append(h("tr", {}, h("td", { colspan: 5, class: "muted" }, "No unconverted sessions on or before this date.")));
    for (const k of keys) {
      const cat = Store.category(k);
      const inp = h("input", { type: "number", min: "0.1", max: "5", step: "0.01", value: kept[k] || "1.00", class: "factor-input", "aria-label": "Factor for " + (cat ? cat.name : "Uncategorised") });
      inp.addEventListener("input", update);
      factors[k] = inp;
      const logs = groups[k];
      body.append(h("tr", { "data-key": k },
        h("td", {}, h("span", { class: "swatch", style: { background: Store.categoryColor(k || null) } }), " ", cat ? cat.name : "Uncategorised"),
        h("td", { class: "num" }, logs.length),
        h("td", { class: "num" }, fmtMinutes(logs.reduce((s, l) => s + l.minutes, 0))),
        h("td", { class: "num" }, inp),
        h("td", { class: "num after" }, "")));
    }
    table.append(body, h("tfoot", {}, h("tr", {}, h("td", {}, "Total"), h("td", { class: "num tot-n" }), h("td", { class: "num tot-before" }), h("td", {}), h("td", { class: "num tot-after" }))));
    update();
  };

  function update() {
    const logs = eligible();
    let before = 0, after = 0, changed = 0, bad = false;
    const perKey = {};
    for (const l of logs) {
      const k = catKey(l), f = factorOf(k);
      if (!(f > 0)) { bad = true; continue; }
      const m = convert(l.minutes, f);
      before += l.minutes;
      after += m;
      if (f !== 1) changed++;
      perKey[k] = (perKey[k] || 0) + m;
    }
    $$("tbody tr[data-key]", table).forEach((tr) => {
      const cell = $(".after", tr);
      if (cell) cell.textContent = perKey[tr.dataset.key] != null ? fmtMinutes(perKey[tr.dataset.key]) : "—";
    });
    const set = (sel, v) => { const c = $(sel, table); if (c) c.textContent = v; };
    set(".tot-n", logs.length);
    set(".tot-before", fmtMinutes(before));
    set(".tot-after", fmtMinutes(after));
    submit.disabled = bad || !changed;
    summary.textContent = bad
      ? "Every factor must be a number above 0."
      : changed
        ? `${changed} of ${logs.length} session${logs.length === 1 ? "" : "s"} on or before ${fmtDate(cutoff.value)} will be converted: ${fmtMinutes(before)} → ${fmtMinutes(after)} in total. Categories left at 1.00 and sessions after that date are not touched.`
        : "Nothing would change. Set a factor other than 1.00 for at least one category.";
  }

  cutoff.addEventListener("change", build);
  rounding.addEventListener("change", update);

  const done = Store.logList().filter((l) => l.convertedFactor).length;
  const form = h("form", { class: "form" },
    h("h2", {}, "Convert logged hours (one-time)"),
    h("p", { class: "small" }, "Multiplies the hours of every session dated on or before the cutoff by its task's category factor, so past logs match your timesheet hours. ",
      "A full backup (.json) is downloaded first. Converted sessions are marked and are never converted again, so running this twice is safe."),
    done ? h("p", { class: "field-hint form-note" }, `${done} session${done === 1 ? " was" : "s were"} already converted earlier and ${done === 1 ? "is" : "are"} left out.`) : null,
    h("div", { class: "form-row" }, field("Convert sessions up to and including", cutoff), field("Round each session to", rounding)),
    h("div", { class: "table-wrap" }, table),
    summary,
    h("div", { class: "form-actions" },
      h("button", { type: "button", class: "btn btn-ghost", onclick: () => Modal.close() }, "Cancel"),
      submit));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const all = eligible().map((l) => ({ l, f: factorOf(catKey(l)) }));
    if (all.some((p) => !(p.f > 0))) return;
    // Categories left at 1.00 are not touched or marked, so they can still be converted later.
    const plan = all.filter((p) => p.f !== 1).map((p) => ({ id: p.l.id, f: p.f, min: p.l.minutes }));
    if (!plan.length) return;
    const before = plan.reduce((s, p) => s + p.min, 0);
    if (!confirm(`Convert ${plan.length} sessions on or before ${fmtDate(cutoff.value)}? A backup will be downloaded first.`)) return;
    exportJSON();
    let after = 0;
    Store.commit((s) => {
      for (const { id, f } of plan) {
        const l = s.logs[id];
        if (!l) continue;
        l.originalMinutes = l.minutes;
        l.minutes = convert(l.minutes, f);
        l.convertedFactor = f;
        after += l.minutes;
      }
      const used = {};
      for (const [k, inp] of Object.entries(factors)) used[(Store.category(k) || {}).name || "Uncategorised"] = Number(inp.value);
      s.settings.hourConversions = (s.settings.hourConversions || []).concat([{ at: new Date().toISOString(), cutoff: cutoff.value, rounding: step(), factors: used, sessions: plan.length }]);
    });
    Modal.close();
    toast(`Converted ${plan.length} sessions: ${fmtMinutes(before)} → ${fmtMinutes(after)}.`);
  });

  Modal.open(form, { wide: true });
  build();
}
