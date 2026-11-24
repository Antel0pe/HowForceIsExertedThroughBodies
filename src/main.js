import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Skeleton, buildBoneVisuals, SIDES, SIDE_SIGN, SIDE_LABEL, JOINTS, BONE_LABEL, DOF_LABEL } from './skeleton.js';
import { Strand, makeFiberTexture, NSEG } from './muscleMesh.js';
import { MUSCLES, REGIONS } from './muscles.js';
import { NERVES, CORD, BRAIN, BRAINSTEM } from './nerves.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const Yup = new V3(0, 1, 0);

// ------------------------------------------------------------------ renderer & scene
const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
camera.position.set(0, 1.0, 3.7);
scene.add(camera);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.minDistance = 0.25;
controls.maxDistance = 7;
controls.update();

scene.add(new THREE.HemisphereLight(0xfff1e6, 0x2a2426, 1.1));
const headLight = new THREE.DirectionalLight(0xffffff, 2.1);
headLight.position.set(0.7, 0.9, 0.3);
headLight.target.position.set(0, 0, -1);
camera.add(headLight, headLight.target);
const rim1 = new THREE.DirectionalLight(0x8fb4ff, 1.1);
rim1.position.set(-2, 2, -3);
const rim2 = new THREE.DirectionalLight(0xffc4a0, 0.7);
rim2.position.set(2.5, 1, -2);
scene.add(rim1, rim2);

function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
{
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 48),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(120,140,170,0.35)', 'rgba(120,140,170,0)'), transparent: true, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  scene.add(floor);
}

// ------------------------------------------------------------------ skeleton & muscles
const skel = new Skeleton();
scene.add(skel.root);
const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.72, metalness: 0 });
const cartMat = new THREE.MeshStandardMaterial({ color: 0xbcd0d4, roughness: 0.5, metalness: 0 });
const darkMat = new THREE.MeshStandardMaterial({ color: 0x251c1c, roughness: 1 });
const boneMeshes = buildBoneVisuals(skel, { bone: boneMat, cart: cartMat, dark: darkMat });

const fiberTex = makeFiberTexture();
const insts = [];
const instByKey = {};
let strandCount = 0;
for (const def of MUSCLES) {
  for (const S of SIDES) {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: fiberTex, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
    const inst = { def, S, key: `${def.id}_${S}`, material, strands: [], visible: true, transparent: false };
    inst.strands = def.strands.map((sd) => new Strand(inst, sd, skel, strandCount++));
    for (const st of inst.strands) scene.add(st.mesh);
    insts.push(inst);
    instByKey[inst.key] = inst;
  }
}
const allStrands = insts.flatMap((i) => i.strands);
skel.apply({});
skel.computeDirty();
for (const s of allStrands) s.update();

const regionLabel = Object.fromEntries(REGIONS.map((r) => [r.id, r.label]));
const instName = (i) => `${i.def.name}`;
const sideTag = (i) => (i.S === 'R' ? 'R' : 'L');

function instCenter(inst, target = new V3()) {
  target.set(0, 0, 0);
  for (const s of inst.strands) target.add(s.mid);
  return target.multiplyScalar(1 / inst.strands.length);
}

// ------------------------------------------------------------------ UI state
const ui = { sup: true, deep: true, skel: true, ghost: true, forces: true, nerve: true };

// ------------------------------------------------------------------ action player
const T = { sig: 1.0, nmj: 0.3, con: 1.35, hold: 0.8, rel: 1.2, pause: 0.55 };
const TOTAL = Object.values(T).reduce((a, b) => a + b, 0);
const player = { inst: null, actionIdx: 0, t: 0, playing: true, speed: 1, scrub: 0, from: {}, to: {}, primary: null, syn: new Map(), ant: new Map(), selfRatio: 1, center: new V3() };
let currentValues = {};

function phaseAt(t) {
  let x = t;
  if (x < T.sig) { const s = x / T.sig; return { sig: s, act: 0, poseT: 0, step: s < 0.22 ? 0 : s < 0.5 ? 1 : 2 }; }
  x -= T.sig;
  if (x < T.nmj) return { sig: 1, act: (0.5 * x) / T.nmj, poseT: 0, step: 3 };
  x -= T.nmj;
  if (x < T.con) { const k = x / T.con; return { sig: -1, act: 0.5 + 0.5 * Math.min(1, k * 3), poseT: ease(k), step: 4 }; }
  x -= T.con;
  if (x < T.hold) return { sig: -1, act: 1, poseT: 1, step: 4 };
  x -= T.hold;
  if (x < T.rel) { const k = x / T.rel; return { sig: -1, act: Math.max(0, 1 - k * 2.5), poseT: 1 - ease(k), step: 5 }; }
  return { sig: -1, act: 0, poseT: 0, step: -1 };
}

