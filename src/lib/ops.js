import Kit from './kit.js';

/**
 * QM ops store. Classes only: good | flagged | ooa.
 * AI proposes; staff confirm. Request/return logs live on the item with photos.
 */

const R = Kit.rng(20260902);

export const STAFF = 'Haylock, J.';
export const STALE_DAYS = 90;
export const CLS_LBL = { good: 'Good', flagged: 'Flagged', ooa: 'Out of service' };
export const CLS_SHORT = { good: 'Good', flagged: 'Flagged', ooa: 'OOA' };

export function asset(p) {
  const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  return base + String(p).replace(/^\//, '');
}

export const OPS = ['Callahan, R.', 'Mbeki, J.', 'Aoyama, T.', 'Ferreira, L.', 'Novak, D.', 'Whitfield, S.'];

export const ST_LBL = { rack: 'In rack', out: 'Out', check: 'Check', hold: 'Hold' };

export const CATS = [
  { key: 'Rifles',   blurb: 'Individual weapons · rack A', photo: 'icons/photo-rifle.png' },
  { key: 'Sidearms', blurb: 'Secondary weapons · rack A', photo: null },
  { key: 'Clothing', blurb: 'Uniform & field wear · rack D', photo: 'icons/photo-clothing.png' },
  { key: 'Armour',   blurb: 'Body armour & headgear · rack B', photo: 'icons/photo-kit.png' },
  { key: 'Optics',   blurb: 'Sights & night vision · cage C', photo: null },
  { key: 'Comms',    blurb: 'Radios & signals · cage C', photo: null },
  { key: 'Medical',  blurb: 'First-line med kit · rack D', photo: null },
  { key: 'Load',     blurb: 'Carriage & bergens · rack D', photo: null },
  { key: 'Stores',   blurb: 'Transit & consumables · cage E', photo: null },
];

/** @type {[string, string, string, string, string, Record<string, string>][]} */
const DEFS = [
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56x45', 'rifle',   'L85-021447', {}],
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56x45', 'rifle',   'L85-021452', {}],
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56x45', 'rifle',   'L85-021468', {}],
  ['Sidearms', 'L131A1 Duty Sidearm',      'Firearm · 9mm',     'sidearm', 'L131-00913', {}],
  ['Sidearms', 'L131A1 Duty Sidearm',      'Firearm · 9mm',     'sidearm', 'L131-00927', {}],
  ['Clothing', 'MTP Combat Shirt',         'Uniform · UBACS',   'shirt',   'CLO-5510',   { size: 'M / 180/100' }],
  ['Clothing', 'Cold-Weather Smock',       'Uniform · MVP',     'smock',   'CLO-5544',   { size: 'L / 190/110' }],
  ['Clothing', 'Combat Boots (pair)',      'Footwear',          'boots',   'CLO-5602',   { size: 'UK 9' }],
  ['Armour',   'Sentinel Plate Carrier',   'Armour · IIIA',     'plate',   'SPC-33018',  {}],
  ['Armour',   'BH-2 Ballistic Helmet',    'Headgear',          'helmet',  'BH2-77102',  {}],
  ['Optics',   'NVG-31 Night Vision',      'Optics · Gen3',     'nvg',     'NVG-55610',  {}],
  ['Optics',   'T-6 Optic 1-6x',           'Optics',            'optic',   'T6-44789',   {}],
  ['Comms',    'RF-40 Field Radio',        'Comms · UHF',       'radio',   'RF40-2217',  {}],
  ['Medical',  'IFAK Med Pouch',           'Medical',           'medkit',  'IFK-09043',  {}],
  ['Load',     'PTR-35 Patrol Ruck',       'Load carriage',     'ruck',    'PTR-61120',  {}],
  ['Stores',   'Ammo Transit Crate',       'Stores',            'crate',   'ATC-00771',  {}],
];

const CAT_PHOTO = Object.fromEntries(CATS.map(c => [c.key, c.photo]));

function todayAt(h, m) {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function daysAgoAt(days, h, m) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
function pad2(n) { return String(n).padStart(2, '0'); }
export function hhmm(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 5);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
export function isStale(iso, now = Date.now()) {
  if (!iso) return true;
  return (now - new Date(iso).getTime()) > STALE_DAYS * 86400000;
}
export function isDueToday(iso, now = new Date()) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
export function isOverdue(iso, now = Date.now()) {
  return !!(iso && new Date(iso).getTime() < now);
}
/** Ready = Good and photo not stale and not overdue. Stale greys readiness. */
export function readiness(it) {
  if (isStale(it.photoAt)) return 'stale';
  if (it.cls === 'ooa' || it.st === 'hold') return 'ooa';
  if (it.cls === 'flagged') return 'flagged';
  if (it.st === 'out' && isOverdue(it.dueAt)) return 'overdue';
  return 'ready';
}
export function last4(serial) {
  const s = String(serial || '');
  return s.slice(-4);
}

function photoOf(it, kind, at) {
  const src = it.photo || (it.icon ? 'icons/' + it.icon + '.png' : null);
  return src ? { src, kind, at } : null;
}

function mkMove(it, dir, by, t, cls, note) {
  return {
    t, dir, by, signed: STAFF,
    photo: photoOf(it, dir === 'OUT' ? 'take-out' : 'return', t),
    note: note || '',
    cls,
  };
}

const CAT_PHOTO_SRC = CAT_PHOTO;

/** @type {any[]} */
export const items = DEFS.map(([cat, name, type, icon, serial, extra], i) => {
  const it = {
    slot: 'S-' + String(i + 1).padStart(2, '0'),
    id: 'ARM-' + (101 + i),
    cat, name, type, icon, serial, extra,
    photo: CAT_PHOTO_SRC[cat],
    st: 'rack',
    cls: 'good',
    flags: [],
    svc: Math.round(40 + R() * 900),
    lastChk: hhmm(daysAgoAt(1, 8, 10)),
    cust: null,
    outAt: null,
    dueAt: null,
    photoAt: daysAgoAt(6 + Math.floor(R() * 20), 9, 0),
    notes: [],
    gradeHist: [],
    moves: [],
    pending: null,
  };
  return it;
});

/* ── seeded QM snapshot (locked demo, not random theatre) ── */

function seedCycle(it, { outs, ins, lastCls }) {
  const hist = [];
  const moves = [];
  let cls = 'good';
  // older return
  if (ins >= 2) {
    const t = daysAgoAt(18, 17, 40);
    moves.push(mkMove(it, 'IN', OPS[2], t, 'good', ''));
    hist.push({ t, cls: 'good', by: STAFF, source: 'staff' });
  }
  if (outs >= 1) {
    const t = daysAgoAt(ins >= 1 ? 4 : 2, 18, 10);
    moves.push(mkMove(it, 'OUT', OPS[3], t, cls, ''));
  }
  if (ins >= 1) {
    const t = daysAgoAt(1, 8, 12);
    cls = lastCls || 'good';
    moves.push(mkMove(it, 'IN', OPS[3], t, cls, cls === 'flagged' ? 'Minor fault logged on return' : 'Returned'));
    hist.push({ t, cls, by: STAFF, source: 'ai-confirmed' });
    it.photoAt = t;
  }
  it.moves = moves;
  it.gradeHist = hist.length ? hist : [{ t: daysAgoAt(20, 10, 0), cls: 'good', by: STAFF, source: 'staff' }];
  it.cls = cls;
}

/* 0 rifle — out 19:00, Kyle note, two consecutive Flagged, the click demo */
{
  const it = items[0];
  seedCycle(it, { outs: 1, ins: 2, lastCls: 'flagged' });
  const tOut = todayAt(19, 0);
  it.st = 'out';
  it.cls = 'flagged';
  it.flags = ['lever stiffness'];
  it.cust = 'Callahan, R.';
  it.outAt = tOut;
  it.dueAt = todayAt(22, 0);
  it.photoAt = tOut;
  it.lastChk = '19:00';
  it.moves.push(mkMove(it, 'OUT', 'Callahan, R.', tOut, 'flagged', 'Kyle said the lever was stiff.'));
  it.notes.push({ t: todayAt(19, 5), by: STAFF, text: 'Kyle said the lever was stiff.' });
  it.gradeHist.push({ t: tOut, cls: 'flagged', by: STAFF, source: 'ai-confirmed' });
}

/* 1 rifle — out, due today 16:00, Good */
{
  const it = items[1];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  const tOut = todayAt(8, 40);
  it.st = 'out';
  it.cls = 'good';
  it.cust = 'Mbeki, J.';
  it.outAt = tOut;
  it.dueAt = todayAt(16, 0);
  it.photoAt = tOut;
  it.lastChk = '08:40';
  it.moves.push(mkMove(it, 'OUT', 'Mbeki, J.', tOut, 'good', ''));
}

/* 2 rifle — in rack, Good, photo stale */
{
  const it = items[2];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
  it.photoAt = daysAgoAt(118, 11, 20);
  it.lastChk = hhmm(it.photoAt);
  it.notes.push({ t: daysAgoAt(118, 11, 25), by: STAFF, text: 'Last condition photo before summer leave. Recapture overdue.' });
}

/* 3 sidearm — out, due today */
{
  const it = items[3];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  const tOut = todayAt(9, 15);
  it.st = 'out';
  it.cls = 'good';
  it.cust = 'Aoyama, T.';
  it.outAt = tOut;
  it.dueAt = todayAt(17, 30);
  it.photoAt = tOut;
  it.lastChk = '09:15';
  it.moves.push(mkMove(it, 'OUT', 'Aoyama, T.', tOut, 'good', ''));
}

/* 4 sidearm — rack, Flagged */
{
  const it = items[4];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'flagged' });
  it.st = 'rack';
  it.cls = 'flagged';
  it.flags = ['surface scuff'];
  it.notes.push({ t: daysAgoAt(1, 8, 20), by: STAFF, text: 'Scuff on slide. Still serviceable.' });
}

