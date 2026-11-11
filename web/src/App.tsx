import * as Tabs from '@radix-ui/react-tabs'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CodeView } from './components/CodeView'
import { Diagram } from './components/Diagram'
import { CostSheet, NotesSheet, RiskSheet, Schedule, TitleBlock } from './components/Sheets'
import { providers, type Provider } from './data/catalog'
import { scenarios, type Scenario } from './data/scenarios'
import { STAGES, build, matchScenario } from './lib/generate'
import { cn } from './lib/cn'

const EXPO = [0.16, 1, 0.3, 1] as const
const REPO = 'https://github.com/AdityaU101/CloudArch'

const SHEETS = [
  { id: 'diagram', label: 'Topology', about: 'Services, data flow and a numbered component schedule' },
  { id: 'terraform', label: 'Terraform', about: 'Infrastructure as code for the chosen provider' },
  { id: 'kubernetes', label: 'Kubernetes', about: 'Deployment, Service, autoscaler and Ingress' },
  { id: 'pipeline', label: 'CI/CD', about: 'Test, plan and deploy workflow' },
  { id: 'cost', label: 'Cost', about: 'Bill of quantities with a monthly estimate' },
  { id: 'security', label: 'Security', about: 'General notes, availability and recovery targets' },
  { id: 'threats', label: 'Threat model', about: 'STRIDE risk register and matrix' },
] as const

const sheetNo = (i: number) => `A-${String(i + 1).padStart(2, '0')}`

type Phase = 'idle' | 'running' | 'done'

/** Provider choice drawn as form tick boxes. */
function ProviderBoxes({ value, onChange, name }: { value: Provider; onChange: (p: Provider) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label="Target cloud" className="flex flex-wrap gap-x-5 gap-y-1">
      {providers.map((p) => {
        const on = value === p.id
        return (
          <label key={p.id} className="group flex min-h-11 cursor-pointer items-center gap-2.5">
            <input type="radio" name={name} value={p.id} checked={on} onChange={() => onChange(p.id)} className="peer sr-only" />
            <span className="relative flex h-[1.125rem] w-[1.125rem] items-center justify-center border-[1.5px] border-ink transition-colors group-hover:bg-fill peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-red">
              <svg viewBox="0 0 16 16" className="absolute h-4 w-4" aria-hidden="true">
                <motion.path d="M3 3L13 13" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.16 }} />
                <motion.path d="M13 3L3 13" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" initial={false} animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }} transition={{ duration: 0.16, delay: on ? 0.1 : 0 }} />
              </svg>
            </span>
            <span className={cn('text-[0.9375rem]', on ? 'font-semibold' : 'text-ink-2')}>{p.label}</span>
          </label>
        )
      })}
    </div>
  )
}