function mergeVals(a, b) {
  const out = {};
  for (const k in a) out[k] = { ...a[k] };
  for (const k in b) out[k] = { ...(out[k] || {}), ...b[k] };
  return out;
}
function blend(from, to, k) {
  const out = {};
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const f = from[key] || {}, t = to[key] || {};
    out[key] = {};
    for (const d of new Set([...Object.keys(f), ...Object.keys(t)])) {
      const a = f[d] || 0, b = t[d] || 0;
      out[key][d] = a + (b - a) * k;
    }
  }
  return out;
}
function findPrimary(from, to) {
  let best = null;
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const f = from[key] || {}, t = to[key] || {};
    for (const d of new Set([...Object.keys(f), ...Object.keys(t)])) {
      const delta = Math.abs((t[d] || 0) - (f[d] || 0));
      if (!best || delta > best.delta) best = { key, dof: d, delta };
    }
  }
  return best && best.delta > 0.5 ? best : null;
}

/** Compare every muscle's length at the start and end of the movement. */
function analyze(inst) {
  const measure = (values) => {
    skel.apply(values);
    const m = new Map();
    for (const i of insts) {
      let L = 0;
      for (const s of i.strands) L += s.computeWorld();
      m.set(i, L / i.strands.length);
    }
    const c = new V3();
    for (const s of inst.strands) for (const w of s.world) c.add(w);
    c.multiplyScalar(1 / inst.strands.reduce((a, s) => a + s.world.length, 0));
    return { m, c };
  };
  const A = measure(player.from), B = measure(player.to);
  const syn = [], ant = [];
  for (const i of insts) {
    if (i === inst) continue;
    const r = B.m.get(i) / A.m.get(i);
    if (r < 0.95) syn.push([i, 1 - r]);
    else if (r > 1.05) ant.push([i, r - 1]);
  }
  const norm = (arr) => {
    arr.sort((a, b) => b[1] - a[1]);
    const mx = arr.length ? arr[0][1] : 1;
    return new Map(arr.map(([i, v]) => [i, 0.45 + 0.55 * (v / mx)]));
  };
  player.syn = norm(syn);
  player.ant = norm(ant);
  player.selfRatio = B.m.get(inst) / A.m.get(inst);
  player.center.copy(A.c).add(B.c).multiplyScalar(0.5);
  skel.apply(currentValues);
  for (const s of allStrands) s.computeWorld();
}

function select(inst, actionIdx = 0, opts = {}) {
  player.inst = inst;
  hovered = null;
  if (!inst) {
    player.primary = null;
    renderInfo();
    updateListActive();
    return;
  }
  const a = inst.def.actions[actionIdx] || inst.def.actions[0];
  player.actionIdx = inst.def.actions.indexOf(a);
  player.from = skel.resolve(a.from, inst.S);
  player.to = mergeVals(player.from, skel.resolve(a.to, inst.S));
  player.t = 0;
  player.playing = true;
  player.scrub = 0;
  player.primary = findPrimary(player.from, player.to);
  analyze(inst);
  renderInfo();
  updateListActive();
  updatePlayButton();
  if (opts.focus !== false) focusOn(inst, opts.reorient);
}

// ------------------------------------------------------------------ camera moves
let fly = null;
function flyTo(target, position, dur = 0.75) {
  fly = { t: 0, dur, t0: controls.target.clone(), t1: target.clone(), p0: camera.position.clone(), p1: position.clone() };
}
controls.addEventListener('start', () => { fly = null; });
function updateFly(dt) {
  if (!fly) return;
  fly.t += dt;
  const k = ease(Math.min(1, fly.t / fly.dur));
  controls.target.lerpVectors(fly.t0, fly.t1, k);
  camera.position.lerpVectors(fly.p0, fly.p1, k);
  if (k >= 1) fly = null;
}
function focusOn(inst, reorient) {
  const c = player.center.clone();
  let size = 0;
  for (const s of inst.strands) for (const w of s.world) size = Math.max(size, w.distanceTo(c));
  const offset = camera.position.clone().sub(controls.target);
  const dist = offset.length();
  const desired = THREE.MathUtils.clamp(size * 4 + 0.55, 0.75, 2.3);
  const newDist = dist > desired * 1.2 ? desired : dist;
  const dir = offset.normalize();
  // Rotate around if the muscle faces away from the camera.
  const piv = new V3();
  const bones = [...new Set(inst.strands.flatMap((s) => s.bones))];
  for (const b of bones) piv.add(new V3().setFromMatrixPosition(skel.bones[b].matrixWorld));
  piv.multiplyScalar(1 / bones.length);
  const out = c.clone().sub(piv);
  out.y = 0;
  if (out.lengthSq() > 1e-6) {
    out.normalize();
    const flatDir = new V3(dir.x, 0, dir.z).normalize();
    if (reorient && flatDir.dot(out) < -0.05) {
      const horiz = Math.sqrt(Math.max(0, 1 - dir.y * dir.y));
      dir.set(out.x * horiz, dir.y, out.z * horiz).normalize();
    }
  }
  flyTo(c, c.clone().addScaledVector(dir, newDist));
}
function setView(name) {
  const t = new V3(0, 0.9, 0);
  const d = 3.7;
  const pos = { front: new V3(0, 1.0, d), back: new V3(0, 1.0, -d), right: new V3(-d, 1.0, 0), left: new V3(d, 1.0, 0) }[name];
  flyTo(t, pos);
}

