// Squat Lab page. Proper form plays a normal rep; each fault plays as a slow, paced story of three beats
// (with pauses) so you can see what gives out, what takes over, and where the strain ends up.
import * as THREE from 'three';
import { SIDES, SIDE_LABEL } from './skeleton.js';
import { createStage, createBody, createPicker, esc, clamp01, glowTexture } from './viewer.js';
import {
  PHASES, CYCLE, timeline, STEPS, stepIndex, GROUPS, GROUP_OF, VARIANTS, STORIES, storyAt, storyLength,
  kinematics, poseSpec, activation, applyHipLimit, WINK_HIP_LIMIT,
} from './squatModel.js';
import { createSquatViz, centerOfMass as comOf, jointLoads, bonePos, boneLocal } from './squatViz.js';
import { createSpineInset } from './spineInset.js';
import { createKneeInset } from './kneeInset.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ scene
const VIEWS = {
  three: [[-2.8, 1.2, 3.35], [0, 0.68, 0.02]],
  front: [[0, 0.9, 4.4], [0, 0.68, 0]],
  side: [[-4.4, 0.9, 0.15], [0, 0.68, 0.03]],
  back: [[0, 0.9, -4.4], [0, 0.68, 0]],
  knees: [[-0.36, 0.55, 1.8], [-0.2, 0.33, 0.03]],
  hips: [[-2.4, 0.62, 0.05], [0, 0.45, -0.32]],
  sideR: [[-4.9, 1.0, -0.22], [0, 0.78, -0.22]],
};
const viewport = $('#viewport');
const { renderer, scene, camera, controls, flyTo, updateFly } = createStage(viewport, { cameraPos: VIEWS.three[0], target: VIEWS.three[1] });
const body = createBody(scene);
const { skel, insts, instByKey, boneMeshes } = body;
const ui = { skel: true, fade: true, align: false, balance: false, loads: false, threshold: 0.35 };
const pickAt = createPicker({ renderer, camera, body, bonesVisible: () => ui.skel });
const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));
const spine = createSpineInset($('#spine'));
const kneeZoom = createKneeInset($('#knee'));

const state = { variant: 'proper', t: 0, playing: true, speed: 1 };
const variant = () => VARIANTS.find((v) => v.id === state.variant);
const isStory = () => state.variant !== 'proper';
const duration = () => (isStory() ? storyLength(state.variant) : CYCLE);
function setView(name) {
  const [p, t] = VIEWS[name];
  flyTo(new V3(...t), new V3(...p));
}

function poseValues(kin) {
  const { central, sided } = poseSpec(kin);
  const out = skel.resolve(central, 'R');
  for (const S of SIDES) Object.assign(out, skel.resolve(sided, S));
  return out;
}

// ------------------------------------------------------------------ optional overlays: alignment lines, balance
const overlay = new THREE.Group();
scene.add(overlay);
const COL_OK = 0xdfe6ee, COL_WARN = 0xff5b5b, COL_GOOD = 0x6fe0a0;
function makeLine(n, color, dashed = false) {
  const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, () => new V3()));
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.02, gapSize: 0.012, depthTest: false, transparent: true, opacity: 0.85 })
    : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 });
  const l = new THREE.Line(g, m);
  l.renderOrder = 30;
  l.frustumCulled = false;
  overlay.add(l);
  return l;
}
function setPts(l, pts) {
  const a = l.geometry.attributes.position;
  pts.forEach((p, i) => a.setXYZ(i, p.x, p.y, p.z));
  a.needsUpdate = true;
  if (l.material.isLineDashedMaterial) l.computeLineDistances();
}
function dot(r, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true }));
  m.renderOrder = 31;
  overlay.add(m);
  return m;
}
const legLines = { R: makeLine(3, COL_OK), L: makeLine(3, COL_OK) };
const torsoLine = makeLine(2, COL_OK);
const comDot = dot(0.014, 0xffd23f);
const plumb = makeLine(2, 0xffd23f, true);
const floorDot = dot(0.01, 0xffd23f);
const footLines = { R: makeLine(2, COL_GOOD), L: makeLine(2, COL_GOOD) };

