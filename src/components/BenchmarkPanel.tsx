import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { BenchmarkResult, BENCH } from '../simulation/benchmarkEngine';

interface Props { result: BenchmarkResult; }

const fmt2 = (v?: number) => (v === undefined || !isFinite(v) ? '—' : v.toFixed(2));
const pct  = (v?: number) => (v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(result: BenchmarkResult) {
  const { t_axis, methods, params } = result;

  const header = [
    '# Van Passel Sacrifice Control — Benchmark Results',
    `# severity=${params.contingency_severity} sigma=${params.sigma_noise} N=${params.num_paths}`,
    `# Generated ${new Date().toISOString()}`,
    '',
    ['t_s', ...methods.flatMap(m => [`mean_delta_${m.shortName}`, `p10_delta_${m.shortName}`, `p90_delta_${m.shortName}`])].join(','),
  ].join('\n');

  const rows = t_axis.map((t, i) =>
    [t.toFixed(3), ...methods.flatMap(m => [
      m.mean_delta[i].toFixed(5), m.p10_delta[i].toFixed(5), m.p90_delta[i].toFixed(5),
    ])].join(',')
  );

  const metaHeader = '\n\n# Summary metrics\nmethod,recovery_rate,mean_tau_s,p95_tau_s,p_tail,effort_pu_s,theory_bound_s\n';
  const metaRows = methods.map(m =>
    [m.name, (m.metrics.recovery_rate * 100).toFixed(1) + '%', m.metrics.mean_tau.toFixed(3),
     m.metrics.p95_tau.toFixed(3), (m.metrics.p_tail * 100).toFixed(1) + '%',
     m.control_effort.toFixed(3), m.metrics.theory_bound?.toFixed(3) ?? 'N/A'].join(',')
  );

  const csv = [header, ...rows, metaHeader + metaRows.join('\n')].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'benchmark_results.csv' });
  a.click(); URL.revokeObjectURL(url);
}

// ─── charts ───────────────────────────────────────────────────────────────────