// ------------------------------------------------------------------ overlays: force arrows, moment arm, nerve
const overlay = new THREE.Group();
overlay.renderOrder = 10;
scene.add(overlay);

function makeArrow(color) {
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.95 });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 14), mat);
  shaft.renderOrder = head.renderOrder = 20;
  g.add(shaft, head);
  g.userData = { shaft, head };
  g.visible = false;
  overlay.add(g);
  return g;
}
function setArrow(a, from, dir, len, thick) {
  const { shaft, head } = a.userData;
  const hl = Math.min(len * 0.45, thick * 6);
  a.position.copy(from);
  a.quaternion.setFromUnitVectors(Yup, dir);
  shaft.scale.set(thick, Math.max(0.0001, len - hl), thick);
  shaft.position.y = (len - hl) / 2;
  head.scale.set(thick * 2.7, hl, thick * 2.7);
  head.position.y = len - hl / 2;
  a.visible = true;
}
const insArrows = Array.from({ length: 6 }, () => makeArrow(0xffd23f));
const orgArrows = Array.from({ length: 6 }, () => makeArrow(0xff9a3c));

function makeLine(color, dashed) {
  const g = new THREE.BufferGeometry().setFromPoints([new V3(), new V3()]);
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.008, gapSize: 0.005, depthTest: false, transparent: true })
    : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
  const l = new THREE.Line(g, m);
  l.renderOrder = 21;
  l.frustumCulled = false;
  l.visible = false;
  overlay.add(l);
  return l;
}
function setLine(l, a, b) {
  const p = l.geometry.attributes.position;
  p.setXYZ(0, a.x, a.y, a.z);
  p.setXYZ(1, b.x, b.y, b.z);
  p.needsUpdate = true;
  if (l.material.isLineDashedMaterial) l.computeLineDistances();
  l.visible = true;
}
const axisLine = makeLine(0x46e0ff, false);
const armLine = makeLine(0xffffff, true);
const actionLine = makeLine(0xffd23f, true);
const pivotDot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x46e0ff, depthTest: false, transparent: true }));
pivotDot.renderOrder = 22;
overlay.add(pivotDot);

const nerveMat = new THREE.MeshBasicMaterial({ color: 0x7cf3c0, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false });
const nerveMesh = new THREE.Mesh(new THREE.BufferGeometry(), nerveMat);
nerveMesh.renderOrder = 15;
nerveMesh.frustumCulled = false;
overlay.add(nerveMesh);
const glowTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xb6ffe0, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
pulse.scale.setScalar(0.075);
pulse.renderOrder = 23;
const brainGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9ad5, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
brainGlow.scale.setScalar(0.16);
brainGlow.renderOrder = 23;
const nmjGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff3a0, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
nmjGlow.renderOrder = 23;
overlay.add(pulse, brainGlow, nmjGlow);

const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _J = new V3(), _ax = new V3(), _u = new V3();

function worldPoint([b, x, y, z], S, target = new V3()) {
  const bn = skel.boneName(b, S);
  return target.set(x * SIDE_SIGN[S], y, z).sub(skel.rest[bn]).applyMatrix4(skel.bones[bn].matrixWorld);
}
function nervePoints(inst) {
  const nv = NERVES[inst.def.nerve];
  const pts = [worldPoint(BRAIN, inst.S), worldPoint(BRAINSTEM, inst.S)];
  if (!nv.cranial) {
    const exitY = nv.path[0][2];
    for (const c of CORD) if (c[2] > exitY + 0.01) pts.push(worldPoint(c, inst.S));
  }
  for (const p of nv.path) pts.push(worldPoint(p, inst.S));
  pts.push(instCenter(inst));
  return pts;
}

const labels = {
  ins: makeLabel('lbl-force'),
  org: makeLabel('lbl-force org'),
  arm: makeLabel('lbl-arm'),
};
function makeLabel(cls) {
  const d = document.createElement('div');
  d.className = `lbl ${cls}`;
  $('#labels').appendChild(d);
  return { el: d, pos: new V3(), on: false, text: '' };
}
function showLabel(l, pos, text) {
  l.pos.copy(pos);
  l.on = true;
  if (l.text !== text) { l.el.textContent = text; l.text = text; }
}

