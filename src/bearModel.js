// Bear Run: a grizzly's skeleton, its main running muscles, and a gallop.
//
// Same conventions as the human skeleton: meters, Y up, the bear faces +Z, its RIGHT side is at
// negative X, and every bone's rest rotation is identity, so points are authored in world space.
// The run happens in the side (YZ) plane, so every joint only turns about the X axis.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SIDES, SIDE_SIGN } from './skeleton.js';
import { Strand, makeFiberTexture } from './muscleMesh.js';

const V3 = THREE.Vector3;
const X = new V3(1, 0, 0);
const Y = new V3(0, 1, 0);
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const sm = (k) => k * k * (3 - 2 * k);
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ------------------------------------------------------------------ skeleton
// pivot = the joint the bone turns about. x values are lateral distances, mirrored per side.
export const BEAR_BONES = [
  { name: 'pelvis', parent: null, pivot: [0, 0.8, -0.6] },
  { name: 'lumbar', parent: 'pelvis', pivot: [0, 0.86, -0.5] },
  { name: 'thorax', parent: 'lumbar', pivot: [0, 0.9, -0.1] },
  { name: 'neck', parent: 'thorax', pivot: [0, 0.94, 0.48] },
  { name: 'head', parent: 'neck', pivot: [0, 0.89, 0.76] },
  { name: 'jaw', parent: 'head', pivot: [0, 0.84, 0.78] },
  { name: 'scapula', parent: 'thorax', pivot: [0.165, 0.89, 0.39], sided: true }, // turns about its middle
  { name: 'humerus', parent: 'scapula', pivot: [0.19, 0.7, 0.5], sided: true },
  { name: 'forearm', parent: 'humerus', pivot: [0.19, 0.42, 0.4], sided: true },
  { name: 'forepaw', parent: 'forearm', pivot: [0.2, 0.1, 0.47], sided: true },
  { name: 'foreclaws', parent: 'forepaw', pivot: [0.205, 0.04, 0.6], sided: true },
  { name: 'femur', parent: 'pelvis', pivot: [0.15, 0.74, -0.66], sided: true },
  { name: 'tibia', parent: 'femur', pivot: [0.16, 0.44, -0.52], sided: true },
  { name: 'hindpaw', parent: 'tibia', pivot: [0.16, 0.1, -0.74], sided: true },
  { name: 'hindtoes', parent: 'hindpaw', pivot: [0.17, 0.035, -0.46], sided: true },
];
const SIDED = new Set(BEAR_BONES.filter((d) => d.sided).map((d) => d.name));
export const BEAR_BONE_LABEL = {
  pelvis: 'pelvis', lumbar: 'lower back', thorax: 'rib cage & spine', neck: 'neck', head: 'skull', jaw: 'jaw',
  scapula: 'shoulder blade', humerus: 'upper arm bone', forearm: 'forearm bones', forepaw: 'front paw', foreclaws: 'front claws',
  femur: 'thigh bone', tibia: 'shin bones', hindpaw: 'back paw', hindtoes: 'back toes',
};

/** Same interface the muscle strands use from the human Skeleton (bones, rest, wq, dirty, boneName). */
export class BearSkeleton {
  constructor() {
    this.bones = {};
    this.rest = {};
    this.wq = {};
    this.dirty = {};
    this.prev = {};
    this.parentOf = {};
    this.order = [];
    for (const d of BEAR_BONES) {
      for (const S of d.sided ? SIDES : [null]) {
        const s = S ? SIDE_SIGN[S] : 1;
        const name = S ? `${d.name}_${S}` : d.name;
        const pivot = new V3(d.pivot[0] * s, d.pivot[1], d.pivot[2]);
        const obj = new THREE.Object3D();
        obj.name = name;
        const parent = d.parent ? (S && SIDED.has(d.parent) ? `${d.parent}_${S}` : d.parent) : null;
        if (parent) {
          this.bones[parent].add(obj);
          obj.position.copy(pivot).sub(this.rest[parent]);
        } else {
          obj.position.copy(pivot);
          this.root = obj;
        }
        this.bones[name] = obj;
        this.rest[name] = pivot;
        this.wq[name] = new THREE.Quaternion();
        this.prev[name] = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        this.dirty[name] = true;
        this.parentOf[name] = parent;
        this.order.push(name);
      }
    }
    this._p = new V3();
    this._s = new V3();
  }

  boneName(name, S) { return SIDED.has(name) ? `${name}_${S}` : name; }

  /**
   * W: world angle (radians, about X) per bone (missing bones follow their parent); root: {y, z};
   * offsets: {bone: {y, z}} shifts a bone's joint from where it sits on its parent.
   */
  apply(W = {}, root = null, offsets = {}) {
    const full = {};
    for (const n of this.order) {
      const par = this.parentOf[n];
      const pw = par ? full[par] : 0;
      full[n] = W[n] ?? pw;
      this.bones[n].quaternion.setFromAxisAngle(X, full[n] - pw);
      if (par) {
        const r = this.rest[n], rp = this.rest[par], o = offsets[n];
        this.bones[n].position.set(r.x - rp.x, r.y - rp.y + (o ? o.y : 0), r.z - rp.z + (o ? o.z : 0));
      }
    }
    const r = this.rest[this.root.name];
    this.root.position.set(r.x, root ? root.y : r.y, root ? root.z : r.z);
    this.root.updateMatrixWorld(true);
    for (const n of this.order) this.bones[n].matrixWorld.decompose(this._p, this.wq[n], this._s);
  }

