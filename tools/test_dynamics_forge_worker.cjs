const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const workerRoot = path.join(projectRoot, "assets", "js");
const catalogue = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets", "data", "dynamics-forge-demos.json"), "utf8"));
const translations = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets", "data", "i18n.json"), "utf8"));
const demoRenderer = fs.readFileSync(path.join(workerRoot, "dynamics-forge-demos.js"), "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const orderedSystems = [...catalogue.systems].sort((a, b) => a.order - b.order);
assert.deepEqual(orderedSystems.map((system) => system.id), ["two_link", "copter1", "copter2", "copter3", "drone4", "drone6", "drone8", "taxi_drone"]);
assert.deepEqual(orderedSystems.map((system) => system.shortTitle), ["Arm", "Copter 1", "Copter 2", "Copter 3", "Drone 4", "Drone 6", "Drone 8", "TaxiDrone"]);
for (const system of orderedSystems) {
  assert.match(system.description, /Modify/i, `${system.id} description must invite gain tuning`);
  assert.doesNotMatch(system.description, /not independently|targets stay at zero|configured directions|instead of being independent/i, `${system.id} description contains conversational implementation metadata`);
}
const plotLabels = new Set();
for (const system of catalogue.systems) {
  assert.equal(typeof system.primaryPlotLabel, "string", `${system.id} needs a primary plot label`);
  assert.ok(system.primaryPlotLabel.trim(), `${system.id} primary plot label cannot be empty`);
  plotLabels.add(system.primaryPlotLabel);
  if (Number.isInteger(system.secondaryPlotStateIndex)) {
    assert.equal(typeof system.secondaryPlotLabel, "string", `${system.id} needs a secondary plot label`);
    assert.ok(system.secondaryPlotLabel.trim(), `${system.id} secondary plot label cannot be empty`);
    plotLabels.add(system.secondaryPlotLabel);
  }
  if (system.positionPlot) {
    assert.equal(system.positionPlot.xStateIndex, 0, `${system.id} X plot must use the X position state`);
    assert.equal(system.positionPlot.yStateIndex, 1, `${system.id} Y plot must use the Y position state`);
    assert.equal(system.positionPlot.xTargetKey, "targetX", `${system.id} X plot must use the X target`);
    assert.equal(system.positionPlot.yTargetKey, "targetY", `${system.id} Y plot must use the Y target`);
    plotLabels.add(system.positionPlot.xLabel);
    plotLabels.add(system.positionPlot.yLabel);
  }
}
plotLabels.add("Dashed = target");
for (const language of ["es", "fr"]) {
  for (const label of plotLabels) assert.ok(translations.translations[language][label], `${language} needs ${label}`);
}
assert.match(demoRenderer, /system\.primaryPlotLabel/);
assert.match(demoRenderer, /system\.secondaryPlotLabel/);
assert.match(demoRenderer, /function renderPositionPlot/);
assert.doesNotMatch(demoRenderer, /tr\("primary"\)/);
assert.doesNotMatch(demoRenderer, /tr\("secondary"\)/);
const messages = [];
const context = {
  console,
  Float32Array,
  Float64Array,
  Math,
  Number,
  Set,
  Array,
  Error,
  self: null,
};
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
vm.runInContext(fs.readFileSync(path.join(workerRoot, "dynamics-forge-worker.js"), "utf8"), context, { filename: "dynamics-forge-worker.js" });

function defaultsFor(systemId) {
  const system = catalogue.systems.find((entry) => entry.id === systemId);
  assert(system, `Missing ${systemId} in the simulator catalogue`);
  return Object.fromEntries(system.controls.map((control) => [control.key, control.default]));
}

function simulate(systemId, overrides = {}, duration = 3) {
  messages.length = 0;
  context.workerListener({
    data: {
      requestId: 1,
      systemId,
      parameters: { ...defaultsFor(systemId), ...overrides },
      duration,
    },
  });
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
  for (let sample = 0; sample < result.time.length; sample += 1) {
    peak = Math.max(peak, Math.abs(result.states[sample * 12 + stateIndex]));
  }
  return peak;
}

for (const systemId of ["drone6", "drone8", "taxi_drone"]) {
  const system = catalogue.systems.find((entry) => entry.id === systemId);
  assert(system.positionPlot, `${systemId} needs the combined X/Y position plot`);
  assert.equal(system.controls.some((control) => control.key === "targetRoll" || control.key === "targetPitch"), false, `${systemId} must not expose roll or pitch targets`);
  const controlKeys = system.controls.map((control) => control.key);
  assert.deepEqual(controlKeys.slice(0, 6), ["positionKp", "positionKi", "positionKd", "attitudeKp", "attitudeKi", "attitudeKd"], `${systemId} gains must appear first`);
  assert.deepEqual(controlKeys.slice(-4), ["targetX", "targetY", "targetZ", "targetYaw"], `${systemId} targets must stay grouped at the end`);
  assert.equal(defaultsFor(systemId).integralMax, 1, `${systemId} needs the editable anti-windup maximum`);
  const result = simulate(systemId, {
    targetX: 0.8,
    targetY: 0.6,
    targetZ: 1,
    targetYaw: 0,
  });
  assert(peakAbsolute(result, 0) > 0.05, `${systemId} did not track the X target`);
  assert(peakAbsolute(result, 1) > 0.05, `${systemId} did not track the Y target`);
  assert(peakAbsolute(result, 6) > 0.01, `${systemId} did not generate roll for Y tracking`);
  assert(peakAbsolute(result, 7) > 0.01, `${systemId} did not generate pitch for X tracking`);
}
assert.deepEqual(
  catalogue.systems.find((system) => system.id === "drone8").controls.map((control) => control.key),
  catalogue.systems.find((system) => system.id === "drone6").controls.map((control) => control.key),
  "Drone8 must expose the same full position/yaw control fields as Drone6",
);

for (const system of catalogue.systems) {
  assert.equal(system.duration, 10, `${system.id} must use the common 10-second simulation window`);
  const result = simulate(system.id, {}, system.duration);
  assert.equal(result.time.length, 601, `${system.id} must return 60 Hz samples for 10 seconds`);
}

for (const systemId of ["copter1", "copter2", "copter3", "drone4", "drone6", "drone8", "taxi_drone"]) {
  const source = fs.readFileSync(path.join(workerRoot, "dynamics-forge-worker.js"), "utf8");
  assert(source.includes(`["copter1", "copter2", "copter3", "drone4", "drone6", "drone8", "taxi_drone"]`), `${systemId} is not dispatched through the articulated-body engine`);
}

const level4Source = fs.readFileSync(path.join(workerRoot, "dynamics-forge-level4.js"), "utf8");
assert.equal(level4Source.includes("allocationScale"), false, "Rotor allocation must not be normalized by rotor count");
assert.equal(level4Source.includes("collectiveScale"), false, "Collective effort must not be normalized by rotor count");
assert.doesNotMatch(level4Source, /this\.parameters\.targetRoll|this\.parameters\.targetPitch/, "Drone6, Drone8, and TaxiDrone must hold the independent roll and pitch targets at zero");
assert.match(level4Source, /this\.integralMax/, "Drone6, Drone8, and TaxiDrone must apply the editable anti-windup maximum");

const drone4Defaults = defaultsFor("drone4");
assert.match(requestError("drone4", { ...drone4Defaults, zKp: Number.NaN }, 10), /finite number/i);
assert.match(requestError("drone4", drone4Defaults, Number.NaN), /finite number/i);
assert.match(requestError("drone4", { ...drone4Defaults, zKp: Number.POSITIVE_INFINITY }, 10), /finite number/i);

const gainKey = (key) => (
  /(^|[A-Z0-9])Kp(?:\d+)?$/i.test(key)
  || /(^|[A-Z0-9])Kd(?:\d+)?$/i.test(key)
  || /(^|[A-Z0-9])Ki(?:\d+)?$/i.test(key)
  || /^k[pid]\d*$/i.test(key)
  || /IntegralGain$/i.test(key)
);
let gainCount = 0;
for (const system of catalogue.systems) {
  for (const control of system.controls) {
    if (gainKey(control.key)) {
      gainCount += 1;
      assert(control.label.length <= 10, `Gain label ${control.label} should remain compact`);
    }
    if (/Target|Initial|Limit|Weight|Amplitude|Minimum|Maximum/i.test(control.label)) {
      assert.equal(gainKey(control.key), false, `Non-gain control ${control.key} would receive an information icon`);
    }
  }
}
assert.equal(gainCount, 46, "Every configured gain must receive loop-specific help");
assert.match(demoRenderer, /function gainLoop/);
assert.match(demoRenderer, /P gain scales the current tracking error/);
assert.match(demoRenderer, /I gain accumulates tracking error/);
assert.match(demoRenderer, /D gain acts on velocity or error rate/);
assert.match(demoRenderer, /function drawTargetPoint/);
assert.match(demoRenderer, /state\.appliedParameters\.targetX/);
for (const language of ["es", "fr"]) {
  for (const text of [
    "Joint 1 position loop",
    "Shared XYZ position loop (collective thrust and attitude-reference generation)",
    "P gain scales the current tracking error. Increasing it strengthens immediate correction; excessive values can excite oscillation.",
    "I gain accumulates tracking error to reject steady-state offset. Excessive values can cause windup and slow oscillation.",
    "D gain acts on velocity or error rate to add damping. Excessive values can amplify encoder and estimator noise.",
  ]) assert.ok(translations.translations[language][text], `${language} needs ${text}`);
}
assert.doesNotMatch(indexSource, /Dynamics Forge Web Demos|inspect CAD geometry|directly in the portfolio|I am open to/i);
assert(indexSource.indexOf('id="forge-run"') < indexSource.indexOf('class="forge-gains-heading"'), "Run simulation must appear above the gain fields");
assert(indexSource.indexOf('class="forge-results"') < indexSource.indexOf('class="forge-layer-controls"'), "Results must appear before viewer layers below the graphs");
assert(indexSource.indexOf('id="forge-position-plot-wrap"') < indexSource.indexOf('class="forge-results"'), "Results must follow the graphs");

console.log("Dynamics Forge worker checks passed.");
