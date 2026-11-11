# Loop Planner roadmap

A working document for iterating on Loop Planner deliberately, rather than
only reacting to bugs. It has five parts:

1. [Where Loop Planner stands](#1-where-loop-planner-stands)
2. [Evaluation of the `pid-to-kg` skill](#2-evaluation-of-the-pid-to-kg-skill)
3. [Building a knowledge graph and system descriptions](#3-building-a-knowledge-graph-and-system-descriptions)
4. [Product roadmap](#4-product-roadmap)
5. [Engineering practice: iterate instead of firefight](#5-engineering-practice-iterate-instead-of-firefight)

Each idea has a **why** (the problem it solves) and a **done when** (how to
know it works), so items can be picked up one at a time.

---

## 1. Where Loop Planner stands

**What it is today:** a browser tool to draw instrument loops with IEC
symbols, down to terminal level (X10:1 …), and to keep track of everything
that has to be ordered for every cable and item. Data stays in the browser;
JSON export/import and PDF drawing sheets move it elsewhere.

**Its real strength** is the *electrical/installation layer* of a loop:
cables, cores, glands, lugs, terminals, enclosures, and their order status.
P&IDs do not contain this layer. That makes Loop Planner complementary to
P&ID tools rather than a competitor.

**Its main structural weaknesses** (they cause most of the bugs):

| Weakness | Consequence |
|---|---|
| One 2,800-line `app.js` with shared mutable state | A change in one feature (e.g. symbol size) silently breaks another (e.g. click targets, box selection) |
| Browser tests exist only in throw-away scripts, not in the repo | Regressions are found by you, not by a pipeline |
| The data model is implicit (no schema, ad-hoc migrations) | Every new field needs care in copy/paste, import, migration and export |
| Geometry depends on rendered DOM sizes | Layout logic (routing, strips, zones) is hard to test without a browser |

Part 5 addresses these. They should come before large new features.

---

## 2. Evaluation of the `pid-to-kg` skill

Repository: <https://github.com/ScottDuncanAI/PID-to-Knowledge-Graph>
(version 0.1.0, MIT licence).

> **How this was evaluated:** by reading the README, the skill instructions
> (`SKILL.md`), the ontology, the data models, the loop inference, QA and the
> test suite. Running its code was blocked in this environment (code from an
> external repository), so **it was not executed here**. Run its own
> `pytest` suite and one small drawing set of yours before relying on it.

### What it does

It turns P&ID / PFD PDFs (vector or scanned) into a typed **process
knowledge graph**:

- **Nodes:** Plant, Sheet, Equipment, PipeSegment, Component (valves,
  fittings), Instrument, ControlLoop, OffPageConnector, Boundary.
- **Edges:** `FLOWS_TO`, `FEEDS` (equipment-level flow), `MEASURES`,
  `SIGNAL_TO`, `ACTUATES`, `MEMBER_OF`, `CASCADES_TO`, `TRIPS`, `PART_OF`.
- **Outputs:** `graph.json`, `graph.duckdb` (SQL with `upstream()` /
  `downstream()` macros), `summary.md` (LLM context) and `qa_report.md`.

Claude reads each sheet visually and writes one validated JSON file per
sheet. Python scripts do everything deterministic: page classification,
rendering into tiles, OCR hints, graph building, loop inference and QA.

### Strengths

1. **Sound division of labour.** The LLM does only what needs vision
   (recognising symbols, tracing lines). Building, merging and checking are
   deterministic and tested. This is the right architecture for
   engineering data.
2. **Provenance and confidence on every node.** Each item records the sheet,
   page and region it came from, so every answer can be checked against the
   drawing. Unreadable items are recorded as unreadable, not guessed.
3. **A real QA loop.** Errors and warnings (sensor without location,
   unmatched off-page connector, OCR tag missing from the extraction,
   duplicate revisions) point to the tile to re-check.
4. **Strict schemas.** Pydantic models with `extra="forbid"` reject
   malformed extractions early, with precise messages.
5. **Engineering conventions.** ISA-5.1 loop keys, DEXPI class hints, tags
   as ids, so the same item on several sheets merges into one node.
6. **Tests from real drawings.** The regression tests encode situations
   found on real permits (wrong off-page references, two revisions in one
   PDF, reused tags).
7. **Practical outputs.** DuckDB needs no server; GraphML and Neo4j exports
   exist for larger projects.

### Limitations and risks

1. **No electrical layer.** Loops are inferred from ISA tags and *drawn
   signal lines*. Cables, junction boxes, marshalling, terminals and I/O
   channels are not modelled. This is exactly what Loop Planner holds.
2. **Accuracy depends on the visual reading.** Small or faded text loses
   items. The skill flags rather than guesses, but completeness must still
   be checked by an engineer (the README says so explicitly).
3. **Cost and time.** Every sheet is read tile by tile by the model; a large
   set takes long and consumes many tokens. Plan it per area, not per plant.
4. **No incremental updates.** A new revision means re-extracting the
   sheet; there is no built-in diff between revisions.
5. **No review UI.** QA is a Markdown report. Reviewing hundreds of warnings
   against the drawings is slow without a viewer that shows the cropped
   region next to the extracted item.
6. **Early project.** Version 0.1.0, one author, OCR only on Python
   3.10–3.12. Treat it as a strong prototype, not certified tooling. The
   DEXPI mapping is informative only.

### Verdict

Well designed and worth building on for the **process side** (what is
connected to what, what measures what, which loops exist). It does not cover
the **installation side** (cables, terminals, materials). Combined with
Loop Planner, the two cover a loop end to end: from the P&ID bubble to the
terminal it lands on and the gland you have to order.

---

## 3. Building a knowledge graph and system descriptions

### 3.1 The idea: two layers, one key

```
 P&ID PDFs ──pid-to-kg──►  PROCESS GRAPH              LOOP PLANNER ──export──►  INSTALLATION GRAPH
                           Equipment, PipeSegment,                             Item, Cable, Core,
                           Instrument, ControlLoop                             Terminal, Enclosure,
                           FLOWS_TO, MEASURES,                                 OrderLine, Flag
                           SIGNAL_TO, ACTUATES                                 CONNECTS, LANDS_ON,
                                         \                                     MOUNTED_IN, NEEDS
                                          \                                   /
                                           ►  joined on the instrument TAG  ◄
                                              (PT-101, XV-102, FIC-0502 …)
                                                         │
                                                         ▼
                                     ONE PLANT GRAPH  →  questions, loop diagrams,
                                                         system descriptions, order lists
```

The **tag** is the join key. `pid-to-kg` already uses normalised tags as node
ids; Loop Planner items carry the same tags (PT-101). Keep tag spelling
identical in both (same separators, same zero padding).

### 3.2 Step by step

**Step 1: a graph export from Loop Planner** (new feature, see 4.1).
Export a `graph.json` that follows the same node-link shape as `pid-to-kg`,
with installation node types added:

| Loop Planner | Graph node | Notes |
|---|---|---|
| Transmitter, switch, temperature element, Hall sensor | `Instrument` (`location: field`) | Same id as in the P&ID graph: the tag |
| Solenoid valve / actuator | `Component` (`kind: solenoid_valve`) | |
| Motor | `Equipment` (`kind: motor`) | |
| PLC I/O card | `Instrument` (`location: plc`) + `IOChannel` nodes | Channels give "PT-101 is on AI-04 channel 3" |
| Junction box, cabinet | `Enclosure` (new type) | |
| Terminal strip | `TerminalStrip` + `Terminal` nodes (`X10:1`) | |
| Cable | `Cable` node | Type, cores, size, length, armour, screen |
| Core | `Core` node | Core 1…n, S |
| Order line | `Material` node | Status, quantity, category |
| Flag | attribute on the node | Colour, note |

New edges: `CONNECTS` (Cable → item, per end), `HAS_CORE`,
`LANDS_ON` (Core → Terminal, with side), `MOUNTED_IN` (item → Enclosure),
`NEEDS` (item or cable → Material).

**Step 2: run `pid-to-kg` on the P&IDs** of the same area, and check its QA
report.

**Step 3: merge** the two `graph.json` files on the tag (a ~100-line
script, or a DuckDB `JOIN`). Report tags that exist on only one side: a
P&ID instrument with no loop drawing yet, or a loop item missing from the
P&ID. That comparison alone is a valuable consistency check.

**Step 4: query.** With DuckDB or Neo4j:

- *"Show the full path of PT-101: process tap → transmitter → cable C-101 →
  JB-01:1–2 → C-110 → X10:1–2 → AI-04 channel 3."*
- *"Which loops still have materials to order, and which items block
  commissioning?"*
- *"Which junction boxes carry loops of the pump P-101?"* (process side:
  what is on P-101; installation side: where those cables go)
- *"Which cables have spare cores, and where?"*

**Step 5: system descriptions.** Give an LLM the merged graph (or a
generated `summary.md` like the one `pid-to-kg` writes) and ask for:

- a **control narrative** per loop: purpose, sensor, controller,
  final element, interlocks, from the process graph;
- an **installation description** per loop: cables, routes, junction
  boxes, terminals and I/O, from the Loop Planner graph;
- a **commissioning checklist** per loop: loop check steps with exact
  terminal numbers, plus the materials still missing.

Always generate *from the graph* (traceable) rather than from free text,
and keep the source sheet / loop reference in every sentence.

### 3.3 Ways to go further

- **Import from `pid-to-kg` into Loop Planner:** read its `graph.json`,
  offer each `ControlLoop` as a new loop with the sensor, controller and
  final element already placed. The engineer then adds cables and
  junction boxes. This turns Loop Planner into the next step after P&ID
  extraction.
- **A Claude skill for Loop Planner** (`loop-planner-kg`), built like
  `pid-to-kg`: deterministic scripts to export, merge, validate and
  query; Claude to answer questions and write descriptions with
  references.
- **Consistency checks across layers:** an `on_off` loop in the P&ID must
  have a DO channel; a 4–20 mA transmitter needs a shielded pair; an `Ex`
  area needs IS barriers. These are rules on the merged graph, reported
  like `pid-to-kg`'s QA.

---

## 4. Product roadmap

Ordered by value for the effort. "Now" items are small and unblock others.

### 4.1 Now

| Idea | Why | Done when |
|---|---|---|
| **Graph export** (`graph.json`, node-link, schema in the repo) | Enables everything in part 3; also a cleaner long-term backup format than the internal state | Export validates against a JSON Schema; a script can merge it with a `pid-to-kg` graph on tags |
| **Loop list / loop schedule view** | Engineers think in loops (PT-101 loop), not in drawings | A table: loop, devices, cables, terminals, I/O channel, order status, link to the drawing |
| **I/O channel assignment** | The I/O card symbol shows channels, but cores don't land on channel numbers yet | Cores on an I/O card show as `AI-04:CH3+ / CH3-`; an I/O list (tag, card, channel, signal type) can be exported |
| **Spare-terminal and spare-core rules** | Real projects require 10–20 % spares | Order quantities include a configurable spare percentage; cables show unused cores |
| **Undo / redo history** (more than one step) | One-step undo is not enough for drawing work | Ctrl+Z / Ctrl+Y over at least 50 steps, including moves |

### 4.2 Next

| Idea | Why | Done when |
|---|---|---|
| **Import a loop from `pid-to-kg`** | Start drawings from the P&ID instead of from scratch | A `ControlLoop` from `graph.json` becomes a loop with sensor, controller and final element placed |
| **Cable schedule export** (CSV / Excel) | The usual deliverable for installation contractors | Columns: tag, type, cores, size, from, to, length, glands, route, status |
| **Terminal (wiring) list export** | Panel builders need it | Per strip: terminal, left (cable/core), right (cable/core), jumpers |
| **Templates** ("4–20 mA field loop via JB", "DO to solenoid via relay") | Most loops are repetitive | Insert a template, rename tags once (PT-1xx), get items, cables and terminals |
| **Bulk tag renumbering** | Copying a typical loop leaves tags to fix | Rename `-101` → `-201` across a selection |
| **Design rules / QA panel** | Catch mistakes early, like `pid-to-kg` QA | Warnings such as: shielded cable with no screen earth, terminal clash, cable with no length, item with no cable |
| **Revision and status per loop** (draft, issued, as-built) | Engineering documents need revisions | Title block shows the revision; changes between revisions can be listed |

### 4.3 Later

| Idea | Why |
|---|---|
| **Shared projects** (several engineers, one project) via a small backend or a shared-storage capability | Today data lives in one browser |
| **Supplier part numbers and price lists** (optional, per company) | Turn reminders into a real bill of materials |
| **Cable routing over a plant layout image** (trays, lengths measured on the image) | Better length estimates |
| **DEXPI / IEC 81346 reference designations** (`=PLANT+CP01-X10:1`) | Interoperability with CAE tools |
| **Mobile check-off at the site** (tick materials as received, photo of the label) | Use the same data during installation |
| **Natural-language questions** inside the app, answered from the graph with references | Uses part 3 directly |

---

## 5. Engineering practice: iterate instead of firefight

These make every future feature cheaper and stop regressions from reaching
you.

1. **Move the browser tests into the repo** (`loop-planner/tests/`, Playwright)
   and run them in GitHub Actions on every pull request. The scripts used
   during development (symbol rendering, terminals, copy/paste, PDF, the
   screen-size audit) are the starting set. *Done when* a PR cannot merge
   with a failing test.
2. **Split `app.js` into modules** (ES modules, no build step needed):
   `model/` (state, migrations, schema), `catalog/` (types, cables, items to
   order), `geometry/` (routing, strips, zones; pure functions with unit
   tests), `render/` (diagram, inspector, order list, PDF), `input/`
   (pointer, keyboard, clipboard). *Done when* geometry and numbering can be
   unit-tested without a browser.
3. **Write the data model down**: a JSON Schema for the saved state, a
   `version` field, and one migration function per version, tested with
   saved files from each version. *Done when* importing an old export is
   covered by a test.
4. **Keep a CHANGELOG** and tag releases (`loop-planner-v1.4.0`). Users can
   then see what changed, and a bad release can be identified quickly.
5. **Define a small "golden" set of example loops** (4–20 mA via JB,
   solenoid via relay, motor feeder, IS loop with barrier) and keep
   screenshots and PDFs of them. Visual changes are then reviewed against
   known-good output.
6. **A feedback loop with real use:** after each working session, note in
   an issue what was slow, missing or confusing. Pick the next item from
   that list and this roadmap, not only from bug reports.

### How to use this document

- Pick one item from **4.1** or **5** per iteration.
- Write its *done when* as tests first, then build it.
- After release, move it to the CHANGELOG and revisit the list.
