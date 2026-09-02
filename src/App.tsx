import { useEffect, useMemo, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import {
  CATS, CLS_SHORT, OPS, SEED_LOG, STAFF, ST_LBL, VITALS, asset, hhmm, hex,
  isDueToday, isOverdue, isStale, items, issues, lastNote, loadState,
  newIssue, newReq, readiness, requests, saveState, applyMove, applyStaffClass,
} from './lib/ops.js'
import AiScan, { ScanResult, ScanTarget } from './components/AiScan'
import Catalog from './components/Catalog'
import IssueDetail from './components/IssueDetail'
import ItemDrawer from './components/ItemDrawer'

type Cls = 'good' | 'flagged' | 'ooa'
interface Item {
  slot: string; id: string; cat: string; name: string; type: string; icon: string | null
  photo: string | null; serial: string; extra: Record<string, string>
  st: string; cls: Cls; flags: string[]; svc: number; lastChk: string; cust: string | null
  outAt: string | null; dueAt: string | null; photoAt: string
  notes: { t: string; by: string; text: string }[]
  gradeHist: { t: string; cls: Cls; by: string; source: string; prev?: Cls }[]
  moves: { t: string; dir: 'OUT' | 'IN'; by: string; signed: string; photo: { src: string; kind: string; at: string } | null; note: string; cls: Cls }[]
  pending: { cls: Cls; tags: string[]; note: string; dir: 'OUT' | 'IN'; at: string; shots?: number; apply?: boolean } | null
}
interface Issue {
  id: string; itemId: string; slot: string; name: string; icon: string | null
  type: string; loc: string; sev: string; cls: Cls; tags: string[]; note: string
  shots: number; dir: 'OUT' | 'IN'; by: string; t: string; st: string
}
interface Row { t: string; pid: string; act: string; cd: string; lv: string; issueId?: string }

const clock = () => new Date().toTimeString().slice(0, 8)

loadState()

export default function App() {
  const [sel, setSel] = useState<Item | null>(null)
  const [logs, setLogs] = useState<Row[]>(SEED_LOG)
  const [now, setNow] = useState(clock)
  const [scan, setScan] = useState<{ item: Item; dir: 'OUT' | 'IN'; by: string } | null>(null)
  const [view, setView] = useState<'ops' | 'catalog'>('ops')
  const [issueSel, setIssueSel] = useState<Issue | null>(null)
  const [q, setQ] = useState('')
  const [, force] = useState(0)
  const redraw = () => force(n => n + 1)
  const themeSlot = useRef<HTMLSpanElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  useEffect(() => { Kit.themeToggle(() => {}, themeSlot.current) }, [])
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), 1000)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); scanRef.current?.focus()
      }
      if (e.key === 'Escape') setSel(null)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const addLog = (act: string, lv: string, issueId?: string) => setLogs(ls => [{
    t: clock(), pid: 'PID_' + (1000 + Math.floor(Math.random() * 9000)),
    act, cd: hex(Math.floor(Math.random() * 0xFFFFF)), lv, issueId,
  }, ...ls].slice(0, 42))

  const openScan = (it: Item, dir: 'OUT' | 'IN') => {
    if (it.st === 'hold' || it.pending) return
    setScan({ item: it, dir, by: it.cust || OPS[0] })
    addLog((dir === 'OUT' ? 'TAKE_OUT' : 'RETURN_IN') + ' · ' + it.slot + ' · check', 'ok')
    redraw()
  }
  const closeScan = (r: ScanResult | null) => {
    if (!scan) return
    const it = items.find((i: Item) => i.id === scan.item.id)!
    if (r) {
      const rq: { ai: ScanResult | null; st: string } = newReq(it, scan.dir, scan.by, false)
      rq.ai = r; rq.st = 'Logged'
      requests.unshift(rq); if (requests.length > 12) requests.pop()
      it.pending = { cls: r.cls, tags: r.tags, note: r.note, dir: scan.dir, at: new Date().toISOString(), shots: r.shots, apply: true }
      addLog('AI_PROPOSE · ' + it.slot + ' · ' + CLS_SHORT[r.cls] + (r.tags[0] ? ' · ' + r.tags[0] : ''), 'warn')
      Kit.toast('AI proposed ' + CLS_SHORT[r.cls] + ' — confirm or override')
      setSel(it)
    } else {
      addLog('CHECK_ABORT · ' + it.slot, 'warn')
    }
    setScan(null); saveState(); redraw()
  }

  const commitMove = (it: Item, cls: Cls, dir: 'OUT' | 'IN') => {
    const by = dir === 'OUT' ? (it.cust || OPS[0]) : (it.cust || STAFF)
    applyMove(it, dir, by, cls)
    if (cls === 'ooa' || cls === 'flagged') {
      const iss = newIssue(it, { cls, tags: it.flags, note: lastNote(it)?.text || '', shots: 2 }, dir, STAFF) as Issue
      issues.unshift(iss)
      addLog((cls === 'ooa' ? 'OOA' : 'FLAG') + ' · ' + it.slot + ' · ' + iss.id, 'warn', iss.id)
    } else {
      addLog((dir === 'OUT' ? 'TAKE_OUT' : 'RETURN_IN') + ' · ' + it.slot + ' · ' + CLS_SHORT[cls] + ' · ' + STAFF, 'ok')
    }
  }

  const settle = (it: Item, cls: Cls, tags: string[], note: string, source: string) => {
    const pendingDir = it.pending?.dir
    const apply = !!(it.pending as { apply?: boolean } | null)?.apply && pendingDir
    applyStaffClass(it, cls, tags, note, source)
    if (apply && pendingDir) commitMove(it, cls, pendingDir)
    saveState(); redraw()
    Kit.toast((source === 'ai-override' ? 'Override ' : 'Confirmed ') + CLS_SHORT[cls] + ' · ' + STAFF)
  }
  const onConfirm = (it: Item) => {
    if (!it.pending) return
    settle(it, it.pending.cls, it.pending.tags, it.pending.note, 'ai-confirmed')
  }
  const onOverride = (it: Item, cls: Cls) => {
    const note = 'Override from ' + CLS_SHORT[it.pending?.cls || it.cls] + ' to ' + CLS_SHORT[cls]
    settle(it, cls, cls === 'good' ? [] : (it.pending?.tags || it.flags), note, 'ai-override')
  }

  const issueAction = (action: 'return-rack' | 'work-order' | 'deploy-anyway', iss: Issue) => {
    const it = items.find((i: Item) => i.id === iss.itemId)
    if (action === 'return-rack' && it) {
      it.st = 'rack'; it.cust = null; it.outAt = null; it.dueAt = null; iss.st = 'Resolved'
      if (it.cls === 'ooa') it.cls = 'flagged'
      addLog('HOLD_CLEAR · ' + it.slot + ' · ' + STAFF, 'ok')
    } else if (action === 'work-order') {
      iss.st = 'Work order raised'
      addLog('WO_RAISE · ' + iss.id, 'warn', iss.id)
    } else if (action === 'deploy-anyway' && it) {
      applyStaffClass(it, 'flagged', it.flags, 'Issued despite OOA record', 'ai-override')
      applyMove(it, 'OUT', STAFF, 'flagged')
      iss.st = 'Overridden'
      addLog('TAKE_OUT · ' + it.slot + ' · override · ' + STAFF, 'warn', iss.id)
    }
    saveState(); setIssueSel(null); redraw()
  }
  const openIssue = (id?: string) => {
    if (!id) return
    const iss = (issues as Issue[]).find(x => x.id === id)
    if (iss) setIssueSel(iss)
  }

  const needle = q.trim().toLowerCase()
  const match = (it: Item) => {
    if (!needle) return true
    const serial = String(it.serial).toLowerCase()
    const last = serial.slice(-4)
    return serial.includes(needle) || last.includes(needle) || it.name.toLowerCase().includes(needle)
      || it.id.toLowerCase().includes(needle) || it.slot.toLowerCase().includes(needle)
      || (it.cust || '').toLowerCase().includes(needle)
  }
  const tracked = items.filter((i: Item) => i.icon) as Item[]
  const shown = tracked.filter(match)

  const cols = useMemo(() => ({
    out: shown.filter(i => i.st === 'out'),
    due: shown.filter(i => i.st === 'out' && isDueToday(i.dueAt)),
    flagged: shown.filter(i => i.cls === 'flagged'),
    ooa: shown.filter(i => i.cls === 'ooa'),
  }), [shown, now]) // now so overdue labels tick

  const counts = {
    out: tracked.filter(i => i.st === 'out').length,
    due: tracked.filter(i => i.st === 'out' && isDueToday(i.dueAt)).length,
    flagged: tracked.filter(i => i.cls === 'flagged').length,
    ooa: tracked.filter(i => i.cls === 'ooa').length,
  }

  return (
    <>
      <header>
        <div className="topbar">
          <div className="ascii">
            <div className="lg">Sentinel Armory</div>
            <div className="sub">QM desk · Vault B · Cage 3</div>
          </div>
          <label className="scanbar">
            <span>Scan</span>
            <input ref={scanRef} type="search" autoComplete="off" spellCheck={false}
                   placeholder="Serial or last-4"
                   value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <div className="spacer" />
          <div className="btns">
            <div className="seg viewnav">
              <button className={view === 'ops' ? 'on' : ''} onClick={() => setView('ops')}>Board</button>
              <button className={view === 'catalog' ? 'on' : ''} onClick={() => setView('catalog')}>Stock</button>
            </div>
            <span id="theme-slot" ref={themeSlot} />
          </div>
        </div>
        <div className="sysline">
          <div>SESSION <b>RACK-TERM-01</b></div>
          <div>STAFF <b>{STAFF}</b></div>
          <div>OUT <b>{counts.out}</b></div>
          <div>DUE TODAY <b>{counts.due}</b></div>
          <div>FLAGGED <b>{counts.flagged}</b></div>
          <div>OOA <b>{counts.ooa}</b></div>
          <div>TIME <b id="clock">{now}</b></div>
        </div>
      </header>

      {view === 'catalog' ? (
        <div className="app catalogwrap">
          <Catalog items={items as Item[]} cats={CATS}
                   onAction={openScan as never}
                   onClearHold={((it: Item) => { it.st = 'rack'; it.cust = null; saveState(); redraw() }) as never}
                   onOpenIssue={openIssue}
                   onOpenItem={((it: Item) => { setView('ops'); setSel(it) }) as never} />
        </div>
      ) : (
      <div className="app board-app">
        <div className="board">
          <BoardCol title="Out now" n={needle ? cols.out.length : counts.out} items={cols.out} sel={sel} onPick={setSel} kind="out" />
          <BoardCol title="Due today" n={needle ? cols.due.length : counts.due} items={cols.due} sel={sel} onPick={setSel} kind="due" />
          <BoardCol title="Flagged" n={needle ? cols.flagged.length : counts.flagged} items={cols.flagged} sel={sel} onPick={setSel} kind="flagged" />
          <BoardCol title="OOA" n={needle ? cols.ooa.length : counts.ooa} items={cols.ooa} sel={sel} onPick={setSel} kind="ooa" />
        </div>
        <aside className="side">
          <section className="cell cctv-cell">
            <div className="ph"><h2>Cage 3</h2><span className="tail">CAM 03</span></div>
            <div className="cctv-wrap">
              <img className="cctv-still" src={asset('cage-cctv-still.png')} alt="CCTV still, Vault B cage 3" />
              <video src={asset('cage-cctv.mp4')} autoPlay muted loop playsInline
                     onError={e => { (e.target as HTMLVideoElement).style.display = 'none' }} />
              <div className="cctv-osd">
                <span>CAM 03</span>
                <span>{now}</span>
              </div>
            </div>
          </section>
          <section className="cell log-cell">
            <div className="ph"><h2>Log</h2></div>
            <div className="pb"><div className="log" id="log">
              {logs.slice(0, 14).map((r, i) => (
                <div className={'lr' + (r.lv === 'warn' ? ' warn' : '') + (r.issueId ? ' clickable' : '')}
                     key={r.cd + i}
                     onClick={() => openIssue(r.issueId)}>
                  <time>{r.t}</time>
                  <span className="act">{r.act}</span>
                </div>
              ))}
            </div></div>
          </section>
        </aside>
      </div>
      )}

      {sel && (
        <ItemDrawer
          item={sel}
          onClose={() => setSel(null)}
          onTakeOut={it => openScan(it, 'OUT')}
          onReturn={it => openScan(it, 'IN')}
          onConfirm={onConfirm}
          onOverride={onOverride}
          onOpenIssue={openIssue}
          issueIds={(issues as Issue[]).filter(x => x.itemId === sel.id && x.st === 'Open').map(x => x.id)}
        />
      )}
      {scan && <AiScan item={scan.item as ScanTarget} dir={scan.dir} onDone={closeScan} />}
      {issueSel && (
        <IssueDetail issue={issueSel as never}
                     item={items.find((i: Item) => i.id === issueSel.itemId) as never}
                     onClose={() => setIssueSel(null)}
                     onAction={issueAction as never} />
      )}
    </>
  )
}