let maText = '–', lenText = '–';
function updateOverlays(ph) {
  for (const a of insArrows) a.visible = false;
  for (const a of orgArrows) a.visible = false;
  axisLine.visible = armLine.visible = actionLine.visible = pivotDot.visible = false;
  nerveMesh.visible = pulse.visible = brainGlow.visible = nmjGlow.visible = false;
  for (const k in labels) labels[k].on = false;
  const inst = player.inst;
  if (!inst) return;

  // --- force arrows at both attachments, pointing along the line of pull
  if (ui.forces && ph.act > 0.02) {
    const n = inst.strands.length;
    const len = (0.018 + 0.06 * ph.act) * (n > 1 ? 0.75 : 1);
    const insAvg = new V3(), insDir = new V3(), orgAvg = new V3(), orgDir = new V3();
    inst.strands.forEach((st, i) => {
      if (i >= insArrows.length) return;
      const c = st.centers;
      _a.copy(c[NSEG - 3]).sub(c[NSEG]).normalize();
      setArrow(insArrows[i], st.world[st.world.length - 1], _a, len, 0.0022);
      insAvg.add(st.world[st.world.length - 1]);
      insDir.add(_a);
      _b.copy(c[3]).sub(c[0]).normalize();
      setArrow(orgArrows[i], st.world[0], _b, len * 0.8, 0.0018);
      orgAvg.add(st.world[0]);
      orgDir.add(_b);
    });
    insAvg.multiplyScalar(1 / n).addScaledVector(insDir.normalize(), len * 1.1);
    orgAvg.multiplyScalar(1 / n).addScaledVector(orgDir.normalize(), len * 1.1);
    const insB = skel.baseName(inst.strands[0].pts.at(-1).bone);
    const orgB = skel.baseName(inst.strands[0].pts[0].bone);
    if (insB === orgB) {
      showLabel(labels.ins, insAvg, 'pulls toward the midline');
    } else {
      showLabel(labels.ins, insAvg, `pulls the ${BONE_LABEL[insB]}`);
      showLabel(labels.org, orgAvg, `…and equally on the ${BONE_LABEL[orgB]}`);
    }
  }

  // --- moment arm about the main joint axis
  maText = 'n/a';
  const p = player.primary;
  if (p) {
    const { bone } = skel.jointAxisWorld(p.key, p.dof, _ax);
    _ax.normalize();
    _J.setFromMatrixPosition(skel.bones[bone].matrixWorld);
    const st = inst.strands.find((s) => s.pts.some((q, i) => i && skel.movesWith(q.bone, bone) !== skel.movesWith(s.pts[i - 1].bone, bone)));
    // Effective moment arm = how much the muscle shortens per radian the joint turns (virtual work).
    let r = null;
    if (st) {
      const h = 1.0;
      const probe = (delta) => {
        const v = mergeVals(currentValues, {});
        (v[p.key] ||= {})[p.dof] = (v[p.key][p.dof] || 0) + delta;
        skel.apply(v);
        return st.measure();
      };
      r = Math.abs(probe(-h) - probe(h)) / (2 * h * (Math.PI / 180));
      skel.apply(currentValues);
    }
    // Draw it: the piece of the muscle path near the joint whose perpendicular distance to the axis matches.
    let seg = null, segDen = 0;
    if (st && r !== null) {
      let best = Infinity;
      const line = new THREE.Line3();
      for (let i = 0; i < NSEG; i++) {
        const P = st.centers[i], Q = st.centers[i + 1];
        if (P.distanceToSquared(Q) < 1e-10) continue;
        line.set(P, Q);
        if (line.closestPointToPoint(_J, true, _b).distanceTo(_J) > 0.14) continue;
        _u.copy(Q).sub(P).normalize();
        const w0 = _a.copy(_J).sub(P);
        const b = _ax.dot(_u), d = _ax.dot(w0), e = _u.dot(w0);
        const den = 1 - b * b;
        if (den < 1e-5) continue;
        const sc = (b * e - d) / den, tc = (e - b * d) / den;
        const eff = _c.copy(_J).addScaledVector(_ax, sc).distanceTo(_d.copy(P).addScaledVector(_u, tc)) * Math.sqrt(den);
        if (Math.abs(eff - r) < best) { best = Math.abs(eff - r); seg = [P, Q]; segDen = den; }
      }
    }
    if (r !== null) maText = `${(r * 100).toFixed(1)} cm`;
    if (seg) {
      const [P, Q] = seg;
      _u.copy(Q).sub(P).normalize();
      const w0 = _a.copy(_J).sub(P);
      const b = _ax.dot(_u), d = _ax.dot(w0), e = _u.dot(w0);
      const den = segDen;
      {
        const sc = (b * e - d) / den, tc = (e - b * d) / den;
        const A1 = _c.copy(_J).addScaledVector(_ax, sc);
        const B1 = _d.copy(P).addScaledVector(_u, tc);
        if (ui.forces) {
          const lo = Math.max(-0.2, Math.min(-0.055, sc - 0.02)), hi = Math.min(0.2, Math.max(0.055, sc + 0.02));
          setLine(axisLine, _b.copy(_J).addScaledVector(_ax, lo), new V3().copy(_J).addScaledVector(_ax, hi));
          pivotDot.position.copy(_J);
          pivotDot.visible = true;
          setLine(armLine, A1, B1);
          const t0 = Math.min(0, tc) - 0.05, t1 = Math.max(P.distanceTo(Q), tc) + 0.05;
          setLine(actionLine, new V3().copy(P).addScaledVector(_u, t0), new V3().copy(P).addScaledVector(_u, t1));
          showLabel(labels.arm, new V3().addVectors(A1, B1).multiplyScalar(0.5), `moment arm ${maText}`);
        }
      }
    } else if (!st) maText = 'does not cross this joint';
  }
  let L = 0, L0 = 0;
  for (const st of inst.strands) { L += st.len; L0 += st.L0; }
  const pct = (L / L0 - 1) * 100;
  lenText = `${(L / inst.strands.length * 100).toFixed(1)} cm (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs. rest)`;

  // --- nerve signal
  if (ui.nerve) {
    const pts = nervePoints(inst);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    nerveMesh.geometry.dispose();
    nerveMesh.geometry = new THREE.TubeGeometry(curve, 120, 0.0038, 6, false);
    nerveMesh.visible = true;
    nerveMat.opacity = ph.sig >= 0 ? 0.85 : 0.4;
    if (ph.sig >= 0 && ph.sig < 1) {
      curve.getPointAt(ph.sig, pulse.position);
      pulse.visible = true;
    }
    if (ph.sig >= 0 && ph.sig < 0.3) {
      brainGlow.position.copy(pts[0]);
      brainGlow.material.opacity = 1 - ph.sig / 0.3;
      brainGlow.visible = true;
    }
    if (ph.step === 3) {
      nmjGlow.position.copy(pts.at(-1));
      const k = ph.act / 0.5;
      nmjGlow.scale.setScalar(0.04 + 0.08 * k);
      nmjGlow.material.opacity = 1 - k * 0.6;
      nmjGlow.visible = true;
    }
  }
}

