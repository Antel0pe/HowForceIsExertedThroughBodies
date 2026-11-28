// Bear Run page. Two modes:
//  - Gallop: a grizzly skeleton with its running muscles galloping on a treadmill floor; muscles glow
//    while they work and the paw diagram shows which paws are down.
//  - One muscle at a time: the bear stands still; click a muscle and it contracts (shortens, pulls the
//    bone, arrows show the pull), holds, then relaxes and is stretched back out. Helpers tint green,
//    muscles on the opposite side of the joint tint blue as they get stretched.
import * as THREE from 'three';
import './appSwitch.js';
import { SIDE_LABEL } from './skeleton.js';
import { createStage, createPicker, esc, clamp01, ease } from './viewer.js';
import { NSEG } from './muscleMesh.js';
import {
  createBearBody, BEAR_MUSCLES, BEAR_BONE_LABEL, MUSCLE_BY_ID, activations, gaitPose, standPose, GAIT, LIMBS, LIMB_LABEL,
  limbPhase, onGround, groundPerStride, PHASES, phaseAt,
} from './bearModel.js';

const V3 = THREE.Vector3;
const Yup = new V3(0, 1, 0);
const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ scene
const VIEWS = {
  side: [[5.0, 0.95, 0.05], [0, 0.5, -0.06]],
  three: [[3.6, 2.0, 3.3], [0, 0.48, 0]],
  front: [[0.8, 1.0, 5.0], [0, 0.55, 0]],
  above: [[1.7, 4.7, 0.3], [0, 0.45, 0]],
};
const viewport = $('#viewport');
const { renderer, scene, camera, controls, flyTo, updateFly } = createStage(viewport, { cameraPos: VIEWS.side[0], target: VIEWS.side[1] });
controls.maxDistance = 9;
const body = createBearBody(scene);
const { skel, insts, instByKey, boneMeshes } = body;
const ui = { skel: true, fade: true, threshold: 0.3 };
const pickAt = createPicker({ renderer, camera, body, bonesVisible: () => ui.skel });
const state = { mode: 'run', t: 0, playing: true, speed: 0.2 };
const setView = (name) => flyTo(new V3(...VIEWS[name][1]), new V3(...VIEWS[name][0]));
const baseBone = (b) => b.replace(/_(R|L)$/, '');

// Treadmill floor: stripes slide back at the speed a planted paw does, so paws stay put on the ground.
const ground = new THREE.Group();
scene.add(ground);
const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 6.4), new THREE.MeshBasicMaterial({ color: 0x161c23, transparent: true, opacity: 0.9, depthWrite: false }));
strip.rotation.x = -Math.PI / 2;
strip.position.y = -0.004;
ground.add(strip);
const STRIPE_GAP = 0.32, SPAN = 6.4;
const stripes = Array.from({ length: Math.round(SPAN / STRIPE_GAP) }, (_, i) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.014), new THREE.MeshBasicMaterial({ color: 0x5a6878, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.002;
  m.userData.z0 = i * STRIPE_GAP;
  ground.add(m);
  return m;
});
function updateGround() {
  const off = groundPerStride() * state.t;
  for (const m of stripes) {
    const z = ((((m.userData.z0 - off) % SPAN) + SPAN) % SPAN) - SPAN / 2;
    m.position.z = z;
    m.material.opacity = 0.75 * clamp01(1.3 - Math.abs(z) / (SPAN / 2));
  }
}

