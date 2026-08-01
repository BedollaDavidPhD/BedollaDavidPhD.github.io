const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const degreesToRadians = (degrees) => degrees * Math.PI / 180;

function sampleCubicTrajectory(time, totalTime, waypoints) {
  const segmentCount = Math.max(1, waypoints.length - 1);
  const segmentTime = totalTime / segmentCount;
  const localTime = ((Math.max(0, time) % totalTime) + totalTime) % totalTime;
  const segment = Math.min(Math.floor(localTime / segmentTime), segmentCount - 1);
  const tau = localTime - segment * segmentTime;
  const start = waypoints[segment];
  const finish = waypoints[segment + 1];
  const delta = finish - start;
  const a2 = 3 * delta / (segmentTime * segmentTime);
  const a3 = -2 * delta / (segmentTime * segmentTime * segmentTime);
  return {
    position: start + a2 * tau * tau + a3 * tau * tau * tau,
    velocity: 2 * a2 * tau + 3 * a3 * tau * tau,
  };
}

function rk4Step(state, time, dt, derivative) {
  const k1 = derivative(state, time);
  const k2State = state.map((value, index) => value + 0.5 * dt * k1[index]);
  const k2 = derivative(k2State, time + 0.5 * dt);
  const k3State = state.map((value, index) => value + 0.5 * dt * k2[index]);
  const k3 = derivative(k3State, time + 0.5 * dt);
  const k4State = state.map((value, index) => value + dt * k3[index]);
  const k4 = derivative(k4State, time + dt);
  return state.map((value, index) => value + (dt / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]));
}

function integrateRecorded({ initialState, duration, stateStride, dt, derivative, observe, metrics }) {
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
    timeValues[sample] = sampleTime;
    for (let index = 0; index < stateStride; index += 1) states[sample * stateStride + index] = state[index] || 0;
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

  return {
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
  const integralLimit = 1;

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
      tau1: clamp(parameters.kp1 * (desired.q1 - values[0]) + parameters.kd1 * (desired.dq1 - values[2]) + parameters.ki1 * values[4], -4, 4),
      tau2: clamp(parameters.kp2 * (desired.q2 - values[1]) + parameters.kd2 * (desired.dq2 - values[3]) + parameters.ki2 * values[5], -4, 4),
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
    return [
      dq1,
      dq2,
      (m22 * rhs1 - m12 * rhs2) / determinant,
      (-m12 * rhs1 + m11 * rhs2) / determinant,
      Math.abs(values[4]) >= integralLimit && Math.sign(values[4]) === Math.sign(e1) ? 0 : e1,
      Math.abs(values[5]) >= integralLimit && Math.sign(values[5]) === Math.sign(e2) ? 0 : e2,
    ];
  }

  const initialTarget = target(0);
  return integrateRecorded({
    initialState: [initialTarget.q1, initialTarget.q2, 0, 0, 0, 0],
    duration,
    stateStride: 4,
    dt: 0.002,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      return { reference: command.desired.q1, secondaryReference: command.desired.q2, effort: Math.max(Math.abs(command.tau1), Math.abs(command.tau2)) };
    },
    metrics: { primaryIndex: 0, secondaryIndex: 1, primaryAngular: true, secondaryAngular: true, primaryUnit: "rad", secondaryUnit: "rad", effortUnit: "N·m" },
  });
}