const pivot = (b, t) => bonePos(skel, b, t);
const local = (b, x, y, z) => boneLocal(skel, b, x, y, z);
const centerOfMass = () => comOf(skel);

// ------------------------------------------------------------------ poses
// Balance: the torso leans just enough to keep the centre of mass over the feet (solved, not scripted).
skel.apply({});
skel.plantFeet();
const BALANCE_Z = centerOfMass().z;
let clockT = 0; // drives the red flashing of straining muscles
/** Joint angles for a moment of the rep, with story overrides (rounding, knee collapse). */
function solvedKinematics(vid, st, over = {}) {
  const kin = kinematics(vid, st);
  if (over.valgus !== undefined) kin.valgus = over.valgus;
  if (over.round) kin.lumbar += 24 * over.round;
  let lo = 0, hi = 85;
  for (let i = 0; i < 9; i++) {
    kin.torso = (lo + hi) / 2;
    applyHipLimit(vid, kin);
    skel.apply(poseValues(kin));
    skel.plantFeet();
    if (centerOfMass().z > BALANCE_Z) hi = kin.torso; else lo = kin.torso;
  }
  kin.torso = (lo + hi) / 2;
  applyHipLimit(vid, kin);
  return kin;
}

// The butt-wink lifter's depth where the hip runs out of room.
const storyCtx = { sLim: 0.8 };
{
  let lo = 0.3, hi = 1;
  for (let i = 0; i < 12; i++) {
    const s = (lo + hi) / 2;
    const kin = solvedKinematics('wink', { phase: 'descent', phaseInfo: PHASES[2], k: 0, s, u: null, brace: 1, arms: 1 });
    if (kin.wink > 0.3) hi = s; else lo = s;
  }
  storyCtx.sLim = lo;
}

/** Everything that defines the moment at time t: state, overrides, beat. */
function frameAt(t) {
  if (!isStory()) return { st: timeline(t) };
  return storyAt(state.variant, t, storyCtx);
}

// Peak joint loads during a proper rep: the scale for the optional load gauges.
const PEAKS = { knee: 1, hip: 1, back: 1 };
for (let t = 0; t < CYCLE; t += 0.1) {
  const kin = solvedKinematics('proper', timeline(t));
  skel.apply(poseValues(kin));
  skel.plantFeet();
  const L = jointLoads(skel);
  for (const k in PEAKS) PEAKS[k] = Math.max(PEAKS[k], L[k].torque);
}

// ------------------------------------------------------------------ labels (at most one story label at a time)
const labels = {};
function label(key) {
  if (!labels[key]) {
    const el = document.createElement('div');
    el.className = 'lbl';
    $('#labels').appendChild(el);
    labels[key] = { el, pos: new V3(), on: false, html: '' };
  }
  return labels[key];
}
function showLabel(key, pos, text, cls) {
  const l = label(key);
  l.el.className = `lbl ${cls}`;
  l.pos.copy(pos);
  l.on = true;
  if (l.html !== text) { l.el.textContent = text; l.html = text; }
}
function showStoryLabel(spec) {
  const anchor = {
    thigh: () => pivot('femur_R').lerp(pivot('tibia_R'), 0.55).add(new V3(-0.04, 0.04, 0.06)),
    back: () => local('lumbar', 0, 1.1, -0.1).add(new V3(0, -0.16, 0)),
    hip: () => pivot('femur_R').add(new V3(-0.06, 0.06, -0.06)),
    knee: () => pivot('tibia_R').add(new V3(-0.05, 0.05, 0.05)),
    pelvis: () => pivot('pelvis').add(new V3(0, -0.04, -0.16)),
  }[spec.at]();
  const l = label('story');
  l.el.className = 'lbl lbl-story';
  l.pos.copy(anchor);
  l.on = true;
  const html = `<span>${esc(spec.text)}</span>${spec.bar ? '<i class="ebar"><b></b></i>' : ''}`;
  if (l.html !== html) { l.el.innerHTML = html; l.html = html; }
  if (spec.bar) {
    const b = l.el.querySelector('.ebar b');
    b.style.width = `${Math.round(clamp01(spec.bar.value) * 100)}%`;
    b.style.background = spec.bar.color;
  }
}
function updateLabels() {
  const r = renderer.domElement.getBoundingClientRect();
  const p = new V3();
  for (const k in labels) {
    const l = labels[k];
    if (!l.on) { l.el.style.display = 'none'; continue; }
    p.copy(l.pos).project(camera);
    if (p.z > 1) { l.el.style.display = 'none'; continue; }
    l.el.style.display = 'block';
    l.el.style.transform = `translate(${((p.x + 1) / 2) * r.width}px, ${((1 - p.y) / 2) * r.height}px)`;
  }
}