// ------------------------------------------------------------------ muscle appearance
let hovered = null;
let listHover = null;
function updateVisibility() {
  for (const i of insts) {
    const v = (i.def.layer === 1 ? ui.sup : ui.deep) || i === player.inst;
    if (v !== i.visible) {
      i.visible = v;
      for (const s of i.strands) s.mesh.visible = v;
    }
  }
  for (const m of boneMeshes) m.visible = ui.skel;
}
function updateMaterials(ph) {
  const sel = player.inst;
  const hov = hovered || listHover;
  for (const i of insts) {
    const m = i.material;
    let role = 'none', w = 0;
    if (i === sel) role = 'sel';
    else if (sel && player.syn.has(i)) { role = 'syn'; w = player.syn.get(i); }
    else if (sel && player.ant.has(i)) { role = 'ant'; w = player.ant.get(i); }
    m.color.setRGB(1, 1, 1);
    m.emissive.setRGB(0, 0, 0);
    let opacity = 1;
    if (role === 'sel') {
      const a = 0.22 + ph.act * 0.8;
      m.emissive.setRGB(0.6 * a, 0.14 * a, 0.03 * a);
      m.color.setRGB(1 + ph.act * 0.25, 1, 1);
    } else if (role === 'syn') {
      const a = ph.poseT * w;
      m.emissive.setRGB(0.42 * a, 0.22 * a, 0.0);
      m.color.setRGB(1, 1 + 1.6 * a, 1 + 0.3 * a);
      opacity = 0.55 + 0.45 * a;
    } else if (role === 'ant') {
      const a = ph.poseT * w;
      m.emissive.setRGB(0.02 * a, 0.14 * a, 0.5 * a);
      m.color.setRGB(1 - 0.5 * a, 1 + 1.2 * a, 1 + 3.5 * a);
      opacity = 0.55 + 0.45 * a;
    } else if (sel) {
      opacity = ui.ghost ? 0.12 : 1;
    }
    if (sel && !ui.ghost) opacity = 1;
    if (i === hov && i !== sel) {
      m.emissive.r += 0.22; m.emissive.g += 0.2; m.emissive.b += 0.12;
      opacity = Math.max(opacity, 0.85);
    }
    const tr = opacity < 0.999;
    if (tr !== i.transparent) {
      i.transparent = tr;
      m.transparent = tr;
      m.depthWrite = !tr;
      m.needsUpdate = true;
    }
    m.opacity = opacity;
  }
}