  /** Flag bones whose world matrix changed since the last call. */
  computeDirty() {
    for (const n of this.order) {
      const a = this.bones[n].matrixWorld.elements, b = this.prev[n].elements;
      let d = false;
      for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-7) { d = true; break; }
      this.dirty[n] = d;
      if (d) this.prev[n].copy(this.bones[n].matrixWorld);
    }
  }

  /** Side-plane forward kinematics: pivot {y, z} of every bone for world angles W (all bones filled). */
  fk(W, root, offsets = {}) {
    const P = {};
    for (const n of this.order) {
      const par = this.parentOf[n];
      if (!par) { P[n] = { y: root.y, z: root.z }; continue; }
      const r = this.rest[n], rp = this.rest[par], a = W[par], o = offsets[n];
      const dy = r.y - rp.y + (o ? o.y : 0), dz = r.z - rp.z + (o ? o.z : 0);
      P[n] = { y: P[par].y + dy * Math.cos(a) - dz * Math.sin(a), z: P[par].z + dy * Math.sin(a) + dz * Math.cos(a) };
    }
    return P;
  }
}

// ------------------------------------------------------------------ bone shapes
function capsuleG(a, b, r, sx = 1, sz = 1) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(len - r * 0.6, 0.001), 4, 10);
  g.scale(sx, 1, sz);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}
function ellipsoidG(c, rx, ry, rz, along = null) {
  const g = new THREE.SphereGeometry(1, 18, 12);
  g.scale(rx, ry, rz);
  if (along) g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, along.clone().normalize()));
  g.translate(c.x, c.y, c.z);
  return g;
}
function tubeG(points, r, segs = 20) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), segs, r, 7, false);
}
function coneG(base, tip, r) {
  const dir = tip.clone().sub(base);
  const g = new THREE.ConeGeometry(r, dir.length(), 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()));
  const mid = base.clone().add(tip).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

