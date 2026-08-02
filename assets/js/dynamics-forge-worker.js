importScripts("dynamics-forge-level4.js?v=20260802-controller-groups1");

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function integralLimitFromPercent(percent, maximumOutput) {
  return Math.abs(maximumOutput) * clamp(percent, 0, 100) / 100;
}

function requireFinite(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
  return value;
}

function requireFiniteArray(values, label, magnitudeLimit = 1e6) {
  for (const value of values) {
    if (!Number.isFinite(value) || Math.abs(value) > magnitudeLimit) {
      throw new Error(`${label} became non-finite or exceeded its numerical safety limit.`);
    }
  }
}

function rk4Step(state, time, dt, derivative) {
  requireFiniteArray(state, "RK4 state");
  const k1 = derivative(state, time);
  requireFiniteArray(k1, "RK4 derivative");
  const k2State = state.map((value, index) => value + 0.5 * dt * k1[index]);
  const k2 = derivative(k2State, time + 0.5 * dt);
  requireFiniteArray(k2, "RK4 derivative");
  const k3State = state.map((value, index) => value + 0.5 * dt * k2[index]);
  const k3 = derivative(k3State, time + 0.5 * dt);
  requireFiniteArray(k3, "RK4 derivative");
  const k4State = state.map((value, index) => value + dt * k3[index]);
  const k4 = derivative(k4State, time + dt);
  requireFiniteArray(k4, "RK4 derivative");
  const next = state.map((value, index) => value + (dt / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]));
  requireFiniteArray(next, "Integrated state");
  return next;
}

function integrateRecorded({ initialState, duration, stateStride, dt, derivative, observe, metrics }) {
  requireFinite(duration, "Simulation duration");
  requireFinite(dt, "Integration step");
  if (duration <= 0 || duration > 30 || dt <= 0) throw new Error("Simulation timing is outside the supported safety limits.");
  requireFiniteArray(initialState, "Initial state");
  const sampleRate = 60;
  const count = Math.floor(duration * sampleRate) + 1;
  const timeValues = new Float32Array(count);
  const states = new Float32Array(count * stateStride);
  const reference = new Float32Array(count);
  const secondaryReference = new Float32Array(count);
  const effort = new Float32Array(count);
  secondaryReference.fill(Number.NaN);

  let state = [...initialState];
  let integrationTime = 0;
  for (let sample = 0; sample < count; sample += 1) {
    const sampleTime = sample / sampleRate;
    while (integrationTime < sampleTime - 1e-10) {
      const step = Math.min(dt, sampleTime - integrationTime);
      state = rk4Step(state, integrationTime, step, derivative);
      integrationTime += step;
    }
    const observation = observe(state, sampleTime);
    requireFinite(observation.reference, "Primary reference");
    requireFinite(observation.effort, "Recorded effort");
    if (observation.secondaryReference !== undefined && observation.secondaryReference !== null) requireFinite(observation.secondaryReference, "Secondary reference");
    timeValues[sample] = sampleTime;
    for (let index = 0; index < stateStride; index += 1) {
      const value = state[index];
      requireFinite(value, `Recorded state ${index}`);
      states[sample * stateStride + index] = value;
    }
    reference[sample] = observation.reference;
    if (Number.isFinite(observation.secondaryReference)) secondaryReference[sample] = observation.secondaryReference;
    effort[sample] = observation.effort;
  }

  const primaryIndex = metrics.primaryIndex || 0;
  const secondaryIndex = Number.isInteger(metrics.secondaryIndex) ? metrics.secondaryIndex : null;
  let primarySquaredError = 0;
  let secondarySquaredError = 0;
  let peakEffort = 0;
  for (let sample = 0; sample < count; sample += 1) {
    const primaryActual = states[sample * stateStride + primaryIndex];
    const primaryRawError = reference[sample] - primaryActual;
    const primaryError = metrics.primaryAngular ? wrapAngle(primaryRawError) : primaryRawError;
    primarySquaredError += primaryError * primaryError;
    if (secondaryIndex !== null && Number.isFinite(secondaryReference[sample])) {
      const secondaryActual = states[sample * stateStride + secondaryIndex];
      const secondaryRawError = secondaryReference[sample] - secondaryActual;
      const secondaryError = metrics.secondaryAngular ? wrapAngle(secondaryRawError) : secondaryRawError;
      secondarySquaredError += secondaryError * secondaryError;
    }
    peakEffort = Math.max(peakEffort, Math.abs(effort[sample]));
  }

  const result = {
    time: timeValues,
    states,
    reference,
    secondaryReference,
    effort,
    metrics: {
      rmsError: Math.sqrt(primarySquaredError / count) * (metrics.primaryScale || 1),
      metricUnit: metrics.primaryUnit,
      secondaryRms: secondaryIndex === null ? null : Math.sqrt(secondarySquaredError / count) * (metrics.secondaryScale || 1),
      secondaryUnit: metrics.secondaryUnit || "",
      peakEffort,
      effortUnit: metrics.effortUnit,
    },
  };
  requireFinite(result.metrics.rmsError, "RMS error");
  requireFinite(result.metrics.peakEffort, "Peak effort");
  if (result.metrics.secondaryRms !== null) requireFinite(result.metrics.secondaryRms, "Secondary RMS error");
  return result;
}

