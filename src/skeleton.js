// Skeleton: bone hierarchy, joint degrees of freedom, and simple bone visuals.
//
// Coordinates are meters in the rest (anatomical) pose. The body faces +Z, Y is up.
// The body's RIGHT side is at negative X. Every bone's rest rotation is identity, so a
// bone's local axes are world-aligned at rest and points can be authored in world space.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V3 = THREE.Vector3;
const DEG = Math.PI / 180;

export const SIDES = ['R', 'L'];
export const SIDE_SIGN = { R: -1, L: 1 };
export const SIDE_LABEL = { R: 'right', L: 'left' };
export const opp = (S) => (S === 'R' ? 'L' : 'R');

// pivot x values are lateral distances; sided bones are mirrored with x * sign.
export const BONE_DEFS = [
  { name: 'pelvis', parent: null, pivot: [0, 0.98, 0] },
  { name: 'lumbar', parent: 'pelvis', pivot: [0, 1.06, -0.04] },
  { name: 'thorax', parent: 'lumbar', pivot: [0, 1.2, -0.05] },
  { name: 'neck', parent: 'thorax', pivot: [0, 1.47, -0.05] },
  { name: 'head', parent: 'neck', pivot: [0, 1.6, -0.02] },
  { name: 'jaw', parent: 'head', pivot: [0, 1.62, 0.02] },
  { name: 'clavicle', parent: 'thorax', pivot: [0.02, 1.44, 0.06], sided: true },
  { name: 'scapula', parent: 'clavicle', pivot: [0.17, 1.47, 0.0], sided: true },
  { name: 'humerus', parent: 'scapula', pivot: [0.185, 1.42, -0.01], sided: true },
  { name: 'ulna', parent: 'humerus', pivot: [0.215, 1.12, -0.02], sided: true },
  { name: 'radius', parent: 'ulna', pivot: [0.215, 1.12, -0.02], sided: true },
  { name: 'hand', parent: 'radius', pivot: [0.235, 0.87, -0.005], sided: true },
  { name: 'fingers', parent: 'hand', pivot: [0.237, 0.78, 0.0], sided: true },
  { name: 'femur', parent: 'pelvis', pivot: [0.09, 0.93, 0.02], sided: true },
  { name: 'tibia', parent: 'femur', pivot: [0.1, 0.5, 0.0], sided: true },
  { name: 'foot', parent: 'tibia', pivot: [0.1, 0.08, 0.0], sided: true },
  { name: 'toes', parent: 'foot', pivot: [0.11, 0.018, 0.13], sided: true },
];
const SIDED = new Set(BONE_DEFS.filter((d) => d.sided).map((d) => d.name));

export const BONE_LABEL = {
  pelvis: 'pelvis', lumbar: 'lumbar spine', thorax: 'rib cage & thoracic spine', neck: 'cervical spine',
  head: 'skull', jaw: 'jaw (mandible)', clavicle: 'collarbone (clavicle)', scapula: 'shoulder blade (scapula)',
  humerus: 'upper-arm bone (humerus)', ulna: 'ulna', radius: 'radius', hand: 'hand', fingers: 'fingers',
  femur: 'thigh bone (femur)', tibia: 'shin bone (tibia)', foot: 'foot', toes: 'toes',
};

