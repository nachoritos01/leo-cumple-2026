// ————— Interfaz · Cumpleaños Legendario —————
import './style.css';
import '@fontsource/anton';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/700.css';
import { CONFIG } from './config.js';
import { initScene } from './scene3d.js';
import { setupGame } from './game.js';

window.__APP_ERRORS__ = window.__APP_ERRORS__ || [];

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarsePointer = matchMedia('(hover: none), (pointer: coarse)').matches;
// con el minijuego abierto la página queda cubierta: etiquetas y parallax dejan de trabajar
let gameOpen = false;

// ——— Config → DOM ———
$('[data-config="fecha"]').textContent = CONFIG.fechaTexto;
$('[data-config="hora"]').textContent = CONFIG.horaTexto;
$('[data-config="lugar"]').textContent = CONFIG.lugarTexto;
$$('[data-config="nombre"]').forEach((el) => (el.textContent = CONFIG.nombre));
$$('[data-config="edad"]').forEach((el) => (el.textContent = CONFIG.edad));
$('#btn-map').href = CONFIG.mapaUrl;

$('#btn-wa').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.mensajeWA)}`;
const cal = CONFIG.calendario;
$('#btn-cal').href =
  `https://calendar.google.com/calendar/render?action=TEMPLATE` +
  `&text=${encodeURIComponent(cal.titulo)}&dates=${cal.inicio}/${cal.fin}` +
  `&details=${encodeURIComponent(cal.detalles)}` +
  `&location=${encodeURIComponent(CONFIG.lugarTexto)}`;

// ——— Cuenta regresiva ———
(() => {
  const target = new Date(CONFIG.fechaISO).getTime();
  const el = {
    d: $('[data-cd="d"]'), h: $('[data-cd="h"]'),
    m: $('[data-cd="m"]'), s: $('[data-cd="s"]'),
  };
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');
  function tick() {
    let diff = Math.max(0, target - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    el.d.textContent = pad(d); el.h.textContent = pad(h);
    el.m.textContent = pad(m); el.s.textContent = pad(s);
  }
  tick();
  setInterval(tick, 1000);
})();

// ——— Escena 3D (con fallback si no hay WebGL o fallan los modelos) ———
let scene = null;
try {
  scene = initScene($('#gl'));
  scene.ready
    .then(() => $('#loader').classList.add('done'))
    .catch(() => {
      $('#loader').classList.add('done');
      $('#webgl-fallback').hidden = false;
      $('#gl').style.display = 'none';
    });
} catch (err) {
  console.error(err);
  window.__APP_ERRORS__.push(String(err));
  $('#loader').classList.add('done');
  $('#webgl-fallback').hidden = false;
  $('#gl').style.display = 'none';
}
// Red de seguridad: la carga nunca bloquea la página
setTimeout(() => $('#loader').classList.add('done'), 9000);

// ——— Progreso de scroll → escena ———
// La coreografía está afinada en escritorio, donde cada panel mide una pantalla.
// En móvil las tarjetas se apilan y las secciones crecen, así que el progreso
// global se desfasa (las etiquetas Pokédex caían sobre «Detalles de la fiesta»).
// Ahí se ancla cada sección al progreso que tiene en escritorio.
const MOBILE_MQ = matchMedia('(max-width: 900px)');
const SECTION_P = [0, 0.164, 0.329, 0.493, 0.657, 0.882];   // inicio de cada panel en escritorio
const sections = $$('main > section');
function scrollProgress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  if (max <= 0) return 0;
  if (!MOBILE_MQ.matches || sections.length !== SECTION_P.length) return scrollY / max;
  const y = scrollY;
  const tops = sections.map((s) => Math.min(s.offsetTop, max));
  for (let i = tops.length - 1; i >= 0; i--) {
    if (y >= tops[i]) {
      const y1 = i + 1 < tops.length ? tops[i + 1] : max;
      const p1 = i + 1 < tops.length ? SECTION_P[i + 1] : 1;
      const t = y1 > tops[i] ? (y - tops[i]) / (y1 - tops[i]) : 1;
      return SECTION_P[i] + (p1 - SECTION_P[i]) * Math.min(1, t);
    }
  }
  return 0;
}
let ticking = false;
const heroPanel = $('.hero');
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const p = scrollProgress();
    if (scene) scene.setTarget(p);
    parallax();
    // el hero se desvanece al salir de la primera pantalla
    heroPanel.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.03) / 0.09)));
    ticking = false;
  });
}
addEventListener('scroll', onScroll, { passive: true });

