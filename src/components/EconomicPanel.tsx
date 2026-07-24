import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
} from 'recharts';
import { MethodResult } from '../simulation/benchmarkEngine';
import { ECONOMICS_2003 } from '../simulation/eventEngine';

interface Props {
  methods: MethodResult[];
}

const fmtB = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : `$${(n / 1e6).toFixed(0)}M`;
const fmtM = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${(n / 1e3).toFixed(0)}K`;

// EPRI 2004: Cost of Power Interruptions to U.S. Electricity Consumers (LBNL/EMP-054)
const COLL_DEFAULTS = {
  residential: 7,     // $/kWh
  commercial:  36,    // $/kWh
  industrial:  75,    // $/kWh
  blended:     28,    // $/kWh weighted US mix
};

export function EconomicPanel({ methods }: Props) {
  const [gridGW,        setGridGW]        = useState(335);   // Eastern Interconnection peak
  const [affectedFrac,  setAffectedFrac]  = useState(0.15);  // fraction affected in major event
  const [outageDurH,    setOutageDurH]    = useState(12);    // hours
  const [eventProbYr,   setEventProbYr]   = useState(0.033); // 1/30 per year
  const [collKwh,       setCollKwh]       = useState(28);    // $/kWh
  const [deployMn,      setDeployMn]      = useState(75);    // $M deployment cost

  // Expected annual loss per method
  const econ = useMemo(() => {
    const gw_affected  = gridGW * affectedFrac;
    const kwh_at_risk  = gw_affected * 1e6 * outageDurH;        // kWh
    const coll_total   = kwh_at_risk * collKwh;                  // $ per full outage
    const vp = methods.find(m => m.shortName === 'VP');

    return methods.map(m => {
      const expected_loss = eventProbYr * (1 - m.metrics.recovery_rate) * coll_total;
      const baseline_loss = eventProbYr * (1 - (methods[0]?.metrics.recovery_rate ?? 0)) * coll_total;
      const ufls    = methods.find(x => x.shortName === 'UFLS');
      const ufls_loss = eventProbYr * (1 - (ufls?.metrics.recovery_rate ?? 0)) * coll_total;
      const savings_vs_baseline = baseline_loss - expected_loss;
      const savings_vs_ufls     = ufls_loss   - expected_loss;
      const payback_yrs = savings_vs_ufls > 0 ? (deployMn * 1e6) / savings_vs_ufls : Infinity;

      return {
        name:                m.name,
        shortName:           m.shortName,
        color:               m.color,
        recovery_rate:       m.metrics.recovery_rate,
        expected_loss,
        savings_vs_baseline,
        savings_vs_ufls,
        payback_yrs,
        coll_total,
        has_guarantee:       m.metrics.has_guarantee,
        theory_bound:        m.metrics.theory_bound,
      };
    });
  }, [methods, gridGW, affectedFrac, outageDurH, eventProbYr, collKwh, deployMn]);

  const vpRow  = econ.find(m => m.shortName === 'VP')!;
  const basRow = econ[0];
  const uflRow = econ.find(m => m.shortName === 'UFLS');

  // ROI sweep — annual savings vs VP deployment cost
  const paybackData = Array.from({ length: 40 }, (_, i) => {
    const cost_mn = 10 + i * 5;
    const pb = vpRow?.savings_vs_ufls > 0 ? cost_mn * 1e6 / vpRow.savings_vs_ufls : 999;
    return { cost_mn, payback_yrs: Math.min(pb, 20) };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-sm font-mono font-bold tracking-widest text-primary uppercase">
            Economic Impact Analysis
          </h2>
          <p className="text-xs text-muted-foreground font-mono mt-1 max-w-xl">
            Translates Monte Carlo recovery rates into expected annual costs.
            Based on EPRI (2004) Cost of Power Interruptions to U.S. Electricity Consumers (LBNL/EMP-054)
            and NERC event frequency data for the Eastern Interconnection.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-mono text-green-400 font-semibold">
            VP saves {fmtM(vpRow?.savings_vs_baseline ?? 0)}/yr vs Baseline
          </p>
          <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
            {fmtM(vpRow?.savings_vs_ufls ?? 0)}/yr vs deployed UFLS
          </p>
        </div>
      </div>

      {/* Parameter sliders */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Eastern Interconnection load', val: gridGW, set: setGridGW, min: 100, max: 700, step: 25, unit: 'GW' },
          { label: 'Affected fraction', val: affectedFrac, set: setAffectedFrac, min: 0.05, max: 0.5, step: 0.05, unit: '', fmt: (v: number) => `${(v*100).toFixed(0)}%` },
          { label: 'Outage duration', val: outageDurH, set: setOutageDurH, min: 1, max: 72, step: 1, unit: 'h' },
          { label: 'Event probability', val: eventProbYr, set: setEventProbYr, min: 0.01, max: 0.2, step: 0.01, unit: '', fmt: (v: number) => `1/${Math.round(1/v)}/yr` },
          { label: 'Cost of lost load (COLL)', val: collKwh, set: setCollKwh, min: 5, max: 100, step: 5, unit: '$/kWh' },
          { label: 'VP deployment cost', val: deployMn, set: setDeployMn, min: 10, max: 500, step: 10, unit: '$M' },
        ].map(p => {
          const display = (p as any).fmt ? (p as any).fmt(p.val) : `${p.val}${p.unit ? ' ' + p.unit : ''}`;
          return (
            <div key={p.label} className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-[10px] font-mono text-zinc-500">{p.label}</label>
                <span className="text-[10px] font-mono text-primary">{display}</span>
              </div>
              <input type="range" min={p.min} max={p.max} step={p.step} value={p.val}
                onChange={e => p.set(Number(e.target.value))}
                className="w-full h-1 bg-zinc-700 rounded appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                  [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                  [&::-webkit-slider-thumb]:bg-primary" />
            </div>
          );
        })}
      </div>

      {/* Expected annual loss chart */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            Expected Annual Cost per Method
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={econ} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="shortName" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                tickFormatter={v => fmtM(v)} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                formatter={(v: number, name: string) => [fmtB(v), 'Expected annual loss']} />
              <Bar dataKey="expected_loss" radius={[2, 2, 0, 0]}>
                {econ.map(m => <Cell key={m.name} fill={m.color} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[9px] font-mono text-zinc-600 mt-1">
            E[loss] = P_event × (1 − recovery_rate) × GW_affected × duration × COLL
          </p>
        </div>

        <div>
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">
            VP Payback Period vs Deployment Cost
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={paybackData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="cost_mn" tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'JetBrains Mono' }}
                label={{ value: 'Deployment cost ($M)', position: 'insideBottomRight', dy: 6, fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
                label={{ value: 'Payback (yrs)', angle: -90, position: 'insideLeft', dx: 12, fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                formatter={(v: number) => [`${v.toFixed(1)} years`, 'Payback vs UFLS']} />
              <ReferenceLine y={1} stroke="#22d3ee" strokeDasharray="3 2" strokeOpacity={0.5}
                label={{ value: '1-yr payback', position: 'right', fill: '#22d3ee', fontSize: 8 }} />
              <ReferenceLine x={deployMn} stroke="#22d3ee" strokeDasharray="2 2" strokeOpacity={0.4} />
              <Line dataKey="payback_yrs" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-[9px] font-mono text-zinc-600 mt-1">
            Payback = deployment_cost / annual_savings_vs_UFLS. Current: {vpRow?.payback_yrs < 20 ? `${(vpRow.payback_yrs * 12).toFixed(0)} months` : '>20 yrs'}.
          </p>
        </div>
      </div>

      {/* Summary table */}
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3">Full Economic Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono border-collapse">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                {['Method', 'Recovery rate', 'E[loss]/yr', 'Savings vs Baseline', 'Savings vs UFLS', 'Payback', 'Certified bound'].map(h => (
                  <th key={h} className="text-right first:text-left py-2 px-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {econ.map(m => {
                const isVP = m.shortName === 'VP';
                const bestSave = m.savings_vs_baseline === Math.max(...econ.map(x => x.savings_vs_baseline));
                return (
                  <tr key={m.name} className={`border-b border-border/30 hover:bg-muted/10 ${isVP ? 'bg-cyan-950/10' : ''}`}>
                    <td className="py-2 px-2">
                      <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: m.color }} />
                      <span style={{ color: m.color }} className="font-semibold">{m.name}</span>
                    </td>
                    <td className="text-right py-2 px-2 text-foreground">{(m.recovery_rate * 100).toFixed(1)}%</td>
                    <td className={`text-right py-2 px-2 ${isVP ? 'text-cyan-400 font-semibold' : 'text-foreground'}`}>{fmtM(m.expected_loss)}</td>
                    <td className={`text-right py-2 px-2 ${bestSave ? 'text-green-400 font-semibold' : m.savings_vs_baseline > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                      {m.savings_vs_baseline > 0 ? '+' : ''}{fmtM(m.savings_vs_baseline)}
                    </td>
                    <td className={`text-right py-2 px-2 ${m.savings_vs_ufls > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                      {m.savings_vs_ufls > 0 ? '+' : ''}{fmtM(m.savings_vs_ufls)}
                    </td>
                    <td className="text-right py-2 px-2 text-foreground">
                      {m.shortName === 'VP' && m.payback_yrs < 20 ? `${(m.payback_yrs * 12).toFixed(0)} mo` :
                       m.shortName === 'VP' ? '>20 yr' : '—'}
                    </td>
                    <td className="text-right py-2 px-2">
                      {m.has_guarantee
                        ? <span className="text-cyan-400">E[τ] ≤ {m.theory_bound?.toFixed(2)} s</span>
                        : <span className="text-zinc-600">None</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2003 event callout */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded border border-red-900/40 bg-red-950/15 text-center">
          <p className="text-[9px] font-mono text-zinc-500 uppercase">2003 actual loss</p>
          <p className="text-xl font-bold font-mono text-red-400 mt-1">$6–10B</p>
          <p className="text-[9px] font-mono text-zinc-600">55M customers · 29h avg</p>
        </div>
        <div className="p-3 rounded border border-amber-900/30 bg-amber-950/10 text-center">
          <p className="text-[9px] font-mono text-zinc-500 uppercase">UFLS mitigation</p>
          <p className="text-xl font-bold font-mono text-amber-400 mt-1">
            {fmtB(ECONOMICS_2003.economic_loss_usd * (1 - (uflRow?.recovery_rate ?? 0.4)))}
          </p>
          <p className="text-[9px] font-mono text-zinc-600">With deployed standard</p>
        </div>
        <div className="p-3 rounded border border-cyan-800/40 bg-cyan-950/15 text-center">
          <p className="text-[9px] font-mono text-zinc-500 uppercase">VP avoided cost</p>
          <p className="text-xl font-bold font-mono text-cyan-400 mt-1">
            {fmtB(ECONOMICS_2003.economic_loss_usd * (vpRow?.recovery_rate ?? 0.85))}
          </p>
          <p className="text-[9px] font-mono text-zinc-600">Saved vs historical · certified bound</p>
        </div>
      </div>

      <div className="p-3 rounded border border-zinc-700/40 bg-zinc-900/30 text-[9px] font-mono text-zinc-600 leading-relaxed">
        <span className="text-zinc-400 font-semibold">Sources. </span>
        EPRI (2004). "Cost of Power Interruptions to U.S. Electricity Consumers." LBNL/EMP-054.
        COLL values: residential $7/kWh, commercial $36/kWh, industrial $75/kWh — blended $28/kWh at US load mix.
        Event probability: 1/30 per year based on 3 major Eastern Interconnection cascades (1965, 1977, 2003) over 60 years.
        Recovery rates from Monte Carlo simulation of 5 control methods under identical stochastic disturbances.
        All values are expected; actual costs depend on the specific event topology and restoration sequence.
      </div>
    </div>
  );
}