function buildBearBones(skel, mats) {
  const parts = {};
  const add = (bone, geo, kind = 'bone') => (((parts[bone] ||= {})[kind] ||= []).push(geo));
  const v = (x, y, z) => new V3(x, y, z);

  // ---- skull: braincase, long muzzle, crest, cheekbones, jaw, canines
  add('head', ellipsoidG(v(0, 0.895, 0.81), 0.085, 0.07, 0.095));
  add('head', capsuleG(v(0, 0.875, 0.86), v(0, 0.84, 1.03), 0.042, 1.1, 0.85));
  add('head', ellipsoidG(v(0, 0.845, 1.05), 0.032, 0.026, 0.02), 'dark');
  add('head', capsuleG(v(0, 0.962, 0.73), v(0, 0.94, 0.88), 0.008));
  add('jaw', capsuleG(v(0.03, 0.8, 1.0), v(-0.03, 0.8, 1.0), 0.014));
  for (const s of [-1, 1]) {
    add('head', tubeG([v(0.04 * s, 0.865, 0.95), v(0.088 * s, 0.875, 0.86), v(0.072 * s, 0.89, 0.77)], 0.011));
    add('head', ellipsoidG(v(0.055 * s, 0.91, 0.915), 0.018, 0.018, 0.018), 'dark');
    add('jaw', capsuleG(v(0.065 * s, 0.84, 0.77), v(0.032 * s, 0.8, 1.0), 0.016));
    add('head', coneG(v(0.026 * s, 0.845, 1.0), v(0.026 * s, 0.81, 1.012), 0.008), 'claw');
    add('jaw', coneG(v(0.024 * s, 0.8, 0.99), v(0.024 * s, 0.832, 0.998), 0.007), 'claw');
  }

  // ---- spine
  const vertebra = (bone, c, size, spineH, tilt = 0.012, wings = 0) => {
    add(bone, ellipsoidG(c, 0.02 * size, 0.02 * size, 0.024 * size));
    add(bone, capsuleG(c.clone().add(v(0, 0.015, 0)), c.clone().add(v(0, 0.015 + spineH, -tilt)), 0.0065));
    if (wings) add(bone, capsuleG(c.clone().add(v(-wings, -0.004, 0)), c.clone().add(v(wings, -0.004, 0)), 0.006));
  };
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    vertebra('neck', v(0, 0.94 - 0.05 * t, 0.48 + 0.27 * t), 1.15, 0.025, 0.004, 0.035);
  }
  for (let i = 0; i < 14; i++) {
    const t = (i + 0.5) / 14, z = -0.1 + 0.56 * t;
    const spineH = 0.03 + 0.06 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 2) * (t > 0.45 ? 1 : 0.6);
    vertebra('thorax', v(0, 0.9 + 0.04 * t, z), 1, spineH, 0.02);
  }
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    vertebra('lumbar', v(0, 0.86 + 0.036 * t, -0.5 + 0.38 * t), 1.15, 0.035, -0.006, 0.05);
  }
  add('pelvis', ellipsoidG(v(0, 0.86, -0.6), 0.03, 0.022, 0.075));
  for (let i = 0; i < 5; i++) add('pelvis', ellipsoidG(v(0, 0.845 - 0.012 * i, -0.69 - 0.03 * i), 0.012 - 0.0015 * i, 0.011, 0.016));

  // ---- ribs + breastbone (deep chest)
  const NR = 13;
  for (let i = 0; i < NR; i++) {
    const t = i / (NR - 1), z = 0.42 - 0.46 * t;
    const ys = 0.94 - 0.03 * t;
    const yb = 0.5 + 0.02 * t + (i >= NR - 3 ? 0.1 + 0.05 * (i - (NR - 3)) : 0);
    const w = 0.11 + 0.08 * Math.sin(Math.PI * (0.25 + 0.7 * t));
    for (const s of [-1, 1]) {
      add('thorax', tubeG([v(0.03 * s, ys - 0.01, z), v(0.8 * w * s, ys - 0.05, z - 0.012), v(w * s, (ys + yb) / 2, z - 0.02),
        v(0.8 * w * s, yb + 0.06, z - 0.005), v((i >= NR - 3 ? 0.55 * w : 0.025) * s, yb, z + 0.03)], 0.0065, 18));
    }
  }
  add('thorax', capsuleG(v(0, 0.5, -0.0), v(0, 0.56, 0.45), 0.013, 1.6, 0.8));

  // ---- pelvis halves
  for (const s of [-1, 1]) {
    const p = (x, y, z) => v(x * s, y, z);
    add('pelvis', capsuleG(p(0.06, 0.875, -0.51), p(0.13, 0.755, -0.65), 0.022, 1.4, 0.7));
    add('pelvis', capsuleG(p(0.125, 0.74, -0.68), p(0.075, 0.725, -0.83), 0.016));
    add('pelvis', capsuleG(p(0.125, 0.73, -0.665), p(0.02, 0.705, -0.705), 0.012));
    add('pelvis', capsuleG(p(0.075, 0.725, -0.83), p(0.02, 0.705, -0.75), 0.011));
    add('pelvis', ellipsoidG(p(0.135, 0.742, -0.66), 0.028, 0.028, 0.028), 'cart');
  }

  for (const S of SIDES) {
    const s = SIDE_SIGN[S];
    const p = (x, y, z) => v(x * s, y, z);
    const B = (n) => `${n}_${S}`;
    // ---- front leg
    const scTop = p(0.15, 1.0, 0.34), scBot = p(0.185, 0.73, 0.48);
    add(B('scapula'), ellipsoidG(scTop.clone().lerp(scBot, 0.48), 0.01, 0.155, 0.075, scBot.clone().sub(scTop)));
    add(B('scapula'), capsuleG(p(0.168, 0.98, 0.35), p(0.2, 0.76, 0.47), 0.008));
    add(B('scapula'), ellipsoidG(p(0.19, 0.722, 0.49), 0.02, 0.02, 0.02), 'cart');
    add(B('humerus'), ellipsoidG(p(0.19, 0.705, 0.485), 0.034, 0.034, 0.034));
    add(B('humerus'), capsuleG(p(0.19, 0.69, 0.5), p(0.19, 0.44, 0.405), 0.022));
    add(B('humerus'), capsuleG(p(0.165, 0.42, 0.4), p(0.215, 0.42, 0.4), 0.022));
    add(B('forearm'), capsuleG(p(0.183, 0.43, 0.385), p(0.188, 0.11, 0.455), 0.015));
    add(B('forearm'), capsuleG(p(0.205, 0.41, 0.415), p(0.212, 0.11, 0.48), 0.016));
    add(B('forearm'), ellipsoidG(p(0.185, 0.455, 0.358), 0.02, 0.024, 0.02));
    add(B('forepaw'), ellipsoidG(p(0.2, 0.1, 0.48), 0.045, 0.024, 0.035));
    for (const o of [-0.04, -0.02, 0, 0.02, 0.04]) {
      add(B('forepaw'), capsuleG(p(0.2 + o, 0.09, 0.49), p(0.2 + 1.35 * o, 0.045, 0.585), 0.01));
      const a = p(0.2 + 1.4 * o, 0.04, 0.6), b = p(0.2 + 1.5 * o, 0.034, 0.64);
      add(B('foreclaws'), capsuleG(a, b, 0.009));
      add(B('foreclaws'), tubeG([b, p(0.2 + 1.55 * o, 0.034, 0.685), p(0.2 + 1.6 * o, 0.012, 0.72)], 0.006, 8), 'claw');
    }
    // ---- back leg
    add(B('femur'), ellipsoidG(p(0.14, 0.745, -0.655), 0.03, 0.03, 0.03));
    add(B('femur'), ellipsoidG(p(0.18, 0.772, -0.675), 0.02, 0.024, 0.022));
    add(B('femur'), capsuleG(p(0.155, 0.73, -0.655), p(0.16, 0.46, -0.53), 0.024));
    add(B('femur'), capsuleG(p(0.138, 0.44, -0.525), p(0.185, 0.44, -0.525), 0.024));
    add(B('tibia'), capsuleG(p(0.155, 0.43, -0.53), p(0.16, 0.12, -0.735), 0.019));
    add(B('tibia'), capsuleG(p(0.188, 0.42, -0.55), p(0.186, 0.12, -0.745), 0.009));
    add(B('tibia'), ellipsoidG(p(0.16, 0.47, -0.488), 0.016, 0.022, 0.012));
    add(B('hindpaw'), capsuleG(p(0.16, 0.1, -0.74), p(0.16, 0.068, -0.805), 0.022));
    add(B('hindpaw'), ellipsoidG(p(0.163, 0.085, -0.7), 0.04, 0.024, 0.04));
    for (const o of [-0.04, -0.02, 0, 0.02, 0.04]) {
      add(B('hindpaw'), capsuleG(p(0.163 + o, 0.075, -0.68), p(0.17 + 1.3 * o, 0.04, -0.47), 0.011));
      const a = p(0.17 + 1.3 * o, 0.035, -0.46), b = p(0.17 + 1.4 * o, 0.03, -0.42);
      add(B('hindtoes'), capsuleG(a, b, 0.009));
      add(B('hindtoes'), tubeG([b, p(0.17 + 1.45 * o, 0.028, -0.395), p(0.17 + 1.5 * o, 0.014, -0.37)], 0.005, 8), 'claw');
    }
  }

  const meshes = [];
  for (const bone in parts) {
    for (const kind in parts[bone]) {
      const g = mergeGeometries(parts[bone][kind].map((x) => x.toNonIndexed()));
      const r = skel.rest[bone];
      g.translate(-r.x, -r.y, -r.z);
      const m = new THREE.Mesh(g, mats[kind]);
      m.userData.bone = bone;
      skel.bones[bone].add(m);
      meshes.push(m);
    }
  }
  return meshes;
}

