// ————— Lanzallamas de Charizard · minijuego pixel-art —————
// Sprites dibujados por código (sin assets externos). Controles:
// ESPACIO: fuego bajo · ↑/W: fuego alto · P: pausa · ESC: cerrar
// En táctil: toca la mitad baja o alta del escenario para elegir la franja.

const VW = 960, VH = 540;
const GROUND = VH - 84;
const SCALE = 5;
const GRAVITY = 1500;

// Dos franjas de disparo: la baja barre las rodantes, la alta las flotantes.
// Cualquier manzana que puede tocar a Charizard (caja y 392–456) cae dentro
// de al menos una de las dos franjas (alta 372–412, baja 404–444).
const FLAME_LOW_Y = GROUND - 52;
const FLAME_HIGH_Y = GROUND - 84;
const FLAME_W = 50, FLAME_H = 40;
const FLAME_MAX_X = VW - 100;   // la flama muere al borde visible: nunca quema lo que no se ve

const PAL = {
  K: '#1e2234', B: '#f08838', b: '#d66c22', Y: '#f6d79a',
  W: '#4a98e0', w: '#8ecbf4', R: '#ff6a1a', r: '#ffd23e',
  A: '#e53935', a: '#ff7860', L: '#60a854', l: '#8ccd6e',
  G: '#7a7e8c', g: '#50545f', E: '#1e2234',
};

const CHAR_RUN = [
  [
    '................',
    '...WwW..........',
    '..WwwwWwKK......',
    '.WwwwwwwKBBBEKB.',
    '.WwKwKwwKBBBBBK.',
    '.KKKKKKKKBBBBBBK',
    '.........KBBBBK.',
    '.Rr......KBBK...',
    'RrrR.KBBBBBBK...',
    'RrR..KBYYYYBKB..',
    '.RRKBKBYYYYBKK..',
    '..KBBKBBBBBK....',
    '.KBB..BB.BB.....',
    'KBB...BB.BB.....',
    '.....KBBKKBBK...',
    '.....KBBKKBBK...',
  ],
  [
    '................',
    '...WwW..........',
    '..WwwwWwKK......',
    '.WwwwwwwKBBBEKB.',
    '.WwKwKwwKBBBBBK.',
    '.KKKKKKKKBBBBBBK',
    '.........KBBBBK.',
    '.Rr......KBBK...',
    'RrrR.KBBBBBBK...',
    'RrR..KBYYYYBKB..',
    '.RRKBKBYYYYBKK..',
    '..KBBKBBBBBK....',
    '.KBB.BB..BB.....',
    'KBB...B...B.....',
    '.KBB.KBK.KBBK...',
    '.KBB.KBK.KBBK...',
  ],
];

const FLAME_SHOT = [
  [
    '..........',
    '...RRRR...',
    '..RrrrrR..',
    '.RrrrrrrR.',
    '.RrrrrRRR.',
    '..RRRRR...',
    '...RR.....',
    '..........',
  ],
  [
    '..........',
    '....RR....',
    '..RRrrRR..',
    '.RrrrrrrR.',
    '.RrrrrrRR.',
    '..RRRRR...',
    '....RR....',
    '..........',
  ],
  [
    '..........',
    '...RRR....',
    '..RrrrRR..',
    '.RrrrrrrR.',
    '.RrrrrRR..',
    '..RRRR....',
    '...RR.....',
    '..........',
  ],
];

const APPLE = [
  '....KK....',
  '...KLLK...',
  '....KLl...',
  '....K.....',
  '..KAAAAK..',
  '.KAAAAAAK.',
  '.KAaAAAAK.',
  'KAAAAaAAAK',
  'KAAaAAAAaK',
  'KAAAAaAAAK',
  '.KAAAAAAK.',
  '..KKKKKK..',
];