// ------------------------------------------------------------------ pull arrows + labels (one-muscle mode)
const overlay = new THREE.Group();
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
const insArrows = Array.from({ length: 4 }, () => makeArrow(0xffd23f));
const orgArrows = Array.from({ length: 4 }, () => makeArrow(0xff9a3c));
function makeLabel(cls) {
  const el = document.createElement('div');
  el.className = `lbl ${cls}`;
  $('#labels').appendChild(el);
  return { el, pos: new V3(), on: false, text: '' };
}
const labels = { ins: makeLabel('lbl-pull'), org: makeLabel('lbl-pull org') };
function showLabel(l, pos, text) {
  l.pos.copy(pos);
  l.on = true;
  if (l.text !== text) { l.el.textContent = text; l.text = text; }
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
const _a = new V3(), _b = new V3();
function updatePullArrows(inst, act) {
  for (const a of [...insArrows, ...orgArrows]) a.visible = false;
  labels.ins.on = labels.org.on = false;
  if (!inst || act < 0.03) return;
  const n = inst.strands.length;
  const len = (0.03 + 0.09 * act) * (n > 1 ? 0.8 : 1);
  const insAvg = new V3(), insDir = new V3(), orgAvg = new V3(), orgDir = new V3();
  inst.strands.forEach((st, i) => {
    if (i >= insArrows.length) return;
    const c = st.centers;
    _a.copy(c[NSEG - 3]).sub(c[NSEG]).normalize();
    setArrow(insArrows[i], st.world[st.world.length - 1], _a, len, 0.0035);
    insAvg.add(st.world[st.world.length - 1]);
    insDir.add(_a);
    _b.copy(c[3]).sub(c[0]).normalize();
    setArrow(orgArrows[i], st.world[0], _b, len * 0.8, 0.003);
    orgAvg.add(st.world[0]);
    orgDir.add(_b);
  });
  insAvg.multiplyScalar(1 / n).addScaledVector(insDir.normalize(), len * 1.1);
  orgAvg.multiplyScalar(1 / n).addScaledVector(orgDir.normalize(), len * 1.1);
  const insB = baseBone(inst.strands[0].pts.at(-1).bone), orgB = baseBone(inst.strands[0].pts[0].bone);
  if (insB !== orgB) {
    showLabel(labels.ins, insAvg, `pulls the ${BEAR_BONE_LABEL[insB]}`);
    showLabel(labels.org, orgAvg, `…and equally on the ${BEAR_BONE_LABEL[orgB]}`);
  }
}

// ------------------------------------------------------------------ one-muscle player
// Contract (shortens, glows, bone moves) → hold → relax (stretched back out by the pose) → pause.
const PT = { con: 1.4, hold: 0.7, rel: 1.4, pause: 0.6 };
const PTOTAL = PT.con + PT.hold + PT.rel + PT.pause;
const player = { inst: null, t: 0, syn: new Map(), ant: new Map(), L0: 1, L1: 1 };
function playerPhase(t) {
  let x = t;
  if (x < PT.con) { const k = x / PT.con; return { act: Math.min(1, 0.3 + k * 2.5), poseT: ease(k), step: 'Contracts: shortens and pulls' }; }
  x -= PT.con;
  if (x < PT.hold) return { act: 1, poseT: 1, step: 'Holds' };
  x -= PT.hold;
  if (x < PT.rel) { const k = x / PT.rel; return { act: Math.max(0, 1 - k * 3), poseT: 1 - ease(k), step: 'Relaxes: lengthens back out' }; }
  return { act: 0, poseT: 0, step: 'Relaxed' };
}
const instLength = (i) => i.strands.reduce((a, s) => a + s.computeWorld(), 0) / i.strands.length;
function poseStand(inst, k) {
  const { W, root, offsets } = standPose(skel, inst?.def.act, inst?.S ?? 'L', k);
  skel.apply(W, root, offsets);
}
/** Which other muscles shorten (helpers) or get stretched (opposite side) by this movement. */
function analyze(inst) {
  const measure = (k) => { poseStand(inst, k); return new Map(insts.map((i) => [i, instLength(i)])); };
  const A = measure(0), B = measure(1);
  const syn = [], ant = [];
  for (const i of insts) {
    if (i === inst) continue;
    const r = B.get(i) / A.get(i);
    if (r < 0.96) syn.push([i, 1 - r]);
    else if (r > 1.04) ant.push([i, r - 1]);
  }
  const norm = (arr) => {
    arr.sort((a, b) => b[1] - a[1]);
    const mx = arr.length ? arr[0][1] : 1;
    return new Map(arr.map(([i, v]) => [i, 0.45 + 0.55 * (v / mx)]));
  };
  player.syn = norm(syn);
  player.ant = norm(ant);
  player.L0 = A.get(inst);
  player.L1 = B.get(inst);
}
function focusOn(inst) {
  const c = new V3();
  let n = 0;
  for (const s of inst.strands) for (const w of s.world) { c.add(w); n++; }
  c.multiplyScalar(1 / n);
  let size = 0;
  for (const s of inst.strands) for (const w of s.world) size = Math.max(size, w.distanceTo(c));
  const dir = camera.position.clone().sub(controls.target).normalize();
  const sideSign = inst.S === 'L' ? 1 : -1;
  if (Math.sign(dir.x) !== sideSign) dir.x = -dir.x; // look at the side the muscle is on
  if (Math.abs(dir.x) < 0.35) { dir.x = 0.6 * sideSign; dir.normalize(); }
  const dist = THREE.MathUtils.clamp(size * 3 + 1.1, 1.6, 3.4);
  flyTo(c, c.clone().addScaledVector(dir, dist));
}

// ------------------------------------------------------------------ modes
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('#variants button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  $('#runOnly').hidden = mode !== 'run';
  $('#standOnly').hidden = mode !== 'stand';
  $('#scrub').title = mode === 'run' ? 'Scrub through one stride' : 'Scrub through the contraction';
  lastCaption = null;
  if (mode === 'stand') {
    if (picked) pick(picked); else setView('side');
  } else {
    for (const a of [...insArrows, ...orgArrows]) a.visible = false;
    labels.ins.on = labels.org.on = false;
    setView('side');
  }
  state.playing = true;
  updatePlayButton();
}
document.querySelectorAll('#variants button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));

// ------------------------------------------------------------------ left panel: phases + paw diagram
$('#steps').innerHTML = PHASES.map((ph, k) => `<li data-n="${k}"><b>${esc(ph.title)}</b></li>`).join('');
$('#steps').querySelectorAll('li').forEach((li) => (li.onclick = () => {
  state.t = Math.floor(state.t) + PHASES[+li.dataset.n].from + 0.01;
  state.playing = false;
  updatePlayButton();
}));

const GW = 236, ROW = 20, LABEL_W = 70, BAR_W = GW - LABEL_W - 4;
(function renderGait() {
  const svg = $('#gait');
  svg.setAttribute('viewBox', `0 0 ${GW} ${LIMBS.length * ROW + 4}`);
  svg.innerHTML = LIMBS.map((limb, i) => {
    const y = i * ROW + 3, o = GAIT.offsets[limb];
    const bars = [[o, Math.min(1, o + GAIT.D)], ...(o + GAIT.D > 1 ? [[0, o + GAIT.D - 1]] : [])];
    return `<text class="row-label" data-l="${limb}" x="0" y="${y + 12}">${LIMB_LABEL[limb]}</text>
      <rect class="track" x="${LABEL_W}" y="${y}" width="${BAR_W}" height="${ROW - 6}" rx="3"/>
      ${bars.map(([a, b]) => `<rect class="stance" data-l="${limb}" x="${LABEL_W + a * BAR_W}" y="${y}" width="${(b - a) * BAR_W}" height="${ROW - 6}" rx="3"/>`).join('')}`;
  }).join('') + `<line class="cursor" x1="${LABEL_W}" x2="${LABEL_W}" y1="0" y2="${LIMBS.length * ROW}"/>`;
})();
function updateGait(p) {
  const svg = $('#gait');
  const x = LABEL_W + p * BAR_W;
  const c = svg.querySelector('.cursor');
  c.setAttribute('x1', x); c.setAttribute('x2', x);
  for (const el of svg.querySelectorAll('[data-l]')) el.classList.toggle('on', onGround(p, el.dataset.l));
}

// ------------------------------------------------------------------ right panel: picked muscle + activity
const GROUP_TITLE = { fore: 'Front legs', hind: 'Back legs', trunk: 'Back, belly & neck' };
(function renderEmg() {
  let html = '', last = null;
  for (const m of BEAR_MUSCLES) {
    if (m.limb !== last) { html += `<div class="emg-group">${GROUP_TITLE[m.limb]}</div>`; last = m.limb; }
    html += `<div class="emg-row" data-m="${m.id}" title="${esc(m.run)}">
      <div class="emg-name">${esc(m.name.replace(/ \(.*\)$/, ''))}</div>
      <div class="emg-bar"><i class="thr"></i><i class="fill"></i></div>
      <span class="emg-mode"></span></div>`;
  }
  $('#emg').innerHTML = html;
  $('#emg').querySelectorAll('.emg-row').forEach((row) => {
    row.querySelector('.thr').style.left = `${ui.threshold * 100}%`;
    row.onmouseenter = () => (hoverMuscle = row.dataset.m);
    row.onmouseleave = () => (hoverMuscle = null);
    row.onclick = () => pick(instByKey[`${row.dataset.m}_L`]);
  });
})();

let hovered = null, hoverMuscle = null, picked = null;
function pick(inst) {
  picked = inst;
  const box = $('#picked');
  lastCaption = null;
  if (!inst) { box.innerHTML = ''; player.inst = null; return; }
  const d = inst.def;
  box.innerHTML = `<button class="x" title="Close">×</button>
    <h4>${esc(d.name)} <small style="color:var(--muted);font-weight:400">${SIDE_LABEL[inst.S]}</small></h4>
    <p><b>When it contracts:</b> ${esc(d.act.name.toLowerCase())}.</p>
    <p><b>In the run:</b> ${esc(d.run)}</p>${d.note ? `<p class="note">${esc(d.note)}</p>` : ''}`;
  box.querySelector('.x').onclick = () => pick(null);
  if (state.mode === 'stand') {
    player.inst = inst;
    player.t = 0;
    analyze(inst);
    poseStand(inst, 0);
    for (const s of inst.strands) s.computeWorld();
    focusOn(inst);
    state.playing = true;
    updatePlayButton();
  }
}

// ------------------------------------------------------------------ muscle colouring
const shown = {}, lit = {}, rate = {}, prevLen = {};
function setHighlight(i, m) {
  const hl = i === hovered || i === picked || i.def.id === hoverMuscle;
  if (hl) { m.emissive.r += 0.2; m.emissive.g += 0.2; m.emissive.b += 0.15; }
  return hl;
}
/** Gallop: glow by activation (smoothed, with hysteresis so nothing blinks). */
function colourRun(A, dt) {
  const k = 1 - Math.exp(-dt / 0.08);
  for (const i of insts) {
    const key = i.key;
    shown[key] = shown[key] === undefined ? A[key] : shown[key] + (A[key] - shown[key]) * k;
    const a = shown[key];
    if (lit[key]) { if (a < ui.threshold - 0.04) lit[key] = false; } else if (a > ui.threshold + 0.04) lit[key] = true;
    const m = i.material;
    if (lit[key]) {
      const kk = 0.25 + 0.75 * clamp01((a - ui.threshold) / (1 - ui.threshold));
      m.color.setRGB(1.15 + 0.35 * kk, 1, 1);
      m.emissive.setRGB(0.95 * kk, 0.2 * kk, 0.04 * kk);
    } else {
      m.color.setRGB(0.42, 0.42, 0.45);
      m.emissive.setRGB(0, 0, 0);
    }
    const hl = setHighlight(i, m);
    body.setOpacity(i, ui.fade && !lit[key] && !hl ? 0.13 : 1);
  }
}
/** One muscle: it glows as it contracts; helpers tint green, stretched muscles blue; the rest step back. */
function colourStand(ph) {
  const sel = player.inst;
  for (const i of insts) {
    const m = i.material;
    shown[i.key] = i === sel ? ph.act : 0;
    lit[i.key] = i === sel && ph.act > 0.05;
    m.color.setRGB(1, 1, 1);
    m.emissive.setRGB(0, 0, 0);
    let opacity = 1;
    if (!sel) {
      m.color.setRGB(0.85, 0.85, 0.88);
    } else if (i === sel) {
      const a = 0.2 + 0.8 * ph.act;
      m.color.setRGB(1.15 + 0.35 * ph.act, 1, 1);
      m.emissive.setRGB(0.95 * a, 0.2 * a, 0.04 * a);
    } else if (player.syn.has(i)) {
      const a = ph.poseT * player.syn.get(i);
      m.color.setRGB(0.42 + 0.3 * a, 0.42 + 1.4 * a, 0.45 + 0.4 * a);
      m.emissive.setRGB(0.05 * a, 0.3 * a, 0.08 * a);
      opacity = ui.fade ? 0.13 + 0.87 * Math.min(1, a * 1.6) : 1;
    } else if (player.ant.has(i)) {
      const a = ph.poseT * player.ant.get(i);
      m.color.setRGB(0.42 - 0.1 * a, 0.42 + 0.6 * a, 0.45 + 2.2 * a);
      m.emissive.setRGB(0.02 * a, 0.12 * a, 0.5 * a);
      opacity = ui.fade ? 0.13 + 0.87 * Math.min(1, a * 1.6) : 1;
    } else {
      m.color.setRGB(0.42, 0.42, 0.45);
      opacity = ui.fade ? 0.13 : 1;
    }
    if (setHighlight(i, m)) opacity = Math.max(opacity, 0.85);
    body.setOpacity(i, opacity);
  }
}
/** Shortening / lengthening from how each muscle's length changes over time. */
function updateRates(dp) {
  for (const i of insts) {
    let L = 0;
    for (const s of i.strands) L += s.len;
    if (dp > 1e-5 && prevLen[i.key] !== undefined) {
      const r = (L - prevLen[i.key]) / L / dp;
      rate[i.key] = rate[i.key] === undefined ? r : rate[i.key] + (r - rate[i.key]) * 0.25;
    } else if (dp <= 1e-5) rate[i.key] = 0;
    prevLen[i.key] = L;
  }
}
const MODE_TEXT = { con: 'shortening', ecc: 'lengthening', iso: 'holding', off: 'quiet' };
const MODE_COLOR = { con: 'var(--con)', ecc: 'var(--ecc)', iso: 'var(--iso)', off: '#3a4350' };
function modeOf(key) {
  const a = shown[key] ?? 0, r = rate[key] ?? 0;
  if (state.mode === 'stand') return r < -0.12 ? 'con' : r > 0.12 ? 'ecc' : a > 0.07 ? 'iso' : 'off';
  if (a < 0.07) return 'off';
  return r < -0.12 ? 'con' : r > 0.12 ? 'ecc' : 'iso';
}
function updateEmg() {
  const side = state.mode === 'stand' && player.inst ? player.inst.S : 'L';
  for (const row of $('#emg').querySelectorAll('.emg-row')) {
    const key = `${row.dataset.m}_${side}`, a = shown[key] ?? 0, mode = modeOf(key);
    const fill = row.querySelector('.fill'), m = row.querySelector('.emg-mode');
    fill.style.width = `${(a * 100).toFixed(1)}%`;
    fill.style.background = MODE_COLOR[mode];
    m.textContent = MODE_TEXT[mode];
    m.className = `emg-mode ${mode}`;
    row.classList.toggle('hl', hoverMuscle === row.dataset.m || (picked && picked.def.id === row.dataset.m));
    row.classList.toggle('lit', !!lit[key]);
  }
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
  const r = viewport.getBoundingClientRect();
  tooltip.style.display = 'block';
  tooltip.style.left = `${e.clientX - r.left + 14}px`;
  tooltip.style.top = `${e.clientY - r.top + 12}px`;
  tooltip.innerHTML = state.mode === 'run'
    ? `${esc(hovered.def.name)} <span>${Math.round((shown[hovered.key] ?? 0) * 100)}%</span>`
    : `${esc(hovered.def.name)} <span>${esc(hovered.def.act.name.toLowerCase())}</span>`;
}

const playBtn = $('#play'), scrubEl = $('#scrub');
function updatePlayButton() { playBtn.textContent = state.playing ? '❚❚' : '▶'; }
function togglePlay() { state.playing = !state.playing; updatePlayButton(); }
playBtn.onclick = togglePlay;
scrubEl.addEventListener('input', () => {
  state.playing = false;
  if (state.mode === 'run') state.t = Math.floor(state.t) + scrubEl.value / 1000;
  else player.t = (scrubEl.value / 1000) * PTOTAL;
  updatePlayButton();
});
$('#speed').addEventListener('change', (e) => (state.speed = +e.target.value));
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
for (const [id, key] of [['tSkel', 'skel'], ['tFade', 'fade']]) {
  const el = $(`#${id}`);
  el.checked = ui[key];
  el.addEventListener('change', () => (ui[key] = el.checked));
}
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Escape') pick(null);
});

