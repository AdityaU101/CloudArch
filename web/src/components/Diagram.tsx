import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { providers } from '../data/catalog'
import type { ArchNode, Architecture } from '../lib/generate'
import { cn, usd } from '../lib/cn'

const W = 174
const H = 58
const COL = 216
const ROW = 94
const PAD = 40
const EXPO = [0.16, 1, 0.3, 1] as const

const pos = (n: ArchNode) => ({ x: PAD + n.col * COL, y: PAD + 26 + n.row * ROW })
const isExternal = (n: ArchNode) => n.kind === 'client' || n.kind === 'devices'

/**
 * Right-angle connector, the way a schematic is drafted: out of the facing
 * side, along a trunk in the gap between columns, into the target.
 */
function route(a: ArchNode, b: ArchNode) {
  const pa = pos(a)
  const pb = pos(b)
  if (a.col === b.col) {
    const down = b.row > a.row
    const x = pa.x + W / 2
    const y1 = down ? pa.y + H : pa.y
    const y2 = down ? pb.y : pb.y + H
    return { d: `M${x} ${y1}V${y2}`, label: { x: x + 7, y: (y1 + y2) / 2 + 3, anchor: 'start' as const } }
  }
  const forward = b.col > a.col
  const x1 = forward ? pa.x + W : pa.x
  const x2 = forward ? pb.x : pb.x + W
  // Returns leave lower on the box so they do not sit on top of the inbound line.
  const y1 = pa.y + (forward ? H / 2 : H * 0.78)
  const y2 = pb.y + H / 2
  const trunk = (x1 + x2) / 2 + (forward ? 0 : -12)
  const flat = Math.abs(y1 - y2) < 1
  return {
    d: flat ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}H${trunk}V${y2}H${x2}`,
    label: flat
      ? { x: (x1 + x2) / 2, y: y1 - 6, anchor: 'middle' as const }
      : { x: trunk, y: (y1 + y2) / 2 + 3.5, anchor: 'middle' as const }, // sits on the trunk, breaking the line
  }
}

export function Diagram({
  arch,
  drawKey,
  active,
  onActive,
}: {
  arch: Architecture
  drawKey: number
  active: string | null
  onActive: (id: string | null) => void
}) {
  const reduce = useReducedMotion()
  const byId = useMemo(() => Object.fromEntries(arch.nodes.map((n) => [n.id, n])), [arch.nodes])
  const provider = providers.find((p) => p.id === arch.provider)!

  const maxCol = Math.max(...arch.nodes.map((n) => n.col))
  const maxRow = Math.max(...arch.nodes.map((n) => n.row))
  const width = PAD * 2 + maxCol * COL + W
  const height = PAD * 2 + 26 + maxRow * ROW + H

  const inside = arch.nodes.filter((n) => !isExternal(n)).map(pos)
  const bx = Math.min(...inside.map((p) => p.x)) - 26
  const by = Math.min(...inside.map((p) => p.y)) - 40
  const bw = Math.max(...inside.map((p) => p.x)) + W + 26 - bx
  const bh = Math.max(...inside.map((p) => p.y)) + H + 22 - by

  const linked = (id: string) =>
    active === id || arch.edges.some((e) => (e.from === active && e.to === id) || (e.to === active && e.from === id))

  return (
    <div>
      <p className="lettering mb-2 lg:hidden">Scroll sideways to follow the flow →</p>
      <div className="overflow-x-auto">
        <svg
          key={drawKey}
          viewBox={`0 0 ${width} ${height}`}
          className="block h-auto w-full min-w-[880px]"
          role="img"
          aria-label={`Topology for ${arch.scenario.title} on ${provider.name}, ${arch.nodes.length} components`}
          onPointerLeave={() => onActive(null)}
        >
          <defs>
            <marker id="tip" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 1L10 5L0 9Z" fill="context-stroke" />
            </marker>
          </defs>

          {/* Account boundary, drawn as a chain line with a leader label */}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
            <rect x={bx} y={by} width={bw} height={bh} fill="none" stroke="var(--color-ink)" strokeWidth="0.9" strokeDasharray="14 4 2 4" />
            <rect x={bx + 14} y={by - 9} width={`${provider.label} account · ${provider.region}`.length * 7.1 + 18} height="18" fill="var(--color-paper)" />
            <text x={bx + 22} y={by + 4} className="lettering" fill="var(--color-ink)" style={{ fontSize: 11 }}>
              {provider.label} account · {provider.region}
            </text>
          </motion.g>

          {arch.edges.map((e, i) => {
            const a = byId[e.from]
            const b = byId[e.to]
            const r = route(a, b)
            const on = active !== null && (e.from === active || e.to === active)
            const dim = active !== null && !on
            const delay = reduce ? 0 : 0.3 + Math.min(a.col, b.col) * 0.2 + i * 0.025
            return (
              <g key={`${e.from}-${e.to}`} style={{ opacity: dim ? 0.22 : 1, transition: 'opacity 0.2s' }}>
                <motion.path
                  d={r.d}
                  fill="none"
                  stroke={on ? 'var(--color-red)' : 'var(--color-ink)'}
                  strokeWidth={on ? 1.6 : 1.1}
                  strokeDasharray={e.dashed || on ? '5 3' : undefined}
                  style={on && !reduce ? { animation: 'march 0.7s linear infinite' } : undefined}
                  markerEnd="url(#tip)"
                  initial={e.dashed ? { opacity: 0 } : { pathLength: 0, opacity: 1 }}
                  animate={e.dashed ? { opacity: 1 } : { pathLength: 1 }}
                  transition={{ duration: 0.8, ease: EXPO, delay }}
                />
                {e.label && (
                  <motion.text
                    x={r.label.x}
                    y={r.label.y}
                    textAnchor={r.label.anchor}
                    className="lettering"
                    style={{ fontSize: 10, paintOrder: 'stroke' }}
                    fill={on ? 'var(--color-red)' : 'var(--color-ink-2)'}
                    stroke="var(--color-paper)"
                    strokeWidth="6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: delay + 0.5 }}
                  >
                    {e.label}
                  </motion.text>
                )}
              </g>
            )
          })}

          {arch.nodes.map((n, i) => {
            const p = pos(n)
            const ext = isExternal(n)
            const hot = active === n.id
            const dim = active !== null && !linked(n.id)
            const delay = reduce ? 0 : n.col * 0.2 + n.row * 0.04
            return (
              <g key={n.id} style={{ opacity: dim ? 0.3 : 1, transition: 'opacity 0.2s' }}>
                {/* Outline is plotted, then the lettering appears inside it */}
                <motion.rect
                  x={p.x}
                  y={p.y}
                  width={W}
                  height={H}
                  fill="var(--color-paper)"
                  stroke={hot ? 'var(--color-red)' : 'var(--color-ink)'}
                  strokeWidth={hot ? 2 : 1.4}
                  strokeDasharray={ext ? '4 3' : undefined}
                  initial={ext ? { opacity: 0 } : { pathLength: 0 }}
                  animate={ext ? { opacity: 1 } : { pathLength: 1 }}
                  transition={{ duration: 0.7, ease: EXPO, delay }}
                />
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: delay + 0.35 }}>
                  <foreignObject x={p.x} y={p.y} width={W} height={H}>
                    <button
                      type="button"
                      onPointerEnter={() => onActive(n.id)}
                      onFocus={() => onActive(n.id)}
                      onBlur={() => onActive(null)}
                      aria-label={`${i + 1}. ${n.service}: ${n.role}${n.cost ? `, about ${usd(n.cost)} per month` : ''}`}
                      className="flex h-full w-full flex-col justify-center px-3 pl-5 text-left outline-none"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={n.service}
                          className={cn('block truncate text-[14.5px] font-semibold leading-tight', hot && 'text-red')}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16 }}
                        >
                          {n.service}
                        </motion.span>
                      </AnimatePresence>
                      <span className="mt-1 block truncate text-[11.5px] leading-tight text-ink-2 [font-stretch:88%]">{n.role}</span>
                    </button>
                  </foreignObject>
                  {/* Item balloon, keyed to the schedule */}
                  <circle cx={p.x} cy={p.y} r="10.5" fill={hot ? 'var(--color-red)' : 'var(--color-paper)'} stroke={hot ? 'var(--color-red)' : 'var(--color-ink)'} strokeWidth="1.2" />
                  <text x={p.x} y={p.y + 3.8} textAnchor="middle" className="ref" style={{ fontSize: 10.5, fontWeight: 500 }} fill={hot ? 'var(--color-paper)' : 'var(--color-ink)'}>
                    {i + 1}
                  </text>
                </motion.g>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
