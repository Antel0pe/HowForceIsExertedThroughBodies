// Squat Lab visuals that explain WHY a fault happens and what it overloads:
//  - body-segment mechanics (centre of mass, joint loads from lever arms)
//  - a proper-form ghost skeleton playing in sync
//  - lever-arm lines + load gauges at knee, hip and lower back
//  - knee-valgus visuals (floor force line, knee twist, MCL strain, adductor vs glute-medius tug of war)
//  - butt-wink visuals (hip running out of range, lumbar disc squeezed)
import * as THREE from 'three';
import { Skeleton, buildBoneVisuals, SIDES, SIDE_SIGN } from './skeleton.js';

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

  // ---- proper-form ghost (a second skeleton) + stick figure
  const ghost = new Skeleton();
  scene.add(ghost.root);
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.32, depthWrite: false });
  const ghostMeshes = buildBoneVisuals(ghost, { bone: ghostMat, cart: ghostMat, dark: ghostMat });
  ghostMeshes.forEach((m) => (m.renderOrder = 5));
  const ghostLegs = { R: line(3, 0x7fd8ff), L: line(3, 0x7fd8ff) };
  const ghostSpine = line(3, 0x7fd8ff);
  const ghostDots = Array.from({ length: 7 }, () => dot(0.01, 0x7fd8ff));

  // ---- loads
  const JOINT_COLOR = { knee: 0x6fd3ff, hip: 0xffb03c, back: 0xff7ab6 };
  const JOINT_NAME = { knee: 'knee', hip: 'hip', back: 'lower back' };
  const loadViz = {};
  for (const k of ['knee', 'hip', 'back']) {
    loadViz[k] = { lever: line(2, JOINT_COLOR[k], true), drop: line(2, JOINT_COLOR[k], true), com: dot(0.008, JOINT_COLOR[k]), gauge: gauge(0.07, 0.015) };
  }

  // ---- valgus
  const grf = { R: arrow(0x9be7ff), L: arrow(0x9be7ff) };
  const grfLever = { R: line(2, 0xff5b5b, true), L: line(2, 0xff5b5b, true) };
  const mcl = {};
  const twist = {};
  for (const S of SIDES) {
    mcl[S] = reg(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), basicMat(0xffffff, 0.9)), 43);
    const g = new THREE.Group();
    const m = basicMat(0xff5b5b);
    const R = 0.055, start = 0.7, len = 1.8;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0035, 6, 32, len), m);
    torus.rotation.z = start;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.022, 12), m);
    const end = start + len;
    cone.position.set(Math.cos(end) * R, Math.sin(end) * R, 0);
    cone.rotation.z = end; // cone points along +Y locally; rotate so it follows the arc tangent
    g.add(torus, cone);
    g.userData = { m };
    twist[S] = reg(g, 43);
  }
  const tugIn = arrow(0xffb02e), tugOut = arrow(0x5fa8ff);

  // ---- butt wink
  const hipRange = gauge(0.085, 0.009);
  const disc = reg(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 20), basicMat(0xffffff, 0.9)), 43);

  const _a = new V3(), _b = new V3();
  const cylBetween = (mesh, a, b, r) => {
    const d = _a.copy(b).sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Yup, d.clone().normalize());
    mesh.scale.set(r, d.length(), r);
    mesh.visible = true;
  };
  const loadColor = (r) => (r < 0.75 ? 0x5fd38a : r < 1.05 ? 0xffd23f : 0xff5b5b);

  /**
   * ctx: { skel, variant, ghostValues, kin, kinP, A, peaks, hipLimit, ui:{ghost,loads} }
   */
  function update(ctx) {
    const { skel, variant, kin, A, peaks, ui } = ctx;
    for (const o of items) o.visible = false;
    const fault = variant !== 'proper';

    // Ghost of proper form at the same moment.
    ghost.apply(ctx.ghostValues);
    ghost.plantFeet();
    const showGhost = fault && ui.ghost;
    ghost.root.visible = showGhost;
    if (showGhost) {
      let i = 0;
      for (const S of SIDES) {
        const pts = [bonePos(ghost, `femur_${S}`), bonePos(ghost, `tibia_${S}`), bonePos(ghost, `foot_${S}`)];
        setLine(ghostLegs[S], pts);
        for (const p of pts.slice(0, 2)) { ghostDots[i].position.copy(p); ghostDots[i++].visible = true; }
      }
      const hipMid = bonePos(ghost, 'femur_R').add(bonePos(ghost, 'femur_L')).multiplyScalar(0.5);
      const sp = [hipMid, bonePos(ghost, 'thorax'), bonePos(ghost, 'neck')];
      setLine(ghostSpine, sp);
      for (const p of sp) { ghostDots[i].position.copy(p); ghostDots[i++].visible = true; }
      showLabel('ghost', bonePos(ghost, 'head').add(new V3(0, 0.1, 0)), 'proper form', 'lbl-ghost');
    }

    // Joint loads: lever arm (dashed), line of the weight above (dashed), gauge.
    const L = jointLoads(skel);
    const LP = fault ? jointLoads(ghost) : L;
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
        setGauge(v.gauge, J, d.torque / (peaks[k] * 1.7), loadColor(r), fault ? LP[k].torque / (peaks[k] * 1.7) : null);
        const ratio = LP[k].torque > 1 ? d.torque / LP[k].torque : 1;
        const cmp = fault && Math.abs(ratio - 1) > 0.15 ? `  ×${ratio.toFixed(1)} vs proper` : '';
        showLabel(`load-${k}`, J.clone().add(new V3(0, 0.06, 0)), `${JOINT_NAME[k]} ${d.torque.toFixed(0)} N·m${cmp}`, `lbl-load-${k}${r >= 1.05 ? ' over' : ''}`);
      }
    }

    // Knees caving in: floor force line vs knee position.
    if (variant === 'valgus') {
      let worst = 0;
      for (const S of SIDES) {
        const s = SIDE_SIGN[S];
        const cop = boneLocal(skel, `foot_${S}`, 0.105 * s, 0.0, 0.03);
        // With both feet down, each foot pushes roughly straight up.
        const dir = new V3(0, 1, 0);
        setArrow(grf[S], cop, dir, 0.62, 0.0028);
        const knee = bonePos(skel, `tibia_${S}`);
        const t = knee.clone().sub(cop).dot(dir);
        const onLine = cop.clone().addScaledVector(dir, t);
        const medial = (knee.x - onLine.x) * -s; // >0: knee is inside the force line
        const strain = Math.max(0, Math.min(1, medial / 0.035));
        worst = Math.max(worst, strain);
        if (medial > 0.004) setLine(grfLever[S], [knee, onLine]);
        if (S === 'R') showLabel('grfR', cop.clone().add(new V3(-0.04, 0.16, 0)), medial > 0.004 ? `knee ${(medial * 100).toFixed(1)} cm inside the floor push → twists the knee` : 'knee over the floor push ✓', medial > 0.004 ? 'lbl-warn' : 'lbl-ok');
        // MCL: inner side of the knee, from femur to tibia.
        const a = boneLocal(skel, `femur_${S}`, 0.072 * s, 0.515, -0.006), b = boneLocal(skel, `tibia_${S}`, 0.074 * s, 0.455, 0.004);
        cylBetween(mcl[S], a, b, 0.0045 + 0.003 * strain);
        mcl[S].material.color.setRGB(1, 1 - 0.75 * strain, 1 - 0.8 * strain);
        if (strain > 0.12) {
          const tw = twist[S];
          tw.position.copy(knee);
          tw.scale.set(s * (0.7 + 0.5 * strain), 0.7 + 0.5 * strain, 1);
          tw.userData.m.opacity = 0.35 + 0.65 * strain;
          tw.visible = true;
        }
      }
      // Tug of war at the right knee: adductors pull it in, glute medius holds the thigh out.
      const kR = bonePos(skel, 'tibia_R').add(new V3(0, 0.035, 0.03));
      setArrow(tugIn, kR, new V3(1, 0, 0), 0.02 + 0.14 * A.addTfl, 0.0035);
      setArrow(tugOut, kR, new V3(-1, 0, 0), 0.02 + 0.14 * A.gmed, 0.0035);
      showLabel('tugIn', kR.clone().add(new V3(0.03 + 0.14 * A.addTfl, 0.07, 0)), 'adductors pull in', 'lbl-in');
      showLabel('tugOut', kR.clone().add(new V3(-0.16 - 0.14 * A.gmed, 0.07, 0)), 'glute medius holds out', 'lbl-out');
      if (worst > 0.12) showLabel('mcl', bonePos(skel, 'tibia_L').add(new V3(0.02, -0.14, 0)), 'knee twisted inward · inner ligament (MCL) stretched', 'lbl-warn');
    }

    // Butt wink: the hip runs out of range, so the pelvis has to tuck under; the disc is squeezed.
    if (variant === 'wink') {
      const hipFlex = kin.thigh + kin.torso - kin.wink - kin.lumbar;
      const frac = hipFlex / ctx.hipLimit;
      const atLimit = frac > 0.985;
      const hip = bonePos(skel, 'femur_R');
      setGauge(hipRange, hip, frac * 0.75, atLimit ? 0xff5b5b : 0xb58cff, 0.75);
      showLabel('hipRange', hip.clone().add(new V3(0, 0.02, -0.2)), atLimit ? `hip bend ${hipFlex.toFixed(0)}° = this hip's limit → pelvis must tuck` : `hip bend ${hipFlex.toFixed(0)}° of ${ctx.hipLimit}° range`, atLimit ? 'lbl-warn' : 'lbl-range');
      const flex = kin.wink + kin.lumbar;
      const k = Math.min(1, flex / 15);
      disc.position.copy(bonePos(skel, 'lumbar')).add(new V3(0, -0.012, 0.0));
      disc.quaternion.copy(skel.wq.lumbar);
      disc.scale.set(1 + 0.25 * k, 1 - 0.4 * k, 1 + 0.25 * k);
      disc.material.color.setRGB(1, 1 - 0.75 * k, 1 - 0.8 * k);
      disc.visible = true;
      if (flex > 6) showLabel('disc', disc.position.clone().add(new V3(0, 0, -0.05)), 'lower-back disc squeezed at the front', 'lbl-warn');
    }
  }

  return { ghost, update };
}