// ------------------------------------------------------------------ muscles
// limb: which leg's timing drives it ('fore', 'hind') or the whole stride ('trunk').
// run: what it does in the run. note: optional bear fact.
export const BEAR_MUSCLES = [
  // front leg
  {
    id: 'hump', act: { name: 'Pulls the shoulder blade up against the spine', shift: { scapula: { y: 0.045, z: -0.01 } } }, limb: 'fore', name: 'Shoulder hump (trapezius & rhomboids)', flat: [0.4, 1, 0], thick: 0.55,
    strands: [
      { pts: [['thorax', 0.02, 1.04, 0.14], ['scapula', 0.14, 0.98, 0.3]], r: 0.035 },
      { pts: [['thorax', 0.02, 1.075, 0.32], ['scapula', 0.15, 1.005, 0.36]], r: 0.048 },
      { pts: [['neck', 0.03, 1.01, 0.56], ['scapula', 0.16, 0.98, 0.4]], r: 0.036 },
    ],
    run: 'Clamps the shoulder blades to the body as the front paws hit, and swings them.',
    note: "A grizzly's hump is this muscle, not fat. It powers digging.",
  },
  {
    id: 'lats', act: { name: 'Pulls the front leg back', to: { humerus: 0.6 } }, limb: 'fore', name: 'Latissimus dorsi', flat: [1, 0.3, 0], thick: 0.35,
    strands: [
      { pts: [['lumbar', 0.04, 0.91, -0.32], ['thorax', 0.16, 0.8, 0.15], ['humerus', 0.17, 0.62, 0.46]], r: 0.04 },
      { pts: [['thorax', 0.04, 0.96, 0.0], ['thorax', 0.16, 0.85, 0.22], ['humerus', 0.175, 0.64, 0.47]], r: 0.04 },
    ],
    run: 'Pulls the front leg back along the ground: the main pull of the front end.',
  },
  {
    id: 'pecs', act: { name: 'Pulls the front leg back', to: { humerus: 0.45 } }, limb: 'fore', name: 'Chest muscles (pectorals)',
    strands: [
      { pts: [['thorax', 0.02, 0.53, 0.4], ['humerus', 0.19, 0.6, 0.5]], r: 0.035 },
      { pts: [['thorax', 0.03, 0.5, 0.12], ['thorax', 0.1, 0.52, 0.32], ['humerus', 0.18, 0.58, 0.48]], r: 0.035 },
    ],
    run: 'Pull the front leg back and in, and hold the chest up between the front legs.',
    note: 'Bears have no collarbone: the chest hangs between the front legs in a sling of muscle.',
  },
  {
    id: 'serratus', act: { name: 'Lifts the chest between the front legs', lift: 0.06, sling: true }, limb: 'fore', name: 'Serratus ventralis (body sling)', flat: [1, 0, 0], thick: 0.4,
    strands: [
      { pts: [['scapula', 0.13, 0.96, 0.33], ['thorax', 0.165, 0.7, 0.12]], r: 0.03 },
      { pts: [['scapula', 0.13, 0.97, 0.38], ['thorax', 0.175, 0.7, 0.26]], r: 0.03 },
      { pts: [['scapula', 0.13, 0.98, 0.42], ['neck', 0.07, 0.86, 0.58]], r: 0.03 },
    ],
    run: "Hangs the body's weight from the shoulder blades while a front paw is down.",
  },
  {
    id: 'brachioceph', act: { name: 'Swings the front leg forward', to: { humerus: -0.65 } }, limb: 'fore', name: 'Brachiocephalicus',
    strands: [{ pts: [['head', 0.05, 0.9, 0.74], ['neck', 0.08, 0.86, 0.6], ['humerus', 0.2, 0.58, 0.5]], r: 0.035 }],
    run: 'Swings the front leg forward, pulling from the head and neck.',
  },
  {
    id: 'deltoid', act: { name: 'Folds the shoulder, lifting the leg', to: { humerus: 0.45 } }, limb: 'fore', name: 'Deltoid',
    strands: [
      { pts: [['scapula', 0.185, 0.9, 0.4], ['humerus', 0.215, 0.6, 0.47]], r: 0.034 },
      { pts: [['scapula', 0.2, 0.77, 0.5], ['humerus', 0.215, 0.62, 0.49]], r: 0.028 },
    ],
    run: 'Lifts the upper arm and swings it forward.',
  },
  {
    id: 'cuff', act: { name: 'Steadies the shoulder, swings the arm forward', to: { humerus: -0.4 } }, limb: 'fore', name: 'Shoulder-blade muscles (supra- & infraspinatus)',
    strands: [
      { pts: [['scapula', 0.17, 0.95, 0.32], ['humerus', 0.205, 0.72, 0.53]], r: 0.034 },
      { pts: [['scapula', 0.17, 0.95, 0.4], ['humerus', 0.21, 0.73, 0.52]], r: 0.03 },
    ],
    run: 'Brace the shoulder joint as the paw lands.',
  },
  {
    id: 'triceps', act: { name: 'Straightens the elbow', from: { humerus: 0.25, forearm: -1.1 }, to: { humerus: 0.25, forearm: 0 } }, limb: 'fore', name: 'Triceps',
    strands: [
      { pts: [['scapula', 0.165, 0.82, 0.38], ['forearm', 0.19, 0.47, 0.35]], r: 0.045 },
      { pts: [['humerus', 0.2, 0.64, 0.47], ['forearm', 0.2, 0.46, 0.355]], r: 0.038 },
      { pts: [['humerus', 0.165, 0.62, 0.46], ['forearm', 0.18, 0.46, 0.355]], r: 0.034 },
    ],
    run: "Straightens the elbow so the front leg doesn't buckle on landing.",
  },
  {
    id: 'elbowFlex', act: { name: 'Bends the elbow', from: { humerus: 0.25 }, to: { humerus: 0.25, forearm: -1.1 } }, limb: 'fore', name: 'Elbow benders (biceps & brachialis)',
    strands: [{ pts: [['scapula', 0.19, 0.76, 0.51], ['humerus', 0.19, 0.55, 0.52], ['forearm', 0.2, 0.36, 0.44]], r: 0.026 }],
    run: 'Fold the elbow so the paw clears the ground as the leg swings forward.',
  },
  {
    id: 'foreFlex', act: { name: 'Curls the paw and claws back', from: { forearm: -0.3 }, to: { forearm: -0.3, forepaw: 1.2, foreclaws: 0.5 } }, limb: 'fore', name: 'Paw & claw flexors', ts: 0.05, te: 0.35,
    strands: [{ pts: [['humerus', 0.18, 0.43, 0.38], ['forearm', 0.185, 0.25, 0.4], ['forepaw', 0.2, 0.06, 0.47], ['foreclaws', 0.205, 0.03, 0.6]], r: 0.03 }],
    run: 'Grip the ground with the paw and claws while it pulls.',
    note: 'The front claws grow to about 10 cm: built for digging more than running.',
  },
  {
    id: 'foreExt', act: { name: 'Straightens the paw forward', from: { forearm: -0.3, forepaw: 1.2, foreclaws: 0.4 }, to: { forearm: -0.3, forepaw: -0.1 } }, limb: 'fore', name: 'Paw extensors', ts: 0.05, te: 0.35,
    strands: [{ pts: [['humerus', 0.21, 0.47, 0.43], ['forearm', 0.21, 0.25, 0.47], ['forepaw', 0.21, 0.11, 0.51], ['foreclaws', 0.205, 0.06, 0.6]], r: 0.022 }],
    run: 'Flick the paw forward and flat, ready to land.',
  },
  // back leg
  {
    id: 'glutes', act: { name: 'Swings the thigh back', to: { femur: 0.55 } }, limb: 'hind', name: 'Glutes', flat: [1, 0.4, 0], thick: 0.5,
    strands: [
      { pts: [['pelvis', 0.08, 0.9, -0.5], ['femur', 0.18, 0.78, -0.66]], r: 0.05 },
      { pts: [['pelvis', 0.06, 0.89, -0.62], ['femur', 0.18, 0.77, -0.69]], r: 0.045 },
    ],
    run: 'Swing the thigh back hard: the main push of the back end.',
  },
  {
    id: 'bicepsFem', act: { name: 'Pulls the thigh back, bends the knee', to: { femur: 0.4, tibia: 0.5 } }, limb: 'hind', name: 'Outer hamstring (biceps femoris)', flat: [1, 0, 0], thick: 0.5,
    strands: [
      { pts: [['pelvis', 0.09, 0.78, -0.82], ['femur', 0.2, 0.62, -0.72], ['tibia', 0.19, 0.38, -0.56]], r: 0.05 },
      { pts: [['pelvis', 0.08, 0.8, -0.8], ['femur', 0.19, 0.55, -0.7], ['tibia', 0.19, 0.27, -0.62]], r: 0.04 },
    ],
    run: 'Pulls the thigh back: drives the body forward over the planted paw.',
  },
  {
    id: 'semiT', act: { name: 'Pulls the thigh back, bends the knee', to: { femur: 0.35, tibia: 0.65 } }, limb: 'hind', name: 'Inner hamstrings (semitendinosus & semimembranosus)',
    strands: [{ pts: [['pelvis', 0.05, 0.74, -0.84], ['femur', 0.11, 0.55, -0.68], ['tibia', 0.12, 0.33, -0.56]], r: 0.04 }],
    run: 'Fire first: brake the leg as it swings forward, then pull it back once the paw lands.',
  },
  {
    id: 'quads', act: { name: 'Straightens the knee', from: { femur: -0.3, tibia: 1.1 }, to: { femur: -0.3, tibia: 0 } }, limb: 'hind', name: 'Quadriceps',
    strands: [
      { pts: [['pelvis', 0.12, 0.81, -0.57], ['femur', 0.18, 0.62, -0.6], ['tibia', 0.165, 0.47, -0.478], ['tibia', 0.16, 0.4, -0.505]], r: 0.045 },
      { pts: [['femur', 0.15, 0.72, -0.62], ['femur', 0.145, 0.55, -0.565], ['tibia', 0.155, 0.47, -0.48], ['tibia', 0.155, 0.4, -0.505]], r: 0.034 },
    ],
    run: 'Straighten the knee: catch the landing, then push.',
  },
  {
    id: 'iliopsoas', act: { name: 'Pulls the thigh forward', to: { femur: -0.7 } }, limb: 'hind', name: 'Hip flexor (iliopsoas)',
    strands: [{ pts: [['lumbar', 0.04, 0.82, -0.3], ['pelvis', 0.09, 0.76, -0.56], ['femur', 0.13, 0.68, -0.63]], r: 0.034 }],
    run: 'Pulls the back leg forward under the body.',
  },
  {
    id: 'adductors', act: { name: 'Pulls the thigh back and in', to: { femur: 0.3 } }, limb: 'hind', name: 'Inner thigh (adductors)', flat: [1, 0, 0], thick: 0.45,
    strands: [{ pts: [['pelvis', 0.03, 0.7, -0.71], ['femur', 0.13, 0.52, -0.57]], r: 0.04 }],
    run: 'Keep the back legs from splaying out under load.',
  },
  {
    id: 'gastroc', act: { name: 'Lifts the heel, points the toes', from: { femur: -0.15, hindpaw: -0.3 }, to: { femur: -0.15, hindpaw: 0.8 } }, limb: 'hind', name: 'Calf (gastrocnemius)', ts: 0.05, te: 0.4,
    strands: [{ pts: [['femur', 0.17, 0.48, -0.57], ['tibia', 0.17, 0.32, -0.625], ['hindpaw', 0.16, 0.12, -0.8]], r: 0.04 }],
    run: 'Lifts the heel and pushes off the toes.',
    note: 'Bears walk on the whole sole, like us, so their ankles have less spring than a dog or horse.',
  },
  {
    id: 'tibCran', act: { name: 'Lifts the toes', from: { femur: -0.15, hindpaw: 0.5 }, to: { femur: -0.15, hindpaw: -0.4 } }, limb: 'hind', name: 'Shin muscle (tibialis cranialis)', te: 0.35,
    strands: [{ pts: [['tibia', 0.175, 0.42, -0.5], ['tibia', 0.175, 0.22, -0.635], ['hindpaw', 0.16, 0.09, -0.66]], r: 0.022 }],
    run: 'Lifts the paw so the toes clear the ground on the swing.',
  },
  // trunk
  {
    id: 'epaxial', act: { name: 'Straightens and arches the back', from: { pelvis: -0.06, lumbar: 0.2, thorax: 0.1 }, to: { pelvis: 0.14, lumbar: -0.12, thorax: -0.06 } }, limb: 'trunk', name: 'Back muscles (longissimus)', flat: [0.3, 1, 0], thick: 0.5, ts: 0.06, te: 0.1,
    strands: [{ pts: [['pelvis', 0.05, 0.9, -0.68], ['lumbar', 0.055, 0.95, -0.32], ['thorax', 0.05, 0.99, 0.08], ['thorax', 0.04, 1.02, 0.36]], r: 0.036 }],
    run: 'Straighten and stretch the back as the back legs push: the spine works like a spring.',
  },
  {
    id: 'rectus', act: { name: 'Curls the back', from: { lumbar: -0.04 }, to: { lumbar: 0.16, thorax: 0.1 } }, limb: 'trunk', name: 'Belly muscles (rectus abdominis)', flat: [0, 1, 0], thick: 0.4, ts: 0.06, te: 0.1,
    strands: [{ pts: [['pelvis', 0.03, 0.68, -0.68], ['lumbar', 0.05, 0.5, -0.3], ['thorax', 0.05, 0.48, 0.08], ['thorax', 0.04, 0.51, 0.3]], r: 0.03 }],
    run: 'Curl the back so the back legs reach far forward.',
  },
  {
    id: 'obliques', act: { name: 'Curls the back', to: { lumbar: 0.12, thorax: 0.06 } }, limb: 'trunk', name: 'Side belly muscles (obliques)', flat: [1, 0, 0], thick: 0.35,
    strands: [{ pts: [['pelvis', 0.12, 0.78, -0.54], ['lumbar', 0.175, 0.62, -0.28], ['thorax', 0.19, 0.62, 0.0]], r: 0.04 }],
    run: 'Help curl the back and steady the trunk.',
  },
  {
    id: 'neckM', act: { name: 'Lifts the head', to: { neck: -0.35, head: 0.1 } }, limb: 'trunk', name: 'Neck muscles (splenius)',
    strands: [{ pts: [['thorax', 0.03, 1.05, 0.4], ['neck', 0.05, 1.0, 0.6], ['head', 0.05, 0.95, 0.75]], r: 0.035 }],
    run: 'Keep the head steady while the body bounces.',
  },
  {
    id: 'jaw', act: { name: 'Closes the jaw', from: { jaw: 0.4 }, to: { jaw: 0 } }, limb: 'trunk', name: 'Jaw muscles (masseter & temporalis)',
    strands: [{ pts: [['head', 0.07, 0.94, 0.79], ['jaw', 0.065, 0.81, 0.86]], r: 0.03 }],
    run: 'Not used for running: they close the jaw.',
  },
];
export const MUSCLE_BY_ID = Object.fromEntries(BEAR_MUSCLES.map((m) => [m.id, m]));