/* 5 shirt — rack Good */
{
  const it = items[5];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
}

/* 6 smock — OOA, major tear */
{
  const it = items[6];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'ooa' });
  it.st = 'hold';
  it.cls = 'ooa';
  it.flags = ['tear / hole'];
  it.photoAt = daysAgoAt(2, 16, 4);
  it.lastChk = '16:04';
  it.notes.push({ t: daysAgoAt(2, 16, 10), by: STAFF, text: 'Tear at lower hem. Out of service until repair.' });
  it.gradeHist.push({ t: daysAgoAt(2, 16, 4), cls: 'ooa', by: STAFF, source: 'ai-override' });
}

/* 7 boots — OOA (was the old 71/100 seed) */
{
  const it = items[7];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'ooa' });
  it.st = 'hold';
  it.cls = 'ooa';
  it.flags = ['sole separation'];
  it.photoAt = daysAgoAt(1, 14, 0);
  it.notes.push({ t: daysAgoAt(1, 14, 8), by: 'Mbeki, J.', text: 'Sole starting to separate at the heel. Not for issue.' });
}

/* 8 plate — out overnight, Good */
{
  const it = items[8];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  const tOut = todayAt(18, 20);
  it.st = 'out';
  it.cls = 'good';
  it.cust = 'Novak, D.';
  it.outAt = tOut;
  it.dueAt = todayAt(23, 0);
  it.photoAt = tOut;
  it.lastChk = '18:20';
  it.moves.push(mkMove(it, 'OUT', 'Novak, D.', tOut, 'good', ''));
}

