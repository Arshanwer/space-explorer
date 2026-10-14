import { BODY, BELT, DOCK } from '../data/bodies.js';

const $ = (s) => document.querySelector(s);

// ---------- Read aloud ----------
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  const pref = ['en-NZ', 'en-AU', 'en-GB', 'en-US'];
  for (const p of pref) {
    const v = vs.find((x) => x.lang === p && /Karen|Catherine|Kate|Serena|Samantha|Daniel|Female|Natural|Enhanced|Premium/i.test(x.name)) || vs.find((x) => x.lang === p);
    if (v) return v;
  }
  return vs[0] || null;
}
if ('speechSynthesis' in window) { speechSynthesis.onvoiceschanged = () => (voice = pickVoice()); voice = pickVoice(); }
export function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = 0.92; u.pitch = 1.05;
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => 'speechSynthesis' in window && speechSynthesis.cancel();

// ---------- Little round thumbnails cut from the real maps ----------
export function orbStyle(id) {
  const d = BODY[id];
  if (!d) return '';
  if (id === 'sun') return 'background-image:url(tex/sd/sun.jpg)';
  if (d.texture) return `background-image:url(${d.texture.sd})`;
  return `background:radial-gradient(circle at 35% 35%, ${d.color}, #222)`;
}

// ---------- Dock ----------
function fillDock(items, onSelect) {
  const wrap = $('#dock .dock-scroll');
  wrap.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.className = 'dock-item';
    b.dataset.id = it.id;
    b.innerHTML = `${it.orb}<span class="dock-name">${it.label}</span>`;
    b.setAttribute('aria-label', `Visit ${it.name}`);
    b.addEventListener('click', () => onSelect(it.id));
    wrap.appendChild(b);
  }
  wrap.scrollLeft = 0;
}
export function buildDock(onSelect) {
  fillDock(DOCK.map((id) => {
    const d = id === 'belt' ? BELT : BODY[id];
    let orb;
    if (id === 'iss') orb = '<span class="dock-orb emoji" aria-hidden="true">🛰️</span>';
    else if (id === 'belt') orb = '<span class="dock-orb emoji" aria-hidden="true">🪨</span>';
    else orb = `<span class="dock-orb ${id === 'sun' ? 'sun' : ''}" style="${orbStyle(id)}" aria-hidden="true"></span>`;
    const label = { sun: 'Sun', moon: 'Moon', iss: 'Station', belt: 'Asteroids' }[id] || d.name;
    return { id, name: d.name, label, orb };
  }), onSelect);
}
// A glowing dot in a star's own colour, for the deep-space dock and chips
export const starOrbStyle = (color) => `background:radial-gradient(circle at 50% 50%, #fff 0%, ${color} 34%, ${color}55 58%, transparent 72%)`;
export function buildDeepDock(items, onSelect) {
  fillDock(items.map((it) => ({
    id: it.id, name: it.name, label: it.short,
    orb: it.emoji ? `<span class="dock-orb emoji" aria-hidden="true">${it.emoji}</span>`
      : `<span class="dock-orb star" style="${starOrbStyle(it.color)}" aria-hidden="true"></span>`,
  })), onSelect);
}
export function markDock(id) {
  document.querySelectorAll('.dock-item').forEach((b) => {
    const on = b.dataset.id === id;
    b.setAttribute('aria-current', on ? 'true' : 'false');
    if (on) b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  });
}

// ---------- Card ----------
const KIND = {
  star: 'A star', planet: 'A planet', dwarf: 'A dwarf planet', moon: 'A moon', asteroid: 'An asteroid', craft: 'A spacecraft',
  region: 'A place in space', cluster: 'A star cluster', constellation: 'A star pattern', galaxy: 'A galaxy', arm: 'An arm of the Milky Way',
  blackhole: 'A black hole',
};

