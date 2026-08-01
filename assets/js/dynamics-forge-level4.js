(() => {
  "use strict";

  const PI = Math.PI;
  const TWO_PI = 2 * PI;
  const GRAVITY = 9.81;
  const PLANT_DT = 0.001;
  const CONTROLLER_DT = 0.004;
  const SAMPLE_RATE = 60;
  const THRUST_COEFFICIENT = 0.000015;
  const DRAG_COEFFICIENT = 0.00000025;
  const ROTOR_EFFORT_LIMIT = 1.5;
  const ROTOR_POWER_LIMIT = 300;
  const POWER_VELOCITY_FLOOR = 30;
  const ROTOR_VISCOUS_FRICTION = 0.0005;
  const MOTOR_TIME_CONSTANT = 0.003;
  const ENCODER_COUNTS = 4096;

  const clamp = (value, lower, upper) => Math.max(lower, Math.min(value, upper));
  const deg2rad = (value) => value * PI / 180;

  function wrapPi(value) {
    return ((value + PI) % TWO_PI) - PI;
  }

  function zeros(length) {
    return new Float64Array(length);
  }

  function identity6() {
    const output = zeros(36);
    for (let index = 0; index < 6; index += 1) output[index * 6 + index] = 1;
    return output;
  }

  function multiply6(a, b) {
    const output = zeros(36);
    for (let row = 0; row < 6; row += 1) {
      for (let inner = 0; inner < 6; inner += 1) {
        const value = a[row * 6 + inner];
        if (value === 0) continue;
        for (let column = 0; column < 6; column += 1) {
          output[row * 6 + column] += value * b[inner * 6 + column];
        }
      }
    }
    return output;
  }

  function multiply6Vector(matrix, vector) {
    const output = zeros(6);
    for (let row = 0; row < 6; row += 1) {
      let value = 0;
      for (let column = 0; column < 6; column += 1) value += matrix[row * 6 + column] * vector[column];
      output[row] = value;
    }
    return output;
  }

  function transpose6(matrix) {
    const output = zeros(36);
    for (let row = 0; row < 6; row += 1) {
      for (let column = 0; column < 6; column += 1) output[row * 6 + column] = matrix[column * 6 + row];
    }
    return output;
  }

  function addVector6(a, b) {
    const output = zeros(6);
    for (let index = 0; index < 6; index += 1) output[index] = a[index] + b[index];
    return output;
  }

  function addVector6InPlace(target, value) {
    for (let index = 0; index < 6; index += 1) target[index] += value[index];
  }

  function addMatrix6InPlace(target, value) {
    for (let index = 0; index < 36; index += 1) target[index] += value[index];
  }

  function crm(vector) {
    const [wx, wy, wz, vx, vy, vz] = vector;
    return Float64Array.from([
      0, -wz, wy, 0, 0, 0,
      wz, 0, -wx, 0, 0, 0,
      -wy, wx, 0, 0, 0, 0,
      0, -vz, vy, 0, -wz, wy,
      vz, 0, -vx, wz, 0, -wx,
      -vy, vx, 0, -wy, wx, 0,
    ]);
  }

  function crf(vector) {
    const output = transpose6(crm(vector));
    for (let index = 0; index < 36; index += 1) output[index] = -output[index];
    return output;
  }

  function linkSpatialTransform(dh, jointType, coordinate) {
    const alpha = deg2rad(dh.alpha);
    const offset = deg2rad(dh.offset);
    let theta = deg2rad(dh.theta) + offset;
    let d = dh.d;
    if (jointType === 0) theta = wrapPi(coordinate + offset);
    else if (jointType === 1) {
      theta = wrapPi(theta);
      d = coordinate;
    } else theta = wrapPi(theta);

    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    // Modified DH: Rx(alpha) Tx(a) Rz(theta) Tz(d).
    const rotation = [
      ct, -st, 0,
      ca * st, ca * ct, -sa,
      sa * st, sa * ct, ca,
    ];
    const position = [dh.a, -sa * d, ca * d];
    const e = [
      rotation[0], rotation[3], rotation[6],
      rotation[1], rotation[4], rotation[7],
      rotation[2], rotation[5], rotation[8],
    ];
    const skewPosition = [
      0, -position[2], position[1],
      position[2], 0, -position[0],
      -position[1], position[0], 0,
    ];
    const ep = new Array(9).fill(0);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        for (let inner = 0; inner < 3; inner += 1) ep[row * 3 + column] += e[row * 3 + inner] * skewPosition[inner * 3 + column];
      }
    }

    const output = zeros(36);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        output[row * 6 + column] = e[row * 3 + column];
        output[(row + 3) * 6 + column] = -ep[row * 3 + column];
        output[(row + 3) * 6 + column + 3] = e[row * 3 + column];
      }
    }
    return output;
  }

  function spatialInertia(physical) {
    const { cx = 0, cy = 0, cz = 0, ix = 0, iy = 0, iz = 0, mass = 0 } = physical;
    const c = [
      0, -cz, cy,
      cz, 0, -cx,
      -cy, cx, 0,
    ];
    const cc = new Array(9).fill(0);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        for (let inner = 0; inner < 3; inner += 1) cc[row * 3 + column] += c[row * 3 + inner] * c[column * 3 + inner];
      }
    }
    const output = zeros(36);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        output[row * 6 + column] = mass * cc[row * 3 + column];
        output[row * 6 + column + 3] = mass * c[row * 3 + column];
        output[(row + 3) * 6 + column] = -mass * c[row * 3 + column];
      }
      output[row * 6 + row] += [ix, iy, iz][row];
      output[(row + 3) * 6 + row + 3] = mass;
    }
    return output;
  }

  function forwardDynamics(model, q, dq, tau, externalForces) {
    const n = model.parents.length;
    const xup = new Array(n);
    const velocity = new Array(n);
    const biasAcceleration = new Array(n);
    const articulatedInertia = new Array(n);
    const articulatedBias = new Array(n);
    const uVector = new Array(n);
    const denominator = zeros(n);
    const generalizedBias = zeros(n);

    for (let body = 0; body < n; body += 1) {
      xup[body] = linkSpatialTransform(model.dh[body], model.jointTypes[body], q[body]);
      const parent = model.parents[body];
      const jointAxis = model.jointTypes[body] === 0 ? 2 : (model.jointTypes[body] === 1 ? 5 : -1);
      const jointVelocity = zeros(6);
      if (jointAxis >= 0) jointVelocity[jointAxis] = dq[body];
      velocity[body] = parent < 0 ? jointVelocity : addVector6(multiply6Vector(xup[body], velocity[parent]), jointVelocity);
      biasAcceleration[body] = multiply6Vector(crm(velocity[body]), jointVelocity);
      articulatedInertia[body] = model.spatialInertias[body].slice();
      articulatedBias[body] = multiply6Vector(crf(velocity[body]), multiply6Vector(articulatedInertia[body], velocity[body]));
      const external = externalForces[body];
      for (let component = 0; component < 6; component += 1) articulatedBias[body][component] -= external[component];
    }

    for (let body = n - 1; body >= 0; body -= 1) {
      const jointAxis = model.jointTypes[body] === 0 ? 2 : (model.jointTypes[body] === 1 ? 5 : -1);
      let inertiaToParent;
      let biasToParent;
      if (jointAxis < 0) {
        inertiaToParent = articulatedInertia[body];
        biasToParent = addVector6(articulatedBias[body], multiply6Vector(articulatedInertia[body], biasAcceleration[body]));
      } else {
        const u = zeros(6);
        for (let row = 0; row < 6; row += 1) u[row] = articulatedInertia[body][row * 6 + jointAxis];
        uVector[body] = u;
        const d = u[jointAxis];
        if (Math.abs(d) < 1e-12) throw new Error("Near-zero articulated inertia in the selected model.");
        denominator[body] = d;
        generalizedBias[body] = tau[body] - articulatedBias[body][jointAxis];
        inertiaToParent = articulatedInertia[body].slice();
        for (let row = 0; row < 6; row += 1) {
          for (let column = 0; column < 6; column += 1) inertiaToParent[row * 6 + column] -= u[row] * u[column] / d;
        }
        biasToParent = addVector6(articulatedBias[body], multiply6Vector(inertiaToParent, biasAcceleration[body]));
        for (let component = 0; component < 6; component += 1) biasToParent[component] += u[component] * generalizedBias[body] / d;
      }

      const parent = model.parents[body];
      if (parent >= 0) {
        const transpose = transpose6(xup[body]);
        addMatrix6InPlace(articulatedInertia[parent], multiply6(multiply6(transpose, inertiaToParent), xup[body]));
        addVector6InPlace(articulatedBias[parent], multiply6Vector(transpose, biasToParent));
      }
    }

    const accelerations = new Array(n);
    const qdd = zeros(n);
    const baseAcceleration = Float64Array.from([0, 0, 0, 0, 0, GRAVITY]);
    for (let body = 0; body < n; body += 1) {
      const parent = model.parents[body];
      const parentAcceleration = parent < 0 ? baseAcceleration : accelerations[parent];
      const acceleration = addVector6(multiply6Vector(xup[body], parentAcceleration), biasAcceleration[body]);
      const jointAxis = model.jointTypes[body] === 0 ? 2 : (model.jointTypes[body] === 1 ? 5 : -1);
      if (jointAxis >= 0) {
        let projection = 0;
        for (let component = 0; component < 6; component += 1) projection += uVector[body][component] * acceleration[component];
        qdd[body] = (generalizedBias[body] - projection) / denominator[body];
        acceleration[jointAxis] += qdd[body];
      }
      accelerations[body] = acceleration;
    }
    return qdd;
  }

  function makeModel(id, rotorLocations, rotorDirections, groups) {
    const parents = [-1, 0, 1, 2, 3, 4];
    const jointTypes = [1, 1, 1, 0, 0, 0];
    const dh = [
      { alpha: 0, a: 0, theta: 0, d: 1, offset: 0 },
      { alpha: -90, a: 0, theta: 0, d: 1, offset: -90 },
      { alpha: -90, a: 0, theta: 0, d: 1, offset: 90 },
      { alpha: 90, a: 0, theta: 0, d: 0, offset: 90 },
      { alpha: -90, a: 0, theta: 0, d: 0, offset: 90 },
      { alpha: 90, a: 0, theta: 0, d: 0, offset: -90 },
    ];
    const physical = [
      {}, {}, {}, {}, {}, { ix: 0.02, iy: 0.02, iz: 0.02, mass: 1.5 },
    ];
    const rotorFrames = [];
    for (const [a, d] of rotorLocations) {
      parents.push(5);
      jointTypes.push(2);
      dh.push({ alpha: 0, a, theta: 0, d, offset: 0 });
      physical.push({});
      const fixedIndex = parents.length - 1;
      parents.push(fixedIndex);
      jointTypes.push(0);
      dh.push({ alpha: 90, a: 0, theta: 0, d: 0, offset: 0 });
      physical.push({ iz: 0.00006 });
      rotorFrames.push(parents.length - 1);
    }
    return {
      id,
      parents,
      jointTypes,
      dh,
      physical,
      spatialInertias: physical.map(spatialInertia),
      rotorFrames,
      rotorDirections,
      positiveRoll: new Set(groups.positiveRoll.map((frame) => frame - 1)),
      negativeRoll: new Set(groups.negativeRoll.map((frame) => frame - 1)),
      positivePitch: new Set(groups.positivePitch.map((frame) => frame - 1)),
      negativePitch: new Set(groups.negativePitch.map((frame) => frame - 1)),
      positiveYaw: new Set(groups.positiveYaw.map((frame) => frame - 1)),
      negativeYaw: new Set(groups.negativeYaw.map((frame) => frame - 1)),
    };
  }

  const MODELS = {
    drone6: makeModel(
      "drone6",
      [[-0.5, 0.866], [-1, 0], [-0.5, -0.866], [0.5, -0.866], [1, 0], [0.5, 0.866]],
      [1, -1, 1, -1, 1, -1],
      {
        positiveRoll: [8, 10, 12], negativeRoll: [14, 16, 18],
        positivePitch: [12, 14], negativePitch: [8, 18],
        positiveYaw: [10, 14, 18], negativeYaw: [8, 12, 16],
      },
    ),
    taxi_drone: makeModel(
      "taxi_drone",
      [
        [-0.518, 1.932], [-0.5, 0.866], [-1.414, 1.414], [-1.932, 0.518], [-1, 0], [-1.932, -0.518],
        [-1.414, -1.414], [-0.5, -0.866], [-0.518, -1.932], [0.518, -1.932], [0.5, -0.866], [1.414, -1.414],
        [1.932, -0.518], [1, 0], [1.932, 0.518], [1.414, 1.414], [0.5, 0.866], [0.518, 1.932],
      ],
      [1, 1, -1, 1, -1, -1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, -1, -1],
      {
        positiveRoll: [8, 10, 12, 14, 16, 18, 20, 22, 24], negativeRoll: [26, 28, 30, 32, 34, 36, 38, 40, 42],
        positivePitch: [18, 20, 22, 24, 26, 28, 30, 32], negativePitch: [8, 10, 12, 14, 36, 38, 40, 42],
        positiveYaw: [12, 16, 18, 24, 28, 30, 36, 40, 42], negativeYaw: [8, 10, 14, 20, 22, 26, 32, 34, 38],
      },
    ),
  };

  class TrapezoidalIntegral {
    constructor(initial = 0) {
      this.value = initial;
      this.previous = 0;
      this.initialized = false;
    }

    update(integrand, dt, limit) {
      if (!this.initialized) {
        this.previous = integrand;
        this.initialized = true;
        return this.value;
      }
      this.value = clamp(this.value + 0.5 * dt * (this.previous + integrand), -limit, limit);
      this.previous = integrand;
      return this.value;
    }
  }

  class MultirotorSimulation {
    constructor(model, parameters, initialPosition) {
      this.model = model;
      this.parameters = parameters;
      this.initialPosition = initialPosition.slice();
      this.n = model.parents.length;
      this.q = zeros(this.n);
      this.dq = zeros(this.n);
      this.q[0] = initialPosition[2];
      this.q[1] = initialPosition[1];
      this.q[2] = initialPosition[0];
      this.feedbackQ = this.q.slice();
      this.feedbackDq = this.dq.slice();
      this.encoderQ = this.q.slice();
      this.previousEncoderQ = this.q.slice();
      this.encoderDq = this.dq.slice();
      this.estimatedQ = this.q.slice();
      this.estimatedDq = this.dq.slice();
      this.desiredEffort = zeros(model.rotorFrames.length);
      this.motorEffort = zeros(model.rotorFrames.length);
      this.appliedEffort = zeros(model.rotorFrames.length);
      this.time = 0;
      this.nextControllerTime = 0;
      const pInitial = Number(parameters.positionIntegralInitial) || 0;
      const aInitial = Number(parameters.attitudeIntegralInitial) || 0;
      this.integrals = {
        z: new TrapezoidalIntegral(pInitial), x: new TrapezoidalIntegral(pInitial), y: new TrapezoidalIntegral(pInitial),
        roll: new TrapezoidalIntegral(aInitial), pitch: new TrapezoidalIntegral(aInitial), yaw: new TrapezoidalIntegral(aInitial),
      };
      this.lastDesired = this.references(0);
      this.lastTotalThrust = 0;
    }

    references(time) {
      const position = time < 0.75
        ? this.initialPosition
        : [this.parameters.targetX, this.parameters.targetY, this.parameters.targetZ];
      const attitude = time < 1
        ? [0, 0, 0]
        : [this.parameters.targetRoll, this.parameters.targetPitch, this.parameters.targetYaw].map(deg2rad);
      return { position, attitude };
    }

    pid(axis, positionError, velocityError, group) {
      const kp = group === "position" ? this.parameters.positionKp : this.parameters.attitudeKp;
      const kd = group === "position" ? this.parameters.positionKd : this.parameters.attitudeKd;
      const ki = group === "position" ? this.parameters.positionKi : this.parameters.attitudeKi;
      const integral = this.integrals[axis].update(ki * positionError, CONTROLLER_DT, 1);
      return kp * positionError + kd * velocityError + integral;
    }

    updateController() {
      const desired = this.references(this.time);
      this.lastDesired = desired;
      const q = this.feedbackQ;
      const dq = this.feedbackDq;
      const zError = desired.position[2] - q[0];
      const allocationScale = 6 / this.model.rotorFrames.length;
      const collectiveScale = Math.sqrt(allocationScale);
      const collective = Math.max(0, 0.25 * collectiveScale + this.pid("z", zError, -dq[0], "position"));
      const pitchReference = desired.attitude[1] + this.pid("x", desired.position[0] - q[2], -dq[2], "position");
      const rollReference = desired.attitude[0] - this.pid("y", desired.position[1] - q[1], -dq[1], "position");
      const rollMix = this.pid("roll", rollReference - q[5], -dq[5], "attitude");
      const pitchMix = this.pid("pitch", pitchReference - q[4], -dq[4], "attitude");
      const yawMix = this.pid("yaw", desired.attitude[2] - q[3], -dq[3], "attitude");

      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const rollCoefficient = this.model.positiveRoll.has(frame) ? 1 : (this.model.negativeRoll.has(frame) ? -1 : 0);
        const pitchCoefficient = this.model.positivePitch.has(frame) ? 1 : (this.model.negativePitch.has(frame) ? -1 : 0);
        const yawCoefficient = this.model.positiveYaw.has(frame) ? 1 : (this.model.negativeYaw.has(frame) ? -1 : 0);
        const magnitude = clamp(
          collective + allocationScale * (rollMix * rollCoefficient + pitchMix * pitchCoefficient + yawMix * yawCoefficient),
          0,
          ROTOR_EFFORT_LIMIT,
        );
        this.desiredEffort[rotor] = this.model.rotorDirections[rotor] * magnitude;
      }
    }

    externalForces() {
      const forces = Array.from({ length: this.n }, () => zeros(6));
      let totalThrust = 0;
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const velocity = this.dq[frame];
        const thrust = THRUST_COEFFICIENT * velocity * velocity;
        const drag = -DRAG_COEFFICIENT * velocity * Math.abs(velocity);
        forces[frame][5] += thrust;
        forces[frame][2] += drag;
        totalThrust += thrust;
      }
      this.lastTotalThrust = totalThrust;
      return forces;
    }

    updateActuators() {
      const tau = zeros(this.n);
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        this.motorEffort[rotor] += PLANT_DT * (this.desiredEffort[rotor] - this.motorEffort[rotor]) / MOTOR_TIME_CONSTANT;
        const velocity = this.dq[frame];
        const powerLimit = ROTOR_POWER_LIMIT / Math.max(Math.abs(velocity), POWER_VELOCITY_FLOOR);
        const activeLimit = Math.min(ROTOR_EFFORT_LIMIT, powerLimit);
        this.appliedEffort[rotor] = clamp(this.motorEffort[rotor], -activeLimit, activeLimit);
        tau[frame] = this.appliedEffort[rotor] - ROTOR_VISCOUS_FRICTION * velocity;
      }
      return tau;
    }

    plantDerivative(state, tau, externalForces) {
      const q = state.subarray(0, this.n);
      const dq = state.subarray(this.n);
      const qdd = forwardDynamics(this.model, q, dq, tau, externalForces);
      const derivative = zeros(2 * this.n);
      derivative.set(dq, 0);
      derivative.set(qdd, this.n);
      return derivative;
    }

    integratePlant(tau, externalForces) {
      const state = zeros(2 * this.n);
      state.set(this.q, 0);
      state.set(this.dq, this.n);
      const k1 = this.plantDerivative(state, tau, externalForces);
      const s2 = state.map((value, index) => value + 0.5 * PLANT_DT * k1[index]);
      const k2 = this.plantDerivative(s2, tau, externalForces);
      const s3 = state.map((value, index) => value + 0.5 * PLANT_DT * k2[index]);
      const k3 = this.plantDerivative(s3, tau, externalForces);
      const s4 = state.map((value, index) => value + PLANT_DT * k3[index]);
      const k4 = this.plantDerivative(s4, tau, externalForces);
      for (let index = 0; index < state.length; index += 1) {
        state[index] += (PLANT_DT / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]);
      }
      this.q.set(state.subarray(0, this.n));
      this.dq.set(state.subarray(this.n));
      for (let body = 0; body < this.n; body += 1) {
        if (this.model.jointTypes[body] === 2) this.dq[body] = 0;
        if (!Number.isFinite(this.q[body]) || !Number.isFinite(this.dq[body]) || Math.abs(this.q[body]) > 1e6 || Math.abs(this.dq[body]) > 1e6) {
          throw new Error("The selected gains made the simulation numerically unstable.");
        }
      }
    }

    updateMeasurements() {
      for (let body = 0; body < this.n; body += 1) {
        if (this.model.jointTypes[body] === 2) continue;
        const encoderEnabled = this.model.jointTypes[body] === 0;
        const measured = encoderEnabled
          ? Math.round(this.q[body] / (TWO_PI / ENCODER_COUNTS)) * (TWO_PI / ENCODER_COUNTS)
          : this.q[body];
        const previous = this.encoderQ[body];
        this.previousEncoderQ[body] = previous;
        this.encoderQ[body] = measured;
        this.encoderDq[body] = (measured - previous) / PLANT_DT;
        const frequency = body < 6 ? 10 : 25;
        const damping = body < 6 ? 1 : 0.5;
        const omega = TWO_PI * frequency;
        const acceleration = (position, velocity) => omega * omega * (measured - position) - 2 * damping * omega * velocity;
        let position = this.estimatedQ[body];
        let velocity = this.estimatedDq[body];
        const k1Position = velocity;
        const k1Velocity = acceleration(position, velocity);
        const predictedPosition = position + PLANT_DT * k1Position;
        const predictedVelocity = velocity + PLANT_DT * k1Velocity;
        const k2Position = predictedVelocity;
        const k2Velocity = acceleration(predictedPosition, predictedVelocity);
        position += 0.5 * PLANT_DT * (k1Position + k2Position);
        velocity += 0.5 * PLANT_DT * (k1Velocity + k2Velocity);
        this.estimatedQ[body] = position;
        this.estimatedDq[body] = velocity;
        this.feedbackQ[body] = position;
        this.feedbackDq[body] = velocity;
      }
    }

    step() {
      const externalForces = this.externalForces();
      if (this.time + 1e-12 >= this.nextControllerTime) {
        this.updateController();
        this.nextControllerTime += CONTROLLER_DT;
      }
      const tau = this.updateActuators();
      this.integratePlant(tau, externalForces);
      this.updateMeasurements();
      this.time += PLANT_DT;
    }

    recordedState() {
      return [
        this.q[2], this.q[1], this.q[0],
        this.dq[2], this.dq[1], this.dq[0],
        this.q[5], this.q[4], this.q[3],
        this.dq[5], this.dq[4], this.dq[3],
      ];
    }
  }

  function metrics(states, stateStride, reference, secondaryReference, effort) {
    const count = reference.length;
    let primarySquaredError = 0;
    let secondarySquaredError = 0;
    let peakEffort = 0;
    for (let sample = 0; sample < count; sample += 1) {
      const zError = reference[sample] - states[sample * stateStride + 2];
      const yawError = wrapPi(secondaryReference[sample] - states[sample * stateStride + 8]);
      primarySquaredError += zError * zError;
      secondarySquaredError += yawError * yawError;
      peakEffort = Math.max(peakEffort, Math.abs(effort[sample]));
    }
    return {
      rmsError: Math.sqrt(primarySquaredError / count),
      metricUnit: "m",
      secondaryRms: Math.sqrt(secondarySquaredError / count) * 180 / PI,
      secondaryUnit: "deg",
      peakEffort,
      effortUnit: "N",
    };
  }

  function simulate(systemId, parameters, duration) {
    const model = MODELS[systemId];
    if (!model) throw new Error(`Unknown full-pose model: ${systemId}`);
    const initialPosition = [0, 0, 1];
    const simulation = new MultirotorSimulation(model, parameters, initialPosition);
    const count = Math.floor(duration * SAMPLE_RATE) + 1;
    const stateStride = 12;
    const time = new Float32Array(count);
    const states = new Float32Array(count * stateStride);
    const reference = new Float32Array(count);
    const secondaryReference = new Float32Array(count);
    const effort = new Float32Array(count);
    for (let sample = 0; sample < count; sample += 1) {
      const sampleTime = sample / SAMPLE_RATE;
      while (simulation.time < sampleTime - 0.5 * PLANT_DT) simulation.step();
      const recorded = simulation.recordedState();
      time[sample] = simulation.time;
      states.set(recorded, sample * stateStride);
      const desired = simulation.references(sampleTime);
      reference[sample] = desired.position[2];
      secondaryReference[sample] = desired.attitude[2];
      effort[sample] = simulation.lastTotalThrust;
    }
    return { time, states, reference, secondaryReference, effort, metrics: metrics(states, stateStride, reference, secondaryReference, effort) };
  }

  self.DynamicsForgeLevel4 = { simulate };
})();
