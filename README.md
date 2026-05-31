# Ice Cube Rescue

Browser-based heat-transfer puzzle. Place insulators and coolers to keep an ice cube alive until the timer runs out.

---

## How to Play

1. Study the level — the orange flame is a fixed heater, the blue ice sits in a pocket with one open gap (the "mouth") facing the flame.
2. Drag tools from the right panel onto the grid. Press **R** while dragging to rotate.
3. Click a placed tool to pick it back up (only before Start).
4. Press **▶ Start**. The timer counts down real wall-clock seconds.
5. Survive until zero with enough ice remaining.

---

## Physics: Theory and Implementation

### 1. Heat Conduction — Fourier's Law

Heat flows from hot to cold. The flux through a material is:

```
q = -k ∇T
```

- **q** — heat flux (W m⁻²)
- **k** — thermal conductivity (W m⁻¹ K⁻¹)
- **∇T** — temperature gradient

Combined with conservation of energy (no internal source):

```
ρc ∂T/∂t = ∇·(k ∇T)
```

- **ρ** — density (kg m⁻³)
- **c** — specific heat capacity (J kg⁻¹ K⁻¹)
- **ρc** — volumetric heat capacity (J m⁻³ K⁻¹)

This is the heat equation. It says: the rate at which temperature changes at a point equals how much heat is flowing in minus flowing out.

---

### 2. Numerical Discretization

The simulation runs on a **100 × 72 grid** of square cells. The Laplacian ∇²T is replaced with a four-neighbor finite-difference stencil:

```
∇²T[i,j] ≈ T[i+1,j] + T[i-1,j] + T[i,j+1] + T[i,j-1] − 4·T[i,j]
              ────────────────────────────────────────────────────────
                                      Δx²
```

Temperature is advanced with an **explicit forward-Euler** step:

```
T[i,j]ⁿ⁺¹ = T[i,j]ⁿ  +  (Δt / (ρc Δx²))  ·  Σ  k_face · (T_neighbor − T[i,j])
```

The sum is over the four cardinal neighbors. This is a direct implementation of the heat equation: each cell exchanges heat with its four neighbors, weighted by the face conductivity and the temperature difference.

---

### 3. Harmonic-Mean Interface Conductivity

At the boundary between two cells with conductivities k₁ and k₂, the face conductivity is:

```
k_face = 2 k₁ k₂ / (k₁ + k₂)
```

This is the harmonic mean. It is physically exact for series conduction: two half-cells of thickness Δx/2 each contribute thermal resistance Δx/(2k), so the combined resistance across the shared face is Δx/(2k₁) + Δx/(2k₂), giving an effective conductivity of 2k₁k₂/(k₁+k₂). This correctly handles the sharp contrast between, say, an insulator (k = 0.004) and a heater (k = 0.6) — the bottleneck material dominates.

The code:
```javascript
const hk = (a, b) => 2*a*b / (a + b + 1e-9);
```

The `+1e-9` prevents division by zero between two zero-conductivity cells.

---

### 4. Numerical Stability

Explicit Euler is only stable when the timestep is small enough. The **Von Neumann criterion** for the 2D heat equation requires:

```
Δt  <  Δx² / (2 · d · α_max)       (d = 2 dimensions)
```

where **α = k / (ρc)** is thermal diffusivity. With game units (Δx = 1 cell), the maximum diffusivity across all materials is:

```
α_max = k_max / c_min = 0.6 / 1.0 = 0.6
```

Stability requires **Δt < 0.417**. The simulation uses **DT = 0.1333** — a safety factor of ~3×, well inside the stable region.

Each real physics "frame" (REAL\_STEP = 1/60 s) runs **10 substeps** of DT = 0.1333 each. The substep count and DT are tuned independently of the real timer: they are internal numerical parameters, not physical time units.

---

### 5. Latent Heat and Phase Transition

When ice is at 0 °C, incoming heat does **not** raise its temperature. Instead it breaks hydrogen bonds and converts the crystal lattice into liquid water — the **enthalpy of fusion** (334 kJ/kg for real ice).

