// Squat Lab page: plays a full squat rep on the muscle model, shows the activation sequence and
// lets you compare proper form against common faults.
import * as THREE from 'three';
import { SIDES, SIDE_LABEL } from './skeleton.js';
import { createStage, createBody, createPicker, esc } from './viewer.js';
import { PHASES, CYCLE, timeline, STEPS, stepIndex, GROUPS, GROUP_OF, VARIANTS, kinematics, poseSpec, activation, applyHipLimit, WINK_HIP_LIMIT } from './squatModel.js';
import { createSquatViz, centerOfMass as comOf, jointLoads, bonePos, boneLocal } from './squatViz.js';

const V3 = THREE.Vector3;
const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------------ scene
const VIEWS = {
  three: [[-2.8, 1.2, 3.35], [0, 0.68, 0.02]],
  front: [[0, 0.9, 4.4], [0, 0.68, 0]],
  side: [[-4.4, 0.9, 0.15], [0, 0.68, 0.03]],
  back: [[0, 0.9, -4.4], [0, 0.68, 0]],
  knees: [[-0.15, 0.55, 1.8], [0, 0.33, 0.03]],
  hips: [[-2.3, 0.62, 0.45], [0, 0.45, -0.04]],
};
const viewport = $('#viewport');
const { renderer, scene, camera, controls, flyTo, updateFly } = createStage(viewport, { cameraPos: VIEWS.three[0], target: VIEWS.three[1] });
const body = createBody(scene);
const { skel, insts, instByKey, boneMeshes } = body;
const ui = { skel: true, fade: true, align: true, balance: true, loads: true, ghost: true, threshold: 0.35 };
const pickAt = createPicker({ renderer, camera, body, bonesVisible: () => ui.skel });
const groupById = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

const state = { variant: 'proper', t: 0, playing: true, speed: 1 };
const variant = () => VARIANTS.find((v) => v.id === state.variant);
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

// ------------------------------------------------------------------ overlays: alignment lines, balance
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
const jointDots = SIDES.flatMap(() => [dot(0.008, COL_OK), dot(0.008, COL_OK), dot(0.008, COL_OK)]);
const torsoLine = makeLine(2, COL_OK);
const comDot = dot(0.014, 0xffd23f);
const plumb = makeLine(2, 0xffd23f, true);
const floorDot = dot(0.01, 0xffd23f);
const footLines = { R: makeLine(2, COL_GOOD), L: makeLine(2, COL_GOOD) };

const pivot = (b, t) => bonePos(skel, b, t);
const local = (b, x, y, z) => boneLocal(skel, b, x, y, z);
const centerOfMass = () => comOf(skel);

