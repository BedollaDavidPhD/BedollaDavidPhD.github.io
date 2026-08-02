const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const workerRoot = path.join(projectRoot, "assets", "js");
const read = (...parts) => fs.readFileSync(path.join(projectRoot, ...parts), "utf8");
const catalogueSource = read("assets", "data", "dynamics-forge-demos.json");
const translationSource = read("assets", "data", "i18n.json");
const catalogue = JSON.parse(catalogueSource);
const translations = JSON.parse(translationSource);
const demoRenderer = read("assets", "js", "dynamics-forge-demos.js");
const workerSource = read("assets", "js", "dynamics-forge-worker.js");
const level4Source = read("assets", "js", "dynamics-forge-level4.js");
const i18nRuntimeSource = read("assets", "js", "i18n.js");
const cssSource = read("assets", "css", "styles.css");
const indexSource = read("index.html");

const orderedSystems = [...catalogue.systems].sort((a, b) => a.order - b.order);
assert.deepEqual(orderedSystems.map((system) => system.id), ["two_link", "copter1", "copter2", "copter3", "drone4", "drone6", "drone8", "taxi_drone"]);
assert.deepEqual(orderedSystems.map((system) => system.shortTitle), ["Arm", "Copter 1", "Copter 2", "Copter 3", "Drone 4", "Drone 6", "Drone 8", "TaxiDrone"]);

const configuredText = new Set();
const addText = (value) => {
  if (typeof value === "string" && value.trim()) configuredText.add(value);
};
const kpKey = (key) => /(^|[A-Z0-9])Kp(?:\d+)?$/i.test(key) || /^kp\d*$/i.test(key);
const kiKey = (key) => /(^|[A-Z0-9])Ki(?:\d+)?$/i.test(key) || /^ki\d*$/i.test(key) || /IntegralGain$/i.test(key);
const kdKey = (key) => /(^|[A-Z0-9])Kd(?:\d+)?$/i.test(key) || /^kd\d*$/i.test(key);

let pidLoopCount = 0;
for (const system of orderedSystems) {
  assert.match(system.description, /Modify/i, `${system.id} description must invite gain tuning`);
  assert.doesNotMatch(system.description, /not independently|targets stay at zero|configured directions|instead of being independent/i, `${system.id} description contains conversational implementation metadata`);
  assert.equal(system.duration, 10, `${system.id} must retain the configured internal simulation horizon`);

  for (const property of ["title", "category", "description", "controller", "primaryPlotLabel", "primaryMetricLabel", "secondaryPlotLabel", "secondaryMetricLabel"]) addText(system[property]);
  if (system.positionPlot) {
    assert.equal(system.positionPlot.xStateIndex, 0, `${system.id} X plot must use the X position state`);
    assert.equal(system.positionPlot.yStateIndex, 1, `${system.id} Y plot must use the Y position state`);
    assert.equal(system.positionPlot.xTargetKey, "targetX", `${system.id} X plot must use the X target`);
    assert.equal(system.positionPlot.yTargetKey, "targetY", `${system.id} Y plot must use the Y target`);
    addText(system.positionPlot.xLabel);
    addText(system.positionPlot.yLabel);
  }

  const groups = new Map();
  for (const control of system.controls) {
    assert.equal(typeof control.group, "string", `${system.id}.${control.key} needs a controller group`);
    assert.ok(control.group.trim(), `${system.id}.${control.key} controller group cannot be empty`);
    assert.equal(typeof control.label, "string", `${system.id}.${control.key} needs a label`);
    assert.ok(control.label.trim(), `${system.id}.${control.key} label cannot be empty`);
    for (const field of ["default", "min", "max", "step"]) assert(Number.isFinite(control[field]), `${system.id}.${control.key}.${field} must be finite`);
    assert(control.min <= control.default && control.default <= control.max, `${system.id}.${control.key} default must stay inside its input range`);
    assert(control.step > 0, `${system.id}.${control.key} step must be positive`);
    addText(control.group);
    addText(control.label);
    if (!groups.has(control.group)) groups.set(control.group, []);
    groups.get(control.group).push(control);
  }

  for (const [groupName, controls] of groups) {
    const hasControllerGain = controls.some((control) => kpKey(control.key));
    if (!hasControllerGain) continue;
    pidLoopCount += 1;
    assert(controls.length >= 5, `${system.id} ${groupName} needs Kp, Ki, Kd, I0, and I max`);
    assert(kpKey(controls[0].key), `${system.id} ${groupName} column 1 must start with Kp`);
    assert(kiKey(controls[1].key), `${system.id} ${groupName} column 2 must start with Ki`);
    assert(kdKey(controls[2].key), `${system.id} ${groupName} column 3 must start with Kd`);
    assert.match(controls[3].key, /IntegralInitialPercent$/i, `${system.id} ${groupName} second row must start with I0`);
    assert.match(controls[4].key, /IntegralMaxPercent$/i, `${system.id} ${groupName} second row needs an antiwindup percentage`);
    assert.equal(controls[3].unit, "%", `${system.id} ${groupName} initial integral must be a percentage`);
    assert.equal(controls[4].unit, "%", `${system.id} ${groupName} antiwindup limit must be a percentage`);
    assert.equal(controls[3].min, -100, `${system.id} ${groupName} initial integral must allow -100 percent`);
    assert.equal(controls[3].max, 100, `${system.id} ${groupName} initial integral must allow +100 percent`);
    assert(controls[4].min >= 0 && controls[4].max <= 100, `${system.id} ${groupName} antiwindup percentage must stay in 0 to 100 percent`);
    for (const gain of controls.slice(0, 3)) assert(gain.label.length <= 12, `Gain label ${gain.label} should remain compact`);
  }
}
assert.equal(pidLoopCount, 16, "All sixteen configured PID loops must expose complete PID and integrator controls");

