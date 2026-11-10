# Loop Planner

Draw an instrument or control loop by drag and drop, and get a reminder of
everything you need to **order** for each item and each cable: cable, glands,
lugs and ferrules, core markers, cable tags, terminal blocks, end stops,
screen earth terminals, tray or conduit, and so on.

It is not a parts database. It doesn't know part numbers or prices; it only
makes sure nothing is forgotten on the purchase list.

## How to use it

1. **Add items**: drag a component from the left (transmitter, valve, motor,
   junction box, terminal strip, PLC I/O card, power supply...) onto the
   sheet. On a phone, tap it.
2. **Draw cables**: drag from the round handle on the right of an item to
   another item. A cable type is suggested from what it connects (panel wire
   between panel items, multipair from a JB to marshalling, power cable to a
   motor...). Change it in the panel on the right.
3. **Describe the cable**: type, cores/pairs, size (e.g. `1.5 mm²`), length,
   route, shielded, armoured, and for each end: termination (ferrules, ring
   lugs, fork/pin lugs, connector) and whether a gland is needed.
4. **Tick things off**: every item and cable has a checklist. Click a status
   to step it: **To order → Ordered → In stock → Not needed**. Add your own
   reminders with "Add an item".
5. **See what is missing**: on the diagram, each item shows a badge with the
   number of things still to order, cables turn **red** (something to order),
   **amber dashed** (ordered, waiting) or **green** (done), and small chips show
   which kind of item is pending (`CBL` cable, `LUG` lugs and ferrules, `GLD`
   glands, `MRK` markers, `TRM` terminals, `DEV` devices, `MNT` mounting and
   routing...).
6. **Order list** tab: everything grouped by category, filtered by status, for
   this loop or all loops. "Per branch" lists each cable/item separately;
   "Totals" sums identical items (e.g. all 1.0 mm² ferrules). Copy it as text
   or download a CSV.

7. **Your own components**: under *My components* in the palette, click
   **+ New component** to define an item you use often (e.g. a Hall sensor
   or a charge amplifier): name, tag prefix, symbol, and the list of things
   to order every time it appears. Click ✎ to edit one later; changes apply
   to every copy on your loops. Hall sensor and charge amplifier are
   included as examples.
8. **Mounted inside**: select an item and set *Mounted inside* to a junction
   box or cabinet. It is drawn inside that enclosure's dashed outline and
   moves with it. A cable coming from outside gets its gland on the
   enclosure ("Cable gland at JB-01 (for CA-101)"), and wiring between items
   in the same enclosure defaults to panel wire with no glands.
9. **Mirror** (above the sheet) flips the loop left ↔ right, e.g. to put the
   PLC on the left and the field instruments on the right.

10. **Select and move**: drag on an empty part of the sheet to draw a
    selection box (like CAD: left → right selects only items fully inside
    the box, right → left selects everything it touches), or Shift+click (Ctrl+click) items to add or remove them;
    Ctrl+A selects everything. Drag any selected item to move them all,
    nudge with the arrow keys (Shift for bigger steps), Delete removes them
    (with Undo). Hold Space and drag, or drag with the middle mouse button,
    to pan the sheet.

Cables are drawn at right angles: each leaves from the side of the item
facing the other end, and cables sharing a side are fanned out.

Quantities are suggestions (cores + drain wire for ferrules, route length
+10% for cable, terminals from the cores landing on a strip). Type your own
number in the quantity box to override.

## Data

Everything is stored in your browser (`localStorage`). Use **Export** to save
all loops to a `.json` file and **Import** to load it again or move it to
another computer. Several loops can be kept side by side (New / Duplicate).

## Running it

Static HTML/CSS/JS with no dependencies: open `index.html`, or serve the
folder (`python3 -m http.server`) and open `http://localhost:8000`.