/* 9 helmet — rack Flagged */
{
  const it = items[9];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'flagged' });
  it.st = 'rack';
  it.cls = 'flagged';
  it.flags = ['shell scratch'];
  it.notes.push({ t: daysAgoAt(3, 10, 0), by: STAFF, text: 'Scratch on shell, no crack. Flagged only.' });
}

/* 10 NVG — out, due today */
{
  const it = items[10];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  const tOut = todayAt(7, 50);
  it.st = 'out';
  it.cls = 'good';
  it.cust = 'Whitfield, S.';
  it.outAt = tOut;
  it.dueAt = todayAt(15, 0);
  it.photoAt = tOut;
  it.lastChk = '07:50';
  it.moves.push(mkMove(it, 'OUT', 'Whitfield, S.', tOut, 'good', ''));
}

/* 11 optic — rack, pending AI proposal (staff gate demo) */
{
  const it = items[11];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
  it.photoAt = daysAgoAt(4, 12, 0);
  it.pending = {
    cls: 'flagged',
    tags: ['lens housing scratch'],
    note: 'Scratch on optic lens housing. Minor, no glass damage.',
    dir: 'IN',
    at: daysAgoAt(0, 13, 42),
    shots: 2,
  };
}

/* 12 radio — rack Good */
{
  const it = items[12];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
}

