// Squat model: a timed rep, whole-body joint angles for each moment, simulated muscle activation
// (a teaching approximation of typical EMG patterns), and three common faults told as slow "stories".
import { ease, clamp01 } from './viewer.js';

const bump = (x) => Math.sin(Math.PI * clamp01(x));
const lerp = (a, b, k) => a + (b - a) * k;

// ------------------------------------------------------------------ proper rep
export const PHASES = [
  { id: 'ready', dur: 0.6, label: 'Ready', sub: '' },
  { id: 'brace', dur: 0.9, label: 'Brace', sub: 'core tightens' },
  { id: 'descent', dur: 2.6, label: 'Going down', sub: 'thighs + glutes brake' },
  { id: 'bottom', dur: 0.8, label: 'Bottom', sub: 'brake turns into push' },
  { id: 'ascent', dur: 2.4, label: 'Standing up', sub: 'thighs + glutes push' },
  { id: 'lockout', dur: 0.8, label: 'Lockout', sub: 'glutes finish' },
  { id: 'rest', dur: 0.7, label: 'Relax', sub: '' },
];
export const CYCLE = PHASES.reduce((a, p) => a + p.dur, 0);

/** Where in the rep we are at time t. s = depth (0 standing … 1 bottom), u = progress of the ascent. */
export function timeline(t) {
  let x = ((t % CYCLE) + CYCLE) % CYCLE;
  for (let i = 0; i < PHASES.length; i++) {
    const p = PHASES[i];
    if (x < p.dur || i === PHASES.length - 1) return state(p, clamp01(x / p.dur));
    x -= p.dur;
  }
}
function state(p, k) {
  let s = 0, u = null, brace = 1, arms = 1;
  switch (p.id) {
    case 'ready': brace = 0; arms = 0; break;
    case 'brace': brace = ease(k); arms = ease(k); break;
    case 'descent': s = ease(k); break;
    case 'bottom': s = 1; break;
    case 'ascent': u = k; s = 1 - ease(k); break;
    case 'lockout': break;
    case 'rest': brace = 1 - ease(k); arms = 1 - ease(k); break;
  }
  return { phase: p.id, phaseInfo: p, k, s, u, brace, arms };
}

export const STEPS = [
  { phase: 'brace', title: 'Brace', text: 'core tightens first' },
  { phase: 'descent', title: 'Go down', text: 'thighs + glutes brake' },
  { phase: 'bottom', title: 'Bottom', text: 'brake turns into push' },
  { phase: 'ascent', title: 'Stand up', text: 'thighs + glutes push' },
  { phase: 'lockout', title: 'Lockout', text: 'glutes finish' },
];
export function stepIndex(st) {
  return STEPS.findIndex((s) => s.phase === st.phase);
}

// ------------------------------------------------------------------ muscle groups
export const GROUPS = [
  { id: 'quads', name: 'Thighs (quads)', muscles: ['vastusLateralis', 'vastusMedialis', 'vastusIntermedius'], role: 'Brake the knees bending on the way down and straighten them on the way up.' },
  { id: 'gmax', name: 'Glutes', muscles: ['gluteusMax'], role: 'Control the hips folding back, then push the hips forward to stand.' },
  { id: 'addMag', name: 'Adductor magnus', muscles: ['adductorMagnus'], role: 'Inner-thigh muscle that helps the glutes out of the bottom.' },
  { id: 'hams', name: 'Hamstrings', muscles: ['bicepsFemoris', 'semitendinosus', 'semimembranosus'], role: 'Help the glutes straighten the hips.' },
  { id: 'gmed', name: 'Side glutes', muscles: ['gluteusMed', 'gluteusMin'], role: 'Hold the knees out over the toes.' },
  { id: 'erector', name: 'Lower back', muscles: ['erectorSpinae', 'quadratusLumborum'], role: 'Hold the spine in shape while you lean forward.' },
  { id: 'core', name: 'Abs (brace)', muscles: ['transversus', 'intOblique', 'extOblique', 'rectusAbd'], role: 'Stiffen the trunk like a belt.' },
  { id: 'calves', name: 'Calves', muscles: ['soleus', 'gastrocnemius'], role: 'Keep your balance over the feet.' },
  { id: 'tibAnt', name: 'Shins', muscles: ['tibialisAnterior', 'edl'], role: 'Pull the shins forward on the way down.' },
  { id: 'rf', name: 'Rectus femoris', muscles: ['rectusFemoris'], role: 'The quad that also crosses the hip. Moderately active.' },
  { id: 'addTfl', name: 'Inner thighs', muscles: ['adductorLongus', 'gracilis', 'tfl'], role: 'Pull the knees inward. Take over when the knees cave in.' },
  { id: 'iliopsoas', name: 'Hip flexors', muscles: ['iliopsoas'], role: 'Mostly quiet in a squat.' },
  { id: 'arms', name: 'Front shoulders', muscles: ['deltAnt', 'coracobrachialis'], role: 'Hold the arms out for balance.' },
];
export const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.id])));

