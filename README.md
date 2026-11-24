# How Force Is Exerted Through Bodies: Muscle Force Explorer

An interactive 3D anatomy viewer (skin off, muscles on a skeleton) that shows **how each muscle pulls**,
**which movement activates it most**, and **how the contraction is triggered** by the nervous system.

```
node server.js      # then open http://localhost:5173
```

No build step and no npm install. Three.js is loaded from a CDN, so you need an internet connection.

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

## How it works

| File | Purpose |
| --- | --- |
| `src/skeleton.js` | Bone hierarchy, joint degrees of freedom (flexion, abduction, rotation…), simple bone meshes |
| `src/muscles.js` | Muscle library: attachment paths, wrap surfaces, movements, activation notes, innervation |
| `src/nerves.js` | Simplified nerve routes used for the trigger animation |
| `src/muscleMesh.js` | A muscle strand: a tube that follows its attachment points and bulges as it shortens |
| `src/main.js` | Scene, playback, picking, force and moment-arm overlays, UI |

The moment arm shown is the *effective* one: how much the muscle shortens per radian of joint rotation.
This is the same quantity biomechanics models use (torque = muscle force × moment arm).

This is a teaching model with simplified geometry. It is not a medical reference.
