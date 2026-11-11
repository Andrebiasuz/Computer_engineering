# Loop Planner

Draw an instrument or control loop by drag and drop, and get a reminder of
everything you need to **order** for each item and each cable: cable, glands,
lugs and ferrules, core markers, cable tags, terminal blocks, end stops,
screen earth terminals, tray or conduit, and so on.

It is not a parts database. It doesn't know part numbers or prices; it only
makes sure nothing is forgotten on the purchase list.

## Symbols

Components are drawn with IEC symbols, like a loop diagram: instrument
circles per IEC 62424 / ISA 5.1 (field-mounted, letters and loop number),
and IEC 60617 symbols for the motor (M 3~), valve with solenoid actuator,
terminal strip, junction box, cabinet (dash-dot), PLC I/O card with
channels, signal isolator (galvanic separation), relay (coil + contact),
AC/DC power supply, fuse and amplifier. The tag, service, order status and
material chips are written under each symbol, and cables attach to the
symbol's edges. Your own components can use any of these symbols.

## Terminals

With **Terminals** on (toolbar), terminal strips, junction boxes, cabinets,
panel equipment and anything mounted inside a panel or junction box show
their terminal strip under the symbol. Cables run as one line between items
and break out into their cores just before the strip, each core drawn to its
terminal. Terminals are named after the item, e.g. **X10:1**.

- Numbering is automatic, per side of the strip as drawn (left / right), so
  a field core and the panel wire that continues it share terminal X10:3.
  A shielded cable's screen (S) gets its own terminal.
- A cable's panel has a **Cores & terminals** table: type a number to fix a
  core to a terminal. Other cores keep their numbers; a core whose terminal
  you took moves to the next free one. A red mark shows two cores sharing a
  terminal on the same side. *Automatic numbers* resets the cable.
- An item's panel shows its **terminal schedule**: every terminal with what
  lands on the left and right side.
- Terminal-block quantities in the order list follow the terminals used.
- Turn **Terminals** off for a compact view with one line per cable.

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
   to step it: **To order → Ordered → In stock → Not needed**. The **All ordered / All
   in stock / All not needed** buttons set every open line at once. Add your own
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
   Drag the junction box / cabinet card itself to place it anywhere in its
   zone; drag the dashed outline or its label to move the enclosure with
   everything inside.
9. **Mirror** (above the sheet) flips the loop left ↔ right, e.g. to put the
   PLC on the left and the field instruments on the right.

10. **Select and move**: drag on an empty part of the sheet to draw a
    selection box (like CAD: left → right selects only items fully inside
    the box, right → left selects everything it touches), or Shift+click (Ctrl+click) items to add or remove them;
    Ctrl+A selects everything. Drag any selected item to move them all,
    nudge with the arrow keys (Shift for bigger steps), Delete removes them
    (with Undo).
11. **Copy and paste**: Ctrl+C copies the selected items, the cables
    between them and anything mounted inside a copied enclosure; Ctrl+V
    pastes at the mouse pointer (press it again elsewhere for more copies),
    Ctrl+X cuts and Ctrl+D duplicates. Pasted items get the next free tags
    (PT-101 → PT-102) and start as "To order"; notes, quantities and your own
    reminders are kept. Tick **Copies keep order statuses** in the side
    panel (or press Ctrl+Shift+V) to paste with the original's statuses
    too. You can paste into another loop.
    **Cables** can be copied too: select a cable and press Ctrl+C, then
    Ctrl+V and click two items to connect them with a copy (repeat for as
    many pairs as you like, Esc to finish), or click an existing cable to
    give it the copied settings (type, cores, size, length, route, ends,
    reminders). With two items or a cable already selected, Ctrl+V applies
    straight away.
12. **Endless sheet, CAD-style navigation**: there are no edges. The mouse
    wheel zooms around the cursor, dragging with the middle button (or Space
    + drag) pans, and double-clicking the middle button zooms to extents
    (same as **Fit**). On touch screens, drag with one finger to pan and
    pinch to zoom.

Cables are drawn at right angles: each leaves from the side of the item
facing the other end, and cables sharing a side are fanned out.

**Flags** keep track of components that need attention: select an item or a
cable and pick a flag colour in the side panel (or press **F**), then add a
note such as "waiting for quote". Flagged components get a thick border in
the flag colour, a ⚑ pin and their note on the drawing. **⚑ Flagged (n)**
above the sheet lists them all with their notes; click one to jump to it,
or tick *Fade everything else*. Flags are saved with the loop, and the
order list marks rows of flagged components.

**Find material** (above the sheet) marks where a material is needed: pick one
or more material types (Cable, Lugs & ferrules, Glands, Markers…) and/or
type a word (ferrule, gland, M20, Hall…). Matching items and cables are
outlined in violet with a count, everything else fades, and the matching
lines are marked in the checklist and the order list. Tick *Only still to
order* to see just what is left to buy. **Clear** turns it off.

**Cable labels** can be dragged anywhere to tidy the drawing. A label stays
tied to its cable (it follows when items move) and a dashed leader line
points back to the cable when it is moved away. *Reset label position* in
the cable's panel puts it back; a plain click on a label still selects the
cable.

**Deleting an item keeps its cables**: each one is left with an open end
(a dashed ◯) where the item was. Drag the open end onto another item to
reconnect it, or choose an item under *Ends → Connect to…* in the cable's
panel. The cable keeps its settings and order statuses; Undo restores the
item.

**Images**, like in AutoCAD: press **Ctrl+V** with a picture on the
clipboard (a screenshot, a picture copied from a document or web page) to
insert it at the mouse pointer, drop image files on the sheet, or use
**Image…** to attach a file. Click an image to select it, then drag it to
move it or drag a corner grip to scale it (proportions are kept). The side
panel sets its name, size, **Fade**, **Frame**, **Lock** and draw order
(**Send to back** / **Bring to front**; new images go behind items and
cables). Ctrl+C / Ctrl+V copies it, Delete removes it. Whichever you copied
last — a picture elsewhere or items in Loop Planner — is what Ctrl+V pastes.
Pictures are stored in the browser's IndexedDB (not the 5 MB localStorage)
and are included in **Export** / **Import**.

Drag the border of the component list (left) or the details panel (right)
to make it wider or narrower; double-click a border to reset it. Widths are
remembered. The drawing follows: whatever was visible on the sheet stays
visible (it is rescaled around its centre while you drag), and narrowing
the panel back returns to the same view. The same happens when the browser
window is resized. Panel contents reflow to the panel width.

The **◐ Auto / ☀ Light / ☾ Dark** button in the top bar switches the colour
theme. Auto follows your operating system; the choice is remembered.

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