// ------------------------------------------------------------------ faults
// list: the three things to see, in order. matters / fix: short notes behind a toggle.
export const VARIANTS = [
  { id: 'proper', name: 'Proper form', view: 'three' },
  {
    id: 'hips', name: 'Hips shoot up', view: 'sideR',
    list: ['Thighs tire and escape: legs straighten fast', 'Bent over, legs almost straight', 'Back rounds: discs + ligaments take the load'],
    matters: ['Muscles heal in days and get stronger', 'Discs and ligaments heal in months'],
    fix: ['Chest and hips rise together', 'Lighter weight, slower reps', 'Build the thighs: front / goblet squats'],
  },
  {
    id: 'valgus', name: 'Knees cave in', view: 'knees',
    list: ['Side glutes tire and let go', 'Knees fall inward', 'Inner knee ligament strained'],
    matters: ['The knee is a hinge: weak against twisting', 'Strains the MCL, ACL and kneecap'],
    fix: ['Push the knees out over the little toes', 'Band around the knees as a reminder', 'Strengthen the side glutes'],
  },
  {
    id: 'wink', name: 'Butt wink', view: 'hips',
    list: ['Too low: the thigh jams into the hip', 'Pelvis rolls under to go lower', 'Lower back rounds: discs pinched'],
    matters: ['Light weight: usually harmless', 'Heavy weight: discs take the strain'],
    fix: ['Only go as deep as your back stays flat', 'Slightly wider stance, toes out', 'Re-brace at the bottom'],
  },
];

// ------------------------------------------------------------------ fault stories
// Each beat: dur (s), n (which of the 3 list items it shows, 0 = none), caption (few words),
// at(k, ctx) → { st, round?, valgus?, hold?, flash?, act?, label? } for k = 0..1 through the beat.
// label: { at: 'thigh'|'back'|'hip'|'knee'|'pelvis', text, bar?: { value 0..1, color } }: one at a time.
const mk = (phase, s, u = null) => ({ phase, phaseInfo: PHASES.find((p) => p.id === phase), k: 0, s, u, brace: 1, arms: 1 });
const RED = '#ff5b5b';

// One continuous rep per fault. The way up is a single slow grind that follows one smooth speed curve
// (no pauses, no sudden bursts); segments only change the caption, the straining (flashing) muscles and
// what the body does at that point. flash: groups that pulse red because they are straining.
const sm = (k) => k * k * (3 - 2 * k);
/** Smooth, monotone u(τ) through keyframes [[τ, u], …] (cubic Hermite with averaged slopes). */
function curve(keys) {
  const m = keys.map((_, i) => {
    const a = keys[Math.max(0, i - 1)], b = keys[Math.min(keys.length - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  });
  m[0] = 0; // start from a standstill at the bottom
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, u0] = keys[i], [t1, u1] = keys[i + 1];
      if (t <= t1) {
        const h = t1 - t0, s = (t - t0) / h, s2 = s * s, s3 = s2 * s;
        return (2 * s3 - 3 * s2 + 1) * u0 + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * u1 + (s3 - s2) * h * m[i + 1];
      }
    }
    return keys[keys.length - 1][1];
  };
}
/** Split one continuous ascent (driven by τ) into captioned segments. */
function ascentSegments(segs, fn) {
  let t0 = 0;
  return segs.map(([dur, n, caption]) => {
    const start = t0;
    t0 += dur;
    return { dur, n, caption, at: (k, c) => fn(start + k * dur, c) };
  });
}