const APPLE_BURNT = [
  '..........',
  '..........',
  '..........',
  '..........',
  '...KKKK...',
  '..KGGGGK..',
  '.KGGGGGGK.',
  '.KGgGGGGK.',
  'KGGGGgGGGK',
  'KGGgGGGGgK',
  '..KGGGGK..',
  '...KKKK...',
];

// Manzana dorada (bonus) y manzana dura (dos golpes): mismos trazados, recoloreados
const APPLE_GOLD = APPLE.map((row) => row.replaceAll('A', 'r').replaceAll('a', 'Y'));
const APPLE_HARD = APPLE.map((row) => row.replaceAll('A', 'G').replaceAll('a', 'g'));

function makeSprite(rows) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const ctx = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = PAL[ch];
      ctx.fillRect(x, y, 1, 1);
    });
  });
  return c;
}

// touch y reduceMotion llegan de main.js, que ya evalúa esas media queries
export function setupGame({ touch = false, reduceMotion = false } = {}) {
  const overlay = document.getElementById('game-overlay');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const heartsEl = document.getElementById('game-hearts');
  const scoreEl = document.getElementById('game-score');
  const bestEl = document.getElementById('game-best');
  const comboEl = document.getElementById('game-combo');
  const msgEl = document.getElementById('game-msg');
  const helpEl = document.getElementById('game-help');
  const openBtn = document.getElementById('btn-game');
  const closeBtn = document.getElementById('game-close');
  const pauseBtn = document.getElementById('game-pause');

  const SPR = {
    char: CHAR_RUN.map(makeSprite),
    flame: FLAME_SHOT.map(makeSprite),
    apple: makeSprite(APPLE),
    burnt: makeSprite(APPLE_BURNT),
    gold: makeSprite(APPLE_GOLD),
    hard: makeSprite(APPLE_HARD),
  };

  const TEST = new URLSearchParams(location.search).get('test');
  const TOUCH = touch;
  const REDUCE = reduceMotion;

  let raf = 0, lastT = 0, open = false;
  let drawnState = null;   // último estado pintado fuera de la partida
  let best = 0;
  try { best = Number(localStorage.getItem('pokefiesta-record')) || 0; } catch { /* sin storage */ }

  const G = {
    state: 'menu',   // menu | play | pause | over
    t: 0, dist: 0, speed: 0,
    score: 0, burned: 0, lives: 3, combo: 0, comboT: 0,
    invuln: 0, shake: 0, flash: 0,
    runT: 0, shootCd: 0, muzzle: 0, muzzleHigh: false,
    spawnT: 0, overAt: 0,
    flames: [], apples: [], parts: [], texts: [], clouds: [],
  };

  const PX = 150, PW = 16 * SCALE, PH = 16 * SCALE;   // Charizard siempre en x fija
  const openCbs = [];

  for (let i = 0; i < 5; i++) {
    G.clouds.push({ x: Math.random() * VW, y: 30 + Math.random() * 120, s: 0.6 + Math.random() * 0.9 });
  }

  // ——— Audio: tonos WebAudio generados, sin assets ———
  let AC = null;
  function tone(f, dur, type = 'square', vol = 0.05, slide = 0) {
    try {
      const ACtor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!ACtor) return;
      AC ||= new ACtor();
      if (AC.state === 'suspended') AC.resume().catch(() => { /* sin gesto del usuario todavía */ });
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, AC.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), AC.currentTime + dur);
      g.gain.setValueAtTime(vol, AC.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
      o.connect(g).connect(AC.destination);
      o.start();
      o.stop(AC.currentTime + dur);
    } catch { /* sin audio */ }
  }

  function hiScore() {
    if (G.score > best) {
      best = G.score;
      try { localStorage.setItem('pokefiesta-record', String(best)); } catch { /* sin storage */ }
    }
    bestEl.textContent = best;
  }

  function reset() {
    Object.assign(G, {
      state: 'menu', t: 0, dist: 0, speed: 260,
      score: 0, burned: 0, lives: 3, combo: 0, comboT: 0,
      invuln: 0, shake: 0, flash: 0, runT: 0, shootCd: 0, muzzle: 0, muzzleHigh: false,
      spawnT: 1.1, overAt: 0,
      flames: [], apples: [], parts: [], texts: [],
    });
    hud();
    setPauseIcon(false);
  }

  function hud() {
    const lives = Math.max(0, G.lives);
    heartsEl.textContent = '♥'.repeat(lives) + '♡'.repeat(Math.max(0, 3 - lives));
    scoreEl.textContent = G.score;
    bestEl.textContent = best;
    if (comboEl) {
      comboEl.hidden = G.combo < 2;
      comboEl.textContent = '×' + G.combo;
    }
  }

  function msg(html) {
    msgEl.innerHTML = html || '';
    msgEl.hidden = !html;
  }

  function setPauseIcon(paused) {
    if (!pauseBtn) return;
    pauseBtn.classList.toggle('on', paused);
    pauseBtn.setAttribute('aria-label', paused ? 'Continuar juego' : 'Pausar juego');
  }

  // Única regla para empezar o reintentar: desde el menú, o desde game over
  // pasados 0.6 s (que un toque o tecla rezagados no se salten la pantalla).
  function tryStart() {
    if (G.state === 'menu' || (G.state === 'over' && performance.now() - G.overAt >= 600)) start();
  }

  function start() {
    reset();
    G.state = 'play';
    msg('');
  }

  function pause() {
    if (G.state !== 'play') return;
    G.state = 'pause';
    setPauseIcon(true);
    msg(TOUCH
      ? '<b>PAUSA</b><span>Toca la pantalla o el botón ▶ para continuar</span>'
      : '<b>PAUSA</b><span>P para continuar · ESC para salir</span>');
  }

  function resume() {
    if (G.state !== 'pause') return;
    G.state = 'play';
    setPauseIcon(false);
    msg('');
  }

  function togglePause() {
    if (G.state === 'play') pause();
    else if (G.state === 'pause') resume();
  }

  function spawnApple() {
    const floater = Math.random() < Math.min(0.42, 0.3 + G.t * 0.002);
    let type = 'norm';
    if (!floater) {
      const r = Math.random();
      type = r < 0.1 ? 'gold' : r < 0.22 ? 'hard' : 'norm';
    }
    const a = {
      x: VW + 40, rot: 0, floater, type,
      hp: type === 'hard' ? 2 : 1, burntT: 0,
    };
    if (floater) {
      // franja 316–386: toda ella alcanzable por la flama alta
      a.y = GROUND - 70 - Math.random() * 70;
      a.vx = -G.speed * 1.02; a.vy = 0; a.g = 0;
    } else {
      a.y = GROUND - 72;   // apoyada en el suelo, como se dibuja
      a.vx = -G.speed * (1 + Math.random() * 0.12);
      a.vy = -(120 + Math.random() * 220); a.g = GRAVITY;
    }
    G.apples.push(a);
  }

  function shoot(high) {
    if (G.shootCd > 0) return;
    G.shootCd = 0.28;
    G.muzzle = 0.12;
    G.muzzleHigh = high;
    G.flames.push({ x: PX + PW - 30, y: high ? FLAME_HIGH_Y : FLAME_LOW_Y, vx: 680, t: 0, hit: false });
    tone(200, 0.09, 'sawtooth', 0.025, -120);
  }

  function burst(x, y, colors, n, pow) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * pow;
      G.parts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        g: 900, life: 0.5 + Math.random() * 0.4,
        c: colors[(Math.random() * colors.length) | 0], s: 3 + (Math.random() * 3 | 0),
      });
    }
  }

  function burn(a) {
    a.burntT = 0.3;   // el sprite quemado se ve 0.3 s antes de desaparecer
    G.combo = G.comboT > 0 ? Math.min(G.combo + 1, 5) : 1;
    G.comboT = 1.5;
    // la dorada vale 50 fijos (no se multiplica), así que su texto no muestra el combo
    const gold = a.type === 'gold';
    const pts = gold ? 50 : 10 * G.combo;
    G.score += pts;
    G.burned += 1;
    burst(a.x + 30, a.y + 36, [PAL.R, PAL.r, '#fff2c0'], 16, 260);
    G.texts.push({ x: a.x + 10, y: a.y, txt: !gold && G.combo > 1 ? `+${pts} ×${G.combo}` : `+${pts}`, t: 0.9 });
    hud();
    tone(660, 0.09, 'square', 0.04);
    tone(880, 0.12, 'square', 0.03);
  }

  // Un golpe de flama que no destruye la manzana (la dura aguanta dos)
  function damageApple(a) {
    a.hp -= 1;
    if (a.hp <= 0) { burn(a); return; }
    G.score += 10;
    burst(a.x + 30, a.y + 36, [PAL.G, PAL.g, '#c8ccd8'], 8, 180);
    G.texts.push({ x: a.x + 10, y: a.y, txt: '¡DURA!', t: 0.7 });
    hud();
    tone(320, 0.08, 'triangle', 0.05);
  }

  function hitPlayer(a) {
    a.dead = true;
    G.lives -= 1;
    G.combo = 0;
    G.invuln = 1.4;
    if (!REDUCE) { G.shake = 0.35; G.flash = 0.3; }
    burst(PX + PW / 2, GROUND - PH / 2, [PAL.A, PAL.a, '#ffd0c0'], 14, 240);
    hud();
    tone(140, 0.25, 'sawtooth', 0.06, -80);
    if (G.lives <= 0) {
      G.state = 'over';
      G.overAt = performance.now();
      hiScore();
      setPauseIcon(false);
      msg(`<b>GAME OVER</b><span>Quemaste <strong>${G.burned}</strong> manzanas</span><span class="game-final">Puntaje: <strong>${G.score}</strong> · Récord: <strong>${best}</strong></span><button class="btn fire" id="game-retry" type="button">${TOUCH ? 'Jugar de nuevo' : 'Jugar de nuevo (R)'}</button>`);
    }
  }

  function update(dt) {
    G.t += dt;
    // velocidad: sube hasta los 42 s y sigue subiendo más lento después (tope 880)
    G.speed = G.t <= 42 ? 260 + G.t * 9 : Math.min(880, 638 + (G.t - 42) * 6);
    G.dist += G.speed * dt;
    G.runT += dt * (G.speed / 260) * 9;
    G.shootCd = Math.max(0, G.shootCd - dt);
    G.muzzle = Math.max(0, G.muzzle - dt);
    G.invuln = Math.max(0, G.invuln - dt);
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - dt);
    G.comboT = Math.max(0, G.comboT - dt);
    if (G.comboT === 0 && G.combo !== 0) { G.combo = 0; hud(); }   // el «×N» del HUD caduca con el combo

    for (const c of G.clouds) {
      c.x -= (12 + c.s * 10) * dt;
      if (c.x < -120) { c.x = VW + 80; c.y = 30 + Math.random() * 120; }
    }

    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      spawnApple();
      // frecuencia: máximo a los 53 s y sigue apretando hasta 0.4 s
      const base = G.t < 53
        ? Math.max(0.55, 1.5 - G.t * 0.018)
        : Math.max(0.4, 0.55 - (G.t - 53) * 0.004);
      G.spawnT = base * (0.75 + Math.random() * 0.5);
    }

    for (const f of G.flames) { f.x += f.vx * dt; f.t += dt; }
    // una flama que se apaga sin dar: rompe el combo (disparar tiene coste)
    if (G.flames.some((f) => f.x >= FLAME_MAX_X && !f.hit)) { G.combo = 0; G.comboT = 0; hud(); }
    G.flames = G.flames.filter((f) => !f.dead && f.x < FLAME_MAX_X);

    const pBox = { x: PX + 18, y: GROUND - PH + 16, w: PW - 40, h: PH - 26 };
    for (const a of G.apples) {
      // el golpe de la última vida termina la partida en este mismo frame: nada más puntúa ni golpea
      if (G.state !== 'play') break;
      if (a.burntT > 0) {
        a.burntT -= dt;
        if (a.burntT <= 0) a.dead = true;
        continue;
      }
      a.x += a.vx * dt;
      a.vy += a.g * dt;
      a.y += a.vy * dt;
      a.rot += dt * 6;
      if (!a.floater && a.y > GROUND - 72) {   // rebote rodante
        a.y = GROUND - 72;
        a.vy = -Math.abs(a.vy) * 0.55;
        if (Math.abs(a.vy) < 40) a.vy = 0;
      }
      // caja idéntica al sprite dibujado (60×72)
      const aBox = { x: a.x, y: a.y, w: 60, h: 72 };
      for (const f of G.flames) {
        if (f.dead || a.dead || a.burntT > 0) continue;
        if (f.x + FLAME_W > aBox.x && f.x < aBox.x + aBox.w &&
            f.y + FLAME_H > aBox.y && f.y < aBox.y + aBox.h) {
          f.dead = true;
          f.hit = true;
          damageApple(a);
        }
      }
      if (!a.dead && a.burntT === 0 && G.invuln === 0 &&
          aBox.x < pBox.x + pBox.w && aBox.x + aBox.w > pBox.x &&
          aBox.y < pBox.y + pBox.h && aBox.y + aBox.h > pBox.y) {
        hitPlayer(a);
      }
    }
    G.apples = G.apples.filter((a) => !a.dead && a.x > -80);
    G.flames = G.flames.filter((f) => !f.dead);   // la flama que acierta no se dibuja un frame de más

    for (const p of G.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt;
    }
    G.parts = G.parts.filter((p) => p.life > 0);

    for (const t of G.texts) { t.y -= 40 * dt; t.t -= dt; }
    G.texts = G.texts.filter((t) => t.t > 0);
  }

  function hillLayer(off, base, amp, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (let x = 0; x <= VW; x += 8) {
      const y = base - (Math.sin((x + off) * 0.007) * 0.6 + Math.sin((x + off) * 0.019 + 2) * 0.4) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VW, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  // cielo atardecer (el degradado se crea una sola vez)
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, '#1b1f3d');
  sky.addColorStop(0.55, '#4a2b52');
  sky.addColorStop(0.85, '#b4502e');
  sky.addColorStop(1, '#e08040');

  function draw() {
    // fuera de la partida no hay temblor, destello ni parpadeo (sin tocar el estado del juego)
    const live = G.state === 'play';
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VW, GROUND);

    // sol pixelado
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(VW - 220, GROUND - 130, 56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(VW - 220, GROUND - 130, 40, 0, Math.PI * 2);
    ctx.fill();

    // nubes
    ctx.fillStyle = 'rgba(255, 226, 200, 0.8)';
    for (const c of G.clouds) {
      const s = c.s;
      ctx.fillRect(c.x, c.y, 70 * s, 16 * s);
      ctx.fillRect(c.x + 14 * s, c.y - 12 * s, 42 * s, 12 * s);
      ctx.fillRect(c.x + 8 * s, c.y + 16 * s, 48 * s, 10 * s);
    }

    hillLayer(G.dist * 0.25, GROUND - 60, 70, '#3a2d55');
    hillLayer(G.dist * 0.55, GROUND - 24, 46, '#2b2340');

    // suelo
    ctx.fillStyle = '#241a2e';
    ctx.fillRect(0, GROUND, VW, VH - GROUND);
    ctx.fillStyle = '#3f7a3a';
    ctx.fillRect(0, GROUND, VW, 10);
    ctx.fillStyle = '#57a04b';
    const tuft = 96;
    for (let x = -(G.dist % tuft); x < VW; x += tuft) {
      ctx.fillRect(x + 20, GROUND - 8, 6, 8);
      ctx.fillRect(x + 27, GROUND - 5, 5, 5);
    }

    ctx.save();
    if (live && G.shake > 0 && !REDUCE) ctx.translate((Math.random() - 0.5) * G.shake * 30, (Math.random() - 0.5) * G.shake * 30);

    // manzanas (la quemada se ve 0.3 s antes de desaparecer)
    for (const a of G.apples) {
      ctx.save();
      ctx.translate(a.x + 30, a.y + 36);
      if (a.burntT > 0) {
        ctx.globalAlpha = Math.min(1, a.burntT / 0.3 + 0.25);
        ctx.drawImage(SPR.burnt, -30, -36, 60, 72);
        ctx.globalAlpha = 1;
      } else {
        if (!a.floater && a.g > 0) ctx.rotate(Math.sin(a.rot) * 0.2);
        const spr = a.type === 'gold' ? SPR.gold : a.type === 'hard' ? SPR.hard : SPR.apple;
        ctx.drawImage(spr, -30, -36, 60, 72);
      }
      ctx.restore();
    }

    // flamas
    const fs = SPR.flame[(G.t * 20 | 0) % 3];
    for (const f of G.flames) {
      ctx.drawImage(fs, f.x, f.y, FLAME_W, FLAME_H);
    }
    if (G.muzzle > 0) {
      ctx.globalAlpha = G.muzzle / 0.12;
      const my = G.muzzleHigh ? FLAME_HIGH_Y : FLAME_LOW_Y;
      ctx.drawImage(SPR.flame[(G.t * 20 | 0) % 3], PX + PW - 36, my - 4, 60, 48);
      ctx.globalAlpha = 1;
    }

    // Charizard (parpadea al ser invulnerable, salvo con reduced-motion)
    if (!live || G.invuln === 0 || REDUCE || (G.t * 14 | 0) % 2 === 0) {
      const frame = SPR.char[(G.runT | 0) % 2];
      const bob = Math.abs(Math.sin(G.runT * Math.PI)) * 3;
      ctx.drawImage(frame, PX, GROUND - PH - bob, PW, PH);
    }

    // partículas
    for (const p of G.parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2.5);
      ctx.fillStyle = p.c;
      ctx.fillRect(p.x, p.y, p.s, p.s);
    }
    ctx.globalAlpha = 1;

    // textos flotantes
    ctx.textAlign = 'left';
    ctx.font = '28px Anton, sans-serif';
    for (const t of G.texts) {
      ctx.globalAlpha = Math.min(1, t.t * 2);
      ctx.fillStyle = '#1e2234';
      ctx.fillText(t.txt, t.x + 2, t.y + 2);
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (live && G.flash > 0 && !REDUCE) {
      ctx.fillStyle = `rgba(229, 57, 53, ${G.flash * 0.8})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function loop(t) {
    if (!open) return;
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000 || 0));
    lastT = t;
    // en menú, pausa y game over la escena no cambia: se pinta una vez al entrar en el estado
    if (G.state === 'play') update(dt);
    if (G.state === 'play' || G.state !== drawnState) {
      draw();
      drawnState = G.state;
    }
    raf = requestAnimationFrame(loop);
  }

  function show() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    document.body.classList.add('game-open');
    reset();
    drawnState = null;
    if (helpEl) {
      helpEl.textContent = TOUCH
        ? 'Toca abajo o arriba en el escenario: fuego bajo o alto'
        : 'ESPACIO: fuego bajo · ↑/W: fuego alto · P: pausa · ESC: salir';
    }
    msg(`<b>LANZALLAMAS</b><span>Manzanas rebeldes invaden la fiesta. ¡Quémalas antes de que te alcancen!</span><span class="game-final">${TOUCH ? 'Toca la mitad alta o baja para escupir fuego' : 'ESPACIO fuego bajo · ↑/W fuego alto'}</span><button class="btn fire" id="game-start" type="button">Empezar</button>`);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    document.getElementById('game-start').focus();
    openCbs.forEach((f) => f(true));
  }

  function hide() {
    if (!open) return;
    hiScore();   // el récord también se guarda al cerrar a media partida
    open = false;
    cancelAnimationFrame(raf);
    overlay.hidden = true;
    document.body.classList.remove('game-open');
    openCbs.forEach((f) => f(false));
    openBtn.focus();
  }

  // orden visual: pausa y cerrar en el HUD, luego el botón del panel
  function trapFocus(e) {
    const els = [pauseBtn, closeBtn, document.getElementById('game-start'), document.getElementById('game-retry')]
      .filter(Boolean);
    if (!els.length) return;
    e.preventDefault();
    const n = els.length;
    const i = els.indexOf(document.activeElement);
    els[e.shiftKey ? (i <= 0 ? n - 1 : i - 1) : (i === -1 || i === n - 1 ? 0 : i + 1)].focus();
  }

  openBtn.addEventListener('click', show);
  closeBtn.addEventListener('click', hide);
  if (pauseBtn) pauseBtn.addEventListener('click', togglePause);
  msgEl.addEventListener('click', (e) => {
    if (e.target.closest('#game-start, #game-retry')) tryStart();
  });
  // En pausa y game over la capa de mensajes cubre el canvas: se reanuda/arranca tocándola
  msgEl.addEventListener('pointerdown', () => {
    if (G.state === 'pause') resume();
    else if (G.state === 'over') tryStart();
  });

  const FIRE_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Tab') { trapFocus(e); return; }   // también al mantener TAB
    const fire = FIRE_KEYS.has(e.code);
    // también en la autorrepetición: si no, ESPACIO mantenido pulsa el botón con foco
    if (fire) e.preventDefault();
    if (e.repeat) return;
    if (fire) {
      if (G.state === 'play') shoot(e.code !== 'Space');
      else tryStart();
    } else if (e.key === 'Enter') {
      if (!e.target.closest('button')) tryStart();
    } else if (e.key === 'Escape') {
      hide();
    } else if (e.key === 'r' || e.key === 'R') {
      if (G.state === 'pause') resume();
      else if (G.state === 'over') tryStart();
    } else if (e.key === 'p' || e.key === 'P') {
      togglePause();
    }
  });
  // ESPACIO activa los botones al soltarse: dentro del juego es la tecla de fuego, no un clic
  addEventListener('keyup', (e) => {
    if (open && FIRE_KEYS.has(e.code)) e.preventDefault();
  });

  // En partida el canvas queda descubierto: la mitad superior dispara alto, la inferior bajo
  canvas.addEventListener('pointerdown', (e) => {
    if (G.state !== 'play') return;
    const r = canvas.getBoundingClientRect();
    shoot(e.clientY - r.top < r.height / 2);
  });

  // Pausa automática al ocultar la pestaña o perder el foco de la ventana
  function autoPause() {
    if (open && G.state === 'play') pause();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  addEventListener('blur', autoPause);

  // Ganchos de verificación headless: ?test=menu abre en el menú; cualquier otro valor
  // arranca una partida con objetos fijos. Se aplican una sola vez, al cargar.
  if (TEST) {
    const loader = document.getElementById('loader');
    if (loader) { loader.style.transition = 'none'; loader.classList.add('done'); }
    show();
    if (TEST !== 'menu') {
      start();
      G.apples.push({ x: 520, y: GROUND - 72, vx: 0, vy: 0, g: 0, rot: 0, floater: false, type: 'norm', hp: 1, burntT: 0 });
      G.apples.push({ x: 660, y: GROUND - 140, vx: 0, vy: 0, g: 0, rot: 0, floater: true, type: 'norm', hp: 1, burntT: 0 });
      G.flames.push({ x: 380, y: FLAME_LOW_Y, vx: 0, t: 0, hit: false });
      G.score = 30; hud();
    }
  }

  return {
    // quien se suscribe tarde (main.js, tras un ?test=) recibe el estado actual
    onOpenChange(cb) { openCbs.push(cb); if (open) cb(true); },
  };
}