assert.deepEqual(
  orderedSystems.find((system) => system.id === "two_link").primaryPlotLabel,
  "J1 position",
  "The Arm graph must use the same J1 terminology as its controls",
);
assert.deepEqual(
  orderedSystems.find((system) => system.id === "two_link").secondaryPlotLabel,
  "J2 position",
  "The Arm graph must use the same J2 terminology as its controls",
);
for (const systemId of ["drone4", "drone6", "drone8", "taxi_drone"]) {
  const system = orderedSystems.find((entry) => entry.id === systemId);
  assert.equal(system.primaryPlotLabel, "Z position", `${systemId} graph must use Z position terminology`);
  assert.equal(system.primaryMetricLabel, "Z RMS", `${systemId} metric must use Z terminology`);
}

for (const systemId of ["drone6", "drone8", "taxi_drone"]) {
  const system = catalogue.systems.find((entry) => entry.id === systemId);
  assert(system.positionPlot, `${systemId} needs the combined X/Y position plot`);
  assert.equal(system.controls.some((control) => control.key === "targetRoll" || control.key === "targetPitch"), false, `${systemId} must not expose roll or pitch targets`);
  const keys = new Set(system.controls.map((control) => control.key));
  for (const key of ["positionKp", "positionKi", "positionKd", "positionIntegralInitialPercent", "positionIntegralMaxPercent", "attitudeKp", "attitudeKi", "attitudeKd", "attitudeIntegralInitialPercent", "attitudeIntegralMaxPercent", "targetX", "targetY", "targetZ", "targetYaw"]) {
    assert(keys.has(key), `${systemId} is missing ${key}`);
  }
  assert.equal(system.controls.filter((control) => control.key === "positionIntegralMaxPercent").length, 1, `${systemId} needs one position antiwindup limit`);
  assert.equal(system.controls.filter((control) => control.key === "attitudeIntegralMaxPercent").length, 1, `${systemId} needs one attitude antiwindup limit`);
}
const copter3Keys = new Set(catalogue.systems.find((system) => system.id === "copter3").controls.map((control) => control.key));
for (const axis of ["yaw", "pitch", "roll"]) {
  const ki = axis === "pitch" ? "pitchIntegralGain" : `${axis}Ki`;
  for (const key of [ki, `${axis}IntegralInitialPercent`, `${axis}IntegralMaxPercent`]) assert(copter3Keys.has(key), `Copter3 ${axis} PID is missing ${key}`);
}