function DeltaOverlay({ result }: Props) {
  const { t_axis, methods } = result;
  const data = t_axis.map((t, i) => {
    const row: Record<string, number> = { t: parseFloat(t.toFixed(3)) };
    for (const m of methods) row[m.shortName] = parseFloat(m.mean_delta[i].toFixed(4));
    return row;
  });
  const vp = methods.find(m => m.shortName === 'VP')!;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
          label={{ value: 'time (s)', position: 'insideBottomRight', dy: 6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
          label={{ value: 'Δ(t)', angle: -90, position: 'insideLeft', dx: 10, fontSize: 10, fill: '#64748b' }}
          domain={[0, 'auto']} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          formatter={(v: number, name: string) => [v.toFixed(3), name]} />
        <ReferenceLine y={BENCH.delta_thresh} stroke="#ffffff" strokeDasharray="5 3" strokeOpacity={0.4}
          label={{ value: `δ = ${BENCH.delta_thresh}`, position: 'right', fill: '#94a3b8', fontSize: 9 }} />
        {methods.map(m => (
          <Line key={m.shortName} dataKey={m.shortName} stroke={m.color}
            strokeWidth={m.shortName === 'VP' ? 2.5 : 1.5} dot={false}
            strokeDasharray={m.shortName === 'VP' ? undefined : m.shortName === 'ALQR' ? '6 2' : m.shortName === 'LQR' ? '4 2' : m.shortName === 'PSS' ? '2 2' : '1 3'}
            opacity={m.shortName === 'Baseline' ? 0.6 : 1} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function RecoveryCDF({ result }: Props) {
  const { methods } = result;
  const tGrid = Array.from({ length: 101 }, (_, i) => i * 0.1);
  const data = tGrid.map(t => {
    const row: Record<string, number> = { t: parseFloat(t.toFixed(1)) };
    for (const m of methods) {
      const idx = m.cdf_t.findIndex(v => v > t);
      row[m.shortName] = idx < 0 ? m.cdf_p[m.cdf_p.length - 1] : idx === 0 ? 0 : m.cdf_p[idx - 1];
    }
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
          label={{ value: 'τ (s)', position: 'insideBottomRight', dy: 6, fontSize: 10, fill: '#64748b' }} />
        <YAxis tickFormatter={v => `${(v * 100).toFixed(0)}%`}
          tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}
          label={{ value: 'P(τ≤t)', angle: -90, position: 'insideLeft', dx: 10, fontSize: 10, fill: '#64748b' }}
          domain={[0, 1]} />
        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
          formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]} />
        <ReferenceLine x={5} stroke="#ffffff" strokeDasharray="3 3" strokeOpacity={0.3}
          label={{ value: '5 s', position: 'top', fill: '#64748b', fontSize: 9 }} />
        {methods.map(m => (
          <Line key={m.shortName} dataKey={m.shortName} stroke={m.color}
            strokeWidth={m.shortName === 'VP' ? 2.5 : 1.5} dot={false}
            strokeDasharray={m.shortName === 'VP' ? undefined : m.shortName === 'ALQR' ? '6 2' : m.shortName === 'LQR' ? '4 2' : m.shortName === 'PSS' ? '2 2' : '1 3'} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function MetricBar({ methods, accessor, label, unit = '' }: {
  methods: BenchmarkResult['methods']; accessor: (m: BenchmarkResult['methods'][0]) => number; label: string; unit?: string;
}) {
  const data = methods.map(m => ({ name: m.shortName, value: accessor(m), color: m.color }));
  return (
    <div>
      <p className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider">{label}</p>
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} margin={{ top: 0, right: 8, bottom: 0, left: 0 }} barSize={22}>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
            formatter={(v: number) => [`${v.toFixed(2)}${unit}`, label]} />
          <Bar dataKey="value" radius={[2, 2, 0, 0]}>
            {data.map(d => <Cell key={d.name} fill={d.color} opacity={0.85} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SummaryTable({ result }: Props) {
  const { methods } = result;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono border-collapse">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-2 pr-4 font-semibold uppercase tracking-wider">Method</th>
            <th className="text-right py-2 px-3 font-semibold">Rec. Rate</th>
            <th className="text-right py-2 px-3 font-semibold">Mean τ</th>
            <th className="text-right py-2 px-3 font-semibold">P(τ&gt;5 s)</th>
            <th className="text-right py-2 px-3 font-semibold">p95 τ</th>
            <th className="text-right py-2 px-3 font-semibold">Effort</th>
            <th className="text-right py-2 px-3 font-semibold">Certified bound</th>
          </tr>
        </thead>
        <tbody>
          {methods.map(m => {
            const bestRR  = m.metrics.recovery_rate === Math.max(...methods.map(x => x.metrics.recovery_rate));
            const bestTau = m.metrics.mean_tau      === Math.min(...methods.map(x => x.metrics.mean_tau));
            const bestTail= m.metrics.p_tail        === Math.min(...methods.map(x => x.metrics.p_tail));
            return (
              <tr key={m.name} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                <td className="py-2.5 pr-4">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: m.color }} />
                  <span style={{ color: m.color }} className="font-semibold">{m.name}</span>
                </td>
                <td className={`text-right py-2.5 px-3 ${bestRR  ? 'text-green-400 font-semibold' : ''}`}>{pct(m.metrics.recovery_rate)}</td>
                <td className={`text-right py-2.5 px-3 ${bestTau ? 'text-green-400 font-semibold' : ''}`}>{fmt2(m.metrics.mean_tau)} s</td>
                <td className={`text-right py-2.5 px-3 ${bestTail? 'text-green-400 font-semibold' : ''}`}>{pct(m.metrics.p_tail)}</td>
                <td className="text-right py-2.5 px-3">{fmt2(m.metrics.p95_tau)} s</td>
                <td className="text-right py-2.5 px-3">{fmt2(m.control_effort)} pu·s</td>
                <td className="text-right py-2.5 px-3">
                  {m.metrics.has_guarantee
                    ? <span className="text-cyan-400 font-semibold">E[τ] ≤ {fmt2(m.metrics.theory_bound)} s</span>
                    : <span className="text-zinc-600">None</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── main export ──────────────────────────────────────────────────────────────

export function BenchmarkPanel({ result }: Props) {
  const { methods, params, lqr_gain_norm } = result;
  const vp = methods.find(m => m.shortName === 'VP')!;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-widest text-primary uppercase">Head-to-Head Benchmark</h2>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Identical Wiener increments — structural differences between controllers isolated.
            N = {params.num_paths} paths · σ = {params.sigma_noise} · severity = {params.contingency_severity}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button onClick={() => exportCSV(result)}
            className="px-3 py-1.5 text-xs font-mono font-semibold border border-border rounded
              hover:border-primary hover:text-primary transition-colors flex items-center gap-1.5">
            ↓ Export CSV
          </button>
          <p className="text-[9px] font-mono text-zinc-600">
            LQR ‖K‖_F = {lqr_gain_norm.toFixed(1)} · PSS K = {BENCH.K_pss} · VP s* = {BENCH.s_star}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {methods.map(m => (
          <span key={m.shortName} className="flex items-center gap-1.5 text-xs font-mono">
            <span className="inline-block w-8 h-0.5" style={{ background: m.color }} />
            <span style={{ color: m.color }}>{m.name}</span>
          </span>
        ))}
      </div>

      {/* Δ(t) chart */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Mean Δ̄(t) — all methods</p>
        <DeltaOverlay result={result} />
        <p className="text-[10px] text-zinc-600 font-mono mt-1">
          VP (solid cyan) guided by CDI margin θ = {fmt2(vp.metrics.theta)}. Certified E[τ] ≤ {fmt2(vp.metrics.theory_bound)} s (Theorem I.1).
          ALQR (dashed violet) re-linearises every {BENCH.adapt_interval} ms — tracks nonlinear dynamics without equilibrium assumption.
        </p>
      </div>

      {/* CDF + bars */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Empirical CDF of τ_δ</p>
          <RecoveryCDF result={result} />
        </div>
        <div className="grid grid-rows-2 gap-4">
          <MetricBar methods={methods} accessor={m => m.metrics.recovery_rate * 100} label="Recovery rate (%)" unit="%" />
          <MetricBar methods={methods} accessor={m => m.metrics.p_tail * 100} label="Tail P(τ > 5 s) (%)" unit="%" />
        </div>
      </div>

      {/* Metric bars */}
      <div className="grid grid-cols-2 gap-6">
        <MetricBar methods={methods} accessor={m => m.metrics.mean_tau} label="Mean recovery time (s)" unit=" s" />
        <MetricBar methods={methods} accessor={m => m.control_effort} label="Avg control effort (pu·s)" unit=" pu·s" />
      </div>

      {/* Table */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Full Metrics Table</p>
        <SummaryTable result={result} />
        <p className="text-[10px] text-zinc-600 font-mono mt-2">
          Best per column highlighted green. "Certified bound" column: only Van Passel provides a provable E[τ] upper bound.
          LQR and ALQR are (locally) optimal for their respective cost functions but carry no stochastic τ guarantee.
        </p>
      </div>

      {/* Method cards */}
      <div className="grid grid-cols-2 gap-3">
        {methods.map(m => (
          <div key={m.name} className="p-3 rounded border border-border/60 bg-card/50">
            <p className="font-mono font-semibold text-xs mb-1" style={{ color: m.color }}>{m.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">{m.description}</p>
          </div>
        ))}
      </div>

      {/* No-equilibrium note */}
      <div className="p-3 rounded border border-amber-900/40 bg-amber-950/20 text-[10px] font-mono text-amber-700/80">
        <span className="text-amber-500 font-semibold">Physics note. </span>
        With simplified coupling K_C = 0.3 there is no true swing equilibrium for the given Pm values —
        rotor angles drift continuously under the mechanical power imbalance. This is intentional: the
        distortion field objective Δ = ½Σωᵢ² + (β/2)ΣΔδᵢⱼ² does not require an equilibrium for the
        certified bound to hold (§2, Van Passel 2026). The comparison is valid because all five methods
        face the identical drift — isolating the control law as the only variable.
      </div>

      {/* Methodology */}
      <div className="p-4 rounded border border-zinc-700/50 bg-zinc-900/30 text-[10px] font-mono text-zinc-500 leading-relaxed">
        <span className="text-zinc-400 font-semibold">Methodology. </span>
        IEEE 9-bus classical swing model. H = [23.64, 6.40, 3.01] s (Anderson & Fouad, exact).
        K_C = 0.3 pu (simplified lossless coupling). Euler–Maruyama, dt = 0.001 s, T = 10 s.
        LQR: DARE (value iteration 4000 iters), linearised at zero reference, Q = diag([1³,20³]), R = 0.08·I₃.
        ALQR: warm-starts Riccati ({BENCH.adapt_iters} iters) from previous P, re-linearised every {BENCH.adapt_interval} steps.
        PSS: u = −{BENCH.K_pss}·ω (IEEE Std 421.5). VP: CDI sacrifice, s* = {BENCH.s_star}, θ = {fmt2(vp.metrics.theta)} (Pillar I).
        Identical Box–Muller Wiener increments per path across all methods.
        Reference: Van Passel, "Reconstruction after Extreme Distortion", Zenodo 2026.
      </div>
    </div>
  );
}
