# Grid Resilience Demo

**Stochastic Reconstruction Engine — Power Grid Cascade Prevention**

An interactive browser simulation benchmarking the Van Passel CDI (Controlled Distortion Injection) framework against standard power systems control methods on the IEEE 9-bus test system.

**Live demo:** https://claude-version-check.replit.app

---

## Scope and honesty statement

Please read this before citing or sharing.

- This is a **conceptual simulation tool**, not a certified engineering product and not peer-reviewed research.
- The Van Passel CDI framework and Theorem I.1 are presented as a theoretical proposal. The simulation is designed to explore the framework's behaviour under the stated model assumptions — it is not empirical validation against real grid infrastructure.
- Physics parameters (machine inertia, damping, mechanical power) follow the Anderson & Fouad IEEE 9-bus benchmark exactly. The SDE formulation and CDI control law are the author's own.
- The 2003 Northeast Blackout reconstruction is a stylised scenario — initial conditions and cascade thresholds are set to approximate the historical event's severity, not reconstructed from NERC fault records.
- Gap 4 (control authority bounding / governor ramp rate caps) is **not yet implemented**. All results are therefore optimistic with respect to physical actuator limits.
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

**2003 Event** — synthetic replay of the August 14 2003 Northeast Blackout. 4 cascade scenarios × 30 stochastic paths. CDI prevents all 4 cascade stages; economic impact modelled via EPRI COLL methodology ($8B baseline).

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
| Gap 4 | ❌ Not implemented | Control authority bounding — governor ramp rate caps (du/dt limit). All current results are optimistic with respect to physical actuator constraints. |
| `isUFLS` flag | ⚠️ Harmless | Declared but unused in `benchmarkEngine.ts`. Safe to clean up. |

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
