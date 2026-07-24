import React from 'react';
import { SimResult } from '../simulation/engine';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea } from 'recharts';
import { motion } from 'framer-motion';

interface PhasePortraitProps {
  result: SimResult | null;
}

export function PhasePortrait({ result }: PhasePortraitProps) {
  if (!result) return null;

  // Flatten the first 3 paths for phase portrait (w1 vs w2)
  const data = result.phase_paths.map((p, idx) => {
    return p.w1.map((w1, i) => ({
      w1,
      w2: p.w2[i],
      pathId: idx
    }));
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 border-t border-border pt-4">
      <h3 className="text-xs font-mono text-muted-foreground mb-2 uppercase tracking-wider text-center">Phase Space (ω₁ vs ω₂)</h3>
      <div className="w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, bottom: 10, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="w1" type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fontFamily: 'monospace' }} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
            <YAxis dataKey="w2" type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 10, fontFamily: 'monospace' }} domain={['dataMin - 0.5', 'dataMax + 0.5']} />
            <ReferenceArea x1={-0.5} x2={0.5} y1={-0.5} y2={0.5} fill="hsl(var(--chart-4))" fillOpacity={0.1} />
            
            {data.map((pathData, i) => (
              <Scatter key={i} data={pathData} fill={`hsl(var(--primary))`} line={{ stroke: `hsl(var(--primary))`, strokeWidth: 1 }} lineType="joint" shape={<circle r={0} />} opacity={0.5 + i*0.1} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