// ------------------------------------------------------------------ picking (small muscles snap to the cursor)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const _proj = new V3();
function pickTargets() {
  const t = [];
  for (const s of allStrands) if (s.mesh.visible && s.inst.material.opacity > 0.3) { s.ensureBounds(); t.push(s.mesh); }
  if (ui.skel) t.push(...boneMeshes);
  return t;
}
function pickAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = clientX - rect.left, my = clientY - rect.top;
  ndc.set((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
  const targets = pickTargets();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length && hits[0].object.userData.inst) return hits[0].object.userData.inst;

  // Snap: nearest muscle centre-line on screen, within a radius, that is not hidden behind something.
  const R = 24;
  const cands = [];
  for (const s of allStrands) {
    if (!s.mesh.visible) continue;
    let best = Infinity, bestP = null, px = 0, py = 0, pv = false;
    for (let i = 0; i <= NSEG; i++) {
      _proj.copy(s.centers[i]).project(camera);
      const ok = _proj.z < 1;
      const sx = ((_proj.x + 1) / 2) * rect.width, sy = ((1 - _proj.y) / 2) * rect.height;
      if (ok && pv) {
        const dx = sx - px, dy = sy - py;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((mx - px) * dx + (my - py) * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const ex = px + dx * t - mx, ey = py + dy * t - my;
        const d = Math.hypot(ex, ey);
        if (d < best) { best = d; bestP = new V3().lerpVectors(s.centers[i - 1], s.centers[i], t); }
      }
      px = sx; py = sy; pv = ok;
    }
    if (best < R) cands.push({ s, d: best, p: bestP });
  }
  cands.sort((a, b) => a.d - b.d);
  const camPos = camera.position;
  for (const c of cands.slice(0, 8)) {
    const dir = c.p.clone().sub(camPos);
    const dist = dir.length();
    raycaster.set(camPos, dir.normalize());
    const h = raycaster.intersectObjects(targets, false);
    if (!h.length || h[0].distance > dist - (c.s.r * 1.6 + 0.012) || h[0].object.userData.inst === c.s.inst) return c.s.inst;
  }
  return null;
}

const tooltip = $('#tooltip');
let pendingMove = null;
let down = null;
renderer.domElement.addEventListener('pointermove', (e) => { pendingMove = e; });
renderer.domElement.addEventListener('pointerleave', () => { pendingMove = null; hovered = null; tooltip.style.display = 'none'; });
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || e.button !== 0) { down = null; return; }
  down = null;
  const hit = pickAt(e.clientX, e.clientY);
  select(hit, 0, { focus: !!hit, reorient: false });
});
function processHover() {
  if (!pendingMove) return;
  const e = pendingMove;
  pendingMove = null;
  if (e.buttons) { tooltip.style.display = 'none'; return; }
  hovered = pickAt(e.clientX, e.clientY);
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  if (hovered) {
    const r = viewport.getBoundingClientRect();
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.clientX - r.left + 14}px`;
    tooltip.style.top = `${e.clientY - r.top + 12}px`;
    tooltip.innerHTML = `${esc(instName(hovered))} <span>${SIDE_LABEL[hovered.S]}</span>`;
  } else tooltip.style.display = 'none';
}

// ------------------------------------------------------------------ side panels
function defaultSide() {
  return camera.position.x - controls.target.x > 0.3 ? 'L' : 'R';
}

function buildList() {
  const list = $('#list');
  list.innerHTML = '';
  for (const r of REGIONS) {
    const defs = MUSCLES.filter((m) => m.region === r.id);
    const sec = document.createElement('section');
    sec.innerHTML = `<h3>${esc(r.label)} <small>${defs.length}</small></h3>`;
    const ul = document.createElement('ul');
    for (const d of defs) {
      const li = document.createElement('li');
      li.dataset.id = d.id;
      li.dataset.search = `${d.name} ${d.best} ${d.examples.join(' ')} ${r.label}`.toLowerCase();
      li.innerHTML = `${esc(d.name)}${d.layer === 2 ? '<em>deep</em>' : ''}`;
      li.addEventListener('click', () => select(instByKey[`${d.id}_${player.inst?.def.id === d.id ? player.inst.S : defaultSide()}`], 0, { reorient: true }));
      li.addEventListener('mouseenter', () => { listHover = instByKey[`${d.id}_${defaultSide()}`]; });
      li.addEventListener('mouseleave', () => { listHover = null; });
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    list.appendChild(sec);
  }
  $('#search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    for (const sec of list.children) {
      let any = false;
      for (const li of sec.querySelectorAll('li')) {
        const show = !q || li.dataset.search.includes(q);
        li.style.display = show ? '' : 'none';
        any ||= show;
      }
      sec.style.display = any ? '' : 'none';
    }
  });
}
function updateListActive() {
  for (const li of document.querySelectorAll('#list li')) li.classList.toggle('active', player.inst?.def.id === li.dataset.id);
  const a = document.querySelector('#list li.active');
  if (a) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

const LEGEND = `
  <div class="legend">
    <div><i class="sw sel"></i>Selected muscle (glows as it fires)</div>
    <div><i class="sw syn"></i>Also shortening — helpers (synergists)</div>
    <div><i class="sw ant"></i>Being stretched — opponents (antagonists)</div>
    <div><i class="sw force"></i>Pull on the bones (line of action)</div>
    <div><i class="sw axis"></i>Joint rotation axis · dashed = moment arm</div>
    <div><i class="sw nerve"></i>Nerve signal path</div>
  </div>`;

function stepTexts(inst) {
  const nv = NERVES[inst.def.nerve];
  return [
    'Brain: the motor cortex plans the movement and sends a command down.',
    nv.cranial ? `Brainstem: the motor nucleus for ${esc(inst.def.roots)} fires.` : `Spinal cord ${esc(inst.def.roots)}: motor neurons in the front (anterior) horn fire.`,
    `${esc(nv.name)} carries the electrical impulse to the muscle (about 50–70 m/s).`,
    'Neuromuscular junction: acetylcholine is released and fires an action potential along each muscle fibre.',
    'Calcium floods the fibres, so myosin heads grab actin and pull. The muscle shortens and pulls on both tendons.',
    'Signal stops, so calcium is pumped away and the muscle relaxes. A muscle cannot push: gravity or the opposite muscle brings the joint back.',
  ];
}

function chipList(map, cls) {
  const items = [...map.entries()].slice(0, 7);
  if (!items.length) return '<span class="none">none in this model</span>';
  return items.map(([i]) => `<button class="chip ${cls}" data-key="${i.key}">${esc(i.def.name)}${i.S !== player.inst.S ? ` <small>(${SIDE_LABEL[i.S]})</small>` : ''}</button>`).join('');
}

function renderInfo() {
  const box = $('#info');
  const inst = player.inst;
  $('#playbar').classList.toggle('disabled', !inst);
  if (!inst) {
    box.innerHTML = `
      <h2 class="intro-title">How muscles move the body</h2>
      <ul class="primer">
        <li><b>Muscles only pull.</b> A muscle can shorten and pull; it can never push. To move a joint back, the muscle on the other side (or gravity) has to pull.</li>
        <li><b>Origin and insertion.</b> Each muscle pulls its two attachment points toward each other. Usually one bone stays put (the origin) and the other moves (the insertion).</li>
        <li><b>Leverage.</b> The pull runs along the muscle's line of action. How far that line passes from the joint's axis (the <i>moment arm</i>) decides how much turning force (torque = force × moment arm) the muscle makes.</li>
        <li><b>Pairs.</b> Biceps and brachialis bend the elbow, and the triceps straightens it. Your guess is right: when you pull something toward you, the biceps is pulling the forearm up.</li>
        <li><b>The trigger.</b> Brain → spinal cord → nerve → neuromuscular junction → calcium release → the fibres contract.</li>
      </ul>
      <p class="tip">Click any muscle in the model or pick one from the list. You don't have to hit small muscles exactly: the nearest one to your cursor gets picked. Drag to orbit, scroll to zoom, right-drag to pan.</p>
      ${LEGEND}`;
    return;
  }
  const d = inst.def;
  const nv = NERVES[d.nerve];
  const p = player.primary;
  const jointName = p ? JOINTS[p.key.replace(/_(R|L)$/, '')].label : '';
  const shortPct = ((1 - player.selfRatio) * 100).toFixed(0);
  box.innerHTML = `
    <div class="info-head">
      <div class="crumb">${esc(regionLabel[d.region])} · ${d.layer === 1 ? 'superficial' : 'deep'}</div>
      <h2>${esc(d.name)}</h2>
      <div class="seg">
        ${SIDES.map((S) => `<button data-side="${S}" class="${S === inst.S ? 'on' : ''}">${SIDE_LABEL[S]}</button>`).join('')}
      </div>
      <button class="close" title="Deselect (Esc)">×</button>
    </div>
    <section>
      <h4>Movements <small>(click to animate)</small></h4>
      <div class="actions">
        ${d.actions.map((a, k) => `<button data-act="${k}" class="${k === player.actionIdx ? 'on' : ''}">${k === 0 ? '<span class="star">★</span>' : ''}${esc(a.name)}</button>`).join('')}
      </div>
    </section>
    <section class="best">
      <h4>Most activated when…</h4>
      <p>${esc(d.best)}</p>
      <div class="chips">${d.examples.map((x) => `<span class="ex">${esc(x)}</span>`).join('')}</div>
    </section>
    <section>
      <h4>How it exerts force</h4>
      <p>When it contracts, the fibres pull the <b>insertion</b> (${esc(d.insertion.split(/[(,]/)[0].trim())}) toward the <b>origin</b> (${esc(d.origin.split(/[(,.]/)[0].trim())}). The yellow arrows show the pull at both ends: equal and opposite.
      ${p ? `Because the line of pull passes some distance from the <b>${esc(jointName)}</b> axis, the pull turns the joint (${esc(DOF_LABEL[p.dof] || p.dof)} here).` : ''}</p>
      <div class="stats">
        <div><span>Moment arm about the ${esc(jointName || 'joint')} axis</span><b id="maVal">–</b></div>
        <div><span>Muscle length now</span><b id="lenVal">–</b></div>
        <div><span>Shortening during this movement</span><b>${player.selfRatio < 1 ? `${shortPct}%` : player.selfRatio > 1.01 ? `lengthens ${((player.selfRatio - 1) * 100).toFixed(0)}% (works by braking)` : '≈ 0% (holds / squeezes)'}</b></div>
      </div>
      ${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}
    </section>
    <section>
      <h4>How it gets triggered</h4>
      <div class="nerve"><b>${esc(nv.name)}</b><br><span>${esc(d.roots)} · via ${esc(nv.via)}</span></div>
      <ol class="steps">${stepTexts(inst).map((t, k) => `<li data-step="${k}">${t}</li>`).join('')}</ol>
      ${d.reflex ? `<p class="reflex"><b>Reflex test:</b> ${esc(d.reflex)}. Tapping the tendon stretches the muscle, which fires it automatically through the spinal cord without involving the brain.</p>` : ''}
    </section>
    <section>
      <h4>During this movement, according to the model</h4>
      <div class="subh"><i class="sw syn"></i>Also shortening (helpers)</div>
      <div class="chips">${chipList(player.syn, 'syn')}</div>
      <div class="subh"><i class="sw ant"></i>Being stretched (opponents)</div>
      <div class="chips">${chipList(player.ant, 'ant')}</div>
    </section>
    <section class="attach">
      <h4>Attachments</h4>
      <p><b>Origin:</b> ${esc(d.origin)}</p>
      <p><b>Insertion:</b> ${esc(d.insertion)}</p>
    </section>
    ${LEGEND}`;
  box.querySelector('.close').onclick = () => select(null);
  box.querySelectorAll('[data-side]').forEach((b) => (b.onclick = () => select(instByKey[`${d.id}_${b.dataset.side}`], player.actionIdx, { reorient: true })));
  box.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => select(inst, +b.dataset.act, { focus: false })));
  box.querySelectorAll('.chip[data-key]').forEach((b) => (b.onclick = () => select(instByKey[b.dataset.key], 0, { reorient: true })));
  box.scrollTop = 0;
  lastStep = null;
}

let lastStep = null;
let infoTick = 0;
function updateInfoLive(ph) {
  if (!player.inst) return;
  if (ph.step !== lastStep) {
    lastStep = ph.step;
    document.querySelectorAll('#info .steps li').forEach((li) => {
      const k = +li.dataset.step;
      li.classList.toggle('on', k === ph.step);
      li.classList.toggle('done', ph.step >= 0 && k < ph.step);
    });
  }
  if (++infoTick % 4) return;
  const ma = $('#maVal'), ln = $('#lenVal');
  if (ma) ma.textContent = maText;
  if (ln) ln.textContent = lenText;
}

function updateLabels() {
  const r = renderer.domElement.getBoundingClientRect();
  const placed = [];
  for (const k in labels) {
    const l = labels[k];
    if (!l.on) { l.el.style.display = 'none'; continue; }
    _proj.copy(l.pos).project(camera);
    if (_proj.z > 1) { l.el.style.display = 'none'; continue; }
    placed.push({ l, x: ((_proj.x + 1) / 2) * r.width, y: ((1 - _proj.y) / 2) * r.height });
  }
  // Nudge labels apart vertically so they never overlap.
  placed.sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = placed[j], b = placed[i];
      if (Math.abs(a.x - b.x) < 190 && b.y < a.y + 19) b.y = a.y + 19;
    }
  }
  for (const p of placed) {
    p.l.el.style.display = 'block';
    p.l.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }
}

// ------------------------------------------------------------------ toolbar
const playBtn = $('#play');
const scrubEl = $('#scrub');
function updatePlayButton() {
  playBtn.textContent = player.playing ? '❚❚' : '▶';
  playBtn.title = player.playing ? 'Pause (Space)' : 'Play (Space)';
}
let lastPh = { poseT: 0 };
function togglePlay() {
  if (!player.inst) return;
  if (player.playing) { player.playing = false; player.scrub = lastPh.poseT; }
  else { player.playing = true; player.t = 0; }
  updatePlayButton();
}
playBtn.onclick = togglePlay;
scrubEl.addEventListener('input', () => {
  if (!player.inst) return;
  player.playing = false;
  player.scrub = scrubEl.value / 1000;
  updatePlayButton();
});
$('#speed').addEventListener('change', (e) => { player.speed = +e.target.value; });
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
for (const [id, key] of [['tSup', 'sup'], ['tDeep', 'deep'], ['tSkel', 'skel'], ['tGhost', 'ghost'], ['tForce', 'forces'], ['tNerve', 'nerve']]) {
  const el = $(`#${id}`);
  el.checked = ui[key];
  el.addEventListener('change', () => { ui[key] = el.checked; });
}
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.key === 'Escape') select(null);
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

// ------------------------------------------------------------------ resize & loop
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = `${w}px`;
  renderer.domElement.style.height = `${h}px`;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
resize();

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  let ph = { sig: -1, act: 0, poseT: 0, step: -1 };
  if (player.inst) {
    if (player.playing) {
      player.t = (player.t + dt * player.speed) % TOTAL;
      ph = phaseAt(player.t);
      scrubEl.value = Math.round(ph.poseT * 1000);
    } else {
      const on = player.scrub > 0.001;
      ph = { sig: -1, act: on ? 1 : 0, poseT: player.scrub, step: on ? 4 : -1 };
    }
    currentValues = blend(player.from, player.to, ph.poseT);
  } else currentValues = {};
  lastPh = ph;
  skel.apply(currentValues);
  skel.computeDirty();
  for (const s of allStrands) if (s.needsUpdate()) s.update();
  processHover();
  updateVisibility();
  updateMaterials(ph);
  updateOverlays(ph);
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  updateInfoLive(ph);
  requestAnimationFrame(tick);
}

buildList();
renderInfo();
updatePlayButton();
requestAnimationFrame(tick);

// Small debug hook for inspection in the console.
window.__muscleViewer = { player, select: (id, S = 'R', a = 0) => select(instByKey[`${id}_${S}`], a, { reorient: true }), insts, skel, camera, controls, setView };
