import { useMemo, useState, type ReactNode } from 'react'

const TOKEN =
  /(#.*$)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|\b(resource|module|provider|variable|terraform|required_providers|apiVersion|kind|jobs|steps|uses)\b(?=\s*[:"{=]|\s+")/g

const tone = ['text-ink-2 italic', 'text-teal', 'text-red', 'font-medium underline decoration-rule underline-offset-4'] as const

/** Small regex highlighter: comments, strings, literals, block keywords. */
function highlight(line: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index!
    if (i > last) out.push(line.slice(last, i))
    const group = m.slice(1).findIndex((g) => g !== undefined)
    out.push(
      <span key={i} className={tone[group]}>
        {m[0]}
      </span>,
    )
    last = i + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function CodeView({ code, filename, note }: { code: string; filename: string; note: string }) {
  const [copied, setCopied] = useState(false)
  const lines = useMemo(() => code.split('\n'), [code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked: the download button still works */
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: filename.split('/').pop() })
    a.click()
    URL.revokeObjectURL(url)
  }

  const action = 'lettering flex h-10 items-center border-l border-ink px-4 !text-ink transition-colors hover:bg-ink hover:!text-paper'

  return (
    <div className="grid gap-6 xl:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <p className="lettering">Specification</p>
        <p className="mt-2 font-mono text-sm">{filename}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">{note}</p>
        <p className="ref mt-4">{lines.length} lines</p>
      </div>
      <div className="min-w-0 border border-ink">
        <div className="flex items-stretch justify-between border-b border-ink">
          <span className="lettering flex items-center px-4 !text-ink">{filename}</span>
          <span className="flex">
            <button type="button" onClick={copy} className={action}>
              <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button type="button" onClick={download} className={action}>
              Download
            </button>
          </span>
        </div>
        <pre className="max-h-[58vh] overflow-auto py-4 font-mono text-[12.5px] leading-[1.75]" tabIndex={0} aria-label={`${filename} source`}>
          <code key={code} className="block min-w-max">
            {lines.map((line, i) => (
              <span
                key={i}
                className="flex pr-6"
                style={{ animation: 'line-in 0.3s ease both', animationDelay: `${Math.min(i * 10, 800)}ms` }}
              >
                <span className="w-12 shrink-0 select-none border-r border-rule pr-3 text-right text-ink-2/70">{i + 1}</span>
                <span className="whitespace-pre pl-4">{highlight(line)}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
