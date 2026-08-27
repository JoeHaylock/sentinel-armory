import { useEffect, useRef, useState } from 'react'
import Kit from './lib/kit.js'
import { radar } from './lib/fx.js'
import { R, SEED_LOG, ST_LBL, STAGES, VITALS, blocks, devs, hex, tickets } from './lib/ops.js'
import Chart from './components/Chart'

interface Dev { id: string; line: string; st: string; run: number }
interface Ticket { id: string; dev: string; line: string; ti: string; st: string
                   h: number; over: boolean; by: string; photo: boolean }
interface Row { t: string; pid: string; act: string; cd: string; lv: string }

const clock = () => new Date().toTimeString().slice(0, 8)
const ACTS_RT: [string, string][] = [['SCAN_OK', 'ok'], ['CHECK_PASS', 'ok'], ['PARAM_SYNC', 'ok'],
  ['TEMP_WARN', 'warn'], ['VIB_WARN', 'warn'], ['PHOTO_UPLD', 'ok'], ['WO_CREATE', 'warn'], ['AUTH_OK', 'ok']]

export default function App() {
  const [sel, setSel] = useState<Dev | null>(null)
  const [pipeSel, setPipeSel] = useState<string | null>(null)
  const [logs, setLogs] = useState<Row[]>(SEED_LOG)
  const [now, setNow] = useState(clock)
  const [modal, setModal] = useState(false)
  const [photoOn, setPhotoOn] = useState(false)
  const [, force] = useState(0)
  const redraw = () => force(n => n + 1)

  const radarHost = useRef<HTMLDivElement>(null)
  const themeSlot = useRef<HTMLSpanElement>(null)
  const desc = useRef<HTMLTextAreaElement>(null)
  const fdev = useRef<HTMLSelectElement>(null)
  const ftype = useRef<HTMLSelectElement>(null)
  const foff = useRef<HTMLInputElement>(null)

  /* The radar is a self-running animation owned by fx.js — React only provides the cell. */
  useEffect(() => { radar(radarHost.current, { period: 4.2, blips: 8, rings: 4 }) }, [])
  useEffect(() => { Kit.themeToggle(() => {}, themeSlot.current) }, [])

  /* New log rows go on top; past 42 rows the oldest ones are dropped */
  const addLog = (act: string, lv: string) => setLogs(ls => [{
    t: clock(), pid: 'PID_' + (1000 + Math.floor(Math.random() * 9000)),
    act, cd: hex(Math.floor(Math.random() * 0xFFFFF)), lv,
  }, ...ls].slice(0, 42))

  useEffect(() => {
    const a = setInterval(() => {
      const [act, lv] = ACTS_RT[Math.floor(Math.random() * ACTS_RT.length)]
      addLog(`${act} · M-${101 + Math.floor(Math.random() * 32)}`, lv)
      if (Math.random() < .3) { VITALS.done = Math.min(VITALS.plan, VITALS.done + 1); redraw() }
    }, 2600)
    const b = setInterval(() => setNow(clock()), 1000)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])

  /* ── vitals ── */
  const done = VITALS.done, plan = VITALS.plan, pc1 = done / plan * 100
  const vrows = [
    { l: 'Inspection completion', v: `${pc1.toFixed(1)}%`, pc: pc1, den: `= ${done} inspected / ${plan} planned`, warn: false },
    { l: 'Exception rate', v: `${(VITALS.abn / done * 100).toFixed(1)}%`, pc: VITALS.abn / done * 100 * 6, den: `= ${VITALS.abn} exceptions / ${done} inspected`, warn: true },
    { l: 'Missed inspection', v: `${(VITALS.miss / plan * 100).toFixed(1)}%`, pc: VITALS.miss / plan * 100 * 8, den: `= ${VITALS.miss} missed / ${plan} planned`, warn: true },
    { l: 'Open work orders', v: VITALS.wo() + '', pc: VITALS.wo() / 12 * 100, den: `= ${VITALS.wo()} unverified / ${tickets.length} this shift`, warn: false },
  ]

  /* ── work orders ── */
  let list: Ticket[] = tickets.filter((t: Ticket) => !pipeSel || t.st === pipeSel)
  if (sel) list = list.filter(t => t.dev === sel.id)
  list = [...list].sort((a, b) => (+b.over - +a.over) || (STAGES.indexOf(a.st) - STAGES.indexOf(b.st))).slice(0, 8)
  const advance = (t: Ticket) => {
    t.st = STAGES[STAGES.indexOf(t.st) + 1]; t.over = false
    addLog(`${t.id} → ${t.st}`, 'ok'); redraw()
  }

  const yieldOpt = () => {
    const r = Kit.rng(42)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Today']
    return {
      legend: { show: true, top: 0, right: 6, icon: 'rect', itemWidth: 9, itemHeight: 2, textStyle: { color: Kit.css('muted'), fontSize: 9.5, fontFamily: Kit.css('mono') } },
      xAxis: Kit.axis('category', { data: days }),
      yAxis: [Kit.axis('value', { min: 94, max: 100, axisLabel: { formatter: (v: number) => v + '%' } }), { ...Kit.axis('value'), splitLine: { show: false } }],
      series: [
        { name: 'Yield', type: 'line', data: days.map(() => +(96.4 + r() * 2.6).toFixed(1)), symbolSize: 4,
          lineStyle: { width: 1.6, color: Kit.css('pos') }, itemStyle: { color: Kit.css('pos') },
          markLine: { symbol: 'none', label: { show: true, formatter: 'Target 97.5%', fontSize: 9, color: Kit.css('accent'), fontFamily: Kit.css('mono') },
            lineStyle: { type: [4, 4], color: Kit.css('accent'), width: 1 }, data: [{ yAxis: 97.5 }] } },
        { name: 'Output', type: 'bar', yAxisIndex: 1, data: days.map(() => Math.round(820 + r() * 260)), barWidth: '46%',
          itemStyle: { color: Kit.css('s3'), opacity: .42 } },
      ],
    }
  }

  const submit = () => {
    const devTxt = fdev.current!.value.slice(0, 5)
    const type = ftype.current!.value, d = desc.current!.value.trim()
    const t: Ticket = { id: 'WO-' + (2610 + tickets.length), dev: devTxt,
      line: devs.find((x: Dev) => x.id === devTxt)?.line || '—',
      ti: d || (type === 'Inspection OK' ? 'Routine inspection; all parameters normal' : type),
      st: type === 'Report exception' ? 'Open' : 'Complete',
      h: 0, over: false, by: 'This terminal', photo: photoOn }
    tickets.unshift(t)
    VITALS.done = Math.min(VITALS.plan, VITALS.done + 1)
    if (type === 'Report exception') VITALS.abn++
    addLog(`WO_CREATE · ${devTxt}`, type === 'Report exception' ? 'warn' : 'ok')
    setModal(false); redraw()
    desc.current!.value = ''; setPhotoOn(false)
    Kit.toast((foff.current!.checked ? 'Submitted (offline queue on)' : 'Submitted') + ' · ' + t.id)
  }

  return (
    <>
      <header>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div className="ascii">
            <div className="lg">OPS<em>▮</em>TERM</div>
            <div className="sub">EQUIPMENT INSPECTION</div>
          </div>
          <div className="spacer" />
          <div className="btns">
            <button className="btn primary" id="btn-report" onClick={() => setModal(true)}>＋ Field report</button>
            <span id="theme-slot" ref={themeSlot} />
          </div>
        </div>
        <div className="sysline">
          <div>SESSION: <b>TERM-04A</b></div>
          <div>LOC: <b>East Plant · Workshop 2</b></div>
          <div>STATUS: <b className="st-ok">ON_LINE</b></div>
          <div>SHIFT: <b>Morning 07:30–15:30</b></div>
          <div>SYS_TIME: <b id="clock">{now}</b></div>
        </div>
      </header>

      <div className="halftone" />

      <div className="app">
        <div className="row r1">
          <section className="cell">
            <div className="ph"><h2>CORE VITALS · INSPECTION</h2><span className="tail">[CHK] THIS SHIFT</span></div>
            <div className="pb" id="vitals">
              {vrows.map(r => (
                <div className={'vrow' + (r.warn ? ' warn' : '')} key={r.l}>
                  <div className="t"><span>{r.l}</span><span className="dots" /><b>{r.v}</b></div>
                  <div className="blocks" dangerouslySetInnerHTML={{ __html: blocks(Math.min(100, r.pc)) }} />
                  <div className="den">{r.den}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>PATROL RADAR</h2><span className="tail">SWEEP 4.2S</span></div>
            <div className="radar-wrap" id="radar" ref={radarHost}>
              <span className="radar-note">BLIP = CHECKPOINT · RADIUS = DISTANCE</span>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>EVENT LOG</h2><span className="tail">LAST_50</span></div>
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
            <div className="ph"><h2>DEVICE MATRIX</h2><span className="tail">32 UNITS · CLICK TO SELECT</span></div>
            <div className="pb">
              <div className="devgrid" id="devgrid">
                {devs.map((d: Dev) => (
                  <div key={d.id} className={`dev ${d.st}` + (d === sel ? ' sel' : '')}
                       title={`${d.id} · ${d.line} line · ${ST_LBL[d.st]}`}
                       onClick={() => setSel(s => s === d ? null : d)}>
                    <i /><span className="n">{d.id}</span>
                  </div>
                ))}
              </div>
              <div className="devstat" id="devstat">
                {!sel ? 'No device selected — click a matrix cell to view details and work orders.' : <>
                  <span className="clr" id="dev-clr"
                        onClick={e => { e.stopPropagation(); setSel(null) }}>Clear selection ×</span>
                  <b>{sel.id}</b>{` · ${sel.line} line · Status `}<b>{ST_LBL[sel.st]}</b><br />
                  {`Runtime ${Kit.fmt(sel.run)} h · Next maintenance ${Math.round(120 + R() * 80)} h · Open work orders `}
                  <b>{tickets.filter((t: Ticket) => t.dev === sel.id && t.st !== 'Verified').length}</b>
                </>}
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>WORK ORDERS</h2>
              <span className="tail" id="wo-tail">
                {`${tickets.filter((t: Ticket) => t.over).length} overdue`}</span></div>
            <div className="pb">
              <div className="pipe" id="pipe">
                {STAGES.map((s: string) => (
                  <div key={s} className={pipeSel === s ? 'on' : ''}
                       onClick={() => setPipeSel(p => p === s ? null : s)}>
                    <div className="n">{tickets.filter((t: Ticket) => t.st === s).length}</div>
                    <div className="l">{s}</div>
                  </div>
                ))}
              </div>
              <div id="tickets">
                {!list.length ? <div className="tk"><div className="m">No work orders match this filter.</div></div>
                  : list.map(t => {
                    const nx = ({ Open: 'Start work', Working: 'Mark complete', Complete: 'Verify' } as Record<string, string>)[t.st]
                    return (
                      <div className={'tk' + (t.over ? ' over' : '')} key={t.id}>
                        <div className="t"><span className="id">{t.id}</span><span className="ti">{t.ti}</span>
                          <span className={'st st-' + t.st}>{t.st}</span></div>
                        <div className="m">
                          {`${t.dev} · ${t.line} line · Reported ${t.h}h ago · ${t.by}${t.photo ? ' · 📷1' : ''}`}
                          {t.over ? <> · <b style={{ color: 'var(--accent)' }}>OVERDUE</b></> : null}
                        </div>
                        <div className="acts">
                          {nx && <button onClick={e => { e.stopPropagation(); advance(t) }}>{nx + ' →'}</button>}
                          <button onClick={e => { e.stopPropagation(); Kit.toast(`${t.id} · ${t.ti} (demo)`) }}>Details</button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </section>

          <section className="cell">
            <div className="ph"><h2>LINE YIELD</h2><span className="tail">7D</span></div>
            <div className="pb" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Chart id="c-yield" className="" style={{ flex: 1, minHeight: 0 }} build={yieldOpt} />
            </div>
          </section>
        </div>
      </div>

      <div className={'veil' + (modal ? ' on' : '')} id="veil" onClick={() => setModal(false)} />
      <div className={'modal' + (modal ? ' on' : '')} id="modal">
        <h3>FIELD REPORT</h3>
        <div className="fm">
          <label>Device</label>
          {/* The device list only renders when the report modal opens,
              and the currently selected device is pre-selected as it does */}
          <select id="f-dev" ref={fdev} key={modal ? (sel ? sel.id : 'all') : 'closed'}
                  defaultValue={sel ? `${sel.id} · ${sel.line} line` : undefined}>
            {modal ? devs.map((d: Dev) => <option key={d.id}>{`${d.id} · ${d.line} line`}</option>) : null}
          </select>
          <label>Type</label>
          <select id="f-type" ref={ftype}><option>Inspection OK</option><option>Report exception</option><option>Maintenance complete</option></select>
          <label>Description</label>
          <textarea id="f-desc" placeholder="Observed issue / recommended action…" ref={desc} />
          <label>Photo</label>
          <div className="photo-line">
            <button className="btn" id="f-photo" onClick={() => setPhotoOn(true)}>Attach photo</button>
            <span className={'thumb' + (photoOn ? ' on' : '')} id="f-thumb">IMG</span>
            <span id="f-photo-n">{photoOn ? '1 attached (demo)' : 'None attached'}</span>
          </div>
          <label />
          <label className="offnote"><input type="checkbox" id="f-offline" defaultChecked ref={foff} />Queue offline when workshop signal is weak; submit after reconnect</label>
        </div>
        <div className="ftr">
          <button className="btn" id="f-cancel" onClick={() => setModal(false)}>Cancel</button>
          <button className="btn primary" id="f-submit" onClick={submit}>Submit</button>
        </div>
      </div>
    </>
  )
}
