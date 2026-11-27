// Squat Lab visuals that explain WHY a fault happens and what it overloads:
//  - body-segment mechanics (centre of mass, joint loads from lever arms)
//  - lever-arm lines + load gauges at knee, hip and lower back
//  - knee-valgus visual (inner knee ligament stretched)
//  - butt-wink visuals (thigh jamming into the hip, pelvis rolled under)
import * as THREE from 'three';
import { SIDES, SIDE_SIGN } from './skeleton.js';

const V3 = THREE.Vector3;
const Yup = new V3(0, 1, 0);
const BODY_WEIGHT = 70 * 9.81; // N, a 70 kg person

// ------------------------------------------------------------------ body mechanics
export const bonePos = (sk, b, t = new V3()) => t.setFromMatrixPosition(sk.bones[b].matrixWorld);
export const boneLocal = (sk, b, x, y, z) => new V3(x, y, z).sub(sk.rest[b]).applyMatrix4(sk.bones[b].matrixWorld);

// Body-segment masses (fraction of body weight, after Winter's tables, simplified) and a tag for each.
const SEGMENTS = [['pelvis', 'lumbar', 0.142, 'pelvis'], ['lumbar', 'thorax', 0.139, 'trunk'], ['thorax', 'neck', 0.216, 'trunk']];
for (const S of SIDES) {
  SEGMENTS.push([`humerus_${S}`, `ulna_${S}`, 0.028, 'arm'], [`ulna_${S}`, `hand_${S}`, 0.016, 'arm'], [`hand_${S}`, `fingers_${S}`, 0.006, 'arm'],
    [`femur_${S}`, `tibia_${S}`, 0.1, 'thigh'], [`tibia_${S}`, `foot_${S}`, 0.0465, 'shank'], [`foot_${S}`, `toes_${S}`, 0.0145, 'foot']);
}
function massCenter(sk, tags) {
  const c = new V3(), a = new V3(), b = new V3();
  let m = 0;
  for (const [p, q, mass, tag] of SEGMENTS) {
    if (tags && !tags.includes(tag)) continue;
    c.addScaledVector(bonePos(sk, p, a).add(bonePos(sk, q, b)).multiplyScalar(0.5), mass);
    m += mass;
  }
  if (!tags || tags.includes('head')) { c.addScaledVector(boneLocal(sk, 'head', 0, 1.68, 0.01), 0.081); m += 0.081; }
  return { m, c: c.multiplyScalar(1 / m) };
}
export const centerOfMass = (sk) => massCenter(sk).c;

const ABOVE = {
  back: ['trunk', 'head', 'arm'],
  hip: ['pelvis', 'trunk', 'head', 'arm'],
  knee: ['pelvis', 'trunk', 'head', 'arm', 'thigh'],
};
/**
 * Quasi-static joint loads: the weight of everything above a joint times its horizontal lever arm
 * (distance from the joint to the line of that weight). Knee and hip loads are per leg.
 */
export function jointLoads(sk) {
  const mid = (a, b) => bonePos(sk, a).add(bonePos(sk, b)).multiplyScalar(0.5);
  const J = { back: bonePos(sk, 'lumbar'), hip: mid('femur_R', 'femur_L'), knee: mid('tibia_R', 'tibia_L') };
  const out = {};
  for (const k of ['knee', 'hip', 'back']) {
    const { m, c } = massCenter(sk, ABOVE[k]);
    const lever = c.z - J[k].z;
    out[k] = { J: J[k], com: c, lever, torque: (m * BODY_WEIGHT * Math.abs(lever)) / (k === 'back' ? 1 : 2) };
  }
  return out;
}

// ------------------------------------------------------------------ drawing helpers
function basicMat(color, opacity = 0.95) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
}
function lineMat(color, dashed) {
  return dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.012, gapSize: 0.008, depthTest: false, transparent: true, opacity: 0.95 })
    : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 });
}

