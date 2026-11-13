// ————— Escena 3D · Cumpleaños Legendario (Charizard) —————
// Coreografía scroll-driven: rotación 360° → ficha Pokédex → vuelo → regreso final.
// Charizard está siempre en modo vuelo: aletea en bucle con su animación esquelética.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// RNG sembrado: todo lo "aleatorio" es reproducible
function mulberry32(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261220);

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

const BG = new THREE.Color(0x0a0c12);

// Modelo animado «charizard waiting his host» (mozyapene, CC BY 4.0), optimizado:
// solo el tramo de vuelo estacionario, que cierra en bucle a los 13,04 s.
const CHAR_URL = 'models/charizard-vuelo.glb';
const CHAR_HEIGHT = 2.7;          // alto normalizado con las alas desplegadas
const HIPS_BONE = 'Bone_char';    // cadera: referencia para anular la deriva del vuelo

// Anclas Pokédex: huesos del esqueleto, así las etiquetas siguen la animación
const CHAR_ANCHORS = {
  wing:  { bone: 'Bone097_char', title: 'Alas ígneas',   text: 'Vuela a más de 1.400 m de altura.' },
  flame: { bone: 'Bone026_char', title: 'Llama eterna',  text: 'Arde más fuerte cuando está feliz… ¡como hoy!' },
  fangs: { bone: 'Bone029_char', title: 'Colmillos dracón', text: 'Sonríe para la foto del cumpleaños.' },
  claws: { bone: 'Bone075_char', title: 'Garras campeón', text: 'Listas para romper la piñata.' },
};

