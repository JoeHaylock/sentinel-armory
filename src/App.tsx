import { useEffect, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import {
  CATS, CLS_SHORT, OPS, SEED_LOG, STAFF, STAGES, ST_LBL, VITALS, asset, blocks, hex,
  isDueToday, isStale, items, issues, lastNote, loadState,
  newIssue, newReq, proposeClass, readiness, requests, saveState, applyMove, applyStaffClass,
} from './lib/ops.js'
import Chart from './components/Chart'
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
interface Req {
  id: string; itemId: string; slot: string; name: string; dir: 'OUT' | 'IN'
  by: string; st: string; auto: boolean; t: string; ai: ScanResult | null; t0?: number
}
interface Issue {
  id: string; itemId: string; slot: string; name: string; icon: string | null
  type: string; loc: string; sev: string; cls: Cls; tags: string[]; note: string
  shots: number; dir: 'OUT' | 'IN'; by: string; t: string; st: string
}
interface Row { t: string; pid: string; act: string; cd: string; lv: string; issueId?: string }

const clock = () => new Date().toTimeString().slice(0, 8)
const CYCLE_S = 15

loadState()

export default function App() {
  const [sel, setSel] = useState<Item | null>(null)
  const [pipeSel, setPipeSel] = useState<string | null>(null)
  const [logs, setLogs] = useState<Row[]>(SEED_LOG)
  const [now, setNow] = useState(clock)
  const [scan, setScan] = useState<{ item: Item; dir: 'OUT' | 'IN'; by: string } | null>(null)
  const [view, setView] = useState<'ops' | 'catalog'>('ops')
  const [issueSel, setIssueSel] = useState<Issue | null>(null)
  const [q, setQ] = useState('')
  const [cycleOn, setCycleOn] = useState(true)
  const [, force] = useState(0)
  const redraw = () => force(n => n + 1)
  const themeSlot = useRef<HTMLSpanElement>(null)
  const qRef = useRef<HTMLInputElement>(null)
  const cycIdx = useRef(0)
  const nextRef = useRef(CYCLE_S)
  const cycleRef = useRef(true)
  const scanRef = useRef(scan)
  scanRef.current = scan

  useEffect(() => { Kit.themeToggle(() => {}, themeSlot.current) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault(); qRef.current?.focus()
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

  const fireAuto = () => {
    const movable = items.filter((i: Item) => i.icon && (i.st === 'rack' || i.st === 'out') && !i.pending).length
    if (movable <= 3) {
      const held = items.find((i: Item) => i.st === 'hold' && i.cls !== 'ooa')
      if (held) {
        held.st = 'rack'; held.cust = null
        addLog('HOLD_CLEAR · ' + held.slot + ' · supervisor sign-off · auto', 'ok')
        saveState()
      }
    }
    const trackable = items.filter((i: Item) => i.icon)
    let it: Item | null = null
    for (let n = 0; n < trackable.length; n++) {
      const cand = trackable[cycIdx.current % trackable.length]; cycIdx.current++
      if ((cand.st === 'rack' || cand.st === 'out') && !cand.pending) { it = cand; break }
    }
    if (!it) { addLog('CYCLE_SKIP · no movable items', 'warn'); return }
    const dir: 'OUT' | 'IN' = it.st === 'out' ? 'IN' : 'OUT'
    const by = OPS[Math.floor(Math.random() * OPS.length)]
    const rq = newReq(it, dir, by, true) as Req
    rq.t0 = Date.now()
    requests.unshift(rq); if (requests.length > 12) requests.pop()
    it.st = 'check'
    addLog('REQ_CREATE · ' + rq.id + ' · ' + it.slot + ' ' + dir + ' · auto', 'ok')
    Kit.toast('AUTO_CYCLE · ' + rq.id + ' · ' + dir + ' ' + it.name)
  }

  const progressAuto = () => {
    for (const r of requests as Req[]) {
      if (!r.auto || r.st === 'Logged' || !r.t0) continue
      const age = (Date.now() - r.t0) / 1000
      if (r.st === 'Requested' && age >= 2) r.st = 'AI Check'
      else if (r.st === 'AI Check' && age >= 7) {
        const it = items.find((i: Item) => i.id === r.itemId)
        if (!it) continue
        const ai = proposeClass() as ScanResult
        r.ai = ai; r.st = 'Logged'
        applyStaffClass(it, ai.cls, ai.tags, ai.note, 'ai-confirmed')
        if (it.st !== 'hold') applyMove(it, r.dir, r.by, ai.cls)
        addLog('AI_PROPOSE · ' + it.slot + ' · ' + CLS_SHORT[ai.cls] + ' · auto-signed ' + STAFF, ai.cls === 'good' ? 'ok' : 'warn')
      }
    }
  }

  useEffect(() => {
    const t = setInterval(() => {
      setNow(clock())
      if (cycleRef.current && !scanRef.current) {
        nextRef.current--
        if (nextRef.current <= 0) { fireAuto(); nextRef.current = CYCLE_S }
      }
      progressAuto()
      redraw()
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const toggleCycle = () => {
    cycleRef.current = !cycleRef.current
    setCycleOn(cycleRef.current)
    if (cycleRef.current) nextRef.current = CYCLE_S
    addLog(cycleRef.current ? 'AUTO_CYCLE · resumed' : 'AUTO_CYCLE · paused', cycleRef.current ? 'ok' : 'warn')
  }

  const openScan = (it: Item, dir: 'OUT' | 'IN') => {
    if (it.st === 'hold' || it.pending) return
    setSel(null)
    setScan({ item: it, dir, by: it.cust || OPS[0] })
    addLog((dir === 'OUT' ? 'TAKE_OUT' : 'RETURN_IN') + ' · ' + it.slot + ' · check', 'ok')
    redraw()
  }
  const closeScan = (r: ScanResult | null) => {
    if (!scan) return
    const it = items.find((i: Item) => i.id === scan.item.id)!
    if (r) {
      const rq = newReq(it, scan.dir, scan.by, false) as Req
      rq.ai = r; rq.st = 'Logged'
      requests.unshift(rq); if (requests.length > 12) requests.pop()
      it.pending = { cls: r.cls, tags: r.tags, note: r.note, dir: scan.dir, at: new Date().toISOString(), shots: r.shots, apply: true }
      addLog('AI_PROPOSE · ' + it.slot + ' · ' + CLS_SHORT[r.cls] + (r.tags[0] ? ' · ' + r.tags[0] : ''), 'warn')
      Kit.toast('AI proposed ' + CLS_SHORT[r.cls] + ' — confirm or override')
      setSel(it)
    } else {
      addLog('CHECK_ABORT · ' + it.slot, 'warn')
      setSel(it)
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

  const pickItem = (it: Item | null) => {
    if (!it || !it.icon) { setSel(null); return }
    setSel(it)
  }

  const needle = q.trim().toLowerCase()
  const match = (it: Item) => {
    if (!needle) return true
    const serial = String(it.serial).toLowerCase()
    return serial.includes(needle) || serial.slice(-4).includes(needle)
      || it.name.toLowerCase().includes(needle) || it.id.toLowerCase().includes(needle)
      || it.slot.toLowerCase().includes(needle) || (it.cust || '').toLowerCase().includes(needle)
  }
  const submitScan = () => {
    const hits = (items as Item[]).filter(i => i.icon && match(i))
    if (hits.length === 1) pickItem(hits[0])
    else if (hits.length > 1) pickItem(hits[0])
  }

  const track = (items as Item[]).filter(i => i.icon)
  const counts = {
    out: track.filter(i => i.st === 'out').length,
    due: track.filter(i => i.st === 'out' && isDueToday(i.dueAt)).length,
    flagged: track.filter(i => i.cls === 'flagged').length,
    ooa: track.filter(i => i.cls === 'ooa').length,
    good: track.filter(i => i.cls === 'good').length,
    stale: track.filter(i => isStale(i.photoAt)).length,
  }

  const vrows = [
    { l: 'Items in rack', v: `${VITALS.inRack()}/${track.length}`, pc: VITALS.inRack() / track.length * 100, den: `= ${VITALS.inRack()} racked / ${track.length} tracked items`, warn: false },
    { l: 'Deployed right now', v: `${counts.out}/${track.length}`, pc: counts.out / track.length * 100, den: `= ${VITALS.outsToday} deploys vs ${VITALS.insToday} retrieves today`, warn: false },
    { l: 'Good class rate', v: `${(counts.good / Math.max(1, track.length) * 100).toFixed(1)}%`, pc: counts.good / Math.max(1, track.length) * 100, den: `= ${counts.good} Good / ${track.length} tracked · ${counts.due} due today`, warn: false },
    { l: 'Flagged / OOA', v: `${counts.flagged} / ${counts.ooa}`, pc: counts.flagged * 18 + counts.ooa * 24, den: `= ${counts.stale} photo stale`, warn: counts.flagged + counts.ooa > 0 },
  ]

  let list = (requests as Req[]).filter(r => {
    if (pipeSel === 'FLAGGED') return r.ai?.cls === 'flagged' || r.ai?.cls === 'ooa'
    return !pipeSel || r.st === pipeSel
  })
  if (needle) {
    list = list.filter(r => {
      const it = (items as Item[]).find(i => i.id === r.itemId)
      return it ? match(it) : r.name.toLowerCase().includes(needle)
    })
  }

  const moveOpt = () => {
    const r = Kit.rng(77)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']
    const outs = days.map((_, i) => i === 6 ? VITALS.outsToday : Math.round(9 + r() * 12))
    const ins = days.map((_, i) => i === 6 ? VITALS.insToday : Math.round(8 + r() * 11))
    const goodRate = counts.good / Math.max(1, track.length) * 100
    return {
      legend: { show: true, top: 0, right: 6, icon: 'rect', itemWidth: 9, itemHeight: 2, textStyle: { color: Kit.css('muted'), fontSize: 9.5, fontFamily: Kit.css('mono') } },
      xAxis: Kit.axis('category', { data: days }),
      yAxis: [Kit.axis('value'), { ...Kit.axis('value', { min: 50, max: 100, axisLabel: { formatter: (v: number) => v + '%' } }), splitLine: { show: false } }],
      series: [
        { name: 'Deploys OUT', type: 'bar', data: outs, barWidth: '26%', itemStyle: { color: Kit.css('accent'), opacity: .75 } },
        { name: 'Retrieves IN', type: 'bar', data: ins, barWidth: '26%', itemStyle: { color: Kit.css('s3'), opacity: .5 } },
        { name: 'Good class', type: 'line', yAxisIndex: 1, data: days.map((_, i) => i === 6 ? +goodRate.toFixed(1) : +(78 + r() * 16).toFixed(1)),
          symbolSize: 4, lineStyle: { width: 1.6, color: Kit.css('pos') }, itemStyle: { color: Kit.css('pos') } },
      ],
    }
  }

  const clsOf = (t: Req) => t.ai?.cls || ((items as Item[]).find(i => i.id === t.itemId)?.cls ?? 'good')

  return (
    <>
      <header>
        <div className="topbar">
          <div className="ascii">
            <div className="lg">SENTINEL<em>▮</em>ARMORY</div>
            <div className="sub">KIT &amp; FIREARM INVENTORY OPS · AI CHECK DEMO</div>
          </div>
          <div className="spacer" />
          <div className="btns">
            <label className="scanbar">
              <span>Scan</span>
              <input ref={qRef} type="search" autoComplete="off" spellCheck={false}
                     placeholder="last-4"
                     value={q}
                     onChange={e => setQ(e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter') submitScan() }} />
            </label>
            <div className="seg viewnav">
              <button className={view === 'ops' ? 'on' : ''} onClick={() => setView('ops')}>Ops board</button>
              <button className={view === 'catalog' ? 'on' : ''} onClick={() => setView('catalog')}>Stock catalog</button>
            </div>
            <button className={'btn' + (cycleOn ? ' primary' : '')} onClick={toggleCycle}>
              {cycleOn ? `▮ AUTO_CYCLE ${nextRef.current}s` : '▶ AUTO_CYCLE paused'}
            </button>
            <span id="theme-slot" ref={themeSlot} />
          </div>
        </div>
        <div className="sysline">
          <div>SESSION: <b>RACK-TERM-01</b></div>
          <div>LOC: <b>Vault B · Cage 3</b></div>
          <div>STATUS: <b className="st-ok">{cycleOn ? 'LIVE_TEST' : 'PAUSED'}</b></div>
          <div>CYCLE: <b>1 req / {CYCLE_S}s · round-robin</b></div>
          <div>SYS_TIME: <b id="clock">{now}</b></div>
        </div>
      </header>

      <div className="halftone" />

      {view === 'catalog' ? (
        <div className="app catalogwrap">
          <Catalog items={items as Item[]} cats={CATS}
                   onAction={openScan as never}
                   onClearHold={((it: Item) => { it.st = 'rack'; it.cust = null; saveState(); redraw() }) as never}
                   onOpenIssue={openIssue}
                   onOpenItem={((it: Item) => { setView('ops'); pickItem(it) }) as never} />
        </div>
      ) : (
      <div className="app">
        <div className="row r1">
          <section className="cell">
            <div className="ph"><h2>CORE VITALS · INVENTORY</h2><span className="tail">[ARM] TODAY</span></div>
            <div className="pb" id="vitals">
              {vrows.map(r => (
                <div className={'vrow' + (r.warn ? ' warn' : '')} key={r.l}>
                  <div className="t"><span>{r.l}</span><span className="dots" /><b>{r.v}</b></div>
                  <div className="blocks" dangerouslySetInnerHTML={{ __html: blocks(r.pc) }} />
                  <div className="den">{r.den}</div>
                </div>
              ))}
              <div className="legend">
                <div className="lg-t">NAMING MATRIX</div>
                <div><b>S-xx</b> rack slot — a physical position in the cage</div>
                <div><b>ARM-1xx</b> asset record — one tracked item &amp; its serial</div>
                <div><b>RQ-xxxx</b> movement request — one deploy / retrieve</div>
              </div>
              <div className="den" style={{ marginTop: 8 }}>
                Classes only: Good · Flagged · OOA. AI proposes; staff confirm. State persists in this browser.
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>CAGE CCTV · CAM 03</h2><span className="tail"><span className="rec-inline">● REC</span> VAULT B</span></div>
            <div className="cctv-wrap">
              <img className="cctv-still" src={asset('cage-cctv-still.png')} alt="CCTV still — Vault B cage 3" />
              <video src={asset('cage-cctv.mp4')} autoPlay muted loop playsInline
                     onError={e => { (e.target as HTMLVideoElement).style.display = 'none' }} />
              <div className="cctv-osd">
                <span>CAM 03 · VAULT B · CAGE 3</span>
                <span>{now}</span>
              </div>
              <div className="cctv-scan" />
              <span className="radar-note">CAM 03 · LIVE STILL</span>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>TRANSACTION LOG</h2><span className="tail">{STAFF}</span></div>
            <div className="pb"><div className="log" id="log">
              {logs.map((r, i) => (
                <div className={'lr' + (r.lv === 'warn' ? ' warn' : '') + (r.issueId ? ' clickable' : '')}
                     key={r.cd + i}
                     title={r.issueId ? 'Open issue record ' + r.issueId : undefined}
                     onClick={() => openIssue(r.issueId)}>
                  <time>{r.t}</time>
                  <span className="pid">{r.pid}</span>
                  <span className="act">{r.act}</span><span className="cd">{r.cd}</span>
                </div>
              ))}
            </div></div>
          </section>
        </div>

        <div className="row r2">
          <section className="cell">
            <div className="ph"><h2>RACK MATRIX · LIVE CAGE MAP</h2><span className="tail">16 SLOTS · CLICK TO OPEN</span></div>
            <div className="pb rack-pb">
              <div className="rackgrid">
                {(items as Item[]).map(d => {
                  const stale = isStale(d.photoAt)
                  const rdy = readiness(d)
                  const hit = !needle || match(d)
                  return (
                    <div key={d.slot}
                         className={`slot ${d.st} cls-${d.cls}` + (d === sel ? ' sel' : '') + (stale ? ' stale' : '') + (hit ? '' : ' dim')}
                         title={`${d.slot} · ${d.name} · ${ST_LBL[d.st as keyof typeof ST_LBL]} · ${CLS_SHORT[d.cls]}${stale ? ' · photo stale' : ''}`}
                         onClick={() => pickItem(d)}>
                      {d.icon ? <img src={asset('icons/' + d.icon + '.png')} alt={d.name} /> : <span className="empty-dash">·</span>}
                      <i /><span className="n">{d.slot}</span>
                      {rdy === 'stale' ? <span className="slot-rdy rdy-stale" /> : null}
                    </div>
                  )
                })}
              </div>
              <div className="racklegend">
                <span><i className="sw rack" />In rack</span>
                <span><i className="sw out" />Out</span>
                <span><i className="sw check" />Check</span>
                <span><i className="sw hold" />Hold / OOA</span>
                <span><i className="sw empty" />Empty</span>
              </div>
              <div className="devstat">
                {!sel ? 'Click a slot or queue row to open the item file.'
                  : sel.st === 'empty' ? <><span className="clr" onClick={() => setSel(null)}>Clear selection ×</span>
                      <b>{sel.slot}</b> · unassigned — no item racked here.</>
                  : <>
                    <span className="clr" onClick={() => setSel(null)}>Clear selection ×</span>
                    <div className="itemline">
                      {sel.icon && <img src={asset('icons/' + sel.icon + '.png')} alt={sel.name} />}
                      <div>
                        <b>{sel.id}</b>{` · ${sel.name} · `}<b>{ST_LBL[sel.st as keyof typeof ST_LBL]}</b><br />
                        {`${sel.type} · SN ${sel.serial} · `}
                        <span className={'cls-chip cls-' + sel.cls + (isStale(sel.photoAt) ? ' stale' : '')}>
                          {isStale(sel.photoAt) ? 'Photo stale' : CLS_SHORT[sel.cls]}
                        </span>
                        {` · Svc ${Kit.fmt(sel.svc)} h · Last check ${sel.lastChk}`}<br />
                        {sel.st === 'out' ? <>Signed to <b>{sel.cust}</b></> : sel.st === 'hold' ? <b style={{ color: 'var(--neg)' }}>Held · OOA</b> : 'No current custodian'}
                        {(() => {
                          const h = (issues as Issue[]).filter(x => x.itemId === sel.id)
                          return h.length ? <> · <span className="issuelink" onClick={e => { e.stopPropagation(); openIssue(h[0].id) }}>
                            {h.length} record{h.length > 1 ? 's' : ''} on file ▸</span></> : null
                        })()}
                      </div>
                    </div>
                    <div className="acts" style={{ marginTop: 7 }}>
                      {sel.st === 'rack' && !sel.pending && <button onClick={() => openScan(sel, 'OUT')}>Take out → check</button>}
                      {sel.st === 'out' && !sel.pending && <button onClick={() => openScan(sel, 'IN')}>Return → check</button>}
                      {sel.st === 'hold' && <button className="done" onClick={() => {
                        sel.st = 'rack'; sel.cust = null; saveState(); redraw()
                      }}>Clear hold → rack</button>}
                      {sel.pending && <span style={{ color: 'var(--warn)' }}>AI proposal waiting in the item file</span>}
                    </div>
                  </>}
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>MOVEMENT QUEUE</h2>
              <span className="tail">{`${(requests as Req[]).filter(r => r.st !== 'Logged').length} in flight`}</span></div>
            <div className="pb">
              <div className="den" style={{ marginBottom: 8 }}>
                One RQ per take-out / return — slot · asset · time · requester · class. Click a row to open the item file.
              </div>
              <div className="pipe">
                {STAGES.map((s: string) => (
                  <div key={s} className={pipeSel === s ? 'on' : ''}
                       onClick={() => setPipeSel(p => p === s ? null : s)}>
                    <div className="n">{(requests as Req[]).filter(r => r.st === s).length}</div>
                    <div className="l">{s}</div>
                  </div>
                ))}
                <div className={pipeSel === 'FLAGGED' ? 'on' : ''}
                     onClick={() => setPipeSel(p => p === 'FLAGGED' ? null : 'FLAGGED')}>
                  <div className="n">{(requests as Req[]).filter(r => r.ai?.cls === 'flagged' || r.ai?.cls === 'ooa').length}</div>
                  <div className="l">Flagged</div>
                </div>
              </div>
              <div>
                {!list.length ? <div className="tk"><div className="m">No movement requests match this filter.</div></div>
                  : list.map(t => {
                    const it = (items as Item[]).find(i => i.id === t.itemId)
                    const cls = clsOf(t)
                    const iss = (cls === 'flagged' || cls === 'ooa')
                      ? (issues as Issue[]).find(x => x.itemId === t.itemId)
                      : null
                    return (
                    <div className={'tk' + (cls !== 'good' ? ' over flagged' : '')}
                         key={t.id}
                         title="Open item file"
                         onClick={() => it && pickItem(it)}>
                      <div className="t">
                        <span className="id">{t.id}</span>
                        <span className={'dir dir-' + t.dir}>{t.dir === 'OUT' ? '▲ OUT' : '▼ IN'}</span>
                        <span className="ti">{t.name}</span>
                        <span className={'cls-chip cls-' + cls}>{CLS_SHORT[cls]}</span>
                      </div>
                      <div className="m">
                        {`${t.slot} · ${t.itemId} · req ${t.t} · ${t.by} · ${t.auto ? 'seeded' : 'manual'} · ${t.st}`}
                      </div>
                      {iss && (
                        <div className="flagbox" onClick={e => { e.stopPropagation(); setIssueSel(iss) }}>
                          <span className="fl">⚠ {iss.id}</span>
                          <span className="ft">{iss.type} — {iss.loc}</span>
                          <span className="fr">REVIEW ▸</span>
                        </div>
                      )}
                    </div>
                    )
                  })}
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>MOVEMENT</h2><span className="tail">7D · GOOD %</span></div>
            <div className="pb" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Chart id="c-move" className="" style={{ flex: 1, minHeight: 0 }} build={moveOpt} />
            </div>
          </section>
        </div>
      </div>
      )}

      {sel && sel.icon && (
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