const viz = createSquatViz(scene, { camera, showLabel });

function updateOverlays(kin) {
  overlay.children.forEach((c) => (c.visible = false));
  if (ui.align) {
    const warn = kin.valgus > 6 || kin.wink + kin.lumbar > 8;
    for (const S of SIDES) {
      setPts(legLines[S], [pivot(`femur_${S}`), pivot(`tibia_${S}`), pivot(`foot_${S}`)]);
      legLines[S].material.color.setHex(warn ? COL_WARN : COL_OK);
      legLines[S].visible = true;
    }
    setPts(torsoLine, [pivot('femur_R').add(pivot('femur_L')).multiplyScalar(0.5), pivot('neck')]);
    torsoLine.visible = true;
  }
  if (ui.balance) {
    const com = centerOfMass();
    for (const S of SIDES) {
      const s = S === 'R' ? -1 : 1;
      setPts(footLines[S], [local(`foot_${S}`, 0.1 * s, 0.003, -0.078), local(`toes_${S}`, 0.11 * s, 0.003, 0.172)]);
      footLines[S].visible = true;
    }
    comDot.position.copy(com);
    floorDot.position.set(com.x, 0.003, com.z);
    setPts(plumb, [com, floorDot.position]);
    comDot.visible = floorDot.visible = plumb.visible = true;
  }
}