/** Skeleton, bone meshes and every muscle on both sides (same shape as the human createBody). */
export function createBearBody(scene) {
  const skel = new BearSkeleton();
  scene.add(skel.root);
  const mats = {
    bone: new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.72, metalness: 0 }),
    cart: new THREE.MeshStandardMaterial({ color: 0xbcd0d4, roughness: 0.5, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x251c1c, roughness: 1 }),
    claw: new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.45, metalness: 0 }),
  };
  const boneMeshes = buildBearBones(skel, mats);

  const fiberTex = makeFiberTexture();
  const insts = [];
  const instByKey = {};
  let n = 0;
  for (const def of BEAR_MUSCLES) {
    for (const S of SIDES) {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: fiberTex, roughness: 0.5, metalness: 0, side: THREE.DoubleSide });
      const inst = { def, S, key: `${def.id}_${S}`, material, strands: [], visible: true, transparent: false };
      inst.strands = def.strands.map((sd) => new Strand(inst, sd, skel, n++));
      for (const st of inst.strands) scene.add(st.mesh);
      insts.push(inst);
      instByKey[inst.key] = inst;
    }
  }
  const allStrands = insts.flatMap((i) => i.strands);
  skel.apply();
  skel.computeDirty();
  for (const s of allStrands) s.update();

  const update = () => {
    skel.computeDirty();
    for (const s of allStrands) if (s.needsUpdate()) s.update();
  };
  const setOpacity = (inst, opacity) => {
    const m = inst.material;
    const tr = opacity < 0.999;
    if (tr !== inst.transparent) {
      inst.transparent = tr;
      m.transparent = tr;
      m.depthWrite = !tr;
      m.needsUpdate = true;
    }
    m.opacity = opacity;
  };
  return { skel, boneMeshes, insts, instByKey, allStrands, update, setOpacity };
}

