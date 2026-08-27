import { useEffect, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import { CATS, OPS, R, SEED_LOG, ST_LBL, STAGES, VITALS, blocks, hex, items, loadState, newReq, requests, saveState } from './lib/ops.js'
import Chart from './components/Chart'
import AiScan, { ScanResult, ScanTarget } from './components/AiScan'
import Catalog from './components/Catalog'

interface Item { slot: string; id: string; cat: string; name: string; type: string; icon: string | null
                 photo: string | null; serial: string; extra: Record<string, string>
                 st: string; cond: number; svc: number; lastChk: string; cust: string | null }
interface Req { id: string; itemId: string; slot: string; name: string; dir: 'OUT' | 'IN'
                by: string; st: string; auto: boolean; t: string; ai: ScanResult | null; t0?: number }
interface Row { t: string; pid: string; act: string; cd: string; lv: string }

const clock = () => new Date().toTimeString().slice(0, 8)
const CYCLE_S = 15
const PASS_NOTES = ['Condition nominal', 'No defects detected', 'Wear within tolerance']
const FLAG_NOTES = ['Surface wear on rail interface', 'Serial plate partially obscured', 'Strap fray detected at stitch line']

/* restore the browser-local demo snapshot before first paint */
loadState()

export default function App() {
  const [sel, setSel] = useState<Item | null>(null)
  const [pipeSel, setPipeSel] = useState<string | null>(null)
  const [logs, setLogs] = useState<Row[]>(SEED_LOG)
  const [now, setNow] = useState(clock)
  const [cycleOn, setCycleOn] = useState(true)
  const [scan, setScan] = useState<{ item: Item; dir: 'OUT' | 'IN'; by: string } | null>(null)
  const [view, setView] = useState<'ops' | 'catalog'>('ops')
  const [, force] = useState(0)
  const redraw = () => force(n => n + 1)

  const themeSlot = useRef<HTMLSpanElement>(null)
  const cycIdx = useRef(0)
  const nextRef = useRef(CYCLE_S)    // seconds until the next auto request
  const cycleRef = useRef(true)
  const scanRef = useRef(scan)
  scanRef.current = scan

  useEffect(() => { Kit.themeToggle(() => {}, themeSlot.current) }, [])

  const addLog = (act: string, lv: string) => setLogs(ls => [{
    t: clock(), pid: 'PID_' + (1000 + Math.floor(Math.random() * 9000)),
    act, cd: hex(Math.floor(Math.random() * 0xFFFFF)), lv,
  }, ...ls].slice(0, 42))

  /* Commit a movement to the system — the AI verdict is the gate. */
  const applyMove = (it: Item, dir: 'OUT' | 'IN', by: string, ai: ScanResult) => {
    it.lastChk = clock().slice(0, 5)
    if (ai.verdict === 'FLAG') {
      it.st = 'hold'; VITALS.aiFlag++
      addLog(`AI_FLAG · ${it.slot} · ${ai.score}/100 · ${ai.note}`, 'warn')
      Kit.toast(`⚠ ${it.id} sent to HOLD · ${ai.note}`)
    } else {
      it.st = dir === 'OUT' ? 'out' : 'rack'
      it.cust = dir === 'OUT' ? by : null
      if (dir === 'OUT') { VITALS.outsToday++; it.cond = Math.max(55, it.cond - 1) }
      else VITALS.insToday++
      VITALS.aiPass++
      addLog(`AI_PASS · ${it.slot} · ${ai.score}/100 · ${ai.shots} frames`, 'ok')
      addLog(`${dir === 'OUT' ? 'DEPLOY_OUT' : 'RETRIEVE_IN'} · ${it.slot} · ${by}`, 'ok')
    }
    saveState()
  }

  /* Every 15 s: next item in rotation gets a deploy/retrieve request.
     The request then walks Requested → AI Check → Logged on its own,
     so the whole pipeline gets exercised once per item per lap. */
  const fireAuto = () => {
    const track = items.filter((i: Item) => i.icon)
    let it: Item | null = null
    for (let n = 0; n < track.length; n++) {
      const cand = track[cycIdx.current % track.length]; cycIdx.current++
      if (cand.st === 'rack' || cand.st === 'out') { it = cand; break }
    }
    if (!it) { addLog('CYCLE_SKIP · no movable items', 'warn'); return }
    const dir: 'OUT' | 'IN' = it.st === 'out' ? 'IN' : 'OUT'
    const by = OPS[Math.floor(Math.random() * OPS.length)]
    const rq = newReq(it, dir, by, true) as Req
    rq.t0 = Date.now()
    requests.unshift(rq); if (requests.length > 12) requests.pop()
    it.st = 'check'
    addLog(`REQ_CREATE · ${rq.id} · ${it.slot} ${dir} · auto`, 'ok')
    Kit.toast(`AUTO_CYCLE · ${rq.id} · ${dir} ${it.name}`)
  }

  const progressAuto = () => {
    let changed = false
    for (const r of requests as Req[]) {
      if (!r.auto || r.st === 'Logged' || !r.t0) continue
      const age = (Date.now() - r.t0) / 1000
      if (r.st === 'Requested' && age >= 2) { r.st = 'AI Check'; changed = true }
      else if (r.st === 'AI Check' && age >= 7) {
        const it = items.find((i: Item) => i.id === r.itemId)!
        const flag = Math.random() < .1
        const ai: ScanResult = {
          verdict: flag ? 'FLAG' : 'PASS',
          score: flag ? Math.round(62 + R() * 14) : Math.round(90 + R() * 9),
          serial: it.serial, shots: 2,
          note: flag ? FLAG_NOTES[Math.floor(R() * FLAG_NOTES.length)]
                     : PASS_NOTES[Math.floor(R() * PASS_NOTES.length)],
        }
        r.ai = ai; r.st = 'Logged'
        applyMove(it, r.dir, r.by, ai)
        changed = true
      }
    }
    return changed
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleCycle = () => {
    cycleRef.current = !cycleRef.current
    setCycleOn(cycleRef.current)
    if (cycleRef.current) nextRef.current = CYCLE_S
    addLog(cycleRef.current ? 'AUTO_CYCLE · resumed' : 'AUTO_CYCLE · paused', cycleRef.current ? 'ok' : 'warn')
  }

  /* manual request from the rack detail panel → AI photo-check modal */
  const openScan = (it: Item, dir: 'OUT' | 'IN') => {
    if (it.st === 'check' || it.st === 'hold') return
    it.st = 'check'
    setScan({ item: it, dir, by: 'This terminal' })
    addLog(`REQ_CREATE · manual · ${it.slot} ${dir}`, 'ok')
    redraw()
  }
  const closeScan = (r: ScanResult | null) => {
    if (!scan) return
    const it = items.find((i: Item) => i.id === scan.item.id)!
    if (r) {
      const rq = newReq(it, scan.dir, scan.by, false) as Req
      rq.ai = r; rq.st = 'Logged'
      requests.unshift(rq); if (requests.length > 12) requests.pop()
      applyMove(it, scan.dir, scan.by, r)
    } else {
      it.st = it.cust ? 'out' : 'rack'   // aborted — item goes back to whatever it was
      addLog(`AI_ABORT · ${it.slot}`, 'warn')
    }
    setScan(null); redraw()
  }
  const clearHold = (it: Item) => {
    it.st = 'rack'; it.cust = null
    saveState()
    addLog(`HOLD_CLEAR · ${it.slot} → rack`, 'ok'); redraw()
  }

  /* ── vitals ── */
  const track = items.filter((i: Item) => i.icon)
  const vrows = [
    { l: 'Items in rack', v: `${VITALS.inRack()}/${track.length}`, pc: VITALS.inRack() / track.length * 100, den: `= ${VITALS.inRack()} racked / ${track.length} tracked items`, warn: false },
    { l: 'Deployed right now', v: `${VITALS.deployed()}/${track.length}`, pc: VITALS.deployed() / track.length * 100, den: `= ${VITALS.outsToday} deploys vs ${VITALS.insToday} retrieves today`, warn: false },
    { l: 'AI check pass rate', v: `${VITALS.passRate().toFixed(1)}%`, pc: VITALS.passRate(), den: `= ${VITALS.aiPass} passed / ${VITALS.aiPass + VITALS.aiFlag} AI checks today`, warn: false },
    { l: 'Flags / open requests', v: `${VITALS.aiFlag} / ${VITALS.openReqs()}`, pc: VITALS.aiFlag * 18 + VITALS.openReqs() * 10, den: `= ${VITALS.aiFlag} items flagged · ${VITALS.openReqs()} requests in flight`, warn: VITALS.aiFlag > 0 },
  ]

  /* ── movement queue ── */
  let list = (requests as Req[]).filter(r => !pipeSel || r.st === pipeSel)
  if (sel) list = list.filter(r => r.itemId === sel.id)

  const moveOpt = () => {
    const r = Kit.rng(77)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']
    const outs = days.map((_, i) => i === 6 ? VITALS.outsToday : Math.round(9 + r() * 12))
    const ins = days.map((_, i) => i === 6 ? VITALS.insToday : Math.round(8 + r() * 11))
    return {
      legend: { show: true, top: 0, right: 6, icon: 'rect', itemWidth: 9, itemHeight: 2, textStyle: { color: Kit.css('muted'), fontSize: 9.5, fontFamily: Kit.css('mono') } },
      xAxis: Kit.axis('category', { data: days }),
      yAxis: [Kit.axis('value'), { ...Kit.axis('value', { min: 80, max: 100, axisLabel: { formatter: (v: number) => v + '%' } }), splitLine: { show: false } }],
      series: [
        { name: 'Deploys OUT', type: 'bar', data: outs, barWidth: '26%', itemStyle: { color: Kit.css('accent'), opacity: .75 } },
        { name: 'Retrieves IN', type: 'bar', data: ins, barWidth: '26%', itemStyle: { color: Kit.css('s3'), opacity: .5 } },
        { name: 'AI pass rate', type: 'line', yAxisIndex: 1, data: days.map((_, i) => i === 6 ? +VITALS.passRate().toFixed(1) : +(91 + r() * 8).toFixed(1)),
          symbolSize: 4, lineStyle: { width: 1.6, color: Kit.css('pos') }, itemStyle: { color: Kit.css('pos') } },
      ],
    }
  }

  return (
    <>
      <header>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div className="ascii">
            <div className="lg">SENTINEL<em>▮</em>ARMORY</div>
            <div className="sub">KIT &amp; FIREARM INVENTORY OPS · AI CHECK DEMO</div>
          </div>
          <div className="spacer" />
          <div className="btns">
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
          <Catalog items={items as Item[]} cats={CATS} onAction={openScan} onClearHold={clearHold} />
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
                Demo build — all items, operators and AI verdicts are simulated; state persists in this browser only.
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>CAGE CCTV · CAM 03</h2><span className="tail"><span className="rec-inline">● REC</span> VAULT B</span></div>
            <div className="cctv-wrap">
              <video src="/cage-cctv.mp4" autoPlay muted loop playsInline
                     onError={e => { (e.target as HTMLVideoElement).style.display = 'none' }} />
              <div className="cctv-offline">
                <div className="t">CAMERA OFFLINE</div>
                <div className="s">feed placeholder · drop <b>cage-cctv.mp4</b> into public/ to go live</div>
              </div>
              <div className="cctv-osd">
                <span>CAM 03 · VAULT B · CAGE 3</span>
                <span>{now}</span>
              </div>
              <div className="cctv-scan" />
              <span className="radar-note">DEMO LOOP · STANDS IN FOR THE LIVE AI FEED</span>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>TRANSACTION LOG</h2>
              <span className="tail">NEXT AUTO ▮ {cycleOn ? nextRef.current + 's' : '—'}</span></div>
            <div className="pb"><div className="log" id="log">
              {logs.map((r, i) => (
                <div className={'lr' + (r.lv === 'warn' ? ' warn' : '')} key={r.cd + i}>
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
            <div className="ph"><h2>RACK MATRIX · LIVE CAGE MAP</h2><span className="tail">16 SLOTS · CLICK TO SELECT</span></div>
            <div className="pb">
              <div className="rackgrid">
                {items.map((d: Item) => (
                  <div key={d.slot} className={`slot ${d.st}` + (d === sel ? ' sel' : '')}
                       title={`${d.slot} · ${d.name} · ${ST_LBL[d.st]}`}
                       onClick={() => setSel(s => s === d ? null : d)}>
                    {d.icon ? <img src={`/icons/${d.icon}.png`} alt={d.name} /> : <span className="empty-dash">·</span>}
                    <i /><span className="n">{d.slot}</span>
                  </div>
                ))}
              </div>
              <div className="racklegend">
                <span><i className="sw rack" />In rack</span>
                <span><i className="sw out" />Deployed</span>
                <span><i className="sw check" />AI check</span>
                <span><i className="sw hold" />Hold</span>
                <span><i className="sw empty" />Empty</span>
              </div>
              <div className="devstat">
                {!sel ? 'No slot selected — click a rack cell for the item record and movement actions.'
                  : sel.st === 'empty' ? <><span className="clr" onClick={() => setSel(null)}>Clear selection ×</span>
                      <b>{sel.slot}</b> · unassigned — no item racked here.</>
                  : <>
                    <span className="clr" onClick={() => setSel(null)}>Clear selection ×</span>
                    <div className="itemline">
                      {sel.icon && <img src={`/icons/${sel.icon}.png`} alt={sel.name} />}
                      <div>
                        <b>{sel.id}</b>{` · ${sel.name} · `}<b>{ST_LBL[sel.st]}</b><br />
                        {`${sel.type} · SN ${sel.serial} · Cond `}<b>{sel.cond}/100</b>
                        {` · Svc ${Kit.fmt(sel.svc)} h · Last AI check ${sel.lastChk}`}<br />
                        {sel.st === 'out' ? <>Signed to <b>{sel.cust}</b></> : sel.st === 'hold' ? <b style={{ color: 'var(--neg)' }}>Held for review</b> : 'No current custodian'}
                      </div>
                    </div>
                    <div className="acts" style={{ marginTop: 7 }}>
                      {sel.st === 'rack' && <button onClick={() => openScan(sel, 'OUT')}>Deploy OUT → AI check</button>}
                      {sel.st === 'out' && <button onClick={() => openScan(sel, 'IN')}>Retrieve IN → AI check</button>}
                      {sel.st === 'hold' && <button className="done" onClick={() => clearHold(sel)}>Clear hold → rack</button>}
                      {sel.st === 'check' && <span style={{ color: 'var(--warn)' }}>AI check in progress…</span>}
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
                Each row is one RQ — slot · asset · time · requester · AI verdict.
              </div>
              <div className="pipe">
                {STAGES.map((s: string) => (
                  <div key={s} className={pipeSel === s ? 'on' : ''}
                       onClick={() => setPipeSel(p => p === s ? null : s)}>
                    <div className="n">{(requests as Req[]).filter(r => r.st === s).length}</div>
                    <div className="l">{s}</div>
                  </div>
                ))}
              </div>
              <div>
                {!list.length ? <div className="tk"><div className="m">No movement requests match this filter.</div></div>
                  : list.map(t => (
                    <div className={'tk' + (t.ai?.verdict === 'FLAG' ? ' over' : '')} key={t.id}>
                      <div className="t">
                        <span className="id">{t.id}</span>
                        <span className={'dir dir-' + t.dir}>{t.dir === 'OUT' ? '▲ OUT' : '▼ IN'}</span>
                        <span className="ti">{t.name}</span>
                        <span className={'st st-' + t.st.replace(' ', '')}>{t.st}</span>
                      </div>
                      <div className="m">
                        {`${t.slot} · ${t.itemId} · req ${t.t} · ${t.by} · ${t.auto ? 'auto-cycle' : 'manual'}`}
                        {t.ai ? <> · AI <b style={{ color: t.ai.verdict === 'PASS' ? 'var(--pos)' : 'var(--neg)' }}>
                          {t.ai.verdict} {t.ai.score}/100</b> · {t.ai.shots} frames · {t.ai.note}</> : null}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>MOVEMENT &amp; AI PASS</h2><span className="tail">7D</span></div>
            <div className="pb" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Chart id="c-move" className="" style={{ flex: 1, minHeight: 0 }} build={moveOpt} />
            </div>
          </section>
        </div>
      </div>
      )}

      {scan && <AiScan item={scan.item as ScanTarget} dir={scan.dir} onDone={closeScan} />}
    </>
  )
}