// ------------------------------------------------------------------ muscle colouring (smoothed, no flicker)
let hovered = null, hoverGroup = null, picked = null;
const shown = {}, litState = {};
const lerpN = (a, b, k) => a + (b - a) * k;
function updateMaterials(A, AP, dt, flash = {}) {
  const anyFlash = Math.max(0, ...Object.values(flash));
  const fault = isStory();
  const k = 1 - Math.exp(-dt / 0.12); // smooth the glow over ~0.1 s
  for (const g of GROUPS) {
    shown[g.id] = shown[g.id] === undefined ? A[g.id] : shown[g.id] + (A[g.id] - shown[g.id]) * k;
    // Hysteresis: switch on a little above the threshold and off a little below, so nothing blinks.
    const a = shown[g.id];
    if (litState[g.id]) { if (a < ui.threshold - 0.04) litState[g.id] = false; }
    else if (a > ui.threshold + 0.04) litState[g.id] = true;
  }
  for (const i of insts) {
    const g = GROUP_OF[i.def.id];
    const a = g ? shown[g] : 0;
    const d = g && fault ? a - AP[g] : 0;
    const m = i.material;
    const lit = g && litState[g];
    const kk = lit ? 0.25 + 0.75 * clamp01((a - ui.threshold) / Math.max(0.05, 1 - ui.threshold)) : 0;
    if (lit) {
      m.color.setRGB(1.15 + 0.35 * kk, 1, 1);
      m.emissive.setRGB(0.95 * kk, 0.2 * kk, 0.04 * kk);
    } else {
      m.color.setRGB(0.42, 0.42, 0.45);
      m.emissive.setRGB(0, 0, 0);
    }
    // Straining muscles throb dark red ↔ bright red; everything else steps back while they do.
    const fl = g ? flash[g] || 0 : 0;
    if (fl > 0.01) {
      const beat = Math.pow(0.5 + 0.5 * Math.sin(clockT * 2 * Math.PI * 2.2), 1.6);
      const p = fl * beat;
      // Saturated reds only: very bright reds tone-map toward orange/yellow, so keep green/blue near zero.
      m.color.setRGB(lerpN(m.color.r, 0.55 + 0.5 * p, fl), lerpN(m.color.g, 0.03, fl), lerpN(m.color.b, 0.03, fl));
      m.emissive.setRGB(lerpN(m.emissive.r, 0.08 + 0.95 * p, fl), lerpN(m.emissive.g, 0, fl), lerpN(m.emissive.b, 0, fl));
    } else if (anyFlash > 0.05 && lit) {
      const dimK = 1 - 0.55 * anyFlash;
      m.emissive.multiplyScalar(dimK);
      m.color.multiplyScalar(0.75 + 0.25 * dimK);
    }
    const highlighted = i === hovered || i === picked || (hoverGroup && g === hoverGroup);
    if (highlighted) { m.emissive.r += 0.2; m.emissive.g += 0.2; m.emissive.b += 0.15; }
    body.setOpacity(i, ui.fade && !lit && !highlighted && fl < 0.01 ? 0.13 : 1);
  }
  for (const m of boneMeshes) m.visible = ui.skel;
}

// ------------------------------------------------------------------ shortening / lengthening from the model
const groupRate = {};
function groupLengthsAt(t) {
  const f = frameAt(t);
  skel.apply(poseValues(solvedKinematics(state.variant, f.st, f)));
  skel.plantFeet();
  const out = {};
  for (const g of GROUPS) {
    let L = 0, n = 0;
    for (const id of g.muscles) for (const st of instByKey[`${id}_R`].strands) { L += st.measure(); n++; }
    out[g.id] = L / n;
  }
  return out;
}
function updateRates(t) {
  const h = 0.05;
  const a = groupLengthsAt(t - h), b = groupLengthsAt(t + h);
  for (const g of GROUPS) groupRate[g.id] = (b[g.id] - a[g.id]) / ((a[g.id] + b[g.id]) / 2) / (2 * h);
}
function modeOf(gid, a) {
  if (a < 0.07) return 'off';
  const r = groupRate[gid] ?? 0;
  return r < -0.035 ? 'con' : r > 0.035 ? 'ecc' : 'iso';
}
const MODE_TEXT = { con: 'shortening', ecc: 'lengthening', iso: 'holding', off: 'quiet' };