// Joint degrees of freedom. Each dof: [name, axis, signFn(sideSign)]. The sign function turns an
// anatomical angle (e.g. "abduct 30°") into a signed rotation about the world-aligned axis.
// Dofs are composed in the listed order (first = outermost).
export const JOINTS = {
  trunk: { label: 'spine', bones: [['lumbar', 0.5], ['thorax', 0.5]], dofs: [['flex', 'x', () => 1], ['latflex', 'z', (s) => -s], ['rot', 'y', (s) => s]] },
  neck: { label: 'neck', bones: [['neck', 0.5], ['head', 0.5]], dofs: [['flex', 'x', () => 1], ['latflex', 'z', (s) => -s], ['rot', 'y', (s) => s]] },
  jaw: { label: 'jaw (TMJ)', bones: [['jaw', 1]], dofs: [['open', 'x', () => 1]] },
  girdle: { label: 'collarbone joint', sided: true, bones: [['clavicle', 1]], dofs: [['elev', 'z', (s) => s], ['protract', 'y', (s) => -s]] },
  scapula: { label: 'shoulder blade', sided: true, bones: [['scapula', 1]], dofs: [['upRot', 'z', (s) => s]] },
  shoulder: { label: 'shoulder', sided: true, bones: [['humerus', 1]], dofs: [['hadd', 'y', (s) => -s], ['flex', 'x', () => -1], ['abd', 'z', (s) => s], ['introt', 'y', (s) => -s]] },
  elbow: { label: 'elbow', sided: true, bones: [['ulna', 1]], dofs: [['flex', 'x', () => -1]] },
  forearm: { label: 'forearm (radioulnar)', sided: true, bones: [['radius', 1]], dofs: [['pron', 'forearm', (s) => -s]] },
  wrist: { label: 'wrist', sided: true, bones: [['hand', 1]], dofs: [['flex', 'x', () => -1], ['radDev', 'z', (s) => s]] },
  fingers: { label: 'knuckles', sided: true, bones: [['fingers', 1]], dofs: [['flex', 'x', () => -1]] },
  hip: { label: 'hip', sided: true, bones: [['femur', 1]], dofs: [['flex', 'x', () => -1], ['abd', 'z', (s) => s], ['introt', 'y', (s) => -s]] },
  knee: { label: 'knee', sided: true, bones: [['tibia', 1]], dofs: [['flex', 'x', () => 1]] },
  ankle: { label: 'ankle', sided: true, bones: [['foot', 1]], dofs: [['dorsi', 'x', () => -1], ['inv', 'z', (s) => -s]] },
  toes: { label: 'toe joints', sided: true, bones: [['toes', 1]], dofs: [['ext', 'x', () => -1]] },
};

export const DOF_LABEL = {
  flex: 'flexion', latflex: 'side-bending', rot: 'rotation', open: 'opening', elev: 'elevation', protract: 'protraction',
  upRot: 'upward rotation', hadd: 'horizontal adduction', abd: 'abduction', introt: 'internal rotation', pron: 'pronation',
  radDev: 'radial deviation', dorsi: 'dorsiflexion', inv: 'inversion', ext: 'extension',
};

