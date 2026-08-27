import { useState } from 'react'
import { ST_LBL } from '../lib/ops.js'

interface Item { slot: string; id: string; cat: string; name: string; type: string; icon: string | null
                 photo: string | null; serial: string; extra: Record<string, string>
                 st: string; cond: number; svc: number; lastChk: string; cust: string | null }
interface Cat { key: string; blurb: string; photo: string | null }
interface Props {
  items: Item[]
  cats: Cat[]
  onAction: (it: Item, dir: 'OUT' | 'IN') => void
  onClearHold: (it: Item) => void
}

/* Stock catalog — categories on the left, drill into one to see every
   tracked item with its photo, serial, live status and movement actions. */
export default function Catalog({ items, cats, onAction, onClearHold }: Props) {
  const [openCat, setOpenCat] = useState<string | null>('Rifles')
  const [openItem, setOpenItem] = useState<string | null>(null)

  const inCat = (k: string) => items.filter(i => i.cat === k)
  const selected = items.find(i => i.id === openItem) || null

  return (
    <div className="catalog">
      {/* ── category rail ── */}
      <div className="catlist">
        <div className="ph" style={{ padding: '9px 13px 6px' }}><h2>ACTIVE STOCK · CATEGORIES</h2></div>
        {cats.map(c => {
          const its = inCat(c.key)
          const out = its.filter(i => i.st === 'out').length
          const open = openCat === c.key
          return (
            <div key={c.key} className={'catrow' + (open ? ' open' : '')} onClick={() => { setOpenCat(open ? null : c.key); setOpenItem(null) }}>
              <div className="catrow-t">
                <span className="chev">{open ? '▾' : '▸'}</span>
                <span className="catname">{c.key}</span>
                <span className="dots" />
                <b>{its.length}</b>
                <span className={'catstat' + (out ? ' out' : '')}>{out ? `${out} out` : 'all in'}</span>
              </div>
              <div className="catrow-b">{c.blurb}</div>
              {open && (
                <div className="catitems" onClick={e => e.stopPropagation()}>
                  {its.map(it => (
                    <div key={it.id} className={'catitem' + (openItem === it.id ? ' sel' : '')}
                         onClick={() => setOpenItem(openItem === it.id ? null : it.id)}>
                      <span className={'dot ' + it.st} />
                      <span className="nm">{it.name}</span>
                      <span className="sn">{it.serial}</span>
                      <span className={'st ' + it.st}>{ST_LBL[it.st]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── item detail ── */}
      <div className="catdetail">
        {!selected ? (
          <div className="cat-empty">
            <div className="big">▦</div>
            <div>Select a category, then an item, to open its record.</div>
            <div className="den">Photos are representative stock shots; the blueprint glyph is the canonical rack icon.</div>
          </div>
        ) : (
          <div className="catcard">
            <div className="catphoto">
              {selected.photo
                ? <img src={selected.photo} alt={selected.name}
                       onError={e => { (e.target as HTMLImageElement).style.display = 'none';
                                       (e.target as HTMLImageElement).parentElement!.classList.add('noimg') }} />
                : null}
              {(!selected.photo) && selected.icon && <img className="glyph" src={`/icons/${selected.icon}.png`} alt={selected.name} />}
              <span className="catphoto-tag">STOCK PHOTO · {selected.cat.toUpperCase()}</span>
            </div>
            <div className="catinfo">
              <div className="t"><b>{selected.name}</b><span className={'dir st-' + selected.st}>{ST_LBL[selected.st]}</span></div>
              <table className="spec">
                <tbody>
                  <tr><td>Asset ID</td><td>{selected.id}</td></tr>
                  <tr><td>Serial</td><td>{selected.serial}</td></tr>
                  <tr><td>Class</td><td>{selected.type}</td></tr>
                  {'size' in selected.extra ? <tr><td>Size</td><td>{selected.extra.size}</td></tr> : null}
                  <tr><td>Rack slot</td><td>{selected.slot}</td></tr>
                  <tr><td>Condition</td><td>{selected.cond}/100</td></tr>
                  <tr><td>Service hours</td><td>{selected.svc}</td></tr>
                  <tr><td>Last AI check</td><td>{selected.lastChk}</td></tr>
                  <tr><td>Custodian</td><td>{selected.cust || '—'}</td></tr>
                </tbody>
              </table>
              <div className="acts" style={{ marginTop: 10 }}>
                {selected.st === 'rack' && <button onClick={() => onAction(selected, 'OUT')}>Deploy OUT → AI check</button>}
                {selected.st === 'out' && <button onClick={() => onAction(selected, 'IN')}>Retrieve IN → AI check</button>}
                {selected.st === 'hold' && <button className="done" onClick={() => onClearHold(selected)}>Clear hold → rack</button>}
                {selected.st === 'check' && <span style={{ color: 'var(--warn)' }}>AI check in progress…</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