// ------------------------------------------------------------------ left panel
function renderVariants() {
  $('#variants').innerHTML = VARIANTS.map((v) => `<button data-v="${v.id}" class="${v.id === state.variant ? 'on' : ''} ${v.id === 'proper' ? '' : 'fault'}"><i class="dot"></i>${esc(v.name)}</button>`).join('');
  $('#variants').querySelectorAll('button').forEach((b) => (b.onclick = () => setVariant(b.dataset.v)));
}
function storyStart(vid, n) {
  let t = 0;
  for (const b of STORIES[vid]) { if (b.n === n) return t + 0.02; t += b.dur; }
  return 0;
}
function phaseStart(id) {
  let t = 0;
  for (const p of PHASES) { if (p.id === id) return t + 0.02; t += p.dur; }
  return 0;
}
function renderSteps() {
  const v = variant();
  const ol = $('#steps');
  if (!isStory()) {
    ol.className = '';
    ol.innerHTML = STEPS.map((s, k) => `<li data-k="${k}"><b>${esc(s.title)}</b>${esc(s.text)}</li>`).join('');
    ol.querySelectorAll('li').forEach((li) => (li.onclick = () => { state.t = phaseStart(STEPS[+li.dataset.k].phase); }));
    $('#notes').innerHTML = '<p class="hint">Glow = working hard.</p>';
  } else {
    ol.className = 'story';
    ol.innerHTML = v.list.map((s, k) => `<li data-n="${k + 1}"><b>${esc(s)}</b></li>`).join('');
    ol.querySelectorAll('li').forEach((li) => (li.onclick = () => { state.t = storyStart(state.variant, +li.dataset.n); }));
    $('#notes').innerHTML = `<details><summary>Why it matters · how to fix</summary>
      <ul>${v.matters.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <ul class="fix">${v.fix.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`;
  }
  lastStep = null;
}
function setVariant(id) {
  state.variant = id;
  state.t = 0;
  renderVariants();
  renderSteps();
  $('#tickLegend').style.display = id === 'proper' ? 'none' : '';
  $('#spine').classList.toggle('on', id === 'hips' || id === 'wink');
  $('#knee').classList.toggle('on', id === 'valgus');
  setView(variant().view);
}

// ------------------------------------------------------------------ right panel
function renderEmg() {
  $('#emg').innerHTML = GROUPS.map((g) => `
    <div class="emg-row" data-g="${g.id}" title="${esc(g.role)}">
      <div class="emg-name">${esc(g.name)}</div>
      <div class="emg-bar"><i class="thr"></i><i class="fill"></i><i class="tick"></i></div>
      <span class="emg-mode"></span>
    </div>`).join('');
  $('#emg').querySelectorAll('.emg-row').forEach((row) => {
    row.onmouseenter = () => (hoverGroup = row.dataset.g);
    row.onmouseleave = () => (hoverGroup = null);
    row.onclick = () => pick(instByKey[`${groupById[row.dataset.g].muscles[0]}_R`]);
  });
}
const MODE_COLOR = { con: 'var(--con)', ecc: 'var(--ecc)', iso: 'var(--iso)', off: '#3a4350' };
function updateEmg(AP) {
  const fault = isStory();
  for (const row of $('#emg').children) {
    const g = row.dataset.g;
    const a = shown[g] ?? 0, mode = modeOf(g, a);
    const fill = row.querySelector('.fill'), tick = row.querySelector('.tick'), m = row.querySelector('.emg-mode');
    fill.style.width = `${(a * 100).toFixed(1)}%`;
    fill.style.background = MODE_COLOR[mode];
    tick.style.display = fault ? 'block' : 'none';
    tick.style.left = `calc(${(AP[g] * 100).toFixed(1)}% - 1px)`;
    m.textContent = MODE_TEXT[mode];
    m.className = `emg-mode ${mode}`;
    row.classList.toggle('hl', hoverGroup === g);
    row.classList.toggle('lit', !!litState[g]);
  }
}

function pick(inst) {
  picked = inst;
  renderPicked();
}
function renderPicked() {
  const box = $('#picked');
  if (!picked) { box.innerHTML = ''; return; }
  const g = groupById[GROUP_OF[picked.def.id]];
  box.innerHTML = `<button class="x" title="Close">×</button>
    <h4>${esc(picked.def.name)} <small style="color:var(--muted);font-weight:400">${SIDE_LABEL[picked.S]}</small></h4>
    <p>${g ? esc(g.role) : 'Barely used in a squat.'}</p>
    <a href="./?m=${encodeURIComponent(picked.def.id)}&s=${picked.S}">Open in Muscle Explorer →</a>`;
  box.querySelector('.x').onclick = () => pick(null);
}

