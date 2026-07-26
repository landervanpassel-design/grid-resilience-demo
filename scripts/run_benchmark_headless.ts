/** Headless benchmark run — extracts exact numbers for the one-page technical brief. */
import { runBenchmark } from "../src/simulation/benchmarkEngine";

const params = { contingency_severity: 1.5, sigma_noise: 0.5, num_paths: 200 };
console.log(`Running benchmark: severity=${params.contingency_severity}, sigma=${params.sigma_noise}, paths=${params.num_paths}`);
const t0 = Date.now();
const res = runBenchmark(params, (pct) => {
  if (pct % 10 < 0.5) process.stdout.write(`\r${pct.toFixed(0)}%  `);
});
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

const rows = res.methods.map((m) => ({
  method: m.name,
  recovery_pct: (m.metrics.recovery_rate * 100).toFixed(1),
  mean_tau_s: isFinite(m.metrics.mean_tau) ? m.metrics.mean_tau.toFixed(3) : "—",
  p95_tau_s: isFinite(m.metrics.p95_tau) ? m.metrics.p95_tau.toFixed(3) : "—",
  p_tail: m.metrics.p_tail.toExponential(2),
  control_effort: m.control_effort.toFixed(1),
  guarantee: m.metrics.has_guarantee ? `E[τ]≤${m.metrics.theory_bound?.toFixed(3)}` : "none",
}));
console.table(rows);
console.log(JSON.stringify({ params, rows }, null, 2));