// Hips shoot up: legs straighten early (built into the 'hips' kinematics), the back holds, starts losing
// and rounds while you are bent over, then straightens again as the chest finally comes up.
// Hips stay low (bent over) through the hold and the rounding; the chest only comes up at the end.
const HIPS_U = curve([[0, 0], [2.2, 0.1], [3.8, 0.36], [5.6, 0.42], [7.0, 0.47], [9.2, 1]]);
const hipsAscent = (τ) => {
  const u = HIPS_U(τ);
  const round = sm(clamp01((τ - 3.0) / 3.8)) * (1 - sm(clamp01((τ - 7.0) / 2.0)));
  const thighs = 1 - sm(clamp01((τ - 2.2) / 1.6)); // thighs strain, then escape
  // Back muscles strain while holding you bent over, then hand the load over as the back rounds.
  const back = sm(clamp01((τ - 2.6) / 1.4)) * (1 - sm(clamp01((τ - 5.0) / 0.8)));
  return {
    st: mk('ascent', 1 - u, u), round, flash: { quads: thighs, erector: back },
    act: { quads: lerp(0.2, 1, thighs), erector: Math.max(0.3, 0.95 * back + 0.45 * round * (1 - back)), hams: 0.65, gmax: 0.65 },
  };
};

const VALGUS_U = curve([[0, 0], [2.2, 0.07], [3.8, 0.28], [6.0, 0.45], [7.8, 1]]);
const valgusAscent = (τ) => {
  const u = VALGUS_U(τ);
  // The side glutes strain, then let go (their rope goes slack) just before the knees fall in;
  // the rope pulls tight again as the knees come back out near the top.
  const letGo = sm(clamp01((τ - 1.4) / 1.8));
  const glutes = 1 - 0.75 * letGo;
  const v = (3 + 12 * sm(clamp01((τ - 1.6) / 2.4))) * (1 - sm(clamp01((τ - 6.0) / 1.8)));
  return { st: mk('ascent', 1 - u, u), valgus: v, hold: 1 - letGo * (1 - sm(clamp01((τ - 6.0) / 1.6))),
    flash: { gmed: 1 - letGo }, act: { gmed: lerp(0.15, 0.5, glutes), addTfl: 0.25 } };
};

const WINK_U = curve([[0, 0], [1.4, 0.15], [3.6, 1]]);

