"use strict";
/* Tunables + material constants. Loaded first; later scripts share these globals. */

// ---------- grid / loop tunables ----------
const W = 100, H = 72;          // grid cells
const SCALE = 8;                // px per cell
const SUBSTEPS = 10;             // physics substeps / frame
const DT = 0.13333;            // sim time per substep (stable: dt < 1/(4*alpha_max))
const TIME_PER_FRAME = SUBSTEPS * DT; // sim-units advanced each frame

// ---------- thermodynamics ----------
const AMBIENT  = 2;             // cold room (C) — ice melts from the heater, not the air
const HEATER_T = 260;           // heater fixed temp (C)
const COOLER_T = -28;           // cooler fixed temp (C)
const MELT_T   = 0;             // ice melting point (C)
const L_CELL   = 220;           // latent heat budget per full ice cell
const CONVECT  = 0.004;         // ambient relaxation coeff for air (convection/radiation approx)

// ---------- materials ----------
const AIR=0, ICE=1, INSUL=2, COOLER=3, HEATER=4;
//                 AIR    ICE   INSUL  COOLER HEATER
const MAT_K = [   0.160, 0.500, 0.004, 0.600, 0.600 ]; // thermal conductivity
const MAT_C = [   0.200, 1.000, 0.500, 1.000, 1.000 ]; // volumetric heat capacity
