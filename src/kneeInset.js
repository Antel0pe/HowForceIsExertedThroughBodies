// Zoomed-in front view of the right knee (as seen from the front camera: outer side on the left,
// inner side toward the body's midline on the right). Thigh bone on top, shin bone below, the
// cartilage pads between them, and the ligaments on each side.
//  - It follows the real leg: seen from the front, a bent thigh points at you, so its shaft looks short and
//    grows to full length as you stand up.
//  - Knee tracking over the foot: the joint closes evenly, the inner ligament is slack.
//  - Knee caving in: the bones tilt like a knock-knee, the joint gaps open on the inner side, and the
//    inner ligament (MCL) is pulled long and thin, turning red and throbbing.
const lerp = (a, b, k) => a + (b - a) * k;
const mix = (c1, c2, k) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const a = p(c1), b = p(c2);
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], Math.max(0, Math.min(1, k))))).join(',')})`;
};

export function createKneeInset(container) {
  const S = 220, C = S / 2;
  container.innerHTML = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
      <defs>
        <clipPath id="kneeClip"><circle cx="${C}" cy="${C}" r="${C - 3}"/></clipPath>
        <radialGradient id="kneeBg" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2a1f22"/><stop offset="1" stop-color="#14181e"/></radialGradient>
      </defs>
      <g clip-path="url(#kneeClip)"><rect width="${S}" height="${S}" fill="url(#kneeBg)"/><g transform="translate(${C} ${C + 6}) scale(0.78) translate(${-C} ${-C})"><g class="art"></g></g></g>
      <circle cx="${C}" cy="${C}" r="${C - 3}" fill="none" stroke="#c9d0d8" stroke-width="3"/>
    </svg><div class="cap">zoom: knee (front)</div>`;
  const art = container.querySelector('.art');

  function update({ strain = 0, pulse = 0, thighUp = 1 }) {
    const f = Math.max(0, Math.min(1, strain));
    const θ = ((1.5 + 7 * f) * Math.PI) / 180; // tilt of each bone (exaggerated a little to read at this size)
    const piv = [C - 30, C + 2]; // outer contact point: the bones hinge open around it
    const rot = (p, a) => {
      const x = p[0] - piv[0], y = p[1] - piv[1];
      return [piv[0] + x * Math.cos(a) - y * Math.sin(a), piv[1] + x * Math.sin(a) + y * Math.cos(a)];
    };
    const fem = (p) => rot(p, -θ), tib = (p) => rot(p, θ);
    const P = (a) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const path = (pts, fn) => P(pts.map(fn));

    // Thigh bone: shaft widening into two rounded knuckles (outer + inner). The shaft is foreshortened
    // by how upright the thigh is (r = 1 standing, short when the thigh points forward at the bottom).
    const r = 0.14 + 0.86 * Math.max(0, Math.min(1, thighUp));
    const sy = (y) => 82 - (82 - y) * r;
    const top = sy(-20);
    const femur = [[C - 16, top], [C + 16, top], [C + 18, sy(60)], [C + 40, 82], [C + 42, C - 6], [C + 30, C], [C + 8, C - 4], [C, C - 9],
      [C - 8, C - 4], [C - 30, C], [C - 42, C - 6], [C - 40, 82], [C - 18, sy(60)]];
    // End of the shaft when it points toward you: an oval cut of the bone.
    const ry = 15 * (1 - r) * 0.8;
    const shaftEnd = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [C + 16 * Math.cos(a), top + ry * Math.sin(a)]; });
    // Shin bone: flat top, narrowing into the shaft; small fibula on the outer side.
    const tibia = [[C - 40, C + 6], [C + 42, C + 6], [C + 38, C + 26], [C + 18, C + 44], [C + 16, S + 20], [C - 16, S + 20], [C - 18, C + 44], [C - 36, C + 26]];
    const fibula = [[C - 50, C + 32], [C - 40, C + 30], [C - 40, S + 20], [C - 48, S + 20]];
    // Cartilage pads (menisci) sit on the shin.
    const padOut = [[C - 40, C + 6], [C - 10, C + 6], [C - 14, C + 1], [C - 38, C + 1]];
    const padIn = [[C + 10, C + 6], [C + 42, C + 6], [C + 40, C + 1], [C + 14, C + 1]];

    // Ligaments: outer one stays as it is; inner one (MCL) runs from the inner thigh knuckle to the shin.
    const mclTop = fem([C + 44, C - 30]), mclBot = tib([C + 40, C + 40]);
    const lclTop = fem([C - 44, C - 30]), lclBot = tib([C - 46, C + 34]);
    const throb = f > 0.4 ? pulse * (f - 0.4) / 0.6 : 0;
    const mclCol = throb > 0.01 ? mix('#ff4d4d', '#ff1010', throb) : mix('#9aa4b1', '#ff4d4d', (f - 0.15) / 0.5);
    const mclW = lerp(9, 4.5, f) + 2 * throb; // a stretched band gets thinner
    const padInCol = '#86b8ff', padOutCol = mix('#86b8ff', '#ff7b6b', f);

    art.innerHTML = `
      <polygon points="${path(tibia, tib)}" fill="#efe3cb" stroke="#b3a68f" stroke-width="1.2"/>
      <polygon points="${path(fibula, tib)}" fill="#e3d6be" stroke="#a99c86" stroke-width="1"/>
      <polygon points="${path(padOut, tib)}" fill="${padOutCol}"/>
      <polygon points="${path(padIn, tib)}" fill="${padInCol}"/>
      <polygon points="${path(femur, fem)}" fill="#efe3cb" stroke="#b3a68f" stroke-width="1.2" stroke-linejoin="round"/>
      ${ry > 1 ? `<polygon points="${path(shaftEnd, fem)}" fill="#d9cbb0" stroke="#b3a68f" stroke-width="1.2"/>` : ""}
      <line x1="${lclTop[0]}" y1="${lclTop[1]}" x2="${lclBot[0]}" y2="${lclBot[1]}" stroke="#9aa4b1" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
      <line x1="${mclTop[0]}" y1="${mclTop[1]}" x2="${mclBot[0]}" y2="${mclBot[1]}" stroke="${mclCol}" stroke-width="${mclW.toFixed(1)}" stroke-linecap="round"/>
      <text x="${S - 24}" y="${C - 56}" class="t" text-anchor="end" fill="${mclCol}">inner ligament ↓</text>
    `;
  }
  update({ strain: 0 });
  return { update };
}
