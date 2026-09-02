import { useEffect, useRef, useState } from 'react'
import { CLS_SHORT, asset, proposeClass } from '../lib/ops.js'

export type Cls = 'good' | 'flagged' | 'ooa'
export interface ScanResult {
  cls: Cls
  tags: string[]
  serial: string
  note: string
  shots: number
}
export interface ScanTarget {
  id: string; slot: string; name: string; icon: string | null; serial: string
}
interface Props {
  item: ScanTarget
  dir: 'OUT' | 'IN'
  onDone: (r: ScanResult | null) => void
}

type Stage = 'FRAME1' | 'TURN' | 'FRAME2' | 'ANALYSE' | 'VERDICT'

export default function AiScan({ item, dir, onDone }: Props) {
  const [stage, setStage] = useState<Stage>('FRAME1')
  const [line, setLine] = useState('Two stills, then a class proposal. Staff decide.')
  const [result, setResult] = useState<ScanResult | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const later = (fn: () => void, ms: number) => { timer.current = setTimeout(fn, ms) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  useEffect(() => {
    setLine('Still 1 of 2')
    later(() => { setStage('TURN'); setLine('Still 1 held') }, 1400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const turned = () => {
    setStage('FRAME2'); setLine('Still 2 of 2')
    later(() => {
      setStage('ANALYSE'); setLine('Proposing class and defect tags')
      later(() => {
        const p = proposeClass()
        const r: ScanResult = { cls: p.cls as Cls, tags: p.tags, serial: item.serial, note: p.note, shots: 2 }
        setResult(r); setStage('VERDICT')
        setLine('Proposal ready — confirm or override')
      }, 1100)
    }, 1200)
  }

  const finish = (cls: Cls) => {
    if (!result) return
    onDone({ ...result, cls, tags: cls === 'good' ? [] : result.tags, note: cls === result.cls ? result.note : 'Override to ' + CLS_SHORT[cls] })
  }

  return (
    <>
      <div className="veil on" onClick={() => onDone(null)} />
      <div className="modal scan on">
        <h3>{dir === 'OUT' ? 'Take-out' : 'Return'} check · {item.id}</h3>
        <div className="scan-meta">
          <span>{item.name}</span><span className="dots" /><span>{item.slot}</span>
        </div>

        <div className={'finder st-' + stage.toLowerCase()}>
          <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          {item.icon && (
            <img src={asset('icons/' + item.icon + '.png')} alt={item.name}
                 className={'finder-item' + (stage === 'FRAME2' || (stage !== 'FRAME1' && stage !== 'TURN') ? ' alt' : '')} />
          )}
          <div className="finder-tag">{stage === 'VERDICT' ? 'PROPOSAL' : stage === 'TURN' ? 'TURN ITEM' : 'STILL'}</div>
        </div>

        <div className="scan-line">{line}</div>

        {stage === 'TURN' && (
          <div className="turn-box">
            <div className="turn-prompt">Present the opposite side</div>
            <button className="btn primary" onClick={turned}>Turned</button>
          </div>
        )}

        {stage === 'VERDICT' && result && (
          <div className={'verdict ' + result.cls}>
            <div className="vrow2"><span>Proposed class</span><b>{CLS_SHORT[result.cls]}</b></div>
            <div className="vrow2"><span>Tags</span><b>{(result.tags.length ? result.tags.join(', ') : 'None')}</b></div>
            <div className="vrow2"><span>Serial</span><b>{result.serial} match</b></div>
            <div className="vrow2"><span>Note</span><b>{result.note}</b></div>
            <div className="vrow2"><span>Stills</span><b>{result.shots}</b></div>
          </div>
        )}

        <div className="shotbar">
          <div className={'shot' + (stage !== 'FRAME1' ? ' got' : '')}>
            {item.icon && stage !== 'FRAME1' && <img src={asset('icons/' + item.icon + '.png')} alt="" />}
            <span>1</span>
          </div>
          <div className={'shot' + (stage === 'ANALYSE' || stage === 'VERDICT' ? ' got alt' : '')}>
            {item.icon && (stage === 'ANALYSE' || stage === 'VERDICT') && <img src={asset('icons/' + item.icon + '.png')} alt="" />}
            <span>2</span>
          </div>
          <div className="shotbar-note">AI proposes. Staff confirm.</div>
        </div>

        <div className="ftr">
          {stage === 'VERDICT' && result ? (
            <button className="btn primary" onClick={() => finish(result.cls)}>
              Send proposal to file
            </button>
          ) : (
            <button className="btn" onClick={() => onDone(null)}>Abort</button>
          )}
        </div>
      </div>
    </>
  )
}