// ------------------------------------------------------------------ loop
const clock = new THREE.Clock();
let lastPhase = -1, lastT = 0, lastCaption = null, frame = 0;
function setCaption(html) {
  if (html === lastCaption) return;
  lastCaption = html;
  $('#phase').innerHTML = html;
  $('#phase').style.visibility = html ? 'visible' : 'hidden';
}
function tickRun(dt) {
  if (state.playing) state.t += (dt * state.speed) / GAIT.STRIDE_SEC;
  const p = ((state.t % 1) + 1) % 1;
  scrubEl.value = Math.round(p * 1000);
  const { W, root } = gaitPose(skel, p);
  skel.apply(W, root);
  body.update();
  updateRates(state.t - lastT);
  lastT = state.t;
  processHover();
  colourRun(activations(p), dt);
  updateGround();
  updateGait(p);
  const ph = phaseAt(p);
  if (ph !== lastPhase || lastCaption === null) {
    lastPhase = ph;
    setCaption(`<i>${ph + 1}</i><b>${esc(PHASES[ph].title)}</b>`);
    $('#steps').querySelectorAll('li').forEach((li) => li.classList.toggle('on', +li.dataset.n === ph));
  }
}
function tickStand(dt) {
  // At the default 0.2× a contraction takes about 1.4 s; other speeds scale from there.
  const dts = state.playing && player.inst ? (dt * state.speed) / 0.2 : 0;
  player.t = (player.t + dts) % PTOTAL;
  scrubEl.value = Math.round((player.t / PTOTAL) * 1000);
  const ph = player.inst ? playerPhase(player.t) : { act: 0, poseT: 0, step: '' };
  poseStand(player.inst, ph.poseT);
  body.update();
  updateRates(dts * (0.2 / GAIT.STRIDE_SEC));
  processHover();
  colourStand(ph);
  updatePullArrows(player.inst, ph.act);
  updateGround();
  const inst = player.inst;
  if (!inst) {
    setCaption('<b>Click any muscle</b>');
  } else {
    const L = inst.strands.reduce((a, s) => a + s.len, 0) / inst.strands.length;
    const pct = Math.round((L / player.L0) * 100);
    setCaption(`<b>${esc(inst.def.name.replace(/ \(.*\)$/, ''))}: ${esc(inst.def.act.name.toLowerCase())}</b>
      <span>${esc(ph.step)} · length <em class="len">${pct}%</em></span>`);
  }
}
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state.mode === 'run') tickRun(dt); else tickStand(dt);
  for (const m of boneMeshes) m.visible = ui.skel;
  if (frame++ % 3 === 0) updateEmg();
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();
  requestAnimationFrame(tick);
}
pick(null);
tick();

// Debug / test hook.
window.__bear = { state, player, skel, body, camera, controls, gaitPose, standPose, limbPhase, MUSCLE_BY_ID, setMode, pick, instByKey };
