# How Force Is Exerted Through Bodies: Muscle Force Explorer

An interactive 3D anatomy viewer (skin off, muscles on a skeleton) that shows **how each muscle pulls**,
**which movement activates it most**, and **how the contraction is triggered** by the nervous system.

Requires [Bun](https://bun.sh).

```
bun install         # installs three.js
bun run dev         # http://localhost:5173 with hot reload
bun run build       # static site in dist/ (open with any static host)
```

`server.ts` uses `Bun.serve` with an HTML import. Bun bundles `index.html`, the JS and the CSS on the fly,
so everything works offline. There is no CDN.

## What you can do

- **Click any muscle.** Small muscles are easy to hit: if the cursor isn't exactly on one, the nearest
  visible muscle within about 24 px gets picked. Hovering shows the muscle's name before you click.
- The selected muscle **plays its strongest movement**: a nerve signal travels from the brain, down the
  spinal cord and along the named nerve. Then the muscle fires, shortens and bulges, and the joint moves.
- **Yellow arrows** show the pull at both ends (equal and opposite, along the line of action).
  The **cyan line** is the joint's rotation axis, and the dashed line is the **moment arm**, which updates live.
- **Orange** muscles also shorten during the movement (helpers). **Blue** muscles get stretched (opponents).
  The model works these out from geometry.
- Each muscle has several movements to try, plus "most activated when…" notes, everyday examples,
  origin and insertion, nerve and spinal roots, and reflex tests.
- Toggle the superficial/deep layers, skeleton, fade, force and nerve overlays. You can also scrub or
  pause the contraction.

### Squat Lab (`/squat.html`)

- Plays a full bodyweight squat: brace → descent → bottom → drive up → lockout. The step list follows along.
- Only muscles working **above the light-up level** glow (35% by default, adjustable); the rest are dimmed.
  The bars on the right show every muscle group's simulated activation and whether it is shortening,
  lengthening or holding. That last part is computed from the model's muscle lengths.
- The torso lean is solved each frame so the centre of mass stays over mid-foot (the yellow plumb line).
- **Joint loads:** dashed lever arms and ring gauges at the knee, hip and lower back show the load each joint carries
  (weight above × lever arm). In a fault, a white tick marks the proper-form load and the label shows the ratio.
- **Proper-form ghost:** a faint cyan skeleton does the same rep with good form, so you can see where the fault departs.
- **Knees cave in:** a vertical floor-push arrow per foot. A knee inside it gets a red twist arc and a strained MCL,
  plus a tug of war between the adductors and glute medius. **Butt wink** is not scripted: this lifter's hip
  reaches its 125° limit, so the pelvis has to tuck and the lower-back disc turns red.
- There are three common faults to compare: **hips shoot up** (the back takes over), **knees cave in** (valgus),
  and **butt wink**. Amber muscles work harder than in proper form and blue ones work less. Each fault
  has a card covering why it happens, why it matters and how to fix it.

## How it works

| File | Purpose |
| --- | --- |
| `src/skeleton.js` | Bone hierarchy, joint degrees of freedom (flexion, abduction, rotation…), simple bone meshes |
| `src/muscles.js` | Muscle library: attachment paths, wrap surfaces, movements, activation notes, innervation |
| `src/nerves.js` | Simplified nerve routes used for the trigger animation |
| `src/muscleMesh.js` | A muscle strand: a tube that follows its attachment points and bulges as it shortens |
| `src/viewer.js` | Shared stage (renderer, camera, lights), body (skeleton + muscles) and muscle picker |
| `src/main.js` | Muscle Explorer page: playback, force and moment-arm overlays, UI |
| `src/squatModel.js` | Squat rep timeline, joint angles, simulated activation, fault definitions |
| `src/squat.js` | Squat Lab page: balance solver, alignment/balance overlays, activation bars |
| `server.ts` | Bun dev/production server (bundles `index.html` and `squat.html`) |

The moment arm shown is the *effective* one: how much the muscle shortens per radian of joint rotation.
This is the same quantity biomechanics models use (torque = muscle force × moment arm).

This is a teaching model with simplified geometry. It is not a medical reference.
