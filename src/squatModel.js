// Squat model: a timed rep cycle, whole-body joint angles for each moment, simulated muscle
// activation (a teaching approximation of typical EMG patterns), and three common faults.
import { ease, clamp01 } from './viewer.js';

const bump = (x) => Math.sin(Math.PI * clamp01(x));

// ------------------------------------------------------------------ rep cycle
export const PHASES = [
  { id: 'ready', dur: 0.5, label: 'Ready', sub: 'Standing relaxed' },
  { id: 'brace', dur: 0.8, label: 'Set & brace', sub: 'Core switches on before anything moves' },
  { id: 'descent', dur: 2.2, label: 'Descent', sub: 'Muscles lengthen under control (eccentric braking)' },
  { id: 'bottom', dur: 0.45, label: 'Bottom', sub: 'Braking switches to driving' },
  { id: 'ascent', dur: 1.9, label: 'Drive up', sub: 'Muscles shorten to lift you (concentric)' },
  { id: 'lockout', dur: 0.6, label: 'Lockout', sub: 'Hips and knees finish extending' },
  { id: 'rest', dur: 0.7, label: 'Relax', sub: 'Brace released' },
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

// ------------------------------------------------------------------ the proper sequence
export const STEPS = [
  { phase: 'brace', title: 'Set & brace',
    text: 'Feet about shoulder-width, toes slightly out. Breathe in and brace: transversus abdominis, the obliques and erector spinae co-contract and pressurise the abdomen, so the spine is stiff before any load moves.' },
  { phase: 'descent', title: 'Descend: hips back and knees forward together',
    text: 'Quads, gluteus maximus and adductor magnus are active while they LENGTHEN (eccentric), acting as brakes. Soleus lets the shin tip forward under control, tibialis anterior pulls you down into the ankle, and gluteus medius keeps the knees tracking over the toes.' },
  { phase: 'bottom', title: 'Bottom: reverse without relaxing',
    text: 'Glutes and adductor magnus are at their longest. The muscles switch from braking to driving, and stretched tissue gives back some elastic energy (the stretch–shortening cycle). Spine neutral, brace still on.' },
  { phase: 'ascent', from: 0, to: 0.5, title: 'Drive out of the hole',
    text: 'Quads straighten the knees while glute max and adductor magnus extend the hips at the same rate, so chest and hips rise together. This is the hardest part of the rep (the sticking point).' },
  { phase: 'ascent', from: 0.5, to: 1, title: 'Finish the stand',
    text: 'Knee and hip extension continue. The hamstrings help extend the hip, but they change length far less than the glutes: they shorten at the hip while they lengthen at the knee.' },
  { phase: 'lockout', title: 'Lockout',
    text: 'Glutes finish hip extension, quads lock the knees, the core stays braced. Breathe out at the top.' },
];
export function stepIndex(st) {
  return STEPS.findIndex((s) => s.phase === st.phase && (s.from === undefined || (st.k >= s.from && st.k < s.to) || (s.to === 1 && st.k >= 1)));
}

// ------------------------------------------------------------------ muscle groups
export const GROUPS = [
  { id: 'quads', name: 'Quadriceps', sub: 'vasti', muscles: ['vastusLateralis', 'vastusMedialis', 'vastusIntermedius'], role: 'Brake the knees bending on the way down and straighten them on the way up. Biggest knee-extension torque near the bottom.' },
  { id: 'gmax', name: 'Gluteus maximus', muscles: ['gluteusMax'], role: 'Controls the hips folding back, drives hip extension out of the bottom and finishes the lockout.' },
  { id: 'addMag', name: 'Adductor magnus', muscles: ['adductorMagnus'], role: 'A powerful hip extensor when the hips are deeply bent. Works hardest out of the hole.' },
  { id: 'hams', name: 'Hamstrings', muscles: ['bicepsFemoris', 'semitendinosus', 'semimembranosus'], role: 'Cross both hip and knee, so their length changes much less than the glutes. They assist hip extension and steady the knee.' },
  { id: 'gmed', name: 'Gluteus medius & minimus', muscles: ['gluteusMed', 'gluteusMin'], role: 'Hold the thighs out so the knees track over the toes and do not cave in.' },
  { id: 'erector', name: 'Erector spinae', sub: '+ quadratus lumborum', muscles: ['erectorSpinae', 'quadratusLumborum'], role: 'Hold the spine neutral (isometric) while the torso leans forward.' },
  { id: 'core', name: 'Core brace', sub: 'transversus, obliques, rectus', muscles: ['transversus', 'intOblique', 'extOblique', 'rectusAbd'], role: 'Pressurise the abdomen to stiffen the spine before and during the lift.' },
  { id: 'calves', name: 'Calves', sub: 'soleus, gastrocnemius', muscles: ['soleus', 'gastrocnemius'], role: 'Control the shin tipping forward and keep your weight over mid-foot.' },
  { id: 'tibAnt', name: 'Tibialis anterior', sub: '+ toe extensors', muscles: ['tibialisAnterior', 'edl'], role: 'Pulls the shin forward over the foot on the way down and helps balance.' },
  { id: 'rf', name: 'Rectus femoris', muscles: ['rectusFemoris'], role: 'The two-joint quad. It extends the knee but also flexes the hip, so it is only moderately active in a squat.' },
  { id: 'addTfl', name: 'Adductors & TFL', sub: 'longus, gracilis, TFL', muscles: ['adductorLongus', 'gracilis', 'tfl'], role: 'Inner-thigh and hip stabilisers. They take over when the knees cave in.' },
  { id: 'iliopsoas', name: 'Iliopsoas', muscles: ['iliopsoas'], role: 'A little activity pulls you into the bottom position. Mostly quiet in a squat.' },
  { id: 'arms', name: 'Front deltoid', sub: 'arms held forward', muscles: ['deltAnt', 'coracobrachialis'], role: 'Holds the arms out in front as a counter-balance.' },
];
export const GROUP_OF = Object.fromEntries(GROUPS.flatMap((g) => g.muscles.map((m) => [m, g.id])));

// ------------------------------------------------------------------ faults
export const VARIANTS = [
  { id: 'proper', name: 'Proper form', view: 'three' },
  {
    id: 'hips', name: 'Hips shoot up', title: 'Hips shoot up: the back takes over', view: 'side', faultSteps: [3, 4],
    what: 'Out of the bottom, the knees straighten first, so the hips rise faster than the chest. The squat turns into a "good morning" and the torso tips toward horizontal.',
    over: ['erector', 'hams'], under: ['quads', 'rf'],
    why: 'The quads are weaker or more tired than the hip extensors, the load is too heavy, or "drive your hips up" is taken too literally.',
    risk: 'With the torso near horizontal, the upper body sits far in front of the hips. Its moment arm grows, so the lower back must hold far more torque.',
    fix: ['"Chest and hips rise at the same speed"', '"Push the floor away" instead of "hips up"', 'Pause squats and slow-tempo squats', 'Front or goblet squats to build the quads'],
  },
  {
    id: 'valgus', name: 'Knees cave in', title: 'Knees cave in (valgus)', view: 'knees', faultSteps: [1, 3, 4],
    what: 'As you drive up, the knees drift inward past the big toes, because the thighs adduct and rotate in instead of tracking over the middle toes.',
    over: ['addTfl', 'addMag'], under: ['gmed', 'gmax'],
    why: 'Weak or slow hip abductors and external rotators (glute medius, glute max), limited ankle mobility, or the arches collapsing. Gets worse with fatigue.',
    risk: 'Sideways (valgus) stress on the knee: the MCL, the ACL and how the kneecap tracks.',
    fix: ['"Spread the floor" or "knees out over the little toes"', 'A mini-band around the knees as feedback', 'Strengthen glute medius: side-lying raises, banded walks, single-leg work', 'Check ankle dorsiflexion'],
  },
  {
    id: 'wink', name: 'Butt wink', title: 'Butt wink: the lower back rounds at the bottom', view: 'hips', faultSteps: [2],
    what: 'Near the bottom, the pelvis tucks under (posterior tilt) and the lower back rounds, even though the torso angle hardly changes.',
    over: ['hams'], under: ['erector', 'core'], passive: 'The passive tissues of the lumbar spine (discs and ligaments) take load the erectors and brace should be holding.',
    why: 'Going deeper than your hip-flexion range allows (hip socket shape varies a lot between people), tight tissue at end range, limited ankle dorsiflexion, or losing the brace at the bottom.',
    risk: 'Under heavy load, a flexed lumbar spine shifts stress onto the discs and ligaments. A small wink with light weights is usually harmless.',
    fix: ['Squat only as deep as you can keep a neutral spine', 'Slightly wider stance, toes turned out a bit more', 'Re-brace before every rep and keep it at the bottom', 'Box squats to a set depth; ankle and hip mobility work'],
  },
];

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
