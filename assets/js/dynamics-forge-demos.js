(() => {
  const root = document.getElementById("dynamics-forge-demos");
  if (!root) return;
  const tr = (source) => window.PortfolioI18n?.t(source) || source;

  const ui = {
    canvas: document.getElementById("forge-canvas"),
    plot: document.getElementById("forge-plot"),
    positionPlot: document.getElementById("forge-position-plot"),
    positionPlotWrap: document.getElementById("forge-position-plot-wrap"),
    tabs: document.getElementById("forge-demo-tabs"),
    title: document.getElementById("forge-demo-title"),
    category: document.getElementById("forge-demo-category"),
    description: document.getElementById("forge-demo-description"),
    controller: document.getElementById("forge-controller-name"),
    gains: document.getElementById("forge-gain-grid"),
    run: document.getElementById("forge-run"),
    resetGains: document.getElementById("forge-reset-gains"),
    status: document.getElementById("forge-demo-status"),
    rms: document.getElementById("forge-rms"),
    rmsLabel: document.getElementById("forge-rms-label"),
    secondaryRms: document.getElementById("forge-secondary-rms"),
    secondaryRmsLabel: document.getElementById("forge-secondary-rms-label"),
    secondaryResult: document.getElementById("forge-secondary-result"),
    results: document.querySelector(".forge-results"),
    peak: document.getElementById("forge-peak"),
    play: document.getElementById("forge-play"),
    restart: document.getElementById("forge-restart"),
    cameraReset: document.getElementById("forge-camera-reset"),
    zoomIn: document.getElementById("forge-zoom-in"),
    zoomOut: document.getElementById("forge-zoom-out"),
    speed: document.getElementById("forge-speed"),
    view: document.getElementById("forge-view"),
    timeline: document.getElementById("forge-timeline"),
    time: document.getElementById("forge-time"),
    showCad: document.getElementById("forge-show-cad"),
    showLinks: document.getElementById("forge-show-links"),
    showFrames: document.getElementById("forge-show-frames"),
    showNumbers: document.getElementById("forge-show-numbers"),
    showCom: document.getElementById("forge-show-com"),
  };
  if (!ui.canvas || !ui.tabs || !ui.gains || !ui.run) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const state = {
    systems: [],
    activeIndex: 0,
    result: null,
    worker: null,
    requestId: 0,
    running: false,
    visible: false,
    playing: false,
    userPaused: reducedMotion,
    playback: 0,
    lastTimestamp: null,
    animationHandle: null,
    drag: null,
    camera: { yaw: -0.7, pitch: 0.4, zoom: 0.9, panX: 0, panY: 0 },
    meshes: new Map(),
    trail: [],
    parametersDirty: false,
    pendingParameters: null,
    appliedParameters: null,
  };

  const primitives = new Map();
  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function matIdentity() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function matMultiply(a, b) {
    const output = new Array(16).fill(0);
    for (let row = 0; row < 4; row += 1) {
      for (let column = 0; column < 4; column += 1) {
        for (let inner = 0; inner < 4; inner += 1) output[row * 4 + column] += a[row * 4 + inner] * b[inner * 4 + column];
      }
    }
    return output;
  }

  function translate(x, y, z) {
    return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
  }

  function scaleMatrix(x, y = x, z = x) {
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  }

  function rotX(angle) {
    const c = Math.cos(angle); const s = Math.sin(angle);
    return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1];
  }

  function rotY(angle) {
    const c = Math.cos(angle); const s = Math.sin(angle);
    return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1];
  }

  function rotZ(angle) {
    const c = Math.cos(angle); const s = Math.sin(angle);
    return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  }

  function modifiedDh(alpha, a, theta, d) {
    return matMultiply(matMultiply(matMultiply(rotX(alpha), translate(a, 0, 0)), rotZ(theta)), translate(0, 0, d));
  }

  function transformPoint(matrix, point) {
    return [
      matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
      matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
      matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
    ];
  }

  function matrixPoint(matrix) {
    return [matrix[3], matrix[7], matrix[11]];
  }

  function createBox() {
    const vertices = [
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
    ];
    return [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]].map((face) => face.map((index) => vertices[index]));
  }

  function createCylinder(segments = 18) {
    const triangles = [];
    for (let index = 0; index < segments; index += 1) {
      const a = (index / segments) * Math.PI * 2;
      const b = ((index + 1) / segments) * Math.PI * 2;
      const p0 = [0.5 * Math.cos(a), 0.5 * Math.sin(a), -0.5];
      const p1 = [0.5 * Math.cos(b), 0.5 * Math.sin(b), -0.5];
      const p2 = [0.5 * Math.cos(b), 0.5 * Math.sin(b), 0.5];
      const p3 = [0.5 * Math.cos(a), 0.5 * Math.sin(a), 0.5];
      triangles.push([p0, p1, p2], [p0, p2, p3], [[0, 0, -0.5], p1, p0], [[0, 0, 0.5], p3, p2]);
    }
    return triangles;
  }

  primitives.set("box", createBox());
  primitives.set("cylinder", createCylinder());

  function sceneFor(system, result, sampleIndex) {
    const frames = [];
    const links = [];
    const meshes = [];
    const centersOfMass = [];
    let focus = [0, 0, 0];

    if (system.id === "two_link") {
      const q1 = result.states[sampleIndex * 4] || 0;
      const q2 = result.states[sampleIndex * 4 + 1] || 0;
      const base = matIdentity();
      const joint1 = matMultiply(base, modifiedDh(0, 0, q1, 0));
      const joint2 = matMultiply(joint1, modifiedDh(0, 0.296, q2, 0.05));
      const tip = matMultiply(joint2, translate(0.2, 0, 0));
      meshes.push({ key: "forearm", transform: joint1, color: "#8b5cf6" });
      meshes.push({ key: "link", transform: joint2, color: "#22d3ee" });
      links.push({ a: matrixPoint(joint1), b: matrixPoint(joint2), actuated: true }, { a: matrixPoint(joint2), b: matrixPoint(tip), actuated: true });
      frames.push({ label: "0", transform: base }, { label: "1", transform: joint1 }, { label: "2", transform: joint2 }, { label: "EE", transform: tip });
      centersOfMass.push(
        { label: "1", point: transformPoint(joint1, [0.15, 0, 0.025]) },
        { label: "2", point: transformPoint(joint2, [0.1, 0, 0.025]) },
      );
      focus = matrixPoint(tip);
    } else if (system.id === "drone4") {
      const offset = sampleIndex * 6;
      const z = result.states[offset] || 0;
      const yaw = result.states[offset + 3] || 0;
      const time = result.time[sampleIndex] || 0;
      const body = matMultiply(translate(0, 0, z), rotZ(yaw));
      const hubs = [[-0.5, 0.5, 1, "prop_ccw", "8"], [-0.5, -0.5, -1, "prop_cw", "10"], [0.5, -0.5, 1, "prop_ccw", "12"], [0.5, 0.5, -1, "prop_cw", "14"]];
      meshes.push({ key: "box", transform: matMultiply(body, scaleMatrix(0.28, 0.2, 0.12)), color: "#64748b" });
      meshes.push({ key: "box", transform: matMultiply(body, matMultiply(rotZ(Math.PI / 4), scaleMatrix(1.42, 0.07, 0.06))), color: "#94a3b8" });
      meshes.push({ key: "box", transform: matMultiply(body, matMultiply(rotZ(-Math.PI / 4), scaleMatrix(1.42, 0.07, 0.06))), color: "#94a3b8" });
      const center = matrixPoint(body);
      for (const [x, y, direction, meshKey, label] of hubs) {
        const hub = matMultiply(body, translate(x, y, 0));
        const rotorFrame = matMultiply(hub, rotZ(direction * time * 42));
        meshes.push({ key: meshKey, transform: matMultiply(rotorFrame, scaleMatrix(3)), color: meshKey === "prop_ccw" ? "#22d3ee" : "#fb923c" });
        links.push({ a: center, b: matrixPoint(hub), actuated: true });
        frames.push({ label, transform: rotorFrame });
      }
      frames.unshift({ label: "B", transform: body });
      centersOfMass.push({ label: "body", point: center });
      focus = center;
    } else if (system.id === "copter1") {
      const angle = result.states[sampleIndex * 3] || 0;
      const time = result.time[sampleIndex] || 0;
      const pivot = translate(0, 0, 0.12);
      const arm = matMultiply(pivot, rotY(-angle));
      const tip = matMultiply(arm, translate(1, 0, 0));
      const rotorFrame = matMultiply(tip, rotZ(time * 40));
      meshes.push({ key: "box", transform: matMultiply(arm, matMultiply(translate(0.5, 0, 0), scaleMatrix(1, 0.08, 0.08))), color: "#38bdf8" });
      meshes.push({ key: "prop_ccw", transform: matMultiply(rotorFrame, scaleMatrix(3)), color: "#22d3ee" });
      links.push({ a: matrixPoint(pivot), b: matrixPoint(tip), actuated: true });
      frames.push({ label: "0", transform: pivot }, { label: "1", transform: arm }, { label: "2", transform: rotorFrame });
      centersOfMass.push({ label: "1", point: transformPoint(arm, [0.5, 0, 0]) });
      focus = matrixPoint(tip);
    } else if (system.id === "copter2") {
      const offset = sampleIndex * 8;
      const yaw = result.states[offset] || 0;
      const roll = result.states[offset + 1] || 0;
      const leftRotorAngle = result.states[offset + 2] || 0;
      const rightRotorAngle = result.states[offset + 3] || 0;
      const frame0 = matIdentity();
      const frame1 = matMultiply(frame0, modifiedDh(0, 0, yaw + Math.PI / 2, 1));
      const frame2 = matMultiply(frame1, modifiedDh(Math.PI / 2, 0, 0, -1.5));
      const frame3 = matMultiply(frame1, modifiedDh(Math.PI / 2, 0, roll, 1.5));
      const frame4 = matMultiply(frame3, modifiedDh(-Math.PI / 2, 0.5, leftRotorAngle - Math.PI / 2, 0));
      const frame5 = matMultiply(frame3, modifiedDh(-Math.PI / 2, -0.5, rightRotorAngle - Math.PI / 2, 0));
      meshes.push({ key: "prop_ccw", transform: matMultiply(frame4, scaleMatrix(3)), color: "#22d3ee" });
      meshes.push({ key: "prop_cw", transform: matMultiply(frame5, scaleMatrix(3)), color: "#fb923c" });
      links.push(
        { a: matrixPoint(frame0), b: matrixPoint(frame1), actuated: false },
        { a: matrixPoint(frame1), b: matrixPoint(frame2), actuated: false },
        { a: matrixPoint(frame1), b: matrixPoint(frame3), actuated: false },
        { a: matrixPoint(frame3), b: matrixPoint(frame4), actuated: true },
        { a: matrixPoint(frame3), b: matrixPoint(frame5), actuated: true },
      );
      frames.push(
        { label: "0", transform: frame0 },
        { label: "1", transform: frame1 },
        { label: "2", transform: frame2 },
        { label: "3", transform: frame3 },
        { label: "4", transform: frame4 },
        { label: "5", transform: frame5 },
      );
      centersOfMass.push(
        { label: "2", point: matrixPoint(frame2) },
        { label: "3", point: matrixPoint(frame3) },
        { label: "4", point: matrixPoint(frame4) },
        { label: "5", point: matrixPoint(frame5) },
      );
      focus = matrixPoint(frame1);
    } else if (system.id === "copter3") {
      const offset = sampleIndex * 10;
      const yaw = result.states[offset] || 0;
      const pitch = result.states[offset + 1] || 0;
      const roll = result.states[offset + 2] || 0;
      const leftRotorAngle = result.states[offset + 3] || 0;
      const rightRotorAngle = result.states[offset + 4] || 0;
      const frame0 = matIdentity();
      const frame1 = matMultiply(frame0, modifiedDh(0, 0, yaw, 1));
      const frame2 = matMultiply(frame1, modifiedDh(Math.PI / 2, 0, pitch + Math.PI / 2, 0));
      const frame3 = matMultiply(frame2, modifiedDh(Math.PI / 2, 0, 0, -1.3));
      const frame4 = matMultiply(frame2, modifiedDh(Math.PI / 2, 0, roll - Math.PI / 2, 1.5));
      const frame5 = matMultiply(frame4, modifiedDh(-Math.PI / 2, 0.5, leftRotorAngle - Math.PI / 2, 0));
      const frame6 = matMultiply(frame4, modifiedDh(-Math.PI / 2, -0.5, rightRotorAngle - Math.PI / 2, 0));
      meshes.push({ key: "prop_ccw", transform: matMultiply(frame5, scaleMatrix(3)), color: "#22d3ee" });
      meshes.push({ key: "prop_cw", transform: matMultiply(frame6, scaleMatrix(3)), color: "#fb923c" });
      links.push(
        { a: matrixPoint(frame0), b: matrixPoint(frame1), actuated: false },
        { a: matrixPoint(frame1), b: matrixPoint(frame2), actuated: false },
        { a: matrixPoint(frame2), b: matrixPoint(frame3), actuated: false },
        { a: matrixPoint(frame2), b: matrixPoint(frame4), actuated: false },
        { a: matrixPoint(frame4), b: matrixPoint(frame5), actuated: true },
        { a: matrixPoint(frame4), b: matrixPoint(frame6), actuated: true },
      );
      frames.push(
        { label: "0", transform: frame0 },
        { label: "1", transform: frame1 },
        { label: "2", transform: frame2 },
        { label: "3", transform: frame3 },
        { label: "4", transform: frame4 },
        { label: "5", transform: frame5 },
        { label: "6", transform: frame6 },
      );
      centersOfMass.push(
        { label: "3", point: matrixPoint(frame3) },
        { label: "4", point: matrixPoint(frame4) },
        { label: "5", point: matrixPoint(frame5) },
        { label: "6", point: matrixPoint(frame6) },
      );
      focus = matrixPoint(frame1);
    } else if (system.id === "taxi_drone") {
      const offset = sampleIndex * 12;
      const x = result.states[offset] || 0;
      const y = result.states[offset + 1] || 0;
      const z = result.states[offset + 2] || 0;
      const roll = result.states[offset + 6] || 0;
      const pitch = result.states[offset + 7] || 0;
      const yaw = result.states[offset + 8] || 0;
      const time = result.time[sampleIndex] || 0;
      let body = modifiedDh(0, 0, 0, 1 + z);
      body = matMultiply(body, modifiedDh(-Math.PI / 2, 0, -Math.PI / 2, 2 + y));
      body = matMultiply(body, modifiedDh(-Math.PI / 2, 0, Math.PI / 2, 3 + x));
      body = matMultiply(body, modifiedDh(Math.PI / 2, 0, yaw + Math.PI / 2, 0));
      body = matMultiply(body, modifiedDh(-Math.PI / 2, 0, pitch + Math.PI / 2, 0));
      body = matMultiply(body, modifiedDh(Math.PI / 2, 0, roll - Math.PI / 2, 0));
      body = matMultiply(translate(-3, -2, -1), body);
      const rotorLayout = [
        [-0.518, 1.932, 1, 8], [-0.5, 0.866, 1, 10], [-1.414, 1.414, -1, 12],
        [-1.932, 0.518, 1, 14], [-1, 0, -1, 16], [-1.932, -0.518, -1, 18],
        [-1.414, -1.414, 1, 20], [-0.5, -0.866, 1, 22], [-0.518, -1.932, -1, 24],
        [0.518, -1.932, 1, 26], [0.5, -0.866, -1, 28], [1.414, -1.414, -1, 30],
        [1.932, -0.518, 1, 32], [1, 0, 1, 34], [1.932, 0.518, -1, 36],
        [1.414, 1.414, 1, 38], [0.5, 0.866, -1, 40], [0.518, 1.932, -1, 42],
      ];
      const center = matrixPoint(body);
      meshes.push({ key: "box", transform: matMultiply(body, scaleMatrix(0.5, 0.5, 0.18)), color: "#64748b" });
      for (const [a, d, direction, label] of rotorLayout) {
        const anchor = matMultiply(body, modifiedDh(0, a, 0, d));
        const rotor = matMultiply(anchor, modifiedDh(Math.PI / 2, 0, direction * time * 42, 0));
        const meshKey = direction > 0 ? "prop_ccw" : "prop_cw";
        meshes.push({ key: meshKey, transform: matMultiply(rotor, scaleMatrix(3)), color: direction > 0 ? "#22d3ee" : "#fb923c" });
        links.push({ a: center, b: matrixPoint(anchor), actuated: true });
        frames.push({ label: String(label), transform: rotor });
      }
      frames.unshift({ label: "6", transform: body });
      centersOfMass.push({ label: "body", point: center });
      focus = center;
    } else if (system.id === "drone6" || system.id === "drone8") {
      const offset = sampleIndex * 12;
      const x = result.states[offset] || 0;
      const y = result.states[offset + 1] || 0;
      const z = result.states[offset + 2] || 0;
      const roll = result.states[offset + 6] || 0;
      const pitch = result.states[offset + 7] || 0;
      const yaw = result.states[offset + 8] || 0;
      const time = result.time[sampleIndex] || 0;
      const body = matMultiply(translate(x, y, z), matMultiply(rotZ(yaw), matMultiply(rotY(pitch), rotX(roll))));
      meshes.push({ key: "cylinder", transform: matMultiply(body, scaleMatrix(0.28, 0.28, 0.12)), color: "#64748b" });
      const isDrone8 = system.id === "drone8";
      const armAngles = isDrone8 ? [Math.PI / 8, 3 * Math.PI / 8, 5 * Math.PI / 8, 7 * Math.PI / 8] : [0, Math.PI / 3, 2 * Math.PI / 3];
      const armLength = isDrone8 ? 2 : 1.3;
      for (const angle of armAngles) meshes.push({ key: "box", transform: matMultiply(body, matMultiply(rotZ(angle), scaleMatrix(armLength, 0.065, 0.055))), color: "#94a3b8" });
      const center = matrixPoint(body);
      const rotorLayout = isDrone8
        ? [[-0.383, 0.924], [-0.924, 0.383], [-0.924, -0.383], [-0.383, -0.924], [0.383, -0.924], [0.924, -0.383], [0.924, 0.383], [0.383, 0.924]]
        : Array.from({ length: 6 }, (_, index) => [0.65 * Math.cos(Math.PI / 3 * index), 0.65 * Math.sin(Math.PI / 3 * index)]);
      for (let index = 0; index < rotorLayout.length; index += 1) {
        const direction = index % 2 === 0 ? 1 : -1;
        const hub = matMultiply(body, translate(rotorLayout[index][0], rotorLayout[index][1], 0));
        const meshKey = direction > 0 ? "prop_ccw" : "prop_cw";
        const rotorFrame = matMultiply(hub, rotZ(direction * time * 42));
        meshes.push({ key: meshKey, transform: matMultiply(rotorFrame, scaleMatrix(3)), color: direction > 0 ? "#22d3ee" : "#fb923c" });
        links.push({ a: center, b: matrixPoint(hub), actuated: true });
        frames.push({ label: String(8 + index * 2), transform: rotorFrame });
      }
      frames.unshift({ label: "B", transform: body });
      centersOfMass.push({ label: "body", point: center });
      focus = center;
    }
    return { frames, links, meshes, centersOfMass, focus };
  }

  function parseStl(buffer) {
    const view = new DataView(buffer);
    const triangles = [];
    if (buffer.byteLength >= 84) {
      const count = view.getUint32(80, true);
      if (count > 0 && 84 + count * 50 === buffer.byteLength) {
        const stride = Math.max(1, Math.ceil(count / 6000));
        for (let index = 0; index < count; index += stride) {
          const offset = 84 + index * 50 + 12;
          const triangle = [];
          for (let vertex = 0; vertex < 3; vertex += 1) {
            triangle.push([view.getFloat32(offset + vertex * 12, true), view.getFloat32(offset + vertex * 12 + 4, true), view.getFloat32(offset + vertex * 12 + 8, true)]);
          }
          triangles.push(triangle);
        }
        return triangles;
      }
    }
    const vertices = [];
    const text = new TextDecoder("utf-8").decode(buffer);
    for (const match of text.matchAll(/vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/gi)) vertices.push([Number(match[1]), Number(match[2]), Number(match[3])]);
    for (let index = 0; index + 2 < vertices.length; index += 3) triangles.push([vertices[index], vertices[index + 1], vertices[index + 2]]);
    return triangles;
  }

  async function loadMeshes(system) {
    await Promise.all((system.meshes || []).map(async (mesh) => {
      if (state.meshes.has(mesh.key)) return;
      try {
        const response = await fetch(mesh.url, { cache: "force-cache" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.meshes.set(mesh.key, parseStl(await response.arrayBuffer()));
      } catch (error) {
        console.warn(`Could not load ${mesh.key} CAD`, error);
      }
    }));
    render();
  }

  function boundsCorners(bounds) {
    const points = [];
    for (const x of [bounds.min[0], bounds.max[0]]) for (const y of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) points.push([x, y, z]);
    return points;
  }

  function cameraCoordinates(point, center) {
    const x = point[0] - center[0]; const y = point[1] - center[1]; const z = point[2] - center[2];
    const cy = Math.cos(state.camera.yaw); const sy = Math.sin(state.camera.yaw);
    const cp = Math.cos(state.camera.pitch); const sp = Math.sin(state.camera.pitch);
    const x1 = cy * x - sy * y;
    const y1 = sy * x + cy * y;
    const y2 = cp * y1 - sp * z;
    const z2 = sp * y1 + cp * z;
    return [x1, z2, y2];
  }

  function projectionForBounds(bounds, width, height) {
    const center = bounds.min.map((value, axis) => (value + bounds.max[axis]) / 2);
    const corners = boundsCorners(bounds).map((point) => cameraCoordinates(point, center));
    const minX = Math.min(...corners.map((point) => point[0])); const maxX = Math.max(...corners.map((point) => point[0]));
    const minY = Math.min(...corners.map((point) => point[1])); const maxY = Math.max(...corners.map((point) => point[1]));
    const margin = Math.min(52, Math.max(22, width * 0.065));
    const scale = Math.min((width - 2 * margin) / Math.max(0.1, maxX - minX), (height - 2 * margin) / Math.max(0.1, maxY - minY)) * state.camera.zoom;
    return {
      project(point) {
        const camera = cameraCoordinates(point, center);
        return { x: width / 2 + camera[0] * scale + state.camera.panX, y: height / 2 - camera[1] * scale + state.camera.panY, depth: camera[2], camera };
      },
    };
  }

  function prepareCanvas(canvas) {
    const rectangle = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(1, Math.round(rectangle.width * ratio));
    const pixelHeight = Math.max(1, Math.round(rectangle.height * ratio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width: rectangle.width, height: rectangle.height };
  }

  function drawGrid(context, projection, bounds) {
    context.strokeStyle = css("--forge-grid") || "rgba(148,163,184,.2)";
    context.lineWidth = 1;
    const z = 0;
    const lines = 10;
    for (let index = 0; index <= lines; index += 1) {
      const ratio = index / lines;
      const x = bounds.min[0] + (bounds.max[0] - bounds.min[0]) * ratio;
      const y = bounds.min[1] + (bounds.max[1] - bounds.min[1]) * ratio;
      const xa = projection.project([x, bounds.min[1], z]); const xb = projection.project([x, bounds.max[1], z]);
      const ya = projection.project([bounds.min[0], y, z]); const yb = projection.project([bounds.max[0], y, z]);
      context.beginPath(); context.moveTo(xa.x, xa.y); context.lineTo(xb.x, xb.y); context.stroke();
      context.beginPath(); context.moveTo(ya.x, ya.y); context.lineTo(yb.x, yb.y); context.stroke();
    }
  }

  function colorRgb(color) {
    const value = color.replace("#", "");
    return value.length === 3 ? value.split("").map((part) => parseInt(part + part, 16)) : [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }

  function renderCad(context, scene, projection) {
    if (!ui.showCad.checked) return;
    const polygons = [];
    for (const instance of scene.meshes) {
      const triangles = primitives.get(instance.key) || state.meshes.get(instance.key);
      if (!triangles) continue;
      const rgb = colorRgb(instance.color);
      for (const triangle of triangles) {
        const screen = triangle.map((point) => projection.project(transformPoint(instance.transform, point)));
        const a = [screen[1].camera[0] - screen[0].camera[0], screen[1].camera[1] - screen[0].camera[1], screen[1].camera[2] - screen[0].camera[2]];
        const b = [screen[2].camera[0] - screen[0].camera[0], screen[2].camera[1] - screen[0].camera[1], screen[2].camera[2] - screen[0].camera[2]];
        const normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
        const length = Math.hypot(...normal) || 1;
        const intensity = 0.48 + 0.5 * Math.abs((0.25 * normal[0] - 0.35 * normal[1] + 0.9 * normal[2]) / length);
        polygons.push({ screen, depth: (screen[0].depth + screen[1].depth + screen[2].depth) / 3, fill: `rgb(${rgb.map((channel) => Math.round(channel * intensity)).join(",")})` });
      }
    }
    polygons.sort((a, b) => a.depth - b.depth);
    for (const polygon of polygons) {
      context.fillStyle = polygon.fill; context.strokeStyle = polygon.fill; context.lineWidth = 0.25;
      context.beginPath(); context.moveTo(polygon.screen[0].x, polygon.screen[0].y); context.lineTo(polygon.screen[1].x, polygon.screen[1].y); context.lineTo(polygon.screen[2].x, polygon.screen[2].y); context.closePath(); context.fill(); context.stroke();
    }
  }

  function drawLinks(context, scene, projection) {
    if (!ui.showLinks.checked) return;
    context.lineCap = "round";
    for (const link of scene.links) {
      const a = projection.project(link.a); const b = projection.project(link.b);
      context.strokeStyle = link.actuated ? (css("--forge-link") || "#60a5fa") : (css("--forge-passive") || "#94a3b8");
      context.lineWidth = link.actuated ? 5 : 3;
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      context.fillStyle = link.actuated ? (css("--forge-joint") || "#2563eb") : (css("--forge-passive") || "#94a3b8");
      context.beginPath(); context.arc(b.x, b.y, 4.5, 0, Math.PI * 2); context.fill();
    }
  }

  function drawFrames(context, scene, projection) {
    if (!ui.showFrames.checked && !ui.showNumbers.checked) return;
    const colors = ["#ef4444", "#22c55e", "#3b82f6"];
    for (const frame of scene.frames) {
      const origin = matrixPoint(frame.transform);
      const screenOrigin = projection.project(origin);
      if (ui.showFrames.checked) {
        const length = 0.11;
        for (let axis = 0; axis < 3; axis += 1) {
          const direction = [frame.transform[axis], frame.transform[4 + axis], frame.transform[8 + axis]];
          const endpoint = origin.map((value, component) => value + direction[component] * length);
          const screen = projection.project(endpoint);
          context.strokeStyle = colors[axis]; context.lineWidth = 2;
          context.beginPath(); context.moveTo(screenOrigin.x, screenOrigin.y); context.lineTo(screen.x, screen.y); context.stroke();
        }
      }
      if (ui.showNumbers.checked) {
        context.fillStyle = css("--forge-frame-label") || "#e5eefb"; context.font = "700 11px system-ui"; context.textAlign = "left";
        context.fillText(frame.label, screenOrigin.x + 5, screenOrigin.y - 5);
      }
    }
  }

  function drawCentersOfMass(context, scene, projection) {
    if (!ui.showCom.checked) return;
    const color = css("--forge-com") || "#fbbf24";
    const contrast = css("--forge-canvas") || "#07111f";
    const labelColor = css("--forge-frame-label") || "#e5eefb";

    for (const centerOfMass of scene.centersOfMass) {
      const point = projection.project(centerOfMass.point);
      context.save();
      context.fillStyle = color;
      context.strokeStyle = contrast;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = labelColor;
      context.font = "700 10px system-ui";
      context.textAlign = "left";
      context.fillText(`COM ${centerOfMass.label}`, point.x + 7, point.y - 5);
      context.restore();
    }
  }

  function drawTargetPoint(context, system, projection) {
    if (!system.positionPlot || !state.appliedParameters) return;
    const point = [
      Number(state.appliedParameters.targetX),
      Number(state.appliedParameters.targetY),
      Number(state.appliedParameters.targetZ),
    ];
    if (!point.every(Number.isFinite)) return;
    const screen = projection.project(point);
    const color = css("--forge-target") || "#dc2626";
    context.save();
    context.fillStyle = color;
    context.strokeStyle = css("--forge-canvas") || "#f7faff";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(screen.x, screen.y, 5.5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = color;
    context.font = "800 10px system-ui";
    context.textAlign = "left";
    context.fillText(tr("XYZ target"), screen.x + 9, screen.y - 7);
    context.restore();
  }

  function drawTrail(context, projection) {
    if (state.trail.length < 2) return;
    context.strokeStyle = css("--forge-trail") || "rgba(56,189,248,.5)"; context.lineWidth = 1.5; context.setLineDash([5, 5]);
    context.beginPath();
    state.trail.forEach((point, index) => { const screen = projection.project(point); if (index === 0) context.moveTo(screen.x, screen.y); else context.lineTo(screen.x, screen.y); });
    context.stroke(); context.setLineDash([]);
  }

  function sampleIndex() {
    if (!state.result) return 0;
    return clamp(Math.round(state.playback * 60), 0, state.result.time.length - 1);
  }

  function render() {
    const { context, width, height } = prepareCanvas(ui.canvas);
    context.clearRect(0, 0, width, height);
    context.fillStyle = css("--forge-canvas") || "#07111f"; context.fillRect(0, 0, width, height);
    const system = state.systems[state.activeIndex];
    if (!system || !state.result) {
      context.fillStyle = css("--forge-muted") || "#9fb0c6"; context.font = "600 15px system-ui"; context.textAlign = "center";
      context.fillText(tr(state.running ? "Running simulation…" : "Choose a system to begin"), width / 2, height / 2);
      return;
    }
    const scene = sceneFor(system, state.result, sampleIndex());
    const projection = projectionForBounds(system.bounds, width, height);
    drawGrid(context, projection, system.bounds);
    drawTrail(context, projection);
    renderCad(context, scene, projection);
    drawLinks(context, scene, projection);
    drawFrames(context, scene, projection);
    drawCentersOfMass(context, scene, projection);
    drawTargetPoint(context, system, projection);
  }

  function renderPlot() {
    if (!ui.plot) return;
    const { context, width, height } = prepareCanvas(ui.plot);
    context.clearRect(0, 0, width, height);
    context.fillStyle = css("--forge-plot") || "rgba(4, 10, 20, .72)"; context.fillRect(0, 0, width, height);
    if (!state.result) return;
    const system = state.systems[state.activeIndex];
    const plotIndex = system.plotStateIndex || 0;
    const primaryScale = system.primaryPlotScale || 1;
    const secondaryScale = system.secondaryPlotScale || 1;
    const actual = [];
    const desired = [];
    const secondaryActual = [];
    const secondaryDesired = [];
    const hasSecondary = Number.isInteger(system.secondaryPlotStateIndex) && state.result.secondaryReference;
    for (let index = 0; index < state.result.time.length; index += 1) {
      actual.push(state.result.states[index * system.stateStride + plotIndex] * primaryScale);
      desired.push(state.result.reference[index] * primaryScale);
      if (hasSecondary) {
        secondaryActual.push(state.result.states[index * system.stateStride + system.secondaryPlotStateIndex] * secondaryScale);
        secondaryDesired.push(state.result.secondaryReference[index] * secondaryScale);
      }
    }
    let minimum = Math.min(...actual, ...desired); let maximum = Math.max(...actual, ...desired);
    if (maximum - minimum < 0.1) { minimum -= 0.05; maximum += 0.05; }
    const pad = { x: 12, top: 10, bottom: 18 };
    const xAt = (index) => pad.x + (index / Math.max(1, actual.length - 1)) * (width - 2 * pad.x);
    const yAt = (value) => pad.top + ((maximum - value) / (maximum - minimum)) * (height - pad.top - pad.bottom);
    let secondaryMinimum = hasSecondary ? Math.min(...secondaryActual, ...secondaryDesired) : 0;
    let secondaryMaximum = hasSecondary ? Math.max(...secondaryActual, ...secondaryDesired) : 1;
    if (secondaryMaximum - secondaryMinimum < 0.1) { secondaryMinimum -= 0.05; secondaryMaximum += 0.05; }
    const secondaryYAt = (value) => pad.top + ((secondaryMaximum - value) / (secondaryMaximum - secondaryMinimum)) * (height - pad.top - pad.bottom);
    context.strokeStyle = css("--forge-plot-grid") || "rgba(148,163,184,.2)"; context.lineWidth = 1;
    for (let line = 0; line <= 3; line += 1) { const y = pad.top + (line / 3) * (height - pad.top - pad.bottom); context.beginPath(); context.moveTo(pad.x, y); context.lineTo(width - pad.x, y); context.stroke(); }
    const drawSeries = (values, color, dashed = false, mapper = yAt) => {
      context.strokeStyle = color; context.lineWidth = 1.8; context.setLineDash(dashed ? [5, 4] : []); context.beginPath();
      values.forEach((value, index) => { const x = xAt(index); const y = mapper(value); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); context.setLineDash([]);
    };
    const primaryColor = css("--forge-plot-primary") || "#38bdf8";
    const primaryReferenceColor = css("--forge-plot-primary-reference") || "#a5b4fc";
    const secondaryColor = css("--forge-plot-secondary") || "#4ade80";
    const secondaryReferenceColor = css("--forge-plot-secondary-reference") || "#fdba74";
    drawSeries(desired, primaryReferenceColor, true); drawSeries(actual, primaryColor);
    if (hasSecondary) { drawSeries(secondaryDesired, secondaryReferenceColor, true, secondaryYAt); drawSeries(secondaryActual, secondaryColor, false, secondaryYAt); }
    const cursorX = pad.x + (state.playback / system.duration) * (width - 2 * pad.x);
    context.strokeStyle = css("--forge-plot-cursor") || "rgba(255,255,255,.65)"; context.beginPath(); context.moveTo(cursorX, pad.top); context.lineTo(cursorX, height - pad.bottom); context.stroke();
    const primaryLabel = tr(system.primaryPlotLabel || `q${plotIndex + 1}`);
    context.fillStyle = primaryColor; context.font = "600 10px system-ui"; context.textAlign = "left"; context.fillText(primaryLabel, 12, height - 5);
    if (hasSecondary) {
      const secondaryLabel = tr(system.secondaryPlotLabel || `q${system.secondaryPlotStateIndex + 1}`);
      const secondaryX = 12 + context.measureText(primaryLabel).width + 18;
      context.fillStyle = secondaryColor; context.fillText(secondaryLabel, secondaryX, height - 5);
    }
  }

  function renderPositionPlot() {
    if (!ui.positionPlot || !ui.positionPlotWrap) return;
    const system = state.systems[state.activeIndex];
    const config = system?.positionPlot;
    ui.positionPlotWrap.hidden = !config;
    if (!config) return;

    const { context, width, height } = prepareCanvas(ui.positionPlot);
    context.clearRect(0, 0, width, height);
    context.fillStyle = css("--forge-plot") || "rgba(4, 10, 20, .72)"; context.fillRect(0, 0, width, height);
    if (!state.result || !state.appliedParameters) return;

    const xActual = [];
    const yActual = [];
    const xTarget = [];
    const yTarget = [];
    const targetX = Number(state.appliedParameters[config.xTargetKey]);
    const targetY = Number(state.appliedParameters[config.yTargetKey]);
    const targetDelay = Number(config.targetDelay) || 0;
    const initialX = Number(config.initialX) || 0;
    const initialY = Number(config.initialY) || 0;
    for (let index = 0; index < state.result.time.length; index += 1) {
      xActual.push(state.result.states[index * system.stateStride + config.xStateIndex]);
      yActual.push(state.result.states[index * system.stateStride + config.yStateIndex]);
      const targetActive = state.result.time[index] >= targetDelay;
      xTarget.push(targetActive ? targetX : initialX);
      yTarget.push(targetActive ? targetY : initialY);
    }

    let minimum = Math.min(...xActual, ...yActual, ...xTarget, ...yTarget);
    let maximum = Math.max(...xActual, ...yActual, ...xTarget, ...yTarget);
    if (maximum - minimum < 0.1) { minimum -= 0.05; maximum += 0.05; }
    const margin = Math.max(0.05, (maximum - minimum) * 0.08);
    minimum -= margin; maximum += margin;
    const pad = { x: 12, top: 10, bottom: 18 };
    const xAt = (index) => pad.x + (index / Math.max(1, xActual.length - 1)) * (width - 2 * pad.x);
    const yAt = (value) => pad.top + ((maximum - value) / (maximum - minimum)) * (height - pad.top - pad.bottom);
    context.strokeStyle = css("--forge-plot-grid") || "rgba(148,163,184,.2)"; context.lineWidth = 1;
    for (let line = 0; line <= 3; line += 1) { const y = pad.top + (line / 3) * (height - pad.top - pad.bottom); context.beginPath(); context.moveTo(pad.x, y); context.lineTo(width - pad.x, y); context.stroke(); }
    const drawSeries = (values, color, dashed = false) => {
      context.strokeStyle = color; context.lineWidth = 1.8; context.setLineDash(dashed ? [5, 4] : []); context.beginPath();
      values.forEach((value, index) => { const x = xAt(index); const y = yAt(value); if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); }); context.stroke(); context.setLineDash([]);
    };
    const xColor = css("--forge-plot-primary") || "#38bdf8";
    const xTargetColor = css("--forge-plot-primary-reference") || "#a5b4fc";
    const yColor = css("--forge-plot-secondary") || "#4ade80";
    const yTargetColor = css("--forge-plot-secondary-reference") || "#fdba74";
    drawSeries(xTarget, xTargetColor, true); drawSeries(xActual, xColor);
    drawSeries(yTarget, yTargetColor, true); drawSeries(yActual, yColor);
    const cursorX = pad.x + (state.playback / system.duration) * (width - 2 * pad.x);
    context.strokeStyle = css("--forge-plot-cursor") || "rgba(255,255,255,.65)"; context.beginPath(); context.moveTo(cursorX, pad.top); context.lineTo(cursorX, height - pad.bottom); context.stroke();
    const xLabel = tr(config.xLabel || "X position");
    const yLabel = tr(config.yLabel || "Y position");
    context.font = "600 10px system-ui"; context.textAlign = "left"; context.fillStyle = xColor; context.fillText(xLabel, 12, height - 5);
    const yLabelX = 12 + context.measureText(xLabel).width + 18;
    context.fillStyle = yColor; context.fillText(yLabel, yLabelX, height - 5);
    const targetLabel = tr("Dashed = target");
    const targetLabelWidth = context.measureText(targetLabel).width;
    if (width - targetLabelWidth - 12 > yLabelX + context.measureText(yLabel).width + 14) {
      context.fillStyle = css("--forge-muted") || "#9fb0c6"; context.fillText(targetLabel, width - targetLabelWidth - 12, height - 5);
    }
  }

  function renderAll() { render(); renderPlot(); renderPositionPlot(); }

  function resetCamera() {
    const camera = state.systems[state.activeIndex]?.camera || { yaw: -0.7, pitch: 0.4, zoom: 0.9 };
    state.camera = { ...camera, panX: 0, panY: 0 };
    render();
  }

  function applyViewPreset() {
    const system = state.systems[state.activeIndex];
    if (!system) return;
    const zoom = system.camera?.zoom || 0.9;
    const presets = {
      full: system.camera,
      top: { yaw: 0, pitch: Math.PI / 2 - 0.01, zoom },
      front: { yaw: 0, pitch: 0, zoom },
      side: { yaw: Math.PI / 2, pitch: 0, zoom },
    };
    state.camera = { ...(presets[ui.view?.value] || system.camera), panX: 0, panY: 0 };
    render();
  }

  function resetVisualization() {
    if (ui.view) ui.view.value = "full";
    resetCamera();
  }

  function readParameters() {
    const parameters = {};
    for (const input of ui.gains.querySelectorAll("input")) parameters[input.name] = Number(input.value);
    return parameters;
  }

  function validSimulationResult(result) {
    if (!result || !result.time || !result.states || !result.reference || !result.secondaryReference || !result.effort || !result.metrics) return false;
    for (const values of [result.time, result.states, result.reference, result.effort]) {
      for (const value of values) if (!Number.isFinite(value)) return false;
    }
    for (const value of result.secondaryReference) if (!Number.isFinite(value) && !Number.isNaN(value)) return false;
    const metrics = result.metrics;
    if (!Number.isFinite(metrics.rmsError) || !Number.isFinite(metrics.peakEffort)) return false;
    return metrics.secondaryRms === null || Number.isFinite(metrics.secondaryRms);
  }

  function markParametersDirty() {
    state.parametersDirty = true;
    ui.run.textContent = "Run simulation";
    ui.status.textContent = "Parameters changed. Run the simulation to apply them.";
  }

  function parameterHelp(control) {
    let explanation = "";
    if (/(^|[A-Z0-9])Kp(?:\d+)?$/i.test(control.key) || /^kp\d*$/i.test(control.key)) {
      explanation = "P gain acts on the current position or angle error for this controller. Increasing it strengthens immediate correction. Excessive values can cause oscillation.";
    } else if (/(^|[A-Z0-9])Kd(?:\d+)?$/i.test(control.key) || /^kd\d*$/i.test(control.key)) {
      explanation = "D gain acts on velocity or error rate to add damping. Excessive values can amplify measurement and estimation noise.";
    } else if (/(^|[A-Z0-9])Ki(?:\d+)?$/i.test(control.key) || /^ki\d*$/i.test(control.key) || /IntegralGain$/i.test(control.key)) {
      explanation = "I gain accumulates controller error to remove steady-state offset. Its contribution is bounded by I max to limit windup.";
    } else if (/IntegralInitial$/i.test(control.key)) {
      explanation = "Initial integral contribution at the start of the simulation. It is limited by I max.";
    } else if (/IntegralMaxPercent$/i.test(control.key)) {
      explanation = "Antiwindup clamp for the integral contribution, expressed as a percentage of the maximum command handled by this control loop.";
    } else if (/IntegralPositionWeight$/i.test(control.key)) {
      explanation = "Weight applied to position error before it enters the integral channel.";
    } else if (/IntegralVelocityWeight$/i.test(control.key)) {
      explanation = "Weight applied to velocity error before it enters the integral channel.";
    } else if (/ReferenceMin$/i.test(control.key)) {
      explanation = "Minimum reference allowed for the inner control loop.";
    } else if (/ReferenceMax$/i.test(control.key)) {
      explanation = "Maximum reference allowed for the inner control loop.";
    } else if (/Target/i.test(control.key)) {
      explanation = "Reference value commanded to this control loop.";
    } else if (/Amplitude/i.test(control.key)) {
      explanation = "Amplitude applied to the generated motion reference.";
    } else {
      explanation = "Editable parameter for this control loop.";
    }
    return { loop: control.group || "Controller", explanation };
  }

  function buildControls(system) {
    ui.gains.replaceChildren();
    const groups = new Map();
    for (const control of system.controls) {
      const groupName = control.group || "Controller";
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(control);
    }
    for (const [groupName, controls] of groups) {
      const group = document.createElement("section"); group.className = "forge-control-group";
      const groupHeading = document.createElement("h6"); groupHeading.textContent = groupName;
      const groupGrid = document.createElement("div"); groupGrid.className = "forge-control-group-grid";
      for (const control of controls) {
      const controlWrap = document.createElement("div"); controlWrap.className = "forge-control";
      const headingRow = document.createElement("span"); headingRow.className = "forge-control-label";
      const heading = document.createElement("label"); heading.textContent = control.label;
      const help = parameterHelp(control);
      const helpWrap = document.createElement("span"); helpWrap.className = "forge-gain-help";
      const helpButton = document.createElement("button"); helpButton.type = "button"; helpButton.className = "forge-info-button";
      helpButton.textContent = "i"; helpButton.setAttribute("aria-label", `About ${control.label}`); helpButton.setAttribute("aria-describedby", `forge-help-${system.id}-${control.key}`);
      const tooltip = document.createElement("span"); tooltip.id = `forge-help-${system.id}-${control.key}`; tooltip.className = "forge-gain-tooltip"; tooltip.setAttribute("role", "tooltip");
      const loopText = document.createElement("span"); loopText.textContent = help.loop;
      const explanationText = document.createElement("span"); explanationText.textContent = help.explanation;
      tooltip.append(loopText, document.createTextNode(". "), explanationText);
      helpButton.addEventListener("click", () => helpWrap.classList.toggle("is-open"));
      helpButton.addEventListener("blur", () => helpWrap.classList.remove("is-open"));
      helpButton.addEventListener("keydown", (event) => { if (event.key === "Escape") { helpWrap.classList.remove("is-open"); helpButton.blur(); } });
      helpWrap.append(helpButton, tooltip); headingRow.appendChild(helpWrap);
      const field = document.createElement("span"); field.className = "forge-number-field";
      const input = document.createElement("input");
      input.type = "number"; input.id = `forge-control-${system.id}-${control.key}`; input.name = control.key; input.value = control.default; input.min = control.min; input.max = control.max; input.step = control.step; input.inputMode = "decimal";
      heading.htmlFor = input.id; headingRow.prepend(heading);
      input.addEventListener("input", markParametersDirty);
      field.appendChild(input);
      if (control.unit) { const unit = document.createElement("small"); unit.textContent = control.unit; field.appendChild(unit); }
      controlWrap.append(headingRow, field); groupGrid.appendChild(controlWrap);
      }
      group.append(groupHeading, groupGrid); ui.gains.appendChild(group);
    }
  }

  function buildTrail() {
    state.trail = [];
    if (!state.result) return;
    const system = state.systems[state.activeIndex];
    const stride = Math.max(1, Math.floor(state.result.time.length / 90));
    for (let index = 0; index < state.result.time.length; index += stride) state.trail.push(sceneFor(system, state.result, index).focus);
  }

  function setControlsDisabled(disabled) {
    ui.run.disabled = disabled;
    ui.resetGains.disabled = disabled;
    for (const input of ui.gains.querySelectorAll("input")) input.disabled = disabled;
    for (const tab of ui.tabs.querySelectorAll("button")) tab.disabled = disabled;
  }

  function setPlaybackEnabled(enabled) {
    for (const control of [ui.play, ui.restart, ui.cameraReset, ui.zoomIn, ui.zoomOut, ui.speed, ui.view, ui.timeline]) control.disabled = !enabled;
  }

  function stopAnimation() {
    if (state.animationHandle !== null) cancelAnimationFrame(state.animationHandle);
    state.animationHandle = null; state.lastTimestamp = null;
  }

  function setPlaying(playing, userAction = false) {
    if (!state.result) return;
    if (userAction) state.userPaused = !playing;
    state.playing = playing;
    stopAnimation();
    updatePlaybackUi();
    if (playing && state.visible) state.animationHandle = requestAnimationFrame(animationFrame);
  }

  function updatePlaybackUi() {
    const duration = state.systems[state.activeIndex]?.duration || 0;
    ui.play.textContent = state.playing ? "Pause" : "Play";
    ui.play.setAttribute("aria-pressed", String(state.playing));
    ui.timeline.value = duration ? String(Math.round((state.playback / duration) * 1000)) : "0";
    ui.time.textContent = `${state.playback.toFixed(2)} / ${duration.toFixed(2)} s`;
  }

  function animationFrame(timestamp) {
    if (!state.playing || !state.visible || !state.result) return;
    const system = state.systems[state.activeIndex];
    if (state.lastTimestamp !== null) {
      state.playback += ((timestamp - state.lastTimestamp) / 1000) * (Number(ui.speed.value) || 1);
      if (state.playback >= system.duration) state.playback %= system.duration;
    }
    state.lastTimestamp = timestamp;
    updatePlaybackUi(); renderAll();
    state.animationHandle = requestAnimationFrame(animationFrame);
  }

  function replaySimulation() {
    if (!state.result) return;
    state.playback = 0;
    state.lastTimestamp = null;
    resetVisualization();
    updatePlaybackUi();
    renderAll();
    setPlaying(true, true);
    ui.status.textContent = "Replaying the current result. Change a parameter to run a new simulation.";
  }

  function runSimulation() {
    const system = state.systems[state.activeIndex];
    if (!system || !state.worker) return;
    if (state.running) {
      ui.status.textContent = "A simulation is already running. Wait for it to finish before starting another.";
      return;
    }
    if (!state.parametersDirty && state.result) { replaySimulation(); return; }
    stopAnimation(); state.playing = false; state.running = true; state.result = null; state.playback = 0; state.trail = [];
    state.pendingParameters = readParameters();
    const requestId = ++state.requestId;
    setControlsDisabled(true); setPlaybackEnabled(false);
    resetVisualization();
    ui.status.textContent = "Running the nonlinear simulation in your browser…";
    ui.run.textContent = "Running…";
    ui.rms.textContent = "Pending"; ui.secondaryRms.textContent = "Pending"; ui.peak.textContent = "Pending";
    updatePlaybackUi(); renderAll();
    state.worker.postMessage({ requestId, systemId: system.id, parameters: state.pendingParameters, duration: system.duration });
  }

  function selectSystem(index) {
    const system = state.systems[index];
    if (!system || state.running) return;
    state.activeIndex = index; state.result = null; state.playback = 0; state.trail = []; state.running = false; state.parametersDirty = true; state.pendingParameters = null; state.appliedParameters = null;
    stopAnimation(); state.playing = false;
    ui.category.textContent = system.category; ui.title.textContent = system.title; ui.description.textContent = system.description; ui.controller.textContent = system.controller;
    ui.rmsLabel.textContent = system.primaryMetricLabel || "Primary RMS";
    ui.secondaryRmsLabel.textContent = system.secondaryMetricLabel || "Secondary RMS";
    const hasSecondary = Number.isInteger(system.secondaryPlotStateIndex);
    ui.secondaryResult.hidden = !hasSecondary;
    ui.results.classList.toggle("single", !hasSecondary);
    ui.run.textContent = "Run simulation";
    buildControls(system); resetVisualization(); setPlaybackEnabled(false); updatePlaybackUi();
    [...ui.tabs.querySelectorAll("button")].forEach((button, buttonIndex) => { const selected = index === buttonIndex; button.classList.toggle("active", selected); button.setAttribute("aria-selected", String(selected)); button.tabIndex = selected ? 0 : -1; });
    loadMeshes(system); runSimulation();
  }

  function buildTabs() {
    ui.tabs.replaceChildren();
    state.systems.forEach((system, index) => {
      const button = document.createElement("button"); button.type = "button"; button.className = "forge-demo-tab"; button.setAttribute("role", "tab"); button.textContent = system.shortTitle;
      button.addEventListener("click", () => selectSystem(index));
      button.addEventListener("keydown", (event) => { if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + state.systems.length) % state.systems.length; selectSystem(next); ui.tabs.querySelectorAll("button")[next].focus(); });
      ui.tabs.appendChild(button);
    });
  }

  async function initialize() {
    ui.status.textContent = "Loading interactive systems…";
    try {
      const response = await fetch(root.dataset.source, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.systems) || payload.systems.length === 0) throw new Error("No systems configured");
      state.systems = [...payload.systems].sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
      state.worker = new Worker("assets/js/dynamics-forge-worker.js?v=20260802-controller-groups1");
      state.worker.addEventListener("message", (event) => {
        const result = event.data;
        if (result.requestId !== state.requestId || result.systemId !== state.systems[state.activeIndex]?.id) return;
        state.running = false; setControlsDisabled(false);
        if (result.error) { state.pendingParameters = null; state.parametersDirty = true; ui.run.textContent = "Run simulation"; ui.status.textContent = `Simulation error: ${result.error}`; root.classList.add("forge-load-error"); renderAll(); return; }
        if (!validSimulationResult(result)) { state.pendingParameters = null; state.parametersDirty = true; ui.run.textContent = "Run simulation"; ui.status.textContent = "Simulation error: a non-finite result was rejected for numerical safety."; root.classList.add("forge-load-error"); renderAll(); return; }
        state.result = result; state.appliedParameters = state.pendingParameters; state.pendingParameters = null; state.playback = 0; state.parametersDirty = false; buildTrail(); resetVisualization(); setPlaybackEnabled(true);
        ui.rms.textContent = `${result.metrics.rmsError.toFixed(3)} ${result.metrics.metricUnit}`;
        if (Number.isFinite(result.metrics.secondaryRms)) ui.secondaryRms.textContent = `${result.metrics.secondaryRms.toFixed(3)} ${result.metrics.secondaryUnit}`;
        ui.peak.textContent = `${result.metrics.peakEffort.toFixed(2)} ${result.metrics.effortUnit}`;
        ui.run.textContent = "Replay";
        ui.status.textContent = "Simulation complete. Change a parameter to calculate a new result, or replay the current result.";
        updatePlaybackUi(); renderAll();
        if (!state.userPaused && state.visible) setPlaying(true);
      });
      state.worker.addEventListener("error", () => {
        state.running = false;
        state.pendingParameters = null;
        state.parametersDirty = true;
        setControlsDisabled(false);
        ui.run.textContent = "Run simulation";
        ui.status.textContent = "The browser simulator could not start.";
      });
      buildTabs(); selectSystem(0);
    } catch (error) {
      ui.status.textContent = "The interactive simulator could not be loaded."; root.classList.add("forge-load-error"); render();
    }
  }

  ui.run.addEventListener("click", () => runSimulation());
  ui.resetGains.addEventListener("click", () => { const system = state.systems[state.activeIndex]; if (!system) return; for (const control of system.controls) { const input = ui.gains.querySelector(`[name="${control.key}"]`); if (input) input.value = control.default; } markParametersDirty(); });
  ui.play.addEventListener("click", () => setPlaying(!state.playing, true));
  ui.restart.addEventListener("click", () => { state.playback = 0; state.lastTimestamp = null; resetVisualization(); updatePlaybackUi(); renderAll(); });
  ui.cameraReset.addEventListener("click", resetVisualization);
  ui.zoomIn.addEventListener("click", () => { state.camera.zoom = clamp(state.camera.zoom * 1.18, 0.25, 4); render(); });
  ui.zoomOut.addEventListener("click", () => { state.camera.zoom = clamp(state.camera.zoom / 1.18, 0.25, 4); render(); });
  ui.view.addEventListener("change", applyViewPreset);
  ui.timeline.addEventListener("input", () => { const duration = state.systems[state.activeIndex]?.duration || 0; state.playback = (Number(ui.timeline.value) / 1000) * duration; state.lastTimestamp = null; updatePlaybackUi(); renderAll(); });
  for (const control of [ui.showCad, ui.showLinks, ui.showFrames, ui.showNumbers, ui.showCom]) control.addEventListener("change", render);

  ui.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  ui.canvas.addEventListener("pointerdown", (event) => { if (!state.result) return; ui.canvas.setPointerCapture(event.pointerId); state.drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button === 2, camera: { ...state.camera } }; });
  ui.canvas.addEventListener("pointermove", (event) => { if (!state.drag || event.pointerId !== state.drag.pointerId) return; const dx = event.clientX - state.drag.x; const dy = event.clientY - state.drag.y; if (state.drag.pan) { state.camera.panX = state.drag.camera.panX + dx; state.camera.panY = state.drag.camera.panY + dy; } else { state.camera.yaw = state.drag.camera.yaw + dx * 0.008; state.camera.pitch = clamp(state.drag.camera.pitch + dy * 0.008, -1.48, 1.48); } render(); });
  const finishDrag = (event) => { if (state.drag?.pointerId === event.pointerId) state.drag = null; };
  ui.canvas.addEventListener("pointerup", finishDrag); ui.canvas.addEventListener("pointercancel", finishDrag);
  ui.canvas.addEventListener("wheel", (event) => { if (!state.result) return; event.preventDefault(); state.camera.zoom = clamp(state.camera.zoom * Math.exp(-event.deltaY * 0.001), 0.25, 4); render(); }, { passive: false });
  ui.canvas.addEventListener("keydown", (event) => { if (!state.result) return; if (event.code === "Space") { event.preventDefault(); setPlaying(!state.playing, true); } if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); state.playback = clamp(state.playback + (event.key === "ArrowRight" ? 0.25 : -0.25), 0, state.systems[state.activeIndex].duration); updatePlaybackUi(); renderAll(); } });

  const resizeObserver = new ResizeObserver(renderAll); resizeObserver.observe(ui.canvas); if (ui.plot) resizeObserver.observe(ui.plot); if (ui.positionPlot) resizeObserver.observe(ui.positionPlot);
  new MutationObserver(renderAll).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  document.addEventListener("portfolio-language-change", renderAll);
  new IntersectionObserver((entries) => { state.visible = entries[0]?.isIntersecting ?? false; if (!state.visible) stopAnimation(); else if (state.result && !state.userPaused) setPlaying(true); }, { rootMargin: "300px 0px", threshold: 0.04 }).observe(root);

  setPlaybackEnabled(false); renderAll(); initialize();
})();