The simulation models this with a per-cell latent-heat budget (`L_CELL = 220` game units):

- **While latent > 0**: incoming energy drains the budget; cell temperature is locked at 0 °C.
- **When budget reaches 0**: the cell is fully melted; it converts to air, and any leftover energy heats the new air cell above 0 °C.
- **If heat flows out** (cooler nearby): the budget recharges — the cell refreezes.

This is a numerical implementation of the **Stefan problem**: tracking a moving solid–liquid interface where temperature is fixed at the melting point and the heat-flux imbalance drives the boundary motion.

The fraction of remaining latent heat (`latent[i] / L_CELL`) is also used to render the partial-melt opacity and drive the marching-squares ice outline.

---

### 6. Convection — What the Simulation Does vs. What Is Real

**Real convection** in air is driven by buoyancy. Hot air is less dense than cold air; gravity pulls denser fluid down and pushes lighter fluid up (Archimedes). This sets up convection cells governed by the **Navier–Stokes equations** with the Boussinesq approximation. The dimensionless Rayleigh number determines whether convection occurs:

```
Ra = g β ΔT L³ / (ν α)
```

- **g** = 9.81 m s⁻²
- **β** ≈ 3.4 × 10⁻³ K⁻¹ (thermal expansion of air at 20 °C)
- **ν** ≈ 1.5 × 10⁻⁵ m² s⁻¹ (kinematic viscosity)
- **α** ≈ 2.1 × 10⁻⁵ m² s⁻¹ (thermal diffusivity)

For even a 10 °C temperature difference over a 10 cm gap, Ra ≈ 1.5 × 10⁶ — far above the onset threshold (~10³). Natural convection is overwhelmingly dominant over conduction in air under these conditions.

**What the simulation does instead** is add a linear relaxation term to each air cell:

```javascript
tnew += CONVECT * (AMBIENT - tnew) * DT;   // CONVECT = 0.004
```

This is **Newton's law of cooling**: air cells drift toward the ambient temperature (2 °C) at a constant rate. It lumps convection, radiation, and far-field air exchange into a single empirical coefficient. It does not create any flow, does not move hot air upward, and does not form convection cells. It is the single largest physical simplification in the model.

---

### 7. Boundary Conditions

| Location | Type | How implemented |
|---|---|---|
| Heater cells | Dirichlet — fixed T = 260 °C | Temperature clamped to HEATER\_T every substep |
| Cooler cells | Dirichlet — fixed T = −28 °C | Temperature clamped to COOLER\_T every substep |
| Grid edges | Neumann — zero flux (adiabatic) | No neighbor on that side → no flux term |
| Ice surface | Implicit | Phase-transition logic holds T = 0 °C |

Dirichlet boundaries model a thermostatically controlled source/sink (infinite heat reservoir). The zero-flux grid edge is equivalent to a perfect insulator surrounding the entire field.

---

## Material Properties vs. Real Values

The simulation uses **dimensionless, game-tuned units**. There is no physical cell size (Δx), so temperatures cannot be converted to real-world melting rates or durations. The 55-second timer is real wall-clock time; the physics DT is a purely numerical stability parameter.

| Material | k (game) | k real (W m⁻¹ K⁻¹) | Discrepancy | Reason |
|---|---|---|---|---|
| Air | 0.160 | 0.024 | **6.7× too high** | Partially compensates for missing natural convection |
| Ice | 0.500 | 2.2 | **4.4× too low** | Slows melting to fit gameplay timescales |
| Insulator | 0.004 | ~0.04 (glass wool) | ~10× too low | Exaggerates the insulating effect for clear gameplay |
| Cooler / Heater | 0.600 | 50–400 (metals) | >>100× too low | Prevents instant freeze/melt that would make placement trivial |

Real volumetric heat capacities (ρc): air ≈ 1200 J m⁻³ K⁻¹, ice ≈ 1.9 × 10⁶ J m⁻³ K⁻¹. The game sets air C = 0.2, ice C = 1.0 — ice is only 5× heavier per unit volume instead of ~1600×. This strongly accelerates melting to fit the timer.