export class Skeleton {
  constructor() {
    this.bones = {};
    this.rest = {};
    this.wq = {}; // world quaternion per bone (updated in apply)
    this.dirty = {};
    this.prev = {};
    this.ancestors = {};
    for (const d of BONE_DEFS) {
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
          this.ancestors[name] = new Set([name, ...this.ancestors[parent]]);
        } else {
          obj.position.copy(pivot);
          this.root = obj;
          this.ancestors[name] = new Set([name]);
        }
        this.bones[name] = obj;
        this.rest[name] = pivot;
        this.wq[name] = new THREE.Quaternion();
        this.prev[name] = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        this.dirty[name] = true;
      }
    }
    // Pronation axis runs along the forearm (wrist -> elbow).
    this.axes = { x: new V3(1, 0, 0), y: new V3(0, 1, 0), z: new V3(0, 0, 1) };
    this.forearmAxis = {};
    for (const S of SIDES) {
      const e = this.rest[`ulna_${S}`], w = this.rest[`hand_${S}`];
      this.forearmAxis[S] = e.clone().sub(w).normalize();
    }
    this._q = new THREE.Quaternion();
    this._qd = new THREE.Quaternion();
    this._p = new V3();
    this._s = new V3();
  }

  boneName(name, S) { return SIDED.has(name) ? `${name}_${S}` : name; }
  baseName(name) { return name.replace(/_(R|L)$/, ''); }
  /** true if bone `a` is `b` or moves with `b` (descendant). */
  movesWith(a, b) { return this.ancestors[a].has(b); }

  axisFor(axis, S) { return axis === 'forearm' ? this.forearmAxis[S] : this.axes[axis]; }

  /** Turn [[joint, dof, degrees], ...] into {jointKey: {dof: signedDegrees}} for a muscle on side S. */
  resolve(spec, S) {
    const out = {};
    for (const [jRaw, dof, deg] of spec || []) {
      let j = jRaw, side = S;
      if (j.endsWith('_opp')) { j = j.slice(0, -4); side = opp(S); }
      const J = JOINTS[j];
      if (!J) throw new Error(`Unknown joint ${jRaw}`);
      const d = J.dofs.find((x) => x[0] === dof);
      if (!d) throw new Error(`Unknown dof ${dof} for ${j}`);
      const key = J.sided ? `${j}_${side}` : j;
      (out[key] ||= {})[dof] = deg * d[2](SIDE_SIGN[side]);
    }
    return out;
  }

  /** Apply a resolved pose (missing joints are neutral) and update world matrices. */
  apply(values) {
    for (const n in this.bones) this.bones[n].quaternion.identity();
    for (const key in values) {
      const m = key.match(/^(\w+?)(?:_(R|L))?$/);
      const J = JOINTS[m[1]];
      const S = m[2] || 'R';
      const vals = values[key];
      for (const [bone, frac] of J.bones) {
        const q = this._q.identity();
        for (const [dof, axis] of J.dofs) {
          const a = vals[dof];
          if (!a) continue;
          this._qd.setFromAxisAngle(this.axisFor(axis, S), a * DEG * frac);
          q.multiply(this._qd);
        }
        this.bones[J.sided ? `${bone}_${S}` : bone].quaternion.copy(q);
      }
    }
    this.root.updateMatrixWorld(true);
    for (const n in this.bones) this.bones[n].matrixWorld.decompose(this._p, this.wq[n], this._s);
  }

  /** Flag bones whose world matrix changed since the last call. */
  computeDirty() {
    let any = false;
    for (const n in this.bones) {
      const a = this.bones[n].matrixWorld.elements, b = this.prev[n].elements;
      let d = false;
      for (let i = 0; i < 16; i++) if (Math.abs(a[i] - b[i]) > 1e-7) { d = true; break; }
      this.dirty[n] = d;
      if (d) { this.prev[n].copy(this.bones[n].matrixWorld); any = true; }
    }
    return any;
  }

  /** World-space rotation axis of a joint dof (the axis expressed in the joint's parent frame). */
  jointAxisWorld(jointKey, dof, target) {
    const m = jointKey.match(/^(\w+?)(?:_(R|L))?$/);
    const J = JOINTS[m[1]];
    const S = m[2] || 'R';
    const d = J.dofs.find((x) => x[0] === dof);
    const bone = this.bones[J.sided ? `${J.bones[0][0]}_${S}` : J.bones[0][0]];
    target.copy(this.axisFor(d[1], S));
    if (bone.parent && this.wq[bone.parent.name]) target.applyQuaternion(this.wq[bone.parent.name]);
    return { bone: bone.name, sign: d[2](SIDE_SIGN[S]) };
  }
}

// ---------------------------------------------------------------- bone visuals
const Y = new V3(0, 1, 0);

function capsule(a, b, r, sx = 1, sz = 1) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(len - r * 0.6, 0.001), 4, 12);
  g.scale(sx, 1, sz);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}
function ellipsoid(c, rx, ry, rz, basis) {
  const g = new THREE.SphereGeometry(1, 22, 16);
  g.scale(rx, ry, rz);
  if (basis) g.applyMatrix4(basis);
  g.translate(c.x, c.y, c.z);
  return g;
}
function tube(points, r, segs = 24) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, false, 'centripetal'), segs, r, 8, false);
}
function basisFrom(u, v) {
  const x = u.clone().normalize();
  const z = new V3().crossVectors(x, v).normalize();
  const y = new V3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z);
}

