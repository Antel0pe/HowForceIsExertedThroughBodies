// Muscle library.
//
// strands: each strand is a path of attachment points [bone, lateralX, y, z] (rest pose, meters,
//   x mirrored per side). First point = origin end, last point = insertion end; points in between
//   are "via" points that make the muscle wrap around bones. r = belly half-width.
//   flat: outward normal for sheet-like muscles; thick: thickness / width ratio.
//   ts / te: fraction of the length that is tendon at the origin / insertion end.
// actions: animated movements. `from` is the start pose, `to` is applied on top of `from`.
//   Each entry is [joint, dof, degrees]; joints: trunk neck jaw girdle scapula shoulder elbow forearm
//   wrist fingers hip knee ankle toes (append _opp for the opposite side's joint).
//   The first action is the one in which the muscle is most strongly activated.

export const REGIONS = [
  { id: 'head', label: 'Head & Neck' },
  { id: 'shoulder', label: 'Shoulder & Upper Back' },
  { id: 'arm', label: 'Arm & Forearm' },
  { id: 'trunk', label: 'Trunk & Core' },
  { id: 'hip', label: 'Hip & Glutes' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'leg', label: 'Lower Leg' },
];

export const MUSCLES = [
  // ================================================================ HEAD & NECK
  {
    id: 'masseter', name: 'Masseter', region: 'head', layer: 1,
    strands: [
      { pts: [['head', 0.056, 1.626, 0.052], ['jaw', 0.051, 1.566, 0.032]], r: 0.012 },
      { pts: [['head', 0.06, 1.622, 0.036], ['jaw', 0.053, 1.562, 0.014]], r: 0.011 },
    ],
    ts: 0.1, te: 0.1, flat: [1, 0, 0], thick: 0.55,
    origin: 'Zygomatic arch (cheekbone)', insertion: 'Angle and outer ramus of the jaw (mandible)',
    actions: [
      { name: 'Close the jaw (bite)', from: [['jaw', 'open', 28]], to: [['jaw', 'open', 0]] },
    ],
    best: 'Clenching or biting down hard — chewing tough food, gritting teeth. It is the strongest muscle for its size: molars can reach ~700 N of bite force.',
    examples: ['Chewing a steak', 'Clenching your teeth', 'Biting an apple'],
    nerve: 'trigeminal', roots: 'Cranial nerve V (pons)', reflex: 'Jaw-jerk reflex (CN V)',
  },
  {
    id: 'temporalis', name: 'Temporalis', region: 'head', layer: 1,
    strands: [
      { pts: [['head', 0.079, 1.705, 0.035], ['head', 0.066, 1.636, 0.036], ['jaw', 0.046, 1.6, 0.046]], r: 0.016 },
      { pts: [['head', 0.08, 1.71, -0.015], ['head', 0.067, 1.64, 0.02], ['jaw', 0.046, 1.6, 0.044]], r: 0.014 },
    ],
    ts: 0.05, te: 0.25, flat: [1, 0, 0], thick: 0.35,
    origin: 'Temporal fossa on the side of the skull', insertion: 'Coronoid process of the jaw',
    actions: [
      { name: 'Close & pull jaw back', from: [['jaw', 'open', 28]], to: [['jaw', 'open', 0]] },
    ],
    best: 'Closing the jaw quickly and holding it shut; its back fibres pull the jaw backward. Put your fingers on your temple and clench — you can feel it bulge.',
    examples: ['Chewing', 'Clenching', 'Pulling the jaw back after jutting it forward'],
    nerve: 'trigeminal', roots: 'Cranial nerve V (pons)',
  },
  {
    id: 'scm', name: 'Sternocleidomastoid', region: 'head', layer: 1,
    strands: [
      { pts: [['thorax', 0.016, 1.425, 0.072], ['neck', 0.04, 1.52, 0.03], ['head', 0.05, 1.6, -0.024]], r: 0.012 },
      { pts: [['clavicle', 0.045, 1.447, 0.066], ['neck', 0.05, 1.52, 0.02], ['head', 0.053, 1.6, -0.03]], r: 0.011 },
    ],
    ts: 0.12, te: 0.1,
    origin: 'Top of the sternum (manubrium) and inner third of the collarbone', insertion: 'Mastoid process behind the ear',
    actions: [
      { name: 'Turn head to the opposite side', from: [], to: [['neck', 'rot', -55], ['neck', 'latflex', 12], ['neck', 'flex', 8]] },
      { name: 'Both sides: bow head forward', from: [], to: [['neck', 'flex', 35]] },
    ],
    best: 'Turning the head to look over the OPPOSITE shoulder (right SCM turns your face left), and lifting the head off a pillow. Also helps pull the rib cage up during heavy breathing.',
    examples: ['Checking your blind spot', 'Lifting your head while lying down', 'Gasping for air'],
    nerve: 'accessory', roots: 'Cranial nerve XI (+ C2–C3 for sensation)',
  },
  {
    id: 'splenius', name: 'Splenius capitis', region: 'head', layer: 2,
    strands: [
      { pts: [['thorax', 0.0, 1.46, -0.08], ['neck', 0.025, 1.54, -0.07], ['head', 0.047, 1.625, -0.05]], r: 0.013 },
      { pts: [['neck', 0.0, 1.5, -0.072], ['neck', 0.025, 1.56, -0.065], ['head', 0.04, 1.63, -0.06]], r: 0.011 },
    ],
    ts: 0.08, te: 0.1, flat: [0, 0, -1], thick: 0.4,
    origin: 'Nuchal ligament and spinous processes C7–T3', insertion: 'Mastoid process and lateral occipital bone',
    actions: [
      { name: 'Extend & turn head to same side', from: [['neck', 'flex', 20]], to: [['neck', 'flex', -25], ['neck', 'rot', 25]] },
    ],
    best: 'Tilting the head back (looking up) and turning it toward the SAME side. Works hard holding the head up when you lean over a desk or phone.',
    examples: ['Looking up at the ceiling', 'Holding your head up while reading', 'Headers in football'],
    nerve: 'cervicalDorsal', roots: 'C2–C4 (dorsal rami)',
  },
  {
    id: 'levatorScap', name: 'Levator scapulae', region: 'head', layer: 2,
    strands: [
      { pts: [['neck', 0.035, 1.58, -0.03], ['neck', 0.06, 1.52, -0.05], ['scapula', 0.085, 1.475, -0.085]], r: 0.011 },
    ],
    ts: 0.12, te: 0.08,
    origin: 'Transverse processes of C1–C4', insertion: 'Superior angle of the shoulder blade',
    actions: [
      { name: 'Lift shoulder blade', from: [], to: [['girdle', 'elev', 18], ['scapula', 'upRot', -10], ['neck', 'latflex', 8]] },
    ],
    best: 'Shrugging while tilting the head to the same side, and resisting the weight of a heavy bag on one shoulder. Often feels tight from hunching.',
    examples: ['Carrying a shoulder bag', 'Holding a phone between ear and shoulder', 'Shrugs'],
    nerve: 'dorsalScapular', roots: 'C3–C5',
  },

  // ================================================================ SHOULDER & UPPER BACK
  {
    id: 'trapUpper', name: 'Trapezius (upper fibres)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['head', 0.02, 1.645, -0.068], ['neck', 0.06, 1.53, -0.06], ['clavicle', 0.14, 1.468, 0.012]], r: 0.018 },
      { pts: [['neck', 0.005, 1.53, -0.075], ['neck', 0.09, 1.49, -0.055], ['clavicle', 0.158, 1.47, 0.0]], r: 0.02 },
    ],
    ts: 0.05, te: 0.08, flat: [0, 0.6, -1], thick: 0.35,
    origin: 'Base of the skull (occiput) and nuchal ligament', insertion: 'Outer third of the collarbone',
    actions: [
      { name: 'Shrug (elevate shoulder)', from: [], to: [['girdle', 'elev', 25], ['scapula', 'upRot', 8]] },
    ],
    best: 'Shrugging the shoulders up toward the ears, and holding a heavy load in the hand (it stops the arm being pulled down). Also tilts the head to the same side.',
    examples: ['Barbell shrugs', 'Carrying heavy suitcases', 'Farmer\'s walk'],
    nerve: 'accessory', roots: 'Cranial nerve XI (+ C3–C4)',
  },
  {
    id: 'trapMiddle', name: 'Trapezius (middle fibres)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['thorax', 0.0, 1.45, -0.095], ['scapula', 0.163, 1.47, -0.03]], r: 0.02 },
      { pts: [['thorax', 0.0, 1.4, -0.1], ['scapula', 0.13, 1.452, -0.095]], r: 0.022 },
    ],
    ts: 0.12, te: 0.06, flat: [0, 0, -1], thick: 0.3,
    origin: 'Spinous processes C7–T3', insertion: 'Acromion and spine of the shoulder blade',
    actions: [
      { name: 'Squeeze shoulder blades together', from: [['shoulder', 'abd', 90], ['girdle', 'protract', 12]], to: [['girdle', 'protract', -22], ['shoulder', 'hadd', -25]] },
    ],
    best: 'Pinching the shoulder blades together (retraction), especially with arms out to the side — e.g. a "T-raise" lying face down or the end of a rowing pull.',
    examples: ['Seated rows', 'Pulling a rope toward you', 'Good posture "chest up"'],
    nerve: 'accessory', roots: 'Cranial nerve XI (+ C3–C4)',
  },
  {
    id: 'trapLower', name: 'Trapezius (lower fibres)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['thorax', 0.0, 1.33, -0.105], ['thorax', 0.06, 1.36, -0.105], ['scapula', 0.095, 1.43, -0.1]], r: 0.019 },
      { pts: [['thorax', 0.0, 1.24, -0.1], ['thorax', 0.05, 1.3, -0.105], ['scapula', 0.105, 1.425, -0.1]], r: 0.017 },
    ],
    ts: 0.1, te: 0.08, flat: [0, 0, -1], thick: 0.3,
    origin: 'Spinous processes T4–T12', insertion: 'Medial end of the spine of the shoulder blade',
    actions: [
      { name: 'Rotate blade up as arm goes overhead', from: [], to: [['shoulder', 'flex', 150], ['scapula', 'upRot', 35], ['girdle', 'elev', -6]] },
    ],
    best: 'Raising the arm overhead (it rotates the shoulder blade upward with the serratus) and pulling the shoulder blade down — e.g. a "Y-raise" or reaching up to a high shelf.',
    examples: ['Reaching a high shelf', 'Overhead press', 'Climbing'],
    nerve: 'accessory', roots: 'Cranial nerve XI (+ C3–C4)',
  },
  {
    id: 'rhomboids', name: 'Rhomboids (major & minor)', region: 'shoulder', layer: 2,
    strands: [
      { pts: [['thorax', 0.0, 1.46, -0.09], ['scapula', 0.086, 1.45, -0.09]], r: 0.013 },
      { pts: [['thorax', 0.0, 1.4, -0.095], ['scapula', 0.09, 1.37, -0.092]], r: 0.015 },
      { pts: [['thorax', 0.0, 1.35, -0.095], ['scapula', 0.095, 1.3, -0.09]], r: 0.014 },
    ],
    ts: 0.1, te: 0.05, flat: [0, 0, -1], thick: 0.35,
    origin: 'Spinous processes C7–T5', insertion: 'Medial (inner) border of the shoulder blade',
    actions: [
      { name: 'Retract & rotate blade down', from: [['girdle', 'protract', 10]], to: [['girdle', 'protract', -22], ['scapula', 'upRot', -10], ['girdle', 'elev', 4]] },
    ],
    best: 'Pulling the shoulder blade toward the spine — the end of a row, pull-up or pulling a door open. They also rotate the blade downward as the arm comes down from overhead.',
    examples: ['Rowing', 'Pulling a heavy door', 'Archery draw'],
    nerve: 'dorsalScapular', roots: 'C4–C5',
  },
  {
    id: 'latissimus', name: 'Latissimus dorsi', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['thorax', 0.015, 1.27, -0.088], ['thorax', 0.1, 1.29, -0.08], ['scapula', 0.13, 1.31, -0.07], ['humerus', 0.185, 1.37, 0.01]], r: 0.026 },
      { pts: [['lumbar', 0.02, 1.12, -0.08], ['thorax', 0.12, 1.22, -0.06], ['thorax', 0.145, 1.29, -0.04], ['humerus', 0.186, 1.365, 0.012]], r: 0.03 },
      { pts: [['pelvis', 0.1, 1.05, -0.06], ['thorax', 0.145, 1.18, -0.035], ['thorax', 0.155, 1.28, -0.02], ['humerus', 0.187, 1.36, 0.015]], r: 0.026 },
    ],
    ts: 0.12, te: 0.12, flat: [0.35, 0, -1], thick: 0.28,
    origin: 'Spines of T7–L5, thoracolumbar fascia, back of the iliac crest, lower ribs', insertion: 'Floor of the bicipital groove on the front of the humerus',
    actions: [
      { name: 'Pull arm down from overhead (pull-up)', from: [['shoulder', 'abd', 160], ['scapula', 'upRot', 40], ['girdle', 'elev', 10], ['elbow', 'flex', 10]], to: [['shoulder', 'abd', 15], ['scapula', 'upRot', 0], ['girdle', 'elev', -5], ['elbow', 'flex', 115]] },
      { name: 'Extend arm backward', from: [['shoulder', 'flex', 90]], to: [['shoulder', 'flex', -35], ['shoulder', 'introt', 15]] },
    ],
    best: 'Pulling the arm DOWN and BACK against resistance — pull-ups, lat pulldowns, rowing, swimming strokes. It is the main "pull your body up to the bar" muscle (together with teres major and the biceps).',
    examples: ['Pull-ups', 'Swimming freestyle', 'Pulling yourself out of a pool', 'Starting a lawnmower'],
    nerve: 'thoracodorsal', roots: 'C6–C8',
  },
  {
    id: 'deltAnt', name: 'Deltoid (anterior)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['clavicle', 0.135, 1.465, 0.03], ['humerus', 0.2, 1.4, 0.04], ['humerus', 0.216, 1.28, 0.0]], r: 0.016 },
      { pts: [['clavicle', 0.155, 1.468, 0.02], ['humerus', 0.212, 1.405, 0.03], ['humerus', 0.217, 1.28, -0.004]], r: 0.016 },
    ],
    ts: 0.06, te: 0.15,
    origin: 'Outer third of the collarbone', insertion: 'Deltoid tuberosity (outer humerus)',
    actions: [
      { name: 'Raise arm forward (front raise)', from: [], to: [['shoulder', 'flex', 100], ['scapula', 'upRot', 20]] },
      { name: 'Turn arm inward', from: [['elbow', 'flex', 90]], to: [['shoulder', 'introt', 45]] },
    ],
    best: 'Lifting the arm forward and up in front of you — front raises, overhead pressing, throwing a punch upward, pushing a heavy door at shoulder height.',
    examples: ['Overhead press', 'Front raise', 'Lifting a box onto a shelf'],
    nerve: 'axillary', roots: 'C5–C6',
  },
  {
    id: 'deltMid', name: 'Deltoid (lateral)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['scapula', 0.18, 1.476, 0.002], ['humerus', 0.229, 1.42, 0.006], ['humerus', 0.218, 1.28, -0.006]], r: 0.018 },
      { pts: [['scapula', 0.185, 1.472, -0.014], ['humerus', 0.229, 1.415, -0.014], ['humerus', 0.218, 1.28, -0.008]], r: 0.017 },
    ],
    ts: 0.05, te: 0.15,
    origin: 'Acromion (top point of the shoulder)', insertion: 'Deltoid tuberosity (outer humerus)',
    actions: [
      { name: 'Raise arm out to the side', from: [], to: [['shoulder', 'abd', 85], ['scapula', 'upRot', 25]] },
    ],
    best: 'Lifting the arm sideways from about 15° up to 90°+ (lateral raise, "jumping jacks"). The supraspinatus starts the motion, then the lateral deltoid takes over.',
    examples: ['Lateral raises', 'Holding your arms out', 'Jumping jacks'],
    nerve: 'axillary', roots: 'C5–C6',
  },
  {
    id: 'deltPost', name: 'Deltoid (posterior)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['scapula', 0.13, 1.457, -0.088], ['humerus', 0.198, 1.4, -0.055], ['humerus', 0.215, 1.28, -0.012]], r: 0.016 },
      { pts: [['scapula', 0.155, 1.462, -0.062], ['humerus', 0.21, 1.405, -0.045], ['humerus', 0.216, 1.28, -0.01]], r: 0.016 },
    ],
    ts: 0.06, te: 0.15,
    origin: 'Spine of the shoulder blade', insertion: 'Deltoid tuberosity (outer humerus)',
    actions: [
      { name: 'Swing arm back & out (reverse fly)', from: [['shoulder', 'flex', 90]], to: [['shoulder', 'hadd', -85]] },
      { name: 'Extend arm backward', from: [], to: [['shoulder', 'flex', -40]] },
    ],
    best: 'Pulling the arm backward and out to the side when it is raised — reverse flys, rowing with elbows wide, reaching back for a seat belt.',
    examples: ['Reverse fly', 'Wide-grip rows', 'Backhand in tennis'],
    nerve: 'axillary', roots: 'C5–C6',
  },
  {
    id: 'supraspinatus', name: 'Supraspinatus (rotator cuff)', region: 'shoulder', layer: 2,
    strands: [
      { pts: [['scapula', 0.1, 1.462, -0.082], ['scapula', 0.16, 1.466, -0.016], ['humerus', 0.2, 1.442, 0.0]], r: 0.013 },
    ],
    ts: 0.05, te: 0.22,
    origin: 'Supraspinous fossa (above the spine of the shoulder blade)', insertion: 'Top of the greater tubercle of the humerus',
    actions: [
      { name: 'Start lifting arm sideways', from: [], to: [['shoulder', 'abd', 60], ['scapula', 'upRot', 10]] },
    ],
    best: 'The first ~15–30° of lifting the arm sideways, and keeping the ball of the humerus centred in the socket. Classic test: the "empty can" (arm raised, thumb down).',
    examples: ['Starting a lateral raise', 'Carrying a bag at your side (prevents arm sliding down)'],
    nerve: 'suprascapular', roots: 'C5–C6',
  },
  {
    id: 'infraspinatus', name: 'Infraspinatus (rotator cuff)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['scapula', 0.105, 1.38, -0.092], ['humerus', 0.195, 1.41, -0.042], ['humerus', 0.205, 1.425, -0.02]], r: 0.017 },
      { pts: [['scapula', 0.11, 1.33, -0.09], ['humerus', 0.193, 1.4, -0.045], ['humerus', 0.204, 1.418, -0.024]], r: 0.015 },
    ],
    ts: 0.06, te: 0.15, flat: [0, 0, -1], thick: 0.45,
    origin: 'Infraspinous fossa (below the spine of the shoulder blade)', insertion: 'Back of the greater tubercle of the humerus',
    actions: [
      { name: 'Rotate arm outward', from: [['elbow', 'flex', 90], ['shoulder', 'introt', 30]], to: [['shoulder', 'introt', -60]] },
    ],
    best: 'Rotating the upper arm OUTWARD (external rotation) with the elbow bent — like opening a door outward or the backswing of a throw. It also brakes the arm after a throw.',
    examples: ['Cable external rotation', 'Backhand', 'Cocking the arm to throw'],
    nerve: 'suprascapular', roots: 'C5–C6',
  },
  {
    id: 'teresMinor', name: 'Teres minor (rotator cuff)', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['scapula', 0.14, 1.355, -0.072], ['humerus', 0.19, 1.39, -0.045], ['humerus', 0.2, 1.4, -0.032]], r: 0.01 },
    ],
    ts: 0.06, te: 0.18,
    origin: 'Upper outer border of the shoulder blade', insertion: 'Lower facet of the greater tubercle',
    actions: [
      { name: 'Rotate arm outward', from: [['elbow', 'flex', 90], ['shoulder', 'introt', 30]], to: [['shoulder', 'introt', -60]] },
    ],
    best: 'External rotation of the upper arm, together with infraspinatus; it is most active when the arm is out to the side (throwing position).',
    examples: ['Throwing a ball', 'External rotation with a band'],
    nerve: 'axillary', roots: 'C5–C6',
  },
  {
    id: 'subscapularis', name: 'Subscapularis (rotator cuff)', region: 'shoulder', layer: 2,
    strands: [
      { pts: [['scapula', 0.105, 1.4, -0.072], ['scapula', 0.15, 1.4, -0.022], ['humerus', 0.178, 1.41, 0.022]], r: 0.016 },
      { pts: [['scapula', 0.11, 1.34, -0.072], ['scapula', 0.15, 1.38, -0.025], ['humerus', 0.178, 1.405, 0.02]], r: 0.014 },
    ],
    ts: 0.05, te: 0.18, flat: [0, 0, 1], thick: 0.45,
    origin: 'Front surface of the shoulder blade (subscapular fossa)', insertion: 'Lesser tubercle of the humerus',
    actions: [
      { name: 'Rotate arm inward', from: [['elbow', 'flex', 90], ['shoulder', 'introt', -40]], to: [['shoulder', 'introt', 70]] },
    ],
    best: 'Rotating the arm INWARD (bringing the hand to the belly) against resistance — e.g. arm-wrestling, the follow-through of a throw. Biggest and strongest rotator-cuff muscle.',
    examples: ['Arm wrestling', 'Tucking in your shirt behind you', 'Throwing follow-through'],
    nerve: 'subscapular', roots: 'C5–C6',
  },
  {
    id: 'teresMajor', name: 'Teres major', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['scapula', 0.11, 1.305, -0.087], ['scapula', 0.15, 1.33, -0.06], ['humerus', 0.188, 1.36, 0.004]], r: 0.016 },
    ],
    ts: 0.05, te: 0.15,
    origin: 'Lower outer corner (inferior angle) of the shoulder blade', insertion: 'Inner lip of the bicipital groove',
    actions: [
      { name: 'Pull arm down & back', from: [['shoulder', 'flex', 120]], to: [['shoulder', 'flex', -30], ['shoulder', 'introt', 20]] },
    ],
    best: 'Pulling a raised arm down and back, and rotating it inward — the "lat\'s little helper" in pull-ups, rows and swimming.',
    examples: ['Pull-ups', 'Rowing', 'Swimming'],
    nerve: 'subscapular', roots: 'C5–C7 (lower subscapular)',
  },
  {
    id: 'coracobrachialis', name: 'Coracobrachialis', region: 'shoulder', layer: 2,
    strands: [
      { pts: [['scapula', 0.14, 1.43, 0.032], ['humerus', 0.186, 1.3, 0.004]], r: 0.01 },
    ],
    ts: 0.15, te: 0.12,
    origin: 'Coracoid process of the shoulder blade', insertion: 'Inner surface of the mid-humerus',
    actions: [
      { name: 'Raise arm forward & inward', from: [], to: [['shoulder', 'flex', 70], ['shoulder', 'hadd', 20]] },
    ],
    best: 'Bringing the arm forward and across the body (flexion + adduction), like a golf swing\'s downswing or hugging.',
    examples: ['Hugging', 'Golf downswing'],
    nerve: 'musculocutaneous', roots: 'C5–C7',
  },
  {
    id: 'pecMajor', name: 'Pectoralis major', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['clavicle', 0.05, 1.446, 0.072], ['thorax', 0.12, 1.42, 0.078], ['humerus', 0.196, 1.356, 0.03]], r: 0.02 },
      { pts: [['thorax', 0.012, 1.4, 0.078], ['thorax', 0.1, 1.38, 0.092], ['humerus', 0.195, 1.35, 0.028]], r: 0.026 },
      { pts: [['thorax', 0.015, 1.34, 0.09], ['thorax', 0.1, 1.33, 0.096], ['humerus', 0.193, 1.345, 0.026]], r: 0.026 },
      { pts: [['thorax', 0.03, 1.28, 0.1], ['thorax', 0.11, 1.29, 0.085], ['humerus', 0.19, 1.34, 0.022]], r: 0.022 },
    ],
    ts: 0.04, te: 0.12, flat: [0, 0, 1], thick: 0.4,
    origin: 'Inner collarbone, sternum and upper 6 rib cartilages', insertion: 'Outer lip of the bicipital groove of the humerus',
    actions: [
      { name: 'Bring arm across chest (fly / push)', from: [['shoulder', 'abd', 90], ['shoulder', 'hadd', -20], ['elbow', 'flex', 15]], to: [['shoulder', 'hadd', 80]] },
      { name: 'Pull arm down from above (sternal part)', from: [['shoulder', 'flex', 150]], to: [['shoulder', 'flex', 20], ['shoulder', 'introt', 15]] },
    ],
    best: 'Pushing in front of you and bringing the arm across the chest (horizontal adduction) — bench press, push-ups, chest flys, hugging. The upper (clavicular) part also raises the arm forward.',
    examples: ['Push-ups', 'Bench press', 'Hugging someone', 'Pushing a car'],
    nerve: 'pectoral', roots: 'C5–T1',
  },
  {
    id: 'pecMinor', name: 'Pectoralis minor', region: 'shoulder', layer: 2,
    strands: [
      { pts: [['scapula', 0.14, 1.43, 0.036], ['thorax', 0.085, 1.36, 0.077]], r: 0.01 },
      { pts: [['scapula', 0.14, 1.43, 0.036], ['thorax', 0.09, 1.31, 0.082]], r: 0.011 },
      { pts: [['scapula', 0.14, 1.43, 0.036], ['thorax', 0.095, 1.27, 0.078]], r: 0.01 },
    ],
    ts: 0.12, te: 0.05, flat: [0, 0, 1], thick: 0.4,
    origin: 'Ribs 3–5 (front)', insertion: 'Coracoid process of the shoulder blade',
    actions: [
      { name: 'Pull shoulder forward & down', from: [], to: [['girdle', 'protract', 18], ['girdle', 'elev', -12], ['scapula', 'upRot', -10]] },
    ],
    best: 'Pulling the shoulder blade forward and down (e.g. the bottom of a dip, pushing up from a chair arm). With the shoulder fixed, it lifts the ribs to help forced breathing.',
    examples: ['Dips', 'Pushing up from armrests', 'Heavy breathing after a sprint'],
    nerve: 'pectoral', roots: 'C8–T1 (medial pectoral)',
  },
  {
    id: 'serratus', name: 'Serratus anterior', region: 'shoulder', layer: 1,
    strands: [
      { pts: [['thorax', 0.13, 1.37, 0.056], ['thorax', 0.152, 1.37, 0.0], ['scapula', 0.09, 1.44, -0.075]], r: 0.013 },
      { pts: [['thorax', 0.14, 1.32, 0.06], ['thorax', 0.158, 1.32, -0.01], ['scapula', 0.092, 1.39, -0.075]], r: 0.014 },
      { pts: [['thorax', 0.145, 1.27, 0.05], ['thorax', 0.158, 1.28, -0.02], ['scapula', 0.094, 1.34, -0.076]], r: 0.014 },
      { pts: [['thorax', 0.14, 1.22, 0.04], ['thorax', 0.152, 1.24, -0.03], ['scapula', 0.096, 1.3, -0.077]], r: 0.013 },
    ],
    ts: 0.04, te: 0.08, flat: [1, 0, 0.3], thick: 0.4,
    origin: 'Outer surfaces of ribs 1–8 (the "boxer\'s muscle" teeth on your side)', insertion: 'Front of the inner border of the shoulder blade',
    actions: [
      { name: 'Punch forward (protract blade)', from: [['shoulder', 'flex', 90], ['girdle', 'protract', -10]], to: [['girdle', 'protract', 28], ['scapula', 'upRot', 15]] },
      { name: 'Rotate blade up overhead', from: [], to: [['shoulder', 'flex', 160], ['scapula', 'upRot', 40]] },
    ],
    best: 'Pushing the arm forward as far as it goes — punching, the top of a push-up ("push-up plus"), reaching forward. It also rotates the blade up so you can raise the arm overhead. Weakness causes a "winged" scapula.',
    examples: ['Boxing jab', 'Push-up plus', 'Reaching for something far away'],
    nerve: 'longThoracic', roots: 'C5–C7',
  },

  // ================================================================ ARM & FOREARM
  {
    id: 'biceps', wrap: ['humerus', 0.215, 1.12, -0.02, 0.03], name: 'Biceps brachii', region: 'arm', layer: 1,
    strands: [
      { pts: [['scapula', 0.165, 1.445, -0.004], ['humerus', 0.19, 1.41, 0.03], ['humerus', 0.207, 1.28, 0.037], ['radius', 0.228, 1.075, 0.008]], r: 0.019 },
      { pts: [['scapula', 0.14, 1.43, 0.035], ['humerus', 0.192, 1.3, 0.035], ['humerus', 0.2, 1.24, 0.034], ['radius', 0.226, 1.076, 0.01]], r: 0.017 },
    ],
    ts: 0.22, te: 0.2,
    origin: 'Long head: top of the shoulder socket (supraglenoid tubercle). Short head: coracoid process', insertion: 'Radial tuberosity (radius) and bicipital aponeurosis',
    actions: [
      { name: 'Curl with palm turning up', from: [['forearm', 'pron', 75]], to: [['elbow', 'flex', 110], ['forearm', 'pron', 0]] },
      { name: 'Turn palm up (supinate)', from: [['elbow', 'flex', 90], ['forearm', 'pron', 80]], to: [['forearm', 'pron', 0]] },
      { name: 'Raise arm forward (weak)', from: [], to: [['shoulder', 'flex', 60]] },
    ],
    best: 'Bending the elbow WITH the palm turning/facing up (flexion + supination together) against load — curls, chin-ups, lifting a box toward you, turning a screwdriver or a stiff jar lid. Yes: when you pull something toward you, the biceps pulls on the radius and bends the elbow. With the palm down it contributes less (brachialis takes over).',
    examples: ['Chin-ups (palms toward you)', 'Biceps curl', 'Carrying a box in front of you', 'Turning a screwdriver'],
    nerve: 'musculocutaneous', roots: 'C5–C6', reflex: 'Biceps reflex (C5–C6)',
    note: 'Muscles only PULL. The biceps cannot straighten the elbow — the triceps (or gravity) does that.',
  },
  {
    id: 'brachialis', wrap: ['humerus', 0.215, 1.12, -0.02, 0.026], name: 'Brachialis', region: 'arm', layer: 2,
    strands: [
      { pts: [['humerus', 0.205, 1.25, 0.006], ['humerus', 0.212, 1.16, 0.022], ['ulna', 0.215, 1.085, 0.006]], r: 0.017 },
    ],
    ts: 0.06, te: 0.18,
    origin: 'Front of the lower half of the humerus', insertion: 'Coronoid process & tuberosity of the ulna',
    actions: [
      { name: 'Bend elbow (any hand position)', from: [['forearm', 'pron', 80]], to: [['elbow', 'flex', 120]] },
    ],
    best: 'Bending the elbow in EVERY forearm position — it is the true workhorse elbow flexor, strongest when the palm faces down (reverse curls), because it pulls on the ulna which does not rotate.',
    examples: ['Reverse curls', 'Lifting a kettle', 'Holding a bag with elbow bent'],
    nerve: 'musculocutaneous', roots: 'C5–C6 (+ small radial nerve branch)',
  },
  {
    id: 'brachioradialis', wrap: ['humerus', 0.232, 1.12, -0.02, 0.03], name: 'Brachioradialis', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.242, 1.2, -0.01], ['radius', 0.252, 1.05, 0.016], ['radius', 0.256, 0.895, 0.004]], r: 0.014 },
    ],
    ts: 0.05, te: 0.42,
    origin: 'Lateral supracondylar ridge of the humerus', insertion: 'Styloid process at the thumb side of the radius',
    actions: [
      { name: 'Hammer curl (thumb up)', from: [['forearm', 'pron', 40]], to: [['elbow', 'flex', 110]] },
    ],
    best: 'Bending the elbow with the thumb pointing up (mid-position, "hammer curl") — and rapid elbow flexion. It also brings the forearm back to mid-position from fully palm-up or palm-down.',
    examples: ['Hammer curls', 'Drinking from a mug', 'Hammering a nail'],
    nerve: 'radial', roots: 'C5–C6', reflex: 'Brachioradialis reflex (C6)',
  },
  {
    id: 'triceps', wrap: ['humerus', 0.213, 1.125, -0.022, 0.028], name: 'Triceps brachii', region: 'arm', layer: 1,
    strands: [
      { pts: [['scapula', 0.165, 1.4, -0.036], ['humerus', 0.2, 1.26, -0.052], ['humerus', 0.21, 1.175, -0.05], ['ulna', 0.212, 1.14, -0.052]], r: 0.019 },
      { pts: [['humerus', 0.207, 1.36, -0.032], ['humerus', 0.218, 1.24, -0.048], ['humerus', 0.214, 1.175, -0.048], ['ulna', 0.213, 1.14, -0.05]], r: 0.018 },
      { pts: [['humerus', 0.198, 1.26, -0.032], ['humerus', 0.205, 1.19, -0.042], ['ulna', 0.211, 1.142, -0.048]], r: 0.014 },
    ],
    ts: 0.1, te: 0.18,
    origin: 'Long head: below the shoulder socket. Lateral & medial heads: back of the humerus', insertion: 'Olecranon (point of the elbow)',
    actions: [
      { name: 'Straighten the elbow (push)', from: [['elbow', 'flex', 120]], to: [['elbow', 'flex', 0]] },
      { name: 'Overhead extension', from: [['shoulder', 'flex', 165], ['scapula', 'upRot', 35], ['elbow', 'flex', 140]], to: [['elbow', 'flex', 15]] },
      { name: 'Pull arm back (long head)', from: [], to: [['shoulder', 'flex', -35]] },
    ],
    best: 'Straightening the elbow against resistance — push-ups, dips, bench and overhead press, pushing a door. The long head (crosses the shoulder) works hardest when the arm is overhead.',
    examples: ['Push-ups', 'Dips', 'Pushing yourself up from a chair', 'Throwing (elbow snap)'],
    nerve: 'radial', roots: 'C6–C8', reflex: 'Triceps reflex (C7)',
  },
  {
    id: 'pronatorTeres', name: 'Pronator teres', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.19, 1.137, -0.01], ['radius', 0.214, 1.07, 0.022], ['radius', 0.245, 1.0, 0.009]], r: 0.011 },
    ],
    ts: 0.06, te: 0.2,
    origin: 'Medial epicondyle of the humerus (inner elbow)', insertion: 'Middle of the outer radius',
    actions: [
      { name: 'Turn palm down (pronate)', from: [['elbow', 'flex', 90], ['forearm', 'pron', 0]], to: [['forearm', 'pron', 85]] },
    ],
    best: 'Turning the palm down quickly or against resistance — pouring from a jug, turning a key/screw anticlockwise (right hand), dribbling a ball. Helps bend the elbow a little too.',
    examples: ['Pouring a drink', 'Turning a doorknob', 'Typing position'],
    nerve: 'median', roots: 'C6–C7',
  },
  {
    id: 'supinator', name: 'Supinator', region: 'arm', layer: 2,
    strands: [
      { pts: [['humerus', 0.243, 1.124, -0.026], ['radius', 0.246, 1.085, -0.022], ['radius', 0.232, 1.04, 0.013]], r: 0.01 },
    ],
    ts: 0.05, te: 0.08,
    origin: 'Lateral epicondyle and upper ulna', insertion: 'Wraps around to the upper radius',
    actions: [
      { name: 'Turn palm up (slowly / elbow straight)', from: [['forearm', 'pron', 85]], to: [['forearm', 'pron', 0]] },
    ],
    best: 'Turning the palm up when the elbow is STRAIGHT or when no force is needed (with the elbow bent and heavy load, the biceps dominates).',
    examples: ['Turning a key clockwise (right hand)', 'Holding out your hand palm-up for change'],
    nerve: 'radialDeep', roots: 'C5–C6',
  },
  {
    id: 'fcr', name: 'Flexor carpi radialis', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.19, 1.125, -0.014], ['radius', 0.226, 0.98, 0.021], ['radius', 0.248, 0.887, 0.012], ['hand', 0.248, 0.835, 0.009]], r: 0.01 },
    ],
    ts: 0.06, te: 0.45,
    origin: 'Medial epicondyle (inner elbow)', insertion: 'Base of the 2nd & 3rd metacarpals (palm side)',
    actions: [
      { name: 'Bend wrist toward palm (thumb side)', from: [], to: [['wrist', 'flex', 60], ['wrist', 'radDev', 12]] },
    ],
    best: 'Bending the wrist forward (toward the palm) and toward the thumb side — e.g. a wrist curl, throwing a dart, the snap of a throw.',
    examples: ['Wrist curls', 'Throwing a dart', 'Flicking water off your hand'],
    nerve: 'median', roots: 'C6–C7',
  },
  {
    id: 'fcu', name: 'Flexor carpi ulnaris', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.185, 1.12, -0.03], ['ulna', 0.2, 0.98, -0.01], ['hand', 0.212, 0.858, 0.006]], r: 0.011 },
    ],
    ts: 0.06, te: 0.32,
    origin: 'Medial epicondyle & back of the ulna', insertion: 'Pisiform & hook of hamate (little-finger side of wrist)',
    actions: [
      { name: 'Bend wrist toward palm (little-finger side)', from: [], to: [['wrist', 'flex', 55], ['wrist', 'radDev', -22]] },
    ],
    best: 'Bending the wrist toward the palm AND the little-finger side — hammering, chopping, swinging a racket or golf club.',
    examples: ['Hammering', 'Chopping wood', 'Golf swing'],
    nerve: 'ulnar', roots: 'C7–C8',
  },
  {
    id: 'fds', name: 'Flexor digitorum superficialis', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.194, 1.12, -0.014], ['radius', 0.228, 0.97, 0.024], ['hand', 0.237, 0.85, 0.016], ['fingers', 0.237, 0.735, 0.012]], r: 0.013 },
    ],
    ts: 0.06, te: 0.5,
    origin: 'Medial epicondyle, ulna and radius', insertion: 'Middle bones of the four fingers',
    actions: [
      { name: 'Grip (curl fingers)', from: [], to: [['fingers', 'flex', 95], ['wrist', 'flex', 15]] },
    ],
    best: 'Gripping and curling the fingers against resistance — carrying bags, holding a bar, climbing. Works with the deeper flexor digitorum profundus.',
    examples: ['Carrying shopping bags', 'Dead hangs', 'Rock climbing', 'Making a fist'],
    nerve: 'median', roots: 'C7–T1',
  },
  {
    id: 'extDigitorum', name: 'Extensor digitorum', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.243, 1.12, -0.032], ['radius', 0.24, 0.98, -0.03], ['hand', 0.237, 0.85, -0.013], ['fingers', 0.237, 0.735, -0.008]], r: 0.012 },
    ],
    ts: 0.05, te: 0.48,
    origin: 'Lateral epicondyle (outer elbow)', insertion: 'Back of the four fingers (extensor expansions)',
    actions: [
      { name: 'Open hand (straighten fingers)', from: [['fingers', 'flex', 80]], to: [['fingers', 'flex', -15], ['wrist', 'flex', -15]] },
    ],
    best: 'Straightening/opening the fingers and extending the wrist — letting go of an object, spreading the hand, typing. Overuse with gripping is linked to "tennis elbow".',
    examples: ['Opening your hand wide', 'Typing', 'Playing piano'],
    nerve: 'radialDeep', roots: 'C7–C8',
  },
  {
    id: 'ecrl', name: 'Extensor carpi radialis longus', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.245, 1.17, -0.014], ['radius', 0.256, 1.03, 0.0], ['hand', 0.258, 0.845, -0.009]], r: 0.012 },
    ],
    ts: 0.05, te: 0.5,
    origin: 'Lateral supracondylar ridge of the humerus', insertion: 'Back of the 2nd metacarpal',
    actions: [
      { name: 'Lift wrist back (thumb side)', from: [['wrist', 'flex', 40]], to: [['wrist', 'flex', -50], ['wrist', 'radDev', 10]] },
    ],
    best: 'Cocking the wrist back — and, importantly, holding the wrist extended during a hard GRIP so the finger flexors can pull efficiently. Backhand strokes.',
    examples: ['Gripping hard', 'Backhand in tennis', 'Revving a motorbike throttle'],
    nerve: 'radial', roots: 'C6–C7',
  },
  {
    id: 'ecu', name: 'Extensor carpi ulnaris', region: 'arm', layer: 1,
    strands: [
      { pts: [['humerus', 0.243, 1.115, -0.036], ['ulna', 0.215, 0.97, -0.032], ['hand', 0.205, 0.845, -0.007]], r: 0.01 },
    ],
    ts: 0.05, te: 0.4,
    origin: 'Lateral epicondyle & back of the ulna', insertion: 'Base of the 5th metacarpal',
    actions: [
      { name: 'Lift wrist back (little-finger side)', from: [], to: [['wrist', 'flex', -40], ['wrist', 'radDev', -22]] },
    ],
    best: 'Extending the wrist while tilting it toward the little finger — e.g. the cocking motion before a golf/tennis stroke, and stabilising the wrist when gripping.',
    examples: ['Golf backswing', 'Wiping a table', 'Tennis serve prep'],
    nerve: 'radialDeep', roots: 'C7–C8',
  },

  // ================================================================ TRUNK & CORE
  {
    id: 'rectusAbd', name: 'Rectus abdominis', region: 'trunk', layer: 1,
    strands: [
      { pts: [['pelvis', 0.02, 0.905, 0.07], ['lumbar', 0.04, 1.08, 0.102], ['thorax', 0.045, 1.25, 0.1]], r: 0.03 },
    ],
    ts: 0.05, te: 0.04, flat: [0, 0, 1], thick: 0.3,
    origin: 'Pubic crest & pubic symphysis', insertion: 'Xiphoid process and rib cartilages 5–7',
    actions: [
      { name: 'Curl the trunk forward (crunch)', from: [['trunk', 'flex', -5]], to: [['trunk', 'flex', 40]] },
    ],
    best: 'Curling the rib cage toward the pelvis — crunches, sit-ups, getting out of bed, hanging leg raises (pulling the pelvis up). Also braces the abdomen when coughing.',
    examples: ['Crunches', 'Sitting up from lying', 'Coughing / sneezing'],
    nerve: 'thoracoabdominal', roots: 'T7–T12',
  },
  {
    id: 'extOblique', name: 'External oblique', region: 'trunk', layer: 1,
    strands: [
      { pts: [['thorax', 0.13, 1.29, 0.066], ['lumbar', 0.06, 1.14, 0.106]], r: 0.028 },
      { pts: [['thorax', 0.148, 1.23, 0.04], ['lumbar', 0.115, 1.1, 0.085], ['pelvis', 0.07, 1.0, 0.095]], r: 0.03 },
      { pts: [['thorax', 0.148, 1.18, 0.0], ['pelvis', 0.137, 1.065, 0.032]], r: 0.025 },
    ],
    ts: 0.04, te: 0.1, flat: [1, 0, 1], thick: 0.3,
    origin: 'Outer surfaces of ribs 5–12', insertion: 'Linea alba, pubic tubercle and front of the iliac crest',
    actions: [
      { name: 'Twist to the opposite side', from: [], to: [['trunk', 'rot', -35], ['trunk', 'flex', 10], ['trunk', 'latflex', 8]] },
      { name: 'Bend to the same side', from: [], to: [['trunk', 'latflex', 25]] },
    ],
    best: 'Twisting the trunk to the OPPOSITE side (right external oblique turns your chest to the left), side-bending, and resisting rotation. Fibres run like hands in your front pockets.',
    examples: ['Throwing', 'Golf / baseball swing', 'Russian twists', 'Forced exhale'],
    nerve: 'thoracoabdominal', roots: 'T7–T12',
  },
  {
    id: 'intOblique', name: 'Internal oblique', region: 'trunk', layer: 2,
    strands: [
      { pts: [['pelvis', 0.13, 1.06, 0.03], ['thorax', 0.12, 1.21, 0.072]], r: 0.024 },
      { pts: [['pelvis', 0.12, 1.03, 0.056], ['lumbar', 0.05, 1.12, 0.096]], r: 0.024 },
      { pts: [['pelvis', 0.137, 1.065, -0.01], ['thorax', 0.142, 1.2, 0.022]], r: 0.022 },
    ],
    ts: 0.05, te: 0.06, flat: [1, 0, 1], thick: 0.3,
    origin: 'Iliac crest, inguinal ligament, thoracolumbar fascia', insertion: 'Lower ribs 10–12 and linea alba',
    actions: [
      { name: 'Twist to the same side', from: [], to: [['trunk', 'rot', 35], ['trunk', 'latflex', 10], ['trunk', 'flex', 8]] },
    ],
    best: 'Twisting the trunk toward the SAME side (it partners the opposite external oblique), side-bending and bracing the core.',
    examples: ['Swinging a bat', 'Twisting to grab a seat belt', 'Bracing to lift'],
    nerve: 'thoracoabdominal', roots: 'T7–L1',
  },
  {
    id: 'transversus', name: 'Transversus abdominis', region: 'trunk', layer: 2,
    strands: [
      { pts: [['lumbar', 0.085, 1.14, -0.055], ['lumbar', 0.135, 1.14, 0.01], ['lumbar', 0.1, 1.14, 0.075], ['lumbar', 0.012, 1.14, 0.094]], r: 0.02 },
      { pts: [['pelvis', 0.09, 1.06, -0.05], ['pelvis', 0.132, 1.07, 0.01], ['pelvis', 0.1, 1.07, 0.07], ['pelvis', 0.012, 1.07, 0.09]], r: 0.02 },
    ],
    ts: 0.25, te: 0.12, flat: [1, 0, 1], thick: 0.3,
    origin: 'Thoracolumbar fascia, iliac crest, inner lower rib cartilages', insertion: 'Linea alba (midline of the belly)',
    actions: [
      { name: 'Brace / draw belly in', from: [], to: [['trunk', 'flex', 6]] },
    ],
    best: 'Drawing the belly in and bracing — it acts like a corset, raising pressure inside the abdomen to stiffen the spine. It moves no joint by itself; it fires just before you lift, cough or push.',
    examples: ['Bracing before a heavy lift', 'Blowing out candles hard', 'Coughing', 'Plank'],
    nerve: 'thoracoabdominal', roots: 'T7–L1',
    note: 'This muscle does not rotate a joint — its pull squeezes the abdomen (watch the arrows point to the midline).',
  },
  {
    id: 'erectorSpinae', name: 'Erector spinae', region: 'trunk', layer: 1,
    strands: [
      { pts: [['pelvis', 0.058, 1.02, -0.086], ['lumbar', 0.055, 1.13, -0.088], ['thorax', 0.06, 1.3, -0.096], ['thorax', 0.055, 1.43, -0.087]], r: 0.016 },
      { pts: [['pelvis', 0.03, 1.0, -0.092], ['lumbar', 0.032, 1.13, -0.094], ['thorax', 0.035, 1.3, -0.102], ['neck', 0.03, 1.52, -0.062]], r: 0.018 },
      { pts: [['lumbar', 0.012, 1.12, -0.088], ['thorax', 0.012, 1.3, -0.1], ['thorax', 0.012, 1.44, -0.09]], r: 0.01 },
    ],
    ts: 0.06, te: 0.06, flat: [0, 0, -1], thick: 0.6,
    origin: 'Sacrum, back of the iliac crest, lumbar spines', insertion: 'Ribs, vertebrae and base of the skull (three columns)',
    actions: [
      { name: 'Straighten up from bending over', from: [['trunk', 'flex', 50]], to: [['trunk', 'flex', -15], ['neck', 'flex', -10]] },
      { name: 'Side-bend (one side)', from: [], to: [['trunk', 'latflex', 22]] },
    ],
    best: 'Straightening the back from a bent-over position and controlling the bend on the way down — deadlifts, picking things up, rowing. Constantly active in small amounts to keep you upright.',
    examples: ['Deadlift', 'Picking up a child', 'Superman exercise'],
    nerve: 'dorsalRami', roots: 'C1–S3 (segmental dorsal rami)',
  },
  {
    id: 'quadratusLumborum', name: 'Quadratus lumborum', region: 'trunk', layer: 2,
    strands: [
      { pts: [['pelvis', 0.075, 1.05, -0.046], ['lumbar', 0.062, 1.12, -0.046], ['thorax', 0.056, 1.2, -0.046]], r: 0.015 },
    ],
    ts: 0.05, te: 0.06, flat: [0, 0, -1], thick: 0.5,
    origin: 'Back of the iliac crest', insertion: '12th rib and lumbar transverse processes',
    actions: [
      { name: 'Side-bend / hike hip', from: [], to: [['trunk', 'latflex', 25]] },
    ],
    best: 'Bending sideways and hiking one hip up, and stopping you tipping when you carry a heavy load in the OPPOSITE hand (suitcase carry).',
    examples: ['Suitcase carry', 'Side plank', 'Hip hike while walking'],
    nerve: 'lumbarVentral', roots: 'T12–L4',
  },

  // ================================================================ HIP & GLUTES
  {
    id: 'iliopsoas', name: 'Iliopsoas (psoas + iliacus)', region: 'hip', layer: 2,
    strands: [
      { pts: [['lumbar', 0.028, 1.15, -0.03], ['pelvis', 0.055, 1.02, -0.008], ['pelvis', 0.076, 0.947, 0.056], ['femur', 0.112, 0.862, 0.004]], r: 0.018 },
      { pts: [['pelvis', 0.11, 1.03, 0.002], ['pelvis', 0.087, 0.952, 0.054], ['femur', 0.115, 0.866, 0.002]], r: 0.02 },
    ],
    ts: 0.04, te: 0.12,
    origin: 'Psoas: T12–L5 vertebrae. Iliacus: inner bowl of the pelvis (iliac fossa)', insertion: 'Lesser trochanter of the femur',
    actions: [
      { name: 'Lift the knee high', from: [], to: [['hip', 'flex', 100], ['knee', 'flex', 90]] },
    ],
    best: 'Lifting the thigh above ~60–90° — high knees, sprinting, climbing high steps, hanging leg raises. The strongest hip flexor.',
    examples: ['High knees', 'Sprinting', 'Climbing stairs two at a time', 'Leg raises'],
    nerve: 'lumbarPlexus', roots: 'L1–L3',
  },
  {
    id: 'gluteusMax', name: 'Gluteus maximus', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.07, 1.05, -0.088], ['pelvis', 0.12, 0.98, -0.1], ['femur', 0.155, 0.85, -0.02]], r: 0.036 },
      { pts: [['pelvis', 0.035, 0.985, -0.1], ['pelvis', 0.1, 0.92, -0.108], ['femur', 0.152, 0.82, -0.024]], r: 0.04 },
      { pts: [['pelvis', 0.02, 0.925, -0.088], ['pelvis', 0.09, 0.872, -0.09], ['femur', 0.15, 0.8, -0.02]], r: 0.032 },
    ],
    ts: 0.04, te: 0.12, flat: [0.35, 0, -1], thick: 0.5,
    origin: 'Back of the ilium, sacrum and coccyx', insertion: 'Gluteal tuberosity of the femur and iliotibial band',
    actions: [
      { name: 'Drive hip forward (stand up / climb)', from: [['hip', 'flex', 95], ['knee', 'flex', 100]], to: [['hip', 'flex', -10], ['knee', 'flex', 0]] },
      { name: 'Kick leg backward', from: [], to: [['hip', 'flex', -30]] },
    ],
    best: 'Extending the hip powerfully from a FLEXED position — standing up from a deep squat, climbing stairs/hills, sprinting, jumping, hip thrusts. Little activity in easy level walking.',
    examples: ['Squats', 'Climbing stairs', 'Sprinting & jumping', 'Hip thrusts'],
    nerve: 'inferiorGluteal', roots: 'L5–S2',
  },
  {
    id: 'gluteusMed', name: 'Gluteus medius', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.136, 1.06, 0.022], ['femur', 0.156, 0.916, 0.002]], r: 0.022 },
      { pts: [['pelvis', 0.125, 1.065, -0.035], ['femur', 0.156, 0.916, -0.006]], r: 0.024 },
      { pts: [['pelvis', 0.095, 1.045, -0.07], ['femur', 0.152, 0.917, -0.014]], r: 0.02 },
    ],
    ts: 0.04, te: 0.15, flat: [1, 0, -0.2], thick: 0.4,
    origin: 'Outer surface of the ilium', insertion: 'Greater trochanter of the femur',
    actions: [
      { name: 'Lift leg sideways', from: [], to: [['hip', 'abd', 35]] },
      { name: 'Rotate thigh inward (front fibres)', from: [], to: [['hip', 'introt', 30]] },
    ],
    best: 'Holding the pelvis level whenever you stand on ONE leg — every step of walking and running — and lifting the leg sideways. Weakness causes the hip to drop on the other side (Trendelenburg sign).',
    examples: ['Walking & running (single-leg stance)', 'Side-lying leg raise', 'Monster walks'],
    nerve: 'superiorGluteal', roots: 'L4–S1',
  },
  {
    id: 'gluteusMin', name: 'Gluteus minimus', region: 'hip', layer: 2,
    strands: [
      { pts: [['pelvis', 0.125, 1.03, 0.02], ['femur', 0.156, 0.92, 0.012]], r: 0.016 },
      { pts: [['pelvis', 0.11, 1.03, -0.03], ['femur', 0.156, 0.92, 0.004]], r: 0.016 },
    ],
    ts: 0.04, te: 0.15,
    origin: 'Outer ilium (beneath gluteus medius)', insertion: 'Front of the greater trochanter',
    actions: [
      { name: 'Lift leg sideways & rotate in', from: [], to: [['hip', 'abd', 30], ['hip', 'introt', 15]] },
    ],
    best: 'Same job as gluteus medius — stabilising the pelvis on one leg and abducting — plus inward rotation of the thigh.',
    examples: ['Single-leg standing', 'Walking'],
    nerve: 'superiorGluteal', roots: 'L4–S1',
  },
  {
    id: 'tfl', name: 'Tensor fasciae latae', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.122, 1.02, 0.06], ['femur', 0.156, 0.9, 0.032], ['femur', 0.16, 0.75, 0.006], ['femur', 0.148, 0.58, 0.002], ['tibia', 0.13, 0.46, 0.016]], r: 0.016 },
    ],
    ts: 0.04, te: 0.72,
    origin: 'Anterior superior iliac spine (front hip point)', insertion: 'Iliotibial (IT) band → outer tibia (Gerdy\'s tubercle)',
    actions: [
      { name: 'Lift leg forward-out, rotate in', from: [], to: [['hip', 'flex', 35], ['hip', 'abd', 20], ['hip', 'introt', 15]] },
    ],
    best: 'Flexing and abducting the hip together and tensing the IT band to stabilise the knee and pelvis — the swing phase of running, stepping sideways.',
    examples: ['Running', 'Side steps', 'Skating'],
    nerve: 'superiorGluteal', roots: 'L4–S1',
  },
  {
    id: 'piriformis', name: 'Piriformis', region: 'hip', layer: 2,
    strands: [
      { pts: [['pelvis', 0.025, 0.96, -0.066], ['pelvis', 0.08, 0.95, -0.062], ['femur', 0.15, 0.926, -0.01]], r: 0.012 },
    ],
    ts: 0.04, te: 0.15,
    origin: 'Front surface of the sacrum', insertion: 'Top of the greater trochanter',
    actions: [
      { name: 'Turn thigh outward', from: [['knee', 'flex', 90], ['hip', 'introt', 20]], to: [['hip', 'introt', -45]] },
    ],
    best: 'Rotating the thigh outward (turning the toes out) with the hip straight; with the hip flexed past 60° it becomes an abductor. The sciatic nerve runs right under it.',
    examples: ['Getting out of a car (swinging legs out)', 'Turning on the spot'],
    nerve: 'piriformis', roots: 'S1–S2',
  },
  {
    id: 'sartorius', wrap: ['femur', 0.08, 0.5, -0.008, 0.032], name: 'Sartorius', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.122, 1.02, 0.066], ['femur', 0.112, 0.85, 0.075], ['femur', 0.08, 0.7, 0.062], ['femur', 0.062, 0.56, 0.002], ['tibia', 0.072, 0.457, -0.016], ['tibia', 0.085, 0.43, 0.025]], r: 0.0105 },
    ],
    ts: 0.04, te: 0.12,
    origin: 'Anterior superior iliac spine', insertion: 'Inner upper tibia (pes anserinus)',
    actions: [
      { name: 'Cross-legged ("figure 4") position', from: [], to: [['hip', 'flex', 65], ['hip', 'abd', 30], ['hip', 'introt', -35], ['knee', 'flex', 90]] },
    ],
    best: 'Putting the foot on the opposite knee / sitting cross-legged — it flexes, abducts and outwardly rotates the hip while bending the knee. Longest muscle in the body.',
    examples: ['Sitting cross-legged', 'Checking the sole of your shoe', 'Kicking a ball with the inside of the foot'],
    nerve: 'femoral', roots: 'L2–L3',
  },
  {
    id: 'adductorLongus', name: 'Adductor longus', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.025, 0.905, 0.056], ['femur', 0.116, 0.72, 0.01]], r: 0.02 },
    ],
    ts: 0.1, te: 0.08, flat: [0, 0, 1], thick: 0.5,
    origin: 'Front of the pubic bone', insertion: 'Middle of the linea aspera (back of the femur)',
    actions: [
      { name: 'Squeeze legs together', from: [['hip', 'abd', 35]], to: [['hip', 'abd', -8], ['hip', 'flex', 12]] },
    ],
    best: 'Pulling the legs together (adduction) — squeezing, kicking across the body, change-of-direction in sports; strained in "groin pulls".',
    examples: ['Side-foot pass in football', 'Horse riding grip', 'Cutting / changing direction'],
    nerve: 'obturator', roots: 'L2–L4',
  },
  {
    id: 'adductorMagnus', name: 'Adductor magnus', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.04, 0.876, -0.02], ['femur', 0.122, 0.72, -0.016]], r: 0.026 },
      { pts: [['pelvis', 0.06, 0.86, -0.036], ['femur', 0.085, 0.66, -0.03], ['femur', 0.078, 0.54, -0.016]], r: 0.022 },
    ],
    ts: 0.06, te: 0.12,
    origin: 'Ischiopubic ramus and ischial tuberosity', insertion: 'Linea aspera and adductor tubercle of the femur',
    actions: [
      { name: 'Pull leg in & back', from: [['hip', 'abd', 40], ['hip', 'flex', 40]], to: [['hip', 'abd', -8], ['hip', 'flex', -10]] },
    ],
    best: 'Adducting the thigh and — its hamstring-like back part — extending the hip from a deep squat. Big contributor when rising from a deep squat or lunge.',
    examples: ['Deep squats', 'Breaststroke kick', 'Sumo deadlift'],
    nerve: 'obturator', roots: 'L2–L4 (+ tibial part of sciatic)',
  },
  {
    id: 'gracilis', wrap: ['femur', 0.08, 0.5, -0.008, 0.03], name: 'Gracilis', region: 'hip', layer: 1,
    strands: [
      { pts: [['pelvis', 0.02, 0.89, 0.045], ['femur', 0.065, 0.72, 0.005], ['femur', 0.062, 0.56, -0.02], ['tibia', 0.068, 0.455, -0.024], ['tibia', 0.083, 0.43, 0.02]], r: 0.0105 },
    ],
    ts: 0.06, te: 0.28,
    origin: 'Lower pubic bone', insertion: 'Inner upper tibia (pes anserinus)',
    actions: [
      { name: 'Squeeze legs & bend knee', from: [['hip', 'abd', 35]], to: [['hip', 'abd', -8], ['knee', 'flex', 35]] },
    ],
    best: 'Adducting the thigh and helping bend the knee — squeezing the knees together, the "whip" of breaststroke kick.',
    examples: ['Breaststroke kick', 'Squeezing a ball between knees'],
    nerve: 'obturator', roots: 'L2–L3',
  },

  // ================================================================ THIGH
  {
    id: 'rectusFemoris', name: 'Rectus femoris (quadriceps)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['pelvis', 0.105, 0.99, 0.056], ['femur', 0.125, 0.85, 0.076], ['femur', 0.112, 0.62, 0.062], ['tibia', 0.1, 0.54, 0.052], ['tibia', 0.1, 0.452, 0.033]], r: 0.022 },
    ],
    ts: 0.1, te: 0.24,
    origin: 'Anterior inferior iliac spine (front of the pelvis)', insertion: 'Patella → tibial tuberosity (via patellar tendon)',
    actions: [
      { name: 'Kick (hip flex + knee straighten)', from: [['hip', 'flex', -15], ['knee', 'flex', 100]], to: [['hip', 'flex', 45], ['knee', 'flex', 0]] },
      { name: 'Straighten the knee', from: [['knee', 'flex', 100]], to: [['knee', 'flex', 0]] },
    ],
    best: 'Kicking a ball — it is the only quad that also crosses the hip, so it works hardest when the hip flexes and the knee straightens at the same time. Also sprinting and jumping.',
    examples: ['Kicking a football', 'Sprinting', 'Leg extensions'],
    nerve: 'femoral', roots: 'L2–L4', reflex: 'Knee-jerk / patellar reflex (L3–L4)',
  },
  {
    id: 'vastusLateralis', name: 'Vastus lateralis (quadriceps)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['femur', 0.152, 0.88, 0.0], ['femur', 0.168, 0.75, 0.03], ['femur', 0.142, 0.6, 0.046], ['tibia', 0.11, 0.54, 0.048], ['tibia', 0.1, 0.452, 0.033]], r: 0.028 },
    ],
    ts: 0.05, te: 0.2, flat: [1, 0, 0.5], thick: 0.6,
    origin: 'Greater trochanter and outer linea aspera of the femur', insertion: 'Patella → tibial tuberosity',
    actions: [
      { name: 'Straighten the knee (rise from squat)', from: [['knee', 'flex', 100], ['hip', 'flex', 90]], to: [['knee', 'flex', 0], ['hip', 'flex', 0]] },
    ],
    best: 'Straightening the knee under load — standing up from a squat or chair, climbing stairs, landing from a jump (it brakes the knee). Largest of the four quadriceps.',
    examples: ['Squats', 'Standing up from a chair', 'Stairs', 'Cycling'],
    nerve: 'femoral', roots: 'L2–L4', reflex: 'Knee-jerk / patellar reflex (L3–L4)',
  },
  {
    id: 'vastusMedialis', name: 'Vastus medialis (quadriceps)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['femur', 0.11, 0.8, 0.03], ['femur', 0.08, 0.64, 0.046], ['femur', 0.082, 0.57, 0.052], ['tibia', 0.09, 0.54, 0.05], ['tibia', 0.1, 0.452, 0.033]], r: 0.025 },
    ],
    ts: 0.05, te: 0.2,
    origin: 'Inner linea aspera of the femur', insertion: 'Patella (inner side) → tibial tuberosity',
    actions: [
      { name: 'Lock the knee straight', from: [['knee', 'flex', 60]], to: [['knee', 'flex', 0]] },
    ],
    best: 'The last part of straightening the knee and keeping the kneecap tracking in its groove — the teardrop above the inner knee. Works in all knee extension.',
    examples: ['Terminal knee extension', 'Squats', 'Step-downs'],
    nerve: 'femoral', roots: 'L2–L4',
  },
  {
    id: 'vastusIntermedius', name: 'Vastus intermedius (quadriceps)', region: 'thigh', layer: 2,
    strands: [
      { pts: [['femur', 0.136, 0.85, 0.03], ['femur', 0.122, 0.68, 0.04], ['tibia', 0.1, 0.545, 0.046], ['tibia', 0.1, 0.452, 0.033]], r: 0.021 },
    ],
    ts: 0.05, te: 0.22,
    origin: 'Front of the femur shaft', insertion: 'Patella → tibial tuberosity',
    actions: [
      { name: 'Straighten the knee', from: [['knee', 'flex', 100]], to: [['knee', 'flex', 0]] },
    ],
    best: 'Straightening the knee — it lies under rectus femoris and works in every squat, jump and stair step.',
    examples: ['Squats', 'Jumping', 'Leg press'],
    nerve: 'femoral', roots: 'L2–L4',
  },
  {
    id: 'bicepsFemoris', wrap: ['femur', 0.115, 0.5, -0.006, 0.03], name: 'Biceps femoris (hamstring)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['pelvis', 0.066, 0.86, -0.042], ['femur', 0.12, 0.7, -0.056], ['femur', 0.136, 0.57, -0.046], ['tibia', 0.137, 0.452, -0.028]], r: 0.021 },
      { pts: [['femur', 0.126, 0.72, -0.02], ['femur', 0.14, 0.58, -0.04], ['tibia', 0.137, 0.452, -0.028]], r: 0.015 },
    ],
    ts: 0.12, te: 0.18,
    origin: 'Long head: ischial tuberosity (sitting bone). Short head: back of the femur', insertion: 'Head of the fibula (outer knee)',
    actions: [
      { name: 'Bend the knee (leg curl)', from: [], to: [['knee', 'flex', 90], ['hip', 'flex', -8]] },
      { name: 'Hip hinge / pull leg back', from: [['hip', 'flex', 70]], to: [['hip', 'flex', -10]] },
    ],
    best: 'Bending the knee and extending the hip — the late swing of sprinting (it brakes the lower leg), leg curls, Nordic curls, deadlifts. Most often torn during sprinting.',
    examples: ['Sprinting', 'Leg curls', 'Romanian deadlift'],
    nerve: 'sciatic', roots: 'L5–S2',
  },
  {
    id: 'semitendinosus', wrap: ['femur', 0.085, 0.5, -0.008, 0.03], name: 'Semitendinosus (hamstring)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['pelvis', 0.06, 0.86, -0.046], ['femur', 0.096, 0.7, -0.062], ['femur', 0.076, 0.56, -0.046], ['tibia', 0.07, 0.455, -0.032], ['tibia', 0.085, 0.43, 0.016]], r: 0.017 },
    ],
    ts: 0.1, te: 0.38,
    origin: 'Ischial tuberosity (sitting bone)', insertion: 'Inner upper tibia (pes anserinus)',
    actions: [
      { name: 'Bend the knee (leg curl)', from: [], to: [['knee', 'flex', 90], ['hip', 'flex', -8]] },
      { name: 'Hip hinge / pull leg back', from: [['hip', 'flex', 70]], to: [['hip', 'flex', -10]] },
    ],
    best: 'Knee flexion and hip extension, plus inward rotation of the bent knee. Like the other hamstrings it is loaded most during fast running and hinging movements.',
    examples: ['Sprinting', 'Nordic curls', 'Good mornings'],
    nerve: 'sciatic', roots: 'L5–S2', reflex: 'Medial hamstring reflex (L5)',
  },
  {
    id: 'semimembranosus', wrap: ['femur', 0.085, 0.5, -0.008, 0.028], name: 'Semimembranosus (hamstring)', region: 'thigh', layer: 1,
    strands: [
      { pts: [['pelvis', 0.068, 0.87, -0.036], ['femur', 0.095, 0.7, -0.042], ['femur', 0.08, 0.57, -0.04], ['tibia', 0.075, 0.462, -0.028]], r: 0.02 },
    ],
    ts: 0.25, te: 0.1,
    origin: 'Ischial tuberosity (sitting bone)', insertion: 'Back of the inner tibial condyle',
    actions: [
      { name: 'Bend the knee (leg curl)', from: [], to: [['knee', 'flex', 90], ['hip', 'flex', -8]] },
      { name: 'Hip hinge / pull leg back', from: [['hip', 'flex', 70]], to: [['hip', 'flex', -10]] },
    ],
    best: 'Knee flexion and hip extension; it is the strongest of the inner hamstrings and helps stabilise the back of the knee.',
    examples: ['Leg curls', 'Deadlifts', 'Sprinting'],
    nerve: 'sciatic', roots: 'L5–S2',
  },

  // ================================================================ LOWER LEG
  {
    id: 'gastrocnemius', name: 'Gastrocnemius (calf)', region: 'leg', layer: 1,
    strands: [
      { pts: [['femur', 0.075, 0.52, -0.026], ['tibia', 0.08, 0.38, -0.062], ['tibia', 0.095, 0.22, -0.046], ['tibia', 0.1, 0.1, -0.04], ['foot', 0.1, 0.04, -0.062]], r: 0.022 },
      { pts: [['femur', 0.125, 0.52, -0.026], ['tibia', 0.12, 0.38, -0.057], ['tibia', 0.105, 0.22, -0.046], ['tibia', 0.1, 0.1, -0.04], ['foot', 0.1, 0.04, -0.062]], r: 0.019 },
    ],
    ts: 0.06, te: 0.46,
    origin: 'Back of the femoral condyles (just above the knee)', insertion: 'Heel bone (calcaneus) via the Achilles tendon',
    actions: [
      { name: 'Rise onto tiptoes (straight knee)', from: [['ankle', 'dorsi', 10]], to: [['ankle', 'dorsi', -40]] },
      { name: 'Help bend the knee', from: [], to: [['knee', 'flex', 60]] },
    ],
    best: 'Pushing the ball of the foot down with the KNEE STRAIGHT — jumping, sprinting push-off, calf raises, standing on tiptoes. Because it crosses the knee, it is weaker when the knee is bent.',
    examples: ['Jumping', 'Sprint push-off', 'Standing calf raises', 'Reaching a top shelf on tiptoes'],
    nerve: 'tibial', roots: 'S1–S2', reflex: 'Ankle-jerk / Achilles reflex (S1)',
  },
  {
    id: 'soleus', name: 'Soleus (calf)', region: 'leg', layer: 1,
    strands: [
      { pts: [['tibia', 0.126, 0.44, -0.036], ['tibia', 0.112, 0.26, -0.052], ['tibia', 0.1, 0.11, -0.043], ['foot', 0.1, 0.04, -0.058]], r: 0.019 },
      { pts: [['tibia', 0.09, 0.4, -0.032], ['tibia', 0.09, 0.26, -0.05], ['tibia', 0.1, 0.11, -0.043], ['foot', 0.1, 0.04, -0.058]], r: 0.017 },
    ],
    ts: 0.06, te: 0.32, flat: [0, 0, -1], thick: 0.6,
    origin: 'Back of the upper tibia and fibula', insertion: 'Heel bone (calcaneus) via the Achilles tendon',
    actions: [
      { name: 'Push foot down (bent knee)', from: [['knee', 'flex', 60], ['ankle', 'dorsi', 15]], to: [['ankle', 'dorsi', -30]] },
    ],
    best: 'Plantarflexing the ankle when the KNEE IS BENT (seated calf raise) and constantly during standing to stop you falling forward. Its contractions pump blood back up the leg — the "second heart".',
    examples: ['Standing still (postural sway)', 'Seated calf raises', 'Walking uphill', 'Long-distance running'],
    nerve: 'tibial', roots: 'S1–S2', reflex: 'Ankle-jerk / Achilles reflex (S1)',
  },
  {
    id: 'tibialisAnterior', name: 'Tibialis anterior', region: 'leg', layer: 1,
    strands: [
      { pts: [['tibia', 0.12, 0.44, 0.02], ['tibia', 0.12, 0.28, 0.036], ['tibia', 0.1, 0.12, 0.036], ['foot', 0.086, 0.07, 0.036], ['foot', 0.08, 0.036, 0.06]], r: 0.016 },
    ],
    ts: 0.05, te: 0.45,
    origin: 'Upper outer surface of the tibia', insertion: 'Medial cuneiform & base of the 1st metatarsal (inner midfoot)',
    actions: [
      { name: 'Pull toes up (dorsiflex)', from: [['ankle', 'dorsi', -25]], to: [['ankle', 'dorsi', 20], ['ankle', 'inv', 10]] },
    ],
    best: 'Lifting the front of the foot — every step it lifts the toes to clear the ground during swing, then lowers the foot gently after heel strike. Weakness causes "foot drop".',
    examples: ['Walking (heel strike)', 'Walking on your heels', 'Tapping your foot'],
    nerve: 'deepFibular', roots: 'L4–L5',
  },
  {
    id: 'tibialisPosterior', name: 'Tibialis posterior', region: 'leg', layer: 2,
    strands: [
      { pts: [['tibia', 0.115, 0.4, -0.022], ['tibia', 0.09, 0.2, -0.026], ['tibia', 0.075, 0.1, -0.026], ['foot', 0.07, 0.055, 0.0], ['foot', 0.076, 0.046, 0.036]], r: 0.014 },
    ],
    ts: 0.05, te: 0.4,
    origin: 'Back of the tibia, fibula and interosseous membrane', insertion: 'Navicular and other midfoot bones (sole)',
    actions: [
      { name: 'Turn sole inward (invert)', from: [], to: [['ankle', 'inv', 25], ['ankle', 'dorsi', -15]] },
    ],
    best: 'Inverting the foot and holding up the arch while you push off — walking, running, standing on tiptoes. Failure of this tendon leads to adult flat foot.',
    examples: ['Push-off in walking', 'Balancing on one foot', 'Running on uneven ground'],
    nerve: 'tibial', roots: 'L4–L5',
  },
  {
    id: 'fibularisLongus', name: 'Fibularis (peroneus) longus', region: 'leg', layer: 1,
    strands: [
      { pts: [['tibia', 0.142, 0.44, -0.016], ['tibia', 0.142, 0.25, -0.016], ['tibia', 0.131, 0.09, -0.03], ['foot', 0.136, 0.035, 0.0], ['foot', 0.09, 0.025, 0.06]], r: 0.014 },
    ],
    ts: 0.05, te: 0.5,
    origin: 'Head and upper outer fibula', insertion: 'Base of the 1st metatarsal (crosses under the sole)',
    actions: [
      { name: 'Turn sole outward (evert)', from: [], to: [['ankle', 'inv', -22], ['ankle', 'dorsi', -15]] },
    ],
    best: 'Turning the sole outward and pushing the big-toe side down — it catches you when you start to roll an ankle, and supports the arch. Busy on uneven ground and in cutting sports.',
    examples: ['Walking on uneven ground', 'Recovering from a near ankle sprain', 'Skating push-off'],
    nerve: 'superficialFibular', roots: 'L5–S1',
  },
  {
    id: 'edl', name: 'Extensor digitorum longus', region: 'leg', layer: 1,
    strands: [
      { pts: [['tibia', 0.134, 0.44, 0.01], ['tibia', 0.133, 0.25, 0.03], ['tibia', 0.116, 0.1, 0.04], ['foot', 0.12, 0.05, 0.08], ['toes', 0.12, 0.024, 0.15]], r: 0.012 },
    ],
    ts: 0.05, te: 0.5,
    origin: 'Lateral tibial condyle and front of the fibula', insertion: 'Top of the 4 lesser toes',
    actions: [
      { name: 'Lift toes & foot', from: [], to: [['toes', 'ext', 40], ['ankle', 'dorsi', 15]] },
    ],
    best: 'Lifting the toes (and the foot) — toe clearance during walking, wiggling the toes up.',
    examples: ['Walking swing phase', 'Lifting toes off the floor'],
    nerve: 'deepFibular', roots: 'L5–S1',
  },
];