// ------------------------------------------------------------------ the gallop
// One stride = phase 0..1. Each leg lands at its offset and stays down for D of the stride.
// Order of footfalls: left hind, right hind, left front, right front. Two short flights:
// stretched out (after the back legs push off) and curled up (after the front legs push off).
export const GAIT = {
  D: 0.28, // fraction of the stride a paw is on the ground
  S: 0.62, // how far a paw travels back under the body while it is down (m)
  offsets: { hind_L: 0, hind_R: 0.1, fore_L: 0.42, fore_R: 0.52 },
  STRIDE_SEC: 0.45, // one stride at full gallop
};
export const LIMBS = ['hind_L', 'hind_R', 'fore_L', 'fore_R'];
export const LIMB_LABEL = { hind_L: 'Left back', hind_R: 'Right back', fore_L: 'Left front', fore_R: 'Right front' };
export const limbPhase = (p, limb) => (((p - GAIT.offsets[limb]) % 1) + 1) % 1;
export const onGround = (p, limb) => limbPhase(p, limb) < GAIT.D;
/** Ground speed in meters per stride: a planted paw slides back at this speed (treadmill). */
export const groundPerStride = () => GAIT.S / GAIT.D;

export const PHASES = [
  { from: 0.0, to: 0.34, title: 'Back legs land and push' },
  { from: 0.34, to: 0.44, title: 'Body stretches out' },
  { from: 0.44, to: 0.8, title: 'Front legs land and pull' },
  { from: 0.8, to: 1.0, title: 'Back curls, all paws off' },
];
export const phaseAt = (p) => PHASES.findIndex((ph) => p >= ph.from && p < ph.to);

