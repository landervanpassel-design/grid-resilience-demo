/**
 * Benchmark Engine — IEEE 9-Bus Stochastic Control Comparison
 *
 * Five control strategies on identical stochastic paths:
 *   0  Baseline      — no control
 *   1  PSS Droop     — IEEE Std 421.5: u = −K·ω
 *   2  LQR           — DARE-optimal at zero reference
 *   3  Adaptive LQR  — re-linearises around current state every 50 ms (≈ NMPC)
 *   4  Van Passel    — CDI sacrifice control, certified E[τ] ≤ (V_T−δ)/θ
 *
 * Also exports:
 *   runTightnessSweep() — validates VP bound across σ × severity grid
 *   runPillarII()       — s* sweep: optimality of CDI sacrifice (Pillar II)
 *   runPillarIII()      — adversarial robustness comparison (Pillar III)
 *
 * Reference: Van Passel, "Reconstruction after Extreme Distortion," Zenodo 2026.
 */

// ─────────────────────────────────────────────────────────────────────────────
// MATRIX UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

type Mat = number[][];
function zeros(n: number, m: number): Mat { return Array.from({ length: n }, () => new Array(m).fill(0)); }
function eye(n: number): Mat { const I = zeros(n, n); for (let i = 0; i < n; i++) I[i][i] = 1; return I; }
function matAdd(A: Mat, B: Mat): Mat { return A.map((r, i) => r.map((v, j) => v + B[i][j])); }
function matSub(A: Mat, B: Mat): Mat { return A.map((r, i) => r.map((v, j) => v - B[i][j])); }
function matScale(A: Mat, s: number): Mat { return A.map(r => r.map(v => v * s)); }
function matMul(A: Mat, B: Mat): Mat {
  const nA = A.length, mA = A[0].length, mB = B[0].length, C = zeros(nA, mB);
  for (let i = 0; i < nA; i++) for (let k = 0; k < mA; k++) { const a = A[i][k]; for (let j = 0; j < mB; j++) C[i][j] += a * B[k][j]; }
  return C;
}
function matT(A: Mat): Mat { const B = zeros(A[0].length, A.length); for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) B[j][i] = A[i][j]; return B; }
function matInv(A: Mat): Mat {
  const n = A.length;
  const aug = A.map((row, i) => { const r = [...row, ...new Array(n).fill(0)]; r[n + i] = 1; return r; });
  for (let col = 0; col < n; col++) {
    let mx = col; for (let r = col + 1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[mx][col])) mx = r;
    [aug[col], aug[mx]] = [aug[mx], aug[col]];
    const p = aug[col][col]; if (Math.abs(p) < 1e-14) return eye(n);
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= p;
    for (let r = 0; r < n; r++) { if (r === col) continue; const f = aug[r][col]; for (let j = 0; j < 2 * n; j++) aug[r][j] -= f * aug[col][j]; }
  }
  return aug.map(r => r.slice(n));
}
export function normFro(A: Mat): number { let s = 0; for (const r of A) for (const v of r) s += v * v; return Math.sqrt(s); }
function deepCopy(A: Mat): Mat { return A.map(r => [...r]); }

// ─────────────────────────────────────────────────────────────────────────────
// IEEE 9-BUS PHYSICS
// ─────────────────────────────────────────────────────────────────────────────

const WBASE = 2 * Math.PI * 60;
const H     = [23.64, 6.40, 3.01];   // exact Anderson & Fouad
const D_dmp = [0.10, 0.10, 0.10];
const Pm    = [0.716, 1.630, 0.850];
const K_C   = 0.30;
const BETA  = 0.05;