// Balance: a real lifter leans the torso just enough to keep the centre of mass over the feet.
// Solve for that lean (bisection) instead of scripting it, so faults change the lean physically.
skel.apply({});
skel.plantFeet();
const BALANCE_Z = centerOfMass().z;
function solvedKinematics(vid, st) {
  const kin = kinematics(vid, st);
  let lo = 0, hi = 80;
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

// Peak joint loads during a proper rep: the scale for the load gauges.
const PEAKS = { knee: 1, hip: 1, back: 1 };
for (let t = 0; t < CYCLE; t += 0.1) {
  const kin = solvedKinematics('proper', timeline(t));
  skel.apply(poseValues(kin));
  skel.plantFeet();
  const L = jointLoads(skel);
  for (const k in PEAKS) PEAKS[k] = Math.max(PEAKS[k], L[k].torque);
}

const labels = {};
function label(key, cls) {
  if (!labels[key]) {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    $('#labels').appendChild(el);
    labels[key] = { el, pos: new V3(), on: false };
  }
  return labels[key];
}
function showLabel(key, pos, text, cls) {
  const l = label(key, cls);
  l.el.className = `lbl ${cls}`;
  l.pos.copy(pos);
  l.on = true;
  if (l.el.textContent !== text) l.el.textContent = text;
}

const viz = createSquatViz(scene, { camera, showLabel });

function updateOverlays(kin, kinP) {
  for (const k in labels) labels[k].on = false;
  const warnValgus = kin.valgus > 6, warnLumbar = kin.wink + kin.lumbar > 8, warnTorso = state.variant === 'hips' && kin.torso > kinP.torso + 10;
  overlay.children.forEach((c) => (c.visible = false));

  if (ui.align) {
    let i = 0;
    for (const S of SIDES) {
      const pts = [pivot(`femur_${S}`), pivot(`tibia_${S}`), pivot(`foot_${S}`)];
      setPts(legLines[S], pts);
      legLines[S].material.color.setHex(warnValgus ? COL_WARN : COL_OK);
      legLines[S].visible = true;
      for (const p of pts) { const d = jointDots[i++]; d.position.copy(p); d.material.color.setHex(warnValgus ? COL_WARN : COL_OK); d.visible = true; }
    }
    const hipMid = pivot('femur_R').add(pivot('femur_L')).multiplyScalar(0.5);
    const neck = pivot('neck');
    setPts(torsoLine, [hipMid, neck]);
    torsoLine.material.color.setHex(warnTorso || warnLumbar ? COL_WARN : COL_OK);
    torsoLine.visible = true;
    if (state.variant !== 'valgus') showLabel('torso', neck, `torso lean ${kin.torso.toFixed(0)}°${warnTorso ? ' — too far' : ''}`, warnTorso ? 'lbl-warn' : 'lbl-ok');
    if (warnLumbar) showLabel('lumbar', pivot('lumbar'), 'lower back rounding', 'lbl-warn');
  }

  if (ui.balance) {
    const com = centerOfMass();
    let heel = Infinity, toe = -Infinity;
    for (const S of SIDES) {
      const s = S === 'R' ? -1 : 1;
      const h = local(`foot_${S}`, 0.1 * s, 0.003, -0.078), t = local(`toes_${S}`, 0.11 * s, 0.003, 0.172);
      setPts(footLines[S], [h, t]);
      footLines[S].visible = true;
      heel = Math.min(heel, h.z);
      toe = Math.max(toe, t.z);
    }
    const ok = com.z > heel + 0.04 && com.z < toe - 0.05;
    for (const S of SIDES) footLines[S].material.color.setHex(ok ? COL_GOOD : COL_WARN);
    comDot.position.copy(com);
    floorDot.position.set(com.x, 0.003, com.z);
    setPts(plumb, [com, floorDot.position]);
    comDot.visible = floorDot.visible = plumb.visible = true;
    if (state.variant !== 'valgus') showLabel('com', com, ok ? 'centre of mass' : 'balance off the feet', ok ? 'lbl-com' : 'lbl-warn');
  }
}
function updateLabels() {
  const r = renderer.domElement.getBoundingClientRect();
  const p = new V3();
  const placed = [];
  for (const k in labels) {
    const l = labels[k];
    if (!l.on) { l.el.style.display = 'none'; continue; }
    p.copy(l.pos).project(camera);
    if (p.z > 1) { l.el.style.display = 'none'; continue; }
    placed.push({ l, x: ((p.x + 1) / 2) * r.width, y: ((1 - p.y) / 2) * r.height });
  }
  placed.sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i++) for (let j = 0; j < i; j++) {
    if (Math.abs(placed[j].x - placed[i].x) < 170 && placed[i].y < placed[j].y + 19) placed[i].y = placed[j].y + 19;
  }
  for (const q of placed) { q.l.el.style.display = 'block'; q.l.el.style.transform = `translate(${q.x}px, ${q.y}px)`; }
}