function simulateDrone4(parameters, duration) {
  const mass = 1.5;
  const gravity = 9.81;
  const zIntegralLimit = 1;
  const yawIntegralLimit = 1;
  const yawTarget = degreesToRadians(parameters.yawTarget);
  const references = (time) => ({ z: time < 0.75 ? 0.3 : parameters.zTarget, yaw: time < 1 ? 0 : yawTarget });

  function control(values, time) {
    const desired = references(time);
    const zError = desired.z - values[0];
    const zAcceleration = clamp(parameters.zKp * zError - parameters.zKd * values[1] + parameters.zKi * values[2], -0.78 * gravity, 0.78 * gravity);
    const thrust = clamp(mass * (gravity + zAcceleration), 0, 2 * mass * gravity);
    const yawError = wrapAngle(desired.yaw - values[3]);
    const yawTorque = clamp(parameters.yawKp * yawError - parameters.yawKd * values[4] + parameters.yawKi * values[5], -0.24, 0.24);
    return { desired, thrust, yawTorque, zError, yawError };
  }

  function derivative(values, time) {
    const command = control(values, time);
    const zIntegralDrive = 0.15 * command.zError - 0.1 * values[1];
    const yawIntegralDrive = command.yawError;
    return [
      values[1],
      command.thrust / mass - gravity - 0.35 * values[1],
      Math.abs(values[2]) >= zIntegralLimit && Math.sign(values[2]) === Math.sign(zIntegralDrive) ? 0 : zIntegralDrive,
      values[4],
      command.yawTorque / 0.08 - 0.75 * values[4],
      Math.abs(values[5]) >= yawIntegralLimit && Math.sign(values[5]) === Math.sign(yawIntegralDrive) ? 0 : yawIntegralDrive,
    ];
  }

  return integrateRecorded({
    initialState: [0.3, 0, parameters.zIntegralInitial, 0, 0, parameters.yawIntegralInitial],
    duration,
    stateStride: 6,
    dt: 0.002,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      return { reference: command.desired.z, secondaryReference: command.desired.yaw, effort: command.thrust };
    },
    metrics: { primaryIndex: 0, secondaryIndex: 3, secondaryAngular: true, primaryUnit: "m", secondaryUnit: "deg", secondaryScale: 180 / Math.PI, effortUnit: "N" },
  });
}

function simulateCopter1(parameters, duration) {
  const trajectoryAt = (time) => sampleCubicTrajectory(time, 10, [0, 0.5, -0.5, -1.57]);

  function control(values, time) {
    const desired = trajectoryAt(time);
    const error = desired.position - values[0];
    const velocityError = desired.velocity - values[1];
    const torque = clamp(parameters.kp * error + parameters.kd * velocityError + parameters.ki * values[2], -1.5, 1.5);
    return { desired, error, torque };
  }

  function derivative(values, time) {
    const command = control(values, time);
    const integralDrive = Math.abs(values[2]) >= 1.5 && Math.sign(values[2]) === Math.sign(command.error) ? 0 : command.error;
    const acceleration = (command.torque - 0.65 * Math.sin(values[0]) - 0.12 * values[1]) / 0.32;
    return [values[1], acceleration, integralDrive];
  }

  return integrateRecorded({
    initialState: [0, 0, parameters.integralInitial],
    duration,
    stateStride: 3,
    dt: 0.002,
    derivative,
    observe(values, time) { const command = control(values, time); return { reference: command.desired.position, effort: command.torque }; },
    metrics: { primaryIndex: 0, primaryAngular: true, primaryUnit: "rad", effortUnit: "N·m" },
  });
}

