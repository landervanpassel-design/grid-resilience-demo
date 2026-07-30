// Constants for IEEE 9-Bus
const wbase = 2 * Math.PI * 60; // rad/s
const H = [23.64, 6.40, 3.01];
const D = [0.1, 0.1, 0.1];
const Pm = [0.716, 1.630, 0.850];
const k_coupling = 0.3;
const beta = 0.05;

export const M_Phi = 0.15;
export const M_sigma = 0.05;
export const M_Phi_rob = 0.3;
export const c_sac = 1.0;

export type SimMode = 'baseline' | 'driven' | 'optimal' | 'adversarial';

export interface SimParams {
  contingency_severity: number;
  s_star: number;
  sigma_noise: number;
  delta_thresh: number;
  alpha_adv: number;
  num_paths: number;
  mode: SimMode;
}

export interface SimResult {
  paths: { t: number[]; delta: number[] }[];
  recovery_times: number[];
  mean_delta: number[];
  p10_delta: number[];
  p90_delta: number[];
  metrics: {
    mean_tau: number;
    recovery_rate: number;
    theta: number;
    theory_bound: number;
    V_T: number;
    s_opt: number;
    theta_rob: number;
  };
  phase_paths: { w1: number[], w2: number[] }[];
}

export function computeDistortion(delta: number[], w: number[]): number {
  let kin = 0;
  for (let i = 0; i < 3; i++) kin += w[i] * w[i];
  
  let pot = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      let diff = delta[i] - delta[j];
      pot += diff * diff;
    }
  }
  return 0.5 * kin + (beta / 2) * pot;
}

