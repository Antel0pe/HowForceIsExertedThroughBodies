// A muscle "strand": a tube that follows its attachment points as the bones move.
// The belly bulges as the strand shortens (muscle volume is roughly constant).
import * as THREE from 'three';
import { SIDE_SIGN } from './skeleton.js';

const V3 = THREE.Vector3;
export const NSEG = 26;
export const NRAD = 12;
const RINGS = NSEG + 1;
const VPR = NRAD + 1;

const TENDON = new THREE.Color(0.93, 0.89, 0.8);
const MUSCLE = new THREE.Color(0.66, 0.13, 0.11);

function profile(u, ts, te) {
  const span = Math.max(0.05, 1 - ts - te);
  const x = (u - ts) / span;
  if (x <= 0 || x >= 1) return 0;
  return Math.pow(Math.sin(Math.PI * x), 0.55);
}

const _t = new V3(), _n = new V3(), _b = new V3(), _h = new V3(), _hA = new V3(), _hB = new V3(), _tmp = new V3();
const Zax = new V3(0, 0, 1), Xax = new V3(1, 0, 0);

export class Strand {
  constructor(inst, sdef, skel, idx) {
    const S = inst.S, s = SIDE_SIGN[S], def = inst.def;
    this.inst = inst;
    this.skel = skel;
    this.r = sdef.r;
    this.ts = sdef.ts ?? def.ts ?? 0.14;
    this.te = sdef.te ?? def.te ?? 0.14;
    this.thick = sdef.thick ?? def.thick ?? 0.4;
    const flat = sdef.flat ?? def.flat;
    this.flatRest = flat ? new V3(flat[0] * s, flat[1], flat[2]).normalize() : null;
    this.pts = sdef.pts.map(([b, x, y, z]) => {
      const bone = skel.boneName(b, S);
      if (!skel.bones[bone]) throw new Error(`${def.id}: unknown bone ${b}`);
      return { bone, obj: skel.bones[bone], local: new V3(x * s, y, z).sub(skel.rest[bone]) };
    });
    // Optional wrap sphere (e.g. around the elbow) the muscle path cannot pass through.
    const wrap = sdef.wrap ?? def.wrap;
    if (wrap) {
      const [b, x, y, z, r] = wrap;
      const bone = skel.boneName(b, S);
      this.wrap = { obj: skel.bones[bone], local: new V3(x * s, y, z).sub(skel.rest[bone]), r, c: new V3() };
    }
    this.bones = [...new Set(this.pts.map((p) => p.bone))];
    this.world = this.pts.map(() => new V3());
    this.curve = new THREE.CatmullRomCurve3(this.world, false, 'centripetal', 0.5);
    this.centers = Array.from({ length: RINGS }, () => new V3());
    this.len = 1;
    this.L0 = null;

    const n = RINGS * VPR;
    this.pos = new Float32Array(n * 3);
    this.nor = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    this.prof = new Float32Array(RINGS);
    const jitter = 0.92 + ((idx * 37) % 10) / 60;
    const c = new THREE.Color();
    for (let i = 0; i < RINGS; i++) {
      const u = i / NSEG;
      const b = profile(u, this.ts, this.te);
      this.prof[i] = b;
      c.copy(TENDON).lerp(MUSCLE, Math.min(1, b * 1.7));
      if (b > 0) c.multiplyScalar(jitter);
      for (let j = 0; j < VPR; j++) {
        const k = i * VPR + j;
        col.set([c.r, c.g, c.b], k * 3);
        uv.set([u, (j / NRAD) * 2], k * 2);
      }
    }
    const index = [];
    for (let i = 0; i < NSEG; i++) {
      for (let j = 0; j < NRAD; j++) {
        const a = i * VPR + j, b = (i + 1) * VPR + j, cc = (i + 1) * VPR + j + 1, d = i * VPR + j + 1;
        index.push(a, b, d, b, cc, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(index);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.norAttr = new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('normal', this.norAttr);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, inst.material);
    this.mesh.frustumCulled = false;
    this.mesh.userData.inst = inst;
    this.mesh.userData.strand = this;
    this.boundsDirty = true;
  }

  needsUpdate() {
    for (const b of this.bones) if (this.skel.dirty[b]) return true;
    return false;
  }

  /** Recompute world attachment points and path length only. */
  computeWorld() {
    let L = 0;
    for (let i = 0; i < this.pts.length; i++) {
      this.world[i].copy(this.pts[i].local).applyMatrix4(this.pts[i].obj.matrixWorld);
      if (i) L += this.world[i].distanceTo(this.world[i - 1]);
    }
    return L;
  }

  update() {
    this.computeWorld();
    for (let i = 0; i < RINGS; i++) this.curve.getPoint(i / NSEG, this.centers[i]);
    if (this.wrap) {
      const c = this.wrap.c.copy(this.wrap.local).applyMatrix4(this.wrap.obj.matrixWorld);
      const R = this.wrap.r;
      for (let i = 1; i < NSEG; i++) {
        const p = this.centers[i];
        const d = p.distanceTo(c);
        if (d < R) p.sub(c).multiplyScalar(R / Math.max(d, 1e-6)).add(c);
      }
    }
    let L = 0;
    for (let i = 1; i < RINGS; i++) L += this.centers[i].distanceTo(this.centers[i - 1]);
    this.len = L;
    if (this.L0 === null) this.L0 = L;
    const k = Math.min(1.45, Math.max(0.78, Math.sqrt(this.L0 / L)));

    if (this.flatRest) {
      _hA.copy(this.flatRest).applyQuaternion(this.skel.wq[this.pts[0].bone]);
      _hB.copy(this.flatRest).applyQuaternion(this.skel.wq[this.pts[this.pts.length - 1].bone]);
    } else {
      _tmp.copy(this.world[this.world.length - 1]).sub(this.world[0]).normalize();
      _hA.crossVectors(_tmp, Math.abs(_tmp.z) < 0.9 ? Zax : Xax).normalize();
      _hB.copy(_hA);
    }

    const rt = Math.max(0.0026, this.r * 0.2);
    const prevN = _n.set(0, 0, 0);
    for (let i = 0; i < RINGS; i++) {
      const u = i / NSEG;
      const c = this.centers[i];
      _t.copy(this.centers[Math.min(i + 1, NSEG)]).sub(this.centers[Math.max(i - 1, 0)]);
      if (_t.lengthSq() < 1e-12) _t.set(0, 1, 0);
      _t.normalize();
      _h.copy(_hA).lerp(_hB, u);
      _h.addScaledVector(_t, -_h.dot(_t));
      if (_h.lengthSq() < 1e-8) _h.copy(prevN.lengthSq() ? prevN : Xax);
      _h.normalize();
      prevN.copy(_h);
      _b.crossVectors(_t, _h).normalize();

      const bulge = this.prof[i];
      let w = rt + (this.r * k - rt) * bulge;
      let th = this.flatRest ? Math.max(rt, rt + (this.r * this.thick * k - rt) * bulge) : w;
      if (this.flatRest && bulge === 0) w = rt * 1.6;
      if (i === 0 || i === NSEG) { w *= 0.75; th *= 0.75; }
      for (let j = 0; j < VPR; j++) {
        const a = (j / NRAD) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const o = (i * VPR + j) * 3;
        this.pos[o] = c.x + _b.x * ca * w + _h.x * sa * th;
        this.pos[o + 1] = c.y + _b.y * ca * w + _h.y * sa * th;
        this.pos[o + 2] = c.z + _b.z * ca * w + _h.z * sa * th;
        let nx = _b.x * ca * th + _h.x * sa * w, ny = _b.y * ca * th + _h.y * sa * w, nz = _b.z * ca * th + _h.z * sa * w;
        const l = Math.hypot(nx, ny, nz) || 1;
        this.nor[o] = nx / l; this.nor[o + 1] = ny / l; this.nor[o + 2] = nz / l;
      }
    }
    this.posAttr.needsUpdate = true;
    this.norAttr.needsUpdate = true;
    this.boundsDirty = true;
  }

  /** Path length (with wrapping) at the skeleton's current pose, without touching the mesh. */
  measure() {
    if (!this._mw) {
      this._mw = this.pts.map(() => new V3());
      this._mc = new THREE.CatmullRomCurve3(this._mw, false, 'centripetal', 0.5);
      this._mp = new V3(); this._mq = new V3(); this._mwc = new V3();
    }
    for (let i = 0; i < this.pts.length; i++) this._mw[i].copy(this.pts[i].local).applyMatrix4(this.pts[i].obj.matrixWorld);
    const wc = this.wrap ? this._mwc.copy(this.wrap.local).applyMatrix4(this.wrap.obj.matrixWorld) : null;
    let L = 0;
    for (let i = 0; i <= NSEG; i++) {
      const p = this._mc.getPoint(i / NSEG, this._mp);
      if (wc && i > 0 && i < NSEG) {
        const d = p.distanceTo(wc);
        if (d < this.wrap.r) p.sub(wc).multiplyScalar(this.wrap.r / Math.max(d, 1e-6)).add(wc);
      }
      if (i) L += p.distanceTo(this._mq);
      this._mq.copy(p);
    }
    return L;
  }

  ensureBounds() {
    if (this.boundsDirty) {
      this.geometry.computeBoundingSphere();
      this.geometry.computeBoundingBox();
      this.boundsDirty = false;
    }
  }

  get mid() { return this.centers[NSEG >> 1]; }
}

/** Subtle fibre texture: stripes running along the muscle length. */
export function makeFiberTexture() {
  const W = 8, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const row = 0.78 + Math.random() * 0.22 - (y % 6 === 0 ? 0.12 : 0);
    for (let x = 0; x < W; x++) {
      const v = Math.max(0, Math.min(1, row + (Math.random() - 0.5) * 0.04)) * 255;
      const o = (y * W + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
