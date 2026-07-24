import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { SimResult, SimParams } from '../simulation/engine';
import { motion } from 'framer-motion';

interface TauHistogramProps {
  result: SimResult | null;
  params: SimParams;
}

export function TauHistogram({ result, params }: TauHistogramProps) {
  if (!result) {
    return (
      <div className="w-full h-[250px] border border-border/50 rounded-sm bg-card/30 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
        <span className="text-muted-foreground font-mono text-sm tracking-widest uppercase">Waiting for data</span>
      </div>
    );
  }

  const rec_times = result.recovery_times.filter(t => t < 10.0);
  
  if (rec_times.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full h-[250px] border border-border rounded-sm bg-card p-4 flex flex-col items-center justify-center text-center">
        <p className="text-destructive font-mono font-bold mb-2">No recoveries within simulation horizon.</p>
        <p className="text-muted-foreground font-mono text-xs max-w-[80%]">System experienced prolonged distortion. Increase sacrifice control s* or lower contingency severity to enable recovery.</p>
      </motion.div>
    );
  }

  // Create bins for histogram
  const min_t = Math.floor(Math.min(...rec_times) * 10) / 10;
  const max_t = Math.ceil(Math.max(...rec_times) * 10) / 10;
  const num_bins = 20;
  const bin_width = Math.max((max_t - min_t) / num_bins, 0.05);
  
  const bins = Array.from({ length: num_bins }, (_, i) => ({
    bin_start: min_t + i * bin_width,
    bin_end: min_t + (i + 1) * bin_width,
    count: 0
  }));

  rec_times.forEach(t => {
    let bin_idx = Math.floor((t - min_t) / bin_width);
    if (bin_idx >= num_bins) bin_idx = num_bins - 1;
    if (bin_idx < 0) bin_idx = 0;
    bins[bin_idx].count++;
  });

  const chartData = bins.map(b => ({
    name: `${b.bin_start.toFixed(1)}-${b.bin_end.toFixed(1)}s`,
    mid: b.bin_start + bin_width / 2,
    count: b.count,
    prob: b.count / result.recovery_times.length
  }));

  const barColor = params.mode === 'adversarial' ? 'hsl(var(--destructive))' : 
                   params.mode === 'baseline' ? 'hsl(var(--chart-2))' : 
                   params.mode === 'optimal' ? 'hsl(var(--chart-4))' : 'hsl(var(--primary))';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="w-full h-[250px] border border-border rounded-sm bg-card p-4 flex flex-col relative"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-mono text-foreground font-semibold">Recovery Time τ_δ Distribution</h3>
        <div className="text-xs font-mono text-muted-foreground flex gap-3">
          <span>Empirical Mean: <span className="text-foreground">{result.metrics.mean_tau.toFixed(2)}s</span></span>
        </div>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="mid" 
              tickFormatter={(v) => v.toFixed(1)}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              label={{ value: 'Recovery Time τ (s)', position: 'insideBottom', offset: -15, fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }}
            />
            
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(val: number) => [val, 'Paths']}
              labelFormatter={(l, items) => items[0]?.payload?.name || l}
            />

            <Bar dataKey="count" fill={barColor} isAnimationActive={true} animationDuration={1000} radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColor} fillOpacity={0.8} />
              ))}
            </Bar>
            
            {/* Mean Line */}
            <ReferenceLine x={result.metrics.mean_tau} stroke="hsl(var(--foreground))" strokeDasharray="3 3" />
            
            {/* Theory Line */}
            {!isNaN(result.metrics.theory_bound) && result.metrics.theory_bound > 0 && result.metrics.theory_bound < 10 && (
              <ReferenceLine x={result.metrics.theory_bound} stroke="hsl(var(--chart-4))" strokeWidth={2} strokeDasharray="5 5" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
