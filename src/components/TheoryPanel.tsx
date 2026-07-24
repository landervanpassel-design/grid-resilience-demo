import React from 'react';
import { SimResult, SimParams } from '../simulation/engine';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TheoryPanelProps {
  result: SimResult | null;
  params: SimParams;
}

export function TheoryPanel({ result, params }: TheoryPanelProps) {
  
  const StatRow = ({ label, value, colorClass = "text-foreground", tooltip }: { label: string, value: React.ReactNode, colorClass?: string, tooltip: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
        <Tooltip>
          <TooltipTrigger><Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground transition-colors" /></TooltipTrigger>
          <TooltipContent className="max-w-[200px] text-xs font-mono">{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <span className={`text-sm font-mono font-semibold ${colorClass}`}>{value}</span>
    </div>
  );

  return (
    <div className="w-[300px] shrink-0 border-l border-border p-4 h-full overflow-y-auto bg-card flex flex-col">
      <div className="mb-6">
        <h2 className="text-sm font-bold tracking-widest text-primary mb-1 uppercase font-mono">Theoretical Bounds</h2>
        <p className="text-xs text-muted-foreground">Stochastic Reconstruction Framework</p>
      </div>

      <div className="space-y-4 flex-1">
        
        {/* Badges */}
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge active={true} label="Pillar I: Bounds" />
          <Badge active={params.mode === 'optimal'} label="Pillar II: Opt" />
          <Badge active={params.mode === 'adversarial'} label="Pillar III: Adv" />
        </div>

        {result ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 bg-background/50 rounded-md p-3 border border-border/50">
            <StatRow 
              label="CDI Margin θ" 
              value={result.metrics.theta.toFixed(3)} 
              colorClass={result.metrics.theta > 0 ? 'text-chart-4' : 'text-destructive'}
              tooltip="Coherent Drift Inequality margin. Must be > 0 for guaranteed recovery."
            />
            {params.mode === 'adversarial' && (
              <StatRow 
                label="Robust Margin θ_rob" 
                value={result.metrics.theta_rob.toFixed(3)} 
                colorClass={result.metrics.theta_rob > 0 ? 'text-chart-4' : 'text-destructive'}
                tooltip="Margin under worst-case adversarial drift."
              />
            )}
            
            <StatRow 
              label="Initial Dist. V_T" 
              value={result.metrics.V_T.toFixed(2)} 
              tooltip="Distortion metric at t=0 immediately after contingency."
            />
            
            <div className="my-2 h-[1px] bg-border" />
            
            <StatRow 
              label="Bound E[τ] ≤" 
              value={result.metrics.theta > 0 ? `${result.metrics.theory_bound.toFixed(2)}s` : '∞'} 
              colorClass={result.metrics.theta > 0 ? "text-primary" : "text-muted-foreground"}
              tooltip="Theoretical upper bound on expected recovery time (Theorem I.1)."
            />
            
            <StatRow 
              label="Empirical E[τ]" 
              value={`${result.metrics.mean_tau.toFixed(2)}s`}
              tooltip="Actual mean recovery time from Monte Carlo."
            />

            <div className="mt-4 pt-3 border-t border-border/50">
              <span className="text-xs font-mono text-muted-foreground block mb-1">Status</span>
              {result.metrics.theta <= 0 && params.mode !== 'adversarial' ? (
                <div className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  CDI not satisfied. Recovery not guaranteed. Increase sacrifice s*.
                </div>
              ) : params.mode === 'adversarial' && result.metrics.theta_rob <= 0 ? (
                <div className="text-xs font-mono text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
                  Robust CDI broken. Adversary dominates.
                </div>
              ) : (
                <div className="text-xs font-mono text-chart-4 bg-chart-4/10 p-2 rounded border border-chart-4/20 flex items-start gap-2">
                  <span className="mt-0.5">✓</span>
                  <span>Almost-sure return guaranteed. Bound holds.</span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="h-48 border border-border/50 border-dashed rounded-md flex items-center justify-center text-xs text-muted-foreground font-mono text-center px-4">
            Run simulation to compute Riccati bounds and CDI margins
          </div>
        )}

      </div>
      
      <div className="mt-auto pt-6 border-t border-border">
        <p className="text-[10px] text-muted-foreground font-mono leading-tight">
          Reference: "Reconstruction after Extreme Distortion" (Van Passel, 2026).
          <br/><br/>
          Stochastic Lyapunov framework for power grid transient stability.
        </p>
      </div>
    </div>
  );
}

function Badge({ active, label }: { active: boolean, label: string }) {
  return (
    <span className={`text-[10px] font-mono px-2 py-1 rounded-full border ${active ? 'bg-primary/20 text-primary border-primary/30' : 'bg-muted/50 text-muted-foreground border-border'}`}>
      {label}
    </span>
  );
}
