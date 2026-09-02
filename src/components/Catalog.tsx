import { useState } from 'react'
import { CLS_SHORT, ST_LBL, asset, isStale, issues } from '../lib/ops.js'

type Cls = 'good' | 'flagged' | 'ooa'
interface Item { slot: string; id: string; cat: string; name: string; type: string; icon: string | null
                 photo: string | null; serial: string; extra: Record<string, string>
                 st: string; cls: Cls; svc: number; lastChk: string; cust: string | null; photoAt: string }
interface Cat { key: string; blurb: string; photo: string | null }
interface Props {
  items: Item[]
  cats: Cat[]
  onAction: (it: Item, dir: 'OUT' | 'IN') => void
  onClearHold: (it: Item) => void
  onOpenIssue: (id: string) => void
  onOpenItem?: (it: Item) => void
}

export default function Catalog({ items, cats, onAction, onClearHold, onOpenIssue, onOpenItem }: Props) {
  const [openCat, setOpenCat] = useState<string | null>('Rifles')
  const [openItem, setOpenItem] = useState<string | null>(null)

  const inCat = (k: string) => items.filter(i => i.cat === k)
  const selected = items.find(i => i.id === openItem) || null

  return (
    <div className="catalog">
      <div className="catlist">
        <div className="ph" style={{ padding: '9px 13px 6px' }}><h2>Stock</h2></div>
        {cats.map(c => {
          const its = inCat(c.key)
          const out = its.filter(i => i.st === 'out').length
          const open = openCat === c.key
          return (
            <div key={c.key} className={'catrow' + (open ? ' open' : '')} onClick={() => { setOpenCat(open ? null : c.key); setOpenItem(null) }}>
              <div className="catrow-t">
                <span className="chev">{open ? 'v' : '>'}</span>
                <span className="catname">{c.key}</span>
                <span className="dots" />
                <b>{its.length}</b>
                <span className={'catstat' + (out ? ' out' : '')}>{out ? out + ' out' : 'all in'}</span>
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
                      <span className={'cls-chip cls-' + it.cls}>{CLS_SHORT[it.cls]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="catdetail">
        {!selected ? (
          <div className="cat-empty">
            <div>Select a category, then an item.</div>
            <div className="den">Opens the stock record. Use the board for due / out work.</div>
          </div>
        ) : (
          <div className="catcard">
            <div className="catphoto">
              {selected.photo
                ? <img src={asset(selected.photo)} alt={selected.name}
                       onError={e => { (e.target as HTMLImageElement).style.display = 'none';
                                       (e.target as HTMLImageElement).parentElement!.classList.add('noimg') }} />
                : null}
              {(!selected.photo) && selected.icon && <img className="glyph" src={asset('icons/' + selected.icon + '.png')} alt={selected.name} />}
              <span className="catphoto-tag">{selected.cat.toUpperCase()}</span>
            </div>
            <div className="catinfo">
              <div className="t">
                <b>{selected.name}</b>
                <span className={'cls-chip cls-' + selected.cls}>{isStale(selected.photoAt) ? 'Photo stale' : CLS_SHORT[selected.cls]}</span>
              </div>
              <table className="spec">
                <tbody>
                  <tr><td>Asset</td><td>{selected.id}</td></tr>
                  <tr><td>Serial</td><td>{selected.serial}</td></tr>
                  <tr><td>Type</td><td>{selected.type}</td></tr>
                  {'size' in selected.extra ? <tr><td>Size</td><td>{selected.extra.size}</td></tr> : null}
                  <tr><td>Slot</td><td>{selected.slot}</td></tr>
                  <tr><td>Class</td><td>{CLS_SHORT[selected.cls]}</td></tr>
                  <tr><td>Last photo</td><td>{selected.lastChk}{isStale(selected.photoAt) ? ' · stale' : ''}</td></tr>
                  <tr><td>Custodian</td><td>{selected.cust || '--'}</td></tr>
                  <tr><td>State</td><td>{ST_LBL[selected.st as keyof typeof ST_LBL]}</td></tr>
                </tbody>
              </table>
              <div className="acts" style={{ marginTop: 10 }}>
                {onOpenItem && <button onClick={() => onOpenItem(selected)}>Open file</button>}
                {selected.st === 'rack' && <button onClick={() => onAction(selected, 'OUT')}>Take out</button>}
                {selected.st === 'out' && <button onClick={() => onAction(selected, 'IN')}>Return</button>}
                {selected.st === 'hold' && <button className="done" onClick={() => onClearHold(selected)}>Return to rack</button>}
              </div>
              {(() => {
                const hist = (issues as { id: string; itemId: string; type: string; loc: string; cls: string; st: string }[]).filter(x => x.itemId === selected.id)
                return hist.length ? (
                  <div className="issuehist">
                    <div className="ih-t">RECORDS · {hist.length}</div>
                    {hist.map(x => (
                      <div key={x.id} className="ih-row" onClick={() => onOpenIssue(x.id)}>
                        <span className="ih-id">{x.id}</span>
                        <span className="ih-tx">{x.type} — {x.loc}</span>
                        <span className="ih-sc">{CLS_SHORT[x.cls as Cls] || x.cls}</span>
                        <span className={'ih-st st-' + x.st.replace(/\s/g, '')}>{x.st}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
