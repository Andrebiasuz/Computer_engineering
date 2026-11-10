/* Loop Planner — draw an instrument/control loop and get reminded of every
   item to order on each branch (cables, glands, lugs, ferrules, markers...).
   Plain JS, no dependencies, data kept in localStorage. */
(function () {
  'use strict';

  // ---------------------------------------------------------------- constants
  const STORE_KEY = 'loop-planner-v1';
  const GRID = 10, NODE_W = 168, ZMIN = 0.1, ZMAX = 4;

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
    ['tb', 'Terminal blocks', 'terminal', c => c.terminals || '', 'pcs', c => c.cores ? `≈ ${c.terminals} for ${c.cores} cores landing. Add spares.` : 'Count follows the cables you connect'],
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
    valve: { group: 'Field devices', name: 'Solenoid valve / actuator', shape: 'bubble', tag: 'XV-', desc: 'On/off valve', items: [
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
    jb: { group: 'Enclosures', name: 'Junction box', shape: 'box', sym: 'JB', tag: 'JB-', desc: 'Field junction box', items: [
      ['encl', 'Enclosure (IP rating, size, material)', 'device', () => 1, 'pcs'],
      ...TB_ITEMS,
      ['plugs', 'Blanking / stopping plugs for unused entries', 'gland', null, 'pcs'],
      ['breather', 'Breather / drain plug', 'gland', () => 1, 'pcs'],
      ['tagplate', 'Tag plate', 'mark', () => 1, 'pcs']
    ] },
    panel: { group: 'Enclosures', name: 'Cabinet / panel', shape: 'box', sym: 'CP', tag: 'CP-', desc: 'Control panel', items: [
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
    tb: { group: 'Panel', name: 'Terminal strip', shape: 'box', sym: 'X', tag: 'X', desc: 'Marshalling terminals', items: [
      ...TB_ITEMS,
      ['group', 'Strip marker / group label carrier', 'mark', () => 1, 'pcs']
    ] },
    plc: { group: 'Panel', name: 'PLC I/O card', shape: 'box', sym: 'I/O', tag: 'AI-', desc: 'Analog input card', items: [
      ['dev', 'I/O module', 'device', () => 1, 'pcs'],
      ['front', 'Front connector / terminal plug', 'term', () => 1, 'pcs'],
      ['base', 'Base unit / bus connector / free slot', 'device', () => 1, 'pcs'],
      ['shield', 'Shield clamp / shield bus', 'terminal'],
      ['labels', 'Channel labelling strips', 'mark', () => 1, 'pcs']
    ] },
    iso: { group: 'Panel', name: 'Isolator / IS barrier', shape: 'box', sym: 'ISO', tag: 'ISO-', desc: 'Signal isolator', items: [
      ['dev', 'Isolator / barrier module', 'device', () => 1, 'pcs'],
      ['pbus', 'Power rail / bus connector', 'terminal', () => 1, 'pcs'],
      ['ex', 'Light-blue IS wire, duct and IS labels (if Ex i)', 'mark']
    ] },
    relay: { group: 'Panel', name: 'Interposing relay', shape: 'box', sym: 'K', tag: 'K', desc: 'Interposing relay', items: [
      ['dev', 'Relay', 'device', () => 1, 'pcs'],
      ['socket', 'Relay socket / base', 'device', () => 1, 'pcs'],
      ['clip', 'Retaining clip', 'device', () => 1, 'pcs'],
      ['supp', 'Suppression diode / RC module', 'protect', () => 1, 'pcs'],
      ['mark', 'Relay marker', 'mark', () => 1, 'pcs']
    ] },
    psu: { group: 'Power', name: 'Power supply 24 VDC', shape: 'box', sym: 'PSU', tag: 'PSU-', desc: '24 VDC loop supply', items: [
      ['dev', 'Power supply unit (check current)', 'device', () => 1, 'pcs'],
      ['mcb', 'Upstream MCB', 'protect', () => 1, 'pcs'],
      ['dist', 'Distribution terminals for +24 V / 0 V', 'terminal'],
      ['outfuse', 'Output fuse terminals per loop', 'protect']
    ] },
    mcb: { group: 'Power', name: 'Breaker / fuse', shape: 'box', sym: 'F', tag: 'F', desc: 'Loop fuse', items: [
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
      group: 'My components', name: c.name || 'Component', shape: c.shape === 'bubble' ? 'bubble' : 'box',
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
      { id: 'u_camp', name: 'Charge amplifier', tag: 'CA-', shape: 'box', sym: 'CA', desc: 'Charge amplifier', panel: false, enclosure: false, terminals: false,
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

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && Array.isArray(data.loops) && data.loops.length) {
          if (!Array.isArray(data.customTypes)) data.customTypes = starterTypes();
          return data;
        }
      }
    } catch (e) { /* storage unavailable: start with the example */ }
    state = { version: 1, customTypes: starterTypes(), loops: [] };
    const ex = exampleLoop();
    state.loops.push(ex); state.currentId = ex.id;
    return state;
  }
  let saveTimer = null;
  function save() {
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
    return enc ? `${enc.tag} (for ${node.tag})` : node ? node.tag : '?';
  }
  function screenEndOf(loop, link) {
    if (!isShielded(link)) return 'none';
    if (link.screenEnd && link.screenEnd !== 'auto') return link.screenEnd;
    const na = nodeById(loop, link.a), nb = nodeById(loop, link.b);
    if (nb && isPanel(nb.type)) return 'b';
    if (na && isPanel(na.type)) return 'a';
    return 'b';
  }
  function nodeCtx(loop, node) {
    const ls = loop.links.filter(l => l.a === node.id || l.b === node.id);
    const cs = ls.map(cores);
    const sum = cs.reduce((s, v) => s + v, 0);
    const max = cs.length ? Math.max(...cs) : 0;
    return {
      cores: sum, cables: ls.length,
      shielded: ls.filter(isShielded).length,
      terminals: sum ? Math.max(max, Math.ceil(sum / 2)) : 0
    };
  }
  function specToGen(spec, ctx) {
    const [key, name, cat, qf, unit, hf] = spec;
    return { key, name, cat, auto: qf ? qf(ctx) : '', unit: unit || '', hint: hf ? hf(ctx) : '' };
  }
  function genNode(loop, node) {
    const ctx = nodeCtx(loop, node);
    return T(node.type).items.map(s => specToGen(s, ctx));
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
      out.push({ key: 'cable', name: desc, cat: 'cable', auto: len ? Math.ceil(len * 1.1) : '', unit: 'm',
        hint: len ? `${len} m route + 10% for terminations and slack` : 'Set the route length to get a quantity' });
    } else {
      out.push({ key: 'cable', name: `Panel wire${size} (colour per standard)`, cat: 'cable', auto: len ? Math.ceil(len * n * 1.1) : '', unit: 'm',
        hint: len ? `${n} wires × ${len} m + 10%` : 'Set the wire length to get a quantity' });
    }
    ['a', 'b'].forEach(end => {
      const node = nodeById(loop, link[end]);
      const at = node ? node.tag : end.toUpperCase();
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
    return `${link.tag} (${a ? a.tag : '?'} → ${b ? b.tag : '?'})`;
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
    $('btnHighlight').textContent = hlActive() ? 'Highlight ●' : 'Highlight';
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
  function symHTML(type, tag, cls) {
    const t = T(type);
    if (t.shape === 'bubble') {
      const m = String(tag || t.tag).match(/^([A-Za-z]+)[-\s]?(.*)$/);
      const top = m ? m[1].toUpperCase().slice(0, 4) : (tag || '').slice(0, 4);
      const bot = m ? m[2].slice(0, 5) : '';
      return `<div class="sym bubble ${cls || ''}"><div class="tg"><span>${esc(top)}</span>${bot ? `<span>${esc(bot)}</span>` : ''}</div></div>`;
    }
    if (t.shape === 'motor') return `<div class="sym motor ${cls || ''}">M</div>`;
    return `<div class="sym box ${cls || ''}">${esc(t.sym)}</div>`;
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

  function renderDiagram() {
    const loop = cur();
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
      html += `<div class="node${isSel ? ' sel' : ''}${hlc}" data-id="${n.id}" style="left:${n.x}px;top:${n.y}px">${hits ? `<span class="hl-badge" title="${hits} matching line${hits > 1 ? 's' : ''}">${hits}</span>` : ''}
        <div class="node-top">${symHTML(n.type, n.tag)}<div class="node-title"><b>${esc(n.tag)}</b><small>${esc(n.desc || T(n.type).name)}</small>${n.inside && nodeById(loop, n.inside) ? `<small class="inside-tag">in ${esc(nodeById(loop, n.inside).tag)}</small>` : ''}</div></div>
        <div class="chips">${chipsHTML(items)}</div>${badge}
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
      html += `<div class="wlabel ${cls}${isSel ? ' sel' : ''}${lhl}" data-link="${l.id}">${lhits ? `<span class="hl-badge" title="${lhits} matching line${lhits > 1 ? 's' : ''}">${lhits}</span>` : ''}
        <div class="wt">${esc(l.tag)} <small>${esc(spec)}${l.length ? ' · ' + esc(l.length) + ' m' : ''}</small></div>
        <div class="chips">${chipsHTML(items)}</div></div>`;
    });
    nodesEl.innerHTML = html;
    sizes = {};
    nodesEl.querySelectorAll('.node').forEach(el => { sizes[el.dataset.id] = { w: el.offsetWidth, h: el.offsetHeight }; });
    drawWires();
    $('emptyHint').hidden = loop.nodes.length > 0;
    $('viewport').classList.toggle('hl-active', hlActive());
    renderHighlightBar();
  }

  function center(n) {
    const s = sizes[n.id] || { w: NODE_W, h: 80 };
    return { x: n.x + s.w / 2, y: n.y + s.h / 2, w: s.w, h: s.h };
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
      [enc].concat(kids).forEach(n => { const c = center(n); x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + c.w); y1 = Math.max(y1, n.y + c.h); });
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
    loop.links.forEach(l => {
      const na = nodeById(loop, l.a), nb = nodeById(loop, l.b);
      if (!na || !nb) return;
      const ca = center(na), cb = center(nb);
      const gapX = Math.abs(cb.x - ca.x) - (ca.w + cb.w) / 2;
      let sa, sb;
      if (gapX >= 30) { sa = cb.x > ca.x ? 'r' : 'l'; sb = sa === 'r' ? 'l' : 'r'; }
      else { sa = cb.y > ca.y ? 'b' : 't'; sb = sa === 'b' ? 't' : 'b'; }
      R[l.id] = { l, na, nb, ca, cb, sa, sb, offa: 0, offb: 0, lane: 0 };
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
        const lim = horiz ? it.me.h / 2 - 8 : it.me.w / 2 - 12;
        it.r['off' + it.end] = Math.max(-lim, Math.min(lim, (i - (n - 1) / 2) * 12));
        if (n > 1) it.r.lane += (i - (n - 1) / 2) * 14;
      });
    });
    const portPt = (nd, c, side, off) => side === 'r' ? { x: nd.x + c.w, y: c.y + off } : side === 'l' ? { x: nd.x, y: c.y + off }
      : side === 'b' ? { x: c.x + off, y: nd.y + c.h } : { x: c.x + off, y: nd.y };
    Object.values(R).forEach(r => {
      const l = r.l;
      const k = [l.a, l.b].sort().join('|');
      const g = groups[k];
      r.lane += (g.indexOf(l) - (g.length - 1) / 2) * 16;
      const pa = portPt(r.na, r.ca, r.sa, r.offa), pb = portPt(r.nb, r.cb, r.sb, r.offb);
      let pts;
      if (r.sa === 'l' || r.sa === 'r') {
        const lo = Math.min(pa.x, pb.x) + 12, hi = Math.max(pa.x, pb.x) - 12;
        const mx = Math.max(lo, Math.min(hi, (pa.x + pb.x) / 2 + r.lane));
        pts = [pa, { x: mx, y: pa.y }, { x: mx, y: pb.y }, pb];
      } else {
        const lo = Math.min(pa.y, pb.y) + 12, hi = Math.max(pa.y, pb.y) - 12;
        const my = lo < hi ? Math.max(lo, Math.min(hi, (pa.y + pb.y) / 2 + r.lane)) : (pa.y + pb.y) / 2;
        pts = [pa, { x: pa.x, y: my }, { x: pb.x, y: my }, pb];
      }
      // label on the middle run of the route, i.e. halfway between the two items
      const best = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
      const items = linkItems(loop, l);
      const w = worst(items);
      const cls = w === 'todo' ? 'todo' : w === 'ordered' ? 'ordered' : 'done';
      const isSel = sel && sel.kind === 'link' && sel.id === l.id;
      const d = roundedPath(pts, 8);
      const whl = hlActive() ? (items.some(hlMatch) ? ' hl-on' : ' hl-off') : '';
      if (whl === ' hl-on') svg += `<path class="wire-glow" d="${d}"/>`;
      svg += `<path class="wire ${cls}${isSel ? ' sel' : ''}${whl}" d="${d}"/>`;
      svg += `<circle class="wire-end${whl}" cx="${pa.x.toFixed(1)}" cy="${pa.y.toFixed(1)}" r="4" style="fill:var(--${cls === 'done' ? 'have' : cls})"/>`;
      svg += `<circle class="wire-end${whl}" cx="${pb.x.toFixed(1)}" cy="${pb.y.toFixed(1)}" r="4" style="fill:var(--${cls === 'done' ? 'have' : cls})"/>`;
      svg += `<path class="wire-hit" data-link="${l.id}" d="${d}"/>`;
      labels[l.id] = best;
    });
    svg += '<path id="tempWire" class="wire-temp" d="" style="display:none"/>';
    // size the SVG to what it draws, since items can be anywhere (also at negative coordinates)
    let bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
    loop.nodes.forEach((n, i) => { const c = center(n); if (!i) { bx0 = n.x; by0 = n.y; bx1 = n.x; by1 = n.y; } bx0 = Math.min(bx0, n.x); by0 = Math.min(by0, n.y); bx1 = Math.max(bx1, n.x + c.w); by1 = Math.max(by1, n.y + c.h); });
    const m = 300;
    const W = $('wires');
    Object.assign(W.style, { left: (bx0 - m) + 'px', top: (by0 - m) + 'px', width: (bx1 - bx0 + 2 * m) + 'px', height: (by1 - by0 + 2 * m) + 'px' });
    W.innerHTML = `<g transform="translate(${m - bx0},${m - by0})">${svg}</g>`;
    $('nodes').querySelectorAll('.encl-tab').forEach(el => el.remove());
    $('nodes').insertAdjacentHTML('beforeend', tabs.join(''));
    document.querySelectorAll('.wlabel').forEach(el => {
      const p = labels[el.dataset.link];
      if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; el.hidden = false; } else el.hidden = true;
    });
  }

  // ---------------------------------------------------------------- inspector
  function renderInspector() {
    const loop = cur();
    const el = $('inspector');
    if (sel && sel.kind === 'type' && typeDraft) { el.innerHTML = typeEditor(); return; }
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
    if (sel.kind === 'type' || sel.kind === 'multi') return null;
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
      <p class="tip">Select an item or a cable on the sheet to see its checklist. Drag from a round handle on the side of an item to another item to draw a cable. Drag a box on an empty part of the sheet to select several items: left to right selects items fully inside, right to left selects anything the box touches. Then drag one of them to move them together (drag an enclosure's dashed outline or label to move it with everything inside); Ctrl+C / Ctrl+V copies and pastes them at the mouse pointer (Ctrl+Shift+V keeps their order statuses). The sheet is endless: the mouse wheel zooms at the cursor, drag with the middle button (or hold Space and drag) to pan, double-click the middle button to zoom extents. Click a status to step it: To order → Ordered → In stock → Not needed.</p>
      ${(() => { const c = readClip(); return c && (c.nodes.length || c.cable) ? `<div class="del-row" style="margin-top:12px"><button class="btn ghost" data-clip="paste" title="Ctrl+V">${c.cable ? `Paste cable ${esc(c.cable.tag)}` : `Paste ${c.nodes.length} copied item${c.nodes.length > 1 ? 's' : ''}`}</button>${keepBox()}</div>` : ''; })()}
      ${checklistBlock('Whole-loop consumables')}`;
  }

  function multiInspector(loop) {
    const nodes = [...selNodes].map(id => nodeById(loop, id)).filter(Boolean);
    let items = [];
    nodes.forEach(n => { items = items.concat(nodeItems(loop, n)); });
    const c = counts(items);
    return `<h2>${nodes.length} items selected</h2>
      <p class="tip">Drag any of them to move them together, or nudge with the arrow keys (Shift for bigger steps). Shift+click adds or removes an item. Esc clears the selection.</p>
      <div class="multi-list">${nodes.map(n => `<button class="btn ghost small" data-goto-node="${n.id}">${esc(n.tag)}</button>`).join('')}</div>
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
    return `<div class="insp-head">${symHTML(n.type, n.tag)}<div><h2>${esc(n.tag)}</h2><div class="kind">${esc(t.name)}</div></div></div>
      <div class="form">
        <label for="f-tag">Tag</label><input id="f-tag" type="text" data-bind="tag" value="${esc(n.tag)}">
        <label for="f-desc">Service</label><input id="f-desc" type="text" data-bind="desc" value="${esc(n.desc)}">
        <label for="f-inside">Mounted inside</label><select id="f-inside" data-bind="inside" data-rerender="1">
          <option value="">Not inside another item</option>
          ${loop.nodes.filter(o => o.id !== n.id && isEnclosure(o.type) && o.inside !== n.id).map(o => `<option value="${o.id}" ${n.inside === o.id ? 'selected' : ''}>${esc(o.tag)} (${esc(T(o.type).name)})</option>`).join('')}
        </select>
        <label for="f-notes">Notes</label><textarea id="f-notes" data-bind="notes" placeholder="Model, supplier, PO number…">${esc(n.notes)}</textarea>
      </div>
      ${t.custom ? `<p class="tip">This is one of your components. <button class="linkbtn" data-edit-type="${esc(n.type)}">Edit its reminders</button> (changes apply to every ${esc(t.name)}).</p>` : ''}
      ${checklistBlock('To order for this item')}
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
          <option value="bubble" ${d.shape === 'bubble' ? 'selected' : ''}>Circle (field instrument)</option>
          <option value="box" ${d.shape !== 'bubble' ? 'selected' : ''}>Square with letters</option></select>
        ${d.shape === 'bubble' ? '' : `<label for="t-sym">Letters</label><input id="t-sym" type="text" maxlength="4" data-tf="sym" value="${esc(d.sym)}" placeholder="e.g. CA">`}
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

  function linkInspector(loop, l) {
    const c = CABLES[l.cable];
    const na = nodeById(loop, l.a), nb = nodeById(loop, l.b);
    const shielded = isShielded(l);
    const nLabel = c.pairs ? 'Pairs' : 'Cores';
    const endHTML = (end, node) => {
      const autoTerm = (() => { const keep = l.ends[end].term; l.ends[end].term = 'auto'; const t = termAt(loop, l, end); l.ends[end].term = keep; return t; })();
      return `<div class="end">
        <div class="end-h"><span>${end.toUpperCase()} end</span><b>${esc(node ? node.tag : '?')}</b></div>
        <div class="row"><label class="sr" for="term-${end}">Termination at ${end.toUpperCase()} end</label>
          <select id="term-${end}" data-bind="ends.${end}.term" data-rerender="1">
            <option value="auto" ${l.ends[end].term === 'auto' ? 'selected' : ''}>Auto: ${esc(TERMS[autoTerm])}</option>
            ${Object.keys(TERMS).map(k => `<option value="${k}" ${l.ends[end].term === k ? 'selected' : ''}>${esc(TERMS[k])}</option>`).join('')}
          </select></div>
        <div class="row"><label><input id="gland-${end}" type="checkbox" data-bind="ends.${end}.gland" ${glandAt(loop, l, end) ? 'checked' : ''}> Cable gland at this end</label></div>
      </div>`;
    };
    return `<div class="insp-head"><div><h2>${esc(l.tag)}</h2><div class="kind">${esc(na ? na.tag : '?')} → ${esc(nb ? nb.tag : '?')}</div></div></div>
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
        </div>
        ${shielded ? `<label for="f-screen">Screen earth</label><select id="f-screen" data-bind="screenEnd">
          ${[['auto', 'Auto (panel side)'], ['a', `A end (${na ? na.tag : ''})`], ['b', `B end (${nb ? nb.tag : ''})`], ['both', 'Both ends'], ['none', 'Not earthed']]
            .map(([v, t]) => `<option value="${v}" ${(l.screenEnd || 'auto') === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}
      </div>
      <h3><span>Ends</span></h3>
      <div class="ends">${endHTML('a', na)}${endHTML('b', nb)}</div>
      <div class="form"><label for="f-notes">Notes</label><textarea id="f-notes" data-bind="notes" placeholder="Supplier, drum number, PO…">${esc(l.notes)}</textarea></div>
      ${checklistBlock('To order for this cable')}
      <div class="del-row">
        <button class="btn ghost small" data-goto-node="${l.a}">Go to ${esc(na ? na.tag : 'A')}</button>
        <button class="btn ghost small" data-goto-node="${l.b}">Go to ${esc(nb ? nb.tag : 'B')}</button>
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
            <td class="where">${r.jump ? `<button class="linkbtn" data-jump="${i}" title="Show on the diagram">${esc(r.forLabel)}</button>` : esc(r.forLabel)}${orderScope === 'all' ? `<div class="loopname">${esc(r.loopLabel)}</div>` : ''}</td>
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
  function toast(msg, undo) {
    const t = $('toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button id="undoBtn">Undo</button>' : ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, undo ? 7000 : 3500);
    if (undo) $('undoBtn').onclick = () => {
      if (undoSnapshot) { state = JSON.parse(undoSnapshot); undoSnapshot = null; sel = null; typeDraft = null; renderPalette(); renderAll(); save(); }
      t.hidden = true;
    };
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
  function updateView() {
    $('world').style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
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
    if (!loop.nodes.length) { zoom = 1; panX = 40; panY = 40; updateView(); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    loop.nodes.forEach(n => { const s = sizes[n.id] || { w: NODE_W, h: 80 }; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + s.w); y1 = Math.max(y1, n.y + s.h); });
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
    renderDiagram(); save();
    toast('Loop mirrored left ↔ right.', true);
  }
  const snap = v => Math.round(v / GRID) * GRID;
  const clampX = x => x; // endless sheet: no edges
  const clampY = y => y;

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
  function readClip() {
    try { const c = JSON.parse(localStorage.getItem(CLIP_KEY)); if (c && Array.isArray(c.nodes)) return c; } catch (e) { /* ignore */ }
    return clipMem;
  }
  function copySelection(quiet) {
    const loop = cur();
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
      if (!keep) resetStatuses(n);
      return n;
    });
    nodes.forEach(n => { n.inside = n.inside && map[n.inside] ? map[n.inside] : null; });
    // a pasted item dropped inside an enclosure's dashed zone is mounted in that enclosure
    const zones = loop.nodes.filter(e => isEnclosure(e.type)).map(e => {
      const kids = loop.nodes.filter(k => k.inside === e.id);
      let zx0 = Infinity, zy0 = Infinity, zx1 = -Infinity, zy1 = -Infinity;
      [e].concat(kids).forEach(k => { const c = center(k); zx0 = Math.min(zx0, k.x); zy0 = Math.min(zy0, k.y); zx1 = Math.max(zx1, k.x + c.w); zy1 = Math.max(zy1, k.y + c.h); });
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
      l.tag = freeTag(src.tag, used);
      if (!keep) resetStatuses(l);
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
    delete c.id; delete c.a; delete c.b; delete c.tag;
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
    const encl = e.target.closest('[data-encl]');
    if (encl && !nodeEl) { // dashed outline / label: move the enclosure with everything inside
      e.preventDefault();
      const enc = nodeById(loop, encl.dataset.encl);
      const w = toWorld(e.clientX, e.clientY);
      const movers = loop.nodes.filter(k => k.id === enc.id || k.inside === enc.id).map(k => ({ k, x: k.x, y: k.y, el: document.querySelector(`.node[data-id="${k.id}"]`) }));
      drag = { mode: 'node', id: enc.id, dx: w.x - enc.x, dy: w.y - enc.y, x0: enc.x, y0: enc.y, movers, sx: e.clientX, sy: e.clientY, moved: false };
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
      drag = { mode: 'box', wx: w.x, wy: w.y, sx: e.clientX, sy: e.clientY, moved: false, add: e.shiftKey || e.ctrlKey || e.metaKey, base: selectedIds(), hits: [] };
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
    drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY, moved: false };
  }
  function onPointerMove(e) {
    if (e.pointerType === 'mouse') {
      const r = $('viewport').getBoundingClientRect();
      pointerWorld = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom ? toWorld(e.clientX, e.clientY) : null;
    }
    if (touches.has(e.pointerId) && (!drag || drag.mode !== 'pinch')) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!drag) return;
    const loop = cur();
    if (drag.mode === 'palette') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        const g = document.createElement('div');
        g.className = 'node dragging';
        g.style.cssText = 'position:fixed;z-index:30;pointer-events:none;width:' + NODE_W + 'px';
        g.innerHTML = `<div class="node-top">${symHTML(drag.type, T(drag.type).tag)}<div class="node-title"><b>${esc(T(drag.type).name)}</b></div></div>`;
        document.body.appendChild(g);
        drag.ghost = g;
      }
      if (drag.ghost) { drag.ghost.style.left = (e.clientX - NODE_W / 2) + 'px'; drag.ghost.style.top = (e.clientY - 25) + 'px'; }
    } else if (drag.mode === 'node') {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      const ddx = snap(w.x - drag.dx) - drag.x0, ddy = snap(w.y - drag.dy) - drag.y0;
      drag.movers.forEach(c => {
        c.k.x = clampX(c.x + ddx); c.k.y = clampY(c.y + ddy);
        if (c.el) { c.el.style.left = c.k.x + 'px'; c.el.style.top = c.k.y + 'px'; c.el.classList.add('dragging'); }
      });
      drawWires();
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
      drag.hits = loop.nodes.filter(n => {
        const c = center(n);
        return crossing
          ? n.x < x1 && n.x + c.w > x0 && n.y < y1 && n.y + c.h > y0
          : n.x >= x0 && n.x + c.w <= x1 && n.y >= y0 && n.y + c.h <= y1;
      }).map(n => n.id);
      const on = new Set(drag.add ? drag.base.concat(drag.hits) : drag.hits);
      document.querySelectorAll('.node').forEach(el => el.classList.toggle('sel', on.has(el.dataset.id)));
    } else if (drag.mode === 'link') {
      const from = nodeById(loop, drag.from);
      const c = center(from);
      const w = toWorld(e.clientX, e.clientY);
      const p = { x: w.x >= c.x ? from.x + c.w : from.x, y: c.y };
      const mx = (p.x + w.x) / 2;
      const tw = $('tempWire');
      tw.style.display = '';
      tw.setAttribute('d', `M${p.x},${p.y} H${mx} V${w.y} H${w.x}`);
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const t = under && under.closest('.node');
      const tid = t && t.dataset.id !== drag.from ? t.dataset.id : null;
      if (tid !== drag.target) {
        document.querySelectorAll('.node.target').forEach(x => x.classList.remove('target'));
        if (tid) t.classList.add('target');
        drag.target = tid;
      }
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
        // tap / click: drop it in the middle of the visible sheet, nudged so repeats don't stack
        const vp = $('viewport'), r = vp.getBoundingClientRect();
        const w = toWorld(r.left + vp.clientWidth / 2, r.top + vp.clientHeight / 2);
        const k = loop.nodes.length % 5;
        addNode(d.type, w.x + k * 30 - 60, w.y + k * 30 - 60);
      }
    } else if (d.mode === 'node') {
      if (d.moved) { save(); renderDiagram(); }
      else setSelection([d.id]);
    } else if (d.mode === 'toggle') {
      const ids = selectedIds();
      setSelection(ids.includes(d.id) ? ids.filter(x => x !== d.id) : ids.concat(d.id));
    } else if (d.mode === 'box') {
      const box = $('selBox'); if (box) box.remove();
      if (d.moved) setSelection(d.add ? d.base.concat(d.hits) : d.hits);
      else if (sel) select(null);
    } else if (d.mode === 'link') {
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
      if (!d.moved && sel && !d.keepSel) select(null);
    }
  }
  function onPointerCancel(e) {
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
    if (t.id === 'keepStatus') { if (e.type === 'change') { setKeepPref(t.checked); toast(t.checked ? 'Copies will keep their order statuses.' : 'Copies will start as To order.'); } return; }
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
  function deleteSelected() {
    const loop = cur();
    if (!sel || !['node', 'link', 'multi'].includes(sel.kind)) return;
    snapshot();
    if (sel.kind === 'multi') {
      const ids = new Set(selNodes);
      loop.nodes = loop.nodes.filter(x => !ids.has(x.id));
      const before = loop.links.length;
      loop.links = loop.links.filter(l => !ids.has(l.a) && !ids.has(l.b));
      loop.nodes.forEach(x => { if (ids.has(x.inside)) x.inside = null; });
      const nl = before - loop.links.length;
      toast(`Deleted ${ids.size} items${nl ? ` and ${nl} cable${nl > 1 ? 's' : ''}` : ''}.`, true);
    } else if (sel.kind === 'node') {
      const n = nodeById(loop, sel.id);
      const nl = loop.links.filter(l => l.a === n.id || l.b === n.id).length;
      loop.nodes = loop.nodes.filter(x => x.id !== n.id);
      loop.links = loop.links.filter(l => l.a !== n.id && l.b !== n.id);
      loop.nodes.forEach(x => { if (x.inside === n.id) x.inside = null; });
      toast(`Deleted ${n.tag}${nl ? ` and ${nl} cable${nl > 1 ? 's' : ''}` : ''}.`, true);
    } else {
      const l = linkById(loop, sel.id);
      loop.links = loop.links.filter(x => x.id !== l.id);
      toast(`Deleted cable ${l.tag}.`, true);
    }
    sel = null; selNodes = new Set();
    renderAll(); save();
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
    renderPalette();
    renderAll();
    updateView();
    requestAnimationFrame(fit);

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
    window.addEventListener('resize', updateView);
    // Resizable side panels: drag the borders, double-click to reset; widths are remembered.
    const PANEL_KEY = 'loop-planner-panels';
    const diag = $('viewDiagram');
    let panels = {};
    try { panels = JSON.parse(localStorage.getItem(PANEL_KEY)) || {}; } catch (e) { panels = {}; }
    const applyPanels = () => {
      ['pal', 'insp'].forEach(k => { if (panels[k]) diag.style.setProperty(`--${k}-w`, panels[k] + 'px'); else diag.style.removeProperty(`--${k}-w`); });
      updateView();
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
          panels[k] = Math.round(Math.min(max, Math.max(k === 'pal' ? 120 : 240, w)));
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
      if (e.key === ' ' && view === 'diagram') { e.preventDefault(); if (!spaceDown) { spaceDown = true; $('viewport').classList.add('panning'); } return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && view === 'diagram') { e.preventDefault(); deleteSelected(); }
      if (e.key === 'Escape' && cablePick) { stopCablePick(); toast('Done placing cables.'); return; }
      if (e.key === 'Escape' && sel) select(null);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && view === 'diagram') { e.preventDefault(); setSelection(cur().nodes.map(n => n.id)); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && view === 'diagram') {
        const k = e.key.toLowerCase();
        if (k === 'c') { e.preventDefault(); copySelection(); }
        else if (k === 'x') { e.preventDefault(); cutSelection(); }
        else if (k === 'v') { e.preventDefault(); pasteAtPointer(); }
        else if (k === 'd') { e.preventDefault(); duplicateSelection(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v' && view === 'diagram') { e.preventDefault(); pasteAtPointer(true); }
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key] && selectedIds().length && view === 'diagram') {
        e.preventDefault();
        const step = e.shiftKey ? GRID * 5 : GRID;
        nudge(arrows[e.key][0] * step, arrows[e.key][1] * step);
      }
    });
    document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; $('viewport').classList.remove('panning'); } });
    window.addEventListener('blur', () => { spaceDown = false; $('viewport').classList.remove('panning'); });
    $('viewport').addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

    $('tabDiagram').onclick = () => setView('diagram');
    $('tabOrders').onclick = () => setView('orders');

    $('loopSelect').onchange = e => switchLoop(e.target.value);
    $('loopName').oninput = e => { cur().name = e.target.value; renderLoopBar(); if (!sel) { const h = document.querySelector('.inspector h2'); if (h) h.textContent = e.target.value; } save(); };
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
    $('btnExport').onclick = () => {
      const text = JSON.stringify(state, null, 2);
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
        state = data;
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
    const dq = N('plc', 'DO-06', 'DO card, rack 1 slot 6', 80, 440);
    const x10 = N('tb', 'X10', 'Marshalling, CP-01', 440, 280);
    const psu = N('psu', 'PSU-01', '24 VDC loop supply', 440, 560);
    const jb = N('jb', 'JB-01', 'Pump skid JB', 820, 280);
    const ca = N('u_camp', 'CA-103', 'Charge amplifier', 820, 480);
    ca.inside = jb.id;
    const pt = N('tx', 'PT-101', 'Pump discharge pressure', 1220, 120);
    const xv = N('valve', 'XV-102', 'Recirculation valve', 1220, 330);
    const hs = N('u_hall', 'HS-103', 'Pump speed pickup', 1220, 540);
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