const rot = (a, y, z) => ({ y: y * Math.cos(a) - z * Math.sin(a), z: y * Math.sin(a) + z * Math.cos(a) });
const ang = (dy, dz) => Math.atan2(dz, dy);

/** Two-bone reach in the side plane: A (hip/shoulder) to target C. bendForward: knee ahead of the line. */
function reach(A, C, l1, l2, bendForward) {
  const dy = C.y - A.y, dz = C.z - A.z;
  const d = Math.hypot(dy, dz) || 1e-6;
  const dc = Math.min(l1 + l2 - 1e-4, Math.max(Math.abs(l1 - l2) + 1e-4, d));
  const phi = ang(dy, dz);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))));
  const B1 = { y: A.y + l1 * Math.cos(phi + a), z: A.z + l1 * Math.sin(phi + a) };
  const B2 = { y: A.y + l1 * Math.cos(phi - a), z: A.z + l1 * Math.sin(phi - a) };
  const B = (B1.z > B2.z) === bendForward ? B1 : B2;
  return { B, C: { y: A.y + (dy / d) * dc, z: A.z + (dz / d) * dc } };
}

/** Pose of the whole bear at stride phase p: { W: world angle per bone, root: {y, z} }. */
export function gaitPose(skel, p) {
  const R = skel.rest;
  const segOf = (a, b) => ({ len: Math.hypot(R[b].y - R[a].y, R[b].z - R[a].z), phi: ang(R[b].y - R[a].y, R[b].z - R[a].z) });

  // Spine: curls (back arches up) when the legs gather under, stretches flat when they reach out.
  const f = 0.17 * Math.cos(2 * Math.PI * (p - 0.95));
  const bounce = 0.022 * Math.cos(4 * Math.PI * (p - 0.4));
  const W = { pelvis: -0.6 * f, lumbar: -0.1 * f, thorax: 0.45 * f, neck: 0.2 * f, head: 0.02 * Math.sin(4 * Math.PI * p) };

  // Where each paw is in its stride.
  const legs = {};
  for (const limb of LIMBS) {
    const [kind, S] = limb.split('_');
    const fore = kind === 'fore';
    const q = limbPhase(p, limb);
    const stance = q < GAIT.D;
    const s = stance ? q / GAIT.D : 0, u = stance ? 0 : (q - GAIT.D) / (1 - GAIT.D);
    const padBone = fore ? `foreclaws_${S}` : `hindtoes_${S}`, jointBone = fore ? `forepaw_${S}` : `hindpaw_${S}`;
    const fwd = fore ? 0.26 : 0.3;
    const pad0 = R[padBone];
    const liftA = fore ? 0.7 : 0.87; // heel/wrist lift at push-off (rad)
    const foot = segOf(padBone, jointBone); // pad -> wrist/ankle at rest
    const jointAt = (pad, a) => ({ y: pad.y + foot.len * Math.cos(foot.phi + a), z: pad.z + foot.len * Math.sin(foot.phi + a) });
    const tdPad = { y: pad0.y, z: pad0.z + fwd }, loPad = { y: pad0.y, z: pad0.z + fwd - GAIT.S };
    let joint, alpha, rel;
    if (stance) {
      alpha = liftA * sm(clamp01((s - 0.35) / 0.65));
      joint = jointAt({ y: pad0.y, z: tdPad.z - GAIT.S * s }, alpha);
      rel = 1 - 2 * s;
    } else {
      const e = easeIO(u);
      const j0 = jointAt(loPad, liftA), j1 = jointAt(tdPad, 0);
      joint = { y: j0.y + (j1.y - j0.y) * e + (fore ? 0.2 : 0.17) * Math.pow(Math.sin(Math.PI * u), 0.9), z: j0.z + (j1.z - j0.z) * e };
      alpha = liftA * (1 - sm(u)) + (fore ? 1.5 : 0.55) * Math.pow(Math.sin(Math.PI * u), 1.2);
      rel = -1 + 2 * e;
    }
    legs[limb] = { fore, S, stance, u, joint, alpha, rel };
    if (fore) W[`scapula_${S}`] = W.thorax - 0.4 * rel; // the shoulder blade swings with the leg
  }

  // Fill every bone (children follow their parent) and centre the body over its rest spot.
  const fill = () => { for (const n of skel.order) if (W[n] === undefined) W[n] = W[skel.parentOf[n]] ?? 0; };
  const anchors = ['femur_L', 'femur_R', 'humerus_L', 'humerus_R'];
  const tmp = { ...W };
  for (const n of skel.order) if (tmp[n] === undefined) tmp[n] = tmp[skel.parentOf[n]] ?? 0;
  const root0 = { y: R.pelvis.y, z: R.pelvis.z };
  const P0 = skel.fk(tmp, root0);
  let my = 0, mz = 0, ry = 0, rz = 0;
  for (const a of anchors) { my += P0[a].y; mz += P0[a].z; ry += R[a].y; rz += R[a].z; }
  const root = { y: root0.y + (ry - my) / 4 + bounce, z: root0.z + (rz - mz) / 4 };
  const P = skel.fk(tmp, root);

  // Legs: reach each paw's wrist/ankle target from the shoulder/hip.
  for (const limb of LIMBS) {
    const L = legs[limb], S = L.S;
    const [upper, lower, paw, digits] = L.fore ? ['humerus', 'forearm', 'forepaw', 'foreclaws'] : ['femur', 'tibia', 'hindpaw', 'hindtoes'];
    const u1 = segOf(`${upper}_${S}`, `${lower}_${S}`), u2 = segOf(`${lower}_${S}`, `${paw}_${S}`);
    const A = P[`${upper}_${S}`];
    const { B, C } = reach(A, L.joint, u1.len, u2.len, !L.fore);
    W[`${upper}_${S}`] = ang(B.y - A.y, B.z - A.z) - u1.phi;
    W[`${lower}_${S}`] = ang(C.y - B.y, C.z - B.z) - u2.phi;
    W[`${paw}_${S}`] = L.alpha;
    W[`${digits}_${S}`] = L.stance ? 0 : L.alpha + 0.5 * Math.sin(Math.PI * L.u);
  }
  fill();
  return { W, root };
}

