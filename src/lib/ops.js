import Kit from './kit.js';

const R = Kit.rng(20260827);

/* ── demo operators signing kit in / out ── */
export const OPS = ['R. Callahan', 'J. Mbeki', 'T. Aoyama', 'L. Ferreira', 'D. Novak', 'S. Whitfield'];

export const ST_LBL = { rack: 'In rack', out: 'Deployed', check: 'AI check', hold: 'Hold' };

/* ── categories ── */
export const CATS = [
  { key: 'Rifles',   blurb: 'Individual weapons · rack A', photo: '/icons/photo-rifle.png' },
  { key: 'Sidearms', blurb: 'Secondary weapons · rack A', photo: null },
  { key: 'Clothing', blurb: 'Uniform & field wear · rack D', photo: '/icons/photo-clothing.png' },
  { key: 'Armour',   blurb: 'Body armour & headgear · rack B', photo: '/icons/photo-kit.png' },
  { key: 'Optics',   blurb: 'Sights & night vision · cage C', photo: null },
  { key: 'Comms',    blurb: 'Radios & signals · cage C', photo: null },
  { key: 'Medical',  blurb: 'First-line med kit · rack D', photo: null },
  { key: 'Load',     blurb: 'Carriage & bergens · rack D', photo: null },
  { key: 'Stores',   blurb: 'Transit & consumables · cage E', photo: null },
];

/* [cat, name, type, icon, serial, extra] */
const DEFS = [
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56×45', 'rifle',   'L85-021447', {}],
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56×45', 'rifle',   'L85-021452', {}],
  ['Rifles',   'L85A3 Service Carbine',    'Firearm · 5.56×45', 'rifle',   'L85-021468', {}],
  ['Sidearms', 'L131A1 Duty Sidearm',      'Firearm · 9mm',     'sidearm', 'L131-00913', {}],
  ['Sidearms', 'L131A1 Duty Sidearm',      'Firearm · 9mm',     'sidearm', 'L131-00927', {}],
  ['Clothing', 'MTP Combat Shirt',         'Uniform · UBACS',   'shirt',   'CLO-5510',   { size: 'M / 180/100' }],
  ['Clothing', 'Cold-Weather Smock',       'Uniform · MVP',     'smock',   'CLO-5544',   { size: 'L / 190/110' }],
  ['Clothing', 'Combat Boots (pair)',      'Footwear',          'boots',   'CLO-5602',   { size: 'UK 9' }],
  ['Armour',   'Sentinel Plate Carrier',   'Armour · IIIA',     'plate',   'SPC-33018',  {}],
  ['Armour',   'BH-2 Ballistic Helmet',    'Headgear',          'helmet',  'BH2-77102',  {}],
  ['Optics',   'NVG-31 Night Vision',      'Optics · Gen3',     'nvg',     'NVG-55610',  {}],
  ['Optics',   'T-6 Optic 1–6×',           'Optics',            'optic',   'T6-44789',   {}],
  ['Comms',    'RF-40 Field Radio',        'Comms · UHF',       'radio',   'RF40-2217',  {}],
  ['Medical',  'IFAK Med Pouch',           'Medical',           'medkit',  'IFK-09043',  {}],
  ['Load',     'PTR-35 Patrol Ruck',       'Load carriage',     'ruck',    'PTR-61120',  {}],
  ['Stores',   'Ammo Transit Crate',       'Stores',            'crate',   'ATC-00771',  {}],
];

const CAT_PHOTO = Object.fromEntries(CATS.map(c => [c.key, c.photo]));

export const items = DEFS.map(([cat, name, type, icon, serial, extra], i) => {
  const it = {
    slot: 'S-' + String(i + 1).padStart(2, '0'), id: 'ARM-' + (101 + i),
    cat, name, type, icon, serial, extra,
    photo: CAT_PHOTO[cat],
    st: R() < .3 ? 'out' : 'rack',
    cond: Math.round(88 + R() * 11),
    svc: Math.round(40 + R() * 900),
    lastChk: `0${Math.floor(6 + R() * 3)}:${String(Math.floor(R() * 60)).padStart(2, '0')}`,
    cust: null,
  };
  if (it.st === 'out') it.cust = OPS[Math.floor(R() * OPS.length)];
  return it;
});

/* ── issue registry: structured defect records from AI checks ── */
export const DEFECTS = [
  { type: 'Tear / hole',    loc: ['left sleeve seam', 'front panel', 'lower hem', 'shoulder yoke'],       sev: 'High' },
  { type: 'Surface scuff',  loc: ['handguard rail', 'stock polymer', 'magazine well'],                  sev: 'Low' },
  { type: 'Scratch',        loc: ['optic lens housing', 'receiver finish', 'helmet shell'],             sev: 'Medium' },
  { type: 'Strap fray',     loc: ['stitch line · right strap', 'buckle webbing', 'drag handle'],        sev: 'Medium' },
  { type: 'Serial plate',   loc: ['partially obscured', 'corrosion on etching'],                        sev: 'High' },
  { type: 'Corrosion',      loc: ['exposed fastener', 'rail interface', 'zip puller'],                  sev: 'Medium' },
];
let isN = 500;
export function newIssue(item, ai, dir, by) {
  const d = DEFECTS[Math.floor(Math.random() * DEFECTS.length)];
  return {
    id: 'ISS-' + (++isN), itemId: item.id, slot: item.slot, name: item.name, icon: item.icon,
    type: d.type, loc: d.loc[Math.floor(Math.random() * d.loc.length)], sev: d.sev,
    score: ai.score, note: ai.note, shots: ai.shots, dir, by,
    t: new Date().toTimeString().slice(0, 8),
    st: 'Open',
  };
}
export const issues = [];