const parameterHelpStrings = [
  "P gain acts on the current position or angle error for this controller. Increasing it strengthens immediate correction. Excessive values can cause oscillation.",
  "D gain acts on velocity or error rate to add damping. Excessive values can amplify measurement and estimation noise.",
  "I gain accumulates controller error to remove steady-state offset. Its contribution is bounded by I max to limit windup.",
  "Signed initial integral contribution, expressed from -100% to +100% of the fixed actuator stall input. It is clamped by I max.",
  "Antiwindup clamp for the integral contribution, expressed as a percentage of the fixed actuator stall input before velocity and power constraints.",
  "Weight applied to position error before it enters the integral channel.",
  "Weight applied to velocity error before it enters the integral channel.",
  "Minimum reference allowed for the inner control loop.",
  "Maximum reference allowed for the inner control loop.",
  "Reference value commanded to this control loop.",
  "Amplitude applied to the generated motion reference.",
  "Editable parameter for this control loop.",
];
const statusStrings = [
  "Parameters changed. Run the simulation to apply them.",
  "Replaying the current result. Change a parameter to run a new simulation.",
  "A simulation is already running. Wait for it to finish before starting another.",
  "Running the nonlinear simulation in your browser…",
  "Running…",
  "Pending",
  "Simulation complete. Change a parameter to calculate a new result, or replay the current result.",
  "Simulation error: a non-finite result was rejected for numerical safety.",
  "The browser simulator could not start.",
  "The interactive simulator could not be loaded.",
  "Choose a system to begin",
  "Dashed = target",
];
for (const text of [...parameterHelpStrings, ...statusStrings]) {
  assert(demoRenderer.includes(text) || text === "Dashed = target", `Simulator source is missing active copy: ${text}`);
  configuredText.add(text);
}
for (const language of ["es", "fr"]) {
  for (const text of configuredText) assert.ok(translations.translations[language][text], `${language} needs a translation for: ${text}`);
}

const profileAlignmentStrings = [
  "Robot Manipulation | Whole-Body Control | Real-Time C++/ROS 2 | Physical AI Deployment",
  "I develop and deploy robotics software that converts task-level commands, robot models, and sensor information into reliable motion on physical robots. My work spans whole-body mobile manipulation, Cartesian control, redundancy resolution, teleoperation, learning-based control, and real-time hardware integration.",
  "Connecting learned robot behavior with reliable physical execution.",
  "At Lab INIT Robots, I develop a real-time ROS 2 and C++ whole-body control system for a 10-DoF mobile manipulator with a Kinova Gen3 arm. The 400 Hz pipeline coordinates Cartesian motion, arm and base control, redundancy resolution, trajectory execution, teleoperation, joint-limit handling, and safety-oriented pose and velocity commands on physical hardware.",
  "My current direction is the interface between learned robot behaviors and dependable physical execution. Experience with game-controller teleoperation, wearable IMUs, EMG, and depth-camera motion acquisition can support future demonstration collection, while the model-based control layer can execute perception-conditioned pose or velocity commands with kinematic constraints, smoothing, redundancy management, and safety checks. I am applying this foundation toward future imitation learning and Diffusion Policy systems for dexterous manipulation.",
  "Deployed a 400 Hz whole-body control pipeline for a 10-DoF Kinova Gen3 and AgileX mobile manipulator. The analytical redundancy method generates position-level configurations, while a Pinocchio Jacobian solver generates joint velocities for end-effector tracking, elbow control, joint-limit handling, and base coordination. Improved Cartesian tracking with super-twisting feedback, and implemented command validation, filtering, safe state transitions, and game-controller teleoperation for future demonstration collection.",
  "Reduced lower-limb control latency by 30× to enable torque control, improved ROS/Python real-time scheduling for an autonomous vehicle to reduce steering oscillations, and developed symbolic dynamics and inverse-kinematics GUI tools. Delivered 6-DoF inverse kinematics and real-time motion-control support to international assistive-robotics collaborations.",
  "Developed and tested an optimization strategy for a 7-DoF robot that reduced tracking error by 20%, and supported the design of a three-finger adaptive robotic gripper for activities of daily living.",
  "Deployed a 1-4 kHz hard real-time motion-control stack for a 7-DoF exoskeleton. Implemented a Gaussian Process residual model inside a robust model predictive controller at approximately 387 μs per iteration and learning-based inverse kinematics at 43 μs. Built physics-based digital twins and a controller emulator for sim-to-real validation, and integrated EMG, IMU, and depth-camera sensing for human-motion acquisition and sensor-guided trajectory generation.",
  "ROS 2, Pinocchio, URDF, Ruckig, robot manipulation, whole-body control, Cartesian control, teleoperation",
  "Kinematics, dynamics, numerical optimization, redundancy resolution, RNEA, MPC, super-twisting control, Gaussian Processes",
  "Professional work in robotics software engineering and applied R&D, focused on robot manipulation, whole-body control, model-based execution, teleoperation, hardware integration, and the interface between learned behavior and reliable physical systems.",
];
for (const text of profileAlignmentStrings) {
  const htmlText = text.replaceAll("&", "&amp;");
  assert(indexSource.includes(text) || indexSource.includes(htmlText), `Website is missing LinkedIn-aligned copy: ${text}`);
  for (const language of ["es", "fr"]) assert.ok(translations.translations[language][text], `${language} needs a translation for LinkedIn-aligned copy: ${text}`);
}
assert.doesNotMatch(indexSource, /href=["']tel:|class=["'][^"']*street/i, "Private address or phone fields must not appear on the public website");
assert.match(indexSource, /March 2026-Present/);
assert.match(indexSource, /March 2025-March 2026/);
assert.match(indexSource, /March 2024-March 2025/);
assert.match(indexSource, /January 2020-December 2023/);

