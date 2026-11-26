// Zoomed-in side view of the lower back, drawn like a magnified picture of that spot on the body
// (belly side to the right, back to the left – the same way round as the side view of the model):
// vertebrae with their bony spikes pointing back, discs between them, the ligament running down the
// back of the spine, the thick back-muscle band behind it, and the skin line.
//  - Back held straight: discs squeezed evenly, muscle band thick and red-hot (working), ligament slack.
//  - Back rounding: discs pinch at the front and bulge out the back, the muscle band thins and fades
//    (losing), the ligament is pulled tight and turns red.
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], Math.max(0, Math.min(1, k))))).join(',')})`;
};

export function createSpineInset(container) {
  const S = 220, C = S / 2;
  container.innerHTML = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
      <defs>
        <clipPath id="zoomClip"><circle cx="${C}" cy="${C}" r="${C - 3}"/></clipPath>
        <radialGradient id="zoomBg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2a1f22"/><stop offset="1" stop-color="#14181e"/></radialGradient>
      </defs>
      <g clip-path="url(#zoomClip)"><rect width="${S}" height="${S}" fill="url(#zoomBg)"/><g class="art"></g></g>
      <circle cx="${C}" cy="${C}" r="${C - 3}" fill="none" stroke="#c9d0d8" stroke-width="3"/>
    </svg><div class="cap">zoom: lower back</div>`;
  const art = container.querySelector('.art');

  function update({ flex, effort, pulse = 0 }) {
    const f = Math.max(0, Math.min(1, flex / 22)); // 0 straight … 1 fully rounded
    const dθ = ((flex * 1.5) / 3) * (Math.PI / 180); // exaggerated a little so it reads at this size
    const w = 50, hv = 30, d0 = 11;
    const R = (θ, x, y) => [x * Math.cos(θ) - y * Math.sin(θ), x * Math.sin(θ) + y * Math.cos(θ)];
    const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
    const P = (a) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

    // Build the chain of vertebrae from the bottom up; each disc lets the next one tilt forward.
    let o = [C + 18, S - 18], θ = 0;
    const verts = [], discs = [], backEdge = [];
    for (let i = 0; i < 4; i++) {
      const c = (x, y) => add(o, R(θ, x, y));
      verts.push({ body: [c(-w / 2, 0), c(w / 2, 0), c(w / 2, -hv), c(-w / 2, -hv)],
        spike: [c(-w / 2, -6), c(-w / 2 - 20, -10), c(-w / 2 - 22, -18), c(-w / 2, -hv + 4)], θ });
      backEdge.push({ p: c(-w / 2, 0), θ }, { p: c(-w / 2, -hv), θ });
      if (i === 3) break;
      const dc = add(o, R(θ, 0, -hv - d0 / 2));
      const θn = θ + dθ;
      const on = add(dc, R(θn, 0, -d0 / 2));
      discs.push({ pts: [c(-w / 2, -hv), c(w / 2, -hv), add(on, R(θn, w / 2, 0)), add(on, R(θn, -w / 2, 0))],
        back: add(dc, R(θ + dθ / 2, -w / 2, 0)), θ: θ + dθ / 2 });
      o = on;
      θ = θn;
    }
    const back = (pt, d) => [pt.p[0] - d * Math.cos(pt.θ), pt.p[1] - d * Math.sin(pt.θ)];
    // Muscle band behind the spikes: thick and hot when working, thinner and pale when it is losing.
    const mIn = 26, mThick = lerp(30, 20, f) * (0.75 + 0.25 * effort);
    const inner = backEdge.map((pt) => back(pt, mIn)), outer = backEdge.map((pt) => back(pt, mIn + mThick));
    const muscleCol = mix('#6a4a4a', '#ff5a3c', (effort - 0.2) / 0.7);
    const skin = backEdge.map((pt) => back(pt, mIn + mThick + 9));
    // Extend the bands past the ends so they leave the circle like a real cut-away.
    const ext = (arr, d0, d1) => {
      const a = arr[0], b = arr[arr.length - 1], a2 = arr[1], b2 = arr[arr.length - 2];
      return [[a[0] + (a[0] - a2[0]) * d0, a[1] + (a[1] - a2[1]) * d0], ...arr, [b[0] + (b[0] - b2[0]) * d1, b[1] + (b[1] - b2[1]) * d1]];
    };
    const inE = ext(inner, 3, 4), outE = ext(outer, 3, 4), skinE = ext(skin, 3, 4);
    const lig = backEdge.map((pt) => back(pt, 3));
    const tight = Math.max(0, Math.min(1, (f - 0.3) / 0.5));
    // Once the spine is really rounded, the discs and ligament are what is straining: they throb.
    const throb = Math.max(0, Math.min(1, (f - 0.4) / 0.4)) * pulse;
    const ligCol = throb > 0.01 ? mix('#ff4d4d', '#ff1010', throb) : mix('#9aa4b1', '#ff4d4d', tight);
    const discCol = throb > 0.01 ? mix('#ff6b6b', '#ff1a1a', throb) : mix('#86b8ff', '#ff6b6b', (f - 0.35) / 0.55);
    const top = verts[3].body, tm = [(top[2][0] + top[3][0]) / 2, (top[2][1] + top[3][1]) / 2];

    art.innerHTML = `
      <polyline points="${P(skinE)}" fill="none" stroke="#d9b7a0" stroke-width="3" opacity="0.7"/>
      <polygon points="${P([...inE, ...outE.slice().reverse()])}" fill="${muscleCol}" opacity="0.92"/>
      ${[0.33, 0.66].map((t) => `<polyline points="${P(inE.map((p, i) => [lerp(p[0], outE[i][0], t), lerp(p[1], outE[i][1], t)]))}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="1.2"/>`).join('')}
      ${verts.map((v) => `<polygon points="${P(v.spike)}" fill="#e3d6be" stroke="#a99c86" stroke-width="1"/>`).join('')}
      <polyline points="${P(lig)}" fill="none" stroke="${ligCol}" stroke-width="${(2 + 2 * tight + 2 * throb).toFixed(1)}" ${tight < 0.3 ? 'stroke-dasharray="5 3"' : ''}/>
      ${discs.map((d) => `<polygon points="${P(d.pts)}" fill="${discCol}"/>`).join('')}
      ${f > 0.4 ? discs.map((d) => `<ellipse cx="${(d.back[0] - 1 - 5 * f).toFixed(1)}" cy="${d.back[1].toFixed(1)}" rx="${(1 + 6 * (f - 0.4) + 2 * throb).toFixed(1)}" ry="${(2 + 3 * (f - 0.4) + 1.5 * throb).toFixed(1)}" fill="#ff4d4d" transform="rotate(${((d.θ * 180) / Math.PI).toFixed(1)} ${d.back[0].toFixed(1)} ${d.back[1].toFixed(1)})"/>`).join('') : ''}
      ${verts.map((v) => `<polygon points="${P(v.body)}" fill="#efe3cb" stroke="#b3a68f" stroke-width="1.2" stroke-linejoin="round"/>`).join('')}
      <line x1="${tm[0]}" y1="${tm[1] - 30}" x2="${tm[0]}" y2="${tm[1] - 8}" stroke="#ffd23f" stroke-width="3"/>
      <polygon points="${tm[0] - 6},${tm[1] - 10} ${tm[0] + 6},${tm[1] - 10} ${tm[0]},${tm[1] - 2}" fill="#ffd23f"/>
      <text x="${tm[0] + 9}" y="${tm[1] - 18}" class="t" fill="#ffd23f">weight</text>
      <text x="${outer[2][0] - 2}" y="${outer[2][1] + 18}" class="t" fill="${muscleCol}" text-anchor="end">muscle</text>
      <text x="${verts[1].body[1][0] + 5}" y="${verts[1].body[1][1] - 12}" class="t" fill="${discCol}">disc</text>
      <text x="${lig[5][0] - 4}" y="${lig[5][1] - 4}" class="t" fill="${ligCol}" text-anchor="end">ligament</text>
    `;
  }
  update({ flex: 0, effort: 0.3 });
  return { update };
}