// ------------------------------------------------------------------ interaction
const tooltip = $('#tooltip');
let pendingMove = null, down = null;
renderer.domElement.addEventListener('pointermove', (e) => (pendingMove = e));
renderer.domElement.addEventListener('pointerleave', () => { pendingMove = null; hovered = null; tooltip.style.display = 'none'; });
renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || e.button !== 0) { down = null; return; }
  down = null;
  pick(pickAt(e.clientX, e.clientY));
});
function processHover() {
  if (!pendingMove) return;
  const e = pendingMove;
  pendingMove = null;
  if (e.buttons) { tooltip.style.display = 'none'; return; }
  hovered = pickAt(e.clientX, e.clientY);
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  if (!hovered) { tooltip.style.display = 'none'; return; }
  const g = GROUP_OF[hovered.def.id];
  const r = viewport.getBoundingClientRect();
  tooltip.style.display = 'block';
  tooltip.style.left = `${e.clientX - r.left + 14}px`;
  tooltip.style.top = `${e.clientY - r.top + 12}px`;
  tooltip.innerHTML = `${esc(hovered.def.name)} <span>${g ? `${Math.round((shown[g] ?? 0) * 100)}%` : 'quiet'}</span>`;
}

const playBtn = $('#play'), scrubEl = $('#scrub');
function updatePlayButton() { playBtn.textContent = state.playing ? '❚❚' : '▶'; }
function togglePlay() { state.playing = !state.playing; updatePlayButton(); }
playBtn.onclick = togglePlay;
scrubEl.addEventListener('input', () => { state.playing = false; state.t = (scrubEl.value / 1000) * duration(); updatePlayButton(); });
$('#speed').addEventListener('change', (e) => (state.speed = +e.target.value));
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
function setThreshold(v) {
  ui.threshold = v / 100;
  $('#tThrVal').textContent = `${v}%`;
  document.querySelectorAll('.emg-bar .thr').forEach((el) => (el.style.left = `${v}%`));
}
$('#tThr').addEventListener('input', (e) => setThreshold(+e.target.value));
for (const [id, key] of [['tSkel', 'skel'], ['tFade', 'fade'], ['tAlign', 'align'], ['tBalance', 'balance'], ['tLoads', 'loads']]) {
  const el = $(`#${id}`);
  if (!el) continue;
  el.checked = ui[key];
  el.addEventListener('change', () => (ui[key] = el.checked));
}
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Escape') pick(null);
});

// Strain in the spine itself (discs + ligaments): a red throb on the lower spine once it rounds.
const spineGlowTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
const spineGlows = [0, 1, 2].map(() => {
  const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: spineGlowTex, color: 0xff2414, transparent: true, depthTest: false, depthWrite: false }));
  g.renderOrder = 50;
  g.visible = false;
  scene.add(g);
  return g;
});
function updateSpineStrain(kin) {
  const strain = clamp01((kin.wink + kin.lumbar - 7) / 12);
  const beat = 0.5 + 0.5 * Math.sin(clockT * 2 * Math.PI * 2.2);
  const pts = [local('lumbar', 0, 1.065, -0.045), local('lumbar', 0, 1.13, -0.04), local('thorax', 0, 1.205, -0.05)];
  spineGlows.forEach((g, i) => {
    g.visible = strain > 0.02;
    g.position.copy(pts[i]);
    g.scale.setScalar(0.04 + 0.07 * strain * (0.55 + 0.45 * beat));
    g.material.opacity = Math.min(1, strain * (0.5 + 0.6 * beat));
  });
  return { strain, beat };
}