function simulateCopter2(parameters, duration) {
  const thrustCoefficient = 0.000015;
  const dragCoefficient = 0.00000025;
  const rotorInertia = 0.00006;
  const rotorViscousFriction = 0.0005;
  const motorTimeConstant = 0.003;
  const maximumMotorEffort = 1.5;
  const maximumMotorPower = 300;
  const motorPowerVelocityFloor = 30;
  const yawInertia = 4.07;
  const rollInertia = 0.07;
  const yawTargetAt = (time) => sampleCubicTrajectory(time, 14, [0, Math.PI / 2, 3 * Math.PI / 2, 0, 0]);

  function control(values, time) {
    const yawTargetState = yawTargetAt(time);
    const yawReference = yawTargetState.position;
    const yawError = yawReference - values[0];
    const yawVelocityError = yawTargetState.velocity - values[4];
    const yawIntegral = clamp(values[8], -parameters.yawIntegralLimit, parameters.yawIntegralLimit);
    const collectiveEffort = parameters.yawKp * yawError + parameters.yawKd * yawVelocityError + yawIntegral;
    const rollReference = clamp(-collectiveEffort, parameters.rollReferenceMin, parameters.rollReferenceMax);
    const rollError = rollReference - values[1];
    const rollVelocityError = -values[5];
    const rollIntegral = clamp(values[9], -parameters.rollIntegralLimit, parameters.rollIntegralLimit);
    const differentialEffort = parameters.rollKp * rollError + parameters.rollKd * rollVelocityError + rollIntegral;
    const leftMotorEffort = clamp(Math.abs(0.9 * collectiveEffort) + differentialEffort, 0, maximumMotorEffort);
    const rightMotorEffort = -clamp(Math.abs(0.9 * collectiveEffort) - differentialEffort, 0, maximumMotorEffort);
    return {
      yawReference,
      yawError,
      yawVelocityError,
      rollReference,
      rollError,
      rollVelocityError,
      leftMotorEffort,
      rightMotorEffort,
    };
  }

  function derivative(values, time) {
    const command = control(values, time);
    const leftPowerLimit = maximumMotorPower / Math.max(Math.abs(values[6]), motorPowerVelocityFloor);
    const rightPowerLimit = maximumMotorPower / Math.max(Math.abs(values[7]), motorPowerVelocityFloor);
    const leftEffortTarget = clamp(command.leftMotorEffort, -leftPowerLimit, leftPowerLimit);
    const rightEffortTarget = clamp(command.rightMotorEffort, -rightPowerLimit, rightPowerLimit);
    const leftAppliedEffort = values[10];
    const rightAppliedEffort = values[11];
    const leftRotorDrag = dragCoefficient * values[6] * Math.abs(values[6]);
    const rightRotorDrag = dragCoefficient * values[7] * Math.abs(values[7]);
    const leftRotorAcceleration = (leftAppliedEffort - rotorViscousFriction * values[6] - leftRotorDrag) / rotorInertia;
    const rightRotorAcceleration = (rightAppliedEffort - rotorViscousFriction * values[7] - rightRotorDrag) / rotorInertia;
    const leftThrust = thrustCoefficient * values[6] * values[6];
    const rightThrust = thrustCoefficient * values[7] * values[7];
    const yawAerodynamicMoment = -1.5 * (leftThrust + rightThrust) * Math.sin(values[1]);
    const rotorReactionMoment = Math.cos(values[1]) * (-leftRotorDrag - rightRotorDrag);
    const yawAcceleration = (yawAerodynamicMoment + rotorReactionMoment - 0.1 * values[4]) / yawInertia;
    const rollAcceleration = (0.5 * (leftThrust - rightThrust) - 0.1 * values[5]) / rollInertia;
    const yawIntegralDrive = parameters.yawIntegralGain * (
      parameters.yawIntegralPositionWeight * command.yawError
      + parameters.yawIntegralVelocityWeight * command.yawVelocityError
    );
    const rollIntegralDrive = parameters.rollIntegralGain * (
      parameters.rollIntegralPositionWeight * command.rollError
      + parameters.rollIntegralVelocityWeight * command.rollVelocityError
    );
    const yawIntegralDerivative = Math.abs(values[8]) >= parameters.yawIntegralLimit
      && Math.sign(values[8]) === Math.sign(yawIntegralDrive) ? 0 : yawIntegralDrive;
    const rollIntegralDerivative = Math.abs(values[9]) >= parameters.rollIntegralLimit
      && Math.sign(values[9]) === Math.sign(rollIntegralDrive) ? 0 : rollIntegralDrive;
    return [
      values[4],
      values[5],
      values[6],
      values[7],
      yawAcceleration,
      rollAcceleration,
      leftRotorAcceleration,
      rightRotorAcceleration,
      yawIntegralDerivative,
      rollIntegralDerivative,
      (leftEffortTarget - leftAppliedEffort) / motorTimeConstant,
      (rightEffortTarget - rightAppliedEffort) / motorTimeConstant,
    ];
  }

  return integrateRecorded({
    initialState: [0, 0, 0, 0, 0, 0, 0, 0, parameters.yawIntegralInitial, parameters.rollIntegralInitial, 0, 0],
    duration,
    stateStride: 8,
    dt: 0.001,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      return {
        reference: command.yawReference,
        secondaryReference: command.rollReference,
        effort: Math.max(Math.abs(command.leftMotorEffort), Math.abs(command.rightMotorEffort)),
      };
    },
    metrics: { primaryIndex: 0, secondaryIndex: 1, primaryAngular: true, secondaryAngular: true, primaryUnit: "deg", secondaryUnit: "deg", primaryScale: 180 / Math.PI, secondaryScale: 180 / Math.PI, effortUnit: "N·m" },
  });
}

