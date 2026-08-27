/* ECharts host. Chart instances are imperative, and Kit keeps a registry that
   rebuilds them in place on theme change — so this component only hands an
   empty div to Kit.chart and pushes new options through Kit.update afterwards;
   React never touches the subtree. release() on unmount, or the next theme
   toggle would rebuild a chart that is no longer on the page. */
import { useEffect, useRef } from 'react'
import Kit from '../lib/kit.js'

export default function Chart({ id, build, deps = [], className = 'chart', style }: {
  id?: string
  build: () => object
  deps?: unknown[]
  className?: string
  style?: React.CSSProperties
}) {
  const host = useRef<HTMLDivElement>(null)
  const inst = useRef<{ resize: () => void } | null>(null)
  const latest = useRef(build)
  latest.current = build

  useEffect(() => {
    inst.current = Kit.chart(host.current, () => latest.current())
    return () => { Kit.release(inst.current); inst.current = null }
  }, [])

  /* The mount pass is already drawn by Kit.chart, so skip it here; and new
     options must merge — Kit.chart applies Kit.base() together with build(),
     and a full replace would wipe the tooltip / grid coming from base. */
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (inst.current) Kit.update(inst.current, latest.current())
  }, deps)

  return <div className={className} id={id} style={style} ref={host} />
}
