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

- **Proper form** plays a full bodyweight rep with one short caption per phase. Only muscles working above the
  glow level light up, and the glow fades smoothly instead of blinking. The torso lean is solved so the centre of
  mass stays over the feet.
- **Each fault plays as a slow story** in three numbered beats, with pauses on the moments that matter and one
  label at a time:
  - **Hips shoot up:** the thighs burn (shaking, strength bar draining) → the legs straighten first → bent over,
    and the back holds it all → the back muscles give way, the spine rounds, and you stand up on the discs and ligaments.
  - **Knees cave in:** the side glutes tire → the knees fall inward → the knee twists and the inner ligament is stretched.
  - **Butt wink:** the hip runs out of room → the pelvis tucks under to go lower → the lower back rounds.
- A **lower-back close-up** (hips-up and butt wink) shows the vertebrae, discs, ligament and back muscle. A straight
  spine squeezes the discs evenly; a rounded one pinches them at the front and pushes them out the back.
- Optional overlays: joint loads, hip–knee–ankle lines, balance line.

## How it works

| File | Purpose |
| --- | --- |
| `src/skeleton.js` | Bone hierarchy, joint degrees of freedom (flexion, abduction, rotation…), simple bone meshes |
| `src/muscles.js` | Muscle library: attachment paths, wrap surfaces, movements, activation notes, innervation |
| `src/nerves.js` | Simplified nerve routes used for the trigger animation |
| `src/muscleMesh.js` | A muscle strand: a tube that follows its attachment points and bulges as it shortens |
| `src/viewer.js` | Shared stage (renderer, camera, lights), body (skeleton + muscles) and muscle picker |
| `src/main.js` | Muscle Explorer page: playback, force and moment-arm overlays, UI |
| `src/squatModel.js` | Squat rep timeline, joint angles, simulated activation, faults and their paced stories |
| `src/squat.js` | Squat Lab page: balance solver, story playback, one-label policy, activation bars |
| `src/squatViz.js` | Body mechanics (centre of mass, joint loads) and the knee / hip fault visuals |
| `src/spineInset.js` | Lower-back close-up: vertebrae, discs, ligament and back muscle |
| `server.ts` | Bun dev/production server (bundles `index.html` and `squat.html`) |

The moment arm shown is the *effective* one: how much the muscle shortens per radian of joint rotation.
This is the same quantity biomechanics models use (torque = muscle force × moment arm).

This is a teaching model with simplified geometry. It is not a medical reference.