export const STORIES = {
  hips: [
    { dur: 2.4, n: 0, caption: 'Going down', at: (k) => ({ st: mk('descent', ease(k)) }) },
    ...ascentSegments([
      [2.2, 1, 'Thighs struggle to push up'],
      [1.6, 1, 'Legs straighten first'],
      [1.8, 2, 'Bent over: the back takes the weight'],
      [1.4, 3, 'Back rounds'],
      [2.2, 3, 'Back straightens as you stand'],
    ], hipsAscent),
    { dur: 0.9, n: 0, caption: '', at: (k) => ({ st: { ...mk('rest', 0), brace: 1 - k, arms: 1 - k } }) },
  ],
  valgus: [
    { dur: 2.4, n: 0, caption: 'Side glutes hold the knees out', at: (k) => ({ st: mk('descent', ease(k)), valgus: 3 * ease(k), hold: 1 }) },
    ...ascentSegments([
      [2.2, 1, 'Side glutes tire and let go'],
      [1.6, 2, 'Knees fall inward'],
      [2.2, 3, 'Inner knee ligament strained'],
      [1.8, 0, 'Stands up'],
    ], valgusAscent),
    { dur: 0.9, n: 0, caption: '', at: (k) => ({ st: { ...mk('rest', 0), brace: 1 - k, arms: 1 - k } }) },
  ],
  // ctx.sLim (the depth where this hip runs out of room) is filled in by the page.
  wink: [
    { dur: 2.0, n: 0, caption: 'Going down', at: (k, c) => ({ st: mk('descent', (c.sLim - 0.04) * ease(k)) }) },
    { dur: 1.6, n: 1, caption: 'Too low: the thigh jams into the hip', at: (k, c) => ({ st: mk('descent', lerp(c.sLim - 0.04, c.sLim + 0.01, k)) }) },
    { dur: 2.0, n: 2, caption: 'Pelvis rolls under to go lower', at: (k, c) => ({ st: mk('descent', lerp(c.sLim + 0.01, 0.97, sm(k))) }) },
    { dur: 1.6, n: 3, caption: 'Lower back rounds: discs pinched', at: (k) => ({ st: mk('descent', lerp(0.97, 1, k)), act: { erector: 0.3 } }) },
    { dur: 3.6, n: 0, caption: 'Stands up', at: (k) => { const u = WINK_U(k * 3.6); return { st: mk('ascent', 1 - u, u) }; } },
    { dur: 0.9, n: 0, caption: '', at: (k) => ({ st: { ...mk('rest', 0), brace: 1 - k, arms: 1 - k } }) },
  ],
};
export const storyLength = (vid) => STORIES[vid].reduce((a, b) => a + b.dur, 0);
/** The beat at time t of a fault's story, and what it sets. */
export function storyAt(vid, t, ctx) {
  const beats = STORIES[vid];
  const T = storyLength(vid);
  let x = ((t % T) + T) % T;
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (x < b.dur || i === beats.length - 1) {
      const k = clamp01(x / b.dur);
      const f = b.at(k, ctx);
      f.st.k = k;
      return { ...f, beat: b, index: i, k };
    }
    x -= b.dur;
  }
}

// ------------------------------------------------------------------ kinematics
/** Hip-flexion range of the lifter in the butt-wink example (degrees). Proper-form lifter is not limited. */
export const WINK_HIP_LIMIT = 125;
/** If the hip would have to bend past its limit, the pelvis tucks under (posterior tilt) by the excess. */
export function applyHipLimit(vid, kin) {
  kin.wink = vid === 'wink' ? Math.max(0, kin.thigh + kin.torso - kin.lumbar - WINK_HIP_LIMIT) : 0;
  return kin;
}
/**
 * World-frame angles for a variant at a moment of the rep (degrees):
 * thigh: forward rotation of the thigh from vertical; shin: forward lean of the shin;
 * torso: forward lean of the torso (the page re-solves it for balance); wink: posterior pelvic tilt with lumbar flexion;
 * lumbar: extra lumbar flexion; valgus: knee collapse inward.
 */
export function kinematics(vid, st) {
  const { s, u } = st;
  const depth = vid === 'wink' ? 112 : 105;
  let thigh = depth * s, shin = 32 * s, torso = 42 * s, wink = 0, lumbar = 0, valgus = 0;
  if (vid === 'hips' && u !== null) {
    thigh = depth * (1 - ease(clamp01(u * 1.55)));
    shin = 32 * (1 - ease(clamp01(u * 2.3)));
    // (torso lean is then solved for balance on the page, which tips the chest forward)
    lumbar = 6 * bump(u / 0.75);
  }
  // wink is not scripted: the page applies applyHipLimit() once the torso lean is known.
  if (vid === 'valgus') {
    if (st.phase === 'descent' || st.phase === 'bottom') valgus = 5 * s;
    else if (u !== null) valgus = 5 * (1 - u) + 7 * bump(u / 0.85);
  }
  return { thigh, shin, torso, wink, lumbar, valgus, arms: st.arms };
}

