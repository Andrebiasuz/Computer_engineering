/* Loop Planner — draw an instrument/control loop and get reminded of every
   item to order on each branch (cables, glands, lugs, ferrules, markers...).
   Plain JS, no dependencies, data kept in localStorage. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const STORE_KEY = 'loop-planner-v1';
  const GRID = 10, NODE_W = 60, ZMIN = 0.1, ZMAX = 4; // NODE_W: default symbol width

  const STATUS = ['todo', 'ordered', 'have', 'na'];
  const STATUS_LABEL = { todo: 'To order', ordered: 'Ordered', have: 'In stock', na: 'Not needed' };

  // Categories, in the order they are listed. `s` is the chip shown on the diagram.
  const CAT = {
    cable:    { s: 'CBL', n: 'Cable & wire' },
    term:     { s: 'LUG', n: 'Lugs, ferrules & connectors' },
    gland:    { s: 'GLD', n: 'Glands & cable entries' },
    mark:     { s: 'MRK', n: 'Markers & tags' },
    terminal: { s: 'TRM', n: 'Terminals & DIN rail' },
    device:   { s: 'DEV', n: 'Devices & modules' },
    protect:  { s: 'PRT', n: 'Protection' },
    mount:    { s: 'MNT', n: 'Mounting & cable routing' },
    process:  { s: 'PRC', n: 'Process hook-up' },
    consum:   { s: 'CNS', n: 'Consumables' },
    other:    { s: 'OTH', n: 'Other' }
  };
  const CAT_KEYS = Object.keys(CAT);

  // Item spec: [key, name, category, qty(ctx) -> number, unit, hint(ctx) -> string]
  const TB_ITEMS = [
    ['tb', 'Terminal blocks', 'terminal', c => (c.terminals - (c.exiTerminals || 0)) || '', 'pcs', c => c.cores ? `${c.terminals - (c.exiTerminals || 0)} terminals used by ${c.cores} cores landing. Add spares.` : 'Count follows the cables you connect'],
    ['tbexi', 'Ex i terminal blocks (light blue)', 'terminal', c => c.exiTerminals || '', 'pcs', c => `${c.exiTerminals} terminals of intrinsically safe circuits`],
    ['endplate', 'End plates', 'terminal', () => 1, 'pcs'],
    ['endstop', 'End stops / end clamps', 'terminal', () => 2, 'pcs'],
    ['jumper', 'Bridging jumpers (commons, 0 V, screens)', 'terminal', null, 'pcs'],
    ['tbmark', 'Terminal markers', 'mark', c => c.terminals || '', 'pcs'],
    ['earth', 'Screen / earth terminals', 'terminal', c => c.shielded || '', 'pcs', c => c.shielded ? `${c.shielded} shielded cable(s) connected` : ''],
    ['rail', 'DIN rail', 'terminal', null, 'm']
  ];

  const TYPES = {
    tx: { group: 'Field devices', name: 'Transmitter (4–20 mA)', shape: 'bubble', tag: 'PT-', desc: 'Pressure transmitter', items: [
      ['dev', 'Transmitter', 'device', () => 1, 'pcs'],
      ['mount', 'Mounting bracket / 2" pipe stand', 'mount', () => 1, 'pcs'],
      ['proc', 'Manifold, fittings, impulse tubing', 'process'],
      ['tagplate', 'Stainless tag plate + fixing wire', 'mark', () => 1, 'pcs'],
      ['blank', 'Blanking plug for the spare cable entry', 'gland', () => 1, 'pcs']
    ] },
    temp: { group: 'Field devices', name: 'Temperature element', shape: 'bubble', tag: 'TE-', desc: 'RTD Pt100', items: [
      ['dev', 'RTD / thermocouple element', 'device', () => 1, 'pcs'],
      ['well', 'Thermowell (length, process connection)', 'process', () => 1, 'pcs'],
      ['head', 'Connection head / head-mount transmitter', 'device', () => 1, 'pcs'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs']
    ] },
    sw: { group: 'Field devices', name: 'Switch / discrete sensor', shape: 'bubble', tag: 'LS-', desc: 'Level switch', items: [
      ['dev', 'Switch / sensor', 'device', () => 1, 'pcs'],
      ['mount', 'Mounting bracket', 'mount', () => 1, 'pcs'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs'],
      ['blank', 'Blanking plug for the spare cable entry', 'gland', () => 1, 'pcs']
    ] },
    valve: { group: 'Field devices', name: 'Solenoid valve / actuator', shape: 'valve', tag: 'XV-', desc: 'On/off valve', items: [
      ['dev', 'Valve / actuator', 'device', () => 1, 'pcs'],
      ['coil', 'Solenoid coil (check voltage: 24 VDC / 230 VAC)', 'device', () => 1, 'pcs'],
      ['plug', 'Coil connector plug (DIN 43650 / M12)', 'term', () => 1, 'pcs'],
      ['ls', 'Limit switch box / position feedback', 'device'],
      ['pneu', 'Air tubing, fittings, filter regulator', 'process'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs']
    ] },
    motor: { group: 'Field devices', name: 'Motor', shape: 'motor', sym: 'M', tag: 'M-', desc: 'Pump motor', term: 'ringlug', items: [
      ['iso', 'Local isolator / safety switch', 'protect', () => 1, 'pcs'],
      ['pe', 'Earth lug + green/yellow bonding conductor', 'term', () => 1, 'pcs'],
      ['entry', 'Thread adaptor / reducer for the terminal box entry', 'gland'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs']
    ] },
    kp: { group: 'Field devices', name: 'Keyphasor / prox probe', shape: 'probe', tag: 'KP-', desc: 'Keyphasor, gas generator', term: 'connector', items: [
      ['dev', 'Proximity probe (check model, tip size and total system length)', 'device', () => 1, 'pcs'],
      ['holder', 'Probe holder / sleeve, lock nut and anti-rotation', 'mount', () => 1, 'pcs'],
      ['protect', 'Connector protector / insulating sleeve for the probe–extension joint', 'term', () => 1, 'pcs'],
      ['target', 'Keyphasor target on the shaft: notch or projection (confirm with the machine vendor)', 'process'],
      ['tagplate', 'Tag plate + fixing wire', 'mark', () => 1, 'pcs']
    ] },
    prox: { group: 'Field devices', name: 'Proximitor (probe driver)', shape: 'proximitor', tag: 'GA-', desc: 'Proximitor for the Keyphasor probe', items: [
      ['dev', 'Proximitor / probe driver (same system length as probe + extension cable)', 'device', () => 1, 'pcs'],
      ['base', 'Isolated mounting base / DIN-rail adaptor (keep the case off ground)', 'mount', () => 1, 'pcs'],
      ['inprot', 'Connector protector for the IN connection', 'term', () => 1, 'pcs'],
      ['supply', '−24 VDC supply for VT (from the monitor rack or a separate supply)', 'device'],
      ['mark', 'Device label', 'mark', () => 1, 'pcs']
    ] },
    jb: { group: 'Enclosures', name: 'Junction box', shape: 'jb', sym: 'JB', tag: 'JB-', desc: 'Field junction box', items: [
      ['encl', 'Enclosure (IP rating, size, material)', 'device', () => 1, 'pcs'],
      ...TB_ITEMS,
      ['plugs', 'Blanking / stopping plugs for unused entries', 'gland', null, 'pcs'],
      ['breather', 'Breather / drain plug', 'gland', () => 1, 'pcs'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs']
    ] },
    panel: { group: 'Enclosures', name: 'Cabinet / panel', shape: 'panel', sym: 'CP', tag: 'CP-', desc: 'Control panel', items: [
      ['encl', 'Enclosure / cabinet', 'device', () => 1, 'pcs'],
      ['gplate', 'Gland plate (drilled for all entries)', 'gland', () => 1, 'pcs'],
      ['duct', 'Wire duct + covers', 'mount', null, 'm'],
      ['rail', 'DIN rail', 'terminal', null, 'm'],
      ['ebar', 'Earth bar', 'terminal', () => 1, 'pcs'],
      ['climate', 'Heater / fan / thermostat', 'device'],
      ['light', 'Panel light + door switch', 'device'],
      ['pocket', 'Drawing pocket', 'other', () => 1, 'pcs'],
      ['labels', 'Engraved labels for door devices', 'mark']
    ] },
    tb: { group: 'Panel', name: 'Terminal strip', shape: 'terminal', sym: 'X', tag: 'X', desc: 'Marshalling terminals', items: [
      ...TB_ITEMS,
      ['group', 'Strip marker / group label carrier', 'mark', () => 1, 'pcs']
    ] },
    plc: { group: 'Panel', name: 'PLC I/O card', shape: 'io', sym: 'I/O', tag: 'AI-', desc: 'Analog input card', items: [
      ['dev', 'I/O module', 'device', () => 1, 'pcs'],
      ['front', 'Front connector / terminal plug', 'term', () => 1, 'pcs'],
      ['base', 'Base unit / bus connector / free slot', 'device', () => 1, 'pcs'],
      ['shield', 'Shield clamp / shield bus', 'terminal'],
      ['labels', 'Channel labelling strips', 'mark', () => 1, 'pcs']
    ] },
    iso: { group: 'Panel', name: 'Isolator / IS barrier', shape: 'isolator', sym: 'ISO', tag: 'ISO-', desc: 'Signal isolator', items: [
      ['dev', 'Isolator / barrier module', 'device', () => 1, 'pcs'],
      ['pbus', 'Power rail / bus connector', 'terminal', () => 1, 'pcs'],
      ['ex', 'Light-blue IS wire, duct and IS labels (if Ex i)', 'mark']
    ] },
    relay: { group: 'Panel', name: 'Interposing relay', shape: 'relay', sym: 'K', tag: 'K', desc: 'Interposing relay', items: [
      ['dev', 'Relay', 'device', () => 1, 'pcs'],
      ['socket', 'Relay socket / base', 'device', () => 1, 'pcs'],
      ['clip', 'Retaining clip', 'device', () => 1, 'pcs'],
      ['supp', 'Suppression diode / RC module', 'protect', () => 1, 'pcs'],
      ['mark', 'Relay marker', 'mark', () => 1, 'pcs']
    ] },
    psu: { group: 'Power', name: 'Power supply 24 VDC', shape: 'psu', sym: 'PSU', tag: 'PSU-', desc: '24 VDC loop supply', items: [
      ['dev', 'Power supply unit (check current)', 'device', () => 1, 'pcs'],
      ['mcb', 'Upstream MCB', 'protect', () => 1, 'pcs'],
      ['dist', 'Distribution terminals for +24 V / 0 V', 'terminal'],
      ['outfuse', 'Output fuse terminals per loop', 'protect']
    ] },
    mcb: { group: 'Power', name: 'Breaker / fuse', shape: 'fuse', sym: 'F', tag: 'F', desc: 'Loop fuse', items: [
      ['dev', 'MCB / fuse terminal', 'protect', () => 1, 'pcs'],
      ['links', 'Fuse links + spares', 'protect'],
      ['comb', 'Busbar comb', 'terminal'],
      ['mark', 'Device label', 'mark', () => 1, 'pcs']
    ] },
    generic: { group: 'Other', name: 'Other item', shape: 'box', sym: '•', tag: '', desc: 'Custom item', items: [
      ['dev', 'The item itself', 'device', () => 1, 'pcs']
    ] }
  };
  const PANEL_TYPES = ['tb', 'plc', 'iso', 'relay', 'psu', 'mcb', 'panel'];
  const ENCLOSURE_TYPES = ['jb', 'panel'];
  // Palette order, left to right on the drawing: control side first, field last.
  const GROUP_ORDER = ['Panel', 'Power', 'Enclosures', 'Field devices', 'Other'];

  // Component types the user defined ("My components"), stored in state.customTypes.
  function T(type) {
    if (TYPES[type]) return TYPES[type];
    const c = state && (state.customTypes || []).find(x => x.id === type);
    if (!c) return TYPES.generic;
    const own = (c.items || []).map(it => [it.key, it.name || 'Item', CAT[it.cat] ? it.cat : 'other',
      it.qty === '' || it.qty == null || isNaN(Number(it.qty)) ? null : () => Number(it.qty), it.unit || 'pcs']);
    return {
      group: 'My components', name: c.name || 'Component', shape: SYMBOLS[c.shape] ? c.shape : 'box',
      sym: (c.sym || '?').slice(0, 4), tag: c.tag || '', desc: c.desc || '', panel: !!c.panel, enclosure: !!c.enclosure,
      custom: true, items: (c.terminals ? TB_ITEMS : []).concat(own)
    };
  }
  const isPanel = type => PANEL_TYPES.includes(type) || !!T(type).panel;
  const isEnclosure = type => ENCLOSURE_TYPES.includes(type) || !!T(type).enclosure;
  function starterTypes() {
    return [
      { id: 'u_hall', name: 'Hall sensor', tag: 'HS-', shape: 'bubble', sym: 'HS', desc: 'Hall effect sensor', panel: false, enclosure: false, terminals: false,
        items: [
          { key: 'dev', name: 'Hall sensor', cat: 'device', qty: 1, unit: 'pcs' },
          { key: 'mount', name: 'Mounting bracket / target magnet', cat: 'mount', qty: 1, unit: 'pcs' },
          { key: 'conn', name: 'Connector / pigtail (M8 / M12)', cat: 'term', qty: 1, unit: 'pcs' },
          { key: 'tagplate', name: 'Tag plate', cat: 'mark', qty: 1, unit: 'pcs' }
        ] },
      { id: 'u_camp', name: 'Charge amplifier', tag: 'CA-', shape: 'amplifier', sym: 'CA', desc: 'Charge amplifier', panel: false, enclosure: false, terminals: false,
        items: [
          { key: 'dev', name: 'Charge amplifier', cat: 'device', qty: 1, unit: 'pcs' },
          { key: 'mount', name: 'DIN rail adapter / mounting kit', cat: 'mount', qty: 1, unit: 'pcs' },
          { key: 'coax', name: 'Low-noise input cable / BNC adaptor', cat: 'term', qty: 1, unit: 'pcs' },
          { key: 'fuse', name: 'Supply fuse terminal', cat: 'protect', qty: 1, unit: 'pcs' },
          { key: 'label', name: 'Device label', cat: 'mark', qty: 1, unit: 'pcs' }
        ] }
    ];
  }

  // fixed: cores fixed by the cable type; pairs: n counts pairs.
  const CABLES = {
    pair:      { name: 'Instrument cable, 1 pair, shielded', short: '1 pr', fixed: 2, field: true, shielded: true },
    triad:     { name: 'Instrument cable, 1 triad, shielded', short: '1 tr', fixed: 3, field: true, shielded: true },
    multipair: { name: 'Multipair instrument cable', short: 'pr', pairs: true, defN: 4, field: true, shielded: true },
    control:   { name: 'Control cable, multicore', short: 'c', defN: 3, field: true, shielded: false },
    power:     { name: 'Power cable', short: 'c', defN: 4, field: true, shielded: false },
    tc:        { name: 'Thermocouple extension cable', short: 'TC', fixed: 2, field: true, shielded: true },
    coax:      { name: 'Probe extension cable (coax; probe + extension = system length)', short: 'coax', fixed: 1, field: true, shielded: true, term: 'connector' },
    bus:       { name: 'Fieldbus / Ethernet cable', short: 'bus', fixed: 4, field: true, shielded: true, term: 'connector' },
    wire:      { name: 'Panel wire (single cores)', short: 'w', defN: 2, field: false, shielded: false }
  };
  const TERMS = {
    ferrule:   'Bootlace ferrules',
    ringlug:   'Ring lugs (check stud size)',
    forklug:   'Fork lugs',
    pinlug:    'Pin lugs',
    connector: 'Connector (RJ45 / M12 / plug)',
    none:      'Nothing (bare wire / spring clamp)'
  };
  const ROUTES = {
    tray: 'Cable tray / ladder', conduit: 'Conduit', buried: 'Buried / duct bank',
    duct: 'Wire duct (inside panel)', none: 'Already in place'
  };

  const GENERAL_ITEMS = [
    ['ties', 'Cable ties (assorted, UV-resistant outdoors)', 'consum'],
    ['hs', 'Heat-shrink assortment', 'consum'],
    ['labels', 'Label printer tape / marker sleeves', 'mark'],
    ['ge', 'Green/yellow earth wire', 'cable', null, 'm'],
    ['spfuse', 'Spare fuses', 'protect'],
    ['spare', 'Spare terminals, end stops and DIN rail', 'terminal']
  ];

  // ---------------------------------------------------------------- state
  let state = null;          // loaded in init()
  let sel = null;            // { kind: 'node'|'link'|'multi'|'type', id }
  let selNodes = new Set();  // node ids when sel.kind === 'multi'
  let spaceDown = false;     // hold Space to pan with the mouse
  let zoom = 1, panX = 0, panY = 0; // camera: screen = world * zoom + pan (endless sheet)
  let view = 'diagram';
  let orderScope = 'loop', orderFilter = 'todo', orderGroup = 'branch';
  let sizes = {};            // node id -> { w, h } measured after render
  let undoSnapshot = null, toastTimer = null;
  let confirmAction = null;

  const $ = id => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const cur = () => state.loops.find(l => l.id === state.currentId) || state.loops[0];

  // Items used to be 168 px wide cards; symbols are about 60 px. On first load with symbols,
  // shift each item so its centre stays where the card's centre was (layout looks the same).
  let migratedNow = false; // set when an older layout was converted, so it gets saved once
  function migrateHiddenInfo(data) { // earlier versions hid the whole cable; now only its information
    (data.loops || []).forEach(lp => (lp.links || []).forEach(k => { if (k.hidden) { k.infoHidden = true; delete k.hidden; } }));
    return data;
  }
  function migrateToSymbols(data) {
    if (data.symbolVersion >= 2) return data;
    migratedNow = true;
    (data.customTypes || []).forEach(c => { if (c.id === 'u_camp' && c.shape === 'box') c.shape = 'amplifier'; });
    const shapeOf = type => {
      const t = TYPES[type] || (data.customTypes || []).find(c => c.id === type) || {};
      return SYMBOLS[t.shape] ? SYMBOLS[t.shape] : SYMBOLS.box;
    };
    // old card: 168 px wide, centre about 44 px down; new symbol: (w+4) x (h+4) incl. stroke margin
    (data.loops || []).forEach(l => (l.nodes || []).forEach(n => {
      const sy = shapeOf(n.type);
      n.x = Math.round(n.x + 84 - (sy.w + 4) / 2);
      n.y = Math.round(n.y + 44 - (sy.h + 4) / 2);
    }));
    data.symbolVersion = 2;
    return data;
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.loops) && data.loops.length) {
          if (!Array.isArray(data.customTypes)) data.customTypes = starterTypes();
          return migrateToSymbols(migrateHiddenInfo(data));
        }
      }
    } catch (e) { /* storage unavailable: start with the example */ }
    state = { version: 1, customTypes: starterTypes(), loops: [] };
    const ex = exampleLoop();
    state.loops.push(ex); state.currentId = ex.id;
    return migrateToSymbols(state);
  }
  let saveTimer = null;
  // ---------------------------------------------------------------- images (stored in IndexedDB, not localStorage)
  const IMG_DB = 'loop-planner-images';
  let idbP = null;
  const imgCache = new Map(); // blob id -> { data: dataURL, url: object URL }
  function idb() {
    if (!idbP) idbP = new Promise((res, rej) => {
      const r = indexedDB.open(IMG_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return idbP;
  }
  function dataToUrl(data) {
    try {
      const [head, b64] = data.split(',');
      const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return URL.createObjectURL(new Blob([arr], { type: mime }));
    } catch (e) { return data; }
  }
  async function imgPut(id, data) {
    imgCache.set(id, { data, url: dataToUrl(data) });
    try {
      const db = await idb();
      await new Promise((res, rej) => { const t = db.transaction('img', 'readwrite'); t.objectStore('img').put(data, id); t.oncomplete = res; t.onerror = () => rej(t.error); });
    } catch (e) { toast('This browser could not store the image; it will be lost on reload. Export to keep it.'); }
  }
  async function imgGet(id) {
    if (imgCache.has(id)) return imgCache.get(id);
    try {
      const db = await idb();
      const data = await new Promise((res, rej) => { const r = db.transaction('img').objectStore('img').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      if (data) { const v = { data, url: dataToUrl(data) }; imgCache.set(id, v); return v; }
    } catch (e) { /* unavailable */ }
    return null;
  }
  const imgUrl = id => (imgCache.get(id) || {}).url || '';
  function allImageRefs() {
    const ids = new Set();
    state.loops.forEach(l => (l.images || []).forEach(im => ids.add(im.img)));
    const c = readClip(); if (c && c.image) ids.add(c.image.img);
    return ids;
  }
  // load the pictures used by the drawing, then drop stored pictures nothing uses any more
  async function loadImages() {
    const refs = allImageRefs();
    await Promise.all([...refs].map(imgGet));
    renderDiagram();
    try {
      const db = await idb();
      const keys = await new Promise((res, rej) => { const r = db.transaction('img').objectStore('img').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const t = db.transaction('img', 'readwrite');
      keys.filter(k => !refs.has(k)).forEach(k => t.objectStore('img').delete(k));
    } catch (e) { /* ignore */ }
  }
  const loadImgEl = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const readAsData = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  async function insertImage(blob, at) {
    if (!blob || !/^image\//.test(blob.type)) { toast('That is not an image file.'); return; }
    let data = await readAsData(blob);
    let el;
    try { el = await loadImgEl(data); } catch (e) { toast('This image format cannot be shown in the browser.'); return; }
    let nw = el.naturalWidth, nh = el.naturalHeight;
    const MAX = 2400; // keep stored pictures reasonable
    if (Math.max(nw, nh) > MAX) {
      const k = MAX / Math.max(nw, nh);
      const cv = document.createElement('canvas'); cv.width = Math.round(nw * k); cv.height = Math.round(nh * k);
      cv.getContext('2d').drawImage(el, 0, 0, cv.width, cv.height);
      data = blob.type === 'image/jpeg' ? cv.toDataURL('image/jpeg', 0.9) : cv.toDataURL('image/png');
      nw = cv.width; nh = cv.height;
    }
    const blobId = 'b' + uid() + uid();
    await imgPut(blobId, data);
    const loop = cur();
    loop.images = loop.images || [];
    let w = nw, h = nh;
    if (w > 600) { h = h * 600 / w; w = 600; }
    const vp = $('viewport'), r = vp.getBoundingClientRect();
    const pos = at || toWorld(r.left + vp.clientWidth / 2, r.top + vp.clientHeight / 2);
    const im = { id: uid(), img: blobId, name: (blob.name && blob.name !== 'image.png') ? blob.name : 'Pasted image', x: snap(pos.x - w / 2), y: snap(pos.y - h / 2), w: Math.round(w), h: Math.round(h), nw, nh, fade: 0, frame: true, locked: false, front: false };
    snapshot();
    loop.images.push(im);
    if (view !== 'diagram') setView('diagram');
    select({ kind: 'image', id: im.id });
    save();
    toast('Image inserted. Drag it to move, drag a corner to scale; fade, frame, lock and draw order are on the right.', true);
  }
  const imageById = (loop, id) => (loop.images || []).find(i => i.id === id);

  // ---------------------------------------------------------------- undo / redo (Ctrl+Z, Ctrl+Y)
  // Every saved change is one step. The loop being shown is not part of a step, but each step
  // remembers its loop, so undo shows the loop it changed. Typing in one field is one step.
  const HIST_MAX = 200;
  let histPast = [], histFuture = [], histLast = null, histRestoring = false;
  let histGroup = null, histLastGroup = null, histT = 0;
  function stateKey() {
    const c = state.currentId;
    delete state.currentId;
    const k = JSON.stringify(state);
    state.currentId = c;
    return k;
  }
  function record() {
    if (histRestoring || !state) return;
    const k = stateKey();
    if (histLast === null || k === histLast) { histLast = k; histGroup = null; return; }
    const now = Date.now();
    const merge = histGroup && histGroup === histLastGroup && now - histT < 2000 && histPast.length;
    if (!merge) {
      histPast.push({ data: histLast, loopId: state.currentId });
      if (histPast.length > HIST_MAX) histPast.shift();
    }
    histFuture = [];
    histLast = k; histLastGroup = histGroup; histGroup = null; histT = now;
    updateUndoButtons();
  }
  function applyHistory(entry) {
    const shown = state.currentId;
    histRestoring = true;
    state = JSON.parse(entry.data);
    state.currentId = state.loops.some(l => l.id === entry.loopId) ? entry.loopId : state.loops.some(l => l.id === shown) ? shown : state.loops[0].id;
    histLast = entry.data; histLastGroup = null;
    // keep the selection where it still exists
    const loop = cur();
    if (drag) onPointerCancel();
    if (cablePick) stopCablePick();
    typeDraft = null;
    if (sel && sel.kind === 'multi') {
      selNodes = new Set([...selNodes].filter(id => nodeById(loop, id)));
      sel = selNodes.size > 1 ? sel : selNodes.size ? { kind: 'node', id: [...selNodes][0] } : null;
    } else if (sel && !((sel.kind === 'node' && nodeById(loop, sel.id)) || (sel.kind === 'link' && linkById(loop, sel.id)) || (sel.kind === 'image' && imageById(loop, sel.id)))) sel = null;
    closeTermPop();
    renderPalette(); renderAll(); save();
    histLast = stateKey(); // what is on screen now is the base for the next step
    histRestoring = false;
    updateUndoButtons();
    Promise.all([...allImageRefs()].map(imgGet)).then(renderDiagram);
  }
  function historyUndo() { undo(); }
  function undo() {
    if (!histPast.length) { toast('Nothing to undo.'); return; }
    const e = histPast.pop();
    histFuture.push({ data: histLast, loopId: e.loopId });
    applyHistory(e);
    toast(`Undone (${histPast.length} more step${histPast.length === 1 ? '' : 's'} back). Ctrl+Y redoes.`);
  }
  function redo() {
    if (!histFuture.length) { toast('Nothing to redo.'); return; }
    const e = histFuture.pop();
    histPast.push({ data: histLast, loopId: e.loopId });
    applyHistory(e);
    toast('Redone.');
  }
  function updateUndoButtons() {
    const u = $('btnUndo'), r = $('btnRedo');
    if (u) u.disabled = !histPast.length;
    if (r) r.disabled = !histFuture.length;
  }
  let recPending = false;
  function save() {
    // all the saves of one action (one event) make one step
    if (!recPending) { recPending = true; queueMicrotask(() => { recPending = false; record(); }); }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    }, 250);
  }

  function newLoop(name) {
    return { id: uid(), name: name || 'New loop', nodes: [], links: [], general: { st: {}, custom: [] } };
  }
  function makeNode(type, x, y, loop) {
    const t = T(type);
    return { id: uid(), type, tag: nextTag(loop, t.tag), desc: t.desc, notes: '', x, y, st: {}, custom: [] };
  }
  function nextTag(loop, prefix) {
    if (!prefix) return 'ITEM';
    let n = 101;
    const used = new Set(loop.nodes.map(nd => nd.tag).concat(loop.links.map(l => l.tag)));
    const sep = /[-]$/.test(prefix) ? '' : '';
    while (used.has(prefix + sep + n)) n++;
    return prefix + sep + n;
  }
  function makeLink(loop, a, b) {
    const ta = nodeById(loop, a).type, tb = nodeById(loop, b).type;
    let cable = 'pair';
    if ((isPanel(ta) && isPanel(tb)) || sameContainer(loop, { a, b })) cable = 'wire';
    else if (ta === 'kp' || tb === 'kp') cable = 'coax'; // probe → Proximitor: extension cable
    else if (ta === 'motor' || tb === 'motor') cable = 'power';
    else if (ta === 'valve' || tb === 'valve') cable = 'control';
    else if ((ta === 'jb' || tb === 'jb') && (isPanel(ta) || isPanel(tb) || ta === 'jb' && tb === 'jb')) cable = 'multipair';
    const c = CABLES[cable];
    return {
      id: uid(), a, b, tag: nextTag(loop, c.field ? 'C-' : 'W-'), cable, n: c.defN || null, size: '',
      armoured: false, length: null, route: c.field ? 'tray' : 'duct', screenEnd: 'auto',
      ends: { a: { term: 'auto', gland: null }, b: { term: 'auto', gland: null } }, notes: '', st: {}, custom: []
    };
  }
  const nodeById = (loop, id) => loop.nodes.find(n => n.id === id);
  // The enclosure a node sits in: its "Mounted inside" parent, or itself if it is an enclosure.
  function containerOf(loop, node) {
    if (!node) return null;
    if (node.inside && nodeById(loop, node.inside)) return node.inside;
    return isEnclosure(node.type) ? node.id : null;
  }
  function sameContainer(loop, link) {
    const ca = containerOf(loop, nodeById(loop, link.a)), cb = containerOf(loop, nodeById(loop, link.b));
    return !!ca && ca === cb;
  }
  const linkById = (loop, id) => loop.links.find(l => l.id === id);

  // ---------------------------------------------------------------- item generation
  function cores(link) {
    const c = CABLES[link.cable];
    if (c.fixed) return c.fixed;
    const n = Math.max(1, Number(link.n) || c.defN || 1);
    return c.pairs ? n * 2 : n;
  }
  const isShielded = link => link.shielded != null ? link.shielded : CABLES[link.cable].shielded;
  function termAt(loop, link, end) {
    const t = link.ends[end].term;
    if (t && t !== 'auto') return t;
    const c = CABLES[link.cable];
    if (c.term) return c.term;
    const node = nodeById(loop, link[end]);
    if (node && link.cable === 'power' && T(node.type).term) return T(node.type).term;
    return 'ferrule';
  }
  function glandAt(loop, link, end) {
    const g = link.ends[end].gland;
    return g == null ? CABLES[link.cable].field && !sameContainer(loop, link) : g;
  }
  // Where the cable enters: the enclosure for an item mounted inside one.
  function entryLabel(loop, node) {
    const enc = node && node.inside && nodeById(loop, node.inside);
    return enc ? `${enc.tag} (for ${node.tag})` : node ? node.tag : 'open end';
  }
  function screenEndOf(loop, link) {
    if (!isShielded(link)) return 'none';
    if (link.screenEnd && link.screenEnd !== 'auto') return link.screenEnd;
    const na = nodeById(loop, link.a), nb = nodeById(loop, link.b);
    if (nb && isPanel(nb.type)) return 'b';
    if (na && isPanel(na.type)) return 'a';
    return 'b';
  }
  // ---------------------------------------------------------------- drafting aids (like AutoCAD)
  // SNAP (F9): moves and sizes snap to a grid step. ORTHO (F8): drags are locked horizontal or
  // vertical. OSNAP (F3): dragged items align with other items' centres; cables and open ends
  // snap to the nearest item.
  const DRAFT_KEY = 'loop-planner-drafting';
  const draft = { snap: true, ortho: false, osnap: true, step: 10 };
  try { Object.assign(draft, JSON.parse(localStorage.getItem(DRAFT_KEY)) || {}); } catch (e) { /* defaults */ }
  const saveDraft = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* not saved */ } };
  let showHiddenAll = false; // temporarily show cable information hidden with the eye button

  // ---------------------------------------------------------------- terminals (X10:1 …)
  // Items with a terminal strip: panel equipment, enclosures, terminal strips and anything
  // mounted inside a panel / junction box. Cores of a cable land on numbered terminals; each
  // side of a strip (left / right on the drawing) is numbered on its own, so terminal 3 can
  // take a field core on one side and the panel wire that continues it on the other.
  const TROW = 14, TSW = 36; // terminal row height and strip width on the sheet
  let showTerminals = true;
  try { showTerminals = localStorage.getItem('loop-planner-terminals') !== '0'; } catch (e) { /* default on */ }
  let tplan = {};            // terminal plan of the current loop, from the last full render
  const isTermItem = n => !!n && (isPanel(n.type) || isEnclosure(n.type) || !!n.inside || !!T(n.type).terminals);
  function coreKeys(l) {
    const ks = [];
    for (let i = 1; i <= cores(l); i++) ks.push(String(i));
    if (isShielded(l)) ks.push('S');
    return ks;
  }
  // which side of item `me` a cable lands on, from where its other end is
  function endSide(loop, l, end) {
    const me = nodeById(loop, l[end]);
    const oe = end === 'a' ? 'b' : 'a';
    const other = nodeById(loop, l[oe]);
    const cm = center(me);
    const co = other ? center(other) : Object.assign({ w: 0, h: 0 }, l['f' + oe] || { x: cm.x + 1, y: cm.y });
    if (Math.abs(co.x - cm.x) < (cm.w + co.w) / 2 + 30) return 'r'; // stacked: both ends on the right
    return co.x > cm.x ? 'r' : 'l';
  }
  // the item a core lands on: the cable end's item, or another strip chosen for that core
  function coreTarget(loop, l, end, core, plan) {
    const t = (l.ends[end].cmap || {})[core];
    return t && t !== l[end] && plan[t] ? t : l[end];
  }
  // side of `target` that faces the cable end's item (for cores moved to another strip)
  function sideFacing(loop, l, end, target) {
    const me = center(nodeById(loop, target));
    const fromN = nodeById(loop, l[end]);
    const from = fromN ? center(fromN) : Object.assign({ w: 0, h: 0 }, l['f' + end] || { x: me.x + 1, y: me.y });
    if (Math.abs(from.x - me.x) < (me.w + from.w) / 2 + 30) return 'r';
    return from.x > me.x ? 'r' : 'l';
  }
  function terminalPlan(loop) {
    const plan = {};
    loop.nodes.forEach(n => { if (isTermItem(n)) plan[n.id] = { used: { l: {}, r: {} }, ends: {}, rows: [], exi: new Set(), mixed: new Set() }; });
    // groups: the cores of one cable end landing on one item (the end's own item, or another strip)
    const groups = [];
    loop.links.forEach(l => ['a', 'b'].forEach(end => {
      const byItem = {};
      coreKeys(l).forEach(core => { const t = coreTarget(loop, l, end, core, plan); (byItem[t] = byItem[t] || []).push(core); });
      Object.entries(byItem).forEach(([item, coresHere]) => {
        if (!item || !plan[item]) return;
        const main = item === l[end];
        groups.push({ l, end, item, P: plan[item], main, cores: coresHere, side: main ? endSide(loop, l, end) : sideFacing(loop, l, end, item), key: l.id + ':' + end + (main ? '' : ':f') });
      });
    }));
    const use = (P, side, num, l, core) => {
      (P.used[side][num] = P.used[side][num] || []).push({ l, core });
      if (l.exi) P.exi.add(num);
    };
    // numbers typed by the user first
    groups.forEach(g => Object.entries(g.l.ends[g.end].tmap || {}).forEach(([core, num]) => {
      if (g.cores.includes(core) && String(num).trim()) use(g.P, g.side, String(num).trim(), g.l, core);
    }));
    // natural numbers on the cable end's own item: every core of the cable counts (1, 2, 3 …), so
    // changing or moving one core never renumbers the others; a moved core leaves a spare terminal
    const natural = {};
    const later = []; // cores whose natural terminal is taken, and cores moved to another strip
    groups.filter(g => g.main).forEach(g => {
      const tm = g.l.ends[g.end].tmap || {};
      const nk = g.item + g.side;
      const list = [];
      coreKeys(g.l).forEach(core => {
        const nat = natural[nk] = (natural[nk] || 0) + 1;
        if (!g.cores.includes(core)) return; // moved to another strip: its terminal here stays free
        if (tm[core] != null && String(tm[core]).trim()) { list.push({ core, num: String(tm[core]).trim(), manual: true }); return; }
        const c = { core, num: String(nat), manual: false };
        if (g.P.used[g.side][c.num]) later.push({ g, c }); else use(g.P, g.side, c.num, g.l, core);
        list.push(c);
      });
      if (list.length) g.P.ends[g.key] = { side: g.side, list };
    });
    groups.filter(g => !g.main).forEach(g => {
      const tm = g.l.ends[g.end].tmap || {};
      const list = g.cores.map(core => {
        if (tm[core] != null && String(tm[core]).trim()) return { core, num: String(tm[core]).trim(), manual: true };
        const c = { core, num: '', manual: false };
        later.push({ g, c });
        return c;
      });
      g.P.ends[g.key] = { side: g.side, list, from: g.end };
    });
    // the rest go to the next free numbers after the last one used on that side
    later.forEach(({ g, c }) => {
      const nums = Object.keys(g.P.used[g.side]).filter(x => /^\d+$/.test(x)).map(Number);
      let n = Math.max(natural[g.item + g.side] || 0, nums.length ? Math.max(...nums) : 0) + 1;
      while (g.P.used[g.side][String(n)]) n++;
      c.num = String(n);
      use(g.P, g.side, c.num, g.l, c.core);
    });
    Object.values(plan).forEach(P => {
      const labels = new Set([...Object.keys(P.used.l), ...Object.keys(P.used.r)]);
      const nums = [...labels].filter(x => /^\d+$/.test(x)).map(Number);
      const max = nums.length ? Math.max(...nums) : 0;
      P.rows = Array.from({ length: max }, (_, i) => String(i + 1)).concat([...labels].filter(x => !/^\d+$/.test(x)).sort());
      // intrinsically safe and other circuits must not share a terminal
      labels.forEach(r => {
        const all = [...(P.used.l[r] || []), ...(P.used.r[r] || [])];
        if (all.some(u => u.l.exi) && all.some(u => !u.l.exi)) P.mixed.add(r);
      });
    });
    return plan;
  }
  function stripSVG(rows, k, exi) {
    k = k || 1;
    return `<svg class="isym strip" viewBox="0 0 ${TSW} ${rows.length * TROW + 2}" width="${(TSW * k).toFixed(1)}" height="${((rows.length * TROW + 2) * k).toFixed(1)}" aria-hidden="true">${rows.map((r, i) =>
      `<rect x="1" y="${1 + i * TROW}" width="${TSW - 2}" height="${TROW}" class="s-f${exi && exi.has(r) ? ' exi' : ''}"><title>Terminal ${esc(r)}: double-click to renumber or delete</title></rect><text x="${TSW / 2}" y="${1 + i * TROW + 10.5}" class="s-n">${esc(r)}</text>`).join('')}</svg>`;
  }
  // where the strip of an item sits on the sheet (matches the DOM layout of .nsym)
  function stripGeom(n) {
    const P = tplan[n.id];
    if (!showTerminals || !P || !P.rows.length) return null;
    const sz = sizes[n.id] || { w: NODE_W };
    const k = n.scale || 1;
    const cx = n.x + sz.w / 2;
    const top = n.y + (n.type === 'tb' ? 0 : (symParts(n.type, n.tag).sym.h + 4) * k + 6);
    const idx = {}; P.rows.forEach((r, i) => { idx[r] = i; });
    return { cx, left: cx - (TSW / 2 - 1) * k, right: cx + (TSW / 2 - 1) * k, rowY: r => top + (1 + ((idx[r] != null ? idx[r] : 0) + 0.5) * TROW) * k, P,
      top: top + k, bottom: top + (1 + P.rows.length * TROW) * k, rowH: TROW * k,
      rowAt: y => { const i = Math.floor((y - top - k) / (TROW * k)); return i >= 0 && i < P.rows.length ? P.rows[i] : null; } };
  }
  // ---------------------------------------------------------------- terminals on the canvas
  // every core landing on one item: [{ l, end, core, num, side }]
  function coresOn(loop, nodeId, plan) {
    const P = (plan || tplan)[nodeId];
    const out = [];
    if (!P) return out;
    Object.entries(P.ends).forEach(([key, ent]) => {
      const [lid, end] = key.split(':');
      const l = linkById(loop, lid);
      if (l) ent.list.forEach(c => out.push({ l, end, core: c.core, num: c.num, side: ent.side }));
    });
    return out;
  }
  const setTmap = (l, end, core, num) => {
    const tm = l.ends[end].tmap = l.ends[end].tmap || {};
    if (num == null) { delete tm[core]; if (!Object.keys(tm).length) delete l.ends[end].tmap; } else tm[core] = String(num);
  };
  // give a terminal another number: every core on it (both sides) follows
  function renameTerminal(nodeId, row, to) {
    const loop = cur(), n = nodeById(loop, nodeId);
    to = String(to || '').trim().slice(0, 10);
    if (!n || !to || to === row) return;
    const plan = terminalPlan(loop);
    const on = coresOn(loop, nodeId, plan).filter(c => c.num === row);
    if (!on.length) { toast(`${termName(n, row)} is a spare terminal: nothing lands on it to renumber.`); return; }
    const taken = coresOn(loop, nodeId, plan).filter(c => c.num === to);
    const rows0 = plan[nodeId].rows.length;
    on.forEach(c => setTmap(c.l, c.end, c.core, to));
    renderDiagram(); renderInspector(); save();
    const added = tplan[nodeId] ? tplan[nodeId].rows.length - rows0 : 0;
    toast(`${termName(n, row)} is now ${termName(n, to)}.` +
      (taken.length ? ' That number was already used: shared terminals are marked red in the schedule.' : '') +
      (added > 0 ? ` The strip now runs to ${to}, so ${added} spare terminal${added > 1 ? 's were' : ' was'} added (double-click a terminal → Remove spares to close the gaps).` : ''));
  }
  // delete a spare terminal: the numbers after it close up (1 2 4 5 → 1 2 3 4)
  function deleteSpareTerminal(loop, nodeId, row) {
    const plan = terminalPlan(loop);
    const all = coresOn(loop, nodeId, plan);
    if (all.some(c => c.num === row) || !/^\d+$/.test(row)) return false;
    const k = Number(row);
    all.forEach(c => { if (/^\d+$/.test(c.num) && Number(c.num) > k) setTmap(c.l, c.end, c.core, Number(c.num) - 1); });
    return true;
  }
  function spareTerminals(loop, nodeId) {
    const P = tplan[nodeId];
    if (!P) return [];
    const used = new Set(coresOn(loop, nodeId).map(c => c.num));
    return P.rows.filter(r => /^\d+$/.test(r) && !used.has(r));
  }
  function deleteTerminal(nodeId, row) {
    const loop = cur(), n = nodeById(loop, nodeId);
    if (!n) return;
    const users = coresOn(loop, nodeId).filter(c => c.num === row);
    if (users.length) { toast(`${termName(n, row)} carries ${users.map(c => `${c.l.tag} core ${c.core}`).join(', ')}. Drag those cores to another terminal first.`); return; }
    if (!deleteSpareTerminal(loop, nodeId, row)) return;
    renderDiagram(); renderInspector(); save();
    toast(`${termName(n, row)} deleted; the terminals after it moved up one number.`);
  }
  function removeSpareTerminals(nodeId) {
    const loop = cur(), n = nodeById(loop, nodeId);
    let count = 0;
    for (let guard = 0; guard < 500; guard++) { // highest first, so the numbers below stay put
      tplan = terminalPlan(loop);
      const sp = spareTerminals(loop, nodeId).map(Number).sort((a, b) => b - a);
      if (!sp.length || !deleteSpareTerminal(loop, nodeId, String(sp[0]))) break;
      count++;
    }
    renderDiagram(); renderInspector(); save();
    toast(count ? `Removed ${count} spare terminal${count > 1 ? 's' : ''} from ${n.tag}.` : `${n.tag} has no spare terminals.`);
  }
  // small editor next to a terminal (double-click it on the canvas)
  function closeTermPop() { const el = $('termPop'); if (el) el.remove(); }
  function openTermPop(nodeId, row, clientX, clientY) {
    closeTermPop();
    const loop = cur(), n = nodeById(loop, nodeId);
    const users = coresOn(loop, nodeId).filter(c => c.num === row);
    const who = side => users.filter(c => c.side === side).map(c => `${esc(c.l.tag)} core ${esc(c.core)}`).join(', ') || '–';
    const spares = spareTerminals(loop, nodeId).length;
    const el = document.createElement('div');
    el.id = 'termPop'; el.className = 'term-pop';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', `Terminal ${termName(n, row)}`);
    el.innerHTML = `<div class="tp-head"><b>${esc(termName(n, row))}</b>${users.length ? '' : '<span class="muted">spare</span>'}<button class="tp-x" data-tp="close" aria-label="Close">×</button></div>
      ${users.length ? `<div class="tp-who"><span>Left</span>${who('l')}<span>Right</span>${who('r')}</div>
      <label class="tp-row">Number <input id="tpNum" type="text" value="${esc(row)}" maxlength="10" autocomplete="off"><button class="btn small" data-tp="rename">Rename</button></label>` : ''}
      <div class="tp-row">
        <button class="btn ghost small danger" data-tp="delete" ${users.length ? 'disabled title="Drag its cores to another terminal first"' : ''}>Delete terminal</button>
        ${spares ? `<button class="btn ghost small" data-tp="spares">Remove ${spares} spare${spares > 1 ? 's' : ''}</button>` : ''}
      </div>
      <p class="tip">${users.length ? 'Enter renames. Drag a core’s grip (select the cable or strip) to land it elsewhere.' : 'Deleting closes the gap: the terminals after it move up one number.'}</p>`;
    document.body.appendChild(el);
    const vw = window.innerWidth, vh = window.innerHeight, bw = el.offsetWidth, bh = el.offsetHeight;
    el.style.left = Math.max(8, Math.min(vw - bw - 8, clientX + 14)) + 'px';
    el.style.top = Math.max(8, Math.min(vh - bh - 8, clientY - 20)) + 'px';
    const inp = $('tpNum');
    if (inp) { inp.focus(); inp.select(); }
    el.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeTermPop(); }
      else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); const v = inp.value; closeTermPop(); renameTerminal(nodeId, row, v); }
      e.stopPropagation(); // typing here must not trigger canvas shortcuts
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-tp]');
      if (!b || b.disabled) return;
      const a = b.dataset.tp;
      if (a === 'rename') { const v = inp.value; closeTermPop(); renameTerminal(nodeId, row, v); }
      else if (a === 'delete') { closeTermPop(); deleteTerminal(nodeId, row); }
      else if (a === 'spares') { closeTermPop(); removeSpareTerminals(nodeId); }
      else closeTermPop();
    });
  }
  // the terminal strip (and row) under a point of the drawing, for dropping a core on it
  function terminalAt(loop, w, exceptNode) {
    for (const n of loop.nodes) {
      const g = tplan[n.id] && stripGeom(n);
      if (!g) continue;
      if (w.x >= g.left - 16 && w.x <= g.right + 16 && w.y >= g.top && w.y <= g.bottom) return { n, row: g.rowAt(w.y), g };
    }
    for (const n of loop.nodes) { // anywhere else on an item with terminals: next free number there
      if (!tplan[n.id] || n.id === exceptNode) continue;
      const f = fullBox(n);
      if (w.x >= f.x0 && w.x <= f.x1 && w.y >= f.y0 && w.y <= f.y1) return { n, row: null, g: stripGeom(n) };
    }
    return null;
  }
  // land one core of a cable end on another terminal (of this or another strip)
  function landCore(l, end, core, n, row) {
    const loop = cur();
    const other = end === 'a' ? 'b' : 'a';
    if (n.id === l[other] && n.id !== l[end]) { toast(`${n.tag} is the other end of ${l.tag}.`); return false; }
    const cm = l.ends[end].cmap = l.ends[end].cmap || {};
    if (n.id === l[end]) delete cm[core]; else cm[core] = n.id;
    if (!Object.keys(cm).length) delete l.ends[end].cmap;
    setTmap(l, end, core, row);
    const plan = terminalPlan(loop);
    const me = coresOn(loop, n.id, plan).find(c => c.l === l && c.end === end && c.core === core);
    const share = me ? (plan[n.id].used[me.side][me.num] || []).filter(u => !(u.l === l && u.core === core)) : [];
    renderDiagram(); if (sel) renderInspector(); save();
    const name = core === 'S' ? 'screen' : 'core ' + core;
    toast(me ? `${l.tag} ${name} → ${termName(n, me.num)}${share.length ? ` (shared with ${share.map(u => `${u.l.tag} core ${u.core}`).join(', ')}: marked red)` : ''}.` : `${l.tag} ${name} moved to ${n.tag}.`);
    return true;
  }
  const termName = (n, num) => `${n.tag}:${num}`;

  function nodeCtx(loop, node) {
    const ls = loop.links.filter(l => l.a === node.id || l.b === node.id);
    const cs = ls.map(cores);
    const sum = cs.reduce((s, v) => s + v, 0);
    const max = cs.length ? Math.max(...cs) : 0;
    return {
      cores: sum, cables: ls.length,
      shielded: ls.filter(isShielded).length,
      terminals: isTermItem(node) ? (terminalPlan(loop)[node.id] || { rows: [] }).rows.length : (sum ? Math.max(max, Math.ceil(sum / 2)) : 0),
      exiTerminals: isTermItem(node) ? ((terminalPlan(loop)[node.id] || {}).exi || new Set()).size : 0
    };
  }
  function specToGen(spec, ctx) {
    const [key, name, cat, qf, unit, hf] = spec;
    return { key, name, cat, auto: qf ? qf(ctx) : '', unit: unit || '', hint: hf ? hf(ctx) : '' };
  }
  function genNode(loop, node) {
    const ctx = nodeCtx(loop, node);
    return T(node.type).items.filter(s => s[0] !== 'tbexi' || ctx.exiTerminals).map(s => specToGen(s, ctx));
  }
  function genLink(loop, link) {
    const c = CABLES[link.cable];
    const n = cores(link);
    const shielded = isShielded(link);
    const size = link.size ? ` ${link.size}` : '';
    const out = [];
    const len = Number(link.length) || 0;
    if (c.field) {
      let desc = c.name;
      if (c.pairs) desc += `, ${Math.max(1, Number(link.n) || c.defN)} pairs`;
      else if (!c.fixed) desc += `, ${n} cores`;
      desc += size;
      if (link.armoured) desc += ', armoured';
      if (link.exi) desc += ', Ex i (light blue sheath)';
      out.push({ key: 'cable', name: desc, cat: 'cable', auto: len ? Math.ceil(len * 1.1) : '', unit: 'm',
        hint: len ? `${len} m route + 10% for terminations and slack` : 'Set the route length to get a quantity' });
    } else {
      out.push({ key: 'cable', name: `Panel wire${size} (colour per standard)`, cat: 'cable', auto: len ? Math.ceil(len * n * 1.1) : '', unit: 'm',
        hint: len ? `${n} wires × ${len} m + 10%` : 'Set the wire length to get a quantity' });
    }
    ['a', 'b'].forEach(end => {
      const node = nodeById(loop, link[end]);
      const at = node ? node.tag : `open end ${end.toUpperCase()}`;
      const term = termAt(loop, link, end);
      if (term === 'connector') {
        out.push({ key: 'term-' + end, name: `Connector at ${at}`, cat: 'term', auto: 1, unit: 'pcs', hint: 'RJ45 / M12 / plug to suit the device' });
      } else if (term !== 'none') {
        const extra = shielded ? 1 : 0;
        out.push({ key: 'term-' + end, name: `${TERMS[term]}${size} at ${at}`, cat: 'term', auto: n + extra, unit: 'pcs',
          hint: shielded ? `${n} cores + 1 drain wire` : `${n} cores` });
      }
      if (glandAt(loop, link, end)) {
        const gat = entryLabel(loop, node);
        out.push({ key: 'gland-' + end, name: `Cable gland at ${gat}${link.armoured ? ' (armoured type)' : ''}`, cat: 'gland', auto: 1, unit: 'pcs',
          hint: 'Match cable OD and entry thread (M20 / ½" NPT…)' });
        if (link.armoured) out.push({ key: 'shroud-' + end, name: `Gland earth tag + shroud at ${gat}`, cat: 'gland', auto: 1, unit: 'pcs' });
      }
      if (c.field) out.push({ key: 'cmark-' + end, name: `Cable tag at ${at}`, cat: 'mark', auto: 1, unit: 'pcs' });
      out.push({ key: 'wmark-' + end, name: `Core / wire markers at ${at}`, cat: 'mark', auto: n, unit: 'pcs' });
      if (shielded) out.push({ key: 'hs-' + end, name: `Heat-shrink for screen / drain at ${at}`, cat: 'consum', auto: 1, unit: 'pcs' });
    });
    const se = screenEndOf(loop, link);
    if (se !== 'none') {
      const ends = se === 'both' ? ['a', 'b'] : [se];
      ends.forEach(e => {
        const node = nodeById(loop, link[e]);
        out.push({ key: 'screen-' + e, name: `Screen earth terminal / clamp at ${node ? node.tag : e.toUpperCase()}`, cat: 'terminal', auto: 1, unit: 'pcs' });
      });
    }
    switch (link.route) {
      case 'tray':
        out.push({ key: 'route', name: 'Cable tray / ladder space on the route', cat: 'mount', auto: len || '', unit: 'm' });
        out.push({ key: 'fix', name: 'Cable ties / cleats for the tray', cat: 'mount' }); break;
      case 'conduit':
        out.push({ key: 'route', name: 'Conduit, bends, couplings, saddles', cat: 'mount', auto: len || '', unit: 'm' }); break;
      case 'buried':
        out.push({ key: 'route', name: 'Duct, draw pit, warning tape', cat: 'mount', auto: len || '', unit: 'm' }); break;
      case 'duct':
        out.push({ key: 'route', name: 'Room in wire duct (or extra duct)', cat: 'mount' }); break;
    }
    return out.map(o => Object.assign({ auto: '', unit: '', hint: '' }, o));
  }
  function genGeneral() { return GENERAL_ITEMS.map(s => specToGen(s, {})); }

  function resolve(entity, gens, where, loop) {
    entity.st = entity.st || {}; entity.custom = entity.custom || [];
    const out = gens.map(g => {
      const s = entity.st[g.key] || {};
      return Object.assign({}, g, { status: s.s || 'todo', q: s.q == null ? null : s.q, entity, custom: false, where, loop });
    });
    entity.custom.forEach(c => out.push({
      key: c.id, name: c.name, cat: CAT[c.cat] ? c.cat : 'other', auto: '', unit: c.unit || '', hint: 'Added by you',
      status: c.s || 'todo', q: c.q == null ? null : c.q, entity, custom: true, where, loop
    }));
    out.forEach(i => { i.qty = i.q != null ? i.q : i.auto; });
    return out;
  }
  function setItem(item, patch) {
    if (item.custom) {
      const c = item.entity.custom.find(x => x.id === item.key);
      if (c) { if ('s' in patch) c.s = patch.s; if ('q' in patch) c.q = patch.q; }
    } else {
      const s = item.entity.st[item.key] = Object.assign({}, item.entity.st[item.key] || {});
      if ('s' in patch) s.s = patch.s;
      if ('q' in patch) s.q = patch.q;
    }
  }
  const nodeItems = (loop, node) => resolve(node, genNode(loop, node), { kind: 'node', id: node.id, label: node.tag }, loop);
  const linkItems = (loop, link) => resolve(link, genLink(loop, link), { kind: 'link', id: link.id, label: linkLabel(loop, link) }, loop);
  const generalItems = loop => resolve(loop.general, genGeneral(), { kind: 'general', id: null, label: 'Whole loop' }, loop);
  function linkLabel(loop, link) {
    const a = nodeById(loop, link.a), b = nodeById(loop, link.b);
    return `${link.tag} (${a ? a.tag : 'open end'} → ${b ? b.tag : 'open end'})`;
  }
  function allItems(loop) {
    let out = [];
    loop.nodes.forEach(n => { out = out.concat(nodeItems(loop, n)); });
    loop.links.forEach(l => { out = out.concat(linkItems(loop, l)); });
    return out.concat(generalItems(loop));
  }
  function counts(items) {
    const c = { todo: 0, ordered: 0, have: 0, na: 0 };
    items.forEach(i => { c[i.status]++; });
    return c;
  }
  function worst(items) {
    const c = counts(items);
    return c.todo ? 'todo' : c.ordered ? 'ordered' : c.have ? 'have' : 'na';
  }
  // ---------------------------------------------------------------- flags (components to keep track of)
  const FLAGS = { yellow: 'Yellow', pink: 'Pink', cyan: 'Cyan', violet: 'Violet' };
  let flagFocus = false;     // fade everything that is not flagged
  let labelPts = {};         // cable label positions, to jump to a flagged cable
  let labelAnchors = {};     // where each cable label belongs on its route
  let lastStripDown = null;  // for double-clicks on a terminal
  let labelOrient = {};      // 'h' or 'v': the direction of the run a cable label is written along
  let routeInfo = {};        // per cable: end points and middle run, for the reroute grips
  const flagged = loop => loop.nodes.filter(n => n.flag).map(n => ({ kind: 'node', ent: n })).concat(loop.links.filter(l => l.flag).map(l => ({ kind: 'link', ent: l })));
  function flagPin(ent) {
    if (!ent.flag) return '';
    return `<span class="flag-pin" title="Flagged${ent.flag.note ? ': ' + esc(ent.flag.note) : ''}">⚑</span>${ent.flag.note ? `<div class="flag-note">${esc(ent.flag.note)}</div>` : ''}`;
  }
  const flagCls = ent => ent.flag ? ' flagged' : '';
  const flagStyle = ent => ent.flag ? `--flag: var(--flag-${ent.flag.color});` : '';
  function flagRow(ent) {
    const f = ent.flag;
    return `<div class="flag-row${f ? ' on' : ''}"${f ? ` style="--flag: var(--flag-${f.color})"` : ''}>
        <span class="flag-title">⚑ Keep track</span>
        <div class="flag-colors" role="group" aria-label="Flag colour">
          ${Object.keys(FLAGS).map(c => `<button class="flag-dot${f && f.color === c ? ' on' : ''}" data-flag="${c}" style="--flag: var(--flag-${c})" title="${FLAGS[c]} flag" aria-pressed="${!!(f && f.color === c)}"></button>`).join('')}
          ${f ? '<button class="btn ghost small" data-flag="none" title="Remove the flag (F)">Unflag</button>' : ''}
        </div>
        ${f ? `<label class="sr" for="flagNote">Flag note</label><input id="flagNote" type="text" value="${esc(f.note || '')}" placeholder="What to keep track of, e.g. waiting for quote">` : '<span class="muted flag-hint">Pick a colour (or press F) to flag it.</span>'}
      </div>`;
  }
  function setFlag(ents, color) {
    ents.forEach(e => {
      if (color === 'none') delete e.flag;
      else e.flag = { color, note: (e.flag && e.flag.note) || '' };
    });
    renderDiagram(); renderInspector(); updateFlagButton(); save();
  }
  function toggleFlagSelection() {
    const loop = cur();
    let ents = selectedIds().map(id => nodeById(loop, id)).filter(Boolean);
    if (sel && sel.kind === 'link' && linkById(loop, sel.id)) ents = [linkById(loop, sel.id)];
    if (!ents.length) { toast('Select an item or a cable to flag it.'); return; }
    const allOn = ents.every(e => e.flag);
    setFlag(ents, allOn ? 'none' : 'yellow');
    toast(allOn ? 'Flag removed.' : `Flagged ${ents.length > 1 ? ents.length + ' items' : (ents[0].tag)}. Add a note in the side panel.`);
  }
  function updateFlagButton() {
    const n = flagged(cur()).length;
    $('btnFlags').textContent = n ? `⚑ Flagged (${n})` : '⚑ Flags';
    $('btnFlags').classList.toggle('on', n > 0);
    $('viewport').classList.toggle('flag-focus', flagFocus && n > 0);
  }
  // centre the view on an item or cable
  function focusOn(kind, ent) {
    const vp = $('viewport');
    let x, y;
    if (kind === 'node') { const c = center(ent); x = c.x; y = c.y; }
    else { const p = labelPts[ent.id]; if (!p) return; x = p.x; y = p.y; }
    if (zoom < 0.6) zoom = 0.8;
    panX = vp.clientWidth / 2 - x * zoom; panY = vp.clientHeight / 2 - y * zoom;
    updateView();
  }
  function flagListHTML(loop) {
    const list = flagged(loop);
    if (!list.length) return `<h3><span>⚑ Flagged</span></h3><p class="tip" style="margin-top:0">Nothing flagged. Select an item or a cable and pick a flag colour (or press F) to keep track of it.</p>`;
    return `<h3 id="flagListHead"><span>⚑ Flagged (${list.length})</span>
        <label class="flag-fade"><input id="flagFade" type="checkbox" ${flagFocus ? 'checked' : ''}> Fade everything else</label></h3>
      <ul class="flag-list">${list.map(({ kind, ent }) => {
        const c = counts(kind === 'node' ? nodeItems(loop, ent) : linkItems(loop, ent));
        return `<li><button data-flag-go="${kind}:${ent.id}" style="--flag: var(--flag-${ent.flag.color})">
          <span class="flag-dot on"></span>
          <span class="fl-main"><b>${esc(ent.tag)}</b>${ent.flag.note ? `<span>${esc(ent.flag.note)}</span>` : `<span class="muted">${kind === 'node' ? esc(ent.desc || T(ent.type).name) : 'cable'}</span>`}</span>
          <span class="fl-state" style="color:var(--${c.todo ? 'todo' : c.ordered ? 'ordered' : 'have'})">${c.todo ? c.todo + ' to order' : c.ordered ? c.ordered + ' ordered' : 'done'}</span>
        </button></li>`;
      }).join('')}</ul>`;
  }

  // ---------------------------------------------------------------- highlight (materials of interest)
  const HL_NAMES = { cable: 'Cable', term: 'Lugs & ferrules', gland: 'Glands', mark: 'Markers', terminal: 'Terminals',
    device: 'Devices', protect: 'Protection', mount: 'Mounting', process: 'Process', consum: 'Consumables', other: 'Other' };
  const hl = { cats: new Set(), text: '', todo: false };
  const hlActive = () => hl.cats.size > 0 || hl.text.trim() !== '';
  function hlMatch(it) {
    if (!hlActive()) return false;
    if (hl.cats.size && !hl.cats.has(it.cat)) return false;
    const q = hl.text.trim().toLowerCase();
    if (q && !q.split(/\s+/).every(w => (it.name + ' ' + (it.hint || '')).toLowerCase().includes(w))) return false;
    return hl.todo ? it.status === 'todo' : it.status !== 'na';
  }
  function renderHighlightBar() {
    $('hlChips').innerHTML = CAT_KEYS.map(k => `<button class="hl-chip${hl.cats.has(k) ? ' on' : ''}" data-hlcat="${k}" aria-pressed="${hl.cats.has(k)}" title="${esc(CAT[k].n)}"><b>${CAT[k].s}</b> ${esc(HL_NAMES[k])}</button>`).join('');
    $('btnHighlight').classList.toggle('on', hlActive());
    $('btnHighlight').textContent = hlActive() ? 'Find material ●' : 'Find material';
    const sum = $('hlSummary');
    if (!hlActive()) { sum.textContent = 'Pick a material type or type a word (e.g. ferrule, gland, M20) to highlight where it is needed.'; return; }
    const loop = cur();
    const m = allItems(loop).filter(hlMatch);
    const places = new Set(m.map(i => i.where.kind + (i.where.id || ''))).size;
    const todo = m.filter(i => i.status === 'todo').length;
    sum.textContent = m.length
      ? `${m.length} line${m.length > 1 ? 's' : ''} on ${places} item${places > 1 ? 's' : ''}/cable${places > 1 ? 's' : ''} · ${todo} still to order`
      : 'Nothing in this loop matches.';
  }

  function chipsHTML(items) {
    const by = {};
    items.forEach(i => { (by[i.cat] = by[i.cat] || []).push(i); });
    return CAT_KEYS.filter(k => by[k]).map(k => {
      const w = worst(by[k]);
      const c = counts(by[k]);
      const hit = by[k].some(hlMatch) ? ' hl' : '';
      return `<span class="chip ${w}${hit}" title="${esc(CAT[k].n)}: ${c.todo} to order, ${c.ordered} ordered, ${c.have} in stock">${CAT[k].s}</span>`;
    }).join('');
  }

  // ---------------------------------------------------------------- symbols
  // ---------------------------------------------------------------- IEC symbols
  // Drawn in SVG with currentColor, after IEC 60617 (electrical) and IEC 62424 / ISA 5.1
  // (instrument bubbles: field-mounted, no line). w/h are the symbol's size on the sheet;
  // cables attach at the left/right edges, half-way down.
  const SYMBOLS = {
    bubble:    { name: 'Instrument (circle)', w: 56, h: 56, draw: (L, N) => `<circle cx="28" cy="28" r="26" class="s-f"/><text x="28" y="${N ? 25 : 32}" class="s-t">${L}</text>${N ? `<text x="28" y="40" class="s-n">${N}</text>` : ''}` },
    valve:     { name: 'Valve with solenoid actuator', w: 56, h: 60, draw: () => `<rect x="17" y="2" width="22" height="16" class="s-f"/><path d="M17 18 L39 2"/><path d="M28 18 V42"/><path d="M6 32 L28 42 L6 52 Z M50 32 L28 42 L50 52 Z" class="s-f"/><path d="M0 42 H6 M50 42 H56" class="s-thin"/>` },
    motor:     { name: 'Motor', w: 56, h: 56, draw: () => `<circle cx="28" cy="28" r="26" class="s-f"/><text x="28" y="31" class="s-t s-big">M</text><text x="28" y="45" class="s-n">3~</text>` },
    jb:        { name: 'Junction box', w: 64, h: 52, draw: L => `<rect x="2" y="2" width="60" height="48" rx="2" class="s-f"/><text x="32" y="23" class="s-t">${L}</text>${[14, 26, 38, 50].map(x => `<circle cx="${x}" cy="38" r="3.2" class="s-f"/>`).join('')}` },
    panel:     { name: 'Cabinet / enclosure', w: 64, h: 52, draw: L => `<rect x="2" y="2" width="60" height="48" class="s-f s-dashdot"/><text x="32" y="31" class="s-t">${L}</text>` },
    terminal:  { name: 'Terminal strip', w: 32, h: 64, draw: () => `<rect x="6" y="2" width="20" height="60" class="s-f"/><path d="M6 17 H26 M6 32 H26 M6 47 H26" class="s-thin"/>${[9.5, 24.5, 39.5, 54.5].map(y => `<circle cx="16" cy="${y}" r="3" class="s-f"/>`).join('')}` },
    io:        { name: 'PLC I/O card', w: 56, h: 64, draw: L => `<rect x="8" y="2" width="46" height="60" class="s-f"/><path d="M8 17 H54" class="s-thin"/><text x="31" y="13" class="s-n">${L}</text>${[28, 40, 52].map((y, i) => `<path d="M0 ${y} H8" class="s-thin"/><circle cx="8" cy="${y}" r="2.2" class="s-f"/><text x="15" y="${y + 3.5}" class="s-n s-l">${i + 1}</text>`).join('')}` },
    isolator:  { name: 'Signal isolator / barrier', w: 60, h: 48, draw: () => `<rect x="2" y="2" width="56" height="44" class="s-f"/><path d="M27 7 V41 M33 7 V41"/><path d="M8 24 h5 l3 -5 l4 10 l3 -5 h1 M37 24 h5 l3 -5 l4 10 l3 -5 h1" class="s-thin"/>` },
    relay:     { name: 'Relay (coil + contact)', w: 64, h: 48, draw: () => `<path d="M15 2 V12 M15 36 V46 M46 2 V14 M46 34 V46" class="s-thin"/><rect x="4" y="12" width="22" height="24" class="s-f"/><path d="M46 34 L38 16"/><path d="M26 24 H41" class="s-dash"/>` },
    psu:       { name: 'Power supply (AC/DC)', w: 56, h: 56, draw: () => `<rect x="2" y="2" width="52" height="52" class="s-f"/><path d="M2 54 L54 2" class="s-thin"/><text x="16" y="24" class="s-t s-mid">~</text><text x="40" y="46" class="s-t s-mid">=</text>` },
    fuse:      { name: 'Fuse / breaker', w: 56, h: 24, draw: () => `<path d="M0 12 H12 M44 12 H56" class="s-thin"/><rect x="12" y="4" width="32" height="16" class="s-f"/><path d="M12 12 H44" class="s-thin"/>` },
    amplifier: { name: 'Amplifier', w: 60, h: 44, draw: () => `<rect x="2" y="2" width="56" height="40" class="s-f"/><path d="M18 9 V35 L44 22 Z" class="s-f"/>` },
    probe:     { name: 'Proximity probe', w: 64, h: 28, draw: () => `<path d="M0 14 H14" class="s-thin"/><rect x="14" y="6" width="30" height="16" class="s-f"/><path d="M44 9 H52 V19 H44" class="s-f"/><path d="M58 2 V26" class="s-dash"/>` },
    proximitor: { name: 'Proximitor (VT / COM / OUT, IN)', w: 72, h: 56, draw: () => `<rect x="8" y="2" width="62" height="52" class="s-f"/>${[['VT', 15], ['COM', 29], ['OUT', 43]].map(([t, y]) => `<path d="M0 ${y} H8" class="s-thin"/><text x="22" y="${y + 3.5}" class="s-n">${t}</text>`).join('')}<path d="M72 29 H58" class="s-thin"/><circle cx="54" cy="29" r="4" class="s-f"/><path d="M50 25 A4 4 0 0 0 50 33"/><text x="54" y="47" class="s-n">IN</text>` },
    box:       { name: 'Box with letters', w: 60, h: 44, draw: L => `<rect x="2" y="2" width="56" height="40" rx="2" class="s-f"/><text x="30" y="27" class="s-t">${L}</text>` }
  };
  function symParts(type, tag) {
    const t = T(type);
    const m = String(tag || t.tag || '').match(/^([A-Za-z]+)[-\s]?(.*)$/);
    const letters = m ? m[1].toUpperCase().slice(0, 4) : '';
    const number = m ? m[2].slice(0, 5) : '';
    const key = SYMBOLS[t.shape] ? t.shape : 'box';
    // the letters inside a symbol: instrument letters from the tag; for I/O cards the card type (AI, DO…)
    const L = key === 'bubble' || key === 'io' ? (letters || t.sym || '') : (t.sym || letters);
    return { key, sym: SYMBOLS[key], L: esc(L), N: esc(number) };
  }
  // The symbol as inline SVG. size: null = real size on the sheet, or a box size in px for lists.
  function symSVG(type, tag, size, scale) {
    const { sym, L, N } = symParts(type, tag);
    const k = size ? Math.min(size / sym.w, size / sym.h) : (scale || 1);
    return `<svg class="isym" viewBox="-2 -2 ${sym.w + 4} ${sym.h + 4}" width="${((sym.w + 4) * k).toFixed(1)}" height="${((sym.h + 4) * k).toFixed(1)}" aria-hidden="true">${sym.draw(L, N)}</svg>`;
  }
  function symHTML(type, tag, cls) {
    return `<span class="symbox ${cls || ''}">${symSVG(type, tag, cls === 'big' ? 46 : 34)}</span>`;
  }

  // ---------------------------------------------------------------- rendering
  function renderAll() {
    renderLoopBar();
    renderDiagram();
    renderInspector();
    renderProgress();
    if (view === 'orders') renderOrders();
  }
  function refreshLight() {
    renderDiagram();
    renderChecklist();
    renderSummary();
    renderProgress();
    if (view === 'orders') renderOrders();
    save();
  }

  function renderPalette() {
    let html = '';
    const item = (k, t) => `<button class="pal-item" data-type="${k}" title="Add ${esc(t.name)}">${symHTML(k, t.tag)}<span>${esc(t.name)}</span></button>`;
    GROUP_ORDER.forEach(g => {
      html += `<div class="pal-group">${esc(g)}</div>`;
      Object.keys(TYPES).filter(k => TYPES[k].group === g).forEach(k => { html += item(k, TYPES[k]); });
    });
    html += `<div class="pal-group">My components</div>`;
    (state.customTypes || []).forEach(c => {
      html += `<div class="pal-row">${item(c.id, T(c.id))}<button class="pal-edit" data-edit-type="${c.id}" title="Edit ${esc(c.name)}" aria-label="Edit ${esc(c.name)}">✎</button></div>`;
    });
    html += `<button class="pal-new" id="btnNewType" title="Define a component with its own reminders">+ New component</button>`;
    $('paletteList').innerHTML = html;
  }

  function renderLoopBar() {
    const loop = cur();
    $('loopSelect').innerHTML = state.loops.map(l => `<option value="${l.id}" ${l.id === loop.id ? 'selected' : ''}>${esc(l.name || 'Untitled loop')}</option>`).join('');
    if (document.activeElement !== $('loopName')) $('loopName').value = loop.name;
  }

  function renderProgress() {
    const loop = cur();
    const c = counts(allItems(loop));
    const total = c.todo + c.ordered + c.have + c.na || 1;
    const seg = s => `<i style="width:${(c[s] / total * 100).toFixed(2)}%;background:var(--${s})"></i>`;
    $('progress').innerHTML = `<div class="bar" title="Order progress">${seg('have')}${seg('ordered')}${seg('na')}${seg('todo')}</div>
      <span><b style="color:var(--todo)">${c.todo}</b> to order · <b style="color:var(--ordered)">${c.ordered}</b> ordered · <b style="color:var(--have)">${c.have}</b> in stock</span>`;
    $('tabCount').textContent = c.todo || '';
  }

  const EYE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><circle cx="8" cy="8" r="2.2"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z"/><path d="M2 14L14 2"/></svg>';
  // hide a cable's information box (tag, type, chips); the cable itself stays on the drawing
  function toggleCableHidden(l) {
    if (!l) return;
    l.infoHidden = !l.infoHidden;
    if (!l.infoHidden) delete l.infoHidden;
    renderDiagram(); if (sel && sel.kind === 'link' && sel.id === l.id) renderInspector(); save();
    updateStatusBar();
    toast(l.infoHidden ? `Information of ${l.tag} hidden. Click the small eye (or press H) to show it again.` : `Information of ${l.tag} shown.`);
  }
  function renderDiagram() {
    const loop = cur();
    tplan = terminalPlan(loop);
    const nodesEl = $('nodes');
    let html = '';
    loop.nodes.forEach(n => {
      const items = nodeItems(loop, n);
      const c = counts(items);
      const badge = c.todo ? `<span class="badge" title="${c.todo} item(s) to order">${c.todo}</span>`
        : c.ordered ? `<span class="badge ordered" title="${c.ordered} item(s) ordered, waiting">${c.ordered}</span>`
        : `<span class="badge done" title="Everything ordered or in stock">✓</span>`;
      const isSel = selectedIds().includes(n.id) || !!(cablePick && cablePick.first === n.id);
      const hits = items.filter(hlMatch).length;
      const hlc = hlActive() ? (hits ? ' hl-on' : ' hl-off') : '';
      const hasStrip = showTerminals && tplan[n.id] && tplan[n.id].rows.length;
      html += `<div class="node${isSel ? ' sel' : ''}${hlc}${flagCls(n)}${hasStrip ? ' has-strip' : ''}" data-id="${n.id}" style="${flagStyle(n)}left:${n.x}px;top:${n.y}px">${n.flag ? `<span class="flag-pin" title="Flagged${n.flag.note ? ': ' + esc(n.flag.note) : ''}">⚑</span>` : ''}${hits ? `<span class="hl-badge" title="${hits} matching line${hits > 1 ? 's' : ''}">${hits}</span>` : ''}
        <div class="nsym">${(() => {
          const P = tplan[n.id];
          const k = n.scale || 1;
          const one = selectedIds().length === 1 && selectedIds()[0] === n.id; // corner grips to resize, like images
          const grips = one ? ['nw', 'ne', 'sw', 'se'].map(g => `<span class="grip ${g}" data-ngrip="${g}" title="Drag to resize"></span>`).join('') : '';
          if (!showTerminals || !P || !P.rows.length) return symSVG(n.type, n.tag, null, k) + grips;
          return (n.type === 'tb' ? '' : symSVG(n.type, n.tag, null, k)) + stripSVG(P.rows, k, P.exi) + grips; // the terminal strip under the symbol
        })()}</div>${badge}
        <div class="nlabel" title="Drag to move this text" style="${nlabelStyle(n)}"><div class="node-title"><b>${esc(n.tag)}</b><small>${esc(n.desc || T(n.type).name)}</small>${n.inside && nodeById(loop, n.inside) ? `<small class="inside-tag">in ${esc(nodeById(loop, n.inside).tag)}</small>` : ''}</div>
          <div class="chips">${chipsHTML(items)}</div>${n.flag && n.flag.note ? `<div class="flag-note inline">${esc(n.flag.note)}</div>` : ''}</div>
        <div class="port left" title="Drag to another item to add a cable"></div><div class="port" title="Drag to another item to add a cable"></div></div>`;
    });
    loop.links.forEach(l => {
      const items = linkItems(loop, l);
      const w = worst(items);
      const cls = w === 'todo' ? 'todo' : w === 'ordered' ? 'ordered' : 'done';
      const isSel = sel && sel.kind === 'link' && sel.id === l.id;
      const c = CABLES[l.cable];
      const spec = c.pairs ? `${Math.max(1, Number(l.n) || c.defN)} pr` : c.fixed ? c.short : `${cores(l)}${c.short}`;
      const lhits = items.filter(hlMatch).length;
      const lhl = hlActive() ? (lhits ? ' hl-on' : ' hl-off') : '';
      const hid = l.infoHidden && !showHiddenAll;
      html += `<div class="wlabel ${cls}${isSel ? ' sel' : ''}${lhl}${flagCls(l)}${hid ? ' info-hidden' : ''}${l.infoHidden && showHiddenAll ? ' was-hidden' : ''}${l.exi ? ' exi' : ''}" data-link="${l.id}" style="${flagStyle(l)}">${flagPin(l)}${lhits ? `<span class="hl-badge" title="${lhits} matching line${lhits > 1 ? 's' : ''}">${lhits}</span>` : ''}
        <button class="eye" data-eye="${l.id}" title="${l.infoHidden ? `Show the information of ${esc(l.tag)} (H)` : 'Hide this information (H)'}" aria-label="${l.infoHidden ? 'Show' : 'Hide'} the information of cable ${esc(l.tag)}">${l.infoHidden ? EYE_OFF : EYE}</button>
        <div class="wt">${esc(l.tag)} <small>${esc(spec)}${l.length ? ' · ' + esc(l.length) + ' m' : ''}</small>${l.exi ? '<b class="exi-tag" title="Intrinsically safe circuit">Ex i</b>' : ''}</div><div class="chips">${chipsHTML(items)}</div></div>`;
    });
    nodesEl.innerHTML = html;
    sizes = {};
    nodesEl.querySelectorAll('.node').forEach(el => {
      const lb = el.querySelector('.nlabel');
      sizes[el.dataset.id] = { w: el.offsetWidth, h: el.offsetHeight, lw: lb ? lb.offsetWidth : 0, lh: lb ? lb.offsetHeight + 4 : 0 };
    });
    drawWires();
    $('emptyHint').hidden = loop.nodes.length > 0 || (loop.images || []).length > 0;
    renderImages(loop);
    $('viewport').classList.toggle('hl-active', hlActive());
    if ($('tg-hidden')) updateStatusBar();
    updateFlagButton();
    renderHighlightBar();
  }

  function renderImages(loop) {
    const html = { back: '', front: '' };
    (loop.images || []).forEach(im => {
      const isSel = sel && sel.kind === 'image' && sel.id === im.id;
      const url = imgUrl(im.img);
      html[im.front ? 'front' : 'back'] += `<div class="img-obj${isSel ? ' sel' : ''}${im.frame ? ' framed' : ''}${im.locked ? ' locked' : ''}" data-img="${im.id}" style="left:${im.x}px;top:${im.y}px;width:${im.w}px;height:${im.h}px" title="${esc(im.name)}">
        ${url ? `<img src="${url}" alt="${esc(im.name)}" draggable="false" style="opacity:${(1 - (im.fade || 0) / 100).toFixed(2)}">` : '<span class="img-missing">Picture not stored in this browser</span>'}
        ${isSel && !im.locked ? ['nw', 'ne', 'sw', 'se'].map(g => `<span class="grip ${g}" data-grip="${g}"></span>`).join('') : ''}
      </div>`;
    });
    $('imgBack').innerHTML = html.back;
    $('imgFront').innerHTML = html.front;
  }

  // an item's text block (tag, service, chips) sits under the symbol unless the user moved it
  function nlabelStyle(n) {
    const o = n.lblOff;
    return o ? `transform:translate(calc(-50% + ${o.dx}px), ${o.dy}px)` : '';
  }
  function nlabelBox(n) {
    const s = sizes[n.id] || { w: NODE_W, h: 56, lw: 140, lh: 44 };
    const o = n.lblOff || { dx: 0, dy: 0 }, cx = n.x + s.w / 2 + o.dx, lw = s.lw || 0;
    return { x0: cx - lw / 2, y0: n.y + s.h + o.dy, x1: cx + lw / 2, y1: n.y + s.h + o.dy + (s.lh || 0) };
  }
  // the symbol plus its text block, for selection boxes, zones and zoom extents
  function fullBox(n) {
    const s = sizes[n.id] || { w: NODE_W, h: 56, lw: 140, lh: 44 };
    const t = nlabelBox(n);
    return { x0: Math.min(n.x, t.x0), y0: Math.min(n.y, t.y0), x1: Math.max(n.x + s.w, t.x1), y1: Math.max(n.y + s.h, t.y1) };
  }
  function center(n) {
    const s = sizes[n.id] || { w: NODE_W, h: 56 };
    return { x: n.x + s.w / 2, y: n.y + s.h / 2, w: s.w, h: s.h, lh: n.lblOff ? 0 : (s.lh || 0) };
  }
  // a cable's information is centred on its run and written along it: tag and type on one side of
  // the cable, the material chips on the other ('v' runs are turned to read upwards)
  function cableLabelRect(x, y, w, h, orient) {
    return orient === 'v' ? { x0: x - h / 2, y0: y - w / 2, x1: x + h / 2, y1: y + w / 2 } : { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
  }
  function clip(c, toward) {
    const dx = toward.x - c.x, dy = toward.y - c.y;
    if (!dx && !dy) return { x: c.x, y: c.y };
    const t = Math.min(dx ? (c.w / 2 + 4) / Math.abs(dx) : Infinity, dy ? (c.h / 2 + 4) / Math.abs(dy) : Infinity);
    return t >= 1 ? { x: c.x, y: c.y } : { x: c.x + dx * t, y: c.y + dy * t };
  }
  // Polyline with rounded corners, for right-angle cable routes.
  function roundedPath(pts, r) {
    const P = pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) + Math.abs(p.y - pts[i - 1].y) > 0.5);
    const f = v => v.toFixed(1);
    let d = `M${f(P[0].x)},${f(P[0].y)}`;
    for (let i = 1; i < P.length - 1; i++) {
      const a = P[i - 1], b = P[i], c = P[i + 1];
      const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
      const rr = Math.min(r, l1 / 2, l2 / 2);
      const p1 = { x: b.x + (a.x - b.x) / l1 * rr, y: b.y + (a.y - b.y) / l1 * rr };
      const p2 = { x: b.x + (c.x - b.x) / l2 * rr, y: b.y + (c.y - b.y) / l2 * rr };
      d += ` L${f(p1.x)},${f(p1.y)} Q${f(b.x)},${f(b.y)} ${f(p2.x)},${f(p2.y)}`;
    }
    const z = P[P.length - 1];
    return d + ` L${f(z.x)},${f(z.y)}`;
  }
  function drawWires() {
    const loop = cur();
    const groups = {};
    loop.links.forEach(l => { const k = [l.a, l.b].sort().join('|'); (groups[k] = groups[k] || []).push(l); });
    let svg = '';
    const labels = {};
    const tabs = []; // zone labels: HTML above the cable labels so they can always be grabbed
    loop.nodes.forEach(enc => {
      const kids = loop.nodes.filter(n => n.inside === enc.id);
      if (!kids.length) return;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      [enc].concat(kids).forEach(n => { const f = fullBox(n); x0 = Math.min(x0, f.x0); y0 = Math.min(y0, f.y0); x1 = Math.max(x1, f.x1); y1 = Math.max(y1, f.y1); });
      const pad = 18;
      const rx = x0 - pad, ry = y0 - pad - 14, rw = x1 - x0 + pad * 2, rh = y1 - y0 + pad * 2 + 14;
      svg += `<rect class="encl-box" x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8"/>`;
      // the outline and the label are handles that move the whole enclosure with its contents
      svg += `<rect class="encl-hit" data-encl="${enc.id}" x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="8"><title>Drag to move ${esc(enc.tag)} with everything inside</title></rect>`;
      tabs.push(`<div class="encl-tab" data-encl="${enc.id}" style="left:${rx + 6}px;top:${ry + 1}px" title="Drag to move ${esc(enc.tag)} with everything inside">${esc(enc.tag)} enclosure</div>`);
    });
    // Right-angle routing. Each cable leaves from the side of the item facing the other end;
    // cables sharing a side are fanned out so they don't sit on top of each other.
    const R = {};
    const freeEnd = (l, end) => { // a cable end whose item was deleted: a point on the sheet
      const pt = l['f' + end] || { x: 0, y: 0 };
      return { nd: { id: `free-${end}-${l.id}`, x: pt.x, y: pt.y, free: true }, c: { x: pt.x, y: pt.y, w: 0, h: 0 } };
    };
    const openEnds = [];
    loop.links.forEach(l => {
      let na = nodeById(loop, l.a), nb = nodeById(loop, l.b);
      let ca, cb;
      if (na) ca = center(na); else { const f = freeEnd(l, 'a'); na = f.nd; ca = f.c; openEnds.push({ l, end: 'a', x: ca.x, y: ca.y }); }
      if (nb) cb = center(nb); else { const f = freeEnd(l, 'b'); nb = f.nd; cb = f.c; openEnds.push({ l, end: 'b', x: cb.x, y: cb.y }); }
      const gapX = Math.abs(cb.x - ca.x) - (ca.w + cb.w) / 2;
      let sa, sb;
      if (gapX >= 30) { sa = cb.x > ca.x ? 'r' : 'l'; sb = sa === 'r' ? 'l' : 'r'; }
      else { sa = cb.y > ca.y ? 'b' : 't'; sb = sa === 'b' ? 't' : 'b'; }
      const ga = !na.free && stripGeom(na), gb = !nb.free && stripGeom(nb);
      const ea = ga && ga.P.ends[l.id + ':a'], eb = gb && gb.P.ends[l.id + ':b'];
      if (ea || eb) { // terminal detail: cables reach strips from the left or right only
        sa = ea ? ea.side : (gapX >= 30 ? (cb.x > ca.x ? 'r' : 'l') : 'r');
        sb = eb ? eb.side : (gapX >= 30 ? (ca.x > cb.x ? 'r' : 'l') : 'r');
      }
      R[l.id] = { l, na, nb, ca, cb, sa, sb, offa: 0, offb: 0, lane: 0, ga: ea ? ga : null, gb: eb ? gb : null, ea, eb };
    });
    const sides = {};
    Object.values(R).forEach(r => {
      (sides[r.na.id + r.sa] = sides[r.na.id + r.sa] || []).push({ r, end: 'a', side: r.sa, other: r.cb, me: r.ca });
      (sides[r.nb.id + r.sb] = sides[r.nb.id + r.sb] || []).push({ r, end: 'b', side: r.sb, other: r.ca, me: r.cb });
    });
    Object.values(sides).forEach(list => {
      const horiz = list[0].side === 'l' || list[0].side === 'r';
      list.sort((p, q) => horiz ? p.other.y - q.other.y : p.other.x - q.other.x);
      const n = list.length;
      list.forEach((it, i) => {
        const lim = Math.max(0, horiz ? it.me.h / 2 - 8 : it.me.w / 2 - 12);
        it.r['off' + it.end] = Math.max(-lim, Math.min(lim, (i - (n - 1) / 2) * 12));
        if (n > 1) it.r.lane += (i - (n - 1) / 2) * 14;
      });
    });
    const portPt = (nd, c, side, off) => side === 'r' ? { x: nd.x + c.w, y: c.y + off } : side === 'l' ? { x: nd.x, y: c.y + off }
      : side === 'b' ? { x: c.x + off, y: nd.y + c.h + (c.lh || 0) } : { x: c.x + off, y: nd.y };
    const brk = {}; // breakout slots per item side, so several cables don't share one trunk
    routeInfo = {};
    Object.values(R).forEach(r => {
      const l = r.l;
      const k = [l.a, l.b].sort().join('|');
      const g = groups[k];
      r.lane += (g.indexOf(l) - (g.length - 1) / 2) * 16;
      // a cable that lands on a terminal strip ends at a breakout point beside it
      const breakout = (nd, g, e, side) => {
        const k = nd.id + side;
        const i = brk[k] = (brk[k] == null ? 0 : brk[k] + 1);
        const ys = e.list.map(c => g.rowY(c.num));
        return { x: side === 'r' ? g.right + 22 + i * 9 : g.left - 22 - i * 9, y: ys.reduce((a, b) => a + b, 0) / ys.length };
      };
      const pa = r.ea ? breakout(r.na, r.ga, r.ea, r.sa) : portPt(r.na, r.ca, r.sa, r.offa);
      const pb = r.eb ? breakout(r.nb, r.gb, r.eb, r.sb) : portPt(r.nb, r.cb, r.sb, r.offb);
      let pts;
      // the user can move the middle run (l.bend); otherwise it is placed automatically
      const bend = l.bend || {};
      let orient;
      if (r.sa === r.sb && (r.sa === 'l' || r.sa === 'r')) { // both ends on the same side: a C-shaped route
        const X = bend.x != null ? bend.x : (r.sa === 'r' ? Math.max(pa.x, pb.x) + 18 + Math.abs(r.lane) : Math.min(pa.x, pb.x) - 18 - Math.abs(r.lane));
        pts = [pa, { x: X, y: pa.y }, { x: X, y: pb.y }, pb]; orient = 'x';
      } else if ((r.sa === 'l' || r.sa === 'r') && bend.y != null) { // detour: out, up/down to a level, across, back
        const dA = r.sa === 'r' ? 1 : -1, dB = r.sb === 'r' ? 1 : -1;
        pts = [pa, { x: pa.x + dA * 20, y: pa.y }, { x: pa.x + dA * 20, y: bend.y }, { x: pb.x + dB * 20, y: bend.y }, { x: pb.x + dB * 20, y: pb.y }, pb]; orient = 'jog';
      } else if (r.sa === 'l' || r.sa === 'r') {
        const lo = Math.min(pa.x, pb.x) + 12, hi = Math.max(pa.x, pb.x) - 12;
        const mx = bend.x != null ? bend.x : Math.max(lo, Math.min(hi, (pa.x + pb.x) / 2 + r.lane));
        pts = [pa, { x: mx, y: pa.y }, { x: mx, y: pb.y }, pb];
        orient = Math.abs(pb.y - pa.y) < 4 && bend.x == null ? 'jog' : 'x'; // a straight cable gets a detour grip
      } else {
        const lo = Math.min(pa.y, pb.y) + 12, hi = Math.max(pa.y, pb.y) - 12;
        const my = bend.y != null ? bend.y : (lo < hi ? Math.max(lo, Math.min(hi, (pa.y + pb.y) / 2 + r.lane)) : (pa.y + pb.y) / 2);
        pts = [pa, { x: pa.x, y: my }, { x: pb.x, y: my }, pb]; orient = 'y';
      }
      // the move-the-run grip must not cover the cable's own label (which sits at the run's centre
      // unless the user moved it): put it just past the label's edge along the run, or at the
      // run's first corner when the run is too short
      const si = pts.length === 6 ? 2 : 1; // the middle run: pts[si] → pts[si + 1]
      // the run the label sits on: for a straight cable that is the cable itself
      const s0 = orient === 'jog' && pts.length === 4 ? pa : pts[si], s1 = orient === 'jog' && pts.length === 4 ? pb : pts[si + 1];
      const mc = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 };
      // where the run currently is (the drag moves it by the pointer's movement, not to the pointer)
      const run = orient === 'x' ? s0.x : s0.y;
      // the move-the-run grip must never cover the cable's own label: try spots along the run,
      // then its corners, then along the legs, and take the first one clear of the label
      // the cable's information goes on its longest run, written along it (like a cable tag on a
      // circuit diagram); horizontal runs win a close call, so most tags read normally
      let lseg = 0, lscore = -1;
      for (let i = 0; i < pts.length - 1; i++) {
        const dx = Math.abs(pts[i + 1].x - pts[i].x), dy = Math.abs(pts[i + 1].y - pts[i].y);
        const sc = Math.max(dx, dy) * (dx >= dy ? 1.25 : 1);
        if (sc > lscore + 0.5) { lscore = sc; lseg = i; }
      }
      const L0 = pts[lseg], L1 = pts[lseg + 1];
      const best = { x: (L0.x + L1.x) / 2, y: (L0.y + L1.y) / 2 };
      const lorient = Math.abs(L1.y - L0.y) > Math.abs(L1.x - L0.x) ? 'v' : 'h';
      labelOrient[l.id] = lorient;
      const lpos = l.lblOff ? { x: best.x + l.lblOff.dx, y: best.y + l.lblOff.dy } : best;
      let gmid = mc;
      const lel = document.querySelector(`#nodes .wlabel[data-link="${l.id}"]`);
      if (lel) {
        const lr = cableLabelRect(lpos.x, lpos.y, lel.offsetWidth, lel.offsetHeight, lorient);
        const clear = q => q.x < lr.x0 - 8 || q.x > lr.x1 + 8 || q.y < lr.y0 - 8 || q.y > lr.y1 + 8;
        const hw = lel.offsetWidth / 2 + 8, hh = lel.offsetHeight / 2 + 8;
        const along = (a, b2, dist) => { const L2 = Math.hypot(b2.x - a.x, b2.y - a.y); return L2 > dist ? { x: a.x + (b2.x - a.x) * dist / L2, y: a.y + (b2.y - a.y) * dist / L2 } : null; };
        const runLen = Math.hypot(s1.x - s0.x, s1.y - s0.y);
        const cand = [];
        if (runLen) { const ext = (Math.abs(s1.x - s0.x) > Math.abs(s1.y - s0.y) ? hw : hh) + 6; cand.push(along(mc, s0, ext), along(mc, s1, ext)); }
        cand.push(s0, s1);
        const i0 = pts.indexOf(s0), i1 = pts.indexOf(s1);
        if (i0 > 0) cand.push(along(s0, pts[i0 - 1], hw + 6), along(s0, pts[i0 - 1], hh + 6));
        if (i1 >= 0 && i1 < pts.length - 1) cand.push(along(s1, pts[i1 + 1], hw + 6), along(s1, pts[i1 + 1], hh + 6));
        gmid = cand.find(q => q && clear(q)) || mc;
      }
      routeInfo[l.id] = { pa, pb, mid: gmid, orient, run, freeA: !!r.na.free, freeB: !!r.nb.free };
      const items = linkItems(loop, l);
      const w = worst(items);
      const cls = w === 'todo' ? 'todo' : w === 'ordered' ? 'ordered' : 'done';
      const isSel = sel && sel.kind === 'link' && sel.id === l.id;
      const d = roundedPath(pts, 8);
      const whl = hlActive() ? (items.some(hlMatch) ? ' hl-on' : ' hl-off') : '';
      const exi = l.exi ? ' exi' : ''; // intrinsically safe: blue cable and cores
      if (whl === ' hl-on') svg += `<path class="wire-glow" d="${d}"/>`;
      svg += `<path class="wire ${cls}${isSel ? ' sel' : ''}${whl}${exi}" d="${d}"/>`;
      const endFill = l.exi ? 'exi' : (cls === 'done' ? 'have' : cls);
      svg += `<circle class="wire-end${whl}" cx="${pa.x.toFixed(1)}" cy="${pa.y.toFixed(1)}" r="4" style="fill:var(--${endFill})"/>`;
      svg += `<circle class="wire-end${whl}" cx="${pb.x.toFixed(1)}" cy="${pb.y.toFixed(1)}" r="4" style="fill:var(--${endFill})"/>`;
      svg += `<path class="wire-hit" data-link="${l.id}" d="${d}"/>`;
      // cores: from the breakout point along a short trunk to each terminal of the strip
      [[r.ea, r.ga, r.sa, pa], [r.eb, r.gb, r.sb, pb]].forEach(([e, g, side, p]) => {
        if (!e) return;
        const edge = side === 'r' ? g.right : g.left, dir = side === 'r' ? 1 : -1;
        e.list.forEach(c => {
          const y = g.rowY(c.num);
          svg += `<path class="core ${cls}${whl}${exi}" d="M${p.x.toFixed(1)},${p.y.toFixed(1)} V${y.toFixed(1)} H${edge.toFixed(1)}"/>`;
          svg += `<text class="core-no${whl}" x="${(edge + dir * 8).toFixed(1)}" y="${(y - 2.5).toFixed(1)}" text-anchor="middle">${esc(c.core)}</text>`;
        });
      });
      // cores moved to another strip: from this cable end's point to their own terminals there
      // they leave outward, pass above or below the cable end's own item, then run to the target strip
      [['a', pa, r.sa], ['b', pb, r.sb]].forEach(([end, p, side]) => {
        Object.keys(tplan).forEach(itemId => {
          const fe = tplan[itemId].ends[l.id + ':' + end + ':f'];
          const tn = fe && nodeById(loop, itemId);
          const g = tn && stripGeom(tn);
          if (!g) return;
          const edge = fe.side === 'r' ? g.right : g.left, dir = fe.side === 'r' ? 1 : -1;
          const tx = edge + dir * 14;
          const src = nodeById(loop, l[end]);
          fe.list.forEach((c, i) => {
            const y = g.rowY(c.num);
            let d = `M${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            if (src) {
              const fb = fullBox(src);
              const ox = p.x + (side === 'l' ? -1 : 1) * (8 + i * 3);
              const cy = y >= p.y ? fb.y1 + 10 + i * 3 : fb.y0 - 10 - i * 3;
              d += ` H${ox.toFixed(1)} V${cy.toFixed(1)}`;
            }
            d += ` H${tx.toFixed(1)} V${y.toFixed(1)} H${edge.toFixed(1)}`;
            svg += `<path class="core moved ${cls}${whl}${exi}" d="${d}"/>`;
            svg += `<text class="core-no${whl}" x="${(edge + dir * 8).toFixed(1)}" y="${(y - 2.5).toFixed(1)}" text-anchor="middle">${esc(c.core)}</text>`;
          });
        });
      });
      // the label sits on the route unless the user dragged it; then a leader line ties it back
      const off = l.lblOff;
      const pos = lpos;
      if (off && Math.hypot(off.dx, off.dy) > 18 && !(l.infoHidden && !showHiddenAll)) {
        svg += `<path class="leader${whl}" d="M${best.x.toFixed(1)},${best.y.toFixed(1)} L${pos.x.toFixed(1)},${pos.y.toFixed(1)}"/>`;
        svg += `<circle class="leader-dot${whl}" cx="${best.x.toFixed(1)}" cy="${best.y.toFixed(1)}" r="3.5"/>`;
      }
      labels[l.id] = pos;
      labelPts[l.id] = pos;
      labelAnchors[l.id] = best;
    });
    loop.nodes.forEach(n => {
      if (!n.lblOff || Math.hypot(n.lblOff.dx, n.lblOff.dy) < 18) return;
      const c = center(n), t = nlabelBox(n);
      const tc = { x: (t.x0 + t.x1) / 2, y: (t.y0 + t.y1) / 2 };
      const a = clip(c, tc); // symbol edge towards the text
      const b = { x: Math.max(t.x0, Math.min(t.x1, a.x)), y: Math.max(t.y0, Math.min(t.y1, a.y)) }; // nearest point of the text block
      if (Math.hypot(b.x - a.x, b.y - a.y) < 6) return;
      const nh = hlActive() ? (nodeItems(loop, n).some(hlMatch) ? ' hl-on' : ' hl-off') : '';
      svg += `<path class="leader${nh}" d="M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}"/>`;
      svg += `<circle class="leader-dot${nh}" cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="2.5"/>`;
    });
    svg += '<path id="tempWire" class="wire-temp" d="" style="display:none"/>';
    // size the SVG to what it draws, since items can be anywhere (also at negative coordinates)
    let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
    const boxes = loop.nodes.map(n => { const f = fullBox(n); return [f.x0, f.y0, f.x1, f.y1]; }).concat(openEnds.map(o => [o.x, o.y, o.x, o.y]))
      .concat(Object.values(labels).map(q => [q.x, q.y, q.x, q.y]));
    boxes.forEach((q, i) => { if (!i) { [bx0, by0, bx1, by1] = q; } bx0 = Math.min(bx0, q[0]); by0 = Math.min(by0, q[1]); bx1 = Math.max(bx1, q[2]); by1 = Math.max(by1, q[3]); });
    const m = 300;
    const W = $('wires');
    Object.assign(W.style, { left: (bx0 - m) + 'px', top: (by0 - m) + 'px', width: (bx1 - bx0 + 2 * m) + 'px', height: (by1 - by0 + 2 * m) + 'px' });
    W.innerHTML = `<g transform="translate(${m - bx0},${m - by0})">${svg}</g>`;
    $('nodes').querySelectorAll('.encl-tab, .open-end, .cgrip').forEach(el => el.remove());
    let cgrips = '';
    const sl = sel && sel.kind === 'link' && !cablePick && linkById(loop, sel.id);
    const ri = sl && routeInfo[sl.id];
    if (ri) { // AutoCAD-style grips: drag an end onto another item, or move the middle run
      if (!ri.freeA) cgrips += `<div class="cgrip end" data-endgrip="${sl.id}:a" style="left:${ri.pa.x}px;top:${ri.pa.y}px" title="Drag onto another item to move this end"></div>`;
      if (!ri.freeB) cgrips += `<div class="cgrip end" data-endgrip="${sl.id}:b" style="left:${ri.pb.x}px;top:${ri.pb.y}px" title="Drag onto another item to move this end"></div>`;
      cgrips += `<div class="cgrip mid ${ri.orient}" data-bendgrip="${sl.id}" style="left:${ri.mid.x}px;top:${ri.mid.y}px" title="Drag to move this run of the cable"></div>`;
    }
    if (!cablePick) {
      const coreGrips = [];
      const selNode = sel && sel.kind === 'node' && nodeById(loop, sel.id);
      Object.keys(tplan).forEach(itemId => coresOn(loop, itemId).forEach(c => {
        if (!((sl && c.l.id === sl.id) || (selNode && selNode.id === itemId))) return;
        const g = stripGeom(nodeById(loop, itemId));
        if (!g) return;
        const x = (c.side === 'r' ? g.right + 8 : g.left - 8) * 1, y = g.rowY(c.num) - 3;
        coreGrips.push(`<div class="cgrip core" data-coregrip="${c.l.id}|${c.end}|${esc(c.core)}" style="left:${x}px;top:${y}px" title="${esc(c.l.tag)} ${c.core === 'S' ? 'screen' : 'core ' + esc(c.core)} on ${esc(termName(nodeById(loop, itemId), c.num))}: drag onto another terminal"></div>`);
      }));
      cgrips += coreGrips.join('');
    }
    $('nodes').insertAdjacentHTML('beforeend', tabs.join('') + openEnds.map(o =>
      `<div class="open-end" data-open="${o.l.id}:${o.end}" style="left:${o.x}px;top:${o.y}px" title="Open end of ${esc(o.l.tag)}: drag it onto an item to connect"></div>`).join('') + cgrips);
    document.querySelectorAll('.wlabel').forEach(el => {
      const p = labels[el.dataset.link];
      if (p) {
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.hidden = false;
        const lk = linkById(loop, el.dataset.link);
        el.classList.toggle('along-v', labelOrient[el.dataset.link] === 'v');
        el.classList.toggle('loose', !!(lk && lk.lblOff));
      } else el.hidden = true;
    });
  }

  // ---------------------------------------------------------------- inspector
  function renderInspector() {
    const loop = cur();
    const el = $('inspector');
    if (sel && sel.kind === 'type' && typeDraft) { el.innerHTML = typeEditor(); return; }
    if (sel && sel.kind === 'image') {
      const im = imageById(loop, sel.id);
      if (im) { el.innerHTML = imageInspector(im); return; }
      sel = null;
    }
    if (sel && sel.kind === 'multi') {
      selNodes = new Set([...selNodes].filter(id => nodeById(loop, id)));
      if (selNodes.size > 1) { el.innerHTML = multiInspector(loop); return; }
      sel = selNodes.size ? { kind: 'node', id: [...selNodes][0] } : null;
    }
    if (sel && sel.kind === 'node' && nodeById(loop, sel.id)) el.innerHTML = nodeInspector(loop, nodeById(loop, sel.id));
    else if (sel && sel.kind === 'link' && linkById(loop, sel.id)) el.innerHTML = linkInspector(loop, linkById(loop, sel.id));
    else { sel = null; el.innerHTML = loopInspector(loop); }
    renderChecklist();
  }
  function selectedEntity() {
    const loop = cur();
    if (!sel) return { kind: 'general', ent: loop.general, items: generalItems(loop) };
    if (sel.kind === 'type' || sel.kind === 'multi' || sel.kind === 'image') return null;
    if (sel.kind === 'node') { const n = nodeById(loop, sel.id); return n && { kind: 'node', ent: n, items: nodeItems(loop, n) }; }
    const l = linkById(loop, sel.id); return l && { kind: 'link', ent: l, items: linkItems(loop, l) };
  }

  function catOptions(selected) {
    return CAT_KEYS.map(k => `<option value="${k}" ${k === selected ? 'selected' : ''}>${esc(CAT[k].n)}</option>`).join('');
  }
  function checklistBlock(title) {
    return `<h3><span>${title}</span><span class="allset">
        <button class="btn ghost small" data-all="ordered">All ordered</button>
        <button class="btn ghost small" data-all="have">All in stock</button>
        <button class="btn ghost small" data-all="na" title="Mark everything still To order as Not needed">All not needed</button></span></h3>
      <div id="ckl" class="checklist"></div>
      <div class="addrow">
        <label class="sr" for="addName">Add an item</label>
        <input id="addName" type="text" placeholder="Add an item to remember…">
        <label class="sr" for="addCat">Category</label>
        <select id="addCat">${catOptions('other')}</select>
        <button id="addBtn" class="btn small">Add</button>
      </div>`;
  }

  function summaryHTML(loop) {
    const c = counts(allItems(loop));
    return `<div class="todo"><b>${c.todo}</b><span>to order</span></div>
        <div class="ordered"><b>${c.ordered}</b><span>ordered</span></div>
        <div class="have"><b>${c.have}</b><span>in stock</span></div>
        <div class="na"><b>${c.na}</b><span>not needed</span></div>`;
  }
  function renderSummary() {
    const g = $('summaryGrid');
    if (g) g.innerHTML = summaryHTML(cur());
  }
  function loopInspector(loop) {
    return `<h2>${esc(loop.name || 'Untitled loop')}</h2>
      <div id="summaryGrid" class="summary-grid">${summaryHTML(loop)}</div>
      ${flagListHTML(loop)}
      <p class="tip">Select an item or a cable on the sheet to see its checklist. Drag from a round handle on the side of an item to another item to draw a cable. Drag a box on an empty part of the sheet to select several items: left to right selects items fully inside, right to left selects anything the box touches. Then drag one of them to move them together (drag an enclosure's dashed outline or label to move it with everything inside); Ctrl+C / Ctrl+V copies and pastes them at the mouse pointer (Ctrl+Shift+V keeps their order statuses). Ctrl+V with a picture on the clipboard (e.g. a screenshot) inserts it as an image; you can also drop image files on the sheet. Drag a selected item's corner grip to resize it. A selected cable has grips: drag an end onto another item to reroute it, or drag the middle grip to move its path. The eye on a cable's tag hides its information box (H); the cable stays drawn. The status bar under the sheet has SNAP (F9), ORTHO (F8) and OSNAP (F3). The sheet is endless: the mouse wheel zooms at the cursor, drag with the middle button (or hold Space and drag) to pan, double-click the middle button to zoom extents. Click a status to step it: To order → Ordered → In stock → Not needed.</p>
      ${(() => { const c = readClip(); return c && (c.nodes.length || c.cable) ? `<div class="del-row" style="margin-top:12px"><button class="btn ghost" data-clip="paste" title="Ctrl+V">${c.cable ? `Paste cable ${esc(c.cable.tag)}` : `Paste ${c.nodes.length} copied item${c.nodes.length > 1 ? 's' : ''}`}</button>${keepBox()}</div>` : ''; })()}
      ${checklistBlock('Whole-loop consumables')}`;
  }

  function imageInspector(im) {
    return `<h2>Image</h2><div class="kind">${im.w} × ${im.h} on the sheet · picture ${im.nw} × ${im.nh} px</div>
      <div class="form">
        <label for="i-name">Name</label><input id="i-name" type="text" data-imgf="name" value="${esc(im.name)}">
        <label for="i-w">Width</label><input id="i-w" type="number" min="10" step="1" data-imgf="w" value="${im.w}" ${im.locked ? 'disabled' : ''}>
        <label for="i-h">Height</label><input id="i-h" type="number" min="10" step="1" data-imgf="h" value="${im.h}" ${im.locked ? 'disabled' : ''}>
        <label for="i-fade">Fade</label><div class="row"><input id="i-fade" type="range" min="0" max="90" step="5" data-imgf="fade" value="${im.fade || 0}"><span id="i-fade-v">${im.fade || 0}%</span></div>
        <span></span><div class="row" style="flex-direction:column;align-items:flex-start">
          <label><input id="i-frame" type="checkbox" data-imgf="frame" ${im.frame ? 'checked' : ''}> Show frame</label>
          <label><input id="i-lock" type="checkbox" data-imgf="locked" ${im.locked ? 'checked' : ''}> Lock position and size</label>
        </div>
      </div>
      <p class="tip">Width and height keep the picture's proportions. Drag a corner grip on the sheet to scale it.</p>
      <h3><span>Draw order</span></h3>
      <div class="allset">
        <button class="btn ghost small${im.front ? '' : ' on-order'}" data-imgact="back" title="Behind items and cables (default)">Send to back</button>
        <button class="btn ghost small${im.front ? ' on-order' : ''}" data-imgact="front" title="In front of items and cables">Bring to front</button>
      </div>
      <div class="del-row">
        <button class="btn ghost" data-clip="copy" title="Ctrl+C">Copy</button>
        <button class="btn ghost" data-imgact="reset" ${im.locked ? 'disabled' : ''}>Original size</button>
        <button class="btn ghost danger" data-del="image">Delete image</button>
      </div>`;
  }

  function multiInspector(loop) {
    const nodes = [...selNodes].map(id => nodeById(loop, id)).filter(Boolean);
    let items = [];
    nodes.forEach(n => { items = items.concat(nodeItems(loop, n)); });
    const c = counts(items);
    return `<h2>${nodes.length} items selected</h2>
      <p class="tip">Drag any of them to move them together, or nudge with the arrow keys (Shift for bigger steps). Shift+click adds or removes an item. Esc clears the selection.</p>
      <div class="multi-list">${nodes.map(n => `<button class="btn ghost small" data-goto-node="${n.id}">${n.flag ? '⚑ ' : ''}${esc(n.tag)}</button>`).join('')}</div>
      <div class="flag-row"><span class="flag-title">⚑ Flag all</span><div class="flag-colors">${Object.keys(FLAGS).map(c => `<button class="flag-dot" data-flag="${c}" style="--flag: var(--flag-${c})" title="${FLAGS[c]} flag"></button>`).join('')}<button class="btn ghost small" data-flag="none">Unflag all</button></div></div>
      <h3><span>Their checklists</span></h3>
      <p class="tip" style="margin-top:0"><b style="color:var(--todo)">${c.todo}</b> to order · <b style="color:var(--ordered)">${c.ordered}</b> ordered · <b style="color:var(--have)">${c.have}</b> in stock</p>
      <div class="allset"><button class="btn ghost small" data-mall="ordered">Mark all ordered</button><button class="btn ghost small" data-mall="have">Mark all in stock</button><button class="btn ghost small" data-mall="na" title="Mark everything still To order as Not needed">Mark all not needed</button></div>
      <div class="del-row">
        <button class="btn ghost" data-clip="copy" title="Ctrl+C">Copy</button>
        <button class="btn ghost" data-clip="dup" title="Ctrl+D">Duplicate</button>
        ${keepBox()}
        <button class="btn ghost danger" data-del="multi">Delete ${nodes.length} items</button></div>`;
  }

  function nodeInspector(loop, n) {
    const t = T(n.type);
    const conns = loop.links.filter(l => l.a === n.id || l.b === n.id);
    return `<div class="insp-head">${symHTML(n.type, n.tag, 'big')}<div><h2>${esc(n.tag)}</h2><div class="kind">${esc(t.name)}</div></div></div>
      ${flagRow(n)}
      <div class="form">
        <label for="f-tag">Tag</label><input id="f-tag" type="text" data-bind="tag" value="${esc(n.tag)}">
        <label for="f-desc">Service</label><input id="f-desc" type="text" data-bind="desc" value="${esc(n.desc)}">
        <label for="f-scale">Size</label><div class="row"><input id="f-scale" type="number" min="50" max="300" step="5" data-scale="1" value="${Math.round((n.scale || 1) * 100)}" style="width:5.5em"> %
          ${(n.scale || 1) !== 1 ? '<button class="btn ghost small" data-scalereset="1">Reset</button>' : ''}<span class="muted" style="font-size:.8rem">or drag a corner grip</span></div>
        ${n.lblOff ? '<span></span><div class="row"><button class="btn ghost small" data-nlblreset="1" title="Put the text back under the symbol">Reset text position</button></div>' : ''}
        <label for="f-inside">Mounted inside</label><select id="f-inside" data-bind="inside" data-rerender="1">
          <option value="">Not inside another item</option>
          ${loop.nodes.filter(o => o.id !== n.id && isEnclosure(o.type) && o.inside !== n.id).map(o => `<option value="${o.id}" ${n.inside === o.id ? 'selected' : ''}>${esc(o.tag)} (${esc(T(o.type).name)})</option>`).join('')}
        </select>
        <label for="f-notes">Notes</label><textarea id="f-notes" data-bind="notes" placeholder="Model, supplier, PO number…">${esc(n.notes)}</textarea>
      </div>
      ${t.custom ? `<p class="tip">This is one of your components. <button class="linkbtn" data-edit-type="${esc(n.type)}">Edit its reminders</button> (changes apply to every ${esc(t.name)}).</p>` : ''}
      ${checklistBlock('To order for this item')}
      ${terminalSchedule(loop, n)}
      <h3><span>Cables (${conns.length})</span></h3>
      ${conns.length ? `<ul class="conn-list">${conns.map(l => {
        const other = nodeById(loop, l.a === n.id ? l.b : l.a);
        const c = counts(linkItems(loop, l));
        return `<li><button data-goto="${l.id}"><span><b>${esc(l.tag)}</b> to ${esc(other ? other.tag : '?')}</span><span style="color:var(--${c.todo ? 'todo' : 'have'})">${c.todo ? c.todo + ' to order' : 'done'}</span></button></li>`;
      }).join('')}</ul>` : '<p class="tip">No cables yet. Drag from the round handle to another item.</p>'}
      <div class="del-row">
        <button class="btn ghost" data-clip="copy" title="Ctrl+C">Copy</button>
        <button class="btn ghost" data-clip="dup" title="Ctrl+D">Duplicate</button>
        ${keepBox()}
        <button class="btn ghost danger" data-del="node">Delete ${esc(n.tag)}</button></div>`;
  }

  // ---------------------------------------------------------------- component type editor
  let typeDraft = null;
  function openTypeEditor(id) {
    const existing = id && (state.customTypes || []).find(c => c.id === id);
    typeDraft = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: null, name: '', tag: '', shape: 'box', sym: '', desc: '', panel: false, enclosure: false, terminals: false,
      items: [{ key: 'k' + uid(), name: '', cat: 'device', qty: 1, unit: 'pcs' }]
    };
    sel = { kind: 'type', id: typeDraft.id };
    if (view !== 'diagram') setView('diagram');
    renderDiagram(); renderInspector();
    const f = $('t-name'); if (f && !typeDraft.name) f.focus();
  }
  function typeEditor() {
    const d = typeDraft;
    const inUse = d.id ? state.loops.reduce((s, l) => s + l.nodes.filter(n => n.type === d.id).length, 0) : 0;
    return `<h2>${d.id ? 'Edit component' : 'New component'}</h2>
      <p class="tip">Define an item you use often, with the list of things to order every time it appears on a loop.</p>
      <div class="form">
        <label for="t-name">Name</label><input id="t-name" type="text" data-tf="name" value="${esc(d.name)}" placeholder="e.g. Hall sensor">
        <label for="t-tag">Tag prefix</label><input id="t-tag" type="text" data-tf="tag" value="${esc(d.tag)}" placeholder="e.g. HS-">
        <label for="t-shape">Symbol</label><select id="t-shape" data-tf="shape" data-rerender="1">
          ${Object.keys(SYMBOLS).map(k => `<option value="${k}" ${(SYMBOLS[d.shape] ? d.shape : 'box') === k ? 'selected' : ''}>${esc(SYMBOLS[k].name)}</option>`).join('')}</select>
        ${['box', 'jb', 'panel'].includes(d.shape) ? `<label for="t-sym">Letters</label><input id="t-sym" type="text" maxlength="4" data-tf="sym" value="${esc(d.sym)}" placeholder="e.g. CA">` : ''}
        <label for="t-desc">Service</label><input id="t-desc" type="text" data-tf="desc" value="${esc(d.desc)}" placeholder="Default description">
        <span></span><div class="row" style="flex-direction:column;align-items:flex-start">
          <label><input id="t-panel" type="checkbox" data-tf="panel" ${d.panel ? 'checked' : ''}> Panel item (wires to other panel items as panel wire)</label>
          <label><input id="t-encl" type="checkbox" data-tf="enclosure" ${d.enclosure ? 'checked' : ''}> Enclosure (other items can be mounted inside)</label>
          <label><input id="t-term" type="checkbox" data-tf="terminals" ${d.terminals ? 'checked' : ''}> Has terminals (count terminal blocks, end stops, markers)</label>
        </div>
      </div>
      <h3><span>Reminders to order</span></h3>
      <div class="titems">${d.items.map((it, i) => `<div class="titem">
          <label class="sr" for="ti-name-${i}">Item ${i + 1}</label>
          <input id="ti-name-${i}" type="text" data-tf="items.${i}.name" value="${esc(it.name)}" placeholder="What to order">
          <label class="sr" for="ti-cat-${i}">Category</label>
          <select id="ti-cat-${i}" data-tf="items.${i}.cat">${catOptions(it.cat)}</select>
          <label class="sr" for="ti-qty-${i}">Quantity</label>
          <input id="ti-qty-${i}" type="number" min="0" step="any" data-tf="items.${i}.qty" value="${esc(it.qty == null ? '' : it.qty)}" placeholder="qty">
          <label class="sr" for="ti-unit-${i}">Unit</label>
          <input id="ti-unit-${i}" type="text" data-tf="items.${i}.unit" value="${esc(it.unit)}" placeholder="pcs">
          <button class="ci-del" data-tact="rm-item" data-i="${i}" title="Remove">×</button>
        </div>`).join('')}</div>
      <div class="addrow"><button class="btn ghost small" data-tact="add-item">+ Add reminder</button></div>
      <div class="del-row">
        <button class="btn" data-tact="save">${d.id ? 'Save changes' : 'Create component'}</button>
        <button class="btn ghost" data-tact="cancel">Cancel</button>
        ${d.id ? `<button class="btn ghost danger" data-tact="delete">Delete${inUse ? ` (used ${inUse}×)` : ''}</button>` : ''}
      </div>`;
  }
  function onTypeInput(e) {
    const t = e.target, path = t.dataset.tf;
    let v = t.type === 'checkbox' ? t.checked : t.value;
    if (path.endsWith('.qty')) v = t.value === '' ? null : Number(t.value);
    setPath(typeDraft, path, v);
    if (e.type === 'change' && t.dataset.rerender) renderInspector();
  }
  function onTypeAction(act, el) {
    const d = typeDraft;
    if (act === 'add-item') {
      d.items.push({ key: 'k' + uid(), name: '', cat: 'other', qty: 1, unit: 'pcs' });
      renderInspector();
      const f = $('ti-name-' + (d.items.length - 1)); if (f) f.focus();
    } else if (act === 'rm-item') {
      d.items.splice(Number(el.dataset.i), 1); renderInspector();
    } else if (act === 'cancel') {
      typeDraft = null; sel = null; renderAll();
    } else if (act === 'save') {
      if (!d.name.trim()) { $('t-name').focus(); toast('Give the component a name.'); return; }
      d.name = d.name.trim();
      d.items = d.items.filter(it => (it.name || '').trim());
      if (!d.sym) d.sym = (d.tag || d.name).replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '?';
      const isNew = !d.id;
      if (isNew) { d.id = 'u_' + uid(); state.customTypes.push(d); }
      else state.customTypes = state.customTypes.map(c => c.id === d.id ? d : c);
      typeDraft = null; sel = null;
      renderPalette(); renderAll(); save();
      toast(isNew ? `Created “${d.name}”. Drag it from My components.` : `Saved “${d.name}”.`);
    } else if (act === 'delete') {
      const n = state.loops.reduce((s, l) => s + l.nodes.filter(x => x.type === d.id).length, 0);
      askConfirm(`Delete component “${d.name}”?${n ? ` ${n} item(s) on your loops will become “Other item”.` : ''}`, 'Delete component', () => {
        snapshot();
        state.loops.forEach(l => l.nodes.forEach(x => { if (x.type === d.id) x.type = 'generic'; }));
        state.customTypes = state.customTypes.filter(c => c.id !== d.id);
        typeDraft = null; sel = null;
        renderPalette(); renderAll(); save();
        toast('Component deleted.', true);
      });
    }
  }

  // which core goes to which terminal at each end; typing a number overrides the automatic one
  function coresTable(loop, l, na, nb) {
    const plan = terminalPlan(loop);
    const strips = loop.nodes.filter(o => plan[o.id]);
    if (!strips.length || (!na && !nb)) return '';
    const cell = (n, end, core) => {
      if (!n) return '<td class="muted">open end</td>';
      const target = coreTarget(loop, l, end, core, plan);
      const tn = nodeById(loop, target);
      const P = plan[target];
      const entry = P && (P.ends[l.id + ':' + end + (target === l[end] ? '' : ':f')]);
      const c = entry && entry.list.find(x => x.core === core);
      const opts = [n].concat(strips.filter(o => o.id !== n.id && o.id !== l[end === 'a' ? 'b' : 'a']));
      const select = `<select class="cmap" data-cmap="${end}|${esc(core)}" aria-label="Item for core ${esc(core)} at the ${end.toUpperCase()} end">${opts.map(o => `<option value="${o.id}" ${o.id === target ? 'selected' : ''}>${o.id === n.id ? '' : '→ '}${esc(o.tag)}</option>`).join('')}</select>`;
      if (!c) return `<td title="Lands on the device itself"><div class="ccell">${select}</div></td>`;
      const users = (P.used[entry.side][c.num] || []).filter(u => !(u.l.id === l.id && u.core === core));
      const clash = users.length ? ` title="Also used by ${users.map(u => `${u.l.tag} core ${u.core}`).join(', ')}"` : '';
      return `<td class="${users.length ? 'clash' : ''}${target !== n.id ? ' moved' : ''}"${clash}><div class="ccell">${select}<span class="tprefix">:</span><input type="text" data-tmap="${end}|${esc(core)}" value="${c.manual ? esc(c.num) : ''}" placeholder="${esc(c.num)}" aria-label="Terminal for core ${esc(core)} at ${esc(tn.tag)}">${users.length ? '<b class="clash-mark">!</b>' : ''}</div></td>`;
    };
    const anyManual = ['a', 'b'].some(end => Object.keys(l.ends[end].tmap || {}).length || Object.keys(l.ends[end].cmap || {}).length);
    return `<h3><span>Cores &amp; terminals</span>${anyManual ? '<button class="btn ghost small" data-tmreset="1" title="Land every core on the cable end\'s own item again, with automatic numbers">Reset cores</button>' : ''}</h3>
      <div class="otable-wrap"><table class="ctable"><thead><tr><th>Core</th><th>A end</th><th>B end</th></tr></thead><tbody>
      ${coreKeys(l).map(core => `<tr><td class="cno">${core === 'S' ? 'Screen' : esc(core)}</td>${cell(na, 'a', core)}${cell(nb, 'b', core)}</tr>`).join('')}
      </tbody></table></div>
      <p class="tip">Each core can land on another strip (choose it in the list) and terminal (type the number; grey numbers are automatic). A red mark means two cores share a terminal on the same side.</p>`;
  }
  // what lands on each terminal of an item, left and right side
  function terminalSchedule(loop, n) {
    const P = terminalPlan(loop)[n.id];
    if (!P || !P.rows.length) return '';
    const who = (side, r) => (P.used[side][r] || []).map(u => `${esc(u.l.tag)} <span class="muted">core ${esc(u.core)}</span>`).join('<br>') || '<span class="muted">–</span>';
    return `<h3><span>Terminals (${P.rows.length})</span></h3>
      <div class="otable-wrap"><table class="ctable"><thead><tr><th>Terminal</th><th>Left side</th><th>Right side</th></tr></thead><tbody>
      ${P.rows.map(r => `<tr${P.mixed.has(r) ? ' class="mixed" title="Ex i and other circuits on the same terminal: keep intrinsically safe circuits separate"' : ''}><td class="cno${P.exi.has(r) ? ' exi' : ''}">${esc(termName(n, r))}${P.mixed.has(r) ? ' <b class="clash-mark">!</b>' : ''}</td><td${(P.used.l[r] || []).length > 1 ? ' class="clash"' : ''}>${who('l', r)}</td><td${(P.used.r[r] || []).length > 1 ? ' class="clash"' : ''}>${who('r', r)}</td></tr>`).join('')}
      </tbody></table></div>${spareTerminals(loop, n.id).length ? `<button class="btn ghost small" data-sparerm="${n.id}" title="Delete terminals nothing lands on; the numbers close up">Remove ${spareTerminals(loop, n.id).length} spare terminal${spareTerminals(loop, n.id).length > 1 ? 's' : ''}</button>` : ''}${P.mixed.size ? `<p class="tip warn-text">${P.mixed.size} terminal${P.mixed.size > 1 ? 's carry' : ' carries'} both Ex i and other circuits. Keep intrinsically safe circuits on their own (blue) terminals.</p>` : ''}`;
  }

  function linkInspector(loop, l) {
    const c = CABLES[l.cable];
    const na = nodeById(loop, l.a), nb = nodeById(loop, l.b);
    const shielded = isShielded(l);
    const nLabel = c.pairs ? 'Pairs' : 'Cores';
    const endHTML = (end, node) => {
      const autoTerm = (() => { const keep = l.ends[end].term; l.ends[end].term = 'auto'; const t = termAt(loop, l, end); l.ends[end].term = keep; return t; })();
      return `<div class="end">
        <div class="end-h"><span>${end.toUpperCase()} end</span><b>${node ? esc(node.tag) : '<span class="open-tag">open end</span>'}</b></div>
        ${`<div class="row"><label class="sr" for="conn-${end}">${node ? 'Move' : 'Connect'} the ${end.toUpperCase()} end to</label><select id="conn-${end}" data-connect="${end}">
            <option value="">${node ? 'Move this end to…' : 'Connect to…'}</option>
            ${loop.nodes.filter(o => o.id !== l[end === 'a' ? 'b' : 'a'] && o.id !== l[end]).map(o => `<option value="${o.id}">${esc(o.tag)} (${esc(o.desc || T(o.type).name)})</option>`).join('')}
          </select></div>`}
        <div class="row"><label class="sr" for="term-${end}">Termination at ${end.toUpperCase()} end</label>
          <select id="term-${end}" data-bind="ends.${end}.term" data-rerender="1">
            <option value="auto" ${l.ends[end].term === 'auto' ? 'selected' : ''}>Auto: ${esc(TERMS[autoTerm])}</option>
            ${Object.keys(TERMS).map(k => `<option value="${k}" ${l.ends[end].term === k ? 'selected' : ''}>${esc(TERMS[k])}</option>`).join('')}
          </select></div>
        <div class="row"><label><input id="gland-${end}" type="checkbox" data-bind="ends.${end}.gland" ${glandAt(loop, l, end) ? 'checked' : ''}> Cable gland at this end</label></div>
      </div>`;
    };
    return `<div class="insp-head"><div><h2>${esc(l.tag)}</h2><div class="kind">${esc(na ? na.tag : 'open end')} → ${esc(nb ? nb.tag : 'open end')}</div></div></div>
      ${!na || !nb ? '<p class="open-warn">This cable has an open end. Drag the ◯ on the drawing onto an item, or choose one under Ends.</p>' : ''}
      ${flagRow(l)}
      <div class="form">
        <label for="f-tag">Cable tag</label><input id="f-tag" type="text" data-bind="tag" value="${esc(l.tag)}">
        <label for="f-cable">Type</label><select id="f-cable" data-bind="cable" data-rerender="1">
          ${Object.keys(CABLES).map(k => `<option value="${k}" ${k === l.cable ? 'selected' : ''}>${esc(CABLES[k].name)}</option>`).join('')}</select>
        ${c.fixed ? '' : `<label for="f-n">${nLabel}</label><input id="f-n" type="number" min="1" step="1" data-bind="n" data-num="1" value="${esc(l.n || c.defN)}">`}
        <label for="f-size">Size</label><input id="f-size" type="text" data-bind="size" value="${esc(l.size)}" placeholder="e.g. 1.5 mm² or 18 AWG">
        <label for="f-len">Length (m)</label><input id="f-len" type="number" min="0" step="1" data-bind="length" data-num="1" value="${esc(l.length == null ? '' : l.length)}" placeholder="route length">
        <label for="f-route">Route</label><select id="f-route" data-bind="route">
          ${Object.keys(ROUTES).map(k => `<option value="${k}" ${k === l.route ? 'selected' : ''}>${esc(ROUTES[k])}</option>`).join('')}</select>
        <span></span><div class="row">
          <label><input id="f-shield" type="checkbox" data-bind="shielded" data-rerender="1" ${shielded ? 'checked' : ''}> Shielded</label>
          ${c.field ? `<label><input id="f-arm" type="checkbox" data-bind="armoured" ${l.armoured ? 'checked' : ''}> Armoured</label>` : ''}
          <label title="Blue cable and terminals; checked against other circuits"><input id="f-exi" type="checkbox" data-bind="exi" data-rerender="1" ${l.exi ? 'checked' : ''}> Ex i (intrinsically safe)</label>
          <label title="Hide the information box of this cable on the drawing (H)"><input id="f-hidden" type="checkbox" data-bind="infoHidden" ${l.infoHidden ? 'checked' : ''}> Hide its information</label>
        </div>
        ${shielded ? `<label for="f-screen">Screen earth</label><select id="f-screen" data-bind="screenEnd">
          ${[['auto', 'Auto (panel side)'], ['a', `A end (${na ? na.tag : ''})`], ['b', `B end (${nb ? nb.tag : ''})`], ['both', 'Both ends'], ['none', 'Not earthed']]
            .map(([v, t]) => `<option value="${v}" ${(l.screenEnd || 'auto') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
      </div>
      <h3><span>Ends</span></h3>
      <div class="ends">${endHTML('a', na)}${endHTML('b', nb)}</div>
      ${coresTable(loop, l, na, nb)}
      <div class="form"><label for="f-notes">Notes</label><textarea id="f-notes" data-bind="notes" placeholder="Supplier, drum number, PO…">${esc(l.notes)}</textarea></div>
      ${checklistBlock('To order for this cable')}
      <div class="del-row">
        ${l.bend ? '<button class="btn ghost small" data-bendreset="1" title="Go back to the automatic route">Reset route</button>' : ''}
        ${l.lblOff ? '<button class="btn ghost small" data-lblreset="1" title="Put the label back on the cable">Reset label position</button>' : ''}
        ${na ? `<button class="btn ghost small" data-goto-node="${l.a}">Go to ${esc(na.tag)}</button>` : ''}
        ${nb ? `<button class="btn ghost small" data-goto-node="${l.b}">Go to ${esc(nb.tag)}</button>` : ''}
        <button class="btn ghost small" data-clip="copy" title="Ctrl+C: copy this cable's settings">Copy cable</button>
        ${(() => { const c = readClip(); return c && c.cable && c.cable.id !== l.id ? `<button class="btn ghost small" data-clip="match" title="Give this cable the settings of ${esc(c.cable.tag)}">Paste settings of ${esc(c.cable.tag)}</button>` : ''; })()}
        <button class="btn ghost danger" data-del="link">Delete ${esc(l.tag)}</button>
      </div>`;
  }

  let currentChecklist = [];
  function renderChecklist() {
    const box = $('ckl');
    if (!box) return;
    const se = selectedEntity();
    if (!se) return;
    currentChecklist = se.items;
    const order = {};
    CAT_KEYS.forEach((k, i) => { order[k] = i; });
    const items = se.items.map((it, idx) => ({ it, idx })).sort((a, b) => order[a.it.cat] - order[b.it.cat] || a.idx - b.idx);
    box.innerHTML = items.map(({ it, idx }) => `<div class="ci ${it.status}${hlMatch(it) ? ' ci-hl' : ''}">
        <button class="status ${it.status}" data-i="${idx}" title="Click to change status">${STATUS_LABEL[it.status]}</button>
        <div class="ci-name"><span class="ci-cat">${CAT[it.cat].s}</span>${esc(it.name)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</div>
        <div class="ci-qty"><label class="sr" for="q-${idx}">Quantity</label><input id="q-${idx}" type="number" min="0" step="any" data-q="${idx}" value="${esc(it.q != null ? it.q : '')}" placeholder="${esc(it.auto)}">${esc(it.unit)}
          ${it.custom ? `<button class="ci-del" data-rm="${idx}" title="Remove">×</button>` : ''}</div>
      </div>`).join('');
  }

  // ---------------------------------------------------------------- order list
  function orderRows() {
    const loops = orderScope === 'all' ? state.loops : [cur()];
    let rows = [];
    loops.forEach(loop => { rows = rows.concat(allItems(loop)); });
    return rows;
  }
  // One display row per item ("Per branch") or per identical item summed across branches ("Totals").
  function displayRows() {
    const items = orderRows().filter(r => orderFilter === 'all' || r.status === orderFilter);
    const short = r => r.where.kind === 'general' ? r.where.label : r.where.label.split(' (')[0];
    if (orderGroup === 'branch') {
      return items.map(r => ({ status: r.status, cat: r.cat, name: r.name, qty: r.qty, unit: r.unit, members: [r],
        forLabel: r.where.label, jump: r.where.kind === 'general' ? null : r, loopLabel: r.loop.name }));
    }
    const groups = new Map();
    items.forEach(r => {
      const base = r.name.replace(/ at [^\s()]+/, '');
      const k = `${r.cat}|${base.toLowerCase()}|${r.unit}`;
      if (!groups.has(k)) groups.set(k, { cat: r.cat, name: base, unit: r.unit, members: [] });
      groups.get(k).members.push(r);
    });
    return Array.from(groups.values()).map(g => {
      const nums = g.members.filter(m => m.qty !== '' && m.qty != null && !isNaN(Number(m.qty)));
      const sum = nums.reduce((s, m) => s + Number(m.qty), 0);
      const missing = g.members.length - nums.length;
      const qty = nums.length ? (Math.round(sum * 100) / 100) + (missing ? ' + ?' : '') : '';
      const where = Array.from(new Set(g.members.map(short)));
      return Object.assign(g, { status: worst(g.members), qty, jump: null,
        forLabel: where.length > 4 ? `${where.slice(0, 4).join(', ')} +${where.length - 4} more` : where.join(', '),
        loopLabel: Array.from(new Set(g.members.map(m => m.loop.name))).join(', ') });
    });
  }
  function renderOrders() {
    const c = counts(orderRows());
    const shown = displayRows();
    $('ordersTitle').textContent = orderScope === 'all' ? 'Order list: all loops' : `Order list: ${cur().name || 'Untitled loop'}`;
    $('ordersSub').textContent = `${c.todo} to order · ${c.ordered} ordered · ${c.have} in stock · ${c.na} not needed`;
    document.querySelectorAll('#filterSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === orderFilter));
    document.querySelectorAll('#scopeSeg button').forEach(b => b.classList.toggle('on', b.dataset.scope === orderScope));
    document.querySelectorAll('#groupSeg button').forEach(b => b.classList.toggle('on', b.dataset.g === orderGroup));
    currentOrderRows = shown;
    if (!shown.length) {
      $('ordersBody').innerHTML = `<p class="ocat-empty">${orderFilter === 'todo' ? 'Nothing left to order. Every item is ordered, in stock or marked not needed.' : 'No items with this status.'}</p>`;
      return;
    }
    const by = {};
    shown.forEach((r, i) => { (by[r.cat] = by[r.cat] || []).push(i); });
    $('ordersBody').innerHTML = CAT_KEYS.filter(k => by[k]).map(k => {
      const idxs = by[k];
      return `<section class="ocat"><h2>${esc(CAT[k].n)} <small>${idxs.length} line${idxs.length === 1 ? '' : 's'}</small></h2>
        <div class="otable-wrap"><table class="otable"><thead><tr><th>Status</th><th>Item</th><th>For</th><th class="q">Qty</th></tr></thead><tbody>
        ${idxs.map(i => {
          const r = shown[i];
          const title = r.members.length > 1 ? ` title="Sets all ${r.members.length} lines"` : '';
          return `<tr${r.members.some(hlMatch) ? ' class="row-hl"' : ''}><td><button class="status ${r.status}" data-o="${i}"${title}>${STATUS_LABEL[r.status]}</button></td>
            <td>${esc(r.name)}</td>
            <td class="where">${(() => { const f = r.members.map(m => m.entity && m.entity.flag).find(Boolean); return f ? `<span class="flag-mini" style="--flag: var(--flag-${f.color})" title="Flagged${f.note ? ': ' + esc(f.note) : ''}">⚑</span>` : ''; })()}${r.jump ? `<button class="linkbtn" data-jump="${i}" title="Show on the diagram">${esc(r.forLabel)}</button>` : esc(r.forLabel)}${orderScope === 'all' ? `<div class="loopname">${esc(r.loopLabel)}</div>` : ''}</td>
            <td class="q">${r.qty === '' || r.qty == null ? '<span class="muted">?</span>' : esc(r.qty)} ${esc(r.unit)}</td></tr>`;
        }).join('')}
        </tbody></table></div></section>`;
    }).join('');
  }
  let currentOrderRows = [];

  function listText(rows) {
    const by = {};
    rows.forEach(r => { (by[r.cat] = by[r.cat] || []).push(r); });
    return CAT_KEYS.filter(k => by[k]).map(k => `${CAT[k].n.toUpperCase()}\n` + by[k].map(r =>
      `[${r.status === 'todo' ? ' ' : r.status === 'ordered' ? '~' : 'x'}] ${r.name}${r.qty !== '' && r.qty != null ? ` — ${r.qty} ${r.unit}` : ''} — ${r.forLabel}${orderScope === 'all' ? ` (${r.loopLabel})` : ''}`
    ).join('\n')).join('\n\n');
  }
  function csvText(rows) {
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const head = ['Status', 'Category', 'Item', 'For', 'Loop', 'Qty', 'Unit'];
    return [head.join(',')].concat(rows.map(r => [STATUS_LABEL[r.status], CAT[r.cat].n, r.name, r.forLabel, r.loopLabel, r.qty, r.unit].map(q).join(','))).join('\n');
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function copyText(text, okMsg) {
    const fb = $('copyFallback');
    const fallback = () => {
      fb.hidden = false; fb.value = text; fb.focus(); fb.select();
      toast('Copy blocked by the browser. The list is selected below: press Ctrl+C.');
    };
    try {
      navigator.clipboard.writeText(text).then(() => { fb.hidden = true; toast(okMsg); }, fallback);
    } catch (e) { fallback(); }
  }

  // ---------------------------------------------------------------- toast / confirm
  function toast(msg, withUndo) {
    const undo = withUndo;
    const t = $('toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undoBtn">Undo</button>' : ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 7000 : 3500);
    if (undo) $('undoBtn').onclick = () => { t.hidden = true; window.setTimeout(historyUndo, 0); };
  }
  function snapshot() { undoSnapshot = JSON.stringify(state); }
  function askConfirm(text, label, fn) {
    $('confirmText').textContent = text;
    $('confirmYes').textContent = label;
    confirmAction = fn;
    $('confirmBar').hidden = false;
  }

  // ---------------------------------------------------------------- geometry / zoom
  function toWorld(clientX, clientY) {
    const r = $('viewport').getBoundingClientRect();
    return { x: (clientX - r.left - panX) / zoom, y: (clientY - r.top - panY) / zoom };
  }
  // The region the user last chose (by zooming, panning, Fit…): resizing the sheet always
  // rescales from this reference, so returning to the same size gives the same view.
  let refView = null;
  function updateView(fromResize) {
    const vpEl = $('viewport');
    if (!fromResize && vpEl.clientWidth && vpEl.clientHeight) {
      refView = { cx: (vpEl.clientWidth / 2 - panX) / zoom, cy: (vpEl.clientHeight / 2 - panY) / zoom, ww: vpEl.clientWidth / zoom, wh: vpEl.clientHeight / zoom };
    }
    $('world').style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    $('world').style.setProperty('--z', zoom);
    // grid lives on the viewport so it never ends; coarser steps when zoomed far out
    let minor = 20 * zoom, major = 100 * zoom;
    while (minor < 8) { minor *= 5; major *= 5; }
    const vp = $('viewport');
    vp.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
    vp.style.backgroundPosition = `${panX}px ${panY}px`;
    $('zoomVal').textContent = Math.round(zoom * 100) + '%';
  }
  function applyZoom(z, anchor) {
    const vp = $('viewport'), r = vp.getBoundingClientRect();
    const ax = anchor ? anchor.x : r.left + vp.clientWidth / 2, ay = anchor ? anchor.y : r.top + vp.clientHeight / 2;
    const w = toWorld(ax, ay);
    zoom = Math.min(ZMAX, Math.max(ZMIN, z));
    panX = ax - r.left - w.x * zoom;
    panY = ay - r.top - w.y * zoom;
    updateView();
  }
  function panBy(dx, dy) { panX += dx; panY += dy; updateView(); }
  // Zoom extents: everything on the sheet, centred.
  function fit() {
    const loop = cur(), vp = $('viewport');
    if (!loop.nodes.length && !(loop.images || []).length) { zoom = 1; panX = 40; panY = 40; updateView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    loop.nodes.forEach(n => { const f = fullBox(n); x0 = Math.min(x0, f.x0); y0 = Math.min(y0, f.y0); x1 = Math.max(x1, f.x1); y1 = Math.max(y1, f.y1); });
    (loop.images || []).forEach(im => { x0 = Math.min(x0, im.x); y0 = Math.min(y0, im.y); x1 = Math.max(x1, im.x + im.w); y1 = Math.max(y1, im.y + im.h); });
    const pad = 50;
    zoom = Math.min(1.2, Math.max(ZMIN, Math.min(vp.clientWidth / (x1 - x0 + pad * 2), vp.clientHeight / (y1 - y0 + pad * 2))));
    panX = (vp.clientWidth - (x1 + x0) * zoom) / 2;
    panY = (vp.clientHeight - (y1 + y0) * zoom) / 2;
    updateView();
  }
  // Mirror the current loop left <-> right (e.g. to put the PLC on the left).
  function mirror() {
    const loop = cur();
    if (!loop.nodes.length) return;
    snapshot();
    let x0 = Infinity, x1 = -Infinity;
    loop.nodes.forEach(n => { const w = (sizes[n.id] || { w: NODE_W }).w; x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x + w); });
    loop.nodes.forEach(n => { const w = (sizes[n.id] || { w: NODE_W }).w; n.x = clampX(snap(x0 + x1 - n.x - w)); });
    loop.links.forEach(l => ['fa', 'fb'].forEach(k => { if (l[k]) l[k].x = x0 + x1 - l[k].x; }));
    loop.nodes.forEach(n => { if (n.lblOff) n.lblOff.dx = -n.lblOff.dx; });
    loop.links.forEach(l => { if (l.lblOff) l.lblOff.dx = -l.lblOff.dx; if (l.bend && l.bend.x != null) l.bend.x = Math.round(x0 + x1 - l.bend.x); });
    (loop.images || []).forEach(im => { im.x = Math.round(x0 + x1 - im.x - im.w); });
    renderDiagram(); save();
    toast('Loop mirrored left ↔ right.', true);
  }
  const snap = v => draft.snap ? Math.round(v / draft.step) * draft.step : Math.round(v);
  const clampX = x => x; // endless sheet: no edges
  const clampY = y => y;

  // Nearest grid spot around (wx, wy) where a new symbol and its tag text overlap nothing.
  function freeSpot(loop, wx, wy) {
    const CW = 170, CH = 140; // room for a symbol plus its tag block
    const boxes = loop.nodes.map(fullBox);
    const free = (x, y) => boxes.every(b => x + CW / 2 <= b.x0 - 10 || x - CW / 2 >= b.x1 + 10 || y + CH <= b.y0 - 10 || y >= b.y1 + 10);
    for (let ring = 0; ring < 12; ring++) {
      for (let i = -ring; i <= ring; i++) {
        for (const [dx, dy] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) {
          const x = wx + dx * CW, y = wy - CH / 2 + dy * CH;
          if (free(x, y)) return { x, y: y + 30 };
        }
      }
    }
    return { x: wx, y: wy };
  }
  // resize an item about its centre (from the Size field)
  function setItemScale(n, k) {
    k = Math.min(3, Math.max(0.5, k || 1));
    const s0 = sizes[n.id] || { w: NODE_W, h: 56 };
    const cx = n.x + s0.w / 2, cy = n.y + s0.h / 2;
    snapshot();
    if (k === 1) delete n.scale; else n.scale = Math.round(k * 100) / 100;
    renderDiagram();
    const s1 = sizes[n.id] || s0;
    n.x = Math.round(cx - s1.w / 2); n.y = Math.round(cy - s1.h / 2);
    renderDiagram(); renderInspector(); save();
  }
  function addNode(type, wx, wy) {
    const loop = cur();
    const n = makeNode(type, clampX(snap(wx - NODE_W / 2)), clampY(snap(wy - 30)), loop);
    loop.nodes.push(n);
    sel = { kind: 'node', id: n.id };
    renderAll(); save();
  }
  function select(s) {
    sel = s;
    if (!s || s.kind !== 'multi') selNodes = new Set();
    renderDiagram(); renderInspector();
  }
  function selectedIds() {
    if (sel && sel.kind === 'multi') return [...selNodes];
    return sel && sel.kind === 'node' ? [sel.id] : [];
  }
  function setSelection(ids) {
    ids = Array.from(new Set(ids));
    if (ids.length > 1) { selNodes = new Set(ids); sel = { kind: 'multi' }; renderDiagram(); renderInspector(); }
    else select(ids.length ? { kind: 'node', id: ids[0] } : null);
  }
  // ---------------------------------------------------------------- copy / paste (like CAD)
  const CLIP_KEY = 'loop-planner-clipboard', KEEP_KEY = 'loop-planner-paste-keep';
  // Should copies keep the original's order statuses? (default: no, a copy is a new item to order)
  const keepPref = () => { try { return localStorage.getItem(KEEP_KEY) === '1'; } catch (e) { return keepMem; } };
  let keepMem = false;
  function setKeepPref(v) { keepMem = v; try { localStorage.setItem(KEEP_KEY, v ? '1' : '0'); } catch (e) { /* memory only */ } }
  const keepBox = () => `<label class="keep-opt"><input id="keepStatus" type="checkbox" ${keepPref() ? 'checked' : ''}> Copies keep order statuses <span class="muted">(otherwise they start as To order; Ctrl+Shift+V always keeps them)</span></label>`;
  let clipMem = null;          // fallback when storage is unavailable
  let pointerWorld = null;     // last mouse position over the sheet, for paste
  let lastPaste = null;        // where the previous paste went, to step repeated pastes
  let clipFallback = null, pasteKeep = false, clipMarkMem = null;
  function readClip() {
    try { const c = JSON.parse(localStorage.getItem(CLIP_KEY)); if (c && Array.isArray(c.nodes)) return c; } catch (e) { /* ignore */ }
    return clipMem;
  }
  function copySelection(quiet) {
    const loop = cur();
    if (sel && sel.kind === 'image' && imageById(loop, sel.id)) {
      const clip = { nodes: [], links: [], image: JSON.parse(JSON.stringify(imageById(loop, sel.id))) };
      clipMem = clip;
      try { localStorage.setItem(CLIP_KEY, JSON.stringify(clip)); } catch (e) { /* memory only */ }
      if (!quiet) toast('Copied the image. Ctrl+V pastes it at the mouse pointer.');
      return clip;
    }
    if (sel && sel.kind === 'link' && linkById(loop, sel.id)) { // a cable: copy its configuration
      const l = linkById(loop, sel.id);
      const clip = { nodes: [], links: [], cable: JSON.parse(JSON.stringify(l)) };
      clipMem = clip;
      try { localStorage.setItem(CLIP_KEY, JSON.stringify(clip)); } catch (e) { /* memory only */ }
      if (!quiet) toast(`Copied cable ${l.tag}. Ctrl+V, then click two items to connect them with a copy, or click a cable to give it these settings.`);
      renderInspector();
      return clip;
    }
    const ids = new Set(selectedIds());
    if (!ids.size) { if (!quiet) toast('Select items or a cable to copy first.'); return null; }
    loop.nodes.forEach(n => { if (ids.has(n.inside)) ids.add(n.id); }); // contents of copied enclosures
    const nodes = loop.nodes.filter(n => ids.has(n.id));
    const links = loop.links.filter(l => ids.has(l.a) && ids.has(l.b));
    const clip = { nodes: JSON.parse(JSON.stringify(nodes)), links: JSON.parse(JSON.stringify(links)) };
    clipMem = clip;
    try { localStorage.setItem(CLIP_KEY, JSON.stringify(clip)); } catch (e) { /* memory only */ }
    if (!quiet) toast(`Copied ${nodes.length} item${nodes.length > 1 ? 's' : ''}${links.length ? ` and ${links.length} cable${links.length > 1 ? 's' : ''}` : ''}. Ctrl+V pastes at the mouse pointer.`);
    renderInspector();
    return clip;
  }
  // Tag for a pasted item: the same tag if free in this loop, else the next free number (PT-101 -> PT-102).
  function freeTag(tag, used) {
    if (!used.has(tag)) { used.add(tag); return tag; } // keep the tag if it is free in this loop
    const m = String(tag).match(/^(.*?)(\d+)([^\d]*)$/);
    let t = tag;
    if (m) {
      let n = Number(m[2]);
      do { n++; t = m[1] + String(n).padStart(m[2].length, '0') + m[3]; } while (used.has(t));
    } else {
      let k = 2;
      while (used.has(t)) t = `${tag}-${k++}`;
    }
    used.add(t);
    return t;
  }
  function resetStatuses(ent) {
    Object.keys(ent.st || {}).forEach(k => { delete ent.st[k].s; });
    (ent.custom || []).forEach(c => { c.s = 'todo'; });
  }
  function paste(at, keep) {
    if (keep == null) keep = keepPref();
    const clip = readClip();
    if (clip && clip.cable) { pasteCable(keep); return; }
    if (clip && clip.image) {
      const loop = cur();
      const src = clip.image;
      const im = Object.assign(JSON.parse(JSON.stringify(src)), { id: uid() });
      const p0 = at || { x: src.x + src.w / 2 + 30, y: src.y + src.h / 2 + 30 };
      im.x = snap(p0.x - im.w / 2); im.y = snap(p0.y - im.h / 2); im.locked = false;
      snapshot();
      loop.images = loop.images || [];
      loop.images.push(im);
      imgGet(im.img).then(() => renderDiagram());
      select({ kind: 'image', id: im.id }); save();
      toast('Image pasted.', true);
      return;
    }
    if (!clip || !clip.nodes.length) { toast('Nothing copied yet. Select items or a cable and press Ctrl+C.'); return; }
    const loop = cur();
    const used = new Set(loop.nodes.map(n => n.tag).concat(loop.links.map(l => l.tag)));
    let x0 = Infinity, y0 = Infinity;
    clip.nodes.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); });
    let dx, dy;
    if (at) {
      // pasting again at the same spot would hide the copy under the previous one: step it
      if (lastPaste && lastPaste.loop === loop.id && Math.abs(lastPaste.ax - at.x) < 8 && Math.abs(lastPaste.ay - at.y) < 8) lastPaste.k++;
      else lastPaste = { loop: loop.id, ax: at.x, ay: at.y, k: 0 };
      dx = snap(at.x + lastPaste.k * 30) - x0; dy = snap(at.y + lastPaste.k * 30) - y0;
    }
    else { dx = 40; dy = 40; }
    const map = {};
    const nodes = clip.nodes.map(src => {
      const n = JSON.parse(JSON.stringify(src));
      map[src.id] = n.id = uid();
      n.tag = freeTag(src.tag, used);
      n.x = src.x + dx; n.y = src.y + dy;
      if (!keep) { resetStatuses(n); delete n.flag; }
      return n;
    });
    nodes.forEach(n => { n.inside = n.inside && map[n.inside] ? map[n.inside] : null; });
    // a pasted item dropped inside an enclosure's dashed zone is mounted in that enclosure
    const zones = loop.nodes.filter(e => isEnclosure(e.type)).map(e => {
      const kids = loop.nodes.filter(k => k.inside === e.id);
      let zx0 = Infinity, zy0 = Infinity, zx1 = -Infinity, zy1 = -Infinity;
      [e].concat(kids).forEach(k => { const f = fullBox(k); zx0 = Math.min(zx0, f.x0); zy0 = Math.min(zy0, f.y0); zx1 = Math.max(zx1, f.x1); zy1 = Math.max(zy1, f.y1); });
      return { id: e.id, x0: zx0 - 18, y0: zy0 - 32, x1: zx1 + 18, y1: zy1 + 18, area: (zx1 - zx0) * (zy1 - zy0) };
    }).sort((a, b2) => a.area - b2.area);
    nodes.forEach(n => {
      if (n.inside || isEnclosure(n.type)) return;
      const cx = n.x + NODE_W / 2, cy = n.y + 30;
      const z = zones.find(z => cx >= z.x0 && cx <= z.x1 && cy >= z.y0 && cy <= z.y1);
      if (z) n.inside = z.id;
    });
    const links = clip.links.filter(l => map[l.a] && map[l.b]).map(src => {
      const l = JSON.parse(JSON.stringify(src));
      l.id = uid(); l.a = map[src.a]; l.b = map[src.b];
      ['a', 'b'].forEach(e => { const cm = l.ends[e].cmap; if (cm) { Object.keys(cm).forEach(k => { if (map[cm[k]]) cm[k] = map[cm[k]]; else delete cm[k]; }); if (!Object.keys(cm).length) delete l.ends[e].cmap; } });
      l.tag = freeTag(src.tag, used);
      if (!keep) { resetStatuses(l); delete l.flag; }
      return l;
    });
    snapshot();
    loop.nodes.push(...nodes);
    loop.links.push(...links);
    if (view !== 'diagram') setView('diagram');
    setSelection(nodes.map(n => n.id));
    renderProgress(); save();
    toast(`Pasted ${nodes.length} item${nodes.length > 1 ? 's' : ''}${links.length ? ` and ${links.length} cable${links.length > 1 ? 's' : ''}` : ''} ${keep ? ' with their order statuses' : ' as new items to order'}.`, true);
  }
  // ---- cables: paste = connect two items with a copy, or give an existing cable the copied settings
  let cablePick = null; // { first: node id | null, keep } while picking items for copied cables
  function cableSettings(src, target, keep) {
    const c = JSON.parse(JSON.stringify(src));
    delete c.id; delete c.a; delete c.b; delete c.tag; delete c.lblOff; delete c.bend;
    if (c.ends) { delete c.ends.a.tmap; delete c.ends.b.tmap; delete c.ends.a.cmap; delete c.ends.b.cmap; } // terminal numbers belong to the original items
    if (!keep) {
      if (target) c.st = JSON.parse(JSON.stringify(target.st || {})); // matching settings keeps the target's own statuses
      else resetStatuses(c);
      (c.custom || []).forEach(x => { x.s = 'todo'; });
    }
    return c;
  }
  function applyCableTo(link, keep) {
    const clip = readClip();
    if (!clip || !clip.cable || !link) return;
    snapshot();
    Object.assign(link, cableSettings(clip.cable, link, keep));
    sel = { kind: 'link', id: link.id };
    renderAll(); save();
    toast(`${link.tag} now has the settings of ${clip.cable.tag}.`, true);
  }
  function connectWithCable(a, b, keep) {
    const clip = readClip(), loop = cur();
    if (!clip || !clip.cable || a === b) return null;
    snapshot();
    const l = makeLink(loop, a, b);
    Object.assign(l, cableSettings(clip.cable, null, keep));
    l.tag = freeTag(clip.cable.tag, new Set(loop.nodes.map(n => n.tag).concat(loop.links.map(x => x.tag))));
    loop.links.push(l);
    renderDiagram(); renderProgress(); renderSummary(); save();
    toast(`Added ${l.tag}: ${nodeById(loop, a).tag} → ${nodeById(loop, b).tag}.`, true);
    return l;
  }
  function pasteCable(keep) {
    const loop = cur();
    const ids = selectedIds();
    const clip = readClip();
    // a different cable selected: give it the copied settings (the copied cable itself: start placing copies)
    if (sel && sel.kind === 'link' && linkById(loop, sel.id) && sel.id !== clip.cable.id) { applyCableTo(linkById(loop, sel.id), keep); return; }
    if (ids.length === 2) { const l = connectWithCable(ids[0], ids[1], keep); if (l) select({ kind: 'link', id: l.id }); return; }
    startCablePick(keep);
  }
  function startCablePick(keep) {
    const clip = readClip();
    if (view !== 'diagram') setView('diagram');
    cablePick = { first: null, keep: !!keep };
    if (sel) select(null);
    updateModeBar(clip);
  }
  function stopCablePick() {
    cablePick = null;
    $('modeBar').hidden = true;
    renderDiagram();
  }
  function updateModeBar(clip) {
    clip = clip || readClip();
    const loop = cur();
    const first = cablePick && cablePick.first && nodeById(loop, cablePick.first);
    $('modeText').textContent = first
      ? `Copy of ${clip.cable.tag}: now click the item to connect ${first.tag} to.`
      : `Copy of ${clip.cable.tag}: click two items to connect them, or click a cable to give it these settings. Repeat as often as you like.`;
    $('modeBar').hidden = false;
  }
  function pickNode(id) {
    if (!cablePick) return;
    if (!cablePick.first) { cablePick.first = id; renderDiagram(); updateModeBar(); return; }
    if (cablePick.first === id) return;
    connectWithCable(cablePick.first, id, cablePick.keep);
    cablePick.first = null;
    renderDiagram(); updateModeBar();
  }

  function pasteAtPointer(keep) {
    const vp = $('viewport'), r = vp.getBoundingClientRect();
    paste(pointerWorld || toWorld(r.left + vp.clientWidth / 3, r.top + vp.clientHeight / 3), keep);
  }
  function cutSelection() {
    if (!copySelection(true)) { toast('Select items to cut first.'); return; }
    const n = selectedIds().length;
    deleteSelected();
    toast(`Cut ${n} item${n > 1 ? 's' : ''}. Ctrl+V pastes at the mouse pointer.`, true);
  }
  function duplicateSelection() {
    const loop = cur();
    const ids = selectedIds();
    if (!ids.length) { toast('Select items to duplicate first.'); return; }
    if (!copySelection(true)) return;
    let x0 = Infinity, y0 = Infinity;
    loop.nodes.filter(n => ids.includes(n.id)).forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); });
    paste({ x: x0 + 40, y: y0 + 40 });
  }

  function nudge(dx, dy) {
    const loop = cur();
    if (sel && sel.kind === 'image') { const im = imageById(loop, sel.id); if (im && !im.locked) { im.x += dx; im.y += dy; renderDiagram(); save(); } return; }
    const ids = new Set(selectedIds());
    loop.nodes.forEach(n => { if (ids.has(n.id)) { n.x = clampX(n.x + dx); n.y = clampY(n.y + dy); } });
    renderDiagram(); save();
  }

  // ---------------------------------------------------------------- pointer interactions
  let drag = null;
  let lastMiddle = 0;
  const touches = new Map(); // active touch pointers on the sheet, for pinch zoom

  function onPalettePointerDown(e) {
    const item = e.target.closest('.pal-item');
    if (!item || e.button > 0) return;
    if (e.pointerType === 'mouse') e.preventDefault();
    drag = { mode: 'palette', type: item.dataset.type, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, pointerType: e.pointerType };
  }
  let imgClick = null;
  const nodeEl0 = e => e.target.closest('.node, .wlabel, .port, [data-open], [data-encl]');
  function onSheetPointerDown(e) {
    if (e.button > 1) return;
    // clicking the sheet leaves any text field, so shortcuts (Ctrl+V, Delete...) act on the drawing
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) ae.blur();
    if (e.button === 1 || spaceDown) { // middle button or Space held: pan
      e.preventDefault();
      if (e.button === 1) {
        const now = Date.now();
        if (now - lastMiddle < 350) { lastMiddle = 0; fit(); return; } // double-click wheel: zoom extents
        lastMiddle = now;
      }
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY, moved: false, keepSel: true };
      return;
    }
    const loop = cur();
    const eye = e.target.closest('[data-eye]');
    if (eye && e.button === 0) { e.preventDefault(); e.stopPropagation(); toggleCableHidden(linkById(loop, eye.dataset.eye)); return; }
    const eg = e.target.closest('[data-endgrip]');
    if (eg && e.button === 0) { // move a connected cable end to another item
      e.preventDefault();
      const [lid, end] = eg.dataset.endgrip.split(':');
      const l = linkById(loop, lid);
      drag = { mode: 'endmove', lid, end, orig: l[end], other: l[end === 'a' ? 'b' : 'a'], sx: e.clientX, sy: e.clientY, moved: false, target: null };
      return;
    }
    const bg = e.target.closest('[data-bendgrip]');
    if (bg && e.button === 0) { // move the middle run of the route
      e.preventDefault();
      const l = linkById(loop, bg.dataset.bendgrip);
      snapshot();
      const ri0 = routeInfo[l.id] || {};
      drag = { mode: 'bend', lid: l.id, orient: ri0.orient || 'x', run0: ri0.run, w0: toWorld(e.clientX, e.clientY), sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }
    if (cablePick && e.button === 0) { // picking items / cables for a copied cable
      const pn = e.target.closest('.node'), pc = e.target.closest('.wlabel') || e.target.closest('.wire-hit');
      if (pc) { e.preventDefault(); applyCableTo(linkById(loop, pc.dataset.link), cablePick.keep); select(null); updateModeBar(); return; }
      if (pn) { e.preventDefault(); pickNode(pn.dataset.id); return; }
    }
    const port = e.target.closest('.port');
    const nodeEl = e.target.closest('.node');
    const label = e.target.closest('.wlabel');
    const hit = e.target.closest('.wire-hit');
    if (port && nodeEl) {
      e.preventDefault();
      drag = { mode: 'link', from: nodeEl.dataset.id, target: null };
      document.body.classList.add('linking');
      return;
    }
    // double-click a terminal of a strip: renumber or delete it (detected here, because the first
    // click redraws the item and the browser then never sends a dblclick)
    if (nodeEl && e.button === 0 && e.target.closest('svg.strip') && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
      const now = performance.now(), last = lastStripDown;
      lastStripDown = { t: now, x: e.clientX, y: e.clientY, id: nodeEl.dataset.id };
      if (last && last.id === nodeEl.dataset.id && now - last.t < 450 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 6) {
        lastStripDown = null;
        const n = nodeById(loop, nodeEl.dataset.id), g = n && stripGeom(n);
        const row = g && g.rowAt(toWorld(e.clientX, e.clientY).y);
        if (row) { e.preventDefault(); openTermPop(n.id, row, e.clientX, e.clientY); return; }
      }
    } else lastStripDown = null;
    const cg = e.target.closest('[data-coregrip]');
    if (cg) { // land one core on another terminal: drag its grip onto a terminal of any strip
      e.preventDefault();
      const [lid, end, core] = cg.dataset.coregrip.split('|');
      drag = { mode: 'core', lid, end, core, sx: e.clientX, sy: e.clientY, x0: parseFloat(cg.style.left), y0: parseFloat(cg.style.top), moved: false, hot: null };
      return;
    }
    const ngrip = e.target.closest('[data-ngrip]');
    if (ngrip && nodeEl) { // resize an item from a corner, opposite corner fixed (like images)
      e.preventDefault();
      const n = nodeById(loop, nodeEl.dataset.id), sz = sizes[n.id] || { w: NODE_W, h: 56 }, g = ngrip.dataset.ngrip;
      snapshot();
      drag = { mode: 'nscale', id: n.id, g, k0: n.scale || 1, w0: sz.w, h0: sz.h,
        ax: g.includes('w') ? n.x + sz.w : n.x, ay: g.includes('n') ? n.y + sz.h : n.y, moved: false };
      return;
    }
    const grip = e.target.closest('[data-grip]');
    const imgEl = e.target.closest('[data-img]');
    if (grip && imgEl) { // scale from a corner, keeping proportions (opposite corner stays put)
      e.preventDefault();
      const im = imageById(loop, imgEl.dataset.img), g = grip.dataset.grip;
      const ax = g.includes('w') ? im.x + im.w : im.x, ay = g.includes('n') ? im.y + im.h : im.y;
      drag = { mode: 'imgscale', id: im.id, g, ax, ay, ratio: im.h / im.w, el: imgEl, moved: false };
      return;
    }
    if (imgEl && !nodeEl0(e)) {
      const im = imageById(loop, imgEl.dataset.img);
      const selected = sel && sel.kind === 'image' && sel.id === im.id;
      if (selected && !im.locked && !(e.shiftKey || e.ctrlKey || e.metaKey)) { // like CAD: select first, then drag to move
        e.preventDefault();
        const w = toWorld(e.clientX, e.clientY);
        drag = { mode: 'imgmove', id: im.id, el: imgEl, dx: w.x - im.x, dy: w.y - im.y, sx: e.clientX, sy: e.clientY, moved: false };
        return;
      }
      imgClick = im.id; // a plain click selects it; a drag still draws a selection box
    } else imgClick = null;
    const oe = e.target.closest('[data-open]');
    if (oe) { // open cable end: drag it onto an item to connect, or anywhere to move it
      e.preventDefault();
      const [lid, end] = oe.dataset.open.split(':');
      drag = { mode: 'openend', lid, end, el: oe, sx: e.clientX, sy: e.clientY, moved: false, target: null };
      return;
    }
    const encl = e.target.closest('[data-encl]');
    if (encl && !nodeEl) { // dashed outline / label: move the enclosure with everything inside
      e.preventDefault();
      const enc = nodeById(loop, encl.dataset.encl);
      const w = toWorld(e.clientX, e.clientY);
      const movers = loop.nodes.filter(k => k.id === enc.id || k.inside === enc.id).map(k => ({ k, x: k.x, y: k.y, el: document.querySelector(`.node[data-id="${k.id}"]`) }));
      drag = { mode: 'node', id: enc.id, dx: w.x - enc.x, dy: w.y - enc.y, x0: enc.x, y0: enc.y, movers, sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }
    const nlab = e.target.closest('.nlabel');
    if (nlab && nodeEl && !(e.shiftKey || e.ctrlKey || e.metaKey)) { // the text block moves on its own
      e.preventDefault();
      const n = nodeById(loop, nodeEl.dataset.id);
      drag = { mode: 'nlabel', id: n.id, el: nlab, sx: e.clientX, sy: e.clientY, off0: Object.assign({ dx: 0, dy: 0 }, n.lblOff), moved: false };
      return;
    }
    if (nodeEl) {
      e.preventDefault();
      const n = nodeById(loop, nodeEl.dataset.id);
      if (e.shiftKey || e.ctrlKey || e.metaKey) { drag = { mode: 'toggle', id: n.id }; return; }
      const w = toWorld(e.clientX, e.clientY);
      const cur0 = selectedIds();
      const ids = new Set(cur0.includes(n.id) ? cur0 : [n.id]);
      const movers = loop.nodes.filter(k => ids.has(k.id)).map(k => ({ k, x: k.x, y: k.y, el: document.querySelector(`.node[data-id="${k.id}"]`) }));
      drag = { mode: 'node', id: n.id, dx: w.x - n.x, dy: w.y - n.y, x0: n.x, y0: n.y, movers, sx: e.clientX, sy: e.clientY, moved: false };
      return;
    }
    if (label && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const l = linkById(loop, label.dataset.link);
      drag = { mode: 'label', id: l.id, sx: e.clientX, sy: e.clientY, off0: Object.assign({ dx: 0, dy: 0 }, l.lblOff), moved: false };
      return;
    }
    if (label || hit) {
      const id = (label || hit).dataset.link;
      select({ kind: 'link', id });
      return;
    }
    const vp = $('viewport'), vr = vp.getBoundingClientRect();
    if (e.clientX - vr.left > vp.clientWidth || e.clientY - vr.top > vp.clientHeight) return; // on a scrollbar
    if (e.pointerType === 'mouse') { // drag on empty sheet: box selection
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      drag = { mode: 'box', wx: w.x, wy: w.y, sx: e.clientX, sy: e.clientY, moved: false, add: e.shiftKey || e.ctrlKey || e.metaKey, base: selectedIds(), hits: [], imgClick };
      return;
    }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { // two fingers: pinch zoom
        const [a, b] = [...touches.values()];
        drag = { mode: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: zoom, w: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
        return;
      }
    }
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY, moved: false, imgClick };
  }
  function onPointerMove(e) {
    if (e.pointerType === 'mouse') {
      const r = $('viewport').getBoundingClientRect();
      pointerWorld = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? toWorld(e.clientX, e.clientY) : null;
      if (pointerWorld && !(drag && drag.mode === 'nscale')) $('sbCoords').textContent = `X ${Math.round(pointerWorld.x)}   Y ${Math.round(pointerWorld.y)}`;
    }
    if (touches.has(e.pointerId) && (!drag || drag.mode !== 'pinch')) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    const loop = cur();
    if (drag.mode === 'palette') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        const g = document.createElement('div');
        g.className = 'node dragging';
        g.style.cssText = 'position:fixed;z-index:30;pointer-events:none;';
        g.innerHTML = `<div class="nsym">${symSVG(drag.type, T(drag.type).tag)}</div><div class="nlabel"><div class="node-title"><b>${esc(T(drag.type).name)}</b></div></div>`;
        document.body.appendChild(g);
        drag.ghost = g;
      }
      if (drag.ghost) { drag.ghost.style.left = (e.clientX - NODE_W / 2) + 'px'; drag.ghost.style.top = (e.clientY - 25) + 'px'; }
    } else if (drag.mode === 'node') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      let nx = w.x - drag.dx, ny = w.y - drag.dy, lockX = false, lockY = false;
      if (draft.ortho) { // keep the larger movement, lock the other axis at the start position
        if (Math.abs(nx - drag.x0) >= Math.abs(ny - drag.y0)) { ny = drag.y0; lockY = true; } else { nx = drag.x0; lockX = true; }
      }
      if (!lockX) nx = snap(nx);
      if (!lockY) ny = snap(ny);
      if (draft.osnap) {
        const r = osnapAlign(loop, nodeById(loop, drag.id), nx, ny, new Set(drag.movers.map(c => c.k.id)), lockX, lockY);
        nx = Math.round(r.nx); ny = Math.round(r.ny);
        showGuides(r.guides);
      }
      const ddx = nx - drag.x0, ddy = ny - drag.y0;
      drag.movers.forEach(c => {
        c.k.x = clampX(c.x + ddx); c.k.y = clampY(c.y + ddy);
        if (c.el) { c.el.style.left = c.k.x + 'px'; c.el.style.top = c.k.y + 'px'; c.el.classList.add('dragging'); }
      });
      drawWires();
    } else if (drag.mode === 'nscale') {
      drag.moved = true;
      const n = nodeById(loop, drag.id), w = toWorld(e.clientX, e.clientY);
      const ratio = Math.max(Math.abs(w.x - drag.ax) / drag.w0, Math.abs(w.y - drag.ay) / drag.h0);
      let k = Math.min(3, Math.max(0.5, drag.k0 * ratio));
      if (draft.snap) k = Math.round(k * 20) / 20; // 5 % steps
      const nw = drag.w0 * k / drag.k0, nh = drag.h0 * k / drag.k0;
      n.x = Math.round(drag.g.includes('w') ? drag.ax - nw : drag.ax);
      n.y = Math.round(drag.g.includes('n') ? drag.ay - nh : drag.ay);
      if (k === 1) delete n.scale; else n.scale = k;
      renderDiagram();
      const tip = $('sbCoords'); if (tip) tip.textContent = `SIZE ${Math.round(k * 100)} %`;
    } else if (drag.mode === 'label') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      if (!drag.moved) { drag.moved = true; document.body.classList.add('moving-label'); }
      const l = linkById(loop, drag.id);
      let mdx = (e.clientX - drag.sx) / zoom, mdy = (e.clientY - drag.sy) / zoom;
      if (draft.ortho) { if (Math.abs(mdx) >= Math.abs(mdy)) mdy = 0; else mdx = 0; }
      l.lblOff = { dx: snap(drag.off0.dx + mdx), dy: snap(drag.off0.dy + mdy) };
      drawWires();
    } else if (drag.mode === 'nlabel') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      if (!drag.moved) { drag.moved = true; document.body.classList.add('moving-label'); }
      const n = nodeById(loop, drag.id);
      let mdx = (e.clientX - drag.sx) / zoom, mdy = (e.clientY - drag.sy) / zoom;
      if (draft.ortho) { if (Math.abs(mdx) >= Math.abs(mdy)) mdy = 0; else mdx = 0; }
      n.lblOff = { dx: snap(drag.off0.dx + mdx), dy: snap(drag.off0.dy + mdy) };
      drag.el.style.transform = nlabelStyle(n).replace('transform:', '');
      drawWires();
    } else if (drag.mode === 'imgmove') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      drag.moved = true;
      const im = imageById(loop, drag.id), w = toWorld(e.clientX, e.clientY);
      if (drag.ix0 == null) { drag.ix0 = im.x; drag.iy0 = im.y; }
      let ix = w.x - drag.dx, iy = w.y - drag.dy;
      if (draft.ortho) { if (Math.abs(ix - drag.ix0) >= Math.abs(iy - drag.iy0)) iy = drag.iy0; else ix = drag.ix0; }
      im.x = snap(ix); im.y = snap(iy);
      drag.el.style.left = im.x + 'px'; drag.el.style.top = im.y + 'px';
    } else if (drag.mode === 'imgscale') {
      drag.moved = true;
      const im = imageById(loop, drag.id), w = toWorld(e.clientX, e.clientY);
      let nw = Math.max(20, Math.abs(w.x - drag.ax));
      let nh = nw * drag.ratio;
      if (Math.abs(w.y - drag.ay) / drag.ratio > nw) { nh = Math.max(20 * drag.ratio, Math.abs(w.y - drag.ay)); nw = nh / drag.ratio; }
      im.w = Math.round(nw); im.h = Math.round(nh);
      im.x = Math.round(drag.g.includes('w') ? drag.ax - im.w : drag.ax);
      im.y = Math.round(drag.g.includes('n') ? drag.ay - im.h : drag.ay);
      Object.assign(drag.el.style, { left: im.x + 'px', top: im.y + 'px', width: im.w + 'px', height: im.h + 'px' });
    } else if (drag.mode === 'endmove') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      const l = linkById(loop, drag.lid);
      const w = toWorld(e.clientX, e.clientY);
      if (!drag.moved) { drag.moved = true; snapshot(); }
      // while dragging, the end follows the pointer (shown as a free end)
      l[drag.end] = null; l['f' + drag.end] = { x: Math.round(w.x), y: Math.round(w.y) };
      document.querySelectorAll('.cgrip, .open-end').forEach(x => { x.style.pointerEvents = 'none'; });
      const tn = osnapTarget(loop, e, w, drag.other);
      const tid = tn ? tn.id : null;
      document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
      const te = tid && document.querySelector(`#nodes .node[data-id="${tid}"]`);
      if (te) te.classList.add('target');
      drag.target = tid;
      drawWires();
      document.querySelectorAll('.cgrip, .open-end').forEach(x => { x.style.pointerEvents = 'none'; });
      if (tn) { const c2 = center(tn); showGuides([{ kind: 'm', x: c2.x, y: c2.y, text: tid === drag.orig ? `Back to ${tn.tag}` : `Move end to ${tn.tag}` }]); } else showGuides([]);
    } else if (drag.mode === 'bend') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      drag.moved = true;
      const l = linkById(loop, drag.lid), w = toWorld(e.clientX, e.clientY);
      // move the run by the pointer's movement ('y' and 'jog' both set a level)
      l.bend = drag.orient === 'x' ? { x: snap(drag.run0 + (w.x - drag.w0.x)) } : { y: snap(drag.run0 + (w.y - drag.w0.y)) };
      drawWires();
    } else if (drag.mode === 'openend') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 3) return;
      drag.moved = true;
      const l = linkById(loop, drag.lid);
      const w = toWorld(e.clientX, e.clientY);
      l['f' + drag.end] = { x: Math.round(w.x), y: Math.round(w.y) };
      drag.el.style.pointerEvents = 'none';
      const oe0 = l[drag.end === 'a' ? 'b' : 'a'];
      const tn = osnapTarget(loop, e, w, oe0);
      const tid = tn ? tn.id : null;
      document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
      const te = tid && document.querySelector(`#nodes .node[data-id="${tid}"]`);
      if (te) te.classList.add('target');
      drag.target = tid;
      if (tn) { const c2 = center(tn); showGuides([{ kind: 'm', x: c2.x, y: c2.y, text: `Connect to ${tn.tag}` }]); } else clearGuides();
      drawWires();
      const h = document.querySelector(`[data-open="${drag.lid}:${drag.end}"]`); if (h) { h.style.pointerEvents = 'none'; drag.el = h; }
    } else if (drag.mode === 'box') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      const x0 = Math.min(drag.wx, w.x), y0 = Math.min(drag.wy, w.y), x1 = Math.max(drag.wx, w.x), y1 = Math.max(drag.wy, w.y);
      let box = $('selBox');
      if (!box) { box = document.createElement('div'); box.id = 'selBox'; box.className = 'selbox'; $('world').appendChild(box); }
      Object.assign(box.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
      // Like CAD: left-to-right is a window (only items fully inside), right-to-left is crossing (anything touched).
      const crossing = w.x < drag.wx;
      box.classList.toggle('crossing', crossing);
      // window: the symbol must be fully inside; crossing: touching the symbol or its tag text is enough
      drag.hits = loop.nodes.filter(n => {
        const f = fullBox(n), c = center(n);
        return crossing
          ? f.x0 < x1 && f.x1 > x0 && f.y0 < y1 && f.y1 > y0
          : n.x >= x0 && n.x + c.w <= x1 && n.y >= y0 && n.y + c.h <= y1;
      }).map(n => n.id);
      const on = new Set(drag.add ? drag.base.concat(drag.hits) : drag.hits);
      document.querySelectorAll('.node').forEach(el => el.classList.toggle('sel', on.has(el.dataset.id)));
    } else if (drag.mode === 'core') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      const tw = $('tempWire');
      tw.style.display = '';
      tw.setAttribute('d', `M${drag.x0},${drag.y0} H${((drag.x0 + w.x) / 2).toFixed(1)} V${w.y.toFixed(1)} H${w.x.toFixed(1)}`);
      const hit = terminalAt(loop, w);
      drag.hot = hit;
      let hot = $('termHot');
      if (hit && hit.g && hit.row) {
        if (!hot) { hot = document.createElement('div'); hot.id = 'termHot'; hot.className = 'term-hot'; $('nodes').appendChild(hot); }
        const y = hit.g.rowY(hit.row) - hit.g.rowH / 2;
        Object.assign(hot.style, { left: hit.g.left + 'px', top: y + 'px', width: (hit.g.right - hit.g.left) + 'px', height: hit.g.rowH + 'px' });
        hot.dataset.label = termName(hit.n, hit.row);
      } else if (hot) hot.remove();
      if (hit && !hit.row) showGuides([{ kind: 'm', x: center(hit.n).x, y: center(hit.n).y, text: `Next free terminal of ${hit.n.tag}` }]); else clearGuides();
    } else if (drag.mode === 'link') {
      const from = nodeById(loop, drag.from);
      const c = center(from);
      const w = toWorld(e.clientX, e.clientY);
      const p = { x: w.x >= c.x ? from.x + c.w : from.x, y: c.y };
      const mx = (p.x + w.x) / 2;
      const tw = $('tempWire');
      tw.style.display = '';
      tw.setAttribute('d', `M${p.x},${p.y} H${mx} V${w.y} H${w.x}`);
      const tn = osnapTarget(loop, e, w, drag.from);
      const tid = tn ? tn.id : null;
      if (tid !== drag.target) {
        document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
        const te = tid && document.querySelector(`#nodes .node[data-id="${tid}"]`);
        if (te) te.classList.add('target');
        drag.target = tid;
      }
      if (tn) { const c2 = center(tn); showGuides([{ kind: 'm', x: c2.x, y: c2.y, text: `Connect to ${tn.tag}` }]); } else clearGuides();
    } else if (drag.mode === 'pan') {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      panX = drag.px + dx; panY = drag.py + dy; updateView();
    } else if (drag.mode === 'pinch') {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size < 2) return;
      const [a, b] = [...touches.values()];
      const r = $('viewport').getBoundingClientRect();
      zoom = Math.min(ZMAX, Math.max(ZMIN, drag.z0 * Math.hypot(a.x - b.x, a.y - b.y) / (drag.d0 || 1)));
      panX = (a.x + b.x) / 2 - r.left - drag.w.x * zoom;
      panY = (a.y + b.y) / 2 - r.top - drag.w.y * zoom;
      updateView();
    }
  }
  function onPointerUp(e) {
    touches.delete(e.pointerId);
    if (!drag) return;
    if (drag.mode === 'pinch') { if (touches.size === 0) drag = null; return; }
    const loop = cur();
    const d = drag; drag = null;
    if (d.mode === 'palette') {
      if (d.ghost) d.ghost.remove();
      if (d.moved) {
        const vp = $('viewport').getBoundingClientRect();
        if (e.clientX >= vp.left && e.clientX <= vp.right && e.clientY >= vp.top && e.clientY <= vp.bottom) {
          const w = toWorld(e.clientX, e.clientY);
          addNode(d.type, w.x, w.y);
        }
      } else {
        // tap / click: put it in the first free spot near the middle of the visible sheet
        const vp = $('viewport'), r = vp.getBoundingClientRect();
        const w = toWorld(r.left + vp.clientWidth / 2, r.top + vp.clientHeight / 2);
        const spot = freeSpot(loop, w.x, w.y);
        addNode(d.type, spot.x, spot.y);
      }
    } else if (d.mode === 'node') {
      clearGuides();
      if (d.moved) { save(); renderDiagram(); }
      else setSelection([d.id]);
    } else if (d.mode === 'nscale') {
      if (d.moved) { save(); renderInspector(); }
    } else if (d.mode === 'core') {
      const tw = $('tempWire'); if (tw) tw.style.display = 'none';
      const hot = $('termHot'); if (hot) hot.remove();
      clearGuides();
      const l = linkById(loop, d.lid);
      if (d.moved && l && d.hot) landCore(l, d.end, d.core, d.hot.n, d.hot.row);
      else if (d.moved) toast('Drop the core on a terminal of a strip.');
    } else if (d.mode === 'nlabel') {
      document.body.classList.remove('moving-label');
      const n = nodeById(loop, d.id);
      if (d.moved && n) {
        if (n.lblOff && Math.hypot(n.lblOff.dx, n.lblOff.dy) < 6) delete n.lblOff; // dropped back under the symbol
        save();
        if (sel && sel.kind === 'node' && sel.id === n.id) { renderDiagram(); renderInspector(); } else setSelection([n.id]);
      } else setSelection([d.id]);
    } else if (d.mode === 'label') {
      document.body.classList.remove('moving-label');
      const l = linkById(loop, d.id);
      if (d.moved && l) {
        if (Math.hypot(l.lblOff.dx, l.lblOff.dy) < 6) delete l.lblOff; // dropped back on the cable: snap home
        save();
        if (!(sel && sel.kind === 'link' && sel.id === l.id)) select({ kind: 'link', id: l.id }); else drawWires();
      } else select({ kind: 'link', id: d.id });
    } else if (d.mode === 'imgmove' || d.mode === 'imgscale') {
      if (d.moved) { save(); renderInspector(); }
    } else if (d.mode === 'endmove') {
      clearGuides();
      document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
      const l = linkById(loop, d.lid);
      if (!d.moved || !l) { if (l) select({ kind: 'link', id: l.id }); }
      else if (d.target && d.target !== d.orig) { // re-connect to the new item
        l[d.end] = d.target; delete l['f' + d.end];
        delete l.ends[d.end].tmap; delete l.ends[d.end].cmap; // terminal numbers belonged to the old item
        delete l.bend;             // the old route no longer fits
        sel = { kind: 'link', id: l.id };
        renderAll(); save();
        toast(`${l.tag} now goes from ${nodeById(loop, l.a).tag} to ${nodeById(loop, l.b).tag}.`, true);
      } else { // dropped on nothing (or back on the same item): keep the original connection
        l[d.end] = d.orig; delete l['f' + d.end];
        renderDiagram();
        if (!d.target) toast('Drop the end on an item to move it. The cable was left as it was.');
      }
    } else if (d.mode === 'bend') {
      if (d.moved) { save(); renderInspector(); }
    } else if (d.mode === 'openend') {
      clearGuides();
      document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
      const l = linkById(loop, d.lid);
      if (d.target && l) {
        l[d.end] = d.target; delete l['f' + d.end]; delete l.ends[d.end].tmap; delete l.ends[d.end].cmap;
        sel = { kind: 'link', id: l.id };
        renderAll(); save();
        toast(`${l.tag} connected to ${nodeById(loop, d.target).tag}.`);
      } else {
        if (!d.moved && l) select({ kind: 'link', id: l.id }); else renderDiagram();
        save();
      }
    } else if (d.mode === 'toggle') {
      const ids = selectedIds();
      setSelection(ids.includes(d.id) ? ids.filter(x => x !== d.id) : ids.concat(d.id));
    } else if (d.mode === 'box') {
      const box = $('selBox'); if (box) box.remove();
      if (d.moved) setSelection(d.add ? d.base.concat(d.hits) : d.hits);
      else if (d.imgClick) select({ kind: 'image', id: d.imgClick });
      else if (sel) select(null);
    } else if (d.mode === 'link') {
      clearGuides();
      document.body.classList.remove('linking');
      document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
      if (d.target) {
        const l = makeLink(loop, d.from, d.target);
        loop.links.push(l);
        sel = { kind: 'link', id: l.id };
        renderAll(); save();
        toast(`Added cable ${l.tag}. Set its type and length on the right.`);
      } else {
        const tw = $('tempWire'); if (tw) tw.style.display = 'none';
      }
    } else if (d.mode === 'pan') {
      if (!d.moved && d.imgClick) select({ kind: 'image', id: d.imgClick });
      else if (!d.moved && sel && !d.keepSel) select(null);
    }
  }
  function onPointerCancel(e) {
    clearGuides();
    if (drag && drag.mode === 'core') { const tw = $('tempWire'); if (tw) tw.style.display = 'none'; const hot = $('termHot'); if (hot) hot.remove(); }
    if (drag && drag.mode === 'endmove' && drag.moved) { // restore the end that was being moved
      const l = linkById(cur(), drag.lid);
      if (l) { l[drag.end] = drag.orig; delete l['f' + drag.end]; renderDiagram(); }
    }
    document.body.classList.remove('moving-label');
    if (e) touches.delete(e.pointerId);
    if (drag && drag.ghost) drag.ghost.remove();
    const box = $('selBox'); if (box) box.remove();
    if (drag && drag.mode === 'link') {
      document.body.classList.remove('linking');
      const tw = $('tempWire'); if (tw) tw.style.display = 'none';
    }
    drag = null;
  }

  // ---------------------------------------------------------------- inspector events
  function setPath(obj, path, val) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
    o[parts[parts.length - 1]] = val;
  }
  function onInspectorInput(e) {
    const t = e.target;
    if (t.dataset.tf && typeDraft) { onTypeInput(e); return; }
    if (t.dataset.scale) {
      if (e.type !== 'change' || t.value === '') return;
      const n = sel && sel.kind === 'node' && nodeById(cur(), sel.id);
      if (n) setItemScale(n, Number(t.value) / 100);
      return;
    }
    if (t.dataset.cmap) {
      if (e.type !== 'change') return;
      const l = sel && sel.kind === 'link' && linkById(cur(), sel.id);
      if (!l) return;
      const [end, core] = t.dataset.cmap.split('|');
      snapshot();
      const cm = l.ends[end].cmap = l.ends[end].cmap || {};
      if (t.value === l[end]) delete cm[core]; else cm[core] = t.value;
      if (!Object.keys(cm).length) delete l.ends[end].cmap;
      if (l.ends[end].tmap) { delete l.ends[end].tmap[core]; if (!Object.keys(l.ends[end].tmap).length) delete l.ends[end].tmap; } // the number belonged to the old strip
      renderDiagram(); renderInspector(); save();
      return;
    }
    if (t.dataset.tmap) {
      if (e.type !== 'change') return;
      const l = sel && sel.kind === 'link' && linkById(cur(), sel.id);
      if (!l) return;
      const [end, core] = t.dataset.tmap.split('|');
      const tm = l.ends[end].tmap = l.ends[end].tmap || {};
      const v = t.value.trim();
      if (v) tm[core] = v; else delete tm[core];
      if (!Object.keys(tm).length) delete l.ends[end].tmap;
      renderDiagram(); renderInspector(); renderChecklist(); save();
      return;
    }
    if (t.dataset.imgf) {
      const im = sel && sel.kind === 'image' && imageById(cur(), sel.id);
      if (!im) return;
      const f = t.dataset.imgf;
      if (f === 'name') im.name = t.value;
      else if (f === 'fade') { im.fade = Number(t.value); $('i-fade-v').textContent = im.fade + '%'; }
      else if (f === 'frame' || f === 'locked') { im[f] = t.checked; if (e.type === 'change') { renderDiagram(); renderInspector(); save(); } return; }
      else if ((f === 'w' || f === 'h') && t.value !== '') {
        const v = Math.max(10, Number(t.value)), ratio = im.h / im.w;
        if (f === 'w') { im.w = Math.round(v); im.h = Math.round(v * ratio); $('i-h').value = im.h; }
        else { im.h = Math.round(v); im.w = Math.round(v / ratio); $('i-w').value = im.w; }
      }
      renderDiagram(); save();
      return;
    }
    if (t.dataset.connect) {
      if (e.type === 'change' && t.value) {
        const l = linkById(cur(), sel.id);
        snapshot();
        l[t.dataset.connect] = t.value; delete l['f' + t.dataset.connect]; delete l.ends[t.dataset.connect].tmap; delete l.ends[t.dataset.connect].cmap; delete l.bend;
        renderAll(); save();
        toast(`${l.tag} now goes from ${nodeById(cur(), l.a) ? nodeById(cur(), l.a).tag : 'open end'} to ${nodeById(cur(), l.b) ? nodeById(cur(), l.b).tag : 'open end'}.`, true);
      }
      return;
    }
    if (t.id === 'flagNote') {
      const loop = cur();
      const ent = sel && sel.kind === 'link' ? linkById(loop, sel.id) : sel && sel.kind === 'node' ? nodeById(loop, sel.id) : null;
      if (ent && ent.flag) { ent.flag.note = t.value; renderDiagram(); save(); }
      return;
    }
    if (t.id === 'flagFade') { if (e.type === 'change') { flagFocus = t.checked; updateFlagButton(); } return; }
    if (t.id === 'keepStatus') { if (e.type === 'change') { setKeepPref(t.checked); toast(t.checked ? 'Copies will keep their order statuses.' : 'Copies will start as To order.'); } return; }
    if (e.type === 'input') histGroup = 'insp:' + (t.id || t.dataset.bind || t.name || '') + ':' + (sel ? sel.kind + (sel.id || '') : '');
    const bind = t.dataset.bind;
    const se = selectedEntity();
    if (bind && se && se.kind !== 'general') {
      let v = t.type === 'checkbox' ? t.checked : t.value;
      if (t.dataset.num) v = t.value === '' ? null : Number(t.value);
      if (bind === 'cable') {
        const c = CABLES[v];
        se.ent.n = c.defN || null;
        se.ent.shielded = null;
        if (!c.field) { se.ent.armoured = false; se.ent.route = 'duct'; }
        else if (se.ent.route === 'duct') se.ent.route = 'tray';
      }
      if (bind === 'inside') v = v || null;
      setPath(se.ent, bind, v);
      if (e.type === 'change' && t.dataset.rerender) { renderInspector(); refreshLight(); return; }
      if (bind === 'tag') { const h = document.querySelector('.inspector h2'); if (h) h.textContent = v; }
      refreshLight();
      return;
    }
    if (t.dataset.q != null && e.type === 'change') {
      const it = currentChecklist[Number(t.dataset.q)];
      if (it) { setItem(it, { q: t.value === '' ? null : Number(t.value) }); refreshLight(); }
    }
  }
  function cycle(s) { return STATUS[(STATUS.indexOf(s) + 1) % STATUS.length]; }
  function onInspectorClick(e) {
    const t = e.target;
    const loop = cur();
    const fl = t.closest('[data-flag]');
    if (fl) {
      let ents = [];
      if (sel && sel.kind === 'link') ents = [linkById(loop, sel.id)];
      else ents = selectedIds().map(id => nodeById(loop, id));
      setFlag(ents.filter(Boolean), fl.dataset.flag);
      if (fl.dataset.flag !== 'none') { const ni = $('flagNote'); if (ni && !ni.value) ni.focus(); }
      return;
    }
    const fg = t.closest('[data-flag-go]');
    if (fg) {
      const [kind, id] = fg.dataset.flagGo.split(':');
      const ent = kind === 'node' ? nodeById(loop, id) : linkById(loop, id);
      if (ent) { select(kind === 'node' ? { kind: 'node', id } : { kind: 'link', id }); focusOn(kind, ent); }
      return;
    }
    if (t.closest('[data-tmreset]')) {
      const l = sel && sel.kind === 'link' && linkById(loop, sel.id);
      if (l) { snapshot(); delete l.ends.a.tmap; delete l.ends.b.tmap; delete l.ends.a.cmap; delete l.ends.b.cmap; renderDiagram(); renderInspector(); save(); }
      return;
    }
    if (t.closest('[data-scalereset]')) {
      const n = sel && sel.kind === 'node' && nodeById(loop, sel.id);
      if (n) setItemScale(n, 1);
      return;
    }
    if (t.closest('[data-bendreset]')) {
      const l = sel && sel.kind === 'link' && linkById(loop, sel.id);
      if (l) { snapshot(); delete l.bend; renderDiagram(); renderInspector(); save(); }
      return;
    }
    if (t.closest('[data-sparerm]')) { removeSpareTerminals(t.closest('[data-sparerm]').dataset.sparerm); return; }
    if (t.closest('[data-nlblreset]')) {
      const n = sel && sel.kind === 'node' && nodeById(loop, sel.id);
      if (n) { delete n.lblOff; renderDiagram(); renderInspector(); save(); }
      return;
    }
    if (t.closest('[data-lblreset]')) {
      const l = sel && sel.kind === 'link' && linkById(loop, sel.id);
      if (l) { delete l.lblOff; renderDiagram(); renderInspector(); save(); }
      return;
    }
    const ia = t.closest('[data-imgact]');
    if (ia) {
      const im = sel && sel.kind === 'image' && imageById(loop, sel.id);
      if (!im) return;
      snapshot();
      if (ia.dataset.imgact === 'back') im.front = false;
      else if (ia.dataset.imgact === 'front') im.front = true;
      else if (ia.dataset.imgact === 'reset') { const cx = im.x + im.w / 2, cy = im.y + im.h / 2; im.w = im.nw; im.h = im.nh; im.x = Math.round(cx - im.w / 2); im.y = Math.round(cy - im.h / 2); }
      renderDiagram(); renderInspector(); save();
      return;
    }
    const ta = t.closest('[data-tact]');
    if (ta) { onTypeAction(ta.dataset.tact, ta); return; }
    const et = t.closest('[data-edit-type]');
    if (et) { openTypeEditor(et.dataset.editType); return; }
    const st = t.closest('.status[data-i]');
    if (st) { const it = currentChecklist[Number(st.dataset.i)]; setItem(it, { s: cycle(it.status) }); refreshLight(); return; }
    const rm = t.closest('[data-rm]');
    if (rm) {
      const it = currentChecklist[Number(rm.dataset.rm)];
      it.entity.custom = it.entity.custom.filter(c => c.id !== it.key);
      refreshLight(); return;
    }
    const all = t.closest('[data-all]');
    if (all) { currentChecklist.forEach(it => { if (it.status === 'todo' || (all.dataset.all === 'have' && it.status === 'ordered')) setItem(it, { s: all.dataset.all }); }); refreshLight(); return; }
    if (t.id === 'addBtn') { addCustom(); return; }
    const go = t.closest('[data-goto]');
    if (go) { select({ kind: 'link', id: go.dataset.goto }); return; }
    const gn = t.closest('[data-goto-node]');
    if (gn) { select({ kind: 'node', id: gn.dataset.gotoNode }); return; }
    const mall = t.closest('[data-mall]');
    if (mall) {
      [...selNodes].forEach(id => { const n = nodeById(loop, id); if (n) nodeItems(loop, n).forEach(it => { if (it.status === 'todo' || (mall.dataset.mall === 'have' && it.status === 'ordered')) setItem(it, { s: mall.dataset.mall }); }); });
      renderInspector(); refreshLight(); return;
    }
    const cb = t.closest('[data-clip]');
    if (cb) {
      if (cb.dataset.clip === 'copy') copySelection();
      else if (cb.dataset.clip === 'dup') duplicateSelection();
      else if (cb.dataset.clip === 'match') applyCableTo(linkById(loop, sel.id), keepPref());
      else if ((readClip() || {}).cable) startCablePick(keepPref());
      else { const vp = $('viewport'), r = vp.getBoundingClientRect(); paste(toWorld(r.left + vp.clientWidth / 3, r.top + vp.clientHeight / 3)); }
      return;
    }
    const del = t.closest('[data-del]');
    if (del) { deleteSelected(); return; }
    void loop;
  }
  function addCustom() {
    const name = $('addName').value.trim();
    if (!name) { $('addName').focus(); return; }
    const se = selectedEntity();
    se.ent.custom = se.ent.custom || [];
    se.ent.custom.push({ id: 'c' + uid(), name, cat: $('addCat').value, q: null, unit: '', s: 'todo' });
    $('addName').value = '';
    refreshLight();
    $('addName').focus();
  }
  // Cables of deleted items stay, with an open end where the item was.
  function detachCables(loop, ids) {
    let kept = 0;
    const slots = {}; // several cables leaving the same side of a deleted item: stack their open ends
    loop.links.forEach(l => {
      ['a', 'b'].forEach(end => {
        if (!ids.has(l[end])) return;
        const n = nodeById(loop, l[end]);
        const c = center(n);
        const other = nodeById(loop, l[end === 'a' ? 'b' : 'a']);
        // leave the open end on the side of the deleted item facing the other end
        const oc = other ? center(other) : c;
        const right = oc.x >= c.x;
        const k = n.id + (right ? 'r' : 'l');
        const i = slots[k] = (slots[k] || 0) + 1;
        l['f' + end] = { x: Math.round(right ? n.x + c.w : n.x), y: Math.round(c.y + (i - 1) * 22) };
        l[end] = null;
        delete l.ends[end].tmap; delete l.ends[end].cmap;
        kept++;
      });
    });
    return loop.links.filter(l => !l.a || !l.b).length && kept;
  }
  function deleteSelected() {
    const loop = cur();
    if (sel && sel.kind === 'image') {
      snapshot();
      loop.images = (loop.images || []).filter(i => i.id !== sel.id);
      sel = null; renderAll(); save();
      toast('Image deleted.', true);
      return;
    }
    if (!sel || !['node', 'link', 'multi'].includes(sel.kind)) return;
    snapshot();
    if (sel.kind === 'multi') {
      const ids = new Set(selNodes);
      const touched = loop.links.filter(l => ids.has(l.a) || ids.has(l.b)).length;
      detachCables(loop, ids);
      loop.nodes = loop.nodes.filter(x => !ids.has(x.id));
      loop.nodes.forEach(x => { if (ids.has(x.inside)) x.inside = null; });
      toast(`Deleted ${ids.size} items.${touched ? ` ${touched} cable${touched > 1 ? 's were' : ' was'} kept with an open end: drag it onto an item to reconnect.` : ''}`, true);
    } else if (sel.kind === 'node') {
      const n = nodeById(loop, sel.id);
      const nl = loop.links.filter(l => l.a === n.id || l.b === n.id).length;
      detachCables(loop, new Set([n.id]));
      loop.nodes = loop.nodes.filter(x => x.id !== n.id);
      loop.nodes.forEach(x => { if (x.inside === n.id) x.inside = null; });
      toast(`Deleted ${n.tag}.${nl ? ` Its ${nl} cable${nl > 1 ? 's were' : ' was'} kept with an open end: drag it onto an item to reconnect.` : ''}`, true);
    } else {
      const l = linkById(loop, sel.id);
      loop.links = loop.links.filter(x => x.id !== l.id);
      toast(`Deleted cable ${l.tag}.`, true);
    }
    sel = null; selNodes = new Set();
    renderAll(); save();
  }

  // ---------------------------------------------------------------- status bar and object snap
  function updateStatusBar() {
    ['snap', 'ortho', 'osnap'].forEach(k => { const b = $('tg-' + k); b.classList.toggle('on', !!draft[k]); b.setAttribute('aria-pressed', !!draft[k]); });
    $('snapStep').value = String(draft.step);
    const nh = cur().links.filter(l => l.infoHidden).length;
    const hb = $('tg-hidden');
    hb.hidden = nh === 0;
    hb.textContent = showHiddenAll ? `INFO SHOWN (${nh})` : `${nh} INFO HIDDEN`;
    hb.classList.toggle('on', showHiddenAll);
    hb.setAttribute('aria-pressed', showHiddenAll);
  }
  function toggleDraft(k) {
    draft[k] = !draft[k]; saveDraft(); updateStatusBar();
    toast(`${k.toUpperCase()} ${draft[k] ? 'on' : 'off'}`);
  }
  // guide lines and snap markers, drawn in world coordinates above the drawing
  function showGuides(list) {
    let layer = document.querySelector('#world > .osnap-layer');
    if (!layer) { layer = document.createElement('div'); layer.className = 'osnap-layer'; $('world').appendChild(layer); }
    layer.innerHTML = list.map(g => g.kind === 'v'
      ? `<div class="og-line v" style="left:${g.x}px;top:${Math.min(g.y0, g.y1)}px;height:${Math.abs(g.y1 - g.y0)}px"></div>`
      : g.kind === 'h' ? `<div class="og-line h" style="top:${g.y}px;left:${Math.min(g.x0, g.x1)}px;width:${Math.abs(g.x1 - g.x0)}px"></div>`
      : `<div class="og-mark" style="left:${g.x}px;top:${g.y}px"></div>${g.text ? `<div class="og-tip" style="left:${g.x}px;top:${g.y}px">${esc(g.text)}</div>` : ''}`).join('');
  }
  const clearGuides = () => { const l = document.querySelector('#world > .osnap-layer'); if (l) l.innerHTML = ''; };
  // align the moving item's centre with other items' centres (x and y separately)
  function osnapAlign(loop, prim, nx, ny, skip, lockX, lockY) {
    const s = sizes[prim.id] || { w: NODE_W, h: 56 };
    const cx = nx + s.w / 2, cy = ny + s.h / 2;
    const thr = 9 / zoom;
    let bx = null, by = null;
    loop.nodes.forEach(o => {
      if (skip.has(o.id)) return;
      const c = center(o);
      if (!lockX && Math.abs(c.x - cx) <= thr && (!bx || Math.abs(c.x - cx) < Math.abs(bx.c.x - cx))) bx = { o, c };
      if (!lockY && Math.abs(c.y - cy) <= thr && (!by || Math.abs(c.y - cy) < Math.abs(by.c.y - cy))) by = { o, c };
    });
    const guides = [];
    if (bx) { nx += bx.c.x - cx; guides.push({ kind: 'v', x: bx.c.x, y0: bx.c.y, y1: (by ? by.c.y : cy) }); guides.push({ kind: 'm', x: bx.c.x, y: bx.c.y, text: `Centre: ${bx.o.tag}` }); }
    if (by) { ny += by.c.y - cy; guides.push({ kind: 'h', y: by.c.y, x0: by.c.x, x1: nx + s.w / 2 }); if (!bx || by.o !== bx.o) guides.push({ kind: 'm', x: by.c.x, y: by.c.y, text: `Centre: ${by.o.tag}` }); }
    return { nx, ny, guides };
  }
  // the item a cable end would snap to: under the pointer, or the nearest one within reach
  function osnapTarget(loop, e, w, exclude) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const t = under && under.closest('#nodes .node');
    if (t && t.dataset.id !== exclude) return nodeById(loop, t.dataset.id);
    if (!draft.osnap) return null;
    const reach = 40 / zoom;
    let best = null, bd = Infinity;
    loop.nodes.forEach(n => {
      if (n.id === exclude) return;
      const f = fullBox(n);
      const dx = Math.max(f.x0 - w.x, 0, w.x - f.x1), dy = Math.max(f.y0 - w.y, 0, w.y - f.y1);
      const d = Math.hypot(dx, dy);
      if (d <= reach && d < bd) { bd = d; best = n; }
    });
    return best;
  }

  // ---------------------------------------------------------------- PDF export
  // The drawing is HTML + SVG, so the browser's print engine produces a vector PDF ("Save as
  // PDF"): sharp at any zoom, searchable text, no external library. We build a print-only sheet
  // with a frame and a title block, scale the loop to fit, and open the print dialog.
  const PAPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420] }; // landscape, mm
  const MM = 96 / 25.4; // CSS px per mm
  function drawingExtents(loop) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
    loop.nodes.forEach(n => { const f = fullBox(n); add(f.x0, f.y0, f.x1, f.y1); });
    (loop.images || []).forEach(im => add(im.x, im.y, im.x + im.w, im.y + im.h));
    document.querySelectorAll('#nodes .wlabel, #nodes .encl-tab').forEach(el => { // labels: measure in world units
      const x = parseFloat(el.style.left), y = parseFloat(el.style.top), w = el.offsetWidth, h = el.offsetHeight;
      if (isNaN(x)) return;
      if (el.classList.contains('wlabel')) {
        const r = cableLabelRect(x, y, w, h, el.classList.contains('along-v') ? 'v' : 'h');
        add(r.x0, r.y0, r.x1, r.y1 + (el.querySelector('.flag-note') ? 40 : 0));
      }
      else add(x, y, x + w, y + h);
    });
    loop.links.forEach(l => ['fa', 'fb'].forEach(k => { if (l[k]) add(l[k].x, l[k].y, l[k].x, l[k].y); }));
    if (!isFinite(x0)) return null;
    const pad = 24;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  function buildPrintSheet(opts) {
    const loop = cur();
    const [pw, ph] = opts.orient === 'portrait' ? [PAPER[opts.paper][1], PAPER[opts.paper][0]] : PAPER[opts.paper];
    const margin = 10, tbH = 24; // mm: page margin and title block height
    const areaW = (pw - 2 * margin) * MM, areaH = (ph - 2 * margin - tbH) * MM;
    // render the drawing as on screen (no selection, no highlight), then copy it
    const prevSel = sel, prevSelNodes = selNodes, prevShowAll = showHiddenAll;
    sel = null; selNodes = new Set(); showHiddenAll = false;
    renderDiagram();
    const ext = drawingExtents(loop);
    const world = $('world').cloneNode(true);
    sel = prevSel; selNodes = prevSelNodes; showHiddenAll = prevShowAll;
    renderDiagram();
    world.removeAttribute('id');
    const wl = world.querySelector('#wires'), nl = world.querySelector('#nodes');
    if (wl) wl.classList.add('ps-wires');
    if (nl) nl.classList.add('ps-nodes');
    world.querySelectorAll('[id]').forEach(e => e.removeAttribute('id')); // no duplicate ids in the page
    world.querySelectorAll('.port, .grip, .cgrip, .selbox, .eye, .wlabel.info-hidden, .osnap-layer').forEach(e => e.remove());
    world.querySelectorAll('.sel').forEach(e => e.classList.remove('sel'));
    let scale = 1, tx = 0, ty = 0;
    if (ext) {
      scale = Math.min(areaW / (ext.x1 - ext.x0), areaH / (ext.y1 - ext.y0), 1.6);
      tx = (areaW - (ext.x1 - ext.x0) * scale) / 2 - ext.x0 * scale;
      ty = (areaH - (ext.y1 - ext.y0) * scale) / 2 - ext.y0 * scale;
    }
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    world.style.setProperty('--z', scale);
    const c = counts(allItems(loop));
    const today = new Date().toISOString().slice(0, 10);
    const pages = opts.orders !== 'none' ? 2 : 1;
    const titleBlock = page => `<table class="ps-tb">
        <tr><td class="ps-tb-title" rowspan="2">${esc(loop.name || 'Untitled loop')}<small>Loop diagram${showTerminals ? ' with terminals' : ''}${page === 2 ? ' · order list' : ''}</small></td>
          <td><span>Date</span>${today}</td><td><span>Drawn</span>&nbsp;</td><td><span>Rev.</span>&nbsp;</td></tr>
        <tr><td><span>Items / cables</span>${loop.nodes.length} / ${loop.links.length}</td><td><span>Order status</span>${c.todo} to order · ${c.ordered} ordered · ${c.have} in stock</td><td><span>Sheet</span>${page}${page === 2 ? ' (order list)' : ''}</td></tr>
      </table>`;
    let html = `<section class="ps-page" style="width:${pw - 2 * margin}mm;height:${ph - 2 * margin}mm">
        <div class="ps-frame"><div class="ps-area" style="height:${(ph - 2 * margin - tbH)}mm"></div>${titleBlock(1)}</div></section>`;
    if (opts.orders !== 'none') {
      const keepF = orderFilter, keepS = orderScope, keepG = orderGroup;
      orderFilter = opts.orders === 'todo' ? 'todo' : 'all'; orderScope = 'loop'; orderGroup = 'totals';
      const rows = displayRows();
      orderFilter = keepF; orderScope = keepS; orderGroup = keepG;
      const by = {};
      rows.forEach(r => { (by[r.cat] = by[r.cat] || []).push(r); });
      html += `<section class="ps-page ps-break" style="width:${pw - 2 * margin}mm;min-height:${ph - 2 * margin}mm">
        <div class="ps-frame ps-orders"><h2>Order list${opts.orders === 'todo' ? ': still to order' : ''}</h2>
        ${rows.length ? CAT_KEYS.filter(k => by[k]).map(k => `<h3>${esc(CAT[k].n)}</h3><table class="ps-ot"><colgroup><col style="width:13%"><col style="width:47%"><col style="width:28%"><col style="width:12%"></colgroup><thead><tr><th>Status</th><th>Item</th><th>For</th><th class="q">Qty</th></tr></thead><tbody>
          ${by[k].map(r => `<tr><td>${STATUS_LABEL[r.status]}</td><td>${esc(r.name)}</td><td>${esc(r.forLabel)}</td><td class="q">${r.qty === '' || r.qty == null ? '?' : esc(r.qty)} ${esc(r.unit)}</td></tr>`).join('')}</tbody></table>`).join('') : '<p>Nothing to order.</p>'}
        ${titleBlock(2)}</div></section>`;
    }
    const sheet = $('printSheet');
    sheet.innerHTML = html;
    sheet.classList.toggle('bw', opts.colour === 'bw');
    sheet.querySelector('.ps-area').appendChild(world);
    // explicit width and height (already in the chosen orientation); a keyword after them is invalid CSS
    $('pageStyle').textContent = `@page { size: ${pw}mm ${ph}mm; margin: ${margin}mm; }`;
    return { scale, pages };
  }
  function exportPdf(opts) {
    const theme = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light'; // paper is white
    const info = buildPrintSheet(opts);
    document.title = (cur().name || 'Loop diagram').replace(/[\\/:*?"<>|]+/g, '-'); // default PDF file name
    const done = () => {
      window.removeEventListener('afterprint', done);
      if (theme) document.documentElement.dataset.theme = theme; else delete document.documentElement.dataset.theme;
      document.title = 'Loop Planner';
      if (!window.LOOP_PLANNER_KEEP_PRINT) $('printSheet').innerHTML = '';
    };
    window.addEventListener('afterprint', done);
    try { window.print(); } catch (e) { done(); toast('Printing is blocked here. Open Loop Planner in its own browser tab to export a PDF.'); }
    return info;
  }

  // ---------------------------------------------------------------- wiring up
  function setView(v) {
    view = v;
    $('viewDiagram').hidden = v !== 'diagram';
    $('viewOrders').hidden = v !== 'orders';
    $('tabDiagram').classList.toggle('active', v === 'diagram');
    $('tabOrders').classList.toggle('active', v === 'orders');
    $('tabDiagram').setAttribute('aria-selected', v === 'diagram');
    $('tabOrders').setAttribute('aria-selected', v === 'orders');
    if (v === 'orders') renderOrders(); else renderDiagram();
  }
  function switchLoop(id) {
    if (cablePick) stopCablePick();
    state.currentId = id; sel = null;
    renderAll(); save();
    requestAnimationFrame(fit);
  }

  function init() {
    state = load();
    if (migratedNow) save(); // store the converted layout once
    loadImages();
    renderPalette();
    renderAll();
    updateView();
    requestAnimationFrame(fit);
    histLast = stateKey(); updateUndoButtons();
    // Chromium can keep the size it first gave the symbols' SVG text (before the zoom and the web
    // fonts were in place), drawing numbers too big and off their terminals: draw once more then
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(() => { if (!drag) renderDiagram(); }));

    $('paletteList').addEventListener('pointerdown', onPalettePointerDown);
    $('viewport').addEventListener('pointerdown', onSheetPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
    $('viewport').addEventListener('wheel', e => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      const dx = e.deltaX * k, dy = e.deltaY * k;
      if (!e.ctrlKey && !e.metaKey && Math.abs(dx) > Math.abs(dy)) { panBy(-dx, 0); return; } // sideways swipe on a touchpad
      applyZoom(zoom * Math.exp(-Math.max(-300, Math.min(300, dy)) * 0.0015), { x: e.clientX, y: e.clientY });
    }, { passive: false });
    $('viewport').addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); // no browser autoscroll
    document.addEventListener('pointerdown', e => { if ($('termPop') && !e.target.closest('#termPop')) closeTermPop(); }, true);
    $('viewport').addEventListener('wheel', () => closeTermPop(), { passive: true });
    // Keep the drawing in view when the sheet changes size (panel resized, window resized,
    // toolbar wrapping): rescale around the centre so what was visible stays visible.
    // Symmetric, so widening a panel and narrowing it back returns to the same view.
    let lastVp = null;
    const keepViewOnResize = () => {
      const vp = $('viewport'), w = vp.clientWidth, h = vp.clientHeight;
      if (!w || !h) return; // sheet hidden (order list view)
      if (lastVp && (lastVp.w !== w || lastVp.h !== h) && refView) {
        zoom = Math.min(ZMAX, Math.max(ZMIN, Math.min(w / refView.ww, h / refView.wh)));
        panX = w / 2 - refView.cx * zoom; panY = h / 2 - refView.cy * zoom;
        updateView(true);
      }
      lastVp = { w, h };
    };
    if (window.ResizeObserver) new ResizeObserver(keepViewOnResize).observe($('viewport'));
    else window.addEventListener('resize', keepViewOnResize);
    // Resizable side panels: drag the borders, double-click to reset; widths are remembered.
    const PANEL_KEY = 'loop-planner-panels';
    const diag = $('viewDiagram');
    let panels = {};
    try { panels = JSON.parse(localStorage.getItem(PANEL_KEY)) || {}; } catch (e) { panels = {}; }
    const applyPanels = () => {
      ['pal', 'insp'].forEach(k => { if (panels[k]) diag.style.setProperty(`--${k}-w`, panels[k] + 'px'); else diag.style.removeProperty(`--${k}-w`); });
      // the sheet's new size is picked up by the resize observer above
    };
    const savePanels = () => { try { localStorage.setItem(PANEL_KEY, JSON.stringify(panels)); } catch (e) { /* not saved */ } };
    ['pal', 'insp'].forEach(k => {
      const el = $(k === 'pal' ? 'rzPal' : 'rzInsp');
      el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        el.setPointerCapture(e.pointerId); el.classList.add('active'); document.body.classList.add('resizing');
        const move = ev => {
          const r = diag.getBoundingClientRect();
          const other = k === 'pal' ? $('inspector').offsetWidth : document.querySelector('.palette').offsetWidth;
          const max = Math.max(160, r.width - other - 320); // always leave room for the sheet
          const w = k === 'pal' ? ev.clientX - r.left : r.right - ev.clientX;
          panels[k] = Math.round(Math.min(max, Math.max(k === 'pal' ? 150 : 260, w)));
          applyPanels();
        };
        const up = () => {
          el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
          el.classList.remove('active'); document.body.classList.remove('resizing'); savePanels();
        };
        el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
      el.addEventListener('dblclick', () => { delete panels[k]; savePanels(); applyPanels(); });
    });
    applyPanels();
    $('zoomIn').onclick = () => applyZoom(zoom * 1.15);
    $('zoomOut').onclick = () => applyZoom(zoom / 1.15);
    $('zoomFit').onclick = fit;
    $('btnMirror').onclick = mirror;
    ['snap', 'ortho', 'osnap'].forEach(k => { $('tg-' + k).onclick = () => toggleDraft(k); });
    $('snapStep').onchange = e => { draft.step = Number(e.target.value) || 10; saveDraft(); };
    $('tg-hidden').onclick = () => { showHiddenAll = !showHiddenAll; renderDiagram(); updateStatusBar(); };
    updateStatusBar();
    // PDF dialog
    let pdfOpts = { paper: 'A3', orient: 'landscape', colour: 'colour', orders: 'none' };
    try { pdfOpts = Object.assign(pdfOpts, JSON.parse(localStorage.getItem('loop-planner-pdf')) || {}); } catch (e) { /* defaults */ }
    const pdfDlg = $('pdfDialog');
    $('btnPdf').onclick = () => {
      ['paper', 'orient', 'colour', 'orders'].forEach(k => { $('pdf-' + k).value = pdfOpts[k]; });
      pdfDlg.hidden = false; $('pdf-paper').focus();
    };
    $('pdfCancel').onclick = () => { pdfDlg.hidden = true; };
    pdfDlg.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); pdfDlg.hidden = true; } });
    $('pdfGo').onclick = () => {
      ['paper', 'orient', 'colour', 'orders'].forEach(k => { pdfOpts[k] = $('pdf-' + k).value; });
      try { localStorage.setItem('loop-planner-pdf', JSON.stringify(pdfOpts)); } catch (e) { /* not saved */ }
      pdfDlg.hidden = true;
      if (view !== 'diagram') setView('diagram');
      setTimeout(() => exportPdf(pdfOpts), 50);
    };
    const syncTermBtn = () => { $('btnTerminals').classList.toggle('on-order', showTerminals); $('btnTerminals').setAttribute('aria-pressed', showTerminals); };
    syncTermBtn();
    $('btnTerminals').onclick = () => {
      showTerminals = !showTerminals;
      try { localStorage.setItem('loop-planner-terminals', showTerminals ? '1' : '0'); } catch (e) { /* not saved */ }
      syncTermBtn(); renderDiagram();
      toast(showTerminals ? 'Terminal detail on: cores are drawn to their terminals.' : 'Terminal detail off: one line per cable.');
    };
    $('btnFlags').onclick = () => {
      if (view !== 'diagram') setView('diagram');
      select(null);
      const h = $('flagListHead') || document.querySelector('.flag-list');
      const head = h || $('inspector').querySelector('h3');
      if (head) head.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    const hlRefresh = () => { renderDiagram(); renderChecklist(); renderHighlightBar(); if (view === 'orders') renderOrders(); };
    $('btnHighlight').onclick = () => {
      $('hlBar').hidden = !$('hlBar').hidden;
      $('btnHighlight').setAttribute('aria-expanded', !$('hlBar').hidden);
      renderHighlightBar();
      if (!$('hlBar').hidden) $('hlText').focus();
    };
    $('hlChips').onclick = e => {
      const c = e.target.closest('[data-hlcat]'); if (!c) return;
      const k = c.dataset.hlcat;
      if (hl.cats.has(k)) hl.cats.delete(k); else hl.cats.add(k);
      hlRefresh();
    };
    $('hlText').oninput = e => { hl.text = e.target.value; hlRefresh(); };
    $('hlText').onkeydown = e => { if (e.key === 'Escape') { e.target.value = ''; hl.text = ''; hlRefresh(); e.target.blur(); } };
    $('hlTodo').onchange = e => { hl.todo = e.target.checked; hlRefresh(); };
    $('hlClear').onclick = () => { hl.cats.clear(); hl.text = ''; hl.todo = false; $('hlText').value = ''; $('hlTodo').checked = false; hlRefresh(); };
    $('hlClose').onclick = () => { $('hlBar').hidden = true; $('btnHighlight').setAttribute('aria-expanded', 'false'); renderHighlightBar(); };
    $('paletteList').addEventListener('click', e => {
      const et = e.target.closest('[data-edit-type]');
      if (et) { openTypeEditor(et.dataset.editType); return; }
      if (e.target.closest('#btnNewType')) openTypeEditor(null);
    });

    const insp = $('inspector');
    insp.addEventListener('input', onInspectorInput);
    insp.addEventListener('change', onInspectorInput);
    insp.addEventListener('click', onInspectorClick);
    insp.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'addName') addCustom(); });

    document.addEventListener('keydown', e => {
      const tag = (e.target.tagName || '').toLowerCase();
      const typing = tag === 'textarea' || tag === 'select' || (tag === 'input' && !['checkbox', 'radio', 'button'].includes(e.target.type));
      if (typing) return;
      if (tag === 'input') { // a ticked checkbox keeps focus: let Ctrl shortcuts reach the drawing, leave other keys to it
        if (!(e.ctrlKey || e.metaKey)) return;
        e.target.blur();
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'z' || (e.key.toLowerCase() === 'y' && !e.shiftKey))) {
        e.preventDefault();
        if (drag) return;
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === ' ' && view === 'diagram') { e.preventDefault(); if (!spaceDown) { spaceDown = true; $('viewport').classList.add('panning'); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && view === 'diagram') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape' && cablePick) { stopCablePick(); toast('Done placing cables.'); return; }
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && view === 'diagram') { e.preventDefault(); toggleFlagSelection(); return; }
      if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey && !e.altKey && view === 'diagram' && sel && sel.kind === 'link') { e.preventDefault(); toggleCableHidden(linkById(cur(), sel.id)); return; }
      const fk = { F9: 'snap', F8: 'ortho', F3: 'osnap' }[e.key];
      if (fk && view === 'diagram') { e.preventDefault(); toggleDraft(fk); return; }
      if (e.key === 'Escape' && sel) select(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && view === 'diagram') { e.preventDefault(); setSelection(cur().nodes.map(n => n.id)); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && view === 'diagram') {
        const k = e.key.toLowerCase();
        // copy / cut / paste go through the browser's clipboard events (so a picture copied
        // elsewhere can be pasted); the timers are a fallback where those events do not fire
        if (k === 'c') { clipFallback = setTimeout(() => { clipFallback = null; copySelection(); }, 120); }
        else if (k === 'x') { clipFallback = setTimeout(() => { clipFallback = null; cutSelection(); }, 120); }
        else if (k === 'v') { pasteKeep = false; clipFallback = setTimeout(() => { clipFallback = null; pasteAtPointer(); }, 120); }
        else if (k === 'd') { e.preventDefault(); duplicateSelection(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v' && view === 'diagram') { pasteKeep = true; clipFallback = setTimeout(() => { clipFallback = null; pasteAtPointer(true); }, 120); }
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && selectedIds().length && view === 'diagram') {
        e.preventDefault();
        histGroup = 'nudge';
        const step = e.shiftKey ? GRID * 5 : GRID;
        nudge(arrows[e.key][0] * step, arrows[e.key][1] * step);
      }
    });
    const typingIn = el => el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'range'].includes(el.type)));
    const takeClip = () => { if (clipFallback) { clearTimeout(clipFallback); clipFallback = null; return true; } return false; };
    const markClipboard = e => { // tell a later paste that the app's own copy is the newest thing on the clipboard
      const m = 'loop-planner-clip:' + Date.now() + ':' + uid();
      try { localStorage.setItem('loop-planner-clip-mark', m); } catch (err) { /* ignore */ }
      clipMarkMem = m;
      try { e.clipboardData.setData('text/plain', m); e.preventDefault(); } catch (err) { /* ignore */ }
    };
    document.addEventListener('copy', e => {
      if (typingIn(document.activeElement) || view !== 'diagram') return;
      const had = takeClip();
      if (!had && !selectedIds().length && !(sel && (sel.kind === 'link' || sel.kind === 'image'))) return;
      if (copySelection()) markClipboard(e);
    });
    document.addEventListener('cut', e => {
      if (typingIn(document.activeElement) || view !== 'diagram') return;
      if (!takeClip() && !selectedIds().length && !(sel && (sel.kind === 'link' || sel.kind === 'image'))) return;
      if (sel && sel.kind === 'image') { copySelection(true); markClipboard(e); deleteSelected(); return; }
      markClipboard(e); cutSelection();
    });
    document.addEventListener('paste', e => {
      if (typingIn(document.activeElement) || view !== 'diagram') return;
      takeClip();
      const dt = e.clipboardData;
      let file = null;
      if (dt) for (const it of dt.items || []) if (it.kind === 'file' && /^image\//.test(it.type)) { file = it.getAsFile(); break; }
      let mark = clipMarkMem; try { mark = localStorage.getItem('loop-planner-clip-mark') || mark; } catch (err) { /* ignore */ }
      const ours = dt && mark && dt.getData('text/plain') === mark;
      e.preventDefault();
      if (file && !ours) insertImage(file, pointerWorld);
      else pasteAtPointer(pasteKeep);
      pasteKeep = false;
    });
    // drop image files on the sheet
    $('viewport').addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    $('viewport').addEventListener('drop', e => {
      const files = [...(e.dataTransfer.files || [])].filter(f => /^image\//.test(f.type));
      if (!files.length) return;
      e.preventDefault();
      const w = toWorld(e.clientX, e.clientY);
      files.reduce((pr, f, i) => pr.then(() => insertImage(f, { x: w.x + i * 40, y: w.y + i * 40 })), Promise.resolve());
    });
    $('fileImage').onchange = e => { const f = e.target.files[0]; if (f) insertImage(f, null); e.target.value = ''; };
    document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; $('viewport').classList.remove('panning'); } });
    window.addEventListener('blur', () => { spaceDown = false; $('viewport').classList.remove('panning'); });
    $('viewport').addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

    $('tabDiagram').onclick = () => setView('diagram');
    $('tabOrders').onclick = () => setView('orders');

    $('loopSelect').onchange = e => switchLoop(e.target.value);
    $('btnUndo').onclick = () => undo();
    $('btnRedo').onclick = () => redo();
    $('loopName').oninput = e => { histGroup = 'loopname:' + state.currentId; cur().name = e.target.value; renderLoopBar(); if (!sel) { const h = document.querySelector('.inspector h2'); if (h) h.textContent = e.target.value; } save(); };
    $('btnNewLoop').onclick = () => {
      const l = newLoop(`Loop ${state.loops.length + 1}`);
      state.loops.push(l); switchLoop(l.id);
      toast('New loop created. Rename it in the box at the top.');
    };
    $('btnDupLoop').onclick = () => {
      const copy = JSON.parse(JSON.stringify(cur()));
      copy.id = uid(); copy.name = (copy.name || 'Loop') + ' (copy)';
      state.loops.push(copy); switchLoop(copy.id);
      toast('Loop duplicated. Statuses were copied too.');
    };
    $('btnDelLoop').onclick = () => {
      const loop = cur();
      askConfirm(`Delete loop “${loop.name || 'Untitled loop'}” and its checklist?`, 'Delete loop', () => {
        snapshot();
        state.loops = state.loops.filter(l => l.id !== loop.id);
        if (!state.loops.length) state.loops.push(newLoop('Loop 1'));
        switchLoop(state.loops[0].id);
        toast('Loop deleted.', true);
      });
    };
    $('confirmYes').onclick = () => { $('confirmBar').hidden = true; if (confirmAction) confirmAction(); confirmAction = null; };
    $('confirmNo').onclick = () => { $('confirmBar').hidden = true; confirmAction = null; };
    $('modeDone').onclick = () => { stopCablePick(); toast('Done placing cables.'); };

    // Theme: Auto (follow the system) -> Light -> Dark
    const THEMES = { auto: '◐ Auto', light: '☀ Light', dark: '☾ Dark' };
    const getTheme = () => { try { const t = localStorage.getItem('loop-planner-theme'); return THEMES[t] ? t : 'auto'; } catch (e) { return 'auto'; } };
    const applyTheme = t => {
      if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
      $('btnTheme').textContent = THEMES[t];
      $('btnTheme').setAttribute('aria-label', `Colour theme: ${t}. Click to change.`);
    };
    let theme = getTheme();
    applyTheme(theme);
    $('btnTheme').onclick = () => {
      theme = { auto: 'light', light: 'dark', dark: 'auto' }[theme];
      try { localStorage.setItem('loop-planner-theme', theme); } catch (e) { /* not saved */ }
      applyTheme(theme);
      toast(theme === 'auto' ? 'Theme follows your system setting.' : `${theme === 'dark' ? 'Dark' : 'Light'} theme.`);
    };
    $('btnExport').onclick = async () => {
      const imageData = {};
      for (const id of allImageRefs()) { const v = await imgGet(id); if (v) imageData[id] = v.data; }
      const text = JSON.stringify(Object.assign({}, state, Object.keys(imageData).length ? { imageData } : {}), null, 2);
      if (window.LOOP_PLANNER_NO_DOWNLOAD) copyText(text, 'Backup copied. Paste it into a .json file to keep it.');
      else download(`loop-planner-${new Date().toISOString().slice(0, 10)}.json`, text, 'application/json');
    };
    $('fileImport').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      f.text().then(txt => {
        const data = JSON.parse(txt);
        if (!data || !Array.isArray(data.loops)) throw new Error('bad');
        snapshot();
        const pics = data.imageData || {};
        delete data.imageData;
        return Promise.all(Object.keys(pics).map(id => imgPut(id, pics[id]))).then(() => data);
      }).then(data => {
        state = migrateToSymbols(migrateHiddenInfo(data));
        if (!state.loops.length) state.loops.push(newLoop('Loop 1'));
        if (!Array.isArray(state.customTypes)) state.customTypes = starterTypes();
        if (!state.loops.find(l => l.id === state.currentId)) state.currentId = state.loops[0].id;
        sel = null; typeDraft = null; renderPalette(); renderAll(); save(); requestAnimationFrame(fit);
        toast(`Imported ${state.loops.length} loop(s).`, true);
      }).catch(() => toast('That file is not a Loop Planner export.'));
      e.target.value = '';
    };

    $('scopeSeg').onclick = e => { const b = e.target.closest('button'); if (b) { orderScope = b.dataset.scope; renderOrders(); } };
    $('filterSeg').onclick = e => { const b = e.target.closest('button'); if (b) { orderFilter = b.dataset.f; renderOrders(); } };
    $('ordersBody').onclick = e => {
      const st = e.target.closest('[data-o]');
      if (st) {
        const r = currentOrderRows[Number(st.dataset.o)];
        const next = cycle(r.status);
        r.members.forEach(m => setItem(m, { s: next }));
        renderOrders(); renderProgress(); renderDiagram(); save(); return;
      }
      const j = e.target.closest('[data-jump]');
      if (j) {
        const r = currentOrderRows[Number(j.dataset.jump)].jump;
        if (r.loop.id !== state.currentId) { state.currentId = r.loop.id; renderLoopBar(); }
        sel = { kind: r.where.kind, id: r.where.id };
        setView('diagram'); renderAll();
      }
    };
    $('groupSeg').onclick = e => { const b = e.target.closest('button'); if (b) { orderGroup = b.dataset.g; renderOrders(); } };
    $('btnCopy').onclick = () => {
      const rows = displayRows();
      copyText(listText(rows), `Copied ${rows.length} line(s).`);
    };
    if (window.LOOP_PLANNER_NO_DOWNLOAD) { $('btnCsv').hidden = true; $('btnExport').textContent = 'Copy backup'; }
    $('btnCsv').onclick = () => {
      const rows = displayRows();
      download('order-list.csv', csvText(rows), 'text/csv');
    };
    window.addEventListener('resize', () => drawWires());
  }

  // ---------------------------------------------------------------- example
  function exampleLoop() {
    const loop = newLoop('Example: pump skid PT-101 / XV-102');
    const N = (type, tag, desc, x, y) => { const n = { id: uid(), type, tag, desc, notes: '', x, y, st: {}, custom: [] }; loop.nodes.push(n); return n; };
    const ai = N('plc', 'AI-04', 'AI card, rack 1 slot 4', 80, 120);
    const dq = N('plc', 'DO-06', 'DO card, rack 1 slot 6', 80, 470);
    const x10 = N('tb', 'X10', 'Marshalling, CP-01', 440, 230);
    const psu = N('psu', 'PSU-01', '24 VDC loop supply', 440, 640);
    const jb = N('jb', 'JB-01', 'Pump skid JB', 820, 170);
    const ca = N('u_camp', 'CA-103', 'Charge amplifier', 820, 600);
    ca.inside = jb.id;
    const pt = N('tx', 'PT-101', 'Pump discharge pressure', 1220, 120);
    const xv = N('valve', 'XV-102', 'Recirculation valve', 1220, 360);
    const hs = N('u_hall', 'HS-103', 'Pump speed pickup', 1220, 640);
    const L = (a, b, tag, cable, opts) => {
      const l = makeLink(loop, a.id, b.id);
      Object.assign(l, { tag, cable, n: CABLES[cable].defN || null }, opts || {});
      loop.links.push(l); return l;
    };
    const c101 = L(jb, pt, 'C-101', 'pair', { length: 25, size: '1.0 mm²' });
    const c102 = L(jb, xv, 'C-102', 'control', { n: 3, length: 22, size: '1.5 mm²' });
    L(ca, hs, 'C-103', 'triad', { length: 15, size: '0.5 mm²' });
    L(jb, ca, 'W-104', 'wire', { n: 3, length: 1, route: 'duct', size: '0.75 mm²' });
    const c110 = L(x10, jb, 'C-110', 'multipair', { n: 4, length: 120, armoured: true, size: '1.0 mm²' });
    const w1 = L(ai, x10, 'W-101', 'wire', { n: 2, length: 3, route: 'duct', size: '0.75 mm²' });
    const w2 = L(dq, x10, 'W-102', 'wire', { n: 2, length: 3, route: 'duct', size: '0.75 mm²' });
    const w3 = L(x10, psu, 'W-103', 'wire', { n: 2, length: 2, route: 'duct', size: '1.5 mm²' });
    // some realistic progress so the colours show
    const S = (ent, map) => { Object.keys(map).forEach(k => { ent.st[k] = { s: map[k] }; }); };
    S(pt, { dev: 'ordered', mount: 'ordered', proc: 'have', blank: 'na' });
    S(xv, { dev: 'ordered', coil: 'ordered', ls: 'na' });
    S(jb, { encl: 'have', rail: 'have', endplate: 'have', endstop: 'have' });
    S(ai, { dev: 'have', front: 'have', base: 'have', labels: 'have', shield: 'have' });
    S(dq, { dev: 'have', front: 'have', base: 'have', labels: 'have', shield: 'na' });
    S(psu, { dev: 'have', mcb: 'have', dist: 'have', outfuse: 'have' });
    S(c101, { cable: 'have', 'gland-a': 'ordered', 'gland-b': 'ordered', route: 'have' });
    S(c110, { cable: 'ordered', route: 'have', fix: 'have' });
    S(c102, { route: 'have' });
    [w1, w2, w3].forEach(w => S(w, { cable: 'have', route: 'have', 'term-a': 'have', 'term-b': 'have' }));
    S(loop.general, { ties: 'have', hs: 'have', ge: 'have' });
    dq.notes = 'Spare channels 5–8.';
    return loop;
  }

  init();
})();