/* ── movement queue (deploy / retrieve requests) ── */
export const STAGES = ['Requested', 'AI Check', 'Cleared', 'Logged'];
let rqN = 1040;

/* ── browser-local persistence (demo-grade, per-browser only) ── */
const LS_KEY = 'sentinel-armory-v1';
export function saveState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      items: items.map(i => ({ id: i.id, st: i.st, cond: i.cond, cust: i.cust, lastChk: i.lastChk })),
      vitals: { outsToday: VITALS.outsToday, insToday: VITALS.insToday, aiPass: VITALS.aiPass, aiFlag: VITALS.aiFlag },
      issues, rqN,
    }));
  } catch { /* storage unavailable — demo continues without persistence */ }
}
export function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    for (const snap of s.items || []) {
      const it = items.find(x => x.id === snap.id);
      if (it && ST_LBL[snap.st]) Object.assign(it, snap);
    }
    if (s.vitals) Object.assign(VITALS, s.vitals);
    if (Array.isArray(s.issues)) { issues.length = 0; s.issues.forEach(x => issues.push(x)); }
    if (s.rqN) rqN = s.rqN;
  } catch { /* corrupt store — start fresh */ }
}

/* ── movement queue helpers ── */
export function newReq(item, dir, by, auto) {
  return {
    id: 'RQ-' + (++rqN), itemId: item.id, slot: item.slot, name: item.name,
    dir, by, st: 'Requested', auto: !!auto,
    t: new Date().toTimeString().slice(0, 8),
    ai: null,
  };
}
export const requests = [];
/* seed three past requests already logged */
for (let i = 0; i < 3; i++) {
  const it = items[i * 4];
  const rq = newReq(it, i % 2 ? 'OUT' : 'IN', OPS[Math.floor(R() * OPS.length)], true);
  rq.st = 'Logged';
  rq.ai = { score: Math.round(90 + R() * 9), serial: it.serial, verdict: 'PASS', note: 'Condition nominal', shots: 2 };
  requests.unshift(rq);
}

/* ── vitals counters (mutated live by the app) ── */
export const VITALS = {
  outsToday: 14, insToday: 11, aiPass: 23, aiFlag: 2,
  passRate: () => VITALS.aiPass / (VITALS.aiPass + VITALS.aiFlag) * 100,
  openReqs: () => requests.filter(r => r.st !== 'Logged').length,
  deployed: () => items.filter(i => i.st === 'out').length,
  inRack: () => items.filter(i => i.st === 'rack').length,
};

export function blocks(pc, n = 14) {
  const on = Math.round(Math.min(100, pc) / 100 * n);
  return `<span>${'█'.repeat(on)}</span><span class="off">${'█'.repeat(n - on)}</span>`;
}
export function hex(n) { return '0x' + n.toString(16).toUpperCase().padStart(6, '0'); }

/* ── opening transaction-log rows (seeded, must draw from R in order) ── */
const ACTS = [['RETRIEVE_IN', 'ok'], ['AI_PASS', 'ok'], ['DEPLOY_OUT', 'ok'], ['SLOT_SYNC', 'ok'],
  ['AI_FLAG', 'warn'], ['REQ_CREATE', 'ok'], ['COND_WARN', 'warn'], ['AUTH_OK', 'ok']];
export const SEED_LOG = Array.from({ length: 14 }, (_, i) => {
  const [a, lv] = ACTS[Math.floor(R() * ACTS.length)];
  return {
    t: new Date(Date.now() - (14 - i) * 47000).toTimeString().slice(0, 8),
    pid: 'PID_' + (1000 + Math.floor(R() * 9000)),
    act: a + ' · S-' + String(1 + Math.floor(R() * 16)).padStart(2, '0'),
    cd: hex(Math.floor(R() * 0xFFFFF)), lv,
  };
});

/* one pre-seeded issue so the flag trail is visible from first load */
const seedIt = items[7];
const seedIssue = {
  id: 'ISS-501', itemId: seedIt.id, slot: seedIt.slot, name: seedIt.name, icon: seedIt.icon,
  type: 'Tear / hole', loc: 'lower hem', sev: 'High', score: 71,
  note: 'Tear / hole at lower hem', shots: 2, dir: 'IN', by: 'J. Mbeki',
  t: new Date(Date.now() - 3600000).toTimeString().slice(0, 8), st: 'Open',
};
issues.unshift(seedIssue);
seedIt.st = 'hold';
/* …and the movement request that raised it, so the queue has a flagged row
   to click from first paint */
{
  const rq = newReq(seedIt, 'IN', seedIssue.by, true);
  rq.st = 'Logged'; rq.t = seedIssue.t;
  rq.ai = { score: seedIssue.score, serial: seedIt.serial, verdict: 'FLAG', note: seedIssue.note, shots: 2 };
  requests.unshift(rq);
}

/* …and a matching transaction-log row, clickable into the same issue record */
SEED_LOG.push({
  t: seedIssue.t, pid: 'PID_5001',
  act: 'AI_FLAG · ' + seedIt.slot + ' · ' + seedIssue.score + '/100 · ' + seedIssue.id,
  cd: hex(0x4A1F), lv: 'warn', issueId: seedIssue.id,
});

export { R };
