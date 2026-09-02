import {
  CLS_LBL, CLS_SHORT, STAFF, ST_LBL, asset, hhmm, isOverdue, isStale,
  lastHandover, lastNote, readiness, relevantPhotos,
} from '../lib/ops.js'

type Cls = 'good' | 'flagged' | 'ooa'
interface Photo { src: string | null; kind: string | null; at: string | null; by?: string | null; label: string }
interface Item {
  slot: string; id: string; cat: string; name: string; type: string; icon: string | null
  photo: string | null; serial: string; extra: Record<string, string>
  st: string; cls: Cls; flags: string[]; svc: number; lastChk: string; cust: string | null
  outAt: string | null; dueAt: string | null; photoAt: string
  notes: { t: string; by: string; text: string }[]
  gradeHist: { t: string; cls: Cls; by: string; source: string; prev?: Cls }[]
  moves: { t: string; dir: 'OUT' | 'IN'; by: string; signed: string; photo: { src: string; kind: string; at: string } | null; note: string; cls: Cls }[]
  pending: { cls: Cls; tags: string[]; note: string; dir: 'OUT' | 'IN'; at: string; shots?: number } | null
}

interface Props {
  item: Item
  onClose: () => void
  onTakeOut: (it: Item) => void
  onReturn: (it: Item) => void
  onConfirm: (it: Item) => void
  onOverride: (it: Item, cls: Cls) => void
  onOpenIssue: (id: string) => void
  issueIds?: string[]
}

function ClsChip({ cls, stale }: { cls: Cls; stale?: boolean }) {
  return (
    <span className={'cls-chip cls-' + cls + (stale ? ' stale' : '')}>
      {stale ? 'Photo stale' : CLS_SHORT[cls]}
    </span>
  )
}