const SPINE_Z = [[0.98, -0.06], [1.03, -0.045], [1.1, -0.035], [1.2, -0.045], [1.3, -0.062], [1.4, -0.062], [1.47, -0.05], [1.53, -0.035], [1.59, -0.025]];
export function spineZ(y) {
  for (let i = 0; i < SPINE_Z.length - 1; i++) {
    const [y0, z0] = SPINE_Z[i], [y1, z1] = SPINE_Z[i + 1];
    if (y <= y1) return z0 + ((y - y0) / (y1 - y0)) * (z1 - z0);
  }
  return SPINE_Z[SPINE_Z.length - 1][1];
}

// Ribs: back height, half-width, front depth, back depth, front drop, end x (null = sternum)
const RIBS = [
  [1.445, 0.065, 0.05, 0.05, 0.035, null],
  [1.42, 0.095, 0.065, 0.06, 0.035, null],
  [1.395, 0.115, 0.075, 0.068, 0.036, null],
  [1.37, 0.13, 0.082, 0.072, 0.037, null],
  [1.345, 0.14, 0.086, 0.075, 0.038, null],
  [1.32, 0.145, 0.088, 0.077, 0.039, null],
  [1.295, 0.148, 0.088, 0.078, 0.04, null],
  [1.27, 0.148, 0.086, 0.078, 0.06, 0.05],
  [1.245, 0.145, 0.082, 0.077, 0.07, 0.075],
  [1.22, 0.138, 0.076, 0.075, 0.07, 0.1],
  [1.198, 0.125, 0.06, 0.07, 0.03, 'float'],
];

