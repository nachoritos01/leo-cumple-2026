// ————— Lanzallamas de Charizard · minijuego pixel-art —————
// Sprites dibujados por código (sin assets externos). Controles:
// ESPACIO / tocar: lanzallamas · P: pausa · ESC: cerrar

const VW = 960, VH = 540;
const GROUND = VH - 84;
const SCALE = 5;
const GRAVITY = 1500;

const PAL = {
  K: '#1e2234', B: '#f08838', b: '#d66c22', Y: '#f6d79a',
  W: '#4a98e0', w: '#8ecbf4', R: '#ff6a1a', r: '#ffd23e',
  A: '#e53935', a: '#ff7860', L: '#60a854', l: '#8ccd6e',
  G: '#7a7e8c', g: '#50545f',
};

const CHAR_RUN = [
  [
    '................',
    '...WwW..........',
    '..WwwwW.KK......',
    '.WwwwwwWKBBBEKB.',
    '.WwKwKwWKBBBBBK.',
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
    '..WwwwW.KK......',
    '.WwwwwwWKBBBEKB.',
    '.WwKwKwWKBBBBBK.',
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

export function setupGame() {
  const overlay = document.getElementById('game-overlay');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const heartsEl = document.getElementById('game-hearts');
  const scoreEl = document.getElementById('game-score');
  const bestEl = document.getElementById('game-best');
  const msgEl = document.getElementById('game-msg');
  const openBtn = document.getElementById('btn-game');
  const closeBtn = document.getElementById('game-close');

  const SPR = {
    char: CHAR_RUN.map(makeSprite),
    flame: FLAME_SHOT.map(makeSprite),
    apple: makeSprite(APPLE),
    burnt: makeSprite(APPLE_BURNT),
  };

  const TEST = new URLSearchParams(location.search).get('test');

  let raf = 0, lastT = 0, open = false;
  let best = 0;
  try { best = Number(localStorage.getItem('pokefiesta-record')) || 0; } catch { /* sin storage */ }

  const G = {
    state: 'menu',   // menu | play | pause | over
    t: 0, dist: 0, speed: 0,
    score: 0, lives: 3, combo: 0, comboT: 0,
    invuln: 0, shake: 0, flash: 0,
    runT: 0, shootCd: 0, muzzle: 0,
    spawnT: 0,
    flames: [], apples: [], parts: [], texts: [], clouds: [],
  };

  const PX = 150, PW = 16 * SCALE, PH = 16 * SCALE;   // Charizard siempre en x fija

  for (let i = 0; i < 5; i++) {
    G.clouds.push({ x: Math.random() * VW, y: 30 + Math.random() * 120, s: 0.6 + Math.random() * 0.9 });
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
      score: 0, lives: 3, combo: 0, comboT: 0,
      invuln: 0, shake: 0, flash: 0, runT: 0, shootCd: 0, muzzle: 0, spawnT: 1.1,
      flames: [], apples: [], parts: [], texts: [],
    });
    hud();
  }

  function hud() {
    heartsEl.textContent = '♥'.repeat(G.lives) + '♡'.repeat(Math.max(0, 3 - G.lives));
    scoreEl.textContent = G.score;
    bestEl.textContent = best;
  }

  function msg(html) {
    msgEl.innerHTML = html || '';
    msgEl.hidden = !html;
  }

  function start() {
    reset();
    G.state = 'play';
    msg('');
  }

  function spawnApple() {
    const floater = Math.random() < 0.3;
    if (floater) {
      G.apples.push({
        x: VW + 40, y: GROUND - 70 - Math.random() * 90,
        vx: -G.speed * 1.02, vy: 0, g: 0, rot: 0, floater: true,
      });
    } else {
      G.apples.push({
        x: VW + 40, y: GROUND - 60,
        vx: -G.speed * (1 + Math.random() * 0.12),
        vy: -(120 + Math.random() * 220), g: GRAVITY,
        rot: 0, floater: false,
      });
    }
  }

  function shoot() {
    if (G.shootCd > 0) return;
    G.shootCd = 0.28;
    G.muzzle = 0.12;
    G.flames.push({ x: PX + PW - 26, y: GROUND - PH + 34, vx: 680, t: 0 });
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
    a.dead = true;
    G.combo = G.comboT > 0 ? Math.min(G.combo + 1, 5) : 1;
    G.comboT = 1.5;
    const pts = 10 * G.combo;
    G.score += pts;
    burst(a.x + 25, a.y + 30, [PAL.R, PAL.r, '#fff2c0'], 16, 260);
    G.texts.push({ x: a.x + 10, y: a.y, txt: G.combo > 1 ? `+${pts} ×${G.combo}` : `+${pts}`, t: 0.9 });
    hud();
  }

  function hitPlayer(a) {
    a.dead = true;
    G.lives -= 1;
    G.combo = 0;
    G.invuln = 1.4;
    G.shake = 0.35;
    G.flash = 0.3;
    burst(PX + PW / 2, GROUND - PH / 2, [PAL.A, PAL.a, '#ffd0c0'], 14, 240);
    hud();
    if (G.lives <= 0) {
      G.state = 'over';
      hiScore();
      msg(`<b>GAME OVER</b><span>Quemaste <strong>${G.score / 10}</strong> manzanas… ¿cuántas en realidad? ¡Da igual!</span><span class="game-final">Puntaje: <strong>${G.score}</strong> · Récord: <strong>${best}</strong></span><button class="btn fire" id="game-retry" type="button">Jugar de nuevo (R)</button>`);
    }
  }

  function update(dt) {
    G.t += dt;
    G.speed = Math.min(640, 260 + G.t * 9);
    G.dist += G.speed * dt;
    G.runT += dt * (G.speed / 260) * 9;
    G.shootCd = Math.max(0, G.shootCd - dt);
    G.muzzle = Math.max(0, G.muzzle - dt);
    G.invuln = Math.max(0, G.invuln - dt);
    G.shake = Math.max(0, G.shake - dt);
    G.flash = Math.max(0, G.flash - dt);
    G.comboT = Math.max(0, G.comboT - dt);
    if (G.comboT === 0) G.combo = 0;

    for (const c of G.clouds) {
      c.x -= (12 + c.s * 10) * dt;
      if (c.x < -120) { c.x = VW + 80; c.y = 30 + Math.random() * 120; }
    }

    G.spawnT -= dt;
    if (G.spawnT <= 0) {
      spawnApple();
      G.spawnT = Math.max(0.55, 1.5 - G.t * 0.018) * (0.75 + Math.random() * 0.5);
    }

    for (const f of G.flames) { f.x += f.vx * dt; f.t += dt; }
    G.flames = G.flames.filter((f) => f.x < VW + 60);

    const pBox = { x: PX + 18, y: GROUND - PH + 16, w: PW - 40, h: PH - 26 };
    for (const a of G.apples) {
      a.x += a.vx * dt;
      a.vy += a.g * dt;
      a.y += a.vy * dt;
      a.rot += dt * 6;
      if (!a.floater && a.y > GROUND - 60) {   // rebote rodante
        a.y = GROUND - 60;
        a.vy = -Math.abs(a.vy) * 0.55;
        if (Math.abs(a.vy) < 40) a.vy = 0;
      }
      const aBox = { x: a.x + 6, y: a.y + 6, w: 60 - 12, h: 60 - 10 };
      for (const f of G.flames) {
        if (f.dead || a.dead) continue;
        if (f.x + 30 > aBox.x && f.x < aBox.x + aBox.w && f.y + 24 > aBox.y && f.y < aBox.y + aBox.h) {
          f.dead = true;
          burn(a);
        }
      }
      if (!a.dead && G.invuln === 0 &&
          aBox.x < pBox.x + pBox.w && aBox.x + aBox.w > pBox.x &&
          aBox.y < pBox.y + pBox.h && aBox.y + aBox.h > pBox.y) {
        hitPlayer(a);
      }
    }
    G.apples = G.apples.filter((a) => !a.dead && a.x > -80);
    G.flames = G.flames.filter((f) => !f.dead);

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

  function draw() {
    // cielo atardecer
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, '#1b1f3d');
    sky.addColorStop(0.55, '#4a2b52');
    sky.addColorStop(0.85, '#b4502e');
    sky.addColorStop(1, '#e08040');
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
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * 30, (Math.random() - 0.5) * G.shake * 30);

    // manzanas
    for (const a of G.apples) {
      ctx.save();
      ctx.translate(a.x + 30, a.y + 30);
      if (!a.floater && a.g > 0) ctx.rotate(Math.sin(a.rot) * 0.2);
      ctx.drawImage(SPR.apple, -30, -30, 60, 72);
      ctx.restore();
    }

    // flamas
    const fs = SPR.flame[(G.t * 20 | 0) % 3];
    for (const f of G.flames) {
      ctx.drawImage(fs, f.x, f.y, 50, 40);
    }
    if (G.muzzle > 0) {
      ctx.globalAlpha = G.muzzle / 0.12;
      ctx.drawImage(SPR.flame[(G.t * 20 | 0) % 3], PX + PW - 30, GROUND - PH + 28, 60, 48);
      ctx.globalAlpha = 1;
    }

    // Charizard (parpadea al ser invulnerable)
    if (G.invuln === 0 || (G.t * 14 | 0) % 2 === 0) {
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

    if (G.flash > 0) {
      ctx.fillStyle = `rgba(229, 57, 53, ${G.flash * 0.8})`;
      ctx.fillRect(0, 0, VW, VH);
    }
  }

  function loop(t) {
    if (!open) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    if (G.state === 'play') update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function show() {
    if (open) return;
    open = true;
    overlay.hidden = false;
    document.body.classList.add('game-open');
    reset();
    msg('<b>LANZALLAMAS</b><span>Manzanas rebeldes invaden la fiesta. ¡Quémalas antes de que te alcancen!</span><span class="game-final">ESPACIO o toca la pantalla para escupir fuego</span><button class="btn fire" id="game-start" type="button">Empezar</button>');
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
    closeBtn.focus();

    if (TEST) {
      const loader = document.getElementById('loader');
      if (loader) { loader.style.transition = 'none'; loader.classList.add('done'); }
      show();
      if (TEST === 'menu') return;
      start();
      G.apples.push({ x: 520, y: GROUND - 60, vx: 0, vy: 0, g: 0, rot: 0, floater: false });
      G.apples.push({ x: 660, y: GROUND - 140, vx: 0, vy: 0, g: 0, rot: 0, floater: true });
      G.flames.push({ x: 380, y: GROUND - PH + 34, vx: 0, t: 0 });
      G.score = 30; hud();
    }
  }

  function hide() {
    if (!open) return;
    open = false;
    cancelAnimationFrame(raf);
    overlay.hidden = true;
    document.body.classList.remove('game-open');
    openBtn.focus();
  }

  openBtn.addEventListener('click', show);
  closeBtn.addEventListener('click', hide);
  msgEl.addEventListener('click', (e) => {
    if (e.target.closest('#game-start, #game-retry')) start();
  });

  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (G.state === 'menu' || G.state === 'over') start();
      else if (G.state === 'play') shoot();
    } else if (e.key === 'Escape') {
      hide();
    } else if (e.key === 'r' || e.key === 'R') {
      if (G.state === 'over' || G.state === 'pause') start();
    } else if (e.key === 'p' || e.key === 'P') {
      if (G.state === 'play') {
        G.state = 'pause';
        msg('<b>PAUSA</b><span>P para continuar · ESC para salir</span>');
      } else if (G.state === 'pause') {
        G.state = 'play';
        msg('');
      }
    }
  });

  canvas.addEventListener('pointerdown', () => {
    if (G.state === 'menu' || G.state === 'over') start();
    else if (G.state === 'play') shoot();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && open && G.state === 'play') {
      G.state = 'pause';
      msg('<b>PAUSA</b><span>P para continuar · ESC para salir</span>');
    }
  });

  if (TEST) show();
}