function simulateTwoLink(parameters, duration) {
  const amplitude = parameters.amplitude;
  const l1 = 0.296;
  const lc1 = 0.15;
  const lc2 = 0.1;
  const m1 = 1;
  const m2 = 1;
  const i1 = 0.01;
  const i2 = 0.01;
  const gravity = 9.81;
  const outputLimit = 4;
  const j1IntegralLimit = integralLimitFromPercent(parameters.j1IntegralMaxPercent, outputLimit);
  const j2IntegralLimit = integralLimitFromPercent(parameters.j2IntegralMaxPercent, outputLimit);
  const j1IntegralInitial = clamp(parameters.j1IntegralInitial, -j1IntegralLimit, j1IntegralLimit);
  const j2IntegralInitial = clamp(parameters.j2IntegralInitial, -j2IntegralLimit, j2IntegralLimit);

  const target = (time) => ({
    q1: amplitude * Math.sin(0.62 * time),
    q2: 0.72 * amplitude * Math.sin(0.48 * time + 0.7),
    dq1: 0.62 * amplitude * Math.cos(0.62 * time),
    dq2: 0.3456 * amplitude * Math.cos(0.48 * time + 0.7),
  });

  function control(values, time) {
    const desired = target(time);
    return {
      desired,
      tau1: clamp(parameters.kp1 * (desired.q1 - values[0]) + parameters.kd1 * (desired.dq1 - values[2]) + clamp(values[4], -j1IntegralLimit, j1IntegralLimit), -outputLimit, outputLimit),
      tau2: clamp(parameters.kp2 * (desired.q2 - values[1]) + parameters.kd2 * (desired.dq2 - values[3]) + clamp(values[5], -j2IntegralLimit, j2IntegralLimit), -outputLimit, outputLimit),
    };
  }

  function derivative(values, time) {
    const [q1, q2, dq1, dq2] = values;
    const { desired, tau1, tau2 } = control(values, time);
    const cosine = Math.cos(q2);
    const sine = Math.sin(q2);
    const m11 = i1 + i2 + m1 * lc1 * lc1 + m2 * (l1 * l1 + lc2 * lc2 + 2 * l1 * lc2 * cosine);
    const m12 = i2 + m2 * (lc2 * lc2 + l1 * lc2 * cosine);
    const m22 = i2 + m2 * lc2 * lc2;
    const c1 = -m2 * l1 * lc2 * sine * (2 * dq1 * dq2 + dq2 * dq2);
    const c2 = m2 * l1 * lc2 * sine * dq1 * dq1;
    const g1 = (m1 * lc1 + m2 * l1) * gravity * Math.sin(q1) + m2 * lc2 * gravity * Math.sin(q1 + q2);
    const g2 = m2 * lc2 * gravity * Math.sin(q1 + q2);
    const rhs1 = tau1 - c1 - g1 - 0.025 * dq1;
    const rhs2 = tau2 - c2 - g2 - 0.02 * dq2;
    const determinant = Math.max(1e-7, m11 * m22 - m12 * m12);
    const e1 = desired.q1 - q1;
    const e2 = desired.q2 - q2;
    const j1IntegralDrive = parameters.ki1 * e1;
    const j2IntegralDrive = parameters.ki2 * e2;
    return [
      dq1,
      dq2,
      (m22 * rhs1 - m12 * rhs2) / determinant,
      (-m12 * rhs1 + m11 * rhs2) / determinant,
      Math.abs(values[4]) >= j1IntegralLimit && Math.sign(values[4]) === Math.sign(j1IntegralDrive) ? 0 : j1IntegralDrive,
      Math.abs(values[5]) >= j2IntegralLimit && Math.sign(values[5]) === Math.sign(j2IntegralDrive) ? 0 : j2IntegralDrive,
    ];
  }

  const initialTarget = target(0);
  return integrateRecorded({
    initialState: [initialTarget.q1, initialTarget.q2, 0, 0, j1IntegralInitial, j2IntegralInitial],
    duration,
    stateStride: 4,
    dt: 0.002,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      return { reference: command.desired.q1, secondaryReference: command.desired.q2, effort: Math.max(Math.abs(command.tau1), Math.abs(command.tau2)) };
    },
    metrics: { primaryIndex: 0, secondaryIndex: 1, primaryAngular: true, secondaryAngular: true, primaryUnit: "rad", secondaryUnit: "rad", effortUnit: "N\u00b7m" },
  });
}

self.addEventListener("message", (event) => {
  const { requestId, systemId, parameters, duration } = event.data || {};
  try {
    requireFinite(duration, "Simulation duration");
    if (duration <= 0 || duration > 30) throw new Error("Simulation duration must be greater than 0 and no more than 30 seconds.");
    if (!parameters || typeof parameters !== "object") throw new Error("Simulation parameters are required.");
    for (const [key, value] of Object.entries(parameters)) requireFinite(value, `Parameter ${key}`);
    let result;
    if (systemId === "two_link") result = simulateTwoLink(parameters, duration);
    else if (["copter1", "copter2", "copter3", "drone4", "drone6", "drone8", "taxi_drone"].includes(systemId)) result = DynamicsForgeLevel4.simulate(systemId, parameters, duration);
    else throw new Error(`Unknown system: ${systemId}`);
    result.requestId = requestId;
    result.systemId = systemId;
    self.postMessage(result, [result.time.buffer, result.states.buffer, result.reference.buffer, result.secondaryReference.buffer, result.effort.buffer]);
  } catch (error) {
    self.postMessage({ requestId, systemId, error: error instanceof Error ? error.message : String(error) });
  }
});
