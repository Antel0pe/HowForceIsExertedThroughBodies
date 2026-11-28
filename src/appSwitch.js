// The switcher in the top right of every page: pick the animal (and, for the human, which view).
// Each page says which one it is with <body data-page="…">.
const PAGES = [
  { group: 'Human', id: 'explorer', href: './', name: 'Muscle explorer', sub: 'Click any muscle to see it pull' },
  { group: 'Human', id: 'squat', href: './squat.html', name: 'Squat lab', sub: 'Good form and three common faults' },
  { group: 'Bear', id: 'bear', href: './bear.html', name: 'Grizzly', sub: 'Gallop, or one muscle at a time' },
];

const right = document.getElementById('right');
if (right) {
  const here = PAGES.find((p) => p.id === document.body.dataset.page) || PAGES[0];
  const bar = document.createElement('div');
  bar.id = 'appbar';
  let lastGroup = '';
  const items = PAGES.map((p) => {
    const head = p.group !== lastGroup ? `<div class="grp">${p.group}</div>` : '';
    lastGroup = p.group;
    return `${head}<a role="menuitem" href="${p.href}" class="${p === here ? 'on' : ''}"><b>${p.name}</b><span>${p.sub}</span></a>`;
  }).join('');
  bar.innerHTML = `
    <button type="button" aria-haspopup="menu" aria-expanded="false" title="Switch between the human and the bear">
      <i class="ic ic-${here.group.toLowerCase()}"></i><b>${here.group}</b><span>${here.name}</span><i class="caret"></i>
    </button>
    <div class="menu" role="menu" hidden>${items}</div>`;
  right.prepend(bar);

  const btn = bar.querySelector('button'), menu = bar.querySelector('.menu');
  const setOpen = (open) => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); btn.blur(); });
  document.addEventListener('pointerdown', (e) => { if (!bar.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
}
