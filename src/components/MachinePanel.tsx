import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { BenchmarkResult } from '../simulation/benchmarkEngine';

interface Props { result: BenchmarkResult; }

const MACHINE_LABELS = ['Gen 1 (23.64 s)', 'Gen 2 (6.40 s)', 'Gen 3 (3.01 s)'];
const MACHINE_SHORT  = ['G1', 'G2', 'G3'];

function SmallChart({
  data, dataKeys, colors, yLabel, refY, height = 160,
}: {
  data: Record<string, number>[];
  dataKeys: { key: string; color: string; dash?: string }[];
  yLabel: string;
  refY?: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="t" tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          tickFormatter={v => v === 0 ? '0' : v === 10 ? '10s' : ''} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 8, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', dx: 12, fontSize: 8, fill: '#475569' }}
          width={36} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          formatter={(v: number, name: string) => [v.toFixed(3), name]} labelFormatter={v => `t = ${Number(v).toFixed(1)} s`} />
        {refY !== undefined && (
          <ReferenceLine y={refY} stroke="#ffffff" strokeDasharray="3 2" strokeOpacity={0.25} />
        )}
        {dataKeys.map(({ key, color, dash }) => (
          <Line key={key} dataKey={key} stroke={color} strokeWidth={key === 'VP' ? 2 : 1.2}
            dot={false} strokeDasharray={dash} opacity={key === 'Baseline' ? 0.65 : 1} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function MachinePanel({ result }: Props) {
  const { t_axis, methods } = result;
  const [activeGen, setActiveGen] = useState(0);

  // Build chart data for selected generator
  const angleData = t_axis.map((t, ti) => {
    const row: Record<string, number> = { t: parseFloat(t.toFixed(2)) };
    for (const m of methods) row[m.shortName] = parseFloat((m.mean_delta_i[activeGen][ti] * 180 / Math.PI).toFixed(3));
    return row;
  });

  const speedData = t_axis.map((t, ti) => {
    const row: Record<string, number> = { t: parseFloat(t.toFixed(2)) };
    for (const m of methods) row[m.shortName] = parseFloat(m.mean_omega_i[activeGen][ti].toFixed(4));
    return row;
  });

  const lineKeys = methods.map(m => ({
    key: m.shortName, color: m.color,
    dash: m.shortName === 'VP' ? undefined : m.shortName === 'ALQR' ? '6 2' : m.shortName === 'LQR' ? '4 2' : m.shortName === 'PSS' ? '2 2' : '1 3',
  }));

  // Summary table: per-method, per-machine final angle and peak speed
  const finalAngles = methods.map(m =>
    m.mean_delta_i.map(di => (di[di.length - 1] * 180 / Math.PI).toFixed(2))
  );
  const peakSpeeds = methods.map(m =>
    m.mean_omega_i.map(wi => Math.max(...wi.map(Math.abs)).toFixed(3))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-widest text-primary uppercase">Per-Machine Trajectories</h2>
          <p className="text-xs text-muted-foreground font-mono mt-1 max-w-xl">
            Mean angle δᵢ(t) [degrees] and frequency deviation ωᵢ(t) [rad/s] for each generator,
            averaged over all Monte Carlo paths. Same noise realization across all five controllers.
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          {MACHINE_LABELS.map((label, i) => (
            <button key={i} onClick={() => setActiveGen(i)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded transition-colors border
                ${activeGen === i ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-zinc-500'}`}>
              {MACHINE_SHORT[i]}
            </button>
          ))}
        </div>
      </div>

      {/* Generator info */}
      <div className="flex items-center gap-4 p-3 rounded border border-border/50 bg-muted/10">
        <div>
          <p className="text-xs font-mono font-semibold text-primary">{MACHINE_LABELS[activeGen]}</p>
          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
            H = {[23.64, 6.40, 3.01][activeGen]} s · Pm = {[0.716, 1.630, 0.850][activeGen]} pu · D = 0.10 pu
            {activeGen === 0 ? ' · Largest inertia — slowest to deviate, hardest to control' :
             activeGen === 1 ? ' · Medium inertia — primary mechanical power source (1.63 pu)' :
             ' · Smallest inertia — fastest oscillation, most sensitive to disturbances'}
          </p>
        </div>
        <div className="ml-auto flex gap-3 flex-wrap justify-end">
          {methods.map(m => (
            <span key={m.shortName} className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="inline-block w-5 h-0.5" style={{ background: m.color }} />
              <span style={{ color: m.color }}>{m.shortName}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Charts: angle + speed */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Rotor angle  δ_{activeGen + 1}(t)  [degrees]
          </p>
          <SmallChart data={angleData} dataKeys={lineKeys} yLabel="δ (°)" height={200} />
          <p className="text-[9px] text-zinc-600 font-mono mt-1">
            Converted from radians. VP sacrifice action reduces angle spread by braking speed deviations.
            ALQR tracks angle closer to zero than global LQR at large deviations.
          </p>
        </div>
        <div>
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
            Frequency deviation  ω_{activeGen + 1}(t)  [rad/s]
          </p>
          <SmallChart data={speedData} dataKeys={lineKeys} yLabel="ω (rad/s)" refY={0} height={200} />
          <p className="text-[9px] text-zinc-600 font-mono mt-1">
            PSS damps ω directly (proportional feedback). VP targets the distortion aggregate — speed
            reduction is an emergent property, not a direct objective.
          </p>
        </div>
      </div>

      {/* Per-machine summary table */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          All Generators — Mean Final Angle & Peak Speed by Method
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left py-2 pr-3 font-semibold">Method</th>
                {MACHINE_LABELS.map((l, i) => (
                  <th key={i} colSpan={2} className="text-center py-2 px-2 font-semibold border-l border-border/30">
                    {MACHINE_SHORT[i]}
                  </th>
                ))}
              </tr>
              <tr className="text-zinc-600 border-b border-border/50">
                <th className="text-left py-1 pr-3" />
                {MACHINE_LABELS.map((_, i) => (
                  <React.Fragment key={i}>
                    <th className="text-right py-1 px-2 border-l border-border/20">δ_f (°)</th>
                    <th className="text-right py-1 px-2">|ω|_max</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {methods.map((m, mi) => (
                <tr key={m.name} className="border-b border-border/30 hover:bg-muted/10">
                  <td className="py-2 pr-3">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: m.color }} />
                    <span style={{ color: m.color }} className="font-semibold">{m.name}</span>
                  </td>
                  {[0, 1, 2].map(gi => (
                    <React.Fragment key={gi}>
                      <td className="text-right py-2 px-2 text-foreground border-l border-border/20">
                        {finalAngles[mi][gi]}°
                      </td>
                      <td className="text-right py-2 px-2 text-foreground">{peakSpeeds[mi][gi]}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] text-zinc-600 font-mono mt-2">
          δ_f = mean rotor angle at t = 10 s (radians → degrees). |ω|_max = peak mean frequency deviation.
          Note: with simplified coupling K_C = 0.3 there is no true swing equilibrium — angles drift continuously
          under mechanical power imbalance (Pm ≠ Pe). This is intentional per the paper's illustrative numerics:
          the distortion field objective does not require a physical equilibrium point (§2, Van Passel 2026).
        </p>
      </div>

      {/* 3-machine overlay: all machines for VP vs Baseline */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
          All-Machine Frequency  ωᵢ(t)  — Van Passel vs Baseline
        </p>
        <div className="grid grid-cols-2 gap-6">
          {(['VP', 'Baseline'] as const).map(sn => {
            const m = methods.find(x => x.shortName === sn)!;
            if (!m) return null;
            const d = t_axis.map((t, ti) => {
              const row: Record<string, number> = { t: parseFloat(t.toFixed(2)) };
              for (let gi = 0; gi < 3; gi++) row[`G${gi + 1}`] = parseFloat(m.mean_omega_i[gi][ti].toFixed(4));
              return row;
            });
            const gens = [0, 1, 2].map(gi => ({
              key: `G${gi + 1}`, color: ['#22d3ee', '#60a5fa', '#a78bfa'][gi],
              dash: gi === 0 ? undefined : gi === 1 ? '4 2' : '2 2',
            }));
            return (
              <div key={sn}>
                <p className="text-[10px] font-mono mb-1" style={{ color: m.color }}>{m.name}</p>
                <SmallChart data={d} dataKeys={gens} yLabel="ω (rad/s)" refY={0} height={160} />
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-zinc-600 font-mono mt-1">
          G1 (solid) · G2 (dashed) · G3 (dotted). Van Passel sacrifice synchronises all three machines
          simultaneously through the aggregate distortion field, not individual machine feedback.
        </p>
      </div>
    </div>
  );
}