export function generateSDEPaths(params: SimParams, onProgress: (p: number) => void): SimResult {
  const dt = 0.001;
  const T_sim = 10.0;
  const N_steps = Math.floor(T_sim / dt);
  const sqrt_dt = Math.sqrt(dt);

  let s_eff = params.s_star;
  if (params.mode === 'baseline') s_eff = 0;
  
  // Optimal mode calculation (Riccati-based target)
  const theta_target = 0.2; // illustrative target for E[tau] cost minimization
  const s_opt = (M_Phi + M_sigma + theta_target) / c_sac;
  if (params.mode === 'optimal') s_eff = s_opt;

  const theta = c_sac * s_eff - M_Phi - M_sigma;
  const theta_rob = Math.max(0, theta - params.alpha_adv * M_Phi_rob);

  // Determine actual bounds used based on mode
  const effective_theta = params.mode === 'adversarial' ? theta_rob : theta;

  const all_recovery_times: number[] = [];
  const all_deltas: Float64Array[] = [];
  const sample_phase_paths: { w1: number[], w2: number[] }[] = [];

  const out_steps = 200;
  const out_interval = Math.floor(N_steps / out_steps);

  for (let p = 0; p < params.num_paths; p++) {
    // Initial conditions
    const sev = params.contingency_severity;
    const w = [sev * 2.0, sev * 1.2, sev * 0.8];
    const delta = [0, sev * 0.4, sev * 0.2];

    const deltas_path = new Float64Array(out_steps + 1);
    let recovered_time = T_sim;
    let has_recovered = false;

    const w1_path: number[] = [];
    const w2_path: number[] = [];

    // Initial distortion
    deltas_path[0] = computeDistortion(delta, w);
    if (p < 5) {
      w1_path.push(w[0]);
      w2_path.push(w[1]);
    }

    const uPrev = [0, 0, 0];   // Gap 4: per-machine actuator state for slew limiting
    const U_RAMP = 10.0;       // pu/s — matches benchmarkEngine

    for (let step = 1; step <= N_steps; step++) {
      const ddelta = [0, 0, 0];
      const dw = [0, 0, 0];
      const cur_delta_val = computeDistortion(delta, w);

      for (let i = 0; i < 3; i++) {
        // Electrical power
        let Pe = 0;
        for (let j = 0; j < 3; j++) {
          if (i !== j) {
            Pe += k_coupling * Math.sin(delta[i] - delta[j]);
          }
        }

        // Sacrifice control
        let u_sac = 0;
        if (cur_delta_val >= params.delta_thresh && s_eff > 0) {
          u_sac = -s_eff * Math.sign(w[i]) * c_sac;
        }
        // Gap 4: slew-rate limit on the actuated control (not on the adversarial disturbance)
        {
          const maxStep = U_RAMP * dt;
          u_sac = uPrev[i] + Math.max(-maxStep, Math.min(maxStep, u_sac - uPrev[i]));
          uPrev[i] = u_sac;
        }

        // Adversarial drift
        let u_adv = 0;
        if (params.mode === 'adversarial' && params.alpha_adv > 0) {
          u_adv = params.alpha_adv * w[i] * Math.abs(w[i]) * Math.sign(cur_delta_val - params.delta_thresh);
        }

        // Noise
        // Box-Muller transform for N(0,1)
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2.0 * Math.log(u1 + 1e-12)) * Math.cos(2.0 * Math.PI * u2);
        
        const noise = params.sigma_noise * sqrt_dt * z0;

        ddelta[i] = w[i] * dt;
        dw[i] = (wbase / (2 * H[i])) * (Pm[i] - Pe - D[i] * w[i] + u_sac + u_adv) * dt + noise;
      }

      for (let i = 0; i < 3; i++) {
        delta[i] += ddelta[i];
        w[i] += dw[i];
      }

      if (step % out_interval === 0) {
        const out_idx = step / out_interval;
        const dist = computeDistortion(delta, w);
        deltas_path[out_idx] = dist;

        if (p < 5) {
          w1_path.push(w[0]);
          w2_path.push(w[1]);
        }
      }

      const t = step * dt;
      if (!has_recovered && t > 0.1) {
        const dist = computeDistortion(delta, w);
        if (dist < params.delta_thresh) {
          recovered_time = t;
          has_recovered = true;
        }
      }
    }

    all_deltas.push(deltas_path);
    all_recovery_times.push(recovered_time);
    if (p < 5) {
      sample_phase_paths.push({ w1: w1_path, w2: w2_path });
    }

    if ((p + 1) % Math.max(1, Math.floor(params.num_paths / 10)) === 0) {
      onProgress(Math.floor(((p + 1) / params.num_paths) * 100));
    }
  }

  // Compute statistics
  const mean_delta: number[] = new Array(out_steps + 1).fill(0);
  const p10_delta: number[] = new Array(out_steps + 1).fill(0);
  const p90_delta: number[] = new Array(out_steps + 1).fill(0);

  for (let i = 0; i <= out_steps; i++) {
    const vals = all_deltas.map(d => d[i]).sort((a, b) => a - b);
    mean_delta[i] = vals.reduce((a, b) => a + b, 0) / vals.length;
    p10_delta[i] = vals[Math.floor(0.1 * vals.length)];
    p90_delta[i] = vals[Math.floor(0.9 * vals.length)];
  }

  const rec_times = all_recovery_times.filter(t => t < T_sim);
  const mean_tau = rec_times.length > 0 ? rec_times.reduce((a, b) => a + b, 0) / rec_times.length : T_sim;
  const recovery_rate = rec_times.length / params.num_paths;

  // Compute Initial V_T for theory
  const w_init = [params.contingency_severity * 2.0, params.contingency_severity * 1.2, params.contingency_severity * 0.8];
  const delta_init = [0, params.contingency_severity * 0.4, params.contingency_severity * 0.2];
  const V_T = computeDistortion(delta_init, w_init);

  const theory_bound = effective_theta > 0 ? Math.max(0, (V_T - params.delta_thresh) / effective_theta) : NaN;

  const paths = all_deltas.map((d, idx) => {
    return {
      t: Array.from({ length: out_steps + 1 }, (_, i) => i * (T_sim / out_steps)),
      delta: Array.from(d)
    };
  });

  return {
    paths: paths.slice(0, 15), // only return 15 paths for plotting
    recovery_times: all_recovery_times,
    mean_delta,
    p10_delta,
    p90_delta,
    phase_paths: sample_phase_paths,
    metrics: {
      mean_tau,
      recovery_rate,
      theta,
      theory_bound,
      V_T,
      s_opt,
      theta_rob
    }
  };
}
