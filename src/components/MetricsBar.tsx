import React from 'react';
import { SimResult } from '../simulation/engine';
import { Activity, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MetricsBarProps {
  result: SimResult | null;
}

export function MetricsBar({ result }: MetricsBarProps) {
  
  const Item = ({ icon: Icon, label, value, colorClass = "text-foreground" }: any) => (
    <div className="flex items-center gap-3 bg-card border border-border px-4 py-3 rounded-sm flex-1 min-w-[200px]">
      <div className={`p-2 rounded-sm bg-background border border-border/50 ${colorClass.replace('text-', 'text-')}`}>
        <Icon className={`w-4 h-4 ${colorClass}`} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-0.5">{label}</div>
        <div className={`text-lg font-mono font-bold leading-none ${colorClass}`}>
          {value}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-wrap gap-4 mb-4">
      <Item 
        icon={CheckCircle2} 
        label="Recovery Rate" 
        value={result ? `${(result.metrics.recovery_rate * 100).toFixed(1)}%` : '--'} 
        colorClass={result ? (result.metrics.recovery_rate > 0.95 ? "text-chart-4" : result.metrics.recovery_rate > 0.5 ? "text-chart-2" : "text-destructive") : "text-muted-foreground"}
      />
      <Item 
        icon={Clock} 
        label="Empirical Mean τ" 
        value={result ? `${result.metrics.mean_tau.toFixed(2)}s` : '--'} 
        colorClass="text-primary"
      />
      <Item 
        icon={Activity} 
        label="CDI Margin θ" 
        value={result ? result.metrics.theta.toFixed(3) : '--'} 
        colorClass={result ? (result.metrics.theta > 0 ? "text-chart-4" : "text-destructive") : "text-muted-foreground"}
      />
      <Item 
        icon={ShieldAlert} 
        label="Bound Gap" 
        value={result && result.metrics.theta > 0 ? `${(result.metrics.theory_bound - result.metrics.mean_tau).toFixed(2)}s` : '--'} 
        colorClass="text-foreground"
      />
    </div>
  );
}