// ——— Parallax de textos a distintas velocidades ———
// Corre en bucle continuo: el rect incluye la transformación anterior,
// así que necesita varios frames para converger (no basta un evento de scroll)
const parallaxEls = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) }));
// En móvil se desactiva: con las tarjetas apiladas, cada una a su velocidad,
// se montaban unas sobre otras y empujaba la cuenta regresiva fuera del hueco
let parallaxOff = false;
function parallax() {
  if (reduceMotion) return;
  if (MOBILE_MQ.matches) {
    if (!parallaxOff) {
      for (const { el } of parallaxEls) el.style.transform = '';
      parallaxOff = true;
    }
    return;
  }
  parallaxOff = false;
  const mid = innerHeight / 2;
  for (const { el, speed } of parallaxEls) {
    const r = el.getBoundingClientRect();
    const off = (r.top + r.height / 2 - mid) * speed * 0.28;
    el.style.transform = `translateY(${off.toFixed(1)}px)`;
  }
}
(function parallaxLoop() {
  requestAnimationFrame(parallaxLoop);
  if (!gameOpen) parallax();
})();

// ——— Etiquetas Pokédex ———
const labelLayer = $('#labels');
const lineSvg = $('#label-lines');
const LABELS = [
  { key: 'wing',  at: 0.300, side: [ 0.8,-1] },
  { key: 'flame', at: 0.335, side: [-0.2, 1.2] },
  { key: 'fangs', at: 0.370, side: [ 1,-1] },
  { key: 'claws', at: 0.405, side: [ 1.1, 0.6] },
].map((def) => {
  const div = document.createElement('div');
  div.className = 'dex-label';
  labelLayer.appendChild(div);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('r', '3');
  lineSvg.append(line, dot);
  return { ...def, div, line, dot, filled: false };
});
const FADE_OUT = 0.48;
const dexCard = $('#pokedex .card');
// Turnos en móvil: de 0.30 a 0.41, cuando la tarjeta fija de la Pokédex empieza a subir
const MOBILE_AT0 = 0.30, MOBILE_STEP = 0.027;

function updateLabels() {
  if (!scene || !scene.anchors) return;
  const p = scene.progress;
  // En móvil no caben las cuatro a la vez: se muestran de una en una
  // y siempre por encima de la tarjeta de la Pokédex
  const narrow = MOBILE_MQ.matches;
  let maxY = innerHeight;
  let room = 1;   // se apagan si la tarjeta sube y no deja sitio encima
  if (narrow) {
    const cardTop = dexCard.getBoundingClientRect().top;
    maxY = Math.min(maxY, cardTop - 10);
    room = Math.min(1, Math.max(0, (cardTop / innerHeight - 0.3) / 0.15));
  }
  LABELS.forEach((lb, i) => {
    const anchor = scene.anchors[lb.key];
    if (!anchor) return;
    if (!lb.filled) {
      lb.div.innerHTML = `<b>${anchor.title}</b><i>${anchor.text}</i>`;
      lb.filled = true;
    }
    // en móvil el turno de cada etiqueta acaba antes de que la tarjeta empiece a subir
    const at = narrow ? MOBILE_AT0 + i * MOBILE_STEP : lb.at;
    const end = narrow ? at + MOBILE_STEP : FADE_OUT;
    const fadeIn = Math.min(1, Math.max(0, (p - at) / (narrow ? 0.008 : 0.035)));
    const fadeOut = 1 - Math.min(1, Math.max(0, (p - end) / (narrow ? 0.008 : 0.05)));
    const op = fadeIn * fadeOut * room;
    const pt = scene.project(anchor.obj);
    const visible = op > 0.01 && !pt.behind;
    lb.div.style.opacity = visible ? op : 0;
    lb.line.style.opacity = visible ? op * 0.9 : 0;
    lb.dot.style.opacity = visible ? op : 0;
    if (!visible) return;
    // la etiqueta se centra en (lx, ly): se mantiene dentro de la pantalla
    const reach = innerWidth < 600 ? 0.55 : 1;
    const hw = lb.div.offsetWidth / 2 + 12, hh = lb.div.offsetHeight / 2 + 12;
    const lx = Math.min(innerWidth - hw, Math.max(hw, pt.x + lb.side[0] * 150 * reach));
    const ly = Math.min(maxY - hh, Math.max(hh + 64, pt.y + lb.side[1] * 90));
    lb.div.style.left = `${lx}px`;
    lb.div.style.top = `${ly}px`;
    lb.line.setAttribute('x1', pt.x); lb.line.setAttribute('y1', pt.y);
    lb.line.setAttribute('x2', lx);   lb.line.setAttribute('y2', ly);
    lb.dot.setAttribute('cx', pt.x);  lb.dot.setAttribute('cy', pt.y);
  });
}
(function labelLoop() {
  requestAnimationFrame(labelLoop);
  if (!gameOpen) updateLabels();
})();