/** Joint-angle spec for the skeleton: [central entries], [entries applied to both sides]. */
export function poseSpec(kin) {
  const { thigh, shin, torso, wink, lumbar, valgus, arms } = kin;
  const tilt = torso - wink - lumbar; // pelvis + trunk together give the torso lean
  const spread = 6 * clamp01(thigh / 105); // knees track slightly out over the toes
  const f = arms * (90 + torso);
  return {
    central: [['pelvis', 'tilt', tilt], ['trunk', 'flex', wink + lumbar], ['neck', 'flex', -0.55 * torso]],
    sided: [
      ['hip', 'flex', thigh + tilt], ['hip', 'abd', spread - valgus],
      ['knee', 'flex', thigh + shin], ['knee', 'valgus', valgus - spread],
      ['ankle', 'dorsi', shin],
      ['shoulder', 'flex', f], ['scapula', 'upRot', 0.12 * f], ['elbow', 'flex', 6 * arms],
    ],
  };
}

// ------------------------------------------------------------------ activation (0..1 per group)
function properActivation(st) {
  const { phase, s, u, brace: b, k } = st;
  const desc = phase === 'descent', bot = phase === 'bottom', asc = phase === 'ascent', lock = phase === 'lockout';
  const work = desc || bot || asc;
  return {
    core: 0.04 + 0.22 * b + 0.05 * s * b,
    erector: 0.04 + b * (0.14 + 0.16 * s),
    gmax: desc ? 0.08 + 0.55 * s ** 1.5 : bot ? 0.72 : asc ? 0.25 + 0.6 * (1 - u) ** 1.2 : lock ? 0.5 * (1 - 0.5 * k) : 0.03,
    addMag: desc ? 0.08 + 0.5 * s * s : bot ? 0.62 : asc ? 0.15 + 0.7 * (1 - u) ** 1.5 : 0.03,
    quads: desc ? 0.2 + 0.62 * s : bot ? 0.9 : asc ? 0.25 + 0.68 * (1 - u) ** 0.8 : lock ? 0.2 : 0.04,
    rf: 0,
    hams: work ? 0.08 + 0.17 * s : lock ? 0.15 : 0.03,
    gmed: work ? 0.12 + 0.18 * s : lock ? 0.18 : 0.03 + 0.04 * b,
    calves: work ? 0.1 + 0.18 * s : 0.04 + 0.06 * b,
    tibAnt: desc ? 0.12 + 0.2 * s : bot ? 0.28 : asc ? 0.2 * (1 - u) : 0.04,
    addTfl: work ? 0.06 + 0.14 * s : 0.03,
    iliopsoas: desc ? 0.04 + 0.18 * s ** 3 : bot ? 0.18 : 0.03,
    arms: 0.04 + 0.24 * st.arms,
  };
}
export function activation(vid, st, kin) {
  const A = properActivation(st);
  A.rf = A.quads * 0.4;
  if (vid === 'hips' && st.u !== null) {
    const g = bump(st.u / 0.8);
    A.quads *= 1 - 0.55 * g;
    A.rf *= 1 - 0.5 * g;
    A.erector += 0.6 * g;
    A.hams += 0.6 * g;
    A.gmax += 0.08 * g;
  }
  if (vid === 'valgus') {
    const g = Math.min(1, kin.valgus / 10);
    A.gmed *= 1 - 0.65 * g;
    A.gmax *= 1 - 0.25 * g;
    A.addTfl += 0.55 * g;
    A.addMag += 0.15 * g;
  }
  if (vid === 'wink') {
    const g = kin.wink / 20;
    A.erector -= 0.15 * g;
    A.core -= 0.15 * g;
    A.hams += 0.2 * g;
  }
  for (const key in A) A[key] = Math.max(0, Math.min(1, A[key]));
  return A;
}
