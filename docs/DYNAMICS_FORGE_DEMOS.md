# Dynamics Forge

The **Research and engineering work** section contains eight interactive systems in this order:

- Two-link arm trajectory tracking
- Copter 1 arm-angle control
- Copter 2 yaw/roll control
- Copter 3 yaw/pitch control with roll stabilization
- Drone 4 altitude and yaw control
- Drone 6 XYZ position and yaw control with internal roll/pitch stabilization
- Drone 8 XYZ position and yaw control with internal roll/pitch stabilization
- TaxiDrone XYZ position and yaw control across 18 rotors with internal roll/pitch stabilization

Each demo calculates a new result when a controller value or target changes. After completion, the main action becomes **Replay**. Replay does not repeat the numerical integration. A second calculation cannot be started or queued while the worker is busy.

The visible parameter names stay compact. Every field has an information icon that identifies the affected control loop and describes its role. Each PID group starts with Kp, Ki, and Kd, followed by the integral initial contribution, an antiwindup limit expressed as a percentage of the loop's maximum command, and its targets or other settings. The default values are starting points rather than optimized gains. **Run simulation** appears above the parameter grid; response metrics and viewer layers appear below the graphs.

Drone6, Drone8, and TaxiDrone show Z position and yaw in the first time-history graph and X/Y position in a second graph. The X and Y responses share one axis with their dashed target traces. Their independent roll and pitch targets are fixed at zero and omitted from the interface; the outer position loop still generates the transient attitude needed for lateral motion.

## Visualization

CAD, links, coordinate frames, frame labels, and center-of-mass markers are independent layers. Yellow `COM` markers use the configured local mass locations; massless rotor frames do not receive a marker. The view selector provides full 3D, top, front, and side views. Every new calculation and replay resets the camera, pan, zoom, plot scale, trail, and configured model limits before visualization begins.

Rotor frame transforms remain animated independently of the CAD layer. Hiding CAD on Copter1, Copter3, Drone4, Drone6, Drone8, or TaxiDrone therefore leaves the rotating rotor X/Y axes visible while the body and hub frames retain their own motion.

Drone6, Drone8, and TaxiDrone display the applied XYZ reference as a red point in the 3D view. The marker follows the parameter set used for the current numerical result rather than unapplied input edits.

The arm, Copter2, and Copter3 frame trees use the modified-DH convention; they are not imported from URDF. Revolute coordinates therefore rotate about each modified-DH frame's local Z axis. Copter2 uses yaw, roll, left-rotor, and right-rotor states; Copter3 adds its pitch joint and associated fixed link.

Copter1 and Copter2 use configured cubic trajectories. Copter1 follows `[0, 0.5, -0.5, -1.57]` radians, while Copter2 follows `[0, π/2, 3π/2, 0, 0]` radians. Copter3 uses its configured quintic yaw and pitch waypoint sequences. Segment durations are equal and endpoint velocities are zero.

## Architecture

- `assets/data/dynamics-forge-demos.json` defines systems, editable gains and targets, integral initial and anti-windup values, bounds, camera views, and CAD references.
- `assets/js/dynamics-forge-level4.js` contains the static-browser articulated plants, model tables, articulated-body forward dynamics, rotor forces, motor pipeline, encoder quantization, and state estimator.
- `assets/js/dynamics-forge-worker.js` integrates the selected nonlinear plant and controller equations away from the main UI thread.
- `assets/js/dynamics-forge-demos.js` manages Run/Replay state, single-run locking, controls, STL loading, Canvas rendering, playback, views, and plots.
- `assets/models/dynamics-forge/` contains the selected STL files copied from the main Dynamics Forge project.

The page remains a static GitHub Pages project. It does not need Python, FastAPI, a tunnel, or a running workstation.

## Reliability boundary

This is a selected static-browser subset, not a build of the complete C++ application. It is appropriate for an interactive portfolio demonstration because the equations execute deterministically in a dedicated browser worker and the UI remains responsive. Copter1, Copter2, Copter3, Drone4, Drone6, Drone8, and TaxiDrone use their configured modified-DH trees, masses, inertias, rotor locations and directions, thrust/drag coefficients, articulated-body forward dynamics, RK4 plant integration, effort and power limits, motor lag, encoder quantization, and state estimation. Rotor commands are mixed directly per configured rotor group without rotor-count normalization. The full Dynamics Forge C++ application remains authoritative for the complete model catalogue, controller generation, learning-based control research, and validation.

Every worker request validates duration and controller inputs before integration. RK4 stages, articulated accelerations, actuator efforts, estimator states, recorded buffers, and metrics are checked for finite values and bounded magnitude. A NaN, Infinity, or numerical blow-up stops the run and returns a visible simulation error; invalid values are never substituted with zeros.

Do not describe these demos as the complete backend or as WebAssembly. The multirotor path is a JavaScript port of the selected native model and simulation behavior required by the portfolio.

## Edit a demo

Use `assets/data/dynamics-forge-demos.json` for presentation, targets, defaults, and input ranges. Every control entry has:

```json
{
  "key": "yawKp",
  "group": "Yaw",
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
- a second calculation cannot start or queue while one is running;
- Drone6, Drone8, and TaxiDrone keep gains first, group all targets last, and show both X/Y responses and targets in the second graph;
- Replay remains available after each completed calculation;
- CAD, frame, COM layers, and all four camera views reset correctly;
- light and dark themes remain readable.