// ------------------------------------------------------------------ muscle colouring
let hovered = null, hoverGroup = null, picked = null;
function updateMaterials(A, AP) {
  const fault = state.variant !== 'proper';
  for (const i of insts) {
    const g = GROUP_OF[i.def.id];
    const a = g ? A[g] : 0;
    const d = g && fault ? A[g] - AP[g] : 0;
    const m = i.material;
    // Only muscles working above the threshold light up; the glow is stretched over the range above it
    // so the hardest-working muscles stand out from everything else.
    const lit = a >= ui.threshold;
    const k = lit ? 0.25 + 0.75 * (a - ui.threshold) / Math.max(0.05, 1 - ui.threshold) : 0;
    if (lit) {
      m.color.setRGB(1.15 + 0.35 * k, 1, 1);
      m.emissive.setRGB(0.95 * k, 0.2 * k, 0.04 * k);
    } else {
      m.color.setRGB(0.42, 0.42, 0.45); // dim, unlit
      m.emissive.setRGB(0, 0, 0);
    }
    if (d > 0.1) {
      const k = Math.min(1, d * 2);
      m.emissive.r += 0.45 * k; m.emissive.g += 0.3 * k;
      m.color.setRGB(1, 1 + 1.3 * k, 1 + 0.1 * k);
    } else if (d < -0.1) {
      const k = Math.min(1, -d * 2);
      m.emissive.g += 0.12 * k; m.emissive.b += 0.45 * k;
      m.color.setRGB(1 - 0.4 * k, 1 + 1.0 * k, 1 + 3 * k);
    }
    const highlighted = i === hovered || i === picked || (hoverGroup && g === hoverGroup);
    if (highlighted) { m.emissive.r += 0.2; m.emissive.g += 0.2; m.emissive.b += 0.15; }
    const quiet = !lit && Math.abs(d) <= 0.1;
    body.setOpacity(i, ui.fade && quiet && !highlighted ? 0.13 : 1);
  }
  for (const m of boneMeshes) m.visible = ui.skel;
}

