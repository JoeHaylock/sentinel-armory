import { ST_LBL } from '../lib/ops.js'

interface Issue {
  id: string; itemId: string; slot: string; name: string; icon: string | null
  type: string; loc: string; sev: string; score: number; note: string
  shots: number; dir: 'OUT' | 'IN'; by: string; t: string; st: string
}
interface ItemLike { id: string; name: string; st: string; cond: number; serial: string }
interface Props {
  issue: Issue
  item?: ItemLike
  onClose: () => void
  onAction: (action: 'return-rack' | 'work-order' | 'deploy-anyway', issue: Issue) => void
}

/* Issue detail — opened from a flagged movement-queue row, a log row, or the
   item's issue history. Shows exactly what the AI check recorded. */
export default function IssueDetail({ issue, item, onClose, onAction }: Props) {
  return (
    <>
      <div className="veil on" onClick={onClose} />
      <div className="modal issue on">
        <h3>ISSUE RECORD · {issue.id}</h3>
        <div className="scan-meta">
          <span>{issue.name}</span><span className="dots" /><span>{issue.slot}</span>
        </div>

        <div className="issue-hero">
          {issue.icon && <img src={`/icons/${issue.icon}.png`} alt={issue.name} />}
          <div className="issue-score">
            <div className="n">{issue.score}<span>/100</span></div>
            <div className="l">AI condition score</div>
            <div className={'sev sev-' + issue.sev.toLowerCase()}>{issue.sev} severity</div>
          </div>
        </div>

        <table className="spec issue-spec">
          <tbody>
            <tr><td>Defect</td><td>{issue.type}</td></tr>
            <tr><td>Location</td><td>{issue.loc}</td></tr>
            <tr><td>AI note</td><td>{issue.note}</td></tr>
            <tr><td>Detected</td><td>{issue.t} · on {issue.dir === 'IN' ? 'return' : 'deploy'} · by {issue.by}</td></tr>
            <tr><td>Evidence</td><td>{issue.shots} frames captured · serial OCR matched</td></tr>
            <tr><td>Asset</td><td>{issue.itemId}{item ? ` · SN ${item.serial}` : ''}</td></tr>
            <tr><td>Item state</td><td>{item ? ST_LBL[item.st] + ` · cond ${item.cond}/100` : '—'}</td></tr>
            <tr><td>Review status</td><td>{issue.st}</td></tr>
          </tbody>
        </table>

        <div className="ftr">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn" onClick={() => onAction('work-order', issue)}>Raise repair work order</button>
          {item?.st === 'hold' && (
            <button className="btn" onClick={() => onAction('return-rack', issue)}>Return to rack</button>
          )}
          {item?.st === 'hold' && (
            <button className="btn primary" onClick={() => onAction('deploy-anyway', issue)}>Override &amp; deploy →</button>
          )}
        </div>
      </div>
    </>
  )
}
