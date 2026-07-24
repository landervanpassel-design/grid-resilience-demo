import React, { useState, useRef, useEffect } from 'react';
import { BenchmarkParams, BENCH } from '../simulation/benchmarkEngine';
import { BenchmarkPanel } from '../components/BenchmarkPanel';
import { BoundTightnessPanel } from '../components/BoundTightnessPanel';
import { MachinePanel } from '../components/MachinePanel';
import { PillarIIPanel } from '../components/PillarIIPanel';
import { PillarIIIPanel } from '../components/PillarIIIPanel';
import { EconomicPanel } from '../components/EconomicPanel';
import { FullBenchmarkResult } from '../simulation/benchmarkWorker';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Tab = 'benchmark' | 'machines' | 'pillar2' | 'pillar3' | 'tightness' | 'economics';

const TABS: { id: Tab; label: string; note: string }[] = [
  { id: 'benchmark', label: 'Head-to-Head',    note: '5 controllers · identical noise' },
  { id: 'machines',  label: 'Per-Machine',      note: 'δᵢ(t), ωᵢ(t) — all generators' },
  { id: 'pillar2',   label: 'Pillar II',         note: 's* sweep · optimality' },
  { id: 'pillar3',   label: 'Pillar III',         note: 'adversarial noise · robustness' },
  { id: 'tightness', label: 'Bound Tightness',  note: 'σ × severity grid · Theorem I.1' },
  { id: 'economics', label: 'Economics',         note: 'EPRI COLL · annual savings · ROI' },
];