/* 13 medkit — rack Good */
{
  const it = items[13];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
}

/* 14 ruck — out */
{
  const it = items[14];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  const tOut = todayAt(12, 5);
  it.st = 'out';
  it.cls = 'good';
  it.cust = 'Ferreira, L.';
  it.outAt = tOut;
  it.dueAt = todayAt(21, 0);
  it.photoAt = tOut;
  it.lastChk = '12:05';
  it.moves.push(mkMove(it, 'OUT', 'Ferreira, L.', tOut, 'good', ''));
}

/* 15 crate — rack, stale photo */
{
  const it = items[15];
  seedCycle(it, { outs: 1, ins: 1, lastCls: 'good' });
  it.st = 'rack';
  it.cls = 'good';
  it.photoAt = daysAgoAt(140, 9, 0);
  it.lastChk = hhmm(it.photoAt);
}

/* remaining items that did not get a seedCycle — should be none */

export function relevantPhotos(it) {
  const outs = (it.moves || []).filter(m => m.dir === 'OUT' && m.photo);
  const ins = (it.moves || []).filter(m => m.dir === 'IN' && m.photo);
  const pack = (m, label) => {
    if (!m || !m.photo) return { src: null, kind: null, at: null, by: null, label };
    return { ...m.photo, label, by: m.by, at: m.photo.at || m.t };
  };
  const returning = it.st === 'out' || (it.st === 'check' && it.cust) || (it.st === 'hold' && it.cust);
  if (returning) {
    return [
      pack(outs.length >= 2 ? outs[outs.length - 2] : null, 'Last take-out'),
      pack(ins[ins.length - 1], 'Last return'),
      pack(outs[outs.length - 1], 'This take-out'),
    ];
  }
  return [
    pack(ins.length >= 2 ? ins[ins.length - 2] : ins[ins.length - 1], 'Last return'),
    pack(outs[outs.length - 1], 'Last take-out'),
    pack(ins[ins.length - 1], 'Last return'),
  ];
}

export function lastNote(it) {
  return (it.notes && it.notes.length) ? it.notes[it.notes.length - 1] : null;
}
export function lastHandover(it) {
  const mv = it.moves || [];
  return mv.length ? mv[mv.length - 1] : null;
}

export const DEFECTS = [
  { type: 'Tear / hole',    loc: ['left sleeve seam', 'front panel', 'lower hem', 'shoulder yoke'],       sev: 'major', tag: 'tear / hole' },
  { type: 'Surface scuff',  loc: ['handguard rail', 'stock polymer', 'magazine well'],                    sev: 'minor', tag: 'surface scuff' },
  { type: 'Scratch',        loc: ['optic lens housing', 'receiver finish', 'helmet shell'],               sev: 'minor', tag: 'scratch' },
  { type: 'Strap fray',     loc: ['stitch line, right strap', 'buckle webbing', 'drag handle'],           sev: 'minor', tag: 'strap fray' },
  { type: 'Serial plate',   loc: ['partially obscured', 'corrosion on etching'],                          sev: 'major', tag: 'serial plate' },
  { type: 'Corrosion',      loc: ['exposed fastener', 'rail interface', 'zip puller'],                    sev: 'minor', tag: 'corrosion' },
  { type: 'Lever stiffness',loc: ['cocking handle', 'change lever'],                                      sev: 'minor', tag: 'lever stiffness' },
];

function proposeFromDefect(d) {
  return d.sev === 'major' ? 'ooa' : 'flagged';
}

let isN = 500;
export function newIssue(item, ai, dir, by) {
  const d = DEFECTS.find(x => (ai.tags || []).includes(x.tag)) || DEFECTS[Math.floor(Math.random() * DEFECTS.length)];
  return {
    id: 'ISS-' + (++isN), itemId: item.id, slot: item.slot, name: item.name, icon: item.icon,
    type: d.type, loc: d.loc[Math.floor(Math.random() * d.loc.length)], sev: d.sev === 'major' ? 'Major' : 'Minor',
    cls: ai.cls, tags: ai.tags || [d.tag], note: ai.note, shots: ai.shots, dir, by,
    t: new Date().toTimeString().slice(0, 8),
    st: 'Open',
  };
}
export const issues = [];

