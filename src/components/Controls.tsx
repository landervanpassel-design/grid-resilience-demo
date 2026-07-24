import React from 'react';
import { SimMode, SimParams } from '../simulation/engine';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ControlsProps {
  params: SimParams;
  setParams: React.Dispatch<React.SetStateAction<SimParams>>;
  onRun: () => void;
  isRunning: boolean;
}

export function Controls({ params, setParams, onRun, isRunning }: ControlsProps) {
  const updateParam = (key: keyof SimParams, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-6 w-[280px] shrink-0 border-r border-border p-4 h-full overflow-y-auto bg-card">
      <div>
        <h2 className="text-sm font-bold tracking-widest text-primary mb-1 uppercase font-mono">Parameters</h2>
        <p className="text-xs text-muted-foreground mb-4">Configure IEEE 9-bus state variables</p>
      </div>

      <Tabs 
        value={params.mode} 
        onValueChange={(v) => updateParam('mode', v as SimMode)}
      >
        <TabsList className="grid grid-cols-2 gap-2 h-auto mb-4 bg-transparent p-0">
          <TabsTrigger value="baseline" className="data-[state=active]:bg-secondary border border-transparent data-[state=active]:border-border py-2 text-xs">Baseline</TabsTrigger>
          <TabsTrigger value="driven" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary py-2 text-xs">Driven</TabsTrigger>
          <TabsTrigger value="optimal" className="data-[state=active]:bg-chart-4/20 data-[state=active]:text-chart-4 border border-transparent data-[state=active]:border-chart-4 py-2 text-xs">Optimal</TabsTrigger>
          <TabsTrigger value="adversarial" className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive border border-transparent data-[state=active]:border-destructive py-2 text-xs">Adversarial</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-mono">Contingency V_T</Label>
            <span className="text-xs text-primary font-mono">{params.contingency_severity.toFixed(1)} pu</span>
          </div>
          <Slider 
            min={0.5} max={3.0} step={0.1} 
            value={[params.contingency_severity]} 
            onValueChange={(v) => updateParam('contingency_severity', v[0])} 
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className={`text-xs font-mono ${params.mode === 'baseline' || params.mode === 'optimal' ? 'text-muted-foreground' : ''}`}>
              Sacrifice s*
            </Label>
            <span className={`text-xs font-mono ${params.mode === 'baseline' || params.mode === 'optimal' ? 'text-muted-foreground' : 'text-primary'}`}>
              {params.mode === 'baseline' ? '0.0 (off)' : params.mode === 'optimal' ? 'Auto' : `${params.s_star.toFixed(1)} pu`}
            </span>
          </div>
          <Slider 
            min={0} max={5.0} step={0.1} 
            value={[params.s_star]} 
            onValueChange={(v) => updateParam('s_star', v[0])} 
            disabled={params.mode === 'baseline' || params.mode === 'optimal'}
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-mono">Noise σ</Label>
            <span className="text-xs text-primary font-mono">{params.sigma_noise.toFixed(2)}</span>
          </div>
          <Slider 
            min={0} max={2.0} step={0.05} 
            value={[params.sigma_noise]} 
            onValueChange={(v) => updateParam('sigma_noise', v[0])} 
          />
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label className="text-xs font-mono">Threshold δ</Label>
            <span className="text-xs text-primary font-mono">{params.delta_thresh.toFixed(2)}</span>
          </div>
          <Slider 
            min={0.01} max={2.0} step={0.01} 
            value={[params.delta_thresh]} 
            onValueChange={(v) => updateParam('delta_thresh', v[0])} 
          />
        </div>

        {params.mode === 'adversarial' && (
          <div className="space-y-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-mono text-destructive">Adversarial α</Label>
              <span className="text-xs text-destructive font-mono">{params.alpha_adv.toFixed(1)}</span>
            </div>
            <Slider 
              min={0} max={2.0} step={0.1} 
              value={[params.alpha_adv]} 
              onValueChange={(v) => updateParam('alpha_adv', v[0])} 
              className="[&_[role=slider]]:bg-destructive [&_.bg-primary]:bg-destructive"
            />
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-xs font-mono">MC Paths (N)</Label>
          <Select value={params.num_paths.toString()} onValueChange={(v) => updateParam('num_paths', parseInt(v))}>
            <SelectTrigger className="w-full h-8 text-xs font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 paths (Fast)</SelectItem>
              <SelectItem value="200">200 paths (Standard)</SelectItem>
              <SelectItem value="500">500 paths (Smooth)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={onRun}
          disabled={isRunning}
          className="w-full h-12 bg-primary text-primary-foreground font-bold font-mono tracking-wider rounded transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center uppercase text-sm"
        >
          {isRunning ? 'Computing...' : 'Run Simulation'}
        </button>
      </div>
    </div>
  );
}
