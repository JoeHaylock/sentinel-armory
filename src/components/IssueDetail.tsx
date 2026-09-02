import { CLS_LBL, CLS_SHORT, ST_LBL, asset } from '../lib/ops.js'

type Cls = 'good' | 'flagged' | 'ooa'
interface Issue {
  id: string; itemId: string; slot: string; name: string; icon: string | null
  type: string; loc: string; sev: string; cls: Cls; tags?: string[]; note: string
  shots: number; dir: 'OUT' | 'IN'; by: string; t: string; st: string
}
interface ItemLike { id: string; name: string; st: string; cls: Cls; serial: string }
interface Props {
  issue: Issue
  item?: ItemLike
  onClose: () => void
  onAction: (action: 'return-rack' | 'work-order' | 'deploy-anyway', issue: Issue) => void
}

export default function IssueDetail({ issue, item, onClose, onAction }: Props) {
  return (
    <>
      <div className="veil on" onClick={onClose} />
      <div className="modal issue on">
        <h3>Record · {issue.id}</h3>
        <div className="scan-meta">
          <span>{issue.name}</span><span className="dots" /><span>{issue.slot}</span>
        </div>

        <div className="issue-hero">
          {issue.icon && <img src={asset('icons/' + issue.icon + '.png')} alt={issue.name} />}
          <div className="issue-score">
            <div className={'cls-chip cls-' + issue.cls} style={{ fontSize: 14 }}>{CLS_LBL[issue.cls] || CLS_SHORT[issue.cls]}</div>
            <div className="l">Staff class on file</div>
            <div className={'sev sev-' + issue.sev.toLowerCase()}>{issue.sev}</div>
          </div>
        </div>

        <table className="spec issue-spec">
          <tbody>
            <tr><td>Defect</td><td>{issue.type}</td></tr>
            <tr><td>Location</td><td>{issue.loc}</td></tr>
            <tr><td>Note</td><td>{issue.note}</td></tr>
            <tr><td>When</td><td>{issue.t} · on {issue.dir === 'IN' ? 'return' : 'take-out'} · {issue.by}</td></tr>
            <tr><td>Stills</td><td>{issue.shots}</td></tr>
            <tr><td>Asset</td><td>{issue.itemId}{item ? ' · SN ' + item.serial : ''}</td></tr>
            <tr><td>Item</td><td>{item ? ST_LBL[item.st as keyof typeof ST_LBL] + ' · ' + CLS_SHORT[item.cls] : '--'}</td></tr>
            <tr><td>Status</td><td>{issue.st}</td></tr>
          </tbody>
        </table>

        <div className="ftr">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn" onClick={() => onAction('work-order', issue)}>Raise repair</button>
          {item?.st === 'hold' && (
            <button className="btn" onClick={() => onAction('return-rack', issue)}>Return to rack</button>
          )}
          {item?.st === 'hold' && (
            <button className="btn primary" onClick={() => onAction('deploy-anyway', issue)}>Override and issue</button>
          )}
        </div>
      </div>
    </>
  )
}