/** Builds merged bone meshes, parented to their bones. Returns the meshes (for raycasting). */
export function buildBoneVisuals(skel, mats) {
  const parts = {};
  const add = (bone, geo, kind = 'bone') => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.clearGroups();
    ((parts[bone] ||= {})[kind] ||= []).push(g);
  };
  const v = (x, y, z) => new V3(x, y, z);

  // ---- skull & jaw
  add('head', ellipsoid(v(0, 1.688, 0.0), 0.073, 0.088, 0.096));
  add('head', ellipsoid(v(0, 1.628, 0.052), 0.056, 0.048, 0.05));
  add('head', ellipsoid(v(0, 1.605, 0.06), 0.04, 0.02, 0.04));
  for (const s of [-1, 1]) {
    add('head', ellipsoid(v(0.03 * s, 1.664, 0.087), 0.017, 0.016, 0.012), 'dark');
    add('head', capsule(v(0.045 * s, 1.632, 0.06), v(0.066 * s, 1.628, 0.02), 0.006)); // zygomatic arch
    add('jaw', capsule(v(0.05 * s, 1.618, 0.012), v(0.048 * s, 1.565, 0.018), 0.009, 1, 1.6));
    add('jaw', capsule(v(0.048 * s, 1.565, 0.018), v(0.024 * s, 1.545, 0.07), 0.009));
    add('jaw', capsule(v(0.046 * s, 1.598, 0.045), v(0.048 * s, 1.575, 0.03), 0.006));
  }
  add('head', ellipsoid(v(0, 1.635, 0.098), 0.009, 0.012, 0.006), 'dark');
  add('jaw', capsule(v(-0.024, 1.545, 0.07), v(0.024, 1.545, 0.07), 0.01));
  add('head', capsule(v(-0.03, 1.598, 0.078), v(0.03, 1.598, 0.078), 0.006, 1, 1), 'cart'); // upper teeth
  add('jaw', capsule(v(-0.026, 1.585, 0.074), v(0.026, 1.585, 0.074), 0.0055), 'cart'); // lower teeth

  // ---- spine
  for (let y = 1.03; y < 1.59; y += 0.0235) {
    const z = spineZ(y);
    const bone = y < 1.06 ? 'pelvis' : y < 1.2 ? 'lumbar' : y < 1.47 ? 'thorax' : 'neck';
    const r = y < 1.2 ? 0.017 : y < 1.47 ? 0.013 : 0.01;
    const g = new THREE.CylinderGeometry(r, r, 0.016, 12);
    g.translate(0, y, z);
    add(bone, g);
    add(bone, capsule(v(0, y, z - r), v(0, y - 0.012, z - r - 0.022), 0.004));
    if (y < 1.47) add(bone, capsule(v(-0.028, y, z - 0.008), v(0.028, y, z - 0.008), 0.0035));
  }

  // ---- ribs + sternum
  const z0 = 0.005;
  for (const [yb, a, bf, bb, drop, end] of RIBS) {
    for (const s of [-1, 1]) {
      const ts = Math.asin(Math.min(0.022 / a, 1));
      let te;
      if (end === 'float') te = 1.75;
      else if (end === null) te = Math.PI - Math.asin(0.016 / a);
      else te = Math.PI - Math.asin(Math.min(end / a, 1));
      const ptAt = (t) => v(s * a * Math.sin(t), yb - drop * (1 - Math.cos(t)) / 2, t < Math.PI / 2 ? z0 - bb * Math.cos(t) : z0 - bf * Math.cos(t));
      const tc = end === 'float' ? te : te - (end === null ? 0.45 : 0.6);
      const bonePts = [], cartPts = [];
      for (let k = 0; k <= 14; k++) bonePts.push(ptAt(ts + ((tc - ts) * k) / 14));
      add('thorax', tube(bonePts, 0.0055, 28));
      if (tc < te) {
        for (let k = 0; k <= 5; k++) cartPts.push(ptAt(tc + ((te - tc) * k) / 5));
        add('thorax', tube(cartPts, 0.0045, 10), 'cart');
      }
    }
  }
  add('thorax', capsule(v(0, 1.418, 0.062), v(0, 1.255, 0.095), 0.011, 1.8, 0.55));
  add('thorax', capsule(v(0, 1.255, 0.095), v(0, 1.228, 0.097), 0.005), 'cart');

  // ---- pelvis
  for (const s of [-1, 1]) {
    const p = (x, y, z) => v(x * s, y, z);
    const post = [p(0.045, 1.005, -0.08), p(0.14, 1.005, -0.01)];
    add('pelvis', ellipsoid(post[0].clone().add(post[1]).multiplyScalar(0.5), 0.062, 0.052, 0.009, basisFrom(post[1].clone().sub(post[0]), Y)));
    const ant = [p(0.14, 1.0, -0.01), p(0.12, 1.0, 0.06)];
    add('pelvis', ellipsoid(ant[0].clone().add(ant[1]).multiplyScalar(0.5), 0.042, 0.05, 0.009, basisFrom(ant[1].clone().sub(ant[0]), Y)));
    add('pelvis', tube([p(0.045, 1.045, -0.08), p(0.1, 1.065, -0.05), p(0.14, 1.07, -0.005), p(0.135, 1.05, 0.04), p(0.12, 1.02, 0.062)], 0.008));
    add('pelvis', tube([p(0.12, 1.02, 0.062), p(0.105, 0.99, 0.055), p(0.085, 0.955, 0.045), p(0.025, 0.905, 0.06), p(0.004, 0.9, 0.06)], 0.009));
    add('pelvis', tube([p(0.09, 0.955, -0.02), p(0.075, 0.89, -0.035), p(0.06, 0.86, -0.035), p(0.035, 0.87, 0.02), p(0.006, 0.885, 0.055)], 0.01));
    add('pelvis', capsule(p(0.11, 0.995, -0.02), p(0.09, 0.95, 0.0), 0.016));
    const ring = new THREE.TorusGeometry(0.025, 0.005, 6, 20);
    ring.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), new V3(0.85 * s, -0.3, 0.4).normalize()));
    const c = p(0.098, 0.928, 0.022);
    ring.translate(c.x, c.y, c.z);
    add('pelvis', ring);
  }
  const sac = new THREE.Matrix4().makeRotationX(0.35);
  add('pelvis', ellipsoid(v(0, 0.985, -0.075), 0.045, 0.058, 0.017, sac));
  add('pelvis', capsule(v(0, 0.932, -0.088), v(0, 0.905, -0.075), 0.007));

  // ---- limbs (both sides)
  for (const S of SIDES) {
    const s = SIDE_SIGN[S];
    const p = (x, y, z) => v(x * s, y, z);
    const B = (n) => `${n}_${S}`;
    // clavicle
    add(B('clavicle'), tube([p(0.02, 1.44, 0.06), p(0.08, 1.45, 0.06), p(0.13, 1.46, 0.035), p(0.172, 1.47, 0.004)], 0.0075, 16));
    // scapula blade (extruded triangle)
    {
      const A = p(0.085, 1.47, -0.085), Bi = p(0.095, 1.29, -0.085), C = p(0.158, 1.42, -0.03);
      const u = Bi.clone().sub(A).normalize();
      const w = new V3().crossVectors(u, C.clone().sub(A)).normalize();
      const vv = new V3().crossVectors(w, u).normalize();
      const to2 = (P) => { const d = P.clone().sub(A); return new THREE.Vector2(d.dot(u), d.dot(vv)); };
      const shape = new THREE.Shape([to2(A), to2(Bi), to2(C)]);
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1 });
      g.translate(0, 0, -0.002);
      g.applyMatrix4(new THREE.Matrix4().makeBasis(u, vv, w));
      g.translate(A.x, A.y, A.z);
      add(B('scapula'), g);
      add(B('scapula'), capsule(p(0.085, 1.432, -0.09), p(0.165, 1.465, -0.03), 0.0065));
      add(B('scapula'), capsule(p(0.165, 1.465, -0.03), p(0.186, 1.472, 0.002), 0.009, 1.4, 0.7));
      add(B('scapula'), capsule(p(0.145, 1.445, -0.005), p(0.14, 1.43, 0.035), 0.006));
      add(B('scapula'), ellipsoid(p(0.163, 1.43, -0.017), 0.006, 0.017, 0.012));
    }
    // humerus
    add(B('humerus'), ellipsoid(p(0.185, 1.42, -0.01), 0.023, 0.023, 0.023));
    add(B('humerus'), ellipsoid(p(0.2, 1.428, 0.0), 0.014, 0.014, 0.014));
    add(B('humerus'), capsule(p(0.19, 1.4, -0.012), p(0.213, 1.14, -0.02), 0.0115));
    add(B('humerus'), capsule(p(0.188, 1.125, -0.022), p(0.242, 1.125, -0.018), 0.011));
    // ulna & radius
    add(B('ulna'), capsule(p(0.212, 1.148, -0.045), p(0.213, 1.1, -0.03), 0.01));
    add(B('ulna'), capsule(p(0.213, 1.1, -0.03), p(0.212, 0.88, -0.012), 0.0068));
    add(B('radius'), ellipsoid(p(0.238, 1.108, -0.012), 0.009, 0.007, 0.009));
    add(B('radius'), capsule(p(0.238, 1.108, -0.012), p(0.255, 0.885, 0.0), 0.0072));
    add(B('radius'), capsule(p(0.258, 0.878, 0.0), p(0.226, 0.876, -0.004), 0.0085));
    // hand
    add(B('hand'), ellipsoid(p(0.237, 0.853, -0.002), 0.03, 0.014, 0.012));
    [0.212, 0.229, 0.246, 0.262].forEach((x, i) => add(B('hand'), capsule(p(0.222 + i * 0.012, 0.845, 0.0), p(x, 0.786, 0.002), 0.0055)));
    add(B('hand'), capsule(p(0.258, 0.85, 0.006), p(0.278, 0.815, 0.02), 0.006));
    add(B('hand'), capsule(p(0.278, 0.815, 0.02), p(0.29, 0.785, 0.03), 0.005));
    // fingers (little -> index)
    [[0.212, 0.052], [0.229, 0.068], [0.246, 0.076], [0.262, 0.068]].forEach(([x, l]) => {
      add(B('fingers'), capsule(p(x, 0.778, 0.002), p(x, 0.778 - l * 0.55, 0.006), 0.005));
      add(B('fingers'), capsule(p(x, 0.778 - l * 0.55, 0.006), p(x, 0.778 - l, 0.013), 0.0045));
    });
    // femur
    add(B('femur'), ellipsoid(p(0.09, 0.93, 0.02), 0.022, 0.022, 0.022));
    add(B('femur'), capsule(p(0.09, 0.93, 0.02), p(0.14, 0.905, 0.003), 0.012));
    add(B('femur'), ellipsoid(p(0.15, 0.912, -0.005), 0.016, 0.02, 0.016));
    add(B('femur'), ellipsoid(p(0.118, 0.865, -0.005), 0.008, 0.008, 0.008));
    add(B('femur'), capsule(p(0.14, 0.89, 0.0), p(0.1, 0.53, 0.0), 0.0135));
    add(B('femur'), capsule(p(0.072, 0.507, -0.008), p(0.13, 0.507, -0.008), 0.02));
    // tibia, fibula, patella
    add(B('tibia'), capsule(p(0.07, 0.482, 0.0), p(0.13, 0.482, 0.0), 0.016));
    add(B('tibia'), capsule(p(0.1, 0.475, 0.004), p(0.098, 0.09, 0.0), 0.0135));
    add(B('tibia'), ellipsoid(p(0.084, 0.075, 0.0), 0.009, 0.013, 0.011));
    add(B('tibia'), ellipsoid(p(0.1, 0.452, 0.02), 0.009, 0.012, 0.008));
    add(B('tibia'), ellipsoid(p(0.1, 0.535, 0.045), 0.02, 0.024, 0.01));
    add(B('tibia'), capsule(p(0.136, 0.465, -0.016), p(0.127, 0.08, -0.01), 0.0065));
    add(B('tibia'), ellipsoid(p(0.138, 0.465, -0.018), 0.01, 0.012, 0.01));
    add(B('tibia'), ellipsoid(p(0.128, 0.068, -0.01), 0.009, 0.014, 0.01));
    // foot
    add(B('foot'), ellipsoid(p(0.1, 0.064, 0.005), 0.019, 0.017, 0.022));
    add(B('foot'), capsule(p(0.1, 0.04, -0.055), p(0.105, 0.04, 0.02), 0.021));
    add(B('foot'), ellipsoid(p(0.106, 0.045, 0.042), 0.035, 0.016, 0.02));
    const mx0 = [0.083, 0.095, 0.107, 0.119, 0.13], mx1 = [0.077, 0.094, 0.11, 0.124, 0.137], mr = [0.0075, 0.006, 0.0055, 0.0055, 0.0055];
    for (let i = 0; i < 5; i++) add(B('foot'), capsule(p(mx0[i], 0.04, 0.045), p(mx1[i], 0.016, 0.125), mr[i]));
    const tl = [0.045, 0.036, 0.032, 0.028, 0.024], tr = [0.008, 0.0055, 0.005, 0.005, 0.0048];
    for (let i = 0; i < 5; i++) add(B('toes'), capsule(p(mx1[i], 0.016, 0.132), p(mx1[i], 0.012, 0.132 + tl[i]), tr[i]));
  }

  const meshes = [];
  for (const bone in parts) {
    for (const kind in parts[bone]) {
      const merged = mergeGeometries(parts[bone][kind], false);
      const r = skel.rest[bone];
      merged.translate(-r.x, -r.y, -r.z);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mats[kind]);
      mesh.userData.bone = bone;
      skel.bones[bone].add(mesh);
      meshes.push(mesh);
    }
  }
  return meshes;
}