---

## Simplifications and Realism Gap

### High impact (would change gameplay significantly if fixed)

| # | Missing physics | Real-world effect |
|---|---|---|
| 1 | **Natural convection in air** | Hot air rises, cold sinks; convection cells transport heat 10–100× faster than conduction alone. The current model replaces this with a scalar relaxation coefficient. |
| 2 | **Meltwater** | Liquid water (k ≈ 0.6 W m⁻¹ K⁻¹) pools at the bottom of the ice block. The simulation converts melted cells to air (k ≈ 0.024 real, 0.16 game), underestimating heat transport through meltwater by 4–25×. |
| 3 | **Thermal radiation** | The Stefan–Boltzmann law gives flux ~ T⁴. At the heater surface (260 °C = 533 K), radiation is significant and strongly directional. The CONVECT term partially accounts for it but is not directionally correct. |
| 4 | **3D geometry** | End-cap and edge heat loss are ignored. Real convection rolls are 3D structures. |

### Lower impact

| # | Missing physics |
|---|---|
| 5 | Non-uniform melting (corners melt first, dendritic edges) — requires sub-cell interface tracking |
| 6 | Density discontinuity at phase boundary: water is 9% less dense than ice, driving convection in the melt |
| 7 | Crystallographic anisotropy: ice k varies with crystal axis orientation |
| 8 | Contact thermal resistance between materials |
| 9 | Humidity and condensation on ice surface |
| 10 | No physical length scale: cell size is arbitrary, so simulation time cannot map to real seconds |

### What is modeled correctly

- Fourier heat conduction with finite differences
- Harmonic-mean interface conductivity (exact for series resistance)
- Latent heat phase transition with temperature lock at 0 °C (Stefan problem)
- Fixed-temperature Dirichlet boundaries for heater and cooler
- Adiabatic grid edges (zero-flux Neumann)
- Numerical stability (DT chosen with 3× safety margin)
- Fixed-timestep physics loop — simulation speed is independent of frame rate and tab visibility

---

## Timer and Background-Tab Behavior

The timer displays **real wall-clock time** (`Date.now()`), not simulation steps. It is unaffected by frame rate, slow hardware, or tab throttling.

Physics runs in a `setInterval` callback (not `requestAnimationFrame`). When the browser tab is hidden, `requestAnimationFrame` pauses entirely, but `setInterval` continues firing — Chrome throttles it to approximately one call per second, which is enough to keep the physics running. On returning to the tab the accumulated real time is used to catch up any remaining steps.

---

## Architecture

```
index.html
├── js/config.js          — physical constants, grid size, material table
├── js/levels.js          — level geometry (heaters, walls, ice block, tools)
├── js/sim.js             — heat equation solver: conduction, latent heat, convection approx
├── js/worker.js          — (reserved for future Web Worker offload)
├── js/render.js          — canvas drawing: heat field, ice overlay, tool outlines
├── js/marching.js        — marching-squares iso-contour for the ice outline
├── js/thermalPalette.js  — blue→cyan→yellow→orange→red temperature color map
├── js/temperatureProbe.js — hover tooltip: cell temperature and material type
└── js/main.js            — UI, drag-drop, level lifecycle, setInterval physics, rAF render
```

**Physics loop** (`setInterval`, 8 ms target interval):
1. Measure real elapsed time since last tick (`performance.now()`).
2. Accumulate into `physicsAccumulator`.
3. Drain accumulator in fixed REAL\_STEP = 1/60 s increments, calling `step()` each time.
4. Each `step()` runs 10 substeps of DT = 0.1333 (the inner stability loop).
5. Check ice-gone condition after each step.

**Render loop** (`requestAnimationFrame`, ~60 fps):
1. Check wall-clock timer for level expiry.
2. Draw heat field, ice overlay, marching-squares outline, tool borders, drag ghost.
3. Update HUD (timer, ice %, progress bar).
