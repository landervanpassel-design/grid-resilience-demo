# CDI Grid Resilience Demo — Certified Cascade Prevention on the IEEE 9-bus System

**An interactive benchmark of Controlled Distortion Injection (CDI) — a control law with an
a-priori certified recovery-time bound — against standard power-system controls (PSS, LQR,
adaptive LQR, UFLS) on the Anderson & Fouad IEEE 9-bus test system.**

**Live demo:** https://claude-version-check.replit.app

CDI is the flagship practical demonstration of the
[Reconstruction Theorem](https://github.com/landervanpassel-design/reconstruction-theorem)
(DOI [10.5281/zenodo.21017251](https://doi.org/10.5281/zenodo.21017251)): a framework for systems
that must protect core invariants while recovering from high-distortion regimes. The rotor-angle
Distortion Field Δ is the theorem's primitive; the CDI sacrifice control carries a certified
expected recovery bound E[τ] ≤ (V_T − δ)/θ (Theorem I.1) computed *before* the run. CDI's
differentiator in the benchmark is this a-priori certificate — PSS and UFLS are empirically fast
at their defaults, but carry no such bound. Framework overview:
[desire-gravity-lineage](https://github.com/landervanpassel-design/desire-gravity-lineage).

---

## Scope and honesty statement

Please read this before citing or sharing.

- This is a **conceptual simulation tool**, not a certified engineering product and not peer-reviewed research.
- The Van Passel CDI framework and Theorem I.1 are presented as a theoretical proposal. The simulation is designed to explore the framework's behaviour under the stated model assumptions — it is not empirical validation against real grid infrastructure.
- Physics parameters (machine inertia, damping, mechanical power) follow the Anderson & Fouad IEEE 9-bus benchmark exactly. The SDE formulation and CDI control law are the author's own.
- The 2003 Northeast Blackout reconstruction is a stylised scenario — initial conditions and cascade thresholds are set to approximate the historical event's severity, not reconstructed from NERC fault records.
- Control authority is bounded (Gap 4, implemented): every method's actuation is saturated at |u| ≤ 20 pu and slew-rate limited at |du/dt| ≤ 10 pu/s (fast exciter/FACTS-class). Governor-class ramp rates are far slower, so results remain optimistic for governor-only plants — but no method slews instantaneously.
- All conclusions are conditional on the stated model assumptions.

---

## What's in the demo

### Three tabs

**Simulation** — single-method interactive demo. Run one control strategy at a time, watch rotor angles and angular velocity evolve in real time. Four modes:
- Baseline (no control)
- Driven (CDI active)
- Optimal (CDI at certified s*)
- Adversarial (worst-case platform pull)

**Benchmark** — head-to-head comparison of 6 control methods on shared stochastic noise paths:

| # | Method | Description |
|---|--------|-------------|
| 0 | Baseline | No control |
| 1 | PSS | u = −8·ω (IEEE 421.5) |
| 2 | LQR | DARE at zero reference, Q=diag([1³,20³]), R=0.08·I₃ |
| 3 | Adaptive LQR | Re-linearises every 50 ms (approximates NMPC) |
| 4 | Van Passel CDI | Sacrifice s*=2; certified E[τ] ≤ (V_T−δ)/θ (Theorem I.1) |
| 5 | UFLS | Distortion-triggered staged damping at Δ thresholds {0.15, 0.35, 0.60} |

Benchmark runs in four phases (0→100% progress):
- **0–55%** Head-to-head (6 methods × N paths, identical Wiener increments)
- **55–70%** Tightness sweep (Theorem I.1 bound vs. empirical E[τ])
- **70–85%** Pillar II s* sweep (optimal sacrifice cost)
- **85–100%** Pillar III adversarial (worst-case platform pull)

**2003 Event** — synthetic replay of the August 14 2003 Northeast Blackout. 4 cascade scenarios × 30 seeded stochastic paths (exactly reproducible via `scripts/run_event2003_headless.ts`). Per-path results **under actuator limits (Gap 4)**: the historical (no-control) scenario cascades on 30/30 paths with no recovery; CDI alone recovers on 30/30 paths (mean τ 0.265 s) though cascade stages still fire on 10–19 of 30 paths; UFLS alone and CDI+UFLS each block all 4 cascade stages on 30/30 paths and recover on 30/30 (mean τ 0.251 / 0.253 s). CDI's differentiator is the a-priori certificate, not stage suppression. Economic impact modelled via EPRI COLL methodology ($8B baseline).

**Headline benchmark numbers under actuator limits** (severity 1.5, σ 0.5, 200 paths; unseeded Monte Carlo, ≲2% run-to-run drift — reproduce via `scripts/run_benchmark_headless.ts`): all five controlled methods recover 100% of paths; mean τ — CDI 0.36 s (certified bound E[τ] ≤ 3.53 s, comfortably satisfied), PSS 0.67 s, UFLS 0.70 s, ALQR 3.64 s, LQR 3.93 s. Under slew limits CDI's low-amplitude bang-bang (±2 pu) is penalized less than high-gain droop laws, making it both the fastest at these parameters *and* the only certified method — at other parameter settings PSS/UFLS can be faster; the certificate remains CDI's differentiator.

---

## Physics parameters

| Parameter | Value | Source |
|-----------|-------|--------|
| H (inertia) | [23.64, 6.40, 3.01] s | Anderson & Fouad, exact |
| Pm (mechanical power) | [0.716, 1.630, 0.850] pu | Anderson & Fouad |
| K_C (CDI gain) | 0.3 pu | Author |
| β (distortion decay) | 0.05 | Author |
| D_dmp (damping) | [0.10, 0.10, 0.10] | Author |
| δ (distortion threshold) | 0.5 | Author |
| OMEGA_CLIP | 18 rad/s | Numerical stability cap |

**Note:** With D=0.10 and no control, machine 2 (Pm=1.63) accelerates indefinitely — angles drift continuously. This is intentional: the Distortion Field is designed for systems where coherence, once lost, requires active sacrifice control to restore. Baseline diverges to the display cap (DISPLAY_MAX=1.5) within ~0.5 sim-seconds.

---

## Known gaps

| Gap | Status | Description |
|-----|--------|-------------|
| Gap 4 | ✅ Implemented | Control authority bounding: uniform saturation \|u\| ≤ 20 pu and slew-rate limit \|du/dt\| ≤ 10 pu/s applied to **all** methods in the benchmark, event-replay, and interactive engines. Headline numbers below were re-derived headlessly after this change. Remaining caveat: 10 pu/s models fast exciter/FACTS-class actuation; governor-class rates are slower. |

---

## Tech stack

- **React + TypeScript + Vite**
- **Recharts** — all simulation charts
- **Web Workers** — simulation and benchmark engines run off the main thread
- **shadcn/ui** — component library
- **Tailwind CSS** — styling

---

## Running locally

```bash
npm install
npm run dev
```

Requires Node.js ≥ 18.

---

## Reproducing the benchmark table (headless)

The technical brief reports the six-method table at default settings
(severity 1.5 pu, sigma = 0.5, 200 paths). To reproduce without a browser:

```bash
npx tsx scripts/run_benchmark_headless.ts
```

Same engine and settings as the Benchmark tab. Values are 200-path
Monte Carlo estimates — expect run-to-run variation of roughly 1–2%.

The 2003 replay uses seeded noise (xorshift), so its per-path stage
statistics are exactly reproducible:

```bash
npx tsx scripts/run_event2003_headless.ts
```

---

## Author

Lander Van Passel — ORCID [0009-0000-1331-3127](https://orcid.org/0009-0000-1331-3127)

The theoretical framework (Theorem I.1, Distortion Field) is developed in:

- *Reconstruction after Extreme Distortion: The Distortion Field as a Primitive and Three Pillars of Driven Return* — [doi.org/10.5281/zenodo.21017251](https://doi.org/10.5281/zenodo.21017251)

The companion multi-agent simulation framework (PDE):

- [github.com/landervanpassel-design/protected-desire-equilibrium](https://github.com/landervanpassel-design/protected-desire-equilibrium)

---

## License

MIT