export const STAGES = ['Requested', 'AI Check', 'Cleared', 'Logged'];
let rqN = 1040;

const LS_KEY = 'sentinel-armory-lab-qm-v1';
export function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      items: items.map(i => ({
        id: i.id, st: i.st, cls: i.cls, flags: i.flags, cust: i.cust, lastChk: i.lastChk,
        outAt: i.outAt, dueAt: i.dueAt, photoAt: i.photoAt, notes: i.notes, gradeHist: i.gradeHist,
        moves: i.moves, pending: i.pending,
      })),
      vitals: { outsToday: VITALS.outsToday, insToday: VITALS.insToday, aiPass: VITALS.aiPass, aiFlag: VITALS.aiFlag },
      issues, requests: requests.slice(0, 12), rqN,
    }));
  } catch { /* storage unavailable */ }
}
export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    for (const snap of s.items || []) {
      const it = items.find(x => x.id === snap.id);
      if (it && (!snap.st || ST_LBL[snap.st])) Object.assign(it, snap);
    }
    if (s.vitals) Object.assign(VITALS, s.vitals);
    if (Array.isArray(s.issues)) { issues.length = 0; s.issues.forEach(x => issues.push(x)); }
    if (Array.isArray(s.requests) && s.requests.length) { requests.length = 0; s.requests.forEach(x => requests.push(x)); }
    if (s.rqN) rqN = s.rqN;
  } catch { /* corrupt store */ }
}

export function newReq(item, dir, by, auto) {
  return {
    id: 'RQ-' + (++rqN), itemId: item.id, slot: item.slot, name: item.name,
    dir, by, st: 'Requested', auto: !!auto,
    t: new Date().toTimeString().slice(0, 8),
    ai: null,
  };
}
export const requests = [];

export const VITALS = {
  outsToday: 6, insToday: 4, aiPass: 8, aiFlag: 3,
  passRate: () => VITALS.aiPass / Math.max(1, VITALS.aiPass + VITALS.aiFlag) * 100,
  openReqs: () => requests.filter(r => r.st !== 'Logged').length,
  deployed: () => items.filter(i => i.st === 'out').length,
  inRack: () => items.filter(i => i.st === 'rack').length,
  outNow: () => items.filter(i => i.st === 'out').length,
  dueToday: () => items.filter(i => i.st === 'out' && isDueToday(i.dueAt)).length,
  flagged: () => items.filter(i => i.cls === 'flagged').length,
  ooa: () => items.filter(i => i.cls === 'ooa').length,
};

export function blocks(pc, n = 14) {
  const on = Math.round(Math.min(100, pc) / 100 * n);
  return '<span>' + '█'.repeat(on) + '</span><span class="off">' + '█'.repeat(n - on) + '</span>';
}
export function hex(n) { return '0x' + n.toString(16).toUpperCase().padStart(6, '0'); }

export function proposeClass(force) {
  if (force === 'good') return { cls: 'good', tags: [], note: 'No faults of note.' };
  if (force === 'flagged') {
    const d = DEFECTS.filter(x => x.sev === 'minor')[Math.floor(Math.random() * 4)];
    return { cls: 'flagged', tags: [d.tag], note: d.type + ' at ' + d.loc[0] + '.' };
  }
  if (force === 'ooa') {
    const d = DEFECTS.filter(x => x.sev === 'major')[0];
    return { cls: 'ooa', tags: [d.tag], note: d.type + ' at ' + d.loc[2] + '.' };
  }
  const roll = Math.random();
  if (roll < 0.08) return proposeClass('ooa');
  if (roll < 0.28) return proposeClass('flagged');
  return proposeClass('good');
}

export function applyStaffClass(it, cls, tags, note, source) {
  const prev = it.cls;
  it.cls = cls;
  it.flags = cls === 'good' ? [] : (tags || it.flags || []);
  it.gradeHist = it.gradeHist || [];
  it.gradeHist.push({ t: new Date().toISOString(), cls, by: STAFF, source, prev });
  if (note) it.notes.push({ t: new Date().toISOString(), by: STAFF, text: note });
  if (cls === 'ooa') it.st = 'hold';
  it.pending = null;
}