export default function ItemDrawer({ item, onClose, onTakeOut, onReturn, onConfirm, onOverride, onOpenIssue, issueIds }: Props) {
  const photos = relevantPhotos(item) as Photo[]
  const note = lastNote(item)
  const hand = lastHandover(item)
  const stale = isStale(item.photoAt)
  const ready = readiness(item)
  const returning = item.st === 'out'
  const hist = (item.gradeHist || []).slice(-6)
  const wear = wearLine(hist)

  return (
    <>
      <div className="veil on" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={item.name}>
        <div className="drawer-h">
          <div>
            <div className="drawer-kicker">{item.slot} · {item.id}</div>
            <h3>{item.name}</h3>
            <div className="drawer-sub">
              SN {item.serial} · {item.type}
              {item.extra?.size ? ' · ' + item.extra.size : ''}
            </div>
          </div>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="drawer-chips">
          <ClsChip cls={item.cls} />
          {stale && <ClsChip cls={item.cls} stale />}
          <span className={'rdy rdy-' + ready}>
            {ready === 'stale' ? 'Readiness grey' : ready === 'ready' ? 'Ready' : ready === 'overdue' ? 'Overdue' : CLS_SHORT[item.cls]}
          </span>
          <span className={'st-pill st-' + item.st}>{ST_LBL[item.st as keyof typeof ST_LBL] || item.st}</span>
        </div>

        <div className="photos3">
          {photos.map((p, i) => (
            <figure key={i} className={!p.src ? 'empty' : ''}>
              {p.src
                ? <img src={asset(p.src)} alt={p.label} />
                : <div className="ph-empty">No still</div>}
              <figcaption>
                <b>{p.label}</b>
                <span>{p.at ? hhmm(p.at) : '--'}{p.by ? ' · ' + p.by : ''}</span>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="photos3-hint">
          {returning ? 'Return check: last take-out, last return, this take-out.'
                     : 'Take-out check: last return, last take-out, last return.'}
        </div>

        <dl className="spec-dl">
          <div><dt>Owner</dt><dd>{item.cust || 'In cage'}</dd></div>
          <div><dt>Slot</dt><dd>
            {item.st === 'out'
              ? <>Out {hhmm(item.outAt)} · due {hhmm(item.dueAt)}{isOverdue(item.dueAt) ? ' · overdue' : ''}</>
              : 'In rack'}
          </dd></div>
          <div><dt>Last note</dt><dd>{note ? <>{note.text} <span className="dim">· {note.by} · {hhmm(note.t)}</span></> : 'None'}</dd></div>
          <div><dt>Last handover</dt><dd>{hand ? <>{hand.dir} · {hand.by} · {hhmm(hand.t)} <span className="dim">signed {hand.signed}</span></> : 'None'}</dd></div>
          <div><dt>Flags</dt><dd>{item.flags?.length ? item.flags.join(', ') : 'None'}</dd></div>
          <div><dt>Wear</dt><dd>{wear}</dd></div>
        </dl>

        {item.pending && (
          <div className="ai-gate">
            <div className="ai-gate-h">AI proposal · not a decision</div>
            <div className="ai-gate-b">
              <ClsChip cls={item.pending.cls} />
              {item.pending.tags?.map(t => <span className="tag" key={t}>{t}</span>)}
            </div>
            <p>{item.pending.note}</p>
            <div className="ai-gate-f">
              <button className="btn primary" onClick={() => onConfirm(item)}>Confirm · {STAFF}</button>
              <span className="ovr">Override</span>
              {(['good', 'flagged', 'ooa'] as Cls[]).filter(c => c !== item.pending!.cls).map(c => (
                <button key={c} className="btn" onClick={() => onOverride(item, c)}>{CLS_SHORT[c]}</button>
              ))}
            </div>
            <div className="sign">Staff gate · signed as {STAFF}</div>
          </div>
        )}

        <div className="acts drawer-acts">
          {item.st === 'rack' && !item.pending && <button className="btn primary" onClick={() => onTakeOut(item)}>Take out</button>}
          {item.st === 'out' && !item.pending && <button className="btn primary" onClick={() => onReturn(item)}>Return</button>}
          {item.st === 'hold' && item.cls === 'ooa' && <span className="dim">OOA · no issue until repair sign-off</span>}
          {item.pending && <span className="dim">Confirm or override the proposal before movement</span>}
        </div>

        <div className="ih-t">Grade history</div>
        <ol className="grade-hist">
          {hist.map((g, i) => (
            <li key={i}>
              <span className={'cls-chip cls-' + g.cls}>{CLS_LBL[g.cls]}</span>
              <span>{hhmm(g.t)} · {g.by}</span>
              <span className="dim">{g.source}{g.prev && g.prev !== g.cls ? ' · ' + CLS_SHORT[g.prev] + ' to ' + CLS_SHORT[g.cls] : ''}</span>
            </li>
          ))}
        </ol>

        <div className="ih-t">Request / return log</div>
        <ol className="move-log">
          {[...(item.moves || [])].reverse().map((m, i) => (
            <li key={i}>
              {m.photo && <img src={asset(m.photo.src)} alt="" />}
              <div>
                <b>{m.dir === 'OUT' ? 'Take-out' : 'Return'}</b> · {hhmm(m.t)} · {m.by}
                <div className="dim">{CLS_SHORT[m.cls]} · signed {m.signed}{m.note ? ' · ' + m.note : ''}</div>
              </div>
            </li>
          ))}
        </ol>

        {issueIds && issueIds.length > 0 && (
          <button className="issuelink" onClick={() => onOpenIssue(issueIds[0])}>{issueIds.length} open record{issueIds.length > 1 ? 's' : ''} on file</button>
        )}
      </aside>
    </>
  )
}

function wearLine(hist: { cls: Cls }[]) {
  if (hist.length < 2) return 'No trend'
  const last = hist[hist.length - 1]
  const prev = hist[hist.length - 2]
  if (prev.cls === 'flagged' && last.cls === 'flagged') return 'Two consecutive Flagged'
  if (prev.cls === 'good' && last.cls === 'ooa') return 'Drop Good to OOA'
  if (prev.cls === 'good' && last.cls === 'flagged') return 'Drop Good to Flagged'
  if (prev.cls !== last.cls) return CLS_SHORT[prev.cls] + ' to ' + CLS_SHORT[last.cls]
  return 'Stable ' + CLS_SHORT[last.cls]
}