// Marker on the lower back + line to the zoom bubble.
const zoomLink = $('#zoomLink');
function updateZoomLink() {
  const bubble = $('#knee').classList.contains('on') ? $('#knee') : $('#spine');
  const on = bubble.classList.contains('on');
  zoomLink.style.display = on ? 'block' : 'none';
  if (!on) return;
  const vr = viewport.getBoundingClientRect(), sr = bubble.querySelector('svg').getBoundingClientRect();
  const p = (bubble.id === 'knee' ? pivot('tibia_R') : local('lumbar', 0, 1.1, -0.1)).project(camera);
  const mx = ((p.x + 1) / 2) * vr.width, my = ((1 - p.y) / 2) * vr.height;
  const cx = sr.left - vr.left + sr.width / 2, cy = sr.top - vr.top + sr.height / 2, r = sr.width / 2;
  const dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1;
  const line = zoomLink.querySelector('line'), circ = zoomLink.querySelector('circle');
  line.setAttribute('x1', cx + (dx / d) * r); line.setAttribute('y1', cy + (dy / d) * r);
  line.setAttribute('x2', mx - (dx / d) * 16); line.setAttribute('y2', my - (dy / d) * 16);
  circ.setAttribute('cx', mx); circ.setAttribute('cy', my);
}

// ------------------------------------------------------------------ loop
let lastStep = null, lastCaption = null, frame = 0;
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  clockT += dt;
  if (state.playing) {
    state.t = (state.t + dt * state.speed) % duration();
    scrubEl.value = Math.round((state.t / duration()) * 1000);
  }
  const f = frameAt(state.t);
  const st = f.st;
  // These probe other poses, so they all run before the real pose is applied.
  const kinP = solvedKinematics('proper', st);
  if (frame % 2 === 0) updateRates(state.t);
  const kin = solvedKinematics(state.variant, st, f);
  skel.apply(poseValues(kin));
  skel.plantFeet();
  body.update();
  const A = activation(state.variant, st, kin);
  if (f.act) Object.assign(A, f.act);
  const AP = activation('proper', st, kinP);

  for (const k in labels) labels[k].on = false;
  processHover();
  updateMaterials(A, AP, dt, f.flash);
  updateOverlays(kin);
  const pulse = 0.5 + 0.5 * Math.sin(clockT * 2 * Math.PI * 2.2);
  const vz = viz.update({ skel, variant: state.variant, kin, A, peaks: PEAKS, hipLimit: WINK_HIP_LIMIT, ui, pulse });
  if (state.variant === 'valgus') kneeZoom.update({ strain: vz.kneeStrain, pulse });
  if (f.label) showStoryLabel(f.label);
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  const ss = updateSpineStrain(kin);
  if (isStory()) spine.update({ flex: kin.wink + kin.lumbar, effort: shown.erector ?? 0, pulse: ss.beat });
  updateZoomLink();

  // Step list + caption change only when the beat / phase changes.
  const stepKey = isStory() ? f.beat.n : stepIndex(st);
  if (stepKey !== lastStep) {
    lastStep = stepKey;
    $('#steps').querySelectorAll('li').forEach((li) => li.classList.toggle('on', isStory() ? +li.dataset.n === stepKey : +li.dataset.k === stepKey));
  }
  const cap = isStory() ? `${f.beat.n}|${f.beat.caption}` : `0|${st.phaseInfo.label}|${st.phaseInfo.sub}`;
  if (cap !== lastCaption) {
    lastCaption = cap;
    const box = $('#phase');
    if (isStory()) {
      box.innerHTML = f.beat.caption ? `${f.beat.n ? `<i>${f.beat.n}</i>` : ''}<b>${esc(f.beat.caption)}</b>` : '';
    } else {
      box.innerHTML = `<b>${esc(st.phaseInfo.label)}</b>${st.phaseInfo.sub ? `<span>${esc(st.phaseInfo.sub)}</span>` : ''}`;
    }
    box.style.visibility = box.innerHTML ? 'visible' : 'hidden';
  }
  if (frame++ % 3 === 0) updateEmg(AP);
  requestAnimationFrame(tick);
}

renderEmg();
setThreshold(Math.round(ui.threshold * 100));
setVariant('proper');
updatePlayButton();
requestAnimationFrame(tick);

window.__squat = { state, skel, setVariant, camera, controls, storyCtx };