export default function App() {
  const reduce = useReducedMotion()
  const [provider, setProvider] = useState<Provider>('aws')
  const [brief, setBrief] = useState('')
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [stage, setStage] = useState(0)
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [exact, setExact] = useState(true)
  const [drawKey, setDrawKey] = useState(0)
  const [tab, setTab] = useState<string>('diagram')
  const [active, setActive] = useState<string | null>(null)
  const timers = useRef<number[]>([])

  const arch = useMemo(() => (scenario ? build(scenario, provider) : null), [scenario, provider])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const generate = () => {
    if (brief.trim().length < 12) {
      setError('Describe the system in a sentence or two, or pick a sample brief.')
      return
    }
    setError('')
    const match = matchScenario(brief)
    timers.current.forEach(clearTimeout)
    setPhase('running')
    setStage(0)
    const step = reduce ? 120 : 540
    timers.current = STAGES.map((_, i) =>
      window.setTimeout(() => {
        if (i < STAGES.length - 1) return setStage(i + 1)
        setScenario(match.scenario)
        setExact(match.exact)
        setTab('diagram')
        setDrawKey((k) => k + 1)
        setPhase('done')
        window.scrollTo({ top: 0 })
      }, step * (i + 1)),
    )
  }

  const tabIndex = SHEETS.findIndex((s) => s.id === tab)
  const done = phase === 'done' && arch

  return (
    <MotionConfig reducedMotion="user">
      <Tabs.Root value={tab} onValueChange={setTab} className="mx-auto flex min-h-screen max-w-[110rem] flex-col px-3 pt-3 md:px-6 md:pt-4">
        <header className="flex items-center justify-between gap-4 pb-3">
          <a href="/" className="wide text-xl" aria-label="CloudArch home">
            CloudArch
          </a>
          <p className="flex items-center gap-4 text-sm">
            <span className="hidden text-ink-2 md:inline">Demo. Runs in your browser on three prepared scenarios.</span>
            <span className="lettering border border-red px-2 py-0.5 !text-red md:hidden">Demo</span>
            <a href={REPO} target="_blank" rel="noreferrer" className="font-medium underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink">
              Source on GitHub
            </a>
          </p>
        </header>

        {/* The sheet: border, grid references in the margin, drawing inside */}
        <div className="relative grid flex-1 grid-cols-1 border-[1.5px] border-ink bg-paper shadow-[0_18px_40px_-28px_rgb(26_44_107/0.55)] md:grid-cols-[1.5rem_minmax(0,1fr)] md:grid-rows-[1.5rem_minmax(0,1fr)]">
          <span className="hidden border-b border-r border-ink md:block" />
          <div className="ref hidden grid-cols-8 border-b border-ink md:grid" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <span key={n} className="flex items-center justify-center border-r border-rule last:border-0">{n}</span>
            ))}
          </div>
          <div className="ref hidden grid-rows-6 border-r border-ink md:grid" aria-hidden="true">
            {['A', 'B', 'C', 'D', 'E', 'F'].map((l) => (
              <span key={l} className="flex items-center justify-center border-b border-rule last:border-0">{l}</span>
            ))}
          </div>

          <main className="relative min-w-0 overflow-hidden">
            <p className="sr-only" role="status">
              {phase === 'running' ? `${STAGES[stage]}…` : done ? `Drawing set ready: ${arch.scenario.title}` : ''}
            </p>

            {/* Plot head sweeping the sheet while the set is drafted */}
            <AnimatePresence>
              {phase === 'running' && !reduce && (
                <motion.span
                  className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-red"
                  initial={{ left: '0%', opacity: 0 }}
                  animate={{ left: '100%', opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ left: { duration: 1.6, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.2 } }}
                  aria-hidden="true"
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {!done ? (
                /* ── Cover sheet: drawing request ───────────────────── */
                <motion.div key="cover" className="grid gap-x-14 gap-y-10 p-5 md:p-10 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:p-14" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                  <div>
                    <p className="lettering">Drawing request · Sheet A-00</p>
                    <h1 className="wide mt-5 text-[clamp(2.4rem,5.6vw,5.25rem)]">
                      {['Cloud architecture,', 'drawn from', 'a sentence.'].map((line, i) => (
                        <span key={line} className="block overflow-hidden pb-[0.08em]">
                          <motion.span className="block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EXPO, delay: 0.05 + i * 0.08 }}>
                            {i === 2 ? <span className="text-red">{line}</span> : line}
                          </motion.span>
                        </span>
                      ))}
                    </h1>
                    <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-2">
                      Write what the system has to do. CloudArch returns a seven-sheet design for AWS, Azure or Google
                      Cloud, from the topology down to the threat model.
                    </p>

                    <table className="mt-10 w-full max-w-xl border border-ink text-sm">
                      <caption className="lettering border border-b-0 border-ink px-3 py-2 text-left !text-ink">Drawing list</caption>
                      <tbody>
                        {SHEETS.map((s, i) => (
                          <motion.tr
                            key={s.id}
                            className="border-b border-rule last:border-0"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                          >
                            <td className="ref w-14 px-3 py-2">{sheetNo(i)}</td>
                            <td className="w-32 border-l border-rule px-3 py-2 font-semibold">{s.label}</td>
                            <td className="hidden border-l border-rule px-3 py-2 text-ink-2 sm:table-cell">{s.about}</td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <form
                    className="h-fit border-[1.5px] border-ink"
                    onSubmit={(e) => {
                      e.preventDefault()
                      generate()
                    }}
                  >
                    <div className="grid grid-cols-[2.5rem_1fr] border-b border-ink">
                      <span className="ref flex justify-center border-r border-ink pt-3.5">1</span>
                      <div className="px-4 py-2">
                        <p className="lettering">Target cloud</p>
                        <ProviderBoxes value={provider} onChange={setProvider} name="provider" />
                      </div>
                    </div>

                    <div className="grid grid-cols-[2.5rem_1fr] border-b border-ink">
                      <span className="ref flex justify-center border-r border-ink pt-3.5">2</span>
                      <div className="px-4 py-3">
                        <label htmlFor="brief" className="lettering block">Requirements</label>
                        <textarea
                          id="brief"
                          value={brief}
                          onChange={(e) => {
                            setBrief(e.target.value)
                            if (error) setError('')
                          }}
                          rows={5}
                          disabled={phase === 'running'}
                          placeholder="A multi-tenant SaaS that processes 10,000 video uploads per day. High availability, auto-scaling, PostgreSQL, SOC2."
                          aria-invalid={!!error}
                          aria-describedby={error ? 'brief-error' : 'brief-help'}
                          className="mt-2 block w-full resize-none bg-[repeating-linear-gradient(transparent_0_1.74rem,var(--color-rule)_1.74rem_1.8rem)] text-[1.0625rem] leading-[1.8rem] placeholder:text-ink-2/55 focus:outline-none"
                        />
                        {error ? (
                          <p id="brief-error" role="alert" className="mt-2 text-sm font-medium text-red">{error}</p>
                        ) : (
                          <p id="brief-help" className="mt-2 text-sm text-ink-2">Plain English. Mention scale, data stores and compliance needs.</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-[2.5rem_1fr] border-b border-ink">
                      <span className="ref flex justify-center border-r border-ink pt-3.5">3</span>
                      <div className="px-4 py-3">
                        <p className="lettering">Or start from a sample brief</p>
                        <ul className="mt-1">
                          {scenarios.map((s) => (
                            <li key={s.id} className="border-b border-rule last:border-0">
                              <button
                                type="button"
                                disabled={phase === 'running'}
                                onClick={() => {
                                  setBrief(s.prompt)
                                  setError('')
                                }}
                                className="group flex min-h-11 w-full items-center justify-between gap-3 text-left"
                              >
                                <span className={cn('transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5', brief === s.prompt && 'font-semibold text-red')}>{s.title}</span>
                                <span className="ref">{brief === s.prompt ? 'selected' : 'use'}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <motion.button
                      type="submit"
                      disabled={phase === 'running'}
                      whileTap={{ scale: 0.985 }}
                      className="group relative flex h-16 w-full items-center justify-between overflow-hidden bg-ink px-5 text-lg font-semibold text-paper disabled:cursor-progress"
                    >
                      {phase === 'running' && (
                        <motion.span className="absolute inset-0 origin-left bg-red" initial={{ scaleX: 0 }} animate={{ scaleX: (stage + 1) / STAGES.length }} transition={{ duration: 0.5, ease: EXPO }} />
                      )}
                      <span className="relative">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span key={phase === 'running' ? stage : 'go'} className="block" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.18 }}>
                            {phase === 'running' ? STAGES[stage] : 'Issue the drawing set'}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span className="relative font-mono text-sm">
                        {phase === 'running' ? `${stage + 1} / ${STAGES.length}` : <span className="inline-block transition-transform duration-300 group-hover:translate-x-1.5">→</span>}
                      </span>
                    </motion.button>
                  </form>
                </motion.div>
              ) : (
                /* ── Issued sheets ─────────────────────────────────── */
                <motion.div key="set" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}>
                  <div className="grid items-center gap-x-8 gap-y-2 border-b border-ink px-5 py-3 md:px-8 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <div className="min-w-0">
                      <p className="lettering">Brief</p>
                      <p className="truncate" title={brief}>{brief}</p>
                      {!exact && <p className="text-sm text-red">Demo: matched to the closest of three prepared scenarios.</p>}
                    </div>
                    <ProviderBoxes value={provider} onChange={setProvider} name="provider-set" />
                    <button
                      type="button"
                      onClick={() => setPhase('idle')}
                      className="lettering h-10 w-fit border border-ink px-4 !text-ink transition-colors hover:bg-ink hover:!text-paper"
                    >
                      New brief
                    </button>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={tab}
                      className="p-5 md:p-8"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.35, ease: EXPO }}
                    >
                      <Tabs.Content value={tab} forceMount tabIndex={-1} className="outline-none">
                        <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                          <span className="ref">{sheetNo(tabIndex)}</span>
                          <h1 className="wide text-3xl md:text-4xl">{SHEETS[tabIndex].label}</h1>
                          <span className="text-ink-2">{arch.scenario.title}</span>
                        </div>

                        {tab === 'diagram' && (
                          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_17.5rem]">
                            <div className="min-w-0">
                              <Diagram arch={arch} drawKey={drawKey} active={active} onActive={setActive} />
                              <ol className="mt-4 grid gap-x-8 gap-y-1 text-sm text-ink-2 sm:grid-cols-3">
                                <li><span className="ref mr-2">1.</span>Solid lines carry requests or data.</li>
                                <li><span className="ref mr-2">2.</span>Dashed lines carry lookups or telemetry.</li>
                                <li><span className="ref mr-2">3.</span>The chain line is the account boundary.</li>
                              </ol>
                            </div>
                            <Schedule arch={arch} active={active} onActive={setActive} />
                          </div>
                        )}
                        {tab === 'terraform' && <CodeView code={arch.terraform} filename="infra/main.tf" note="Core resources for this design: network, cluster, data stores and messaging. Edge, identity and observability modules are left out of the demo excerpt." />}
                        {tab === 'kubernetes' && <CodeView code={arch.kubernetes} filename="k8s/api.yaml" note="The API workload: a zone-spread Deployment, its Service, a CPU-based autoscaler and an Ingress for the provider's load balancer." />}
                        {tab === 'pipeline' && <CodeView code={arch.pipeline} filename=".github/workflows/deploy.yml" note="GitHub Actions workflow. Tests and a Terraform plan run on every pull request; main builds, pushes and rolls out with keyless cloud auth." />}
                        {tab === 'cost' && <CostSheet arch={arch} onProvider={setProvider} />}
                        {tab === 'security' && <NotesSheet arch={arch} />}
                        {tab === 'threats' && <RiskSheet arch={arch} />}
                      </Tabs.Content>
                    </motion.div>
                  </AnimatePresence>

                  <TitleBlock arch={arch} sheet={tabIndex + 1} of={SHEETS.length} name={SHEETS[tabIndex].label} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* Sheet tabs hang off the bottom edge, as in a CAD layout */}
        <div className={cn('sticky bottom-0 z-20 -mt-[1.5px] min-h-4 bg-desk pb-2', !done && 'invisible')}>
          <Tabs.List aria-label="Sheets" className="flex overflow-x-auto">
            {SHEETS.map((s, i) => (
              <Tabs.Trigger
                key={s.id}
                value={s.id}
                disabled={!done}
                className="group relative -mr-[1.5px] flex h-11 shrink-0 items-center gap-2 border-[1.5px] border-ink bg-fill px-4 text-sm text-ink-2 transition-colors hover:text-ink data-[state=active]:border-t-paper data-[state=active]:bg-paper data-[state=active]:font-semibold data-[state=active]:text-ink"
              >
                <span className="ref group-data-[state=active]:!text-red">{sheetNo(i)}</span>
                {s.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
      </Tabs.Root>
    </MotionConfig>
  )
}