// ------------------------------------------------------------------ when each muscle works
// Windows on the leg's own phase (0 = paw lands, D = paw lifts) or, for the trunk, the stride.
// [from, to, peak]; from may be negative (starts just before landing).
const ACT = {
  hump: { base: 0.15, w: [[-0.04, 0.22, 0.75]] },
  lats: { w: [[0.0, 0.26, 1]] },
  pecs: { w: [[-0.02, 0.24, 0.8]] },
  serratus: { base: 0.2, w: [[-0.03, 0.27, 0.9]] },
  brachioceph: { w: [[0.34, 0.68, 0.85]] },
  deltoid: { w: [[0.32, 0.55, 0.6]] },
  cuff: { base: 0.2, w: [[-0.02, 0.25, 0.55]] },
  triceps: { w: [[-0.04, 0.24, 1]] },
  elbowFlex: { w: [[0.3, 0.52, 0.7]] },
  foreFlex: { w: [[0.0, 0.26, 0.8]] },
  foreExt: { w: [[0.55, 0.92, 0.6]] },
  glutes: { w: [[-0.03, 0.22, 1]] },
  bicepsFem: { w: [[-0.1, 0.24, 0.95]] },
  semiT: { w: [[-0.12, 0.2, 0.85]] },
  quads: { w: [[-0.03, 0.17, 0.85]] },
  iliopsoas: { w: [[0.3, 0.62, 0.85]] },
  adductors: { base: 0.15, w: [[-0.02, 0.25, 0.5]] },
  gastroc: { w: [[0.06, 0.28, 1]] },
  tibCran: { w: [[0.3, 0.62, 0.65]] },
  epaxial: { w: [[0.1, 0.42, 0.95]] },
  rectus: { w: [[0.62, 0.98, 0.8]] },
  obliques: { w: [[0.6, 0.95, 0.6]] },
  neckM: { base: 0.3, w: [[0.4, 0.62, 0.6]] },
  jaw: { w: [] },
};
function win(q, a, b, r = 0.05) {
  const x = (((q - (a - r)) % 1) + 1) % 1;
  const len = b - a + 2 * r;
  if (x > len) return 0;
  return sm(clamp01(Math.min(x / r, (len - x) / r)));
}
/** Activation 0..1 of every muscle instance (key id_S) at stride phase p. */
export function activations(p) {
  const out = {};
  for (const m of BEAR_MUSCLES) {
    const A = ACT[m.id];
    for (const S of SIDES) {
      const q = m.limb === 'trunk' ? p : limbPhase(p, `${m.limb}_${S}`);
      let a = A.base ?? 0;
      for (const [lo, hi, peak] of A.w) a = Math.max(a, peak * win(q, lo, hi));
      out[`${m.id}_${S}`] = a;
    }
  }
  return out;
}

// ------------------------------------------------------------------ standing still: one muscle at a time
/**
 * The bear stands still while one muscle (on side S) plays its movement; k = 0 (start) .. 1 (contracted).
 * Legs the movement does not use stay planted where they stand.
 */
export function standPose(skel, act, S, k) {
  const R = skel.rest;
  const local = {};
  const from = act?.from || {}, to = act?.to || {};
  for (const b of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const a = from[b] ?? 0;
    local[skel.boneName(b, S)] = a + ((to[b] ?? 0) - a) * k;
  }
  // shift: slides a bone along its parent (e.g. the shoulder blade pulled up against the spine).
  const offsets = {};
  for (const [b, o] of Object.entries(act?.shift || {})) {
    const n = skel.boneName(b, S);
    offsets[n] = { y: o.y * k, z: o.z * k };
    local[n] ??= 0;
  }
  const W = {};
  for (const n of skel.order) {
    const par = skel.parentOf[n];
    W[n] = (par ? W[par] : 0) + (local[n] ?? 0);
  }
  const lift = (act?.lift ?? 0) * k;
  const root = { y: R.pelvis.y + lift, z: R.pelvis.z };
  // The body sling: the chest rises between the shoulder blades, which stay where they are on the legs.
  if (act?.sling) for (const s of SIDES) offsets[`scapula_${s}`] = { y: -lift, z: 0 };
  const P = skel.fk(W, root, offsets);
  const segOf = (a, b) => ({ len: Math.hypot(R[b].y - R[a].y, R[b].z - R[a].z), phi: ang(R[b].y - R[a].y, R[b].z - R[a].z) });
  for (const limb of LIMBS) {
    const [kind, s] = limb.split('_');
    const fore = kind === 'fore';
    const chain = fore ? ['humerus', 'forearm', 'forepaw', 'foreclaws'] : ['femur', 'tibia', 'hindpaw', 'hindtoes'];
    if ([...chain, ...(fore ? ['scapula'] : [])].some((b) => local[`${b}_${s}`] !== undefined)) continue;
    const [upper, lower, paw, digits] = chain.map((b) => `${b}_${s}`);
    const u1 = segOf(upper, lower), u2 = segOf(lower, paw);
    const A = P[upper];
    const { B, C } = reach(A, { y: R[paw].y, z: R[paw].z }, u1.len, u2.len, !fore);
    W[upper] = ang(B.y - A.y, B.z - A.z) - u1.phi;
    W[lower] = ang(C.y - B.y, C.z - B.z) - u2.phi;
    W[paw] = 0;
    W[digits] = 0;
  }
  return { W, root, offsets };
}
