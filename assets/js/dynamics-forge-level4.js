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

  const clamp = (value, lower, upper) => Math.max(lower, Math.min(value, upper));
  const deg2rad = (value) => value * PI / 180;

  function integralContributionFromPercent(percent, stallInput) {
    return Math.abs(stallInput) * clamp(percent, -100, 100) / 100;
  }

  function integralLimitFromPercent(percent, stallInput) {
    return Math.abs(integralContributionFromPercent(clamp(percent, 0, 100), stallInput));
  }

  function initialIntegralFromPercent(percent, stallInput, integralLimit) {
    return clamp(integralContributionFromPercent(percent, stallInput), -integralLimit, integralLimit);
  }

  function finiteNumber(value, label) {
    if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
    return value;
  }

  function assertFiniteArray(values, label, magnitudeLimit = 1e6) {
    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];
      if (!Number.isFinite(value) || Math.abs(value) > magnitudeLimit) {
        throw new Error(`${label} became non-finite or exceeded its numerical safety limit.`);
      }
    }
  }

  function wrapPi(value) {
    return ((value + PI) % TWO_PI) - PI;
  }

  function sampleCubicTrajectory(time, totalTime, waypoints) {
    const segmentCount = Math.max(1, waypoints.length - 1);
    const segmentTime = totalTime / segmentCount;
    const localTime = clamp(time, 0, totalTime);
    if (localTime >= totalTime) return { position: waypoints[waypoints.length - 1], velocity: 0 };
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

  function sampleQuinticTrajectory(time, totalTime, waypoints) {
    const segmentCount = Math.max(1, waypoints.length - 1);
    const segmentTime = totalTime / segmentCount;
    const localTime = clamp(time, 0, totalTime);
    if (localTime >= totalTime) return { position: waypoints[waypoints.length - 1], velocity: 0 };
    const segment = Math.min(Math.floor(localTime / segmentTime), segmentCount - 1);
    const tau = (localTime - segment * segmentTime) / segmentTime;
    const blend = 10 * tau ** 3 - 15 * tau ** 4 + 6 * tau ** 5;
    const blendRate = (30 * tau ** 2 - 60 * tau ** 3 + 30 * tau ** 4) / segmentTime;
    const start = waypoints[segment];
    const delta = waypoints[segment + 1] - start;
    return { position: start + delta * blend, velocity: delta * blendRate };
  }

  function zeros(length) {
    return new Float64Array(length);
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
    assertFiniteArray(q, `${model.id} position state`);
    assertFiniteArray(dq, `${model.id} velocity state`);
    assertFiniteArray(tau, `${model.id} actuator effort`);
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
        if (!Number.isFinite(d) || Math.abs(d) < 1e-12) throw new Error("Near-zero or non-finite articulated inertia in the selected model.");
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
    assertFiniteArray(qdd, `${model.id} articulated-body acceleration`);
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
    const estimation = jointTypes.map((jointType, body) => ({
      encoderEnabled: jointType !== 2,
      estimationEnabled: jointType !== 2,
      countsPerRevolution: 4096,
      naturalFrequencyHz: body < 6 ? 10 : 25,
      dampingRatio: body < 6 ? 1 : 0.5,
    }));
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
      estimation,
      actuators: rotorFrames.map(() => ({
        maxEffort: ROTOR_EFFORT_LIMIT,
        maxPower: ROTOR_POWER_LIMIT,
        powerVelocityFloor: POWER_VELOCITY_FLOOR,
        viscousFriction: ROTOR_VISCOUS_FRICTION,
        coulombFriction: 0,
        timeConstant: MOTOR_TIME_CONSTANT,
      })),
    };
  }

  function configuredModel({ id, parents, jointTypes, dh, physical, rotorFrames, rotorDirections, estimation, actuators, passiveViscousFriction = [] }) {
    return {
      id,
      parents,
      jointTypes,
      dh,
      physical,
      spatialInertias: physical.map(spatialInertia),
      rotorFrames,
      rotorDirections,
      estimation,
      actuators,
      passiveViscousFriction,
      positiveRoll: new Set(), negativeRoll: new Set(),
      positivePitch: new Set(), negativePitch: new Set(),
      positiveYaw: new Set(), negativeYaw: new Set(),
    };
  }

  function rotorActuator(coulombFriction = 0) {
    return {
      maxEffort: ROTOR_EFFORT_LIMIT,
      maxPower: ROTOR_POWER_LIMIT,
      powerVelocityFloor: POWER_VELOCITY_FLOOR,
      viscousFriction: ROTOR_VISCOUS_FRICTION,
      coulombFriction,
      timeConstant: MOTOR_TIME_CONSTANT,
    };
  }

  const MODELS = {
    drone4: makeModel(
      "drone4",
      [[-0.707, 0.707], [-0.707, -0.707], [0.707, -0.707], [0.707, 0.707]],
      [1, -1, 1, -1],
      {
        positiveRoll: [8, 10], negativeRoll: [12, 14],
        positivePitch: [10, 12], negativePitch: [8, 14],
        positiveYaw: [10, 14], negativeYaw: [8, 12],
      },
    ),
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
    drone8: makeModel(
      "drone8",
      [[-0.383, 0.924], [-0.924, 0.383], [-0.924, -0.383], [-0.383, -0.924], [0.383, -0.924], [0.924, -0.383], [0.924, 0.383], [0.383, 0.924]],
      [1, -1, 1, -1, 1, -1, 1, -1],
      {
        positiveRoll: [8, 10, 12, 14], negativeRoll: [16, 18, 20, 22],
        positivePitch: [12, 14, 16, 18], negativePitch: [8, 10, 20, 22],
        positiveYaw: [10, 14, 18, 22], negativeYaw: [8, 12, 16, 20],
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
    copter1: configuredModel({
      id: "copter1",
      parents: [-1, 0],
      jointTypes: [0, 0],
      dh: [
        { alpha: 90, a: 0, theta: 0, d: 0, offset: 0 },
        { alpha: -90, a: 1, theta: 0, d: 0, offset: 0 },
      ],
      physical: [
        { cx: 0.5, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.01, mass: 1 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.00006, mass: 0 },
      ],
      rotorFrames: [1],
      rotorDirections: [1],
      estimation: [
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 25, dampingRatio: 0.5 },
      ],
      actuators: [rotorActuator(0.005)],
    }),
    copter2: configuredModel({
      id: "copter2",
      parents: [-1, 0, 0, 2, 2],
      jointTypes: [0, 2, 0, 0, 0],
      dh: [
        { alpha: 0, a: 0, theta: 0, d: 1, offset: 90 },
        { alpha: 90, a: 0, theta: 0, d: -1.5, offset: 0 },
        { alpha: 90, a: 0, theta: 0, d: 1.5, offset: 0 },
        { alpha: -90, a: 0.5, theta: 0, d: 0, offset: -90 },
        { alpha: -90, a: -0.5, theta: 0, d: 0, offset: -90 },
      ],
      physical: [
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.01, mass: 0 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0, mass: 0.1 },
        { cx: 0, cy: 0, cz: 0, ix: 0.02, iy: 0.02, iz: 0.02, mass: 1.5 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.00006, mass: 0.1 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.00006, mass: 0.1 },
      ],
      rotorFrames: [3, 4],
      rotorDirections: [1, -1],
      estimation: [
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 2048, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: false, estimationEnabled: false, countsPerRevolution: 2048, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 2048, naturalFrequencyHz: 2, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 2048, naturalFrequencyHz: 25, dampingRatio: 0.5 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 2048, naturalFrequencyHz: 25, dampingRatio: 0.5 },
      ],
      actuators: [rotorActuator(), rotorActuator()],
    }),
    copter3: configuredModel({
      id: "copter3",
      parents: [-1, 0, 1, 1, 3, 3],
      jointTypes: [0, 0, 2, 0, 0, 0],
      dh: [
        { alpha: 0, a: 0, theta: 10, d: 1, offset: 0 },
        { alpha: 90, a: 0, theta: -10, d: 0, offset: 90 },
        { alpha: 90, a: 0, theta: 0, d: -1.3, offset: 0 },
        { alpha: 90, a: 0, theta: 20, d: 1.5, offset: -90 },
        { alpha: -90, a: 0.5, theta: 0, d: 0, offset: -90 },
        { alpha: -90, a: -0.5, theta: 0, d: 0, offset: -90 },
      ],
      physical: [
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.01, mass: 0 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.01, mass: 0 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0, mass: 0.1 },
        { cx: 0, cy: 0, cz: 0, ix: 0.02, iy: 0.02, iz: 0.02, mass: 1.5 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.00006, mass: 0.1 },
        { cx: 0, cy: 0, cz: 0, ix: 0, iy: 0, iz: 0.00006, mass: 0.1 },
      ],
      rotorFrames: [4, 5],
      rotorDirections: [1, -1],
      estimation: [
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: false, estimationEnabled: false, countsPerRevolution: 1024, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 10, dampingRatio: 1 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 25, dampingRatio: 0.5 },
        { encoderEnabled: true, estimationEnabled: true, countsPerRevolution: 1024, naturalFrequencyHz: 25, dampingRatio: 0.5 },
      ],
      actuators: [rotorActuator(), rotorActuator()],
      passiveViscousFriction: [0.1, 0.1, 0, 0.1, 0, 0],
    }),
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

  class ArticulatedSimulation {
    constructor(model, parameters, initialQ) {
      this.model = model;
      this.parameters = parameters;
      this.n = model.parents.length;
      if (initialQ.length !== this.n) throw new Error(`Initial state does not match ${model.id}.`);
      this.q = Float64Array.from(initialQ);
      this.dq = zeros(this.n);
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
      this.lastTotalThrust = 0;
      this.lastActuatorEffort = 0;
    }

    externalForcesForState(state) {
      const forces = Array.from({ length: this.n }, () => zeros(6));
      const dq = state.subarray(this.n);
      let totalThrust = 0;
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const velocity = dq[frame];
        const thrust = THRUST_COEFFICIENT * velocity * velocity;
        const drag = -DRAG_COEFFICIENT * velocity * Math.abs(velocity);
        finiteNumber(thrust, `${this.model.id} rotor thrust`);
        finiteNumber(drag, `${this.model.id} rotor drag`);
        forces[frame][5] += thrust;
        forces[frame][2] += drag;
        totalThrust += thrust;
      }
      finiteNumber(totalThrust, `${this.model.id} total thrust`);
      this.lastTotalThrust = totalThrust;
      return forces;
    }

    updateActuators() {
      assertFiniteArray(this.desiredEffort, `${this.model.id} desired motor effort`, 1e3);
      const tau = zeros(this.n);
      let peak = 0;
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const actuator = this.model.actuators[rotor];
        const timeConstant = Math.max(0, actuator.timeConstant);
        this.motorEffort[rotor] = timeConstant > 0
          ? this.motorEffort[rotor] + PLANT_DT * (this.desiredEffort[rotor] - this.motorEffort[rotor]) / timeConstant
          : this.desiredEffort[rotor];
        const velocity = this.dq[frame];
        const powerLimit = actuator.maxPower / Math.max(Math.abs(velocity), actuator.powerVelocityFloor);
        const activeLimit = Math.min(actuator.maxEffort, powerLimit);
        this.appliedEffort[rotor] = clamp(this.motorEffort[rotor], -activeLimit, activeLimit);
        const coulomb = actuator.coulombFriction * Math.tanh(velocity / 0.001);
        tau[frame] = this.appliedEffort[rotor] - actuator.viscousFriction * velocity - coulomb;
        peak = Math.max(peak, Math.abs(this.appliedEffort[rotor]));
      }
      for (let body = 0; body < this.n; body += 1) {
        tau[body] -= (this.model.passiveViscousFriction?.[body] || 0) * this.dq[body];
      }
      this.lastActuatorEffort = peak;
      assertFiniteArray(tau, `${this.model.id} applied joint effort`, 1e3);
      return tau;
    }

    plantDerivative(state, tau) {
      assertFiniteArray(state, `${this.model.id} RK4 state`);
      const q = state.subarray(0, this.n);
      const dq = state.subarray(this.n);
      const qdd = forwardDynamics(this.model, q, dq, tau, this.externalForcesForState(state));
      const derivative = zeros(2 * this.n);
      derivative.set(dq, 0);
      derivative.set(qdd, this.n);
      assertFiniteArray(derivative, `${this.model.id} RK4 derivative`);
      return derivative;
    }

    integratePlant(tau) {
      const state = zeros(2 * this.n);
      state.set(this.q, 0);
      state.set(this.dq, this.n);
      const k1 = this.plantDerivative(state, tau);
      const s2 = state.map((value, index) => value + 0.5 * PLANT_DT * k1[index]);
      const k2 = this.plantDerivative(s2, tau);
      const s3 = state.map((value, index) => value + 0.5 * PLANT_DT * k2[index]);
      const k3 = this.plantDerivative(s3, tau);
      const s4 = state.map((value, index) => value + PLANT_DT * k3[index]);
      const k4 = this.plantDerivative(s4, tau);
      for (let index = 0; index < state.length; index += 1) {
        state[index] += (PLANT_DT / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]);
      }
      assertFiniteArray(state, `${this.model.id} integrated state`);
      this.q.set(state.subarray(0, this.n));
      this.dq.set(state.subarray(this.n));
      for (let body = 0; body < this.n; body += 1) {
        if (this.model.jointTypes[body] === 2) {
          this.q[body] = 0;
          this.dq[body] = 0;
        }
      }
    }

    updateMeasurements() {
      for (let body = 0; body < this.n; body += 1) {
        if (this.model.jointTypes[body] === 2) continue;
        const estimation = this.model.estimation[body];
        const encoderEnabled = Boolean(estimation.encoderEnabled);
        const encoderStep = TWO_PI / Math.max(1, estimation.countsPerRevolution);
        const measured = encoderEnabled && this.model.jointTypes[body] === 0
          ? Math.round(this.q[body] / encoderStep) * encoderStep
          : this.q[body];
        const previous = this.encoderQ[body];
        this.previousEncoderQ[body] = previous;
        this.encoderQ[body] = measured;
        this.encoderDq[body] = (measured - previous) / PLANT_DT;
        if (!estimation.estimationEnabled || estimation.naturalFrequencyHz <= 0) {
          this.estimatedQ[body] = measured;
          this.estimatedDq[body] = encoderEnabled ? this.encoderDq[body] : this.dq[body];
        } else {
          const omega = TWO_PI * estimation.naturalFrequencyHz;
          const acceleration = (position, velocity) => omega * omega * (measured - position) - 2 * estimation.dampingRatio * omega * velocity;
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
        }
        this.feedbackQ[body] = estimation.estimationEnabled ? this.estimatedQ[body] : (encoderEnabled ? this.encoderQ[body] : this.q[body]);
        this.feedbackDq[body] = estimation.estimationEnabled ? this.estimatedDq[body] : (encoderEnabled ? this.encoderDq[body] : this.dq[body]);
      }
      assertFiniteArray(this.feedbackQ, `${this.model.id} estimated position`);
      assertFiniteArray(this.feedbackDq, `${this.model.id} estimated velocity`);
    }

    step() {
      if (this.time + 1e-12 >= this.nextControllerTime) {
        this.updateController();
        this.nextControllerTime += CONTROLLER_DT;
      }
      const tau = this.updateActuators();
      this.integratePlant(tau);
      this.updateMeasurements();
      this.time += PLANT_DT;
      finiteNumber(this.time, `${this.model.id} simulation time`);
    }
  }

  class MultirotorSimulation extends ArticulatedSimulation {
    constructor(model, parameters, initialPosition) {
      const initialQ = zeros(model.parents.length);
      initialQ[0] = initialPosition[2];
      initialQ[1] = initialPosition[1];
      initialQ[2] = initialPosition[0];
      super(model, parameters, initialQ);
      this.initialPosition = initialPosition.slice();
      this.positionIntegralMax = integralLimitFromPercent(parameters.positionIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.attitudeIntegralMax = integralLimitFromPercent(parameters.attitudeIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      const pInitial = initialIntegralFromPercent(parameters.positionIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.positionIntegralMax);
      const aInitial = initialIntegralFromPercent(parameters.attitudeIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.attitudeIntegralMax);
      this.integrals = {
        z: new TrapezoidalIntegral(pInitial), x: new TrapezoidalIntegral(pInitial), y: new TrapezoidalIntegral(pInitial),
        roll: new TrapezoidalIntegral(aInitial), pitch: new TrapezoidalIntegral(aInitial), yaw: new TrapezoidalIntegral(aInitial),
      };
      this.metricConfig = { primaryIndex: 2, secondaryIndex: 8, secondaryAngular: true, primaryUnit: "m", secondaryUnit: "deg", secondaryScale: 180 / PI, effortUnit: "N" };
    }

    references(time) {
      const position = time < 0.75 ? this.initialPosition : [this.parameters.targetX, this.parameters.targetY, this.parameters.targetZ];
      const attitude = time < 1 ? [0, 0, 0] : [0, 0, deg2rad(this.parameters.targetYaw)];
      return { position, attitude };
    }

    pid(axis, positionError, velocityError, group) {
      const kp = group === "position" ? this.parameters.positionKp : this.parameters.attitudeKp;
      const kd = group === "position" ? this.parameters.positionKd : this.parameters.attitudeKd;
      const ki = group === "position" ? this.parameters.positionKi : this.parameters.attitudeKi;
      const integralMax = group === "position" ? this.positionIntegralMax : this.attitudeIntegralMax;
      const integral = this.integrals[axis].update(ki * positionError, CONTROLLER_DT, integralMax);
      return kp * positionError + kd * velocityError + integral;
    }

    updateController() {
      const desired = this.references(this.time);
      const q = this.feedbackQ;
      const dq = this.feedbackDq;
      const collective = Math.max(0, 0.25 + this.pid("z", desired.position[2] - q[0], -dq[0], "position"));
      const pitchReference = desired.attitude[1] + this.pid("x", desired.position[0] - q[2], -dq[2], "position");
      const rollReference = desired.attitude[0] - this.pid("y", desired.position[1] - q[1], -dq[1], "position");
      const rollMix = this.pid("roll", wrapPi(rollReference - q[5]), -dq[5], "attitude");
      const pitchMix = this.pid("pitch", wrapPi(pitchReference - q[4]), -dq[4], "attitude");
      const yawMix = this.pid("yaw", wrapPi(desired.attitude[2] - q[3]), -dq[3], "attitude");
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const rollCoefficient = this.model.positiveRoll.has(frame) ? 1 : (this.model.negativeRoll.has(frame) ? -1 : 0);
        const pitchCoefficient = this.model.positivePitch.has(frame) ? 1 : (this.model.negativePitch.has(frame) ? -1 : 0);
        const yawCoefficient = this.model.positiveYaw.has(frame) ? 1 : (this.model.negativeYaw.has(frame) ? -1 : 0);
        const magnitude = clamp(collective + rollMix * rollCoefficient + pitchMix * pitchCoefficient + yawMix * yawCoefficient, 0, ROTOR_EFFORT_LIMIT);
        this.desiredEffort[rotor] = this.model.rotorDirections[rotor] * magnitude;
      }
    }

    recordedState() {
      return [this.q[2], this.q[1], this.q[0], this.dq[2], this.dq[1], this.dq[0], this.q[5], this.q[4], this.q[3], this.dq[5], this.dq[4], this.dq[3]];
    }

    recordingReference(time) {
      const desired = this.references(time);
      return { primary: desired.position[2], secondary: desired.attitude[2], effort: this.lastTotalThrust };
    }
  }

  class Drone4Simulation extends ArticulatedSimulation {
    constructor(model, parameters) {
      const initialQ = zeros(model.parents.length);
      initialQ[0] = 0.3;
      super(model, parameters, initialQ);
      this.zIntegralMax = integralLimitFromPercent(parameters.zIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.yawIntegralMax = integralLimitFromPercent(parameters.yawIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.zIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.zIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.zIntegralMax));
      this.yawIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.yawIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.yawIntegralMax));
      this.metricConfig = { primaryIndex: 0, secondaryIndex: 3, secondaryAngular: true, primaryUnit: "m", secondaryUnit: "deg", secondaryScale: 180 / PI, effortUnit: "N" };
    }

    references(time) {
      return { z: time < 0.75 ? 0.3 : this.parameters.zTarget, yaw: time < 1 ? 0 : deg2rad(this.parameters.yawTarget) };
    }

    updateController() {
      const desired = this.references(this.time);
      const zError = desired.z - this.feedbackQ[0];
      const yawError = wrapPi(desired.yaw - this.feedbackQ[3]);
      const zIntegral = this.zIntegral.update(this.parameters.zKi * zError, CONTROLLER_DT, this.zIntegralMax);
      const yawIntegral = this.yawIntegral.update(this.parameters.yawKi * yawError, CONTROLLER_DT, this.yawIntegralMax);
      const collective = Math.max(0, this.parameters.zKp * zError - this.parameters.zKd * this.feedbackDq[0] + zIntegral);
      const yawMix = this.parameters.yawKp * yawError - this.parameters.yawKd * this.feedbackDq[3] + yawIntegral;
      for (let rotor = 0; rotor < this.model.rotorFrames.length; rotor += 1) {
        const frame = this.model.rotorFrames[rotor];
        const yawCoefficient = this.model.positiveYaw.has(frame) ? 1 : (this.model.negativeYaw.has(frame) ? -1 : 0);
        const magnitude = clamp(collective + yawMix * yawCoefficient, 0, ROTOR_EFFORT_LIMIT);
        this.desiredEffort[rotor] = this.model.rotorDirections[rotor] * magnitude;
      }
    }

    recordedState() {
      return [this.q[0], this.dq[0], this.zIntegral.value, this.q[3], this.dq[3], this.yawIntegral.value];
    }

    recordingReference(time) {
      const desired = this.references(time);
      return { primary: desired.z, secondary: desired.yaw, effort: this.lastTotalThrust };
    }
  }

  class Copter1Simulation extends ArticulatedSimulation {
    constructor(model, parameters) {
      super(model, parameters, zeros(model.parents.length));
      this.integralMax = integralLimitFromPercent(parameters.integralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.integral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.integralInitialPercent, ROTOR_EFFORT_LIMIT, this.integralMax));
      this.metricConfig = { primaryIndex: 0, primaryAngular: true, primaryUnit: "rad", effortUnit: "N·m" };
    }

    reference(time) {
      return sampleCubicTrajectory(time, 10, [0, 0.5, -0.5, -1.57]);
    }

    updateController() {
      const desired = this.reference(this.time);
      const error = desired.position - this.feedbackQ[0];
      const velocityError = desired.velocity - this.feedbackDq[0];
      const integral = this.integral.update(this.parameters.ki * error, CONTROLLER_DT, this.integralMax);
      const command = Math.max(0, this.parameters.kp * error + this.parameters.kd * velocityError + integral);
      this.desiredEffort[0] = clamp(command, 0, ROTOR_EFFORT_LIMIT);
    }

    recordedState() {
      return [this.q[0], this.dq[0], this.integral.value];
    }

    recordingReference(time) {
      return { primary: this.reference(time).position, secondary: null, effort: this.lastActuatorEffort };
    }
  }

  class Copter2Simulation extends ArticulatedSimulation {
    constructor(model, parameters) {
      super(model, parameters, zeros(model.parents.length));
      this.yawIntegralMax = integralLimitFromPercent(parameters.yawIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.rollIntegralMax = integralLimitFromPercent(parameters.rollIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.yawIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.yawIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.yawIntegralMax));
      this.rollIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.rollIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.rollIntegralMax));
      this.lastRollReference = 0;
      this.metricConfig = { primaryIndex: 0, secondaryIndex: 1, primaryAngular: true, secondaryAngular: true, primaryUnit: "deg", secondaryUnit: "deg", primaryScale: 180 / PI, secondaryScale: 180 / PI, effortUnit: "N·m" };
    }

    yawReference(time) {
      return sampleCubicTrajectory(time, 10, [0, PI / 2, 3 * PI / 2, 0, 0]);
    }

    updateController() {
      const desired = this.yawReference(this.time);
      const yawError = desired.position - this.feedbackQ[0];
      const yawVelocityError = desired.velocity - this.feedbackDq[0];
      const yawDrive = this.parameters.yawIntegralGain * (this.parameters.yawIntegralPositionWeight * yawError + this.parameters.yawIntegralVelocityWeight * yawVelocityError);
      const yawIntegral = this.yawIntegral.update(yawDrive, CONTROLLER_DT, this.yawIntegralMax);
      const collective = this.parameters.yawKp * yawError + this.parameters.yawKd * yawVelocityError + yawIntegral;
      this.lastRollReference = clamp(-collective, this.parameters.rollReferenceMin, this.parameters.rollReferenceMax);
      const rollError = this.lastRollReference - this.feedbackQ[2];
      const rollVelocityError = -this.feedbackDq[2];
      const rollDrive = this.parameters.rollIntegralGain * (this.parameters.rollIntegralPositionWeight * rollError + this.parameters.rollIntegralVelocityWeight * rollVelocityError);
      const rollIntegral = this.rollIntegral.update(rollDrive, CONTROLLER_DT, this.rollIntegralMax);
      const differential = this.parameters.rollKp * rollError + this.parameters.rollKd * rollVelocityError + rollIntegral;
      const leftMagnitude = clamp(Math.abs(0.9 * collective) + differential, 0, ROTOR_EFFORT_LIMIT);
      const rightMagnitude = clamp(Math.abs(0.9 * collective) - differential, 0, ROTOR_EFFORT_LIMIT);
      this.desiredEffort[0] = this.model.rotorDirections[0] * leftMagnitude;
      this.desiredEffort[1] = this.model.rotorDirections[1] * rightMagnitude;
    }

    recordedState() {
      return [this.q[0], this.q[2], this.q[3], this.q[4], this.dq[0], this.dq[2], this.dq[3], this.dq[4]];
    }

    recordingReference(time) {
      return { primary: this.yawReference(time).position, secondary: this.lastRollReference, effort: this.lastActuatorEffort };
    }
  }

  class Copter3Simulation extends ArticulatedSimulation {
    constructor(model, parameters) {
      const initialQ = zeros(model.parents.length);
      initialQ[0] = deg2rad(10);
      initialQ[1] = deg2rad(-10);
      initialQ[3] = deg2rad(20);
      super(model, parameters, initialQ);
      this.yawIntegralMax = integralLimitFromPercent(parameters.yawIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.pitchIntegralMax = integralLimitFromPercent(parameters.pitchIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.rollIntegralMax = integralLimitFromPercent(parameters.rollIntegralMaxPercent, ROTOR_EFFORT_LIMIT);
      this.yawIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.yawIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.yawIntegralMax));
      this.pitchIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.pitchIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.pitchIntegralMax));
      this.rollIntegral = new TrapezoidalIntegral(initialIntegralFromPercent(parameters.rollIntegralInitialPercent, ROTOR_EFFORT_LIMIT, this.rollIntegralMax));
      this.metricConfig = { primaryIndex: 0, secondaryIndex: 1, primaryAngular: true, secondaryAngular: true, primaryUnit: "deg", secondaryUnit: "deg", primaryScale: 180 / PI, secondaryScale: 180 / PI, effortUnit: "N·m" };
    }

    references(time) {
      return {
        yaw: sampleQuinticTrajectory(time, 10, [0, -10, -25, -35, -50, -50].map(deg2rad)),
        pitch: sampleQuinticTrajectory(time, 10, [0, 0, 10, 10, 0, 0].map(deg2rad)),
      };
    }

    updateController() {
      const desired = this.references(this.time);
      const yawError = desired.yaw.position - this.feedbackQ[0];
      const yawVelocityError = desired.yaw.velocity - this.feedbackDq[0];
      const pitchError = desired.pitch.position - this.feedbackQ[1];
      const pitchVelocityError = desired.pitch.velocity - this.feedbackDq[1];
      const rollError = -this.feedbackQ[3];
      const rollVelocityError = -this.feedbackDq[3];
      const yawIntegral = this.yawIntegral.update(this.parameters.yawKi * yawError, CONTROLLER_DT, this.yawIntegralMax);
      const pitchDrive = this.parameters.pitchIntegralGain
        * (this.parameters.pitchIntegralPositionWeight * pitchError + this.parameters.pitchIntegralVelocityWeight * pitchVelocityError);
      const pitchIntegral = this.pitchIntegral.update(pitchDrive, CONTROLLER_DT, this.pitchIntegralMax);
      const rollIntegral = this.rollIntegral.update(this.parameters.rollKi * rollError, CONTROLLER_DT, this.rollIntegralMax);
      const pitchCommand = this.parameters.pitchKp * pitchError + this.parameters.pitchKd * pitchVelocityError + pitchIntegral;
      const rollCommand = this.parameters.rollKp * rollError + this.parameters.rollKd * rollVelocityError + rollIntegral;
      const yawCommand = this.parameters.yawKp * yawError + this.parameters.yawKd * yawVelocityError + yawIntegral;
      const differential = yawCommand + rollCommand;
      const leftMagnitude = clamp(pitchCommand + differential, 0, ROTOR_EFFORT_LIMIT);
      const rightMagnitude = clamp(pitchCommand - differential, 0, ROTOR_EFFORT_LIMIT);
      this.desiredEffort[0] = this.model.rotorDirections[0] * leftMagnitude;
      this.desiredEffort[1] = this.model.rotorDirections[1] * rightMagnitude;
    }

    recordedState() {
      return [this.q[0], this.q[1], this.q[3], this.q[4], this.q[5], this.dq[0], this.dq[1], this.dq[3], this.dq[4], this.dq[5]];
    }

    recordingReference(time) {
      const desired = this.references(time);
      return { primary: desired.yaw.position, secondary: desired.pitch.position, effort: this.lastActuatorEffort };
    }
  }

  function calculateMetrics(states, stateStride, reference, secondaryReference, effort, config) {
    const count = reference.length;
    let primarySquaredError = 0;
    let secondarySquaredError = 0;
    let secondaryCount = 0;
    let peakEffort = 0;
    for (let sample = 0; sample < count; sample += 1) {
      const primaryActual = states[sample * stateStride + config.primaryIndex];
      const primaryRawError = reference[sample] - primaryActual;
      const primaryError = config.primaryAngular ? wrapPi(primaryRawError) : primaryRawError;
      primarySquaredError += primaryError * primaryError;
      if (Number.isInteger(config.secondaryIndex) && Number.isFinite(secondaryReference[sample])) {
        const secondaryActual = states[sample * stateStride + config.secondaryIndex];
        const secondaryRawError = secondaryReference[sample] - secondaryActual;
        const secondaryError = config.secondaryAngular ? wrapPi(secondaryRawError) : secondaryRawError;
        secondarySquaredError += secondaryError * secondaryError;
        secondaryCount += 1;
      }
      peakEffort = Math.max(peakEffort, Math.abs(effort[sample]));
    }
    const output = {
      rmsError: Math.sqrt(primarySquaredError / count) * (config.primaryScale || 1),
      metricUnit: config.primaryUnit,
      secondaryRms: secondaryCount ? Math.sqrt(secondarySquaredError / secondaryCount) * (config.secondaryScale || 1) : null,
      secondaryUnit: config.secondaryUnit || "",
      peakEffort,
      effortUnit: config.effortUnit,
    };
    assertFiniteArray([output.rmsError, output.peakEffort], "Simulation metrics", 1e9);
    if (output.secondaryRms !== null) finiteNumber(output.secondaryRms, "Secondary RMS metric");
    return output;
  }

  function simulate(systemId, parameters, duration) {
    const model = MODELS[systemId];
    if (!model) throw new Error(`Unknown articulated model: ${systemId}`);
    finiteNumber(duration, "Simulation duration");
    if (duration <= 0 || duration > 30) throw new Error("Simulation duration must be greater than 0 and no more than 30 seconds.");
    if (!parameters || typeof parameters !== "object") throw new Error("Simulation parameters are required.");
    for (const [key, value] of Object.entries(parameters)) finiteNumber(value, `Parameter ${key}`);
    let simulation;
    if (systemId === "drone4") simulation = new Drone4Simulation(model, parameters);
    else if (systemId === "copter1") simulation = new Copter1Simulation(model, parameters);
    else if (systemId === "copter2") simulation = new Copter2Simulation(model, parameters);
    else if (systemId === "copter3") simulation = new Copter3Simulation(model, parameters);
    else simulation = new MultirotorSimulation(model, parameters, [0, 0, 1]);
    const count = Math.floor(duration * SAMPLE_RATE) + 1;
    const stateStride = simulation.recordedState().length;
    const time = new Float32Array(count);
    const states = new Float32Array(count * stateStride);
    const reference = new Float32Array(count);
    const secondaryReference = new Float32Array(count);
    secondaryReference.fill(Number.NaN);
    const effort = new Float32Array(count);
    for (let sample = 0; sample < count; sample += 1) {
      const sampleTime = sample / SAMPLE_RATE;
      while (simulation.time < sampleTime - 0.5 * PLANT_DT) simulation.step();
      const recorded = simulation.recordedState();
      assertFiniteArray(recorded, `${systemId} recorded state`);
      const desired = simulation.recordingReference(sampleTime);
      finiteNumber(desired.primary, `${systemId} primary reference`);
      finiteNumber(desired.effort, `${systemId} recorded effort`);
      if (desired.secondary !== null) finiteNumber(desired.secondary, `${systemId} secondary reference`);
      time[sample] = sampleTime;
      states.set(recorded, sample * stateStride);
      reference[sample] = desired.primary;
      if (desired.secondary !== null) secondaryReference[sample] = desired.secondary;
      effort[sample] = desired.effort;
    }
    assertFiniteArray(states, `${systemId} output state`);
    assertFiniteArray(reference, `${systemId} output reference`);
    assertFiniteArray(effort, `${systemId} output effort`, 1e9);
    return {
      time,
      states,
      reference,
      secondaryReference,
      effort,
      metrics: calculateMetrics(states, stateStride, reference, secondaryReference, effort, simulation.metricConfig),
    };
  }

  self.DynamicsForgeLevel4 = { simulate };
})();