function simulateTaxiDrone(parameters, duration) {
  const gravity = 9.81;
  const mass = 1.5;
  const positionTarget = [parameters.targetX, parameters.targetY, parameters.targetZ];
  const attitudeTarget = [parameters.targetRoll, parameters.targetPitch, parameters.targetYaw].map(degreesToRadians);
  const references = (time) => ({
    position: time < 0.75 ? [0, 0, 1] : positionTarget,
    attitude: time < 1 ? [0, 0, 0] : attitudeTarget,
  });

  function control(values, time) {
    const desired = references(time);
    const accelerations = [0, 1, 2].map((axis) => clamp(
      parameters.positionKp * (desired.position[axis] - values[axis]) - parameters.positionKd * values[axis + 3] + parameters.positionKi * values[axis + 12],
      -5,
      5,
    ));
    const angularAccelerations = [0, 1, 2].map((axis) => clamp(
      parameters.attitudeKp * wrapAngle(desired.attitude[axis] - values[axis + 6]) - parameters.attitudeKd * values[axis + 9] + parameters.attitudeKi * values[axis + 15],
      -6,
      6,
    ));
    return { desired, accelerations, angularAccelerations };
  }

  function derivative(values, time) {
    const command = control(values, time);
    const output = [
      values[3], values[4], values[5],
      command.accelerations[0] - 0.13 * values[3],
      command.accelerations[1] - 0.13 * values[4],
      command.accelerations[2] - 0.2 * values[5],
      values[9], values[10], values[11],
      command.angularAccelerations[0] - 0.4 * values[9],
      command.angularAccelerations[1] - 0.4 * values[10],
      command.angularAccelerations[2] - 0.4 * values[11],
    ];
    for (let axis = 0; axis < 3; axis += 1) {
      const error = command.desired.position[axis] - values[axis];
      output.push(Math.abs(values[axis + 12]) >= 1 && Math.sign(values[axis + 12]) === Math.sign(error) ? 0 : error);
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const error = wrapAngle(command.desired.attitude[axis] - values[axis + 6]);
      output.push(Math.abs(values[axis + 15]) >= 1 && Math.sign(values[axis + 15]) === Math.sign(error) ? 0 : error);
    }
    return output;
  }

  const positionIntegral = parameters.positionIntegralInitial;
  const attitudeIntegral = parameters.attitudeIntegralInitial;
  return integrateRecorded({
    initialState: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, positionIntegral, positionIntegral, positionIntegral, attitudeIntegral, attitudeIntegral, attitudeIntegral],
    duration,
    stateStride: 12,
    dt: 0.002,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      const thrust = mass * (gravity + command.accelerations[2]);
      return { reference: command.desired.position[2], secondaryReference: command.desired.attitude[2], effort: thrust };
    },
    metrics: { primaryIndex: 2, secondaryIndex: 8, secondaryAngular: true, primaryUnit: "m", secondaryUnit: "deg", secondaryScale: 180 / Math.PI, effortUnit: "N" },
  });
}

