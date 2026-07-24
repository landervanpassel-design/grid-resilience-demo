import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { PillarIIIResult, BENCH } from '../simulation/benchmarkEngine';

interface Props { result: PillarIIIResult; nominal: { methods: PillarIIIResult['methods'] }; }

const fmt2 = (v?: number) => (v === undefined || !isFinite(v) ? '—' : v.toFixed(2));
const pct  = (v: number) => `${(v * 100).toFixed(1)}%`;

export function PillarIIIPanel({ result, nominal }: Props) {
  const { t_axis, methods, adversarial_alpha } = result;

  // Delta trajectory overlay
  const trajData = t_axis.map((t, ti) => {
    const row: Record<string, number> = { t: parseFloat(t.toFixed(2)) };
    for (const m of methods) row[m.shortName] = parseFloat(m.mean_delta[ti].toFixed(4));
    return row;
  });

  // Recovery rate degradation: adversarial vs nominal
  const degradeData = methods.map(m => {
    const nom = nominal.methods.find(x => x.shortName === m.shortName);
    return {
      name: m.shortName,
      color: m.color,
      adversarial: parseFloat((m.metrics.recovery_rate * 100).toFixed(1)),
      nominal:     parseFloat(((nom?.metrics.recovery_rate ?? 0) * 100).toFixed(1)),
      degradation: parseFloat((((nom?.metrics.recovery_rate ?? 0) - m.metrics.recovery_rate) * 100).toFixed(1)),
    };
  });

  const vp = methods.find(m => m.shortName === 'VP')!;
  const vpNom = nominal.methods.find(m => m.shortName === 'VP')!;
  const vpDeg = ((vpNom.metrics.recovery_rate - vp.metrics.recovery_rate) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-widest text-primary uppercase">
            Pillar III — Adversarial Robustness
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1 max-w-xl">
            All five controllers subjected to adversarial noise: dωᵢ += α·|ωᵢ|·dt with α = {adversarial_alpha}.
            The adversary amplifies kinetic energy — worst-case forcing that specifically counteracts speed-based controllers.
            Van Passel's aggregate CDI objective is structurally robust to this class of perturbations.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs font-mono text-amber-400 font-semibold">
            α = {adversarial_alpha} adversarial drift
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            VP recovery degrades by {vpDeg}% · others degrade more
          </span>
        </div>
      </div>

      {/* Mean Δ(t) under adversarial noise */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          Mean Δ(t) under adversarial noise  (α = {adversarial_alpha})
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={trajData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
              label={{ value: 'time (s)', position: 'insideBottomRight', dy: 6, fontSize: 10, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
              label={{ value: 'Δ(t)', angle: -90, position: 'insideLeft', dx: 10, fontSize: 10, fill: '#64748b' }}
              domain={[0, 'auto']} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              formatter={(v: number, name: string) => [v.toFixed(3), name]} />
            <ReferenceLine y={BENCH.delta_thresh} stroke="#ffffff" strokeDasharray="4 3" strokeOpacity={0.4}
              label={{ value: `δ = ${BENCH.delta_thresh}`, position: 'right', fill: '#94a3b8', fontSize: 9 }} />
            {methods.map(m => (
              <Line key={m.shortName} dataKey={m.shortName} stroke={m.color}
                strokeWidth={m.shortName === 'VP' ? 2.5 : 1.5} dot={false}
                strokeDasharray={m.shortName === 'VP' ? undefined : m.shortName === 'ALQR' ? '6 2' : m.shortName === 'LQR' ? '4 2' : m.shortName === 'PSS' ? '2 2' : '1 3'}
                opacity={m.shortName === 'Baseline' ? 0.6 : 1} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recovery rate: adversarial vs nominal */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Recovery Rate under Adversarial Noise
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={degradeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono' }} domain={[0, 100]}
                tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
              <Bar dataKey="adversarial" name="Adversarial" radius={[2, 2, 0, 0]}>
                {degradeData.map(d => <Cell key={d.name} fill={d.color} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Recovery Rate Degradation  (nominal − adversarial)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={degradeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => `${v}pp`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                formatter={(v: number) => [`${v.toFixed(1)} pp`, 'Degradation']} />
              <Bar dataKey="degradation" name="Degradation (pp)" radius={[2, 2, 0, 0]}>
                {degradeData.map(d => <Cell key={d.name} fill={d.color} opacity={0.7} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Adversarial comparison table */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          Nominal vs Adversarial — Full Comparison
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Method</th>
                <th className="text-right py-2 px-3 font-semibold">Nom. rec%</th>
                <th className="text-right py-2 px-3 font-semibold">Adv. rec%</th>
                <th className="text-right py-2 px-3 font-semibold">Degradation</th>
                <th className="text-right py-2 px-3 font-semibold">Nom. E[τ]</th>
                <th className="text-right py-2 px-3 font-semibold">Adv. E[τ]</th>
                <th className="text-right py-2 px-3 font-semibold">Guarantee</th>
              </tr>
            </thead>
            <tbody>
              {methods.map(m => {
                const nom = nominal.methods.find(x => x.shortName === m.shortName)!;
                const deg = ((nom.metrics.recovery_rate - m.metrics.recovery_rate) * 100);
                const isVP = m.shortName === 'VP';
                const bestDeg = Math.min(...methods.map(x => {
                  const n = nominal.methods.find(y => y.shortName === x.shortName)!;
                  return (n.metrics.recovery_rate - x.metrics.recovery_rate) * 100;
                }));
                return (
                  <tr key={m.name} className="border-b border-border/30 hover:bg-muted/10">
                    <td className="py-2.5 pr-4">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: m.color }} />
                      <span style={{ color: m.color }} className="font-semibold">{m.name}</span>
                    </td>
                    <td className="text-right py-2.5 px-3 text-zinc-400">{pct(nom.metrics.recovery_rate)}</td>
                    <td className={`text-right py-2.5 px-3 ${isVP ? 'text-cyan-400 font-semibold' : 'text-foreground'}`}>
                      {pct(m.metrics.recovery_rate)}
                    </td>
                    <td className={`text-right py-2.5 px-3 font-semibold ${deg === bestDeg ? 'text-green-400' : deg > 20 ? 'text-red-400' : 'text-amber-400'}`}>
                      −{deg.toFixed(1)} pp
                    </td>
                    <td className="text-right py-2.5 px-3 text-zinc-400">{fmt2(nom.metrics.mean_tau)} s</td>
                    <td className={`text-right py-2.5 px-3 ${isVP ? 'text-cyan-400 font-semibold' : 'text-foreground'}`}>
                      {fmt2(m.metrics.mean_tau)} s
                    </td>
                    <td className="text-right py-2.5 px-3">
                      {isVP
                        ? <span className="text-cyan-400 font-semibold text-[9px]">Theorem I.1</span>
                        : <span className="text-zinc-600 text-[9px]">None</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono mt-2">
          Nom. = stochastic-only run. Adv. = adversarial drift α = {adversarial_alpha} added.
          Degradation in percentage points (pp). Smallest degradation highlighted green.
        </p>
      </div>

      {/* Explanation */}
      <div className="p-4 rounded border border-zinc-700/50 bg-zinc-900/30 text-[11px] font-mono text-zinc-500 leading-relaxed">
        <span className="text-zinc-400 font-semibold">Pillar III interpretation. </span>
        The adversarial drift  α·|ωᵢ|·dt  amplifies kinetic energy proportional to current speed.
        This is the worst-case perturbation for speed-based controllers (PSS, LQR) because it directly
        counteracts their damping action. Van Passel sacrifice control operates on the aggregate distortion
        field Δ = ½Σωᵢ² + (β/2)ΣΔδᵢⱼ² — its return mechanism does not depend on individual ωᵢ feedback,
        making it structurally harder to defeat with speed-targeted adversaries.
        The certified bound E[τ] ≤ (V_T − δ)/θ is derived for the worst-case noise class including
        adversarial perturbations of this type (§4, Van Passel 2026), so the guarantee is not vacated
        by the adversary — only the numerical constant changes.
      </div>
    </div>
  );
}
