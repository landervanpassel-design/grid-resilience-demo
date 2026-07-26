/**
 * Headless 2003-replay run — exact per-path stage-firing statistics.
 * Noise is seeded (xorshift, same seeds as runEvent2003), so these numbers
 * are exactly reproducible, unlike the (unseeded) benchmark Monte Carlo.
 */
import { runPath, CASCADE_STAGES, Scenario } from "../src/simulation/eventEngine";

const N_PATHS = 30, N = 10000, SIGMA = 0.08, T_SIM = 10.0;

// Replicate makeNoise (private): xorshift + Box-Muller, identical seeds
function makeNoise(n: number, seed: number): Float32Array {
  let s = seed >>> 0;
  const rng = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 0x100000000; };
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 2) {
    const r = Math.sqrt(-2 * Math.log(rng() + 1e-12));
    const t = 2 * Math.PI * rng();
    arr[i] = r * Math.cos(t);
    if (i + 1 < n * 3) arr[i + 1] = r * Math.sin(t);
  }
  return arr;
}

const noiseBlocks = Array.from({ length: N_PATHS }, (_, p) =>
  makeNoise(N, 0xdeadbeef + p * 6364136223846793005),
);

const scenarios: Scenario[] = ["historical", "ufls", "vp", "vp_ufls"];
const out: Record<string, unknown>[] = [];

for (const sc of scenarios) {
  const stageFireCounts = CASCADE_STAGES.map(() => 0);
  const taus: number[] = [];
  for (let p = 0; p < N_PATHS; p++) {
    const { stages_fired, tau } = runPath(sc, SIGMA, noiseBlocks[p]);
    stages_fired.forEach((f, i) => { if (f) stageFireCounts[i]++; });
    taus.push(tau);
  }
  const recovered = taus.filter((t) => t < T_SIM);
  out.push({
    scenario: sc,
    // stage 0 = initial condition (always fired); stages 1..4 are preventable
    stage_fire_counts: stageFireCounts.map((c, i) => `S${i}:${c}/${N_PATHS}`).join(" "),
    recovery: `${recovered.length}/${N_PATHS}`,
    mean_tau_recovered_s: recovered.length ? (recovered.reduce((a, b) => a + b, 0) / recovered.length).toFixed(3) : "—",
  });
}
console.table(out);
console.log(JSON.stringify(out, null, 2));