function BoardCol({ title, n, items: rows, sel, onPick, kind }: {
  title: string; n: number; items: Item[]; sel: Item | null; onPick: (it: Item) => void; kind: string
}) {
  return (
    <section className={'col col-' + kind}>
      <div className="col-h">
        <h2>{title}</h2>
        <b>{n}</b>
      </div>
      <div className="col-b">
        {!rows.length && <div className="col-empty">None</div>}
        {rows.map(it => {
          const stale = isStale(it.photoAt)
          const rdy = readiness(it)
          const note = lastNote(it)
          return (
            <button type="button" key={it.id}
                    className={'brow' + (sel === it ? ' on' : '') + (rdy === 'stale' ? ' stale' : '')}
                    onClick={() => onPick(it)}>
              <span className="brow-id">
                {it.icon && <img src={asset('icons/' + it.icon + '.png')} alt="" />}
                <span>
                  <b>{it.name.replace(/^L85A3 /, '').replace(/^L131A1 /, '')}</b>
                  <i>{it.serial}</i>
                </span>
              </span>
              <span className="brow-meta">
                {kind === 'out' || kind === 'due'
                  ? <em>{hhmm(it.outAt)}{it.dueAt ? ' / ' + hhmm(it.dueAt) : ''}{isOverdue(it.dueAt) ? ' overdue' : ''}</em>
                  : <em>{it.cust || 'cage'}</em>}
                <span className={'cls-chip cls-' + it.cls + (stale ? ' stale' : '')}>
                  {stale ? 'Photo stale' : CLS_SHORT[it.cls]}
                </span>
              </span>
              {note && kind !== 'out' && <span className="brow-note">{note.text}</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

void ST_LBL
void VITALS