export function createSquatViz(scene, { camera, showLabel }) {
  const root = new THREE.Group();
  scene.add(root);
  const items = [];
  const reg = (o, order = 40) => { o.renderOrder = order; o.frustumCulled = false; o.traverse((c) => { c.renderOrder = order; c.frustumCulled = false; }); root.add(o); items.push(o); return o; };

  const line = (n, color, dashed = false) => reg(new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, () => new V3())), lineMat(color, dashed)));
  const setLine = (l, pts) => {
    const a = l.geometry.attributes.position;
    pts.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z));
    a.needsUpdate = true;
    if (l.material.isLineDashedMaterial) l.computeLineDistances();
    l.visible = true;
  };
  const dot = (r, color) => reg(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), basicMat(color)));
  const arrow = (color) => {
    const g = new THREE.Group();
    const m = basicMat(color);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), m);
    const head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 12), m);
    g.add(shaft, head);
    g.userData = { shaft, head, m };
    return reg(g, 42);
  };
  const setArrow = (a, from, dir, len, thick = 0.003) => {
    const { shaft, head } = a.userData;
    const hl = Math.min(len * 0.4, thick * 6);
    a.position.copy(from);
    a.quaternion.setFromUnitVectors(Yup, dir.clone().normalize());
    shaft.scale.set(thick, Math.max(1e-4, len - hl), thick);
    shaft.position.y = (len - hl) / 2;
    head.scale.set(thick * 2.6, hl, thick * 2.6);
    head.position.y = len - hl / 2;
    a.visible = true;
  };
  // Gauge = dim full ring + coloured arc, always facing the camera.
  const gauge = (radius, width) => {
    const g = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.RingGeometry(radius - width, radius, 48), basicMat(0x0b0e12, 0.55));
    const arc = new THREE.Mesh(new THREE.BufferGeometry(), basicMat(0x5fd38a));
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.003, width * 2.2), basicMat(0xffffff, 0.9));
    g.add(bg, arc, tick);
    g.userData = { arc, tick, radius, width, frac: -1 };
    return reg(g, 41);
  };
  const setGauge = (g, pos, frac, color, tickFrac = null) => {
    const u = g.userData;
    frac = Math.max(0, Math.min(1, frac));
    if (Math.abs(frac - u.frac) > 0.002) {
      u.arc.geometry.dispose();
      u.arc.geometry = new THREE.RingGeometry(u.radius - u.width, u.radius, 48, 1, Math.PI / 2, -Math.max(0.001, frac) * Math.PI * 2);
      u.frac = frac;
    }
    u.arc.material.color.set(color);
    u.tick.visible = tickFrac !== null;
    if (tickFrac !== null) {
      const ang = Math.PI / 2 - Math.min(1, tickFrac) * Math.PI * 2;
      u.tick.position.set(Math.cos(ang) * (u.radius - u.width / 2), Math.sin(ang) * (u.radius - u.width / 2), 0);
      u.tick.rotation.z = ang - Math.PI / 2;
    }
    g.position.copy(pos);
    g.quaternion.copy(camera.quaternion);
    g.visible = true;
  };

  // ---- loads
  const JOINT_COLOR = { knee: 0x6fd3ff, hip: 0xffb03c, back: 0xff7ab6 };
  const JOINT_NAME = { knee: 'knee', hip: 'hip', back: 'lower back' };
  const loadViz = {};
  for (const k of ['knee', 'hip', 'back']) {
    loadViz[k] = { lever: line(2, JOINT_COLOR[k], true), drop: line(2, JOINT_COLOR[k], true), com: dot(0.008, JOINT_COLOR[k]), gauge: gauge(0.07, 0.015) };
  }

  // ---- knees caving in: the inner knee ligament (MCL) on each knee, throbbing red when stretched
  const mcl = {};
  for (const S of SIDES) mcl[S] = reg(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), basicMat(0xffffff, 0.9)), 43);

  // ---- butt wink: the thigh jams into the hip, then the pelvis is rolled under
  const pushArrow = arrow(0xff3b2f);
  const contact = dot(0.016, 0xff2a1a);
  const tuck = (() => {
    // Arc around the pelvis in the side (YZ) plane: from behind, curling down and forward under it.
    const r = 0.13, pts = [];
    for (let i = 0; i <= 24; i++) {
      const θ = THREE.MathUtils.degToRad(150 + (255 - 150) * (i / 24));
      pts.push(new V3(0, Math.sin(θ) * r, Math.cos(θ) * r));
    }
    const m = basicMat(0xff3b2f);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.005, 6), m));
    const end = pts[pts.length - 1], prev = pts[pts.length - 2];
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.034, 12), m);
    cone.position.copy(end);
    cone.quaternion.setFromUnitVectors(Yup, end.clone().sub(prev).normalize());
    g.add(cone);
    g.userData = { m };
    return reg(g, 43);
  })();

  const _a = new V3();
  const cylBetween = (mesh, a, b, r) => {
    const d = _a.copy(b).sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Yup, d.clone().normalize());
    mesh.scale.set(r, d.length(), r);
    mesh.visible = true;
  };
  const loadColor = (r) => (r < 0.75 ? 0x5fd38a : r < 1.05 ? 0xffd23f : 0xff5b5b);

  /**
   * ctx: { skel, variant, kin, A, peaks, hipLimit, pulse (0..1 throb), ui:{loads} }
   * Returns { kneeStrain } (0..1) for the knee close-up.
   */
  function update(ctx) {
    const { skel, variant, kin, peaks, ui } = ctx;
    const pulse = ctx.pulse ?? 0;
    for (const o of items) o.visible = false;
    let kneeStrain = 0;

    // Joint loads: lever arm (dashed), line of the weight above (dashed), gauge.
    const L = jointLoads(skel);
    if (ui.loads && variant !== 'valgus') {
      for (const k of ['knee', 'hip', 'back']) {
        const v = loadViz[k], d = L[k];
        // Draw on the right side (the side the side-view camera sees); the back is on the midline.
        const J = k === 'back' ? d.J.clone() : bonePos(skel, k === 'knee' ? 'tibia_R' : 'femur_R');
        const foot = new V3(J.x, J.y, d.com.z);
        const top = new V3(J.x, d.com.y, d.com.z);
        setLine(v.lever, [J, foot]);
        setLine(v.drop, [top, foot]);
        v.com.position.copy(top);
        v.com.visible = true;
        const r = d.torque / peaks[k];
        setGauge(v.gauge, J, d.torque / (peaks[k] * 1.7), loadColor(r));
        showLabel(`load-${k}`, J.clone().add(new V3(0, 0.06, 0)), `${JOINT_NAME[k]} load`, `lbl-load-${k}${r >= 1.05 ? ' over' : ''}`);
      }
    }

    // Knees caving in: how far each knee sits inside its foot decides how hard the MCL is stretched.
    if (variant === 'valgus') {
      for (const S of SIDES) {
        const s = SIDE_SIGN[S];
        const foot = boneLocal(skel, `foot_${S}`, 0.105 * s, 0.0, 0.03);
        const knee = bonePos(skel, `tibia_${S}`);
        const medial = (knee.x - foot.x) * -s; // >0: knee has dropped inside the foot
        const strain = Math.max(0, Math.min(1, medial / 0.035));
        kneeStrain = Math.max(kneeStrain, strain);
        const a = boneLocal(skel, `femur_${S}`, 0.072 * s, 0.515, -0.006), b = boneLocal(skel, `tibia_${S}`, 0.074 * s, 0.455, 0.004);
        const throb = strain > 0.4 ? pulse * (strain - 0.4) / 0.6 : 0;
        cylBetween(mcl[S], a, b, 0.0045 + 0.003 * strain + 0.003 * throb);
        mcl[S].material.color.setRGB(1, Math.max(0, 1 - 0.8 * strain - 0.2 * throb), Math.max(0, 1 - 0.85 * strain - 0.15 * throb));
      }
    }

    // Butt wink: at its limit the thigh jams into the hip; going lower anyway rolls the pelvis under.
    if (variant === 'wink') {
      const hipFlex = kin.thigh + kin.torso - kin.wink - kin.lumbar;
      const near = Math.max(0, Math.min(1, (hipFlex / ctx.hipLimit - 0.88) / 0.11));
      const hip = bonePos(skel, 'femur_R'), knee = bonePos(skel, 'tibia_R');
      if (near > 0.02) {
        const from = knee.clone().lerp(hip, 0.4);
        const dir = hip.clone().sub(from);
        const len = dir.length() * 0.78;
        setArrow(pushArrow, from, dir.normalize(), len, 0.004 + 0.004 * near + 0.002 * near * pulse);
        pushArrow.userData.m.opacity = 0.35 + 0.6 * near;
        contact.position.copy(hip).add(new V3(0, 0.0, 0.03));
        contact.scale.setScalar(0.6 + 0.6 * near + 0.5 * near * pulse);
        contact.material.opacity = near * (0.55 + 0.45 * pulse);
        contact.visible = true;
      }
      const w = Math.max(0, Math.min(1, kin.wink / 14));
      if (w > 0.03) {
        tuck.position.copy(bonePos(skel, 'pelvis'));
        tuck.scale.setScalar(0.8 + 0.3 * w);
        tuck.userData.m.opacity = 0.3 + 0.7 * w;
        tuck.visible = true;
      }
    }
    return { kneeStrain };
  }

  return { update };
}
