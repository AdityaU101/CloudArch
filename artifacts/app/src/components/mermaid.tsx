import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#FF9900',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#E8871D',
    lineColor: '#FF9900',
    secondaryColor: '#232F3E',
    tertiaryColor: '#1a1f2e',
    background: '#0f1117',
    mainBkg: '#1e2433',
    nodeBorder: '#FF9900',
    clusterBkg: '#1a1f2e',
    clusterBorder: '#444c5c',
    titleColor: '#ffffff',
    edgeLabelBackground: '#1e2433',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: '14px',
  },
  securityLevel: 'loose',
  flowchart: { htmlLabels: true, curve: 'basis', padding: 20 },
});

interface MermaidProps {
  chart: string;
}

function sanitizeMermaid(chart: string): string {
  return chart
    .replace(/^```mermaid\s*/i, '').replace(/```\s*$/, '')
    .replace(/\bas\s+'([^']+)'/g, 'as $1')
    .replace(/\bas\s+"([^"]+)"/g, 'as $1')
    .replace(/\["([^"]+)"\]/g, '[$1]')
    .replace(/\['([^']+)'\]/g, '[$1]')
    .trim();
}

function cleanupMermaidBombs() {
  // Remove bomb error divs Mermaid appends to document.body on parse failure
  document.querySelectorAll('body > [id^="dmermaid"], body > [id^="d-mermaid"]').forEach(el => el.remove());
  document.querySelectorAll('body > .mermaid').forEach(el => el.remove());
}

export function Mermaid({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rawCode, setRawCode] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !chart) return;

    setError(null);
    setRawCode(null);
    const sanitized = sanitizeMermaid(chart);
    const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

    const renderChart = async () => {
      // Validate first — prevents Mermaid from injecting bomb errors into the DOM
      const isValid = await mermaid.parse(sanitized, { suppressErrors: true });
      if (!isValid) {
        setError('The AI generated a diagram with unsupported syntax.');
        setRawCode(sanitized);
        return;
      }

      try {
        const { svg } = await mermaid.render(id, sanitized);
        cleanupMermaidBombs();
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          // Make SVG responsive and fill the container
          const svgEl = containerRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.minHeight = '500px';
            svgEl.removeAttribute('width');
            svgEl.removeAttribute('height');
          }
        }
      } catch (e: any) {
        cleanupMermaidBombs();
        setError(e.message || 'Failed to render diagram');
        setRawCode(sanitized);
      }
    };

    renderChart();

    return () => { cleanupMermaidBombs(); };
  }, [chart]);

  if (error) {
    return (
      <div className="space-y-3">
        <div className="text-amber-400 p-3 border border-amber-400/30 rounded-md bg-amber-400/10 text-sm">
          ⚠️ {error} The raw Mermaid code is shown below — try regenerating for a better result.
        </div>
        <pre className="bg-zinc-950 p-4 rounded-md text-xs text-muted-foreground overflow-auto whitespace-pre-wrap max-h-96">{rawCode}</pre>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#0f1117] rounded-xl border border-border overflow-auto p-6 min-h-[500px] flex items-center justify-center">
      <div ref={containerRef} className="w-full" />
    </div>
  );
}