function simulateDrone6(parameters, duration) {
  const gravity = 9.81;
  const mass = 1.5;
  const positionTarget = [parameters.targetX, parameters.targetY, parameters.targetZ];
  const attitudeTarget = [parameters.targetRoll, parameters.targetPitch, parameters.targetYaw].map(degreesToRadians);
  const references = (time) => ({ position: time < 0.75 ? [0, 0, 0.3] : positionTarget, attitude: time < 1 ? [0, 0, 0] : attitudeTarget });

  function control(values, time) {
    const desired = references(time);
    const accelerations = [0, 1, 2].map((axis) => clamp(
      parameters.positionKp * (desired.position[axis] - values[axis]) - parameters.positionKd * values[axis + 3] + parameters.positionKi * values[axis + 12],
      -5,
      5,
    ));
    const angularAccelerations = [0, 1, 2].map((axis) => clamp(
      parameters.attitudeKp * wrapAngle(desired.attitude[axis] - values[axis + 6]) - parameters.attitudeKd * values[axis + 9] + parameters.attitudeKi * values[axis + 15],
      -6,
      6,
    ));
    return { desired, accelerations, angularAccelerations };
  }

  function derivative(values, time) {
    const command = control(values, time);
    const output = [values[3], values[4], values[5], command.accelerations[0] - 0.15 * values[3], command.accelerations[1] - 0.15 * values[4], command.accelerations[2] - 0.22 * values[5], values[9], values[10], values[11], command.angularAccelerations[0] - 0.45 * values[9], command.angularAccelerations[1] - 0.45 * values[10], command.angularAccelerations[2] - 0.45 * values[11]];
    for (let axis = 0; axis < 3; axis += 1) {
      const error = command.desired.position[axis] - values[axis];
      output.push(Math.abs(values[axis + 12]) >= 1 && Math.sign(values[axis + 12]) === Math.sign(error) ? 0 : error);
    }
    for (let axis = 0; axis < 3; axis += 1) {
      const error = wrapAngle(command.desired.attitude[axis] - values[axis + 6]);
      output.push(Math.abs(values[axis + 15]) >= 1 && Math.sign(values[axis + 15]) === Math.sign(error) ? 0 : error);
    }
    return output;
  }

  const positionIntegral = parameters.positionIntegralInitial;
  const attitudeIntegral = parameters.attitudeIntegralInitial;
  return integrateRecorded({
    initialState: [0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, positionIntegral, positionIntegral, positionIntegral, attitudeIntegral, attitudeIntegral, attitudeIntegral],
    duration,
    stateStride: 12,
    dt: 0.002,
    derivative,
    observe(values, time) {
      const command = control(values, time);
      const thrust = mass * (gravity + command.accelerations[2]);
      return { reference: command.desired.position[2], secondaryReference: command.desired.attitude[2], effort: thrust };
    },
    metrics: { primaryIndex: 2, secondaryIndex: 8, secondaryAngular: true, primaryUnit: "m", secondaryUnit: "deg", secondaryScale: 180 / Math.PI, effortUnit: "N" },
  });
}

self.addEventListener("message", (event) => {
  const { requestId, systemId, parameters, duration } = event.data || {};
  try {
    let result;
    if (systemId === "two_link") result = simulateTwoLink(parameters, duration);
    else if (systemId === "drone4") result = simulateDrone4(parameters, duration);
    else if (systemId === "copter1") result = simulateCopter1(parameters, duration);
    else if (systemId === "copter2") result = simulateCopter2(parameters, duration);
    else if (systemId === "taxi_drone") result = simulateTaxiDrone(parameters, duration);
    else if (systemId === "drone6") result = simulateDrone6(parameters, duration);
    else throw new Error(`Unknown system: ${systemId}`);
    result.requestId = requestId;
    result.systemId = systemId;
    self.postMessage(result, [result.time.buffer, result.states.buffer, result.reference.buffer, result.secondaryReference.buffer, result.effort.buffer]);
  } catch (error) {
    self.postMessage({ requestId, systemId, error: error instanceof Error ? error.message : String(error) });
  }
});
