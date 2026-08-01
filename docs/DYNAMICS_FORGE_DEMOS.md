# Dynamics Forge Web Demos

The **Research and engineering work** section contains six interactive systems in this order:

- 2-DoF manipulator trajectory tracking
- Copter1 arm-angle control
- Copter2 cascaded yaw-to-roll control
- Drone4 altitude and yaw control
- Drone6 full XYZ and roll/pitch/yaw control
- TaxiDrone full XYZ and roll/pitch/yaw control across 18 rotors

Each demo calculates a new result when a controller value or target changes. After completion, the main action becomes **Replay**. Replay does not repeat the numerical integration and is unlimited. Two new manual recalculations are available per rolling minute; automatic default runs when changing systems do not consume that allowance.

## Visualization

CAD, links, coordinate frames, frame labels, and center-of-mass markers are independent layers. Yellow `COM` markers use the local mass locations from the validated DFM models; massless rotor frames do not receive a marker. The view selector provides full 3D, top, front, and side views. Every new calculation and replay resets the camera, pan, zoom, plot scale, trail, and configured model limits before visualization begins.

Rotor frame transforms remain animated independently of the CAD layer. Hiding CAD on Copter1, Drone4, Drone6, or TaxiDrone therefore leaves the rotating rotor X/Y axes visible while the body and hub frames retain their own motion.

The manipulator and Copter2 frame trees come from their Dynamics Forge `.dfm` files using the modified-DH convention; they are not imported from URDF. Revolute coordinates therefore rotate about each modified-DH frame's local Z axis. Copter2 uses the DFM frame order `[1, 3, 4, 5]` for yaw, roll, left rotor, and right rotor, including the configured offsets and rotor directions.

Copter1 and Copter2 use the original model-default cubic trajectories from their DFM files. Copter1 follows `[0, 0.5, -0.5, -1.57]` radians over 10 seconds. Copter2 follows `[0, π/2, 3π/2, 0, 0]` radians over 14 seconds. Segment durations are equal and endpoint velocities are zero, matching the native sampler. Other browser demos retain editable targets.

## Architecture

- `assets/data/dynamics-forge-demos.json` defines systems, editable gains and targets, integral initial values, bounds, camera views, and CAD references.
- `assets/js/dynamics-forge-worker.js` integrates the selected nonlinear plant and controller equations away from the main UI thread.
- `assets/js/dynamics-forge-demos.js` manages Run/Replay state, rate allowance, controls, STL loading, Canvas rendering, playback, views, and plots.
- `assets/models/dynamics-forge/` contains the selected STL files copied from the main Dynamics Forge project.

The page remains a static GitHub Pages project. It does not need Python, FastAPI, a tunnel, or a running workstation.

## Reliability boundary

This is a selected browser demo subset, not a build of the complete C++ backend. It is appropriate for an interactive portfolio demonstration because the equations execute deterministically in a dedicated browser worker and the UI remains responsive. Copter2 ports the validated DFM modified-DH topology, controller gains, weighted integral terms, roll-reference saturation, rotor mixer, effort/power limits, motor lag, friction, and thrust/drag coefficients. TaxiDrone ports the six-axis DFM pose chain plus all 18 rotor locations and directions, then applies the same compact XYZ and roll/pitch/yaw browser controller used by Drone6. Their browser plants are reduced-order models rather than the complete Featherstone solver. The full Dynamics Forge C++ application remains the authoritative environment for research results, all model families, controller generation, reinforcement learning, and high-fidelity validation.

Do not describe these demos as the complete backend or as WebAssembly. A future C++/WebAssembly build would require separating the pybind11-facing simulator interface from the portable dynamics core and adding Emscripten bindings.

## Edit a demo

Use `assets/data/dynamics-forge-demos.json` for presentation, targets, defaults, and input ranges. Every control entry has:

```json
{
  "key": "yawKp",
  "label": "Yaw Kp",
  "unit": "",
  "default": 0.2,
  "min": 0,
  "max": 1,
  "step": 0.01
}
```

The `key` must match the parameter read by the corresponding simulation function in `assets/js/dynamics-forge-worker.js`.

## Refresh the CAD

After changing the source STL files, run:

```powershell
cd C:\Dev\BedollaDavid.github.io

python tools\sync_dynamics_forge_web_assets.py `
  --source C:\Dev\Web_RL_Win_Lix_Cpp
```

The sync script copies only the four CAD files used by the web demos. The configured list stays intentionally small so the portfolio loads quickly without reducing source-mesh quality.

## Verify changes

Serve the repository through HTTP because Web Workers and STL requests should not be tested with a `file://` URL:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000`, select every system, change at least one gain and target, and confirm:

- the action changes from Replay to Run simulation after editing;
- both manual recalculations complete before the rolling limit appears;
- Replay remains available without consuming a recalculation;
- CAD, frame, COM layers, and all four camera views reset correctly;
- light and dark themes remain readable.
