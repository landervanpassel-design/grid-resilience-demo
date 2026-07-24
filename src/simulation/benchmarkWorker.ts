import {
  runBenchmark, runTightnessSweep, runPillarII, runPillarIII,
  BenchmarkParams, BenchmarkResult, TightnessSweepResult, PillarIIResult, PillarIIIResult,
} from './benchmarkEngine';

export interface FullBenchmarkResult {
  benchmark:  BenchmarkResult;
  tightness:  TightnessSweepResult;
  pillar2:    PillarIIResult;
  pillar3:    PillarIIIResult;
}

self.onmessage = (e: MessageEvent<{ type: string; params: BenchmarkParams }>) => {
  if (e.data.type !== 'RUN_BENCHMARK') return;
  const params = e.data.params;

  const post = (pct: number, phase: string) =>
    self.postMessage({ type: 'PROGRESS', percent: pct, phase });

  // Phase 1  0–55 %  — head-to-head benchmark (5 controllers)
  const benchmark = runBenchmark(params, pct => post(pct, 'Head-to-head (5 controllers)…'));

  // Phase 2  55–70 %  — bound tightness sweep
  const tightness = runTightnessSweep(frac => post(55 + Math.round(frac * 15), 'Bound tightness sweep…'));

  // Phase 3  70–85 %  — Pillar II: s* optimality sweep
  const pillar2 = runPillarII(params, frac => post(70 + Math.round(frac * 15), 'Pillar II — s* optimality sweep…'));

  // Phase 4  85–100 % — Pillar III: adversarial robustness
  const pillar3 = runPillarIII(params, frac => post(85 + Math.round(frac * 15), 'Pillar III — adversarial noise…'));

  const result: FullBenchmarkResult = { benchmark, tightness, pillar2, pillar3 };
  self.postMessage({ type: 'DONE', result });
};