export default function Benchmark() {
  const [params, setParams] = useState<BenchmarkParams>({
    contingency_severity: 1.5, sigma_noise: 0.5, num_paths: 200,
  });
  const [result, setResult] = useState<FullBenchmarkResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('benchmark');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('../simulation/benchmarkWorker.ts', import.meta.url), { type: 'module' },
    );
    workerRef.current.onmessage = (e) => {
      const { type, percent, phase: ph, result: res } = e.data;
      if (type === 'PROGRESS') { setProgress(percent); setPhase(ph ?? ''); }
      else if (type === 'DONE') { setResult(res); setIsRunning(false); setProgress(0); setActiveTab('benchmark'); }
    };
    return () => workerRef.current?.terminate();
  }, []);

  const run = () => {
    if (!workerRef.current || isRunning) return;
    setIsRunning(true); setProgress(0); setPhase('Starting…');
    workerRef.current.postMessage({ type: 'RUN_BENCHMARK', params });
  };

  const update = (k: keyof BenchmarkParams, v: number) => setParams(p => ({ ...p, [k]: v }));

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">

      {/* ── Control panel ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 w-[272px] shrink-0 border-r border-border p-4 h-full overflow-y-auto bg-card">
        <div>
          <h2 className="text-sm font-bold tracking-widest text-primary mb-1 uppercase font-mono">Full Benchmark</h2>
          <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
            5 controllers · bound tightness sweep · Pillar II s* optimality · Pillar III adversarial — one run.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs font-mono">Contingency Severity</Label>
            <span className="text-xs text-primary font-mono">{params.contingency_severity.toFixed(1)} pu</span>
          </div>
          <Slider min={0.5} max={3.0} step={0.1} value={[params.contingency_severity]}
            onValueChange={v => update('contingency_severity', v[0])} />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label className="text-xs font-mono">Noise σ</Label>
            <span className="text-xs text-primary font-mono">{params.sigma_noise.toFixed(2)}</span>
          </div>
          <Slider min={0.05} max={2.0} step={0.05} value={[params.sigma_noise]}
            onValueChange={v => update('sigma_noise', v[0])} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-mono">MC Paths (per method)</Label>
          <Select value={String(params.num_paths)} onValueChange={v => update('num_paths', Number(v))}>
            <SelectTrigger className="text-xs font-mono h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="100" className="text-xs font-mono">100 — fast (~20 s)</SelectItem>
              <SelectItem value="200" className="text-xs font-mono">200 — standard (~40 s)</SelectItem>
              <SelectItem value="400" className="text-xs font-mono">400 — precise (~80 s)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Fixed params */}
        <div className="p-2.5 bg-muted/20 rounded border border-border/50 text-[9px] font-mono space-y-1">
          <p className="text-zinc-500 uppercase tracking-widest mb-1.5">Fixed</p>
          {[
            ['δ threshold', `${BENCH.delta_thresh} pu`],
            ['VP  s*', `${BENCH.s_star} pu`],
            ['PSS  K', `${BENCH.K_pss}`],
            ['ALQR re-lin', `${BENCH.adapt_interval} ms`],
            ['Pillar II paths', '60 each'],
            ['Pillar III α', '0.6'],
            ['Tightness pts', '20 × 40 paths'],
            ['dt / T', '0.001 s / 10 s'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-zinc-600">{k}</span>
              <span className="text-zinc-300">{v}</span>
            </div>
          ))}
        </div>

        <button onClick={run} disabled={isRunning}
          className="w-full py-3 font-mono text-sm font-bold tracking-widest uppercase
            bg-primary text-primary-foreground rounded hover:brightness-110
            active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {isRunning ? `${progress}%` : 'Run Full Benchmark'}
        </button>

        {isRunning && (
          <>
            <div className="w-full h-1 bg-muted rounded overflow-hidden -mt-3">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[9px] font-mono text-zinc-500 text-center -mt-3 leading-relaxed">{phase}</p>
          </>
        )}

        <div className="mt-auto pt-3 border-t border-border/40 space-y-0.5">
          <p className="text-[8px] font-mono text-zinc-700">IEEE 9-bus · H = [23.64, 6.40, 3.01] s</p>
          <p className="text-[8px] font-mono text-zinc-700">Anderson & Fouad exact inertia constants</p>
          <p className="text-[8px] font-mono text-zinc-700 mt-1">Van Passel, Zenodo 2026</p>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex-1 h-full overflow-y-auto relative flex flex-col">
        {isRunning && (
          <div className="absolute top-0 left-0 w-full h-0.5 z-50 bg-background">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Page title */}
        <div className="px-6 pt-5 pb-2 shrink-0">
          <h1 className="text-xl font-bold font-mono tracking-tight">Control Method Comparison</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            Baseline · PSS · LQR · Adaptive LQR · Van Passel — IEEE 9-bus + Pillars I–III validation
          </p>
        </div>

        {/* Tabs */}
        {result && (
          <div className="flex gap-0 border-b border-border px-6 shrink-0 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                {tab.label}
                <span className="ml-1.5 text-[8px] normal-case text-zinc-600 hidden sm:inline">{tab.note}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">

          {/* Empty state */}
          {!result && !isRunning && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 border border-dashed border-border/40 rounded-lg min-h-[400px]">
              <div className="space-y-2 max-w-md">
                <p className="font-mono text-base text-muted-foreground">Configure and press Run Full Benchmark</p>
                <p className="font-mono text-xs text-zinc-600">
                  Runs four independent analyses in sequence. Results open across five tabs.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-left max-w-lg">
                {[
                  { color: '#ef4444', name: 'Baseline',     detail: 'No control — natural divergence' },
                  { color: '#f59e0b', name: 'PSS Droop',    detail: 'IEEE 421.5 proportional ω damping' },
                  { color: '#3b82f6', name: 'LQR',          detail: 'DARE-optimal at zero linearisation' },
                  { color: '#8b5cf6', name: 'Adaptive LQR', detail: 'Re-linearises every 50 ms ≈ NMPC' },
                  { color: '#22d3ee', name: 'Van Passel',   detail: 'CDI sacrifice, certified E[τ] bound' },
                  { color: '#64748b', name: 'Pillar II',     detail: 's* sweep — optimality confirmation' },
                  { color: '#64748b', name: 'Pillar III',    detail: 'Adversarial α = 0.6 — robustness' },
                  { color: '#64748b', name: 'Tightness',     detail: '20 pts — theory vs empirical E[τ]' },
                ].map(m => (
                  <div key={m.name} className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: m.color }} />
                    <div>
                      <p className="text-xs font-mono font-semibold" style={{ color: m.color }}>{m.name}</p>
                      <p className="text-[9px] font-mono text-zinc-600">{m.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {isRunning && (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] space-y-4">
              <div className="font-mono text-primary text-sm animate-pulse">{phase || 'Initialising…'}</div>
              <div className="w-64 h-1.5 bg-muted rounded overflow-hidden">
                <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs font-mono text-zinc-600">{progress}% complete</p>
            </div>
          )}

          {/* Results */}
          {result && !isRunning && (
            <>
              {activeTab === 'benchmark' && <BenchmarkPanel result={result.benchmark} />}
              {activeTab === 'machines'  && <MachinePanel  result={result.benchmark} />}
              {activeTab === 'pillar2'   && <PillarIIPanel  result={result.pillar2} params={params} />}
              {activeTab === 'pillar3'   && (
                <PillarIIIPanel result={result.pillar3} nominal={{ methods: result.benchmark.methods }} />
              )}
              {activeTab === 'tightness' && <BoundTightnessPanel result={result.tightness} />}
              {activeTab === 'economics' && <EconomicPanel methods={result.benchmark.methods} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
