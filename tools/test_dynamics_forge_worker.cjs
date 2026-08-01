const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const projectRoot = path.resolve(__dirname, "..");
const workerRoot = path.join(projectRoot, "assets", "js");
const catalogue = JSON.parse(fs.readFileSync(path.join(projectRoot, "assets", "data", "dynamics-forge-demos.json"), "utf8"));
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
  return result;
}

function peakAbsolute(result, stateIndex) {
  let peak = 0;
  for (let sample = 0; sample < result.time.length; sample += 1) {
    peak = Math.max(peak, Math.abs(result.states[sample * 12 + stateIndex]));
  }
  return peak;
}

for (const systemId of ["drone6", "taxi_drone"]) {
  const result = simulate(systemId, {
    targetX: 0,
    targetY: 0,
    targetZ: 1,
    targetRoll: 8,
    targetPitch: 8,
    targetYaw: 0,
  });
  assert(peakAbsolute(result, 0) > 0.05, `${systemId} pitch did not produce X motion`);
  assert(peakAbsolute(result, 1) > 0.05, `${systemId} roll did not produce Y motion`);
  assert(peakAbsolute(result, 6) > 0.02, `${systemId} did not track roll`);
  assert(peakAbsolute(result, 7) > 0.02, `${systemId} did not track pitch`);
}

const gainKey = (key) => (
  /(^|[A-Z0-9])Kp(?:\d+)?$/i.test(key)
  || /(^|[A-Z0-9])Kd(?:\d+)?$/i.test(key)
  || /(^|[A-Z0-9])Ki(?:\d+)?$/i.test(key)
  || /^k[pid]\d*$/i.test(key)
  || /IntegralGain$/i.test(key)
);
for (const system of catalogue.systems) {
  for (const control of system.controls) {
    if (/Target|Initial|Limit|Weight|Amplitude|Minimum|Maximum/i.test(control.label)) {
      assert.equal(gainKey(control.key), false, `Non-gain control ${control.key} would receive an information icon`);
    }
  }
}

console.log("Dynamics Forge worker checks passed.");