// ------------------------------------------------------------------ shortening / lengthening from the model
const groupLen = {}, groupRate = {};
let prevT = null; // kept so callers can reset; rates no longer depend on playback
/** Average muscle length of each group (right side) for the pose at time t. Leaves that pose applied. */
function groupLengthsAt(t) {
  skel.apply(poseValues(solvedKinematics(state.variant, timeline(t))));
  skel.plantFeet();
  const out = {};
  for (const g of GROUPS) {
    let L = 0, n = 0;
    for (const id of g.muscles) for (const st of instByKey[`${id}_R`].strands) { L += st.measure(); n++; }
    out[g.id] = L / n;
  }
  return out;
}
/** Rate of length change (fraction per second) from the model at t ± h, so it works while paused too. */
function updateRates(t) {
  const h = 0.04;
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
function pills(ids, cls) { return ids.map((g) => `<span class="pill ${cls}" data-g="${g}">${esc(groupById[g].name)}</span>`).join(''); }
function renderFaultCard() {
  const v = variant();
  const box = $('#faultCard');
  if (v.id === 'proper') {
    box.innerHTML = `<div class="fcard intro"><p>A bodyweight squat with arms held forward. Most of the lower body works during a squat, so only muscles working <b>above the light-up level</b> (slider below the view) <b style="color:#ff7a59">glow</b>; the rest are dimmed. Brighter means harder. The bars on the right show every muscle's level and whether it is shortening, lengthening or holding.</p><p style="margin-top:6px">Pick a fault above to compare it with this. <b style="color:#ffd28a">Amber</b> muscles work harder than in proper form, and <b style="color:#b3d4ff">blue</b> ones work less.</p></div>`;
    return;
  }
  box.innerHTML = `<div class="fcard">
    <h2>${esc(v.title)}</h2>
    <h5>What happens</h5><p>${esc(v.what)}</p>
    <h5>Taking over</h5><div class="chips">${pills(v.over, 'over')}${v.passive ? '<span class="pill passive">spinal discs & ligaments</span>' : ''}</div>
    ${v.passive ? `<p style="margin-top:4px">${esc(v.passive)}</p>` : ''}
    <h5>Under-working</h5><div class="chips">${pills(v.under, 'under')}</div>
    <h5>Why it happens</h5><p>${esc(v.why)}</p>
    <h5>Why it matters</h5><p>${esc(v.risk)}</p>
    <h5>How to fix it</h5><ul>${v.fix.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
  </div>`;
  box.querySelectorAll('.pill[data-g]').forEach((p) => {
    p.onmouseenter = () => (hoverGroup = p.dataset.g);
    p.onmouseleave = () => (hoverGroup = null);
  });
}
function phaseStart(id) {
  let t = 0;
  for (const p of PHASES) { if (p.id === id) return t; t += p.dur; }
  return 0;
}
function renderSteps() {
  const v = variant();
  $('#steps').innerHTML = STEPS.map((s, k) => `<li data-k="${k}" class="${v.faultSteps?.includes(k) ? 'fault' : ''}"><b>${esc(s.title)}</b>${esc(s.text)}</li>`).join('');
  $('#steps').querySelectorAll('li').forEach((li) => (li.onclick = () => {
    const s = STEPS[+li.dataset.k];
    const p = PHASES.find((x) => x.id === s.phase);
    state.t = phaseStart(s.phase) + (s.from ?? 0) * p.dur + 0.02;
    prevT = null;
  }));
  lastStep = null;
}
function setVariant(id) {
  state.variant = id;
  state.t = 0;
  prevT = null;
  renderVariants();
  renderFaultCard();
  renderSteps();
  $('#tickLegend').style.display = id === 'proper' ? 'none' : '';
  $('#vizLegend').classList.toggle('fault', id !== 'proper');
  setView(variant().view);
}

// ------------------------------------------------------------------ right panel
function renderEmg() {
  $('#emg').innerHTML = GROUPS.map((g) => `
    <div class="emg-row" data-g="${g.id}" title="${esc(g.role)}">
      <div class="emg-name">${esc(g.name)}${g.sub ? `<small>${esc(g.sub)}</small>` : ''}</div>
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
function updateEmg(A, AP) {
  const fault = state.variant !== 'proper';
  for (const row of $('#emg').children) {
    const g = row.dataset.g;
    const a = A[g], mode = modeOf(g, a);
    const fill = row.querySelector('.fill'), tick = row.querySelector('.tick'), m = row.querySelector('.emg-mode');
    fill.style.width = `${(a * 100).toFixed(1)}%`;
    fill.style.background = MODE_COLOR[mode];
    tick.style.display = fault ? 'block' : 'none';
    tick.style.left = `calc(${(AP[g] * 100).toFixed(1)}% - 1px)`;
    m.textContent = MODE_TEXT[mode];
    m.className = `emg-mode ${mode}`;
    const d = fault ? a - AP[g] : 0;
    row.classList.toggle('over', d > 0.1);
    row.classList.toggle('under', d < -0.1);
    row.classList.toggle('hl', hoverGroup === g);
    row.classList.toggle('lit', a >= ui.threshold);
  }
}
function updateAngles(kin, kinP) {
  const tilt = kin.torso - kin.wink - kin.lumbar;
  const rows = [
    ['Knee bend', kin.thigh + kin.shin, false],
    ['Hip bend', kin.thigh + tilt, false],
    ['Ankle (shin forward)', kin.shin, false],
    ['Torso lean', kin.torso, state.variant === 'hips' && kin.torso > kinP.torso + 10],
    ['Lower-back rounding', kin.wink + kin.lumbar, kin.wink + kin.lumbar > 8],
    ['Knee cave-in', kin.valgus, kin.valgus > 6],
  ];
  $('#angles').innerHTML = rows.map(([n, v, w]) => `<div class="${w ? 'warn' : ''}"><b>${v.toFixed(0)}°</b>${n}</div>`).join('');
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
    <p>${g ? esc(g.role) : 'Not a main squat muscle. It stays nearly quiet during the rep.'}</p>
    <p id="pickedLive" style="color:var(--muted)"></p>
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
let lastA = {};
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
  tooltip.innerHTML = `${esc(hovered.def.name)} <span>${g ? `${Math.round(lastA[g] * 100)}% · ${MODE_TEXT[modeOf(g, lastA[g])]}` : 'quiet'}</span>`;
}

const playBtn = $('#play'), scrubEl = $('#scrub');
function updatePlayButton() { playBtn.textContent = state.playing ? '❚❚' : '▶'; }
function togglePlay() { state.playing = !state.playing; updatePlayButton(); }
playBtn.onclick = togglePlay;
scrubEl.addEventListener('input', () => { state.playing = false; state.t = (scrubEl.value / 1000) * CYCLE; updatePlayButton(); });
$('#speed').addEventListener('change', (e) => (state.speed = +e.target.value));
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setView(b.dataset.view)));
function setThreshold(v) {
  ui.threshold = v / 100;
  $('#tThrVal').textContent = `${v}%`;
  document.querySelectorAll('.emg-bar .thr').forEach((el) => (el.style.left = `${v}%`));
}
$('#tThr').addEventListener('input', (e) => setThreshold(+e.target.value));
for (const [id, key] of [['tSkel', 'skel'], ['tFade', 'fade'], ['tAlign', 'align'], ['tBalance', 'balance'], ['tLoads', 'loads'], ['tGhost', 'ghost']]) {
  const el = $(`#${id}`);
  el.checked = ui[key];
  el.addEventListener('change', () => (ui[key] = el.checked));
}
window.addEventListener('keydown', (e) => {
  if (e.key === ' ' && e.target.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Escape') pick(null);
});

// ------------------------------------------------------------------ loop
let lastStep = null, frame = 0;
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (state.playing) {
    state.t = (state.t + dt * state.speed) % CYCLE;
    scrubEl.value = Math.round((state.t / CYCLE) * 1000);
  }
  const st = timeline(state.t);
  // These probe other poses, so they all run before the real pose is applied.
  const kinP = solvedKinematics('proper', st);
  if (frame % 2 === 0) updateRates(state.t);
  const kin = solvedKinematics(state.variant, st);
  skel.apply(poseValues(kin));
  skel.plantFeet();
  body.update();
  const A = activation(state.variant, st, kin);
  const AP = activation('proper', st, kinP);
  lastA = A;

  processHover();
  updateMaterials(A, AP);
  updateOverlays(kin, kinP);
  viz.update({ skel, variant: state.variant, ghostValues: poseValues(kinP), kin, kinP, A, peaks: PEAKS, hipLimit: WINK_HIP_LIMIT, ui });
  updateFly(dt);
  controls.update();
  renderer.render(scene, camera);
  updateLabels();

  // panels
  const k = stepIndex(st);
  if (k !== lastStep) {
    lastStep = k;
    $('#steps').querySelectorAll('li').forEach((li) => li.classList.toggle('on', +li.dataset.k === k));
    const on = $('#steps li.on');
    if (on) on.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  if (frame++ % 3 === 0) {
    const v = variant();
    const warn =
      (v.id === 'hips' && kin.torso > kinP.torso + 10 && 'Hips rising faster than the chest: the back is taking over') ||
      (v.id === 'valgus' && kin.valgus > 6 && 'Knees caving in: the adductors take over from glute medius') ||
      (v.id === 'wink' && kin.wink > 6 && 'Pelvis tucking under: the lower back is rounding');
    $('#phase b').textContent = st.phaseInfo.label;
    $('#phase span').textContent = warn ? `⚠ ${warn}` : st.phaseInfo.sub;
    $('#phase span').style.color = warn ? 'var(--warn)' : '';
    updateEmg(A, AP);
    updateAngles(kin, kinP);
    $('#vizLegend').classList.toggle('hidden', !ui.loads);
    const live = $('#pickedLive');
    if (live && picked) {
      const g = GROUP_OF[picked.def.id];
      live.textContent = g ? `Now: ${Math.round(A[g] * 100)}% activation, ${MODE_TEXT[modeOf(g, A[g])]}` : '';
    }
  }
  requestAnimationFrame(tick);
}

renderEmg();
setThreshold(Math.round(ui.threshold * 100));
setVariant('proper');
updatePlayButton();
requestAnimationFrame(tick);

window.__squat = { state, skel, setVariant, camera, controls };
