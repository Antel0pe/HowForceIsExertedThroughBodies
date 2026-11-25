// Shared 3D building blocks used by every page: the stage (renderer, camera, lights),
// the body (skeleton + muscles) and the muscle picker (small muscles snap to the cursor).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Skeleton, buildBoneVisuals, SIDES } from './skeleton.js';
import { Strand, makeFiberTexture, NSEG } from './muscleMesh.js';
import { MUSCLES } from './muscles.js';

const V3 = THREE.Vector3;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
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

/** Renderer, camera, orbit controls, lights, floor glow and smooth camera flights. */
export function createStage(viewport, { cameraPos = [0, 1.0, 3.7], target = [0, 0.9, 0] } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  viewport.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  camera.position.set(...cameraPos);
  scene.add(camera);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
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

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 48),
    new THREE.MeshBasicMaterial({ map: glowTexture('rgba(120,140,170,0.35)', 'rgba(120,140,170,0)'), transparent: true, depthWrite: false })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.002;
  scene.add(floor);

  let fly = null;
  const flyTo = (tgt, pos, dur = 0.75) => {
    fly = { t: 0, dur, t0: controls.target.clone(), t1: tgt.clone(), p0: camera.position.clone(), p1: pos.clone() };
  };
  controls.addEventListener('start', () => { fly = null; });
  const updateFly = (dt) => {
    if (!fly) return;
    fly.t += dt;
    const k = ease(Math.min(1, fly.t / fly.dur));
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    camera.position.lerpVectors(fly.p0, fly.p1, k);
    if (k >= 1) fly = null;
  };

  const resize = () => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    camera.aspect = w / Math.max(1, h);
    // Keep at least ~24° of horizontal view so narrow viewports zoom out instead of cropping.
    const minHalfH = (12 * Math.PI) / 180;
    camera.fov = Math.max(30, (2 * Math.atan(Math.tan(minHalfH) / camera.aspect) * 180) / Math.PI);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(viewport);
  resize();

  return { renderer, scene, camera, controls, flyTo, updateFly, resize };
}

/** Skeleton, bone meshes and every muscle (both sides), each muscle with its own material. */
export function createBody(scene) {
  const skel = new Skeleton();
  scene.add(skel.root);
  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc6, roughness: 0.72, metalness: 0 });
  const cartMat = new THREE.MeshStandardMaterial({ color: 0xbcd0d4, roughness: 0.5, metalness: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x251c1c, roughness: 1 });
  const boneMeshes = buildBoneVisuals(skel, { bone: boneMat, cart: cartMat, dark: darkMat });

  const fiberTex = makeFiberTexture();
  const insts = [];
  const instByKey = {};
  let n = 0;
  for (const def of MUSCLES) {
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
  skel.apply({});
  skel.computeDirty();
  for (const s of allStrands) s.update();

  const instCenter = (inst, target = new V3()) => {
    target.set(0, 0, 0);
    for (const s of inst.strands) target.add(s.mid);
    return target.multiplyScalar(1 / inst.strands.length);
  };
  /** Rebuild the meshes of muscles whose bones moved since the last call. */
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
  return { skel, boneMeshes, insts, instByKey, allStrands, instCenter, update, setOpacity };
}

/** Returns pickAt(clientX, clientY): the muscle under the cursor, or the nearest visible one within a few pixels. */
export function createPicker({ renderer, camera, body, bonesVisible = () => true, radius = 24 }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const proj = new V3();
  const targetsNow = () => {
    const t = [];
    for (const s of body.allStrands) if (s.mesh.visible && s.inst.material.opacity > 0.3) { s.ensureBounds(); t.push(s.mesh); }
    if (bonesVisible()) t.push(...body.boneMeshes);
    return t;
  };
  return function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    ndc.set((mx / rect.width) * 2 - 1, -(my / rect.height) * 2 + 1);
    const targets = targetsNow();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length && hits[0].object.userData.inst) return hits[0].object.userData.inst;

    // Snap: nearest muscle centre-line on screen, within the radius, that is not hidden behind something.
    const cands = [];
    for (const s of body.allStrands) {
      if (!s.mesh.visible) continue;
      let best = Infinity, bestP = null, px = 0, py = 0, pv = false;
      for (let i = 0; i <= NSEG; i++) {
        proj.copy(s.centers[i]).project(camera);
        const ok = proj.z < 1;
        const sx = ((proj.x + 1) / 2) * rect.width, sy = ((1 - proj.y) / 2) * rect.height;
        if (ok && pv) {
          const dx = sx - px, dy = sy - py;
          const l2 = dx * dx + dy * dy;
          let t = l2 ? ((mx - px) * dx + (my - py) * dy) / l2 : 0;
          t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(px + dx * t - mx, py + dy * t - my);
          if (d < best) { best = d; bestP = new V3().lerpVectors(s.centers[i - 1], s.centers[i], t); }
        }
        px = sx; py = sy; pv = ok;
      }
      if (best < radius) cands.push({ s, d: best, p: bestP });
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
  };
}
