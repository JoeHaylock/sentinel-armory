import { useEffect, useRef, useState } from 'react'

/* AI photo-check demo — simulates the future vision API:
   frame 1 → prompt the user to turn the item → frame 2 → verdict.
   Nothing here calls a real model; verdicts are weighted-random demo output. */

export interface ScanResult {
  verdict: 'PASS' | 'FLAG'
  score: number
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
  onDone: (r: ScanResult | null) => void   // null = aborted
}

type Stage = 'FRAME1' | 'TURN' | 'FRAME2' | 'ANALYSE' | 'VERDICT'

const FLAG_NOTES = ['Surface wear on rail interface', 'Serial plate partially obscured', 'Strap fray detected at stitch line']
const PASS_NOTES = ['Condition nominal', 'No defects detected', 'Wear within tolerance']

export default function AiScan({ item, dir, onDone }: Props) {
  const [stage, setStage] = useState<Stage>('FRAME1')
  const [line, setLine] = useState('AI_VISION v0.9 · DEMO BUILD — no live model attached')
  const [result, setResult] = useState<ScanResult | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const later = (fn: () => void, ms: number) => { timer.current = setTimeout(fn, ms) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /* frame 1 capture */
  useEffect(() => {
    setLine('Acquiring frame 1/2 · hold item steady…')
    later(() => { setStage('TURN'); setLine('Frame 1 captured ✓') }, 1900)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const turned = () => {
    setStage('FRAME2'); setLine('Acquiring frame 2/2 · new angle…')
    later(() => {
      setStage('ANALYSE'); setLine('Running defect pass · OCR serial read…')
      later(() => {
        const flag = Math.random() < .12
        const r: ScanResult = {
          verdict: flag ? 'FLAG' : 'PASS',
          score: flag ? Math.round(62 + Math.random() * 14) : Math.round(90 + Math.random() * 9),
          serial: item.serial,
          note: flag ? FLAG_NOTES[Math.floor(Math.random() * FLAG_NOTES.length)]
                     : PASS_NOTES[Math.floor(Math.random() * PASS_NOTES.length)],
          shots: 2,
        }
        setResult(r); setStage('VERDICT')
        setLine(flag ? 'Anomaly flagged — review required' : 'All checks passed')
      }, 1700)
    }, 1700)
  }

  const STAGE_TXT: Record<Stage, string> = {
    FRAME1: 'STEP 1/3 · FRONT PROFILE', TURN: 'STEP 2/3 · ROTATE ITEM',
    FRAME2: 'STEP 2/3 · SECOND ANGLE', ANALYSE: 'STEP 3/3 · ANALYSIS', VERDICT: 'RESULT',
  }

  return (
    <>
      <div className="veil on" onClick={() => onDone(null)} />
      <div className="modal scan on">
        <h3>AI PHOTO CHECK · {dir === 'OUT' ? 'DEPLOY' : 'RETRIEVE'} {item.id}</h3>
        <div className="scan-meta">
          <span>{item.name}</span><span className="dots" /><span>{item.slot}</span>
        </div>

        <div className={'finder st-' + stage.toLowerCase()}>
          <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          {item.icon && (
            <img src={`/icons/${item.icon}.png`} alt={item.name}
                 className={'finder-item' + (stage === 'FRAME2' || (stage !== 'FRAME1' && stage !== 'TURN') ? ' alt' : '')} />
          )}
          {(stage === 'FRAME1' || stage === 'FRAME2') && <div className="scanline" />}
          {stage === 'ANALYSE' && <div className="analyse-grid" />}
          <div className="finder-tag">{STAGE_TXT[stage]}</div>
          {stage !== 'VERDICT' && stage !== 'TURN' && <div className="rec">● REC</div>}
        </div>

        <div className="scan-line">{line}</div>

        {stage === 'TURN' && (
          <div className="turn-box">
            <div className="turn-prompt">⟳ TURN ITEM — present the opposite profile to the camera</div>
            <button className="btn primary" onClick={turned}>Item turned — resume scan</button>
          </div>
        )}

        {stage === 'VERDICT' && result && (
          <div className={'verdict ' + result.verdict.toLowerCase()}>
            <div className="vrow2"><span>Verdict</span><b>{result.verdict === 'PASS' ? '✓ PASS' : '⚠ FLAG'}</b></div>
            <div className="vrow2"><span>Condition score</span><b>{result.score}/100</b></div>
            <div className="vrow2"><span>Serial OCR</span><b>{result.serial} · match</b></div>
            <div className="vrow2"><span>Note</span><b>{result.note}</b></div>
            <div className="vrow2"><span>Frames</span><b>{result.shots} captured</b></div>
            {result.verdict === 'FLAG' && (
              <div className="vrow2"><span>Record</span><b>Issue will be stored + flagged in the queue for review</b></div>
            )}
          </div>
        )}

        <div className="shotbar">
          <div className={'shot' + (stage !== 'FRAME1' ? ' got' : '')}>
            {item.icon && stage !== 'FRAME1' && <img src={`/icons/${item.icon}.png`} alt="frame 1" />}
            <span>F1</span>
          </div>
          <div className={'shot' + (stage === 'ANALYSE' || stage === 'VERDICT' ? ' got alt' : '')}>
            {item.icon && (stage === 'ANALYSE' || stage === 'VERDICT') && <img src={`/icons/${item.icon}.png`} alt="frame 2" />}
            <span>F2</span>
          </div>
          <div className="shotbar-note">2 angles required before the system marks the item</div>
        </div>

        <div className="ftr">
          {stage === 'VERDICT' && result ? (
            <>
              {result.verdict === 'FLAG' && (
                <button className="btn" onClick={() => onDone({ ...result, verdict: 'PASS', note: result.note + ' · manual override' })}>
                  Override &amp; mark anyway
                </button>
              )}
              <button className="btn primary" onClick={() => onDone(result)}>
                {result.verdict === 'PASS' ? `Mark ${dir === 'OUT' ? 'deployed' : 'retrieved'} in system →` : 'Record issue · send item to HOLD →'}
              </button>
            </>
          ) : (
            <button className="btn" onClick={() => onDone(null)}>Abort check</button>
          )}
        </div>
      </div>
    </>
  )
}
