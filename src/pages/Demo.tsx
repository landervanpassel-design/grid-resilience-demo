import React, { useState, useRef, useEffect } from 'react';
import { SimParams, SimResult } from '../simulation/engine';
import { Controls } from '../components/Controls';
import { DeltaChart } from '../components/DeltaChart';
import { TauHistogram } from '../components/TauHistogram';
import { TheoryPanel } from '../components/TheoryPanel';
import { MetricsBar } from '../components/MetricsBar';
import { ExportButton } from '../components/ExportButton';
import { PhasePortrait } from '../components/PhasePortrait';

export default function Demo() {
  const [params, setParams] = useState<SimParams>({
    contingency_severity: 1.5,
    s_star: 1.0,
    sigma_noise: 0.3,
    delta_thresh: 0.5,
    alpha_adv: 0.0,
    num_paths: 200,
    mode: 'driven'
  });

  const [result, setResult] = useState<SimResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../simulation/worker.ts', import.meta.url), { type: 'module' });
    
    workerRef.current.onmessage = (e) => {
      const { type, percent, result: res } = e.data;
      if (type === 'PROGRESS') {
        setProgress(percent);
      } else if (type === 'DONE') {
        setResult(res);
        setIsRunning(false);
        setProgress(0);
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const runSimulation = () => {
    if (!workerRef.current || isRunning) return;
    setIsRunning(true);
    setProgress(0);
    workerRef.current.postMessage({ type: 'RUN', params });
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      
      {/* Controls Left Panel */}
      <Controls params={params} setParams={setParams} onRun={runSimulation} isRunning={isRunning} />

      {/* Main Center Area */}
      <div className="flex-1 flex flex-col p-6 h-full overflow-y-auto relative">
        {isRunning && (
          <div className="absolute top-0 left-0 w-full h-1 bg-background z-50">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold font-mono tracking-tight text-foreground">Stochastic Reconstruction Engine</h1>
            <p className="text-sm font-mono text-muted-foreground mt-1">Power Grid Resilience via Sacrifice Control</p>
          </div>
          <div className="flex items-center gap-4">
            {isRunning && <span className="text-xs font-mono text-primary animate-pulse">Computing MC trajectories... {progress}%</span>}
            <ExportButton result={result} params={params} />
          </div>
        </div>

        <MetricsBar result={result} />

        <div className="flex flex-col gap-4 flex-1">
          <DeltaChart result={result} params={params} />
          <TauHistogram result={result} params={params} />
        </div>
      </div>

      {/* Theory Right Panel */}
      <div className="flex flex-col h-full w-[300px]">
        <TheoryPanel result={result} params={params} />
        <div className="bg-card px-4 pb-4 border-l border-border shrink-0">
           <PhasePortrait result={result} />
        </div>
      </div>

    </div>
  );
}