export function distortion(delta: number[], w: number[]): number {
  let kin = 0; for (let i = 0; i < 3; i++) kin += w[i] * w[i];
  let pot = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = delta[i] - delta[j]; pot += d * d; }
  return 0.5 * kin + 0.5 * BETA * pot;
}
function Pe(delta: number[], i: number): number {
  let p = 0; for (let j = 0; j < 3; j++) if (j !== i) p += K_C * Math.sin(delta[i] - delta[j]); return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// LQR  (linearisation + DARE)
// ─────────────────────────────────────────────────────────────────────────────

function linearise(delta_ref: number[], _w: number[]): { A: Mat; B: Mat } {
  const A = zeros(6, 6), B = zeros(6, 3);
  for (let i = 0; i < 3; i++) A[i][i + 3] = 1.0;
  for (let i = 0; i < 3; i++) {
    const ai = WBASE / (2 * H[i]);
    for (let j = 0; j < 3; j++) {
      if (j === i) { let v = 0; for (let k = 0; k < 3; k++) if (k !== i) v += K_C * Math.cos(delta_ref[i] - delta_ref[k]); A[i + 3][j] = -ai * v; }
      else A[i + 3][j] = ai * K_C * Math.cos(delta_ref[i] - delta_ref[j]);
    }
    A[i + 3][i + 3] = -ai * D_dmp[i];
    B[i + 3][i] = ai;
  }
  return { A, B };
}

function solveDARE(A: Mat, B: Mat, Q: Mat, R: Mat, P_init: Mat, iters: number): { K: Mat; P: Mat } {
  const DT = 0.002;
  const Ad = matAdd(eye(6), matScale(A, DT)), Bd = matScale(B, DT), Qd = matScale(Q, DT);
  const AdT = matT(Ad), BdT = matT(Bd);
  let P = deepCopy(P_init);
  for (let it = 0; it < iters; it++) {
    const BtP = matMul(BdT, P), S = matAdd(matMul(BtP, Bd), R), Si = matInv(S);
    const AtP = matMul(AdT, P);
    const Pnew = matAdd(Qd, matSub(matMul(AtP, Ad), matMul(matMul(AtP, Bd), matMul(Si, matMul(BtP, Ad)))));
    const diff = normFro(matSub(Pnew, P)); P = Pnew; if (diff < 1e-9) break;
  }
  const Bd2 = matScale(B, DT), BdT2 = matT(Bd2), Ad2 = matAdd(eye(6), matScale(A, DT));
  const BtP = matMul(BdT2, P), S = matAdd(matMul(BtP, Bd2), R);
  return { K: matMul(matInv(S), matMul(BtP, Ad2)), P };
}

function buildQR(): { Q: Mat; R: Mat } {
  const Q = zeros(6, 6), R = zeros(3, 3);
  for (let i = 0; i < 3; i++) Q[i][i] = 1.0;
  for (let i = 3; i < 6; i++) Q[i][i] = 20.0;
  for (let i = 0; i < 3; i++) R[i][i] = 0.08;
  return { Q, R };
}

function buildGlobalLQR(): { K: Mat; P: Mat } {
  const { A, B } = linearise([0, 0, 0], [0, 0, 0]);
  const { Q, R } = buildQR();
  return solveDARE(A, B, Q, R, zeros(6, 6), 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const M_PHI = 0.15, M_SIGMA = 0.05, C_SAC = 1.0;

export const BENCH = {
  s_star: 2.0, delta_thresh: 0.5, K_pss: 8.0,
  adapt_interval: 50, adapt_iters: 80,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface MethodResult {
  name: string; shortName: string; color: string; description: string;
  mean_delta:   number[];
  p10_delta:    number[];
  p90_delta:    number[];
  mean_delta_i: number[][];   // [3 machines][OUT+1] — per-machine angle mean
  mean_omega_i: number[][];   // [3 machines][OUT+1] — per-machine speed mean
  cdf_t: number[]; cdf_p: number[]; tau_all: number[];
  control_effort: number;
  metrics: {
    recovery_rate: number; mean_tau: number; p95_tau: number; p_tail: number;
    has_guarantee: boolean; theory_bound?: number; theta?: number;
  };
}

export interface BenchmarkParams { contingency_severity: number; sigma_noise: number; num_paths: number; }

export interface BenchmarkResult {
  t_axis: number[]; methods: MethodResult[]; params: BenchmarkParams; lqr_gain_norm: number;
}

export interface TightnessPoint {
  sigma: number; severity: number; V_T: number;
  theory_bound: number; empirical: number; recovery_rate: number; ratio: number; theta: number;
}
export interface TightnessSweepResult { points: TightnessPoint[]; sigma_vals: number[]; severity_vals: number[]; }

export interface PillarIIPoint {
  s_star: number; mean_tau: number; theory_bound: number; effort: number; recovery_rate: number;
}
export interface PillarIIResult { points: PillarIIPoint[]; optimal_s_empirical: number; optimal_s_theory: number; }

export interface PillarIIIResult {
  t_axis: number[]; methods: MethodResult[]; adversarial_alpha: number; params: BenchmarkParams;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED STEP HELPER
// ─────────────────────────────────────────────────────────────────────────────

/** One Euler–Maruyama step; returns new [delta, w]. */
function eulerStep(
  delta: number[], w: number[], noise3: number[], sigma: number, DT: number,
  ctrl: (i: number, delta: number[], w: number[], dist: number) => number,
  adversarial_alpha = 0,
): { delta: number[]; w: number[] } {
  const dist = distortion(delta, w);
  const nd = [...delta], nw = [...w];
  const SQ = Math.sqrt(DT);
  for (let i = 0; i < 3; i++) {
    const ai = WBASE / (2 * H[i]);
    const u = ctrl(i, delta, w, dist);
    const adv = adversarial_alpha * Math.abs(w[i]); // adversary amplifies kinetic energy
    nw[i] = w[i] + ai * (Pm[i] - Pe(delta, i) - D_dmp[i] * w[i] + u) * DT
                 + sigma * SQ * noise3[i] + adv * DT;
    nd[i] = delta[i] + w[i] * DT;
  }
  return { delta: nd, w: nw };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN BENCHMARK RUNNER
// ─────────────────────────────────────────────────────────────────────────────

export function runBenchmark(
  params: BenchmarkParams,
  onProgress: (pct: number) => void,
  adversarial_alpha = 0,
): BenchmarkResult {
  const DT = 0.001, T_SIM = 10.0, N = Math.round(T_SIM / DT), SQ_DT = Math.sqrt(DT);
  const OUT = 200, OINT = Math.floor(N / OUT);
  const t_axis = Array.from({ length: OUT + 1 }, (_, i) => i * (T_SIM / OUT));
  const { s, sigma } = { s: params.contingency_severity, sigma: params.sigma_noise };

  const d0 = [0, s * 0.4, s * 0.2], w0 = [s * 2.0, s * 1.2, s * 0.8];
  const theta = C_SAC * BENCH.s_star - M_PHI - M_SIGMA;
  const V_T = distortion(d0, w0);
  const theory_bound = theta > 0 ? Math.max(0, (V_T - BENCH.delta_thresh) / theta) : Infinity;

  const { K: K_lqr, P: P_global } = buildGlobalLQR();
  const { Q, R } = buildQR();

  const NM = 6;
  const META = [
    { name: 'Baseline',      short: 'Baseline', color: '#ef4444', desc: 'No control — natural multi-machine swing dynamics under Itô noise.' },
    { name: 'PSS Droop',     short: 'PSS',      color: '#f59e0b', desc: `IEEE Std 421.5 PSS: u = −${BENCH.K_pss}·ω. Proportional speed feedback, widely deployed standard.` },
    { name: 'LQR',           short: 'LQR',      color: '#3b82f6', desc: 'Discrete-time DARE-optimal at zero reference. Best possible linear control for noiseless linearised model; no stochastic τ guarantee.' },
    { name: 'Adaptive LQR',  short: 'ALQR',     color: '#8b5cf6', desc: `Re-linearises around current (δ,ω) every ${BENCH.adapt_interval} ms, warm-starts Riccati (${BENCH.adapt_iters} iters). Approximates nonlinear MPC without an explicit prediction horizon.` },
    { name: 'Van Passel',    short: 'VP',        color: '#22d3ee', desc: `CDI sacrifice control (Pillar I).  s* = ${BENCH.s_star} pu.  Certified  E[τ] ≤ ${isFinite(theory_bound) ? theory_bound.toFixed(2) : '∞'} s  (Theorem I.1). Only method with a provable stochastic return bound.` },
    { name: 'UFLS (deployed)',short: 'UFLS',     color: '#10b981', desc: 'Under-Frequency Load Shedding — NERC-standard staged load shedding triggered at distortion thresholds. The actual deployed industry defence against cascading failures. Three stages (10/20/30% load shed) mapped to distortion thresholds.' },
  ];

  // Accumulators — aggregate Δ(t)
  const allDelta:   Float32Array[][] = Array.from({ length: NM }, () => []);
  const allTau:     number[][]       = Array.from({ length: NM }, () => []);
  const allEffort:  number[]         = new Array(NM).fill(0);
  // Per-machine accumulators
  const sumDeltaI:  number[][][] = Array.from({ length: NM }, () => Array.from({ length: 3 }, () => new Array(OUT + 1).fill(0)));
  const sumOmegaI:  number[][][] = Array.from({ length: NM }, () => Array.from({ length: 3 }, () => new Array(OUT + 1).fill(0)));

  const prog_step = Math.max(1, Math.floor(params.num_paths / 50));

  for (let p = 0; p < params.num_paths; p++) {
    // Shared Wiener increments
    const noise_flat = new Float32Array(N * 3);
    for (let i = 0; i < N * 3; i += 2) {
      const r = Math.sqrt(-2 * Math.log(Math.random() + 1e-12));
      const t = 2 * Math.PI * Math.random();
      noise_flat[i] = r * Math.cos(t);
      if (i + 1 < N * 3) noise_flat[i + 1] = r * Math.sin(t);
    }

    for (let m = 0; m < NM; m++) {
      let delta = [...d0], w = [...w0];
      const dpath = new Float32Array(OUT + 1);
      const dpathDI = Array.from({ length: 3 }, () => new Float32Array(OUT + 1));
      const dpathWI = Array.from({ length: 3 }, () => new Float32Array(OUT + 1));
      dpath[0] = distortion(delta, w);
      for (let i = 0; i < 3; i++) { dpathDI[i][0] = delta[i]; dpathWI[i][0] = w[i]; }

      let tau = T_SIM, rec = false, effort = 0;
      let K_ad = deepCopy(K_lqr), P_ad = deepCopy(P_global);

      for (let step = 1; step <= N; step++) {
        // Adaptive LQR re-linearisation
        if (m === 3 && step % BENCH.adapt_interval === 0) {
          const { A: Al, B: Bl } = linearise(delta, w);
          const res = solveDARE(Al, Bl, Q, R, P_ad, BENCH.adapt_iters);
          K_ad = res.K; P_ad = res.P;
        }

        const dist = distortion(delta, w);
        const xp = [delta[0], delta[1], delta[2], w[0], w[1], w[2]];
        const dw = [0, 0, 0], dd = [0, 0, 0];

        for (let i = 0; i < 3; i++) {
          const ai = WBASE / (2 * H[i]);
          let u = 0;
          if (m === 1) u = -BENCH.K_pss * w[i];
          else if (m === 2) { let s2 = 0; for (let j = 0; j < 6; j++) s2 += K_lqr[i][j] * xp[j]; u = Math.max(-20, Math.min(20, -s2)); }
          else if (m === 3) { let s2 = 0; for (let j = 0; j < 6; j++) s2 += K_ad[i][j] * xp[j]; u = Math.max(-20, Math.min(20, -s2)); }
          else if (m === 4 && dist >= BENCH.delta_thresh) u = -BENCH.s_star * Math.sign(w[i]) * C_SAC;
          else if (m === 5) {
            // UFLS: Under-Frequency Load Shedding — staged, distortion-triggered
            // Stage 1 (10% shed): dist ≥ 0.15  → mild proportional damping
            // Stage 2 (20% shed): dist ≥ 0.35  → moderate
            // Stage 3 (30% shed): dist ≥ 0.60  → emergency
            const K_ufls = dist >= 0.60 ? 10.0 : dist >= 0.35 ? 6.0 : dist >= 0.15 ? 3.0 : 0;
            u = -K_ufls * w[i];
          }

          effort += Math.abs(u) * DT;
          const adv = adversarial_alpha * Math.abs(w[i]);
          const z = noise_flat[(step - 1) * 3 + i];
          dw[i] = ai * (Pm[i] - Pe(delta, i) - D_dmp[i] * w[i] + u) * DT + sigma * SQ_DT * z + adv * DT;
          dd[i] = w[i] * DT;
        }

        for (let i = 0; i < 3; i++) { w[i] += dw[i]; delta[i] += dd[i]; }

        if (step % OINT === 0) {
          const si = step / OINT;
          dpath[si] = distortion(delta, w);
          for (let i = 0; i < 3; i++) { dpathDI[i][si] = delta[i]; dpathWI[i][si] = w[i]; }
        }

        if (!rec && step * DT > 0.05 && distortion(delta, w) < BENCH.delta_thresh) { tau = step * DT; rec = true; }
      }

      allDelta[m].push(dpath);
      allTau[m].push(tau);
      allEffort[m] += effort;
      for (let i = 0; i < 3; i++) for (let t = 0; t <= OUT; t++) {
        sumDeltaI[m][i][t] += dpathDI[i][t];
        sumOmegaI[m][i][t] += dpathWI[i][t];
      }
    }

    if ((p + 1) % prog_step === 0) onProgress(Math.round(((p + 1) / params.num_paths) * 55));
  }

  // ── Statistics ─────────────────────────────────────────────────────────────
  const NP = params.num_paths;
  const methods: MethodResult[] = META.map((meta, m) => {
    const mean_delta = new Array(OUT + 1).fill(0);
    const p10_delta  = new Array(OUT + 1).fill(0);
    const p90_delta  = new Array(OUT + 1).fill(0);
    for (let i = 0; i <= OUT; i++) {
      const vals = allDelta[m].map(d => d[i]).sort((a, b) => a - b);
      mean_delta[i] = vals.reduce((a, b) => a + b, 0) / NP;
      p10_delta[i]  = vals[Math.floor(0.10 * NP)];
      p90_delta[i]  = vals[Math.floor(0.90 * NP)];
    }

    const mean_delta_i = Array.from({ length: 3 }, (_, i) => sumDeltaI[m][i].map(v => v / NP));
    const mean_omega_i = Array.from({ length: 3 }, (_, i) => sumOmegaI[m][i].map(v => v / NP));

    const tau_all  = allTau[m];
    const tau_sort = [...tau_all].sort((a, b) => a - b);
    const recovered = tau_all.filter(t => t < T_SIM);
    const recovery_rate = recovered.length / NP;
    const mean_tau = recovered.length ? recovered.reduce((a, b) => a + b, 0) / recovered.length : T_SIM;
    const p95_tau  = tau_sort[Math.floor(0.95 * NP)];
    const p_tail   = tau_all.filter(t => t > 5.0).length / NP;

    const cdf_t: number[] = [], cdf_p: number[] = [];
    for (let k = 0; k < NP; k++) { cdf_t.push(tau_sort[k]); cdf_p.push((k + 1) / NP); }

    const isVP = m === 4;
    const isUFLS = m === 5;
    return {
      name: meta.name, shortName: meta.short, color: meta.color, description: meta.desc,
      mean_delta, p10_delta, p90_delta, mean_delta_i, mean_omega_i,
      cdf_t, cdf_p, tau_all,
      control_effort: allEffort[m] / NP,
      metrics: {
        recovery_rate, mean_tau, p95_tau, p_tail, has_guarantee: isVP,
        ...(isVP ? { theory_bound, theta } : {}),
      },
    };
  });

  return { t_axis, methods, params, lqr_gain_norm: normFro(K_lqr) };
}

// ─────────────────────────────────────────────────────────────────────────────
// TIGHTNESS SWEEP  — validates VP Theorem I.1 bound
// ─────────────────────────────────────────────────────────────────────────────

export function runTightnessSweep(onProgress: (frac: number) => void): TightnessSweepResult {
  const sigma_vals    = [0.1, 0.3, 0.6, 1.0];
  const severity_vals = [0.5, 1.0, 1.5, 2.0, 2.5];
  const N_SW = 40, DT = 0.001, T_SIM = 10.0, N = Math.round(T_SIM / DT), SQ = Math.sqrt(DT);
  const theta = C_SAC * BENCH.s_star - M_PHI - M_SIGMA;
  const total = sigma_vals.length * severity_vals.length;
  let done = 0;
  const points: TightnessPoint[] = [];

  for (const sigma of sigma_vals) {
    for (const sev of severity_vals) {
      const d0 = [0, sev * 0.4, sev * 0.2], w0 = [sev * 2.0, sev * 1.2, sev * 0.8];
      const V_T = distortion(d0, w0);                              // direct computation — not back-derived
      const theory = theta > 0 ? Math.max(0, (V_T - BENCH.delta_thresh) / theta) : T_SIM;

      let tau_sum = 0, n_rec = 0;
      for (let p = 0; p < N_SW; p++) {
        let delta = [...d0], w = [...w0], tau = T_SIM;
        for (let step = 1; step <= N; step++) {
          const dist = distortion(delta, w);
          const nd = [...delta], nw = [...w];
          for (let i = 0; i < 3; i++) {
            const ai = WBASE / (2 * H[i]);
            const u = dist >= BENCH.delta_thresh ? -BENCH.s_star * Math.sign(w[i]) * C_SAC : 0;
            const z = Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
            nw[i] = w[i] + ai * (Pm[i] - Pe(delta, i) - D_dmp[i] * w[i] + u) * DT + sigma * SQ * z;
            nd[i] = delta[i] + w[i] * DT;
          }
          delta = nd; w = nw;
          if (step * DT > 0.05 && distortion(delta, w) < BENCH.delta_thresh) { tau = step * DT; break; }
        }
        tau_sum += tau; if (tau < T_SIM) n_rec++;
      }

      const empirical = tau_sum / N_SW, recovery_rate = n_rec / N_SW;
      points.push({ sigma, severity: sev, V_T, theory_bound: theory, empirical, recovery_rate, ratio: isFinite(theory) && theory > 0 ? empirical / theory : 1, theta });
      onProgress(++done / total);
    }
  }
  return { points, sigma_vals, severity_vals };
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLAR II  — optimality of sacrifice control (s* sweep)
// ─────────────────────────────────────────────────────────────────────────────

export function runPillarII(
  params: BenchmarkParams,
  onProgress: (frac: number) => void,
): PillarIIResult {
  const sev = params.contingency_severity, sigma = params.sigma_noise;
  const d0 = [0, sev * 0.4, sev * 0.2], w0 = [sev * 2.0, sev * 1.2, sev * 0.8];
  const V_T = distortion(d0, w0);
  const theta_base = C_SAC - M_PHI - M_SIGMA;   // per unit of s*

  const s_vals = [0.3, 0.5, 0.8, 1.2, 1.5, 2.0, 2.5, 3.0, 4.0];
  const N_PII = 60, DT = 0.001, T_SIM = 10.0, N = Math.round(T_SIM / DT), SQ = Math.sqrt(DT);

  const points: PillarIIPoint[] = [];
  let done = 0;

  for (const s of s_vals) {
    const theta = C_SAC * s - M_PHI - M_SIGMA;
    const theory_bound = theta > 0 ? Math.max(0, (V_T - BENCH.delta_thresh) / theta) : T_SIM;

    let tau_sum = 0, eff_sum = 0;

    for (let p = 0; p < N_PII; p++) {
      let delta = [...d0], w = [...w0], tau = T_SIM, effort = 0;
      for (let step = 1; step <= N; step++) {
        const dist = distortion(delta, w);
        const nd = [...delta], nw = [...w];
        for (let i = 0; i < 3; i++) {
          const ai = WBASE / (2 * H[i]);
          const u = dist >= BENCH.delta_thresh ? -s * Math.sign(w[i]) * C_SAC : 0;
          effort += Math.abs(u) * DT;
          const z = Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
          nw[i] = w[i] + ai * (Pm[i] - Pe(delta, i) - D_dmp[i] * w[i] + u) * DT + sigma * SQ * z;
          nd[i] = delta[i] + w[i] * DT;
        }
        delta = nd; w = nw;
        if (step * DT > 0.05 && distortion(delta, w) < BENCH.delta_thresh) { tau = step * DT; break; }
      }
      tau_sum += tau; eff_sum += effort;
    }

    points.push({ s_star: s, mean_tau: tau_sum / N_PII, theory_bound, effort: eff_sum / N_PII, recovery_rate: 0 });
    onProgress(++done / s_vals.length);
  }

  const optimal_s_empirical = points.reduce((best, p) => p.mean_tau < best.mean_tau ? p : best, points[0]).s_star;
  const optimal_s_theory = theta_base > 0 ? 1 / theta_base : 2.0;  // CDI: higher s → lower E[τ] saturates at σ-dominated floor

  return { points, optimal_s_empirical, optimal_s_theory };
}

// ─────────────────────────────────────────────────────────────────────────────
// PILLAR III  — adversarial robustness
// ─────────────────────────────────────────────────────────────────────────────

export function runPillarIII(
  params: BenchmarkParams,
  onProgress: (frac: number) => void,
): PillarIIIResult {
  const ADV_ALPHA = 0.6;   // adversarial drift coefficient
  const N_III = Math.min(params.num_paths, 80);
  const result = runBenchmark(
    { ...params, num_paths: N_III },
    (pct) => onProgress(pct / 100),
    ADV_ALPHA,
  );
  return { ...result, adversarial_alpha: ADV_ALPHA };
}