export function applyMove(it, dir, by, cls) {
  const t = new Date().toISOString();
  it.lastChk = hhmm(t);
  it.photoAt = t;
  const mv = mkMove(it, dir, by, t, cls, '');
  it.moves.push(mv);
  if (dir === 'OUT') {
    it.st = cls === 'ooa' ? 'hold' : 'out';
    it.cust = by;
    it.outAt = t;
    const due = new Date();
    due.setHours(due.getHours() + 4, 0, 0, 0);
    it.dueAt = due.toISOString();
    VITALS.outsToday++;
  } else {
    it.st = cls === 'ooa' ? 'hold' : 'rack';
    it.cust = null;
    it.outAt = null;
    it.dueAt = null;
    VITALS.insToday++;
  }
}

/* seed one issue for the OOA smock so history has a record */
{
  const seedIt = items[6];
  issues.unshift({
    id: 'ISS-501', itemId: seedIt.id, slot: seedIt.slot, name: seedIt.name, icon: seedIt.icon,
    type: 'Tear / hole', loc: 'lower hem', sev: 'Major', cls: 'ooa',
    tags: ['tear / hole'], note: 'Tear at lower hem. Out of service until repair.',
    shots: 2, dir: 'IN', by: 'Mbeki, J.',
    t: hhmm(daysAgoAt(2, 16, 4)), st: 'Open',
  });
  const rq = newReq(seedIt, 'IN', 'Mbeki, J.', true);
  rq.st = 'Logged'; rq.t = hhmm(daysAgoAt(2, 16, 4));
  rq.ai = { cls: 'ooa', tags: ['tear / hole'], serial: seedIt.serial, note: 'Tear at lower hem.', shots: 2 };
  requests.unshift(rq);
}

/* seed movement queue from latest item moves so the board is dense */
{
  const seen = new Set(requests.map(r => r.itemId + r.dir + r.st));
  const extra = [];
  for (const it of items) {
    const mv = (it.moves || []).slice(-1)[0];
    if (!mv) continue;
    const k = it.id + mv.dir + 'Logged';
    if (seen.has(k)) continue;
    extra.push({ it, mv });
  }
  extra.reverse();
  for (const { it, mv } of extra) {
    const rq = newReq(it, mv.dir, mv.by, true);
    rq.st = 'Logged';
    rq.t = hhmm(mv.t);
    rq.ai = { cls: mv.cls || it.cls, tags: it.flags || [], serial: it.serial, note: mv.note || '', shots: 2 };
    requests.unshift(rq);
  }
  /* two in-flight so the pipe is not a graveyard */
  const inflight = items.find(i => i.st === 'rack' && i.cls === 'good' && i.icon);
  if (inflight) {
    const a = newReq(inflight, 'OUT', OPS[1], true);
    a.st = 'Requested';
    requests.unshift(a);
  }
  const inflight2 = items.find(i => i.st === 'out' && i.cls === 'good');
  if (inflight2) {
    const b = newReq(inflight2, 'IN', inflight2.cust || OPS[0], true);
    b.st = 'AI Check';
    requests.unshift(b);
  }
  while (requests.length > 12) requests.pop();
}

const ACTS = [['RETURN_IN', 'ok'], ['TAKE_OUT', 'ok'], ['STAFF_OK', 'ok'], ['SLOT_SYNC', 'ok'],
  ['AI_PROPOSE', 'warn'], ['REQ_CREATE', 'ok'], ['PHOTO_STALE', 'warn'], ['AUTH_OK', 'ok']];
export const SEED_LOG = Array.from({ length: 10 }, (_, i) => {
  const [a, lv] = ACTS[Math.floor(R() * ACTS.length)];
  return {
    t: new Date(Date.now() - (10 - i) * 47000).toTimeString().slice(0, 8),
    pid: 'PID_' + (1000 + Math.floor(R() * 9000)),
    act: a + ' · S-' + String(1 + Math.floor(R() * 16)).padStart(2, '0'),
    cd: hex(Math.floor(R() * 0xFFFFF)), lv,
  };
});
SEED_LOG.push({
  t: '16:04', pid: 'PID_5001',
  act: 'OOA · ' + items[6].slot + ' · tear / hole · ISS-501',
  cd: hex(0x4A1F), lv: 'warn', issueId: 'ISS-501',
});

export { R, proposeFromDefect };
