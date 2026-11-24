// Simplified peripheral nerve routes used to animate the "trigger" signal.
// Each path point is [bone, lateralX, y, z] in rest-pose world coordinates (x mirrored per side).
// The signal starts in the brain, descends the spinal cord to the level of the first path point,
// follows the path, and ends at the muscle belly.

export const BRAIN = ['head', 0, 1.715, 0.0];
export const BRAINSTEM = ['head', 0, 1.625, -0.03];
export const CORD = [
  ['neck', 0, 1.56, -0.055], ['neck', 0, 1.5, -0.06], ['thorax', 0, 1.42, -0.07], ['thorax', 0, 1.3, -0.075],
  ['thorax', 0, 1.22, -0.065], ['lumbar', 0, 1.12, -0.05], ['pelvis', 0, 1.03, -0.055], ['pelvis', 0, 0.97, -0.07],
];

const BP = [['neck', 0.03, 1.5, -0.045], ['clavicle', 0.08, 1.445, 0.03], ['scapula', 0.14, 1.41, 0.02]];
const SCIATIC = [['pelvis', 0.02, 0.97, -0.07], ['pelvis', 0.08, 0.93, -0.08], ['femur', 0.105, 0.8, -0.045]];
const RADIAL = [...BP, ['humerus', 0.195, 1.32, -0.03], ['humerus', 0.226, 1.22, -0.035], ['humerus', 0.24, 1.15, 0.0]];

export const NERVES = {
  musculocutaneous: { name: 'Musculocutaneous nerve', via: 'brachial plexus, lateral cord', path: [...BP, ['humerus', 0.19, 1.33, 0.025]] },
  axillary: { name: 'Axillary nerve', via: 'brachial plexus, posterior cord', path: [...BP, ['humerus', 0.185, 1.37, -0.035]] },
  radial: { name: 'Radial nerve', via: 'brachial plexus, posterior cord', path: RADIAL },
  radialDeep: { name: 'Radial nerve (deep branch / posterior interosseous)', via: 'brachial plexus, posterior cord', path: [...RADIAL, ['radius', 0.245, 1.06, -0.02]] },
  median: { name: 'Median nerve', via: 'brachial plexus, lateral + medial cords', path: [...BP, ['humerus', 0.19, 1.28, 0.015], ['humerus', 0.2, 1.15, 0.005], ['ulna', 0.215, 1.07, 0.015]] },
  ulnar: { name: 'Ulnar nerve', via: 'brachial plexus, medial cord', path: [...BP, ['humerus', 0.185, 1.28, -0.01], ['humerus', 0.185, 1.14, -0.04], ['ulna', 0.2, 1.04, -0.015]] },
  suprascapular: { name: 'Suprascapular nerve', via: 'brachial plexus, upper trunk', path: [['neck', 0.03, 1.5, -0.045], ['clavicle', 0.08, 1.45, 0.0], ['scapula', 0.12, 1.465, -0.07]] },
  dorsalScapular: { name: 'Dorsal scapular nerve', via: 'C5 root directly', path: [['neck', 0.03, 1.505, -0.05], ['neck', 0.06, 1.49, -0.07]] },
  longThoracic: { name: 'Long thoracic nerve', via: 'C5–C7 roots directly', path: [['neck', 0.03, 1.495, -0.045], ['thorax', 0.11, 1.42, -0.01], ['thorax', 0.152, 1.32, 0.0]] },
  thoracodorsal: { name: 'Thoracodorsal nerve', via: 'brachial plexus, posterior cord', path: [...BP, ['scapula', 0.14, 1.36, -0.05]] },
  pectoral: { name: 'Medial & lateral pectoral nerves', via: 'brachial plexus', path: [BP[0], BP[1], ['thorax', 0.12, 1.4, 0.065]] },
  subscapular: { name: 'Upper & lower subscapular nerves', via: 'brachial plexus, posterior cord', path: [...BP, ['scapula', 0.13, 1.38, -0.055]] },
  accessory: { name: 'Spinal accessory nerve (cranial nerve XI)', via: 'brainstem / upper cervical cord', cranial: true, path: [['head', 0.03, 1.595, -0.04], ['neck', 0.06, 1.53, -0.04]] },
  trigeminal: { name: 'Trigeminal nerve, mandibular branch (cranial nerve V3)', via: 'pons (brainstem)', cranial: true, path: [['head', 0.03, 1.635, 0.0], ['head', 0.05, 1.615, 0.02]] },
  cervicalDorsal: { name: 'Dorsal rami of cervical spinal nerves', via: 'spinal nerves directly', path: [['neck', 0.015, 1.54, -0.07]] },
  thoracoabdominal: { name: 'Thoracoabdominal (lower intercostal) nerves', via: 'T7–T12 spinal nerves', path: [['thorax', 0.02, 1.22, -0.07], ['thorax', 0.14, 1.21, -0.02], ['lumbar', 0.12, 1.14, 0.06]] },
  dorsalRami: { name: 'Dorsal rami of spinal nerves', via: 'every spinal level along the back', path: [['lumbar', 0.02, 1.12, -0.075]] },
  lumbarVentral: { name: 'Ventral rami T12–L4', via: 'lumbar plexus', path: [['lumbar', 0.025, 1.11, -0.05]] },
  lumbarPlexus: { name: 'Lumbar plexus branches (L1–L3) & femoral nerve', via: 'lumbar plexus', path: [['lumbar', 0.03, 1.1, -0.045], ['pelvis', 0.06, 1.02, -0.01]] },
  femoral: { name: 'Femoral nerve', via: 'lumbar plexus', path: [['lumbar', 0.03, 1.09, -0.045], ['pelvis', 0.07, 0.99, 0.02], ['pelvis', 0.085, 0.945, 0.065], ['femur', 0.1, 0.87, 0.06]] },
  obturator: { name: 'Obturator nerve', via: 'lumbar plexus', path: [['lumbar', 0.03, 1.09, -0.045], ['pelvis', 0.05, 0.96, 0.0], ['pelvis', 0.05, 0.915, 0.04], ['femur', 0.07, 0.85, 0.02]] },
  superiorGluteal: { name: 'Superior gluteal nerve', via: 'sacral plexus', path: [['pelvis', 0.02, 0.99, -0.065], ['pelvis', 0.08, 0.98, -0.075]] },
  inferiorGluteal: { name: 'Inferior gluteal nerve', via: 'sacral plexus', path: [['pelvis', 0.02, 0.97, -0.07], ['pelvis', 0.07, 0.94, -0.085]] },
  piriformis: { name: 'Nerve to piriformis', via: 'sacral plexus', path: [['pelvis', 0.02, 0.965, -0.07], ['pelvis', 0.05, 0.955, -0.07]] },
  sciatic: { name: 'Sciatic nerve (tibial division)', via: 'sacral plexus', path: SCIATIC },
  tibial: { name: 'Tibial nerve', via: 'sciatic nerve', path: [...SCIATIC, ['femur', 0.1, 0.58, -0.045], ['tibia', 0.1, 0.44, -0.05]] },
  deepFibular: { name: 'Deep fibular (peroneal) nerve', via: 'sciatic → common fibular nerve', path: [...SCIATIC, ['femur', 0.12, 0.58, -0.045], ['tibia', 0.145, 0.46, -0.03], ['tibia', 0.125, 0.4, 0.02]] },
  superficialFibular: { name: 'Superficial fibular (peroneal) nerve', via: 'sciatic → common fibular nerve', path: [...SCIATIC, ['femur', 0.12, 0.58, -0.045], ['tibia', 0.145, 0.46, -0.03], ['tibia', 0.145, 0.38, -0.01]] },
};