export function showCard(def, h) {
  const card = $('#card');
  const body = card.querySelector('.card-body');
  const parent = def.parent ? BODY[def.parent] : null;
  const kind = def.kind === 'moon' && parent ? `A moon of ${parent.name.replace(/^The /, '')}` : KIND[def.kind];
  const facts = def.facts.map((f) => `<li><span class="ico" aria-hidden="true">${f.icon}</span><p>${f.text}</p></li>`).join('');
  const chips = def.chips || def.moons || (def.id === 'earth' ? ['moon'] : null);
  const extraChips = def.chipItems ? null : def.id === 'earth' ? ['moon', 'iss', 'hubble'] : chips;
  const chipHtml = def.chipItems
    ? `<p class="chips-title">${def.chipsTitle || 'Nearby'}</p><div class="chips">${def.chipItems.map((c) => `<button class="chip" data-go="${c.id}">${c.emoji ? `<i class="emoji" aria-hidden="true">${c.emoji}</i>` : `<i style="${c.style}"></i>`}${c.name}</button>`).join('')}</div>`
    : extraChips ? `<p class="chips-title">${def.id === 'belt' ? 'Real asteroids to visit' : def.id === 'earth' ? 'Near Earth' : 'Moons'}</p>
      <div class="chips">${extraChips.map((id) => `<button class="chip" data-go="${id}"><i style="${id === 'iss' || id === 'hubble' ? 'background:#9aa7bd' : orbStyle(id)}"></i>${BODY[id].name.replace(/^The /, '')}</button>`).join('')}</div>` : '';
  const pic = def.picture
    ? `<figure class="card-pic"><img src="${def.picture.src}" alt="${def.picture.alt}" loading="lazy" decoding="async"><figcaption>${def.picture.caption}</figcaption></figure>` : '';
  const extra = (def.actions || []).map((a) => `<button class="btn btn-toggle" data-x="${a.id}" aria-pressed="${a.pressed ? 'true' : 'false'}"><span aria-hidden="true">${a.icon}</span> ${a.label}</button>`).join('');
  body.innerHTML = `
    <p class="card-kind">${kind}</p>
    <h2 class="card-name">${def.name}</h2>
    <p class="card-tag">${def.tagline}</p>
    ${extra ? `<div class="actions toggles">${extra}</div>` : ''}
    <ul class="facts">${facts}</ul>
    ${pic}
    <div class="actions">
      <button class="btn btn-ghost" data-act="read"><span aria-hidden="true">🔊</span> Read to me</button>
      ${def.inside ? '<button class="btn btn-rust" data-act="inside"><span aria-hidden="true">🔍</span> Look inside</button>' : ''}
      ${def.id === 'iss' ? '<button class="btn btn-sun" data-act="enter"><span aria-hidden="true">🚪</span> Go inside</button>' : ''}
    </div>
    ${chipHtml}
  `;
  body.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => h.onAction?.(b.dataset.x, b)));
  body.querySelector('[data-act="read"]').onclick = () => speak(`${def.name}. ${def.tagline} ${def.facts.map((f) => f.text).join(' ')}`);
  body.querySelector('[data-act="inside"]')?.addEventListener('click', h.onInside);
  body.querySelector('[data-act="enter"]')?.addEventListener('click', h.onEnter);
  body.querySelectorAll('[data-go]').forEach((c) => c.addEventListener('click', () => h.onGo(c.dataset.go)));
  card.querySelector('.card-close').onclick = h.onClose;
  card.hidden = false;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  body.scrollTop = 0;
}

export function showInside(def, h) {
  const card = $('#card');
  const body = card.querySelector('.card-body');
  body.innerHTML = `
    <p class="card-kind">Inside ${def.name.replace(/^The /, '')}</p>
    <h2 class="card-name">What's inside?</h2>
    <p class="card-tag">Tap a layer to learn about it.</p>
    <ul class="layers">${def.inside.map((l, i) => `<li class="layer" data-i="${i}" role="button" tabindex="0"><span class="dot" style="background:${l.color}"></span><div><b>${l.name}</b><span>${l.kid}</span></div></li>`).join('')}</ul>
    <div class="actions">
      <button class="btn btn-ghost" data-act="read"><span aria-hidden="true">🔊</span> Read to me</button>
      <button class="btn btn-sun" data-act="close"><span aria-hidden="true">🧩</span> Put it back together</button>
    </div>`;
  body.querySelectorAll('.layer').forEach((el) => {
    el.addEventListener('click', () => h.onLayer(+el.dataset.i));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') h.onLayer(+el.dataset.i); });
  });
  body.querySelector('[data-act="close"]').onclick = h.onBack;
  body.querySelector('[data-act="read"]').onclick = h.onRead;
  card.querySelector('.card-close').onclick = h.onBack;
  card.hidden = false;
  body.scrollTop = 0;
}
export function markLayer(i) {
  document.querySelectorAll('.layer').forEach((el) => el.setAttribute('aria-current', +el.dataset.i === i ? 'true' : 'false'));
  document.querySelector(`.layer[data-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function showSpot(spot, onClose) {
  const card = $('#card');
  const body = card.querySelector('.card-body');
  body.innerHTML = `
    <p class="card-kind">On the Space Station</p>
    <h2 class="card-name"><span aria-hidden="true">${spot.icon}</span> ${spot.name}</h2>
    <p class="card-tag">${spot.text}</p>
    <div class="actions"><button class="btn btn-ghost" data-act="read"><span aria-hidden="true">🔊</span> Read to me</button></div>`;
  body.querySelector('[data-act="read"]').onclick = () => speak(`${spot.name}. ${spot.text}`);
  card.querySelector('.card-close').onclick = onClose;
  card.hidden = false;
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
}

export const hideCard = () => { $('#card').hidden = true; };

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
}