// ——— Reveal + barras de stats ———
$$('.card, .kicker, h2, .lede, .design, .countdown').forEach((el) => el.classList.add('reveal'));
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('on');
    if (e.target.classList.contains('stats')) e.target.classList.add('on');
    io.unobserve(e.target);
  }
}, { threshold: 0.2 });
$$('.reveal, .stats').forEach((el) => io.observe(el));

// ——— Lightbox ———
const lightbox = $('#lightbox');
const lbImg = $('#lb-img');
const lbCap = $('#lb-cap');
let lastFocus = null;
function openLb(btn) {
  lastFocus = btn;
  lbImg.src = btn.dataset.full;
  lbImg.alt = btn.querySelector('img').alt;
  lbCap.textContent = btn.dataset.title;
  lightbox.hidden = false;
  $('#lb-close').focus();
}
function closeLb() {
  lightbox.hidden = true;
  lbImg.src = '';
  if (lastFocus) lastFocus.focus();
}
$$('.design').forEach((btn) => btn.addEventListener('click', () => openLb(btn)));
$('#lb-close').addEventListener('click', closeLb);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLb(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) closeLb(); });

// ——— Música ———
(() => {
  const audio = $('#music');
  const btn = $('#music-btn');
  const setState = (on) => {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Detener música' : 'Reproducir música');
  };
  btn.addEventListener('click', async () => {
    if (!audio.paused) { audio.pause(); return; }
    try { await audio.play(); } catch (err) { console.error('No se pudo reproducir la música:', err); }
  });
  audio.addEventListener('play', () => setState(true));
  audio.addEventListener('pause', () => setState(false));
})();

// ——— Cursor glow ———
(() => {
  if (coarsePointer) return;
  const cur = $('#cursor');
  let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
  addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
  (function follow() {
    requestAnimationFrame(follow);
    x += (tx - x) * 0.18; y += (ty - y) * 0.18;
    cur.style.left = `${x}px`; cur.style.top = `${y}px`;
  })();
  $$('[data-hover]').forEach((el) => {
    el.addEventListener('mouseenter', () => cur.classList.add('big'));
    el.addEventListener('mouseleave', () => cur.classList.remove('big'));
  });
})();

// ——— Estado inicial ———
parallax();
if (scene) scene.setTarget(scrollProgress());
const game = setupGame({ touch: coarsePointer, reduceMotion });
// mientras el minijuego está abierto (y cubre la escena con desenfoque) no se renderiza 3D
game.onOpenChange((isOpen) => {
  gameOpen = isOpen;
  if (scene) scene.setPaused(isOpen);
});