assert.match(cssSource, /\.forge-control-group-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s, "Controller groups must use a three-column grid");
assert.match(demoRenderer, /function parameterHelp/);
assert.match(demoRenderer, /const help = parameterHelp\(control\)/);
assert.doesNotMatch(demoRenderer, /if\s*\(help\)/, "Every control parameter must receive an information icon");
assert.match(demoRenderer, /for \(const tab of ui\.tabs\.querySelectorAll\("button"\)\) tab\.disabled = disabled/, "System tabs must be disabled during a run");
assert.doesNotMatch(demoRenderer, /manualRunAllowed|manualRunTimestamps|rateLimitTimer|countAgainstLimit|Two new simulations|rolling minute|next recalculation/i, "The old run-rate limiter must be removed");
const runStart = demoRenderer.indexOf("function runSimulation()");
const runningGuard = demoRenderer.indexOf("if (state.running)", runStart);
const postMessage = demoRenderer.indexOf("state.worker.postMessage", runStart);
assert(runStart >= 0 && runningGuard > runStart && postMessage > runningGuard, "runSimulation must reject a second request before posting to the worker");
assert.match(demoRenderer, /if \(!system \|\| state\.running\) return;/, "System changes must be rejected while a simulation is running");
assert.equal((demoRenderer.match(/state\.worker\.postMessage/g) || []).length, 1, "The UI must have one non-queued simulation dispatch path");

const publicCopy = {
  "index.html": indexSource,
  "assets/data/dynamics-forge-demos.json": catalogueSource,
  "assets/data/i18n.json": translationSource,
  "assets/js/dynamics-forge-demos.js": demoRenderer,
  "assets/js/i18n.js": i18nRuntimeSource,
  "README.md": read("README.md"),
  "docs/DYNAMICS_FORGE_DEMOS.md": read("docs", "DYNAMICS_FORGE_DEMOS.md"),
  "CHANGELOG.md": read("CHANGELOG.md"),
};
const removedAlgorithmName = ["Feather", "stone"].join("");
for (const [filename, source] of Object.entries(publicCopy)) {
  assert.equal(new RegExp(removedAlgorithmName, "i").test(source), false, `${filename} contains the removed public algorithm name`);
  assert.doesNotMatch(source, /\b10\s*(?:s|seconds?)\b|\b10[- ]second/i, `${filename} contains explicit user-facing 10-second wording`);
  assert.doesNotMatch(source, /Two new simulations|per (?:rolling )?minute|next recalculation/i, `${filename} contains stale rate-limit wording`);
  assert.doesNotMatch(source, /—/, `${filename} contains an em dash`);
}

