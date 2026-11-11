import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { providers, type Provider } from '../data/catalog'
import { build, type Architecture, type Level } from '../lib/generate'
import { cn, usd } from '../lib/cn'

const EXPO = [0.16, 1, 0.3, 1] as const

/** Number that counts to its new value. */
export function Count({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(value)
  const text = useTransform(mv, (v) => usd(Math.round(v)))
  useEffect(() => {
    if (reduce) return mv.set(value)
    const controls = animate(mv, value, { duration: 0.8, ease: EXPO })
    return () => controls.stop()
  }, [value, reduce, mv])
  return <motion.span className={className}>{text}</motion.span>
}

/** Red-pencil underline that is drawn under a figure. */
function Underline() {
  return (
    <svg viewBox="0 0 200 8" preserveAspectRatio="none" className="mt-1 h-2 w-full" aria-hidden="true">
      <motion.path
        d="M2 5C40 2 90 7 198 3"
        fill="none"
        stroke="var(--color-red)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: EXPO, delay: 0.5 }}
      />
    </svg>
  )
}

/** Component schedule beside the topology, keyed to the numbered balloons. */
export function Schedule({
  arch,
  active,
  onActive,
}: {
  arch: Architecture
  active: string | null
  onActive: (id: string | null) => void
}) {
  return (
    <table className="w-full border border-ink text-sm" onPointerLeave={() => onActive(null)}>
      <caption className="lettering border border-b-0 border-ink px-3 py-2 text-left !text-ink">Component schedule</caption>
      <thead>
        <tr className="lettering border-b border-ink text-left">
          <th scope="col" className="w-9 px-2 py-1.5 text-center font-medium">No.</th>
          <th scope="col" className="border-l border-rule px-2 py-1.5 font-medium">Service</th>
          <th scope="col" className="border-l border-rule px-2 py-1.5 text-right font-medium">$ / mo</th>
        </tr>
      </thead>
      <tbody>
        {arch.nodes.map((n, i) => {
          const hot = active === n.id
          return (
            <tr
              key={n.id}
              onPointerEnter={() => onActive(n.id)}
              className={cn('border-b border-rule transition-colors last:border-0', hot && 'bg-red/10 text-red')}
            >
              <td className="ref px-2 py-1.5 text-center !text-inherit">{i + 1}</td>
              <td className="border-l border-rule px-2 py-1.5">
                <span className="block font-medium leading-tight">{n.service}</span>
                <span className={cn('block text-xs leading-tight [font-stretch:88%]', hot ? 'text-red' : 'text-ink-2')}>{n.role}</span>
              </td>
              <td className="border-l border-rule px-2 py-1.5 text-right font-mono text-[13px] tabular-nums">{n.cost ? n.cost.toLocaleString('en-US') : '—'}</td>
            </tr>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="border-t border-ink">
          <td />
          <td className="lettering px-2 py-2 !text-ink">Total, estimated</td>
          <td className="px-2 py-2 text-right font-mono text-[13px] font-medium tabular-nums text-red">
            <Count value={arch.total} />
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

export function CostSheet({ arch, onProvider }: { arch: Architecture; onProvider: (p: Provider) => void }) {
  const rows = arch.nodes.filter((n) => n.cost > 0).sort((a, b) => b.cost - a.cost)
  const max = rows[0].cost
  const totals = providers.map((p) => ({ ...p, total: build(arch.scenario, p.id).total }))
  const cheapest = Math.min(...totals.map((t) => t.total))

  return (
    <div className="grid gap-8 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <div>
        <p className="lettering">Estimated monthly total</p>
        <div className="mt-2 inline-block">
          <Count value={arch.total} className="wide block text-6xl tabular-nums text-red" />
          <Underline />
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Sample figures for a baseline size of each service. They show how the estimate is built, not live pricing.
        </p>

        <table className="mt-8 w-full border border-ink text-sm">
          <caption className="lettering border border-b-0 border-ink px-3 py-2 text-left !text-ink">Same design, other clouds</caption>
          <tbody>
            {totals.map((t) => {
              const current = t.id === arch.provider
              return (
                <tr key={t.id} className="border-b border-rule last:border-0">
                  <td className="p-0">
                    <button
                      type="button"
                      onClick={() => onProvider(t.id)}
                      aria-pressed={current}
                      className={cn('flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left transition-colors', current ? 'bg-ink text-paper' : 'hover:bg-fill')}
                    >
                      <span>
                        <span className="block font-medium leading-tight">{t.label}</span>
                        <span className={cn('block text-xs [font-stretch:88%]', current ? 'text-paper/75' : 'text-ink-2')}>
                          {t.total === cheapest ? 'Lowest estimate' : `${usd(t.total - cheapest)} more`}
                        </span>
                      </span>
                      <span className="font-mono text-[13px] tabular-nums">{usd(t.total)}</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <table className="h-fit w-full border border-ink text-sm">
        <caption className="lettering border border-b-0 border-ink px-3 py-2 text-left !text-ink">Bill of quantities</caption>
        <thead>
          <tr className="lettering border-b border-ink text-left">
            <th scope="col" className="px-3 py-2 font-medium">Service</th>
            <th scope="col" className="hidden border-l border-rule px-3 py-2 font-medium md:table-cell">Role</th>
            <th scope="col" className="hidden border-l border-rule px-3 py-2 font-medium sm:table-cell">Layer</th>
            <th scope="col" className="w-[26%] border-l border-rule px-3 py-2 font-medium">Share</th>
            <th scope="col" className="border-l border-rule px-3 py-2 text-right font-medium">$ / mo</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((n, i) => (
            <tr key={n.id} className="border-b border-rule last:border-0">
              <td className="px-3 py-2 font-medium">{n.service}</td>
              <td className="hidden border-l border-rule px-3 py-2 text-ink-2 md:table-cell">{n.role}</td>
              <td className="lettering hidden border-l border-rule px-3 py-2 sm:table-cell">{n.group}</td>
              <td className="border-l border-rule px-3 py-2">
                <span className="flex items-center gap-2">
                  <motion.span
                    key={`${arch.provider}-${n.id}`}
                    className="block h-2.5 origin-left bg-ink"
                    style={{ width: `${Math.max((n.cost / max) * 100, 2)}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.7, ease: EXPO, delay: 0.1 + i * 0.035 }}
                  />
                  <span className="ref shrink-0">{Math.round((n.cost / arch.total) * 100)}%</span>
                </span>
              </td>
              <td className="border-l border-rule px-3 py-2 text-right font-mono text-[13px] tabular-nums">{n.cost.toLocaleString('en-US')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function NotesSheet({ arch }: { arch: Architecture }) {
  const s = arch.scenario
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <h3 className="lettering border-b border-ink pb-2 !text-ink">General notes: security</h3>
        <ol>
          {arch.security.map((item, i) => (
            <motion.li
              key={item.title}
              className="grid grid-cols-[2.5rem_1fr] gap-x-2 border-b border-rule py-3.5 md:grid-cols-[2.5rem_9rem_1fr]"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EXPO, delay: i * 0.05 }}
            >
              <span className="ref pt-1">{i + 1}.</span>
              <span className="font-semibold">{item.title}</span>
              <span className="col-start-2 leading-relaxed md:col-start-3">{item.detail}</span>
            </motion.li>
          ))}
        </ol>
      </section>

      <div className="space-y-8">
        <section>
          <h3 className="lettering border-b border-ink pb-2 !text-ink">Availability</h3>
          <ol>
            {s.availability.map((a, i) => (
              <li key={a} className="grid grid-cols-[2rem_1fr] border-b border-rule py-3 text-sm leading-relaxed">
                <span className="ref pt-0.5">{String.fromCharCode(97 + i)}.</span>
                {a}
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3 className="lettering border-b border-ink pb-2 !text-ink">Recovery targets</h3>
          <dl className="grid grid-cols-2">
            {[['RTO', s.rto, 'time to restore'], ['RPO', s.rpo, 'data at risk']].map(([k, v, hint]) => (
              <div key={k} className="border-b border-r border-rule py-3 pr-3 last:border-r-0 last:pl-3">
                <dt className="lettering">{k} · {hint}</dt>
                <dd className="wide mt-1 text-2xl">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}

const score: Record<Level, number> = { Low: 0, Medium: 1, High: 2 }
const levels: Level[] = ['Low', 'Medium', 'High']
const riskOf = (l: Level, i: Level) => {
  const n = score[l] + score[i]
  return n >= 3 ? 'High' : n === 2 ? 'Medium' : 'Low'
}

export function RiskSheet({ arch }: { arch: Architecture }) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_17rem]">
      <table className="h-fit w-full border border-ink text-sm">
        <caption className="lettering border border-b-0 border-ink px-3 py-2 text-left !text-ink">Risk register · STRIDE</caption>
        <thead className="hidden md:table-header-group">
          <tr className="lettering border-b border-ink text-left">
            <th scope="col" className="w-14 px-3 py-2 font-medium">Ref</th>
            <th scope="col" className="border-l border-rule px-3 py-2 font-medium">Threat</th>
            <th scope="col" className="border-l border-rule px-3 py-2 font-medium">Mitigation</th>
            <th scope="col" className="w-24 border-l border-rule px-3 py-2 font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {arch.threats.map((t, i) => {
            const risk = riskOf(t.likelihood, t.impact)
            return (
              <motion.tr
                key={t.letter}
                className="grid grid-cols-[3.5rem_1fr] border-b border-rule last:border-0 md:table-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
              >
                <td className="wide row-span-3 px-3 py-3 align-top text-4xl" aria-hidden="true">{t.letter}</td>
                <td className="px-3 py-3 align-top md:border-l md:border-rule">
                  <span className="block font-semibold">{t.category}</span>
                  <span className="lettering block">on {t.target}</span>
                  <span className="mt-1.5 block leading-relaxed">{t.threat}</span>
                </td>
                <td className="px-3 pb-3 align-top leading-relaxed text-ink-2 md:border-l md:border-rule md:py-3">{t.mitigation}</td>
                <td className="px-3 pb-3 align-top md:border-l md:border-rule md:py-3">
                  <span className={cn('lettering inline-flex items-center gap-1.5', risk === 'High' ? '!text-red' : '!text-ink')}>
                    <span className={cn('h-2.5 w-2.5 border', risk === 'High' ? 'border-red bg-red' : risk === 'Medium' ? 'border-ink bg-[repeating-linear-gradient(45deg,var(--color-ink)_0_1.5px,transparent_1.5px_4px)]' : 'border-ink')} />
                    {risk}
                  </span>
                </td>
              </motion.tr>
            )
          })}
        </tbody>
      </table>

      <aside className="h-fit">
        <p className="lettering border-b border-ink pb-2 !text-ink">Risk matrix</p>
        <div
          className="mt-4 grid grid-cols-[1.5rem_repeat(3,1fr)]"
          role="img"
          aria-label={arch.threats.map((t) => `${t.category}: likelihood ${t.likelihood}, impact ${t.impact}`).join('. ')}
        >
          {[...levels].reverse().map((impact) => (
            <div key={impact} className="contents">
              <span className="ref flex items-center">{impact[0]}</span>
              {levels.map((likelihood) => {
                const here = arch.threats.filter((t) => t.impact === impact && t.likelihood === likelihood)
                const heat = score[impact] + score[likelihood]
                return (
                  <div
                    key={likelihood}
                    className="-mb-px -mr-px flex aspect-square flex-wrap content-center items-center justify-center gap-1 border border-ink"
                    style={heat >= 3 ? { background: 'repeating-linear-gradient(45deg, rgb(200 50 30 / 0.28) 0 1px, transparent 1px 6px)' } : undefined}
                  >
                    {here.map((t, i) => (
                      <motion.span
                        key={t.letter}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-ink bg-paper text-xs font-semibold"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 20, delay: 0.3 + i * 0.08 + heat * 0.06 }}
                      >
                        {t.letter}
                      </motion.span>
                    ))}
                  </div>
                )
              })}
            </div>
          ))}
          <span />
          {levels.map((l) => (
            <span key={l} className="ref pt-1.5 text-center">{l[0]}</span>
          ))}
        </div>
        <p className="lettering mt-3 flex justify-between"><span>↑ Impact</span><span>Likelihood →</span></p>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">Hatched cells are the combinations treated as high risk.</p>
      </aside>
    </div>
  )
}

/** Title block in the bottom corner of the sheet, as on a printed drawing. */
export function TitleBlock({ arch, sheet, of, name }: { arch: Architecture; sheet: number; of: number; name: string }) {
  const provider = providers.find((p) => p.id === arch.provider)!
  const cell = 'border-l border-t border-ink px-3 py-2'
  const item = (k: string, v: ReactNode, cls = '') => (
    <div className={cn(cell, cls)}>
      <dt className="lettering !text-[0.625rem]">{k}</dt>
      <dd className="truncate text-sm font-medium leading-snug">{v}</dd>
    </div>
  )
  return (
    <dl className="ml-auto grid w-full max-w-[44rem] grid-cols-2 border-b border-r border-ink sm:grid-cols-[1.6fr_1fr_1fr_0.7fr]">
      {item('Project', arch.scenario.title, 'col-span-2 sm:col-span-1 sm:row-span-2')}
      {item('Provider', `${provider.label} · ${provider.region}`)}
      {item('Est. monthly', <Count value={arch.total} />)}
      {item('Rev', 'A (demo)')}
      {item('Sheet title', name)}
      {item('Drawn by', 'CloudArch')}
      {item('Sheet', <span className="font-mono">A-{String(sheet).padStart(2, '0')} / {String(of).padStart(2, '0')}</span>)}
    </dl>
  )
}