export function initScene(canvas) {
  // ——— Renderer ———
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 12, 46);

  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 220);

  // ——— Post: bloom para fuego y neones ———
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.65, 0.78);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ——— Luces ———
  scene.add(new THREE.HemisphereLight(0x2a3c5c, 0x120c08, 0.35));
  const key = new THREE.DirectionalLight(0xffd9a8, 2.3);
  key.position.set(6, 10, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x35e0d4, 0.6);
  rim.position.set(-8, 4, -6);
  scene.add(rim);
  const fireLight = new THREE.PointLight(0xff6a00, 12, 14, 1.8);
  fireLight.position.set(0, 0.7, 0);
  scene.add(fireLight);

  // ——— Suelo infinito + disco de fuego ———
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(160, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.95 })
  );
  scene.add(ground);

  function radialTexture(inner, outer) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, inner);
    grad.addColorStop(1, outer);
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.8, 3.8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,122,26,0.75)', 'rgba(255,122,26,0)'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
  );
  glow.position.y = 0.03;
  scene.add(glow);

  function makeBlob() {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'),
        transparent: true, depthWrite: false,
      })
    );
    m.position.y = 0.02;
    scene.add(m);
    return m;
  }
  const blobChar = makeBlob();

  // ——— Rocas flotantes lejanas (masas distantes más allá de la niebla) ———
  const rocks = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 26 + rand() * 34;
    const s = 1.5 + rand() * 4.5;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), rockMat);
    rock.position.set(Math.cos(a) * r, (rand() - 0.35) * 9 + 2, Math.sin(a) * r);
    rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    rock.scale.y = 0.5 + rand() * 0.6;
    rocks.add(rock);
  }
  scene.add(rocks);

  // ——— Estrellas ———
  {
    const n = 320;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2, r = 40 + rand() * 60;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 6 + rand() * 46;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xbfd0ff, size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.7, fog: false,
    }));
    scene.add(stars);
  }

  // ——— Brasas de fuego (shader de puntos) ———
  const EMBERS = 900;
  const emberUniforms = {
    uTime: { value: 0 },
    uHeight: { value: 13 },
    uIntensity: { value: 0.75 },
  };
  {
    const seed = new Float32Array(EMBERS);
    const rad = new Float32Array(EMBERS);
    const speed = new Float32Array(EMBERS);
    const size = new Float32Array(EMBERS);
    const pos = new Float32Array(EMBERS * 3);
    for (let i = 0; i < EMBERS; i++) {
      seed[i] = rand();
      rad[i] = 1.5 + rand() * 22;
      speed[i] = 0.5 + rand() * 1.6;
      size[i] = 0.35 + rand() * 1.1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: emberUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        attribute float aSeed; attribute float aRad; attribute float aSpeed; attribute float aSize;
        uniform float uTime; uniform float uHeight;
        varying float vLife; varying float vSeed;
        void main() {
          float life = fract(aSeed + uTime * aSpeed * 0.045);
          float ang = aSeed * 6.2831 + uTime * 0.12 * aSpeed;
          vec3 p = vec3(cos(ang) * aRad, life * uHeight, sin(ang) * aRad);
          p.x += sin(uTime * 0.9 + aSeed * 43.0) * 0.35;
          vLife = life; vSeed = aSeed;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * (80.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform float uIntensity;
        varying float vLife; varying float vSeed;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          float alpha = smoothstep(0.5, 0.05, d) * (1.0 - vLife) * uIntensity;
          vec3 hot = vec3(1.0, 0.85, 0.45);
          vec3 ember = vec3(1.0, 0.42, 0.10);
          vec3 teal = vec3(0.20, 0.88, 0.83);
          vec3 col = mix(hot, ember, vLife);
          if (vSeed > 0.92) col = mix(col, teal, 0.8);   // algunas chispas cian
          gl_FragColor = vec4(col, alpha);
        }`,
    });
    scene.add(new THREE.Points(g, mat));
  }

  // ——— Pokéball procedural ———
  function makePokeball(r) {
    const g = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xe3352b, roughness: 0.32, metalness: 0.15 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.42 });
    const black = new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.5 });
    const top = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), white);
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, r * 0.075, 14, 56).rotateX(Math.PI / 2), black);
    const btnOut = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.30, r * 0.30, r * 0.10, 28).rotateX(Math.PI / 2), black);
    btnOut.position.z = r * 0.96;
    const btnIn = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, r * 0.12, 24).rotateX(Math.PI / 2), white);
    btnIn.position.z = r * 0.99;
    g.add(top, bot, band, btnOut, btnIn);
    return g;
  }
  const pokeball = makePokeball(0.42);
  pokeball.position.set(2.9, 0.42, -0.8);
  pokeball.scale.setScalar(0.0001);
  scene.add(pokeball);

  // ——— Confeti final ———
  const CONFETTI = 160;
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.085, 0.13),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    CONFETTI
  );
  confetti.frustumCulled = false;
  const confettiData = [];
  {
    const palette = [new THREE.Color(0xe86a16), new THREE.Color(0xd9a53a), new THREE.Color(0x2bbdb2), new THREE.Color(0xbfbfb8), new THREE.Color(0xd94588)];
    const color = new THREE.Color();
    for (let i = 0; i < CONFETTI; i++) {
      confettiData.push({
        x: (rand() - 0.5) * 7,
        z: (rand() - 0.5) * 4 + 0.5,
        y0: 3.2 + rand() * 3.2,
        fall: 1.6 + rand() * 1.8,
        sway: 0.3 + rand() * 0.7,
        rot: rand() * Math.PI * 2,
        spin: 2 + rand() * 5,
      });
      color.copy(palette[(rand() * palette.length) | 0]);
      confetti.setColorAt(i, color);
    }
    confetti.count = 0;
  }
  scene.add(confetti);

  // ——— Grupos de modelos ———
  const charGroup = new THREE.Group();
  scene.add(charGroup);

  const anchors = {};
  for (const [k, def] of Object.entries(CHAR_ANCHORS)) {
    const o = new THREE.Object3D();
    o.name = `anchor-${k}`;
    charGroup.add(o);
    anchors[k] = { obj: o, ...def };
  }

  // ——— Carga de modelos ———
  const loader = new GLTFLoader();
  const state = {
    progress: 0, target: 0, time: 0, animTime: 0,
    ready: false, failed: false,
    charBox: null,
  };
  // Animación de vuelo (se rellena al cargar)
  const flight = { mixer: null, duration: 1, model: null, hips: null, base: new THREE.Vector3(), hips0: new THREE.Vector3(), tail: null };
  const tmpV = new THREE.Vector3();

  function normalize(obj, targetH) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, true);
    const size = box.getSize(new THREE.Vector3());
    const s = targetH / (size.y || 1);
    obj.scale.setScalar(s);
    obj.updateMatrixWorld(true);
    box.setFromObject(obj, true);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.z -= center.z;
    obj.position.y -= box.min.y;
    obj.updateMatrixWorld(true);
    box.setFromObject(obj, true);
    return box;
  }

  async function loadModels() {
    const charGlb = await loader.loadAsync(CHAR_URL);

    // Charizard en vuelo: mixer en la pose inicial antes de medir
    const char = charGlb.scene;
    char.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; } });
    const clip = charGlb.animations[0];
    flight.mixer = new THREE.AnimationMixer(char);
    flight.mixer.clipAction(clip).play();
    flight.mixer.setTime(0);
    flight.duration = clip.duration;

    const cbox = normalize(char, CHAR_HEIGHT);
    charGroup.add(char);
    charGroup.position.copy(CHAR_HOME);
    state.charBox = cbox;
    flight.model = char;
    flight.base.copy(char.position);

    const bone = (name) => char.getObjectByName(name);
    flight.hips = bone(HIPS_BONE);
    flight.tail = bone(CHAR_ANCHORS.flame.bone);
    charGroup.updateMatrixWorld(true);
    if (flight.hips) charGroup.worldToLocal(flight.hips.getWorldPosition(flight.hips0));
    for (const [k, def] of Object.entries(CHAR_ANCHORS)) {
      const b = bone(def.bone);
      if (b) anchors[k].obj = b;
    }
    console.log('[scene] charizard bbox', JSON.stringify(cbox.getSize(new THREE.Vector3())), 'loop', clip.duration.toFixed(2));
  }

  // Avanza el vuelo y anula la deriva horizontal de la cadera,
  // para que Charizard aletee en su sitio y la coreografía mande
  function updateFlight(t) {
    if (!flight.mixer) return;
    flight.mixer.setTime(t % flight.duration);
    const m = flight.model;
    m.position.copy(flight.base);
    if (!flight.hips) return;
    charGroup.updateMatrixWorld(true);
    charGroup.worldToLocal(flight.hips.getWorldPosition(tmpV)).sub(flight.hips0);
    m.position.x -= tmpV.x;
    m.position.z -= tmpV.z;
    m.position.y -= tmpV.y * 0.6;   // conserva parte del sube y baja del aleteo
  }

  // ——— Recorrido de cámara alineado con las secciones del scroll ———
  const CAM_KEYS = [
    { p: 0.00, pos: [6.2, 3.5, 7.6], tgt: [0, 2.5, 0] },
    { p: 0.10, pos: [3.7, 2.4, 4.9], tgt: [0, 2.4, 0] },
    { p: 0.26, pos: [3.0, 2.2, 4.1], tgt: [0, 2.4, 0] },
    { p: 0.38, pos: [3.5, 2.7, 4.8], tgt: [0, 2.4, 0] },
    { p: 0.48, pos: [3.6, 2.3, 5.2], tgt: [0, 2.3, 0] },
    { p: 0.57, pos: [1.2, 1.5, 5.6], tgt: [0, 2.1, 0] },
    { p: 0.70, pos: [0.7, 1.3, 5.0], tgt: [0, 1.6, 0] },
    { p: 0.80, pos: [0.2, 1.4, 4.4], tgt: [0.3, 1.4, 0] },
    { p: 0.94, pos: [0.0, 1.5, 4.0], tgt: [0.5, 1.5, 0] },
    { p: 1.00, pos: [0.0, 1.5, 4.0], tgt: [0.5, 1.5, 0] },
  ];
  function camAt(p, outPos, outTgt) {
    let i = 0;
    while (i < CAM_KEYS.length - 2 && p > CAM_KEYS[i + 1].p) i++;
    const a = CAM_KEYS[i], b = CAM_KEYS[i + 1];
    const t = smooth(a.p, b.p, p);
    outPos.set(
      lerp(a.pos[0], b.pos[0], t),
      lerp(a.pos[1], b.pos[1], t),
      lerp(a.pos[2], b.pos[2], t)
    );
    outTgt.set(
      lerp(a.tgt[0], b.tgt[0], t),
      lerp(a.tgt[1], b.tgt[1], t),
      lerp(a.tgt[2], b.tgt[2], t)
    );
  }

  const CHAR_HOME = new THREE.Vector3(0, 1.25, 0);   // en el aire, sobre el disco de fuego
  // En la portada horizontal se aparta a la derecha para no tapar el titular
  const HERO_SHIFT = new THREE.Vector3(1.55, 0.35, -1.25);
  const dbg = (k, v) => (window.__dbg && window.__dbg[k] !== undefined ? window.__dbg[k] : v);
  const CHAR_FAR = new THREE.Vector3(4.2, 3.6, -5.5);
  const CHAR_CAMEO = new THREE.Vector3(3.4, 2.7, -3.2);
  const CHAR_CAMEO_P = new THREE.Vector3(1.5, 3.0, -2.0); // cameo en pantallas verticales
  const dummy = new THREE.Object3D();
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();

  function apply(p, time, live) {
    const wob = live ? 1 : 0;

    // Cámara (con alejamiento extra en pantallas estrechas)
    const portrait = innerWidth / innerHeight < 0.8;
    camAt(p, camPos, camTgt);
    camPos.x += Math.sin(time * 0.5) * 0.06 * wob;
    camPos.y += Math.sin(time * 0.7) * 0.05 * wob;
    if (portrait) {
      camPos.sub(camTgt).multiplyScalar(1.38).add(camTgt);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // Charizard: rotación 360° (0.10→0.26), vuelo de salida (0.48→0.62),
    // regreso triunfal para el RSVP (0.82→0.94)
    const spin = smooth(0.10, 0.26, p) * Math.PI * 2;
    const drift = smooth(0.26, 1, p) * 0.9;
    const flyOut = smooth(0.48, 0.62, p);
    const flyBack = smooth(0.82, 0.94, p);
    // giro de 3/4 hacia la cámara en portada y de perfil en la ficha Pokédex (se ve la cola)
    const yawHero = dbg('yawHero', 0.55) * (1 - smooth(0.06, 0.14, p));
    const yawDex = dbg('yawDex', -0.9) * smooth(0.26, 0.32, p) * (1 - smooth(0.46, 0.52, p));
    charGroup.rotation.y = spin + drift + yawHero + yawDex;
    charGroup.rotation.z = flyOut * (1 - flyBack) * 0.3;
    charGroup.position.lerpVectors(CHAR_HOME, CHAR_FAR, flyOut);
    charGroup.position.lerp(portrait ? CHAR_CAMEO_P : CHAR_CAMEO, flyBack);
    if (!portrait) charGroup.position.addScaledVector(HERO_SHIFT, 1 - smooth(0.04, 0.14, p));
    charGroup.position.y += Math.sin(time * 1.4) * 0.07 * wob;
    const cScale = (1 - flyOut * 0.6) + flyBack * 0.25;
    charGroup.scale.setScalar(Math.max(cScale, 0.001));
    updateFlight(state.animTime);

    // Luz de fuego: nace de la llama de la cola
    fireLight.intensity = 10 + Math.sin(time * 13) * 2.2 * wob + smooth(0.48, 0.64, p) * 7;
    if (flight.tail) {
      flight.tail.getWorldPosition(fireLight.position);
      fireLight.position.y = Math.max(fireLight.position.y, 0.6);
    } else {
      fireLight.position.copy(charGroup.position).y = Math.max(charGroup.position.y - 0.6, 0.6);
    }

    // Brasas
    emberUniforms.uTime.value = time;
    emberUniforms.uIntensity.value = 0.7 + smooth(0.48, 0.64, p) * 0.9 + smooth(0.88, 1, p) * 0.3;

    // Disco de fuego (se atenúa para dar aire a la galería y el RSVP)
    const glowPulse = 1 + Math.sin(time * 2.2) * 0.05 * wob;
    glow.scale.setScalar(glowPulse * (1 + smooth(0.48, 0.64, p) * 0.25));
    glow.position.x = charGroup.position.x * (1 - flyOut);
    glow.position.z = charGroup.position.z * (1 - flyOut);
    glow.material.opacity = (0.3 + smooth(0.48, 0.64, p) * 0.2) * (1 - smooth(0.64, 0.78, p) * 0.5);

    // Sombra de Charizard
    blobChar.position.x = charGroup.position.x;
    blobChar.position.z = charGroup.position.z;
    const hFade = Math.max(1 - (charGroup.position.y - 1.35) / 6, 0);
    blobChar.material.opacity = hFade * ((1 - flyOut * 0.8) + flyBack * 0.35);
    blobChar.scale.setScalar(1 + (1 - hFade) * 1.6);

    // Pokéball (aparece con la galería, 0.62→0.74)
    const pb = smooth(0.62, 0.74, p);
    const pbOver = 1 + Math.sin(Math.min(pb, 1) * Math.PI) * 0.18;
    pokeball.scale.setScalar(Math.max(pb * pbOver, 0.0001));
    pokeball.rotation.y = time * 0.5 * wob + p * 2;
    pokeball.position.y = 0.42 + Math.sin(time * 1.8) * 0.05 * wob;
    pokeball.position.x = portrait ? 1.7 : 2.9;

    // Confeti (0.88→1)
    const cp = smooth(0.88, 1, p);
    confetti.count = cp > 0.001 ? CONFETTI : 0;
    if (confetti.count) {
      for (let i = 0; i < CONFETTI; i++) {
        const d = confettiData[i];
        dummy.position.set(
          d.x + Math.sin(cp * 6 + d.rot) * d.sway,
          d.y0 - cp * d.fall * 1.2,
          d.z
        );
        dummy.rotation.set(d.rot + cp * d.spin, d.rot * 2 + cp * d.spin * 1.3, cp * d.spin);
        dummy.updateMatrix();
        confetti.setMatrixAt(i, dummy.matrix);
      }
      confetti.instanceMatrix.needsUpdate = true;
    }

    // Rocas: deriva lenta
    rocks.rotation.y = time * 0.008 * wob + p * 0.05;
  }

  function render() { composer.render(); }

  // ——— Bucle principal ———
  const clock = new THREE.Clock();
  let rafId = 0;
  function loop() {
    rafId = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    state.time += dt;
    state.progress += (state.target - state.progress) * Math.min(1, dt * 4.5);
    // aleteo más rápido mientras sale volando (0.48→0.62) y vuelve a su ritmo al regresar
    const p = state.progress;
    const hurry = smooth(0.46, 0.56, p) * (1 - smooth(0.62, 0.74, p));
    state.animTime += dt * (1 + hurry * 0.7);
    apply(state.progress, state.time, true);
    render();
  }

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  // ——— API pública ———
  const api = {
    anchors,
    setTarget(p) { state.target = Math.min(1, Math.max(0, p)); },
    seek(p) {
      state.target = state.progress = Math.min(1, Math.max(0, p));
      state.animTime = 0;
      apply(state.progress, state.progress * 40, false);
      render();
    },
    project(obj) {
      const v = new THREE.Vector3();
      obj.getWorldPosition(v).project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * innerWidth,
        y: (-v.y * 0.5 + 0.5) * innerHeight,
        behind: v.z > 1,
      };
    },
    get progress() { return state.progress; },
    ready: null,
  };

  api.ready = loadModels()
    .then(() => {
      apply(0, 0, false);
      render();
      state.ready = true;
      window.__SCENE_READY__ = true;
      window.__renderer = renderer;
    })
    .catch((err) => {
      state.failed = true;
      console.error('[scene] error cargando modelos', err);
      window.__APP_ERRORS__ = window.__APP_ERRORS__ || [];
      window.__APP_ERRORS__.push(String(err));
      throw err;
    });

  window.__seek = (p) => api.seek(p);
  loop();
  return api;
}
