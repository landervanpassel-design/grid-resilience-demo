import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine, Tooltip, Area, ComposedChart } from 'recharts';
import { SimResult, SimParams } from '../simulation/engine';
import { motion } from 'framer-motion';

interface DeltaChartProps {
  result: SimResult | null;
  params: SimParams;
}

export function DeltaChart({ result, params }: DeltaChartProps) {
  if (!result) {
    return (
      <div className="w-full h-[400px] border border-border/50 rounded-sm bg-card/30 flex items-center justify-center relative">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] opacity-20" />
        <span className="text-muted-foreground font-mono text-sm tracking-widest uppercase">Run simulation to visualize distortion field Δ(t)</span>
      </div>
    );
  }

  // Determine line color based on mode and recovery
  const getMeanColor = () => {
    if (params.mode === 'adversarial' && result.metrics.recovery_rate < 0.5) return 'hsl(var(--destructive))';
    if (params.mode === 'baseline') return 'hsl(var(--chart-2))'; // amber
    if (result.metrics.recovery_rate > 0.9) return 'hsl(var(--chart-1))'; // cyan
    return 'hsl(var(--chart-2))';
  };
  
  const meanColor = getMeanColor();

  // Reformat data for recharts
  // Recharts is easier when data is array of objects { t, mean, p10, p90, path1, path2, ... }
  const chartData = result.mean_delta.map((mean, idx) => {
    const t = idx * (10.0 / 200); // T_sim / out_steps
    const dp: any = { t, mean, p10: result.p10_delta[idx], p90: result.p90_delta[idx] };
    
    // Add individual paths
    result.paths.forEach((p, i) => {
      dp[`path_${i}`] = p.delta[idx];
    });
    
    // For area chart, Area requires an array of [min, max] or separate keys if we use ComposedChart
    // In ComposedChart, Area can use datakey="p90" but we can't easily do a band.
    // Let's just plot lines for bounds, or a single band. Recharts Area can take an array in data if dataKey is array.
    dp.band = [result.p10_delta[idx], result.p90_delta[idx]];
    
    return dp;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-[400px] border border-border rounded-sm bg-card p-4 flex flex-col relative"
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-mono text-foreground font-semibold">Distortion Field Δ(t)</h3>
        <div className="flex gap-4 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full" style={{background: meanColor}}/> Mean Path</span>
          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-border"/> 10/90 Percentile</span>
          <span className="flex items-center gap-1 border-b border-dashed border-white w-4 ml-2"/> δ_thresh
        </div>
      </div>

      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis 
              dataKey="t" 
              type="number" 
              tickCount={11} 
              domain={[0, 10]}
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 11, fontFamily: 'monospace' }}
              label={{ value: 'Δ(x(t))', angle: -90, position: 'insideLeft', fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'monospace' }}
              domain={[0, 'auto']}
            />
            
            {/* Threshold Line */}
            <ReferenceLine y={params.delta_thresh} stroke="hsl(var(--foreground))" strokeDasharray="4 4" strokeWidth={1} />
            
            {/* Theory Bound vertical line */}
            {!isNaN(result.metrics.theory_bound) && result.metrics.theory_bound > 0 && result.metrics.theory_bound < 10 && (
              <ReferenceLine x={result.metrics.theory_bound} stroke="hsl(var(--chart-4))" strokeDasharray="5 5" strokeWidth={1} 
                label={{ value: 'Theory E[τ]', position: 'insideTopRight', fill: 'hsl(var(--chart-4))', fontSize: 11, fontFamily: 'monospace' }}
              />
            )}

            {/* Percentile Band */}
            <Area dataKey="band" stroke="none" fill="hsl(var(--muted))" fillOpacity={0.3} isAnimationActive={true} animationDuration={1000} />

            {/* Individual paths */}
            {result.paths.slice(0, 10).map((_, i) => (
              <Line 
                key={`path_${i}`} 
                type="monotone" 
                dataKey={`path_${i}`} 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={1} 
                dot={false} 
                isAnimationActive={false}
                opacity={0.3}
              />
            ))}

            {/* Mean Path */}
            <Line 
              type="monotone" 
              dataKey="mean" 
              stroke={meanColor} 
              strokeWidth={3} 
              dot={false} 
              isAnimationActive={true}
              animationDuration={1500}
            />

            <Tooltip 
              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelFormatter={(l) => `t = ${Number(l).toFixed(2)}s`}
              formatter={(val: any, name: string) => {
                if (name === 'mean') return [Number(val).toFixed(3), 'Mean Δ'];
                if (name === 'band') return [`${Number(val[0]).toFixed(3)} - ${Number(val[1]).toFixed(3)}`, '10/90 Percentile'];
                return [];
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
