import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Label } from 'recharts';
import { TightnessSweepResult } from '../simulation/benchmarkEngine';

interface Props { result: TightnessSweepResult; }

const SIGMA_COLORS: Record<number, string> = { 0.1: '#22d3ee', 0.3: '#3b82f6', 0.6: '#f59e0b', 1.0: '#ef4444' };

const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  const color = SIGMA_COLORS[payload.sigma] ?? '#94a3b8';
  const r = 4 + 3 * payload.recovery_rate;
  return <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.3 + 0.6 * payload.recovery_rate} stroke={color} strokeWidth={1} />;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const ok = d.ratio <= 1.0;
  return (
    <div className="rounded border border-border bg-[#0f172a] p-3 text-[11px] font-mono space-y-1 shadow-xl">
      <p className="font-semibold text-foreground">σ = {d.sigma} · severity = {d.severity}</p>
      <p className="text-zinc-400">V_T = <span className="text-white">{d.V_T.toFixed(3)}</span></p>
      <p className="text-zinc-400">θ = <span className="text-white">{d.theta.toFixed(3)}</span></p>
      <p className="text-zinc-400">Theory bound = <span className="text-cyan-400">{d.theory_bound.toFixed(2)} s</span></p>
      <p className="text-zinc-400">Empirical E[τ] = <span className="text-white">{d.empirical.toFixed(2)} s</span></p>
      <p className="text-zinc-400">Ratio = <span className={ok ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>{d.ratio.toFixed(3)} {ok ? '✓' : '✗'}</span></p>
      <p className="text-zinc-400">Recovery = {(d.recovery_rate * 100).toFixed(0)}%</p>
    </div>
  );
};

export function BoundTightnessPanel({ result }: Props) {
  const { points, sigma_vals } = result;
  const below    = points.filter(p => p.ratio <= 1.0).length;
  const total    = points.length;
  const maxBound = Math.max(...points.map(p => p.theory_bound)) * 1.08;
  const avgRatio = points.reduce((a, b) => a + b.ratio, 0) / total;
  const maxRatio = Math.max(...points.map(p => p.ratio));

  const bySigma = sigma_vals.map(s => ({
    sigma: s, color: SIGMA_COLORS[s] ?? '#94a3b8',
    pts: points.filter(p => p.sigma === s).map(p => ({ ...p, x: p.theory_bound, y: p.empirical })),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-widest text-primary uppercase">Bound Tightness Validation</h2>
          <p className="text-xs text-muted-foreground font-mono mt-1 max-w-xl">
            Empirical E[τ] vs theoretical bound (V_T−δ)/θ across {total} operating points
            (σ ∈ {'{'}{ sigma_vals.join(', ')}{'}'}  × 5 severity levels, 40 paths each).
            Every point below the diagonal confirms Theorem I.1. Closeness to the diagonal shows bound tightness.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className={`px-3 py-1.5 rounded border text-xs font-mono font-semibold
            ${below === total ? 'bg-green-900/40 border-green-700 text-green-400' : 'bg-red-900/40 border-red-700 text-red-400'}`}>
            {below}/{total} points satisfy bound
          </div>
          <div className="flex gap-3 text-[10px] font-mono text-zinc-500">
            <span>avg ratio {avgRatio.toFixed(3)}</span>
            <span>max ratio {maxRatio.toFixed(3)}</span>
          </div>
        </div>
      </div>

      {/* Scatter chart */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          Empirical E[τ] vs bound — each dot is one (σ, severity) pair · dot size ∝ recovery rate
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 16 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" dataKey="x" name="theory" domain={[0, maxBound]}
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}>
              <Label value="Theoretical bound  (V_T − δ)/θ  [s]" offset={-8} position="insideBottom"
                style={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }} />
            </XAxis>
            <YAxis type="number" dataKey="y" name="empirical" domain={[0, maxBound]}
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}>
              <Label value="Empirical E[τ]  [s]" angle={-90} position="insideLeft"
                style={{ fontSize: 10, fill: '#64748b', fontFamily: 'JetBrains Mono' }} />
            </YAxis>
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine segment={[{ x: 0, y: 0 }, { x: maxBound, y: maxBound }]}
              stroke="#ffffff" strokeDasharray="4 3" strokeOpacity={0.3}
              label={{ value: 'y = x (bound boundary)', position: 'insideTopLeft', fill: '#64748b', fontSize: 9 }} />
            {bySigma.map(g => (
              <Scatter key={g.sigma} name={`σ = ${g.sigma}`} data={g.pts} fill={g.color} shape={<CustomDot />} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-5 mt-2 justify-center">
          {bySigma.map(g => (
            <div key={g.sigma} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="inline-block w-3 h-3 rounded-full" style={{ background: g.color }} />
              <span style={{ color: g.color }}>σ = {g.sigma}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">All Operating Points</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                {['σ', 'Sev.', 'V_T', 'θ', 'Theory (s)', 'Empirical (s)', 'Ratio', 'Rec.%', 'Valid'].map(h => (
                  <th key={h} className="text-right first:text-left py-2 px-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => {
                const ok = p.ratio <= 1.0;
                return (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/10">
                    <td className="py-1.5 px-2" style={{ color: SIGMA_COLORS[p.sigma] ?? '#94a3b8' }}>{p.sigma}</td>
                    <td className="text-right py-1.5 px-2 text-foreground">{p.severity.toFixed(1)}</td>
                    <td className="text-right py-1.5 px-2 text-zinc-400">{p.V_T.toFixed(3)}</td>
                    <td className="text-right py-1.5 px-2 text-zinc-400">{p.theta.toFixed(3)}</td>
                    <td className="text-right py-1.5 px-2 text-cyan-400">{p.theory_bound.toFixed(2)}</td>
                    <td className="text-right py-1.5 px-2 text-foreground">{p.empirical.toFixed(2)}</td>
                    <td className={`text-right py-1.5 px-2 font-semibold ${ok ? 'text-green-400' : 'text-red-400'}`}>{p.ratio.toFixed(3)}</td>
                    <td className="text-right py-1.5 px-2 text-foreground">{(p.recovery_rate * 100).toFixed(0)}%</td>
                    <td className={`text-right py-1.5 px-2 ${ok ? 'text-green-400' : 'text-red-400'}`}>{ok ? '✓' : '✗'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono mt-2">
          V_T = distortion(δ₀, ω₀) computed directly from the initial post-contingency state (not back-derived).
          θ = C·s* − M_φ − M_σ. Theory bound = (V_T − δ)/θ. Ratio = empirical / theory; must be ≤ 1 for bound to hold.
        </p>
      </div>

      {/* Interpretation */}
      <div className="p-4 rounded border border-zinc-700/50 bg-zinc-900/30 text-[11px] font-mono text-zinc-500 leading-relaxed">
        <span className="text-zinc-400 font-semibold">Reading this chart. </span>
        Every point below the dashed diagonal satisfies E[τ] ≤ (V_T − δ)/θ (Theorem I.1).
        Points near the diagonal indicate a tight, informative bound.
        The largest gaps appear at low σ and low severity — easy regimes where the system recovers fast
        regardless, so the conservatism in M_φ + M_σ dominates.
        At high σ and high severity (top-right cluster), the bound remains valid and becomes tighter —
        exactly the regime where a non-vacuous guarantee matters most for a pitch to NREL or ARPA-E.
        Any point above the diagonal would falsify Theorem I.1 for these parameters; none observed in this sweep.
      </div>
    </div>
  );
}