assert.match(demoRenderer, /system\.primaryPlotLabel/);
assert.match(demoRenderer, /system\.secondaryPlotLabel/);
assert.match(demoRenderer, /function renderPositionPlot/);
assert.match(demoRenderer, /function drawTargetPoint/);
assert.match(demoRenderer, /state\.appliedParameters\.targetX/);
assert.doesNotMatch(demoRenderer, /tr\("primary"\)|tr\("secondary"\)/);
assert.equal(level4Source.includes("allocationScale"), false, "Rotor allocation must not be normalized by rotor count");
assert.equal(level4Source.includes("collectiveScale"), false, "Collective effort must not be normalized by rotor count");
assert.doesNotMatch(level4Source, /this\.parameters\.targetRoll|this\.parameters\.targetPitch/, "Full multirotors must hold roll and pitch targets at zero");
assert.match(workerSource, /integralLimitFromPercent\(parameters\.j1IntegralMaxPercent, stallTorque\)/, "Arm antiwindup percentages must use stall torque");
assert.match(workerSource, /initialIntegralFromPercent\(parameters\.j1IntegralInitialPercent, stallTorque, j1IntegralLimit\)/, "Arm initial integral percentages must use stall torque and the antiwindup clamp");
assert.match(level4Source, /integralLimitFromPercent\(parameters\.zIntegralMaxPercent, ROTOR_EFFORT_LIMIT\)/, "Direct rotor-loop percentages must use the fixed rotor stall input");
assert.match(level4Source, /integralLimitFromPercent\(parameters\.yawIntegralMaxPercent, ROTOR_EFFORT_LIMIT\)/, "Copter 2 outer-loop antiwindup must use the fixed rotor stall input");
assert.doesNotMatch(level4Source, /maximumRollReference/, "Integral scaling must not depend on a constrained intermediate reference");
assert.match(level4Source, /initialIntegralFromPercent\(parameters\.positionIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this\.positionIntegralMax\)/, "Position initial integral percentages must use stall input and the antiwindup clamp");
assert.match(level4Source, /const activeLimit = Math\.min\(actuator\.maxEffort, powerLimit\)/, "Velocity and power constraints must remain separate from the fixed stall-input reference");
assert.match(level4Source, /positionIntegralMaxPercent/);
assert.match(level4Source, /attitudeIntegralMaxPercent/);

const messages = [];
const context = { console, Float32Array, Float64Array, Math, Number, Set, Array, Error, self: null };
context.self = context;
context.importScripts = (source) => {
  const filename = source.split("?")[0];
  vm.runInContext(fs.readFileSync(path.join(workerRoot, filename), "utf8"), context, { filename });
};
context.addEventListener = (type, listener) => {
  if (type === "message") context.workerListener = listener;
};
context.postMessage = (message) => messages.push(message);
vm.createContext(context);
vm.runInContext(workerSource, context, { filename: "dynamics-forge-worker.js" });

function defaultsFor(systemId) {
  const system = catalogue.systems.find((entry) => entry.id === systemId);
  assert(system, `Missing ${systemId} in the simulator catalogue`);
  return Object.fromEntries(system.controls.map((control) => [control.key, control.default]));
}

function simulate(systemId, overrides = {}, duration = 3) {
  messages.length = 0;
  context.workerListener({ data: { requestId: 1, systemId, parameters: { ...defaultsFor(systemId), ...overrides }, duration } });
  const result = messages[0];
  assert(result, `${systemId} returned no worker result`);
  assert.equal(result.error, undefined, `${systemId}: ${result.error}`);
  assert(result.states.length > 0, `${systemId} returned no states`);
  for (const value of result.states) assert(Number.isFinite(value), `${systemId} returned a non-finite state`);
  for (const value of result.reference) assert(Number.isFinite(value), `${systemId} returned a non-finite reference`);
  for (const value of result.effort) assert(Number.isFinite(value), `${systemId} returned a non-finite effort`);
  assert(Number.isFinite(result.metrics.rmsError), `${systemId} returned a non-finite RMS metric`);
  assert(Number.isFinite(result.metrics.peakEffort), `${systemId} returned a non-finite peak-effort metric`);
  return result;
}

function requestError(systemId, parameters, duration) {
  messages.length = 0;
  context.workerListener({ data: { requestId: 99, systemId, parameters, duration } });
  const result = messages[0];
  assert(result?.error, `${systemId} should have rejected the invalid request`);
  return result.error;
}

function peakAbsolute(result, stateIndex) {
  let peak = 0;
  for (let sample = 0; sample < result.time.length; sample += 1) peak = Math.max(peak, Math.abs(result.states[sample * 12 + stateIndex]));
  return peak;
}

for (const system of catalogue.systems) {
  const result = simulate(system.id, {}, system.duration);
  assert.equal(result.time.length, 601, `${system.id} must return 60 Hz samples for its internal horizon`);
  if (system.id !== "two_link") {
    assert(result.metrics.peakEffort <= 1.500001, `${system.id} peak effort must measure the actuator control signal, not total thrust`);
    assert.equal(result.metrics.effortUnit, "N·m", `${system.id} peak effort must use the actuator-effort unit`);
  }
}
for (const systemId of ["drone6", "drone8", "taxi_drone"]) {
  const result = simulate(systemId, { targetX: 0.8, targetY: 0.6, targetZ: 1, targetYaw: 0 });
  assert(peakAbsolute(result, 0) > 0.05, `${systemId} did not track the X target`);
  assert(peakAbsolute(result, 1) > 0.05, `${systemId} did not track the Y target`);
  assert(peakAbsolute(result, 6) > 0.01, `${systemId} did not generate roll for Y tracking`);
  assert(peakAbsolute(result, 7) > 0.01, `${systemId} did not generate pitch for X tracking`);
}
const clampedIntegralResult = simulate("drone4", { zIntegralInitialPercent: 100, zIntegralMaxPercent: 10 }, 1);
for (let sample = 0; sample < clampedIntegralResult.time.length; sample += 1) {
  const zIntegral = clampedIntegralResult.states[sample * 6 + 2];
  assert(Math.abs(zIntegral) <= 0.150001, "Drone 4 I0 must be converted from stall-input percent and clamped by I max");
}
const drone4Defaults = defaultsFor("drone4");
assert.match(requestError("drone4", { ...drone4Defaults, zKp: Number.NaN }, 10), /finite number/i);
assert.match(requestError("drone4", drone4Defaults, Number.NaN), /finite number/i);
assert.match(requestError("drone4", { ...drone4Defaults, zKp: Number.POSITIVE_INFINITY }, 10), /finite number/i);

assert.doesNotMatch(indexSource, /Dynamics Forge Web Demos|inspect CAD geometry|directly in the portfolio|I am open to/i);
assert.match(indexSource, /<html[^>]*translate="no"[^>]*class="notranslate"/i, "The curated portfolio must opt out of browser machine translation");
assert.match(indexSource, /<meta name="google" content="notranslate">/i, "Google translation must defer to the curated language selector");
assert.match(indexSource, /class="hero-name notranslate" translate="no">David Bedolla, <span>PhD<\/span>/, "The visible name and PhD credential must be protected from automatic translation");
assert(indexSource.indexOf('id="forge-run"') < indexSource.indexOf('class="forge-gains-heading"'), "Run simulation must appear above the parameter fields");
assert(indexSource.indexOf('class="forge-results"') < indexSource.indexOf('class="forge-layer-controls"'), "Results must appear before viewer layers below the graphs");
assert(indexSource.indexOf('id="forge-position-plot-wrap"') < indexSource.indexOf('class="forge-results"'), "Results must follow the graphs");

console.log("Dynamics Forge worker checks passed.");
