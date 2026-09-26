/**
 * Galaxy Progress Tracker
 * ------------------------
 * Renders each logged training session as a "star" in a 3D constellation
 * built with Three.js. Session load (duration × intensity) and recency
 * feed a 0–100 "stability" score, which in turn drives the look of the
 * scene: star density, shooting-star frequency, nebula glow, and — at
 * low stability — a black hole that grows as training lapses.
 *
 * All data (sessions, star positions, constellation lines) is stored
 * client-side in localStorage. There is no backend.
 */

import * as THREE from 'three';

// New visitors start with an empty galaxy — sessions are added as the
// user logs them, then persisted to localStorage.
const DEFAULT_SESSIONS = [];
const DEFAULT_SESSION_POSITIONS = [];
const DEFAULT_LINES = [];

// NOTE: these keys still carry the project's old codename ("boomCycle").
// Left as-is to avoid changing behavior for anyone with existing saved
// data — rename only if you're fine with a one-time reset for users.
const STORAGE_KEYS = {
  sessions: 'boomCycleSessions',
  positions: 'boomCyclePositions',
  lines: 'boomCycleLines',
};

// Load data from localStorage with fallbacks
function loadFromStorage() {
  let sessions = DEFAULT_SESSIONS;
  let positions = DEFAULT_SESSION_POSITIONS;
  let lines = DEFAULT_LINES;

  try {
    // Check if data exists; if not, save defaults
    if (!localStorage.getItem(STORAGE_KEYS.sessions)) {
      localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(DEFAULT_SESSIONS));
      localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(DEFAULT_SESSION_POSITIONS));
      localStorage.setItem(STORAGE_KEYS.lines, JSON.stringify(DEFAULT_LINES));
    }

    // Now load from localStorage
    const storedSessions = localStorage.getItem(STORAGE_KEYS.sessions);
    const storedPositions = localStorage.getItem(STORAGE_KEYS.positions);
    const storedLines = localStorage.getItem(STORAGE_KEYS.lines);

    if (storedSessions) sessions = JSON.parse(storedSessions);
    if (storedPositions) positions = JSON.parse(storedPositions);
    if (storedLines) lines = JSON.parse(storedLines);
  } catch (e) {
    console.warn('Failed to load/save localStorage, using defaults:', e);
  }

  return { sessions, positions, lines };
}

// Save data to localStorage
function saveToStorage(sessions, positions, lines) {
  try {
    localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
    localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(positions));
    localStorage.setItem(STORAGE_KEYS.lines, JSON.stringify(lines));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Load on startup
const { sessions, positions, lines } = loadFromStorage();

// Assign to variables (now mutable)
let loadedPositions = positions;
let loadedLines = lines;
let loadedSessions = sessions;

let hoveredSessionData = null;

// loader

const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loader-bar-fill');
const loaderSub = document.getElementById('loader-sub');
let loadPct = 0;
const loaderTick = setInterval(() => {
  loadPct += Math.random() * 14;
  if (loadPct >= 100) {
    loadPct = 100;
    clearInterval(loaderTick);
    setTimeout(() => loaderEl.classList.add('hidden'), 500);
  }
  loaderFill.style.width = loadPct + '%';
}, 60);
setTimeout(() => {
  if (!loaderEl.classList.contains('hidden')) {
    loaderSub.textContent = '⚠ Taking too long — check internet connection';
    loaderSub.style.color = 'rgba(255,180,100,0.5)';
  }
}, 8000);

//  UI PANEL HANDLING (log form)

const logTrainingSessionPanel = document.getElementById('logTrainingSessionPanel');
const logBtn = document.getElementById('log-btn');
const saveBtn = document.getElementById('savebutton');

let lineGroup = new THREE.Group();
let sessionGroup = new THREE.Group();

// hide panel initially
if (logTrainingSessionPanel) logTrainingSessionPanel.style.display = 'none';

// toggle panel when log button clicked
if (logBtn && logTrainingSessionPanel) {
  logBtn.addEventListener('click', () => {
    if (
      logTrainingSessionPanel.style.display === 'none' ||
      logTrainingSessionPanel.style.display === ''
    ) {
      logTrainingSessionPanel.style.display = 'block';
    } else {
      logTrainingSessionPanel.style.display = 'none';
    }
  });
}

// Reorders sessions (and their matching positions) by date, oldest first.
function sortSessionsChronologically() {
  const combined = loadedSessions.map((session, index) => ({
    session,
    position: loadedPositions[index],
  }));

  combined.sort((a, b) => new Date(a.session.date) - new Date(b.session.date));

  loadedSessions = combined.map((item) => item.session);
  loadedPositions = combined.map((item) => item.position);
}

// Rebuilds the constellation lines so each session connects to the next
// one chronologically (index 0-1, 1-2, 2-3, ...).
function rebuildLinesSequentially() {
  loadedLines = [];

  for (let i = 1; i < loadedSessions.length; i++) {
    loadedLines.push([i - 1, i]);
  }
}

// Reads the log-session form, validates it, and (if valid) saves a new
// session and refreshes the scene, stability score, and badges.
function addSessionFromForm() {
  const activity = document.getElementById('activity').value;
  const duration = parseFloat(document.getElementById('duration').value);
  const intensity = parseFloat(document.getElementById('intensity').value);
  const date = document.getElementById('date').value;

  document.getElementById('date-error').textContent = '';
  document.getElementById('activity-error').textContent = '';
  document.getElementById('duration-error').textContent = '';
  document.getElementById('intensity-error').textContent = '';
  document.getElementById('date').value = '';

  if (!activity) {
    document.getElementById('activity-error').textContent = 'Please select an activity.';
    return;
  }

  if (isNaN(duration) || duration <= 0 || duration > 300) {
    document.getElementById('duration-error').textContent =
      'Duration must be between 1 and 300 minutes.';
    return;
  }

  if (isNaN(intensity) || intensity < 1 || intensity > 10) {
    document.getElementById('intensity-error').textContent = 'Intensity must be between 1 and 10.';
    return;
  }

  if (!date) {
    document.getElementById('date-error').textContent = 'Please select a date.';
    return;
  }

  const newSession = {
    activity,
    duration,
    rpe: intensity,
    date,
  };

  loadedSessions.push(newSession);
  loadedPositions.push([
    (Math.random() - 0.5) * 400,
    (Math.random() - 0.5) * 200,
    -150 + Math.random() * 100,
  ]);

  sortSessionsChronologically();
  rebuildLinesSequentially();

  saveToStorage(loadedSessions, loadedPositions, loadedLines);
  syncPositionsAndLines();
  refreshStability();
  updateBadges(true);

  if (logTrainingSessionPanel) logTrainingSessionPanel.style.display = 'none';
}

if (saveBtn) {
  saveBtn.addEventListener('click', addSessionFromForm);
}

// Function to sync the Three.js scene with updated session data
function syncPositionsAndLines() {
  // Remove existing groups from scene
  scene.remove(sessionGroup);
  scene.remove(lineGroup);

  const emptyMsg = document.getElementById('empty-message');

  if (loadedSessions.length === 0) {
    if (emptyMsg) emptyMsg.classList.add('show');
  } else {
    if (emptyMsg) emptyMsg.classList.remove('show');
  }

  // Clear existing arrays
  sessionStars.length = 0;
  // Ensure nebula clouds get rebuilt (so the animation loop stays in sync)
  starNebulaList.length = 0;

  // Recreate sessionGroup
  sessionGroup = new THREE.Group();
  loadedSessions.forEach((s, i) => {
    const pos = loadedPositions[i];
    const duration = Number(s.duration) || 0;
    const rpe = Number(s.rpe) || 0;
    const daysAgo = Number(s.daysAgo) || 0;

    const load = duration * rpe;
    const fade = Math.max(0.4, 1 - daysAgo * 0.022);
    const baseSize = Math.min(
      8,
      (rpe === 0 ? 2.0 : Math.max(1.6, 1.2 + (load / 450) * 2.2)) * fade,
    );
    const col = rpeToColor(rpe);
    const starGroup = new THREE.Group();
    starGroup.position.set(...pos);

    // Billboard quad with diffraction spike shader
    const quadSize = baseSize * 24;
    const quadGeo = new THREE.PlaneGeometry(quadSize, quadSize);
    const quadMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: col },
        uBrightness: { value: 0.6 + baseSize * 0.1 },
        uTime: { value: 0 },
        uPhase: { value: i * 2.39 + Math.random() * 1.5 },
      },
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const quad = new THREE.Mesh(quadGeo, quadMat);
    quad.lookAt(camera.position);
    quad.raycast = () => {};
    starGroup.add(quad);

    // Tiny core sphere for raycasting
    const coreGeo = new THREE.SphereGeometry(baseSize * 2.5, 8, 8);
    const coreMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.0,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    starGroup.add(core);

    starGroup.userData = { session: s, quad: quad };
    sessionStars.push(starGroup);

    createNebulaCloud(s, i, starGroup);

    sessionGroup.add(starGroup);
  });
  scene.add(sessionGroup);

  // Recreate lineGroup
  lineGroup = new THREE.Group();
  loadedLines.forEach(([a, b]) => {
    if (a >= loadedSessions.length || b >= loadedSessions.length) return;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...loadedPositions[a]),
      new THREE.Vector3(...loadedPositions[b]),
    ]);
    lineGroup.add(
      new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
          linewidth: 2,
        }),
      ),
    );
  });
  scene.add(lineGroup);
}

// scene

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 5000);
camera.position.set(0, 0, 1);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x00000d);
document.body.appendChild(renderer.domElement);

let stability = 72;

const STATUS_LABELS = [
  { min: 0, label: 'Black Hole Collapse' },
  { min: 20, label: 'Drifting / Fading' },
  { min: 40, label: 'Flickering Stars' },
  { min: 60, label: 'Steady Constellation' },
  { min: 80, label: 'Bright Stable Stars' },
];

function getStatusLabel(val) {
  let label = STATUS_LABELS[0].label;
  for (const s of STATUS_LABELS) {
    if (val >= s.min) label = s.label;
  }
  return label;
}

const sliderEl = document.getElementById('stability-slider');
const valueEl = document.getElementById('stability-value');
const statusEl = document.getElementById('stability-status');
const barFillEl = document.getElementById('stability-bar-fill');
const stateLabelEl = document.getElementById('state-label');

// changes with stability to match legend key

const ACCENT_COLORS = [
  { max: 19, hex: '#9b7be8', r: 155, g: 123, b: 232 }, // purple — Black Hole Collapse
  { max: 39, hex: '#4466cc', r: 68, g: 102, b: 204 }, // dark blue — Drifting / Fading
  { max: 59, hex: '#ffffff', r: 255, g: 255, b: 255 }, // white — Flickering Stars
  { max: 79, hex: '#ffe8c0', r: 255, g: 232, b: 192 }, // gold — Steady Constellation
  { max: 100, hex: '#ffaa55', r: 255, g: 170, b: 85 }, // orange — Bright Stable Stars
];

function getAccentColor(val) {
  for (const c of ACCENT_COLORS) {
    if (val <= c.max) return c;
  }
  return ACCENT_COLORS[ACCENT_COLORS.length - 1];
}

function updateStabilityUI(val) {
  stability = val;
  valueEl.textContent = val;
  statusEl.textContent = '● ' + getStatusLabel(val);
  stateLabelEl.textContent = getStatusLabel(val);
  barFillEl.style.width = val + '%';

  // update accent colour
  const accent = getAccentColor(val);
  const root = document.documentElement.style;
  root.setProperty('--accent', accent.hex);
  root.setProperty('--accent-r', accent.r);
  root.setProperty('--accent-g', accent.g);
  root.setProperty('--accent-b', accent.b);

  // Update bar fill gradient
  const darkerHex = `rgb(${Math.floor(accent.r * 0.4)},${Math.floor(accent.g * 0.4)},${Math.floor(accent.b * 0.4)})`;
  const lighterHex = `rgb(${Math.min(255, Math.floor(accent.r * 1.2))},${Math.min(255, Math.floor(accent.g * 1.2))},${Math.min(255, Math.floor(accent.b * 1.2))})`;
  barFillEl.style.background = `linear-gradient(90deg, ${darkerHex}, ${accent.hex}, ${lighterHex})`;
  barFillEl.style.boxShadow = `0 0 10px rgba(${accent.r},${accent.g},${accent.b},0.5), 0 0 20px rgba(${accent.r},${accent.g},${accent.b},0.25)`;
}

// - Stability is computed from session data
// slider is read only for demonstration, but could be used to override or simulate different stability levels based on hypothetical session data changes
sliderEl.setAttribute('disabled', 'true');
sliderEl.style.opacity = '0.35';
sliderEl.style.pointerEvents = 'none';

// ── Stability logic ──
//
//  Score (0–100) built from three components:
//
//  1. RECENCY LOAD  (0-50 pts)
//     Sum of (Duration × RPE) over 14 days,
//     decayed exponentially so older sessions count less.
//
//  2. CONSISTENCY   (0–30 pts)
//     Points for training on distinct days
//     (Max 30pts at 6+ unique days).
//
//  3. GAP PENALTY   (0–20 pts subtracted)
//     Days since the most recent session.
//     0–2 days - no penalty.
//     3–10 days - linear drop, full 20pt penalty at day 10.
//     >10 days  -  capped at −20.
//
//  No sessions at all - stability 0

const BASELINE_LOAD = 500; // fortnightly load that yields full recency pts
const MAX_CONSISTENCY_DAYS = 6;

function computeStabilityBreakdown(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      score: 0,
      recency: 0,
      consistency: 0,
      gapPenalty: 0,
      daysSinceLast: null,
      recentCount: 0,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Days ago for each session
  const withDays = sessions.map((s) => {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    const daysAgo = Math.max(0, Math.round((now - d) / 86400000));
    return { s, daysAgo };
  });

  // Sort to find most recent
  const sorted = [...withDays].sort((a, b) => a.daysAgo - b.daysAgo);
  const daysSinceLast = sorted[0]?.daysAgo ?? null;

  // 1. Recency load — last 14 days only
  const recent = withDays.filter((x) => x.daysAgo <= 14);
  let loadSum = 0;
  for (const { s, daysAgo } of recent) {
    const load = (Number(s.duration) || 0) * (Number(s.rpe) || 1);
    const weight = Math.exp(-daysAgo / 1); // exponential decay, half-life ~3.5 days
    loadSum += load * weight;
  }
  const recency = Math.min(50, Math.round((loadSum / BASELINE_LOAD) * 50));

  // 2. Consistency — distinct days in last 14
  const distinctDays = new Set(recent.map((x) => x.s.date)).size;
  const consistency = Math.round(
    (Math.min(MAX_CONSISTENCY_DAYS, distinctDays) / MAX_CONSISTENCY_DAYS) * 50,
  );

  // 3. Gap penalty
  let gapPenalty = 0;
  if (daysSinceLast !== null && daysSinceLast > 2) {
    gapPenalty = Math.min(20, Math.round(((daysSinceLast - 1) / 8) * 20));
  }

  const raw = recency + consistency - gapPenalty;
  const score = Math.max(0, Math.min(100, raw));

  return { score, recency, consistency, gapPenalty, daysSinceLast, recentCount: recent.length };
}

// Store breakdown for Why panel
let lastBreakdown = {
  score: 0,
  recency: 0,
  consistency: 0,
  gapPenalty: 0,
  daysSinceLast: null,
  recentCount: 0,
};

function refreshStability() {
  lastBreakdown = computeStabilityBreakdown(loadedSessions);
  const score = lastBreakdown.score;
  sliderEl.value = score;
  updateStabilityUI(score);
}

// Set initial stability from loaded sessions
refreshStability();

const PALETTE = [
  new THREE.Color('#ffc0a0'),
  new THREE.Color('#ffd5b0'),
  new THREE.Color('#fff4e8'),
  new THREE.Color('#ffffff'),
  new THREE.Color('#eef0ff'),
  new THREE.Color('#cce0ff'),
  new THREE.Color('#aacfff'),
  new THREE.Color('#88bbff'),
];

function randomStarColor() {
  const w = [0.04, 0.06, 0.1, 0.32, 0.22, 0.14, 0.08, 0.04];
  let r = Math.random(),
    c = 0;
  for (let i = 0; i < w.length; i++) {
    c += w[i];
    if (r < c) return PALETTE[i];
  }
  return PALETTE[3];
}

//  BACKGROUND STAR FIELD
// Builds one layer of the background starfield as a Points cloud. Each
// point fades in/out based on `uDensity` (tied to stability) and a subset
// twinkle based on `uTwinkleAmt`, so the whole sky reacts to training data.

function buildStarLayer({ count, minR, maxR, minSize, maxSize, opacityMult, flattenY }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const threshold = new Float32Array(count); // density threshold
  const twinkleRand = new Float32Array(count); // random for twinkle eligibility

  for (let i = 0; i < count; i++) {
    const r = minR + Math.random() * (maxR - minR);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * (flattenY || 1.0);
    pos[i * 3 + 2] = r * Math.cos(phi);

    const c = randomStarColor();
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    size[i] = minSize + Math.random() * (maxSize - minSize);
    phase[i] = Math.random() * 6.283;
    threshold[i] = Math.random(); // 0–1: star appears when uDensity > this
    twinkleRand[i] = Math.random(); // 0–1: twinkles when uTwinkleAmt > this
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aThreshold', new THREE.BufferAttribute(threshold, 1));
  geo.setAttribute('aTwinkleRand', new THREE.BufferAttribute(twinkleRand, 1));

  const opa = opacityMult;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPR: { value: renderer.getPixelRatio() },
      uTime: { value: 0 },
      uDensity: { value: 0.72 }, // controlled by stability
      uTwinkleAmt: { value: 0.12 }, // what fraction of stars twinkle
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3  aColor;
      attribute float aPhase;
      attribute float aThreshold;
      attribute float aTwinkleRand;
      varying vec3  vColor;
      varying float vTwinkle;
      varying float vVisible;
      uniform float uPR, uTime, uDensity, uTwinkleAmt;
      void main() {
        // Density gate: hide stars above threshold
        vVisible = step(aThreshold, uDensity);
        if (vVisible < 0.5) {
          gl_PointSize = 0.0;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // off-screen
          vColor = vec3(0.0);
          vTwinkle = 0.0;
          return;
        }
        vColor = aColor;
        // Twinkle: star twinkles if its random < uTwinkleAmt
        float flicker = 1.0;
        if (aTwinkleRand < uTwinkleAmt) {
          flicker = 0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * (2.5 + aPhase) + aPhase * 6.0))
                              * (0.5 + 0.5 * sin(uTime * (4.1 + aPhase * 0.7) + aPhase * 3.0));
        }
        vTwinkle = flicker;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (600.0 / -mvPos.z) * (0.85 + 0.15 * flicker);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3  vColor;
      varying float vTwinkle;
      varying float vVisible;
      void main() {
        if (vVisible < 0.5) discard;
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.0, d);
        float glow = exp(-d * 5.5) * 0.65;
        gl_FragColor = vec4(vColor, (core + glow) * ${opa.toFixed(2)} * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, mat);
}

const bgLayers = [];
bgLayers.push(
  buildStarLayer({
    count: 27000,
    minR: 500,
    maxR: 1200,
    minSize: 0.1,
    maxSize: 0.55,
    opacityMult: 0.5,
  }),
);
bgLayers.push(
  buildStarLayer({
    count: 7800,
    minR: 200,
    maxR: 500,
    minSize: 0.3,
    maxSize: 1.0,
    opacityMult: 0.7,
  }),
);
bgLayers.push(
  buildStarLayer({
    count: 1530,
    minR: 80,
    maxR: 200,
    minSize: 0.6,
    maxSize: 2.0,
    opacityMult: 0.9,
  }),
);
bgLayers.forEach((l) => scene.add(l));

const MW_TILT = 0.52; // ~30 degrees
const MW_COS = Math.cos(MW_TILT);
const MW_SIN = Math.sin(MW_TILT);

//  MILKY WAY BAND
// Builds a tilted band of points simulating a Milky Way — its width also
// scales with stability, so a healthier training routine gets a thicker
// galactic band.

function buildMWBand(count, maxHalfWidth) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const bandDist = new Float32Array(count);

  const refHalfWidth = maxHalfWidth * 0.5; // reference at stability 50

  for (let i = 0; i < count; i++) {
    // Position along the band
    const along = (Math.random() - 0.5) * 2;
    const radius = 100 + Math.random() * 600;
    let x = along * radius + (Math.random() - 0.5) * 40;

    // Perpendicular to band — tight gaussian concentration toward center

    const g =
      (Math.random() +
        Math.random() +
        Math.random() +
        Math.random() +
        Math.random() +
        Math.random() -
        3) /
      3;
    let y = g * maxHalfWidth;

    // Z depth
    let z = -300 + (Math.random() - 0.5) * 400;

    // Normalised distance from center (1.0 = edge at stability 50)
    const nd = Math.abs(y) / refHalfWidth;

    // Apply tilt rotation
    pos[i * 3] = x * MW_COS - y * MW_SIN;
    pos[i * 3 + 1] = x * MW_SIN + y * MW_COS;
    pos[i * 3 + 2] = z;

    // Warm white colour with slight variation
    const w = Math.random() * 0.15;
    col[i * 3] = 0.72 + w;
    col[i * 3 + 1] = 0.75 + w * 0.5;
    col[i * 3 + 2] = 0.88;
    size[i] = 0.06 + Math.random() * 0.35;
    bandDist[i] = nd;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aBandDist', new THREE.BufferAttribute(bandDist, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPR: { value: renderer.getPixelRatio() },
      uBandWidth: { value: 1.44 },
    },
    vertexShader: `
      attribute float aSize;
      attribute vec3  aColor;
      attribute float aBandDist;
      varying vec3  vColor;
      varying float vVis;
      uniform float uPR, uBandWidth;
      void main() {
        vVis = step(aBandDist, uBandWidth);
        if (vVis < 0.5) {
          gl_PointSize = 0.0;
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
          vColor = vec3(0.0);
          return;
        }
        // Soft fade at edges
        float fade = 1.0 - smoothstep(uBandWidth * 0.5, uBandWidth, aBandDist);
        vColor = aColor * fade;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPR * (600.0 / -mvPos.z);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vVis;
      void main() {
        if (vVis < 0.5) discard;
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d) * 0.50);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geo, mat);
}

// 4 layers: tight core
const mwLayers = [];
mwLayers.push(buildMWBand(80000, 50)); // dense core
mwLayers.push(buildMWBand(55000, 100)); // inner band
mwLayers.push(buildMWBand(35000, 170)); // mid band
mwLayers.push(buildMWBand(20000, 260)); // wide outer
mwLayers.forEach((l) => scene.add(l));

const nebulaList = [];

function addNebulaCloud(x, y, z, spread, hexColor, baseOpacity) {
  const count = 600;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    pos[i * 3] = x + (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = y + (Math.random() - 0.5) * spread * 0.45;
    pos[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
    sizes[i] = 10 + Math.random() * 22;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const col = new THREE.Color(hexColor);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPR: { value: renderer.getPixelRatio() },
      uCol: { value: col },
      uOpa: { value: baseOpacity },
    },
    vertexShader: `
      attribute float aSize; uniform float uPR;
      void main() { vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPR*(600.0/-mv.z); gl_Position=projectionMatrix*mv; }
    `,
    fragmentShader: `
      uniform vec3 uCol; uniform float uOpa;
      void main() { vec2 uv=gl_PointCoord-0.5; float d=length(uv); if(d>0.5)discard; gl_FragColor=vec4(uCol,smoothstep(0.5,0.0,d)*uOpa); }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  scene.add(points);
  nebulaList.push({ points, baseOpacity });
}

addNebulaCloud(-120, 20, -80, 220, '#0a1a4a', 0.222);
addNebulaCloud(80, -30, -60, 190, '#150a38', 0.181);
addNebulaCloud(20, 90, -120, 170, '#041a18', 0.153);
addNebulaCloud(-40, -70, -100, 150, '#0d1530', 0.139);

//  BLACK HOLE
// A shader-based black hole that fades into view when stability drops
// below 40, growing more intense the further training has lapsed.

const bhGeo = new THREE.PlaneGeometry(350, 350);
const bhMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uIntensity: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float uIntensity;
    varying vec2 vUv;

    float hash(float n) { return fract(sin(n) * 43758.5453); }
    float noise(float x) {
      float i = floor(x);
      float f = fract(x);
      return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
    }

    void main() {
      vec2 uv = (vUv - 0.5) * 2.0;
      float r = length(uv);
      float angle = atan(uv.y, uv.x);

      float ehR = 0.18 * uIntensity;
      float isVoid = 1.0 - smoothstep(ehR - 0.004, ehR + 0.001, r);

      float photonR = ehR * 1.03;
      float photon = exp(-pow(r - photonR, 2.0) * 15000.0) * 2.5 * uIntensity;
      float innerPhoton = exp(-pow(r - ehR * 1.008, 2.0) * 40000.0) * 1.8 * uIntensity;

      float diskTilt = 0.18;
      float diskY = uv.y / diskTilt;
      float diskR = length(vec2(uv.x, diskY));
      float diskAngle = atan(diskY, uv.x);
      float diskInner = ehR * 1.6;
      float diskOuter = 0.85;
      float diskMask = smoothstep(diskInner - 0.01, diskInner + 0.02, diskR)
                     * smoothstep(diskOuter + 0.05, diskOuter - 0.05, diskR);
      float diskRadial = exp(-(diskR - diskInner) * 3.5) * 0.9 + 0.15;

      float t = uTime * 0.15;
      float streak1 = 0.5 + 0.5 * sin(diskR * 35.0 - t * 2.0 + noise(diskAngle * 2.0 + t) * 3.0);
      float streak2 = 0.5 + 0.5 * sin(diskR * 55.0 + t * 1.5 + diskAngle * 0.5);
      float streak3 = 0.5 + 0.5 * sin(diskR * 20.0 - t * 3.0 + noise(diskR * 10.0) * 2.0);
      float streaks = streak1 * 0.5 + streak2 * 0.3 + streak3 * 0.2;
      streaks = 0.4 + streaks * 0.6;

      float doppler = 1.0 + 0.35 * sin(diskAngle - t * 0.8);
      float disk = diskMask * diskRadial * streaks * doppler * uIntensity;
      float diskBehindVoid = smoothstep(ehR - 0.01, ehR + 0.01, length(uv));
      disk *= diskBehindVoid;

      float lensInner = ehR * 1.06;
      float lensOuter = ehR * 1.6;
      float lensDist = (r - lensInner) / (lensOuter - lensInner);
      float lensMask = smoothstep(0.0, 0.05, lensDist) * smoothstep(1.0, 0.7, lensDist) * uIntensity;
      float lensAngleStrength = pow(abs(sin(angle)), 0.7) * 0.7 + 0.3;
      float lensTexAngle = angle + uTime * 0.08;
      float lensStreaks = 0.5 + 0.5 * sin(lensTexAngle * 6.0 + noise(lensTexAngle * 3.0) * 4.0);
      lensStreaks *= 0.5 + 0.5 * sin(lensTexAngle * 10.0 - uTime * 0.3);
      float lensRing = lensMask * lensAngleStrength * (0.5 + lensStreaks * 0.5);
      lensRing *= exp(-lensDist * 3.0) * 1.2;

      float outerGlow = exp(-r * 2.5) * 0.12 * uIntensity;

      float highlightAngle = angle + 1.5708;
      float highlight = exp(-pow(r - ehR * 1.2, 2.0) * 300.0)
                      * exp(-pow(highlightAngle, 2.0) * 3.0)
                      * 1.5 * uIntensity;

      float brightness = disk + lensRing + photon + innerPhoton + outerGlow + highlight;
      brightness *= (1.0 - isVoid);
      brightness *= smoothstep(1.0, 0.5, r);
      if (brightness < 0.002) discard;

      vec3 white      = vec3(0.95, 0.95, 1.0);
      vec3 brightBlue = vec3(0.55, 0.65, 1.0);
      vec3 midBlue    = vec3(0.3, 0.4, 0.85);
      vec3 deepPurple = vec3(0.25, 0.15, 0.55);

      vec3 col = mix(white, brightBlue, smoothstep(ehR, ehR * 2.5, r));
      col = mix(col, midBlue, smoothstep(ehR * 2.0, ehR * 4.0, r));
      col = mix(col, deepPurple, smoothstep(0.4, 0.8, r));

      float photonMix = (photon + innerPhoton) / max(brightness, 0.01);
      col = mix(col, vec3(1.0), clamp(photonMix * 0.6, 0.0, 1.0));
      float lensMix = lensRing / max(brightness, 0.01);
      col = mix(col, brightBlue, clamp(lensMix * 0.3, 0.0, 1.0));
      float diskMix = disk / max(brightness, 0.01);
      vec3 diskCol = mix(brightBlue, white, diskRadial);
      col = mix(col, diskCol, clamp(diskMix * 0.4, 0.0, 1.0));
      col = mix(col, vec3(1.0, 0.98, 0.95), clamp(highlight * 0.5 / max(brightness, 0.01), 0.0, 1.0));

      gl_FragColor = vec4(col, clamp(brightness, 0.0, 1.0));
    }
  `,
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  side: THREE.DoubleSide,
});

const blackHole = new THREE.Mesh(bhGeo, bhMat);
blackHole.position.set(0, 0, -200);
blackHole.visible = false;
scene.add(blackHole);

// Maps a session's RPE (intensity, 0–10) to its star/legend color.
function rpeToColor(rpe) {
  if (rpe === 0) return new THREE.Color('#9b7be8');
  if (rpe <= 4) return new THREE.Color('#4466cc');
  if (rpe <= 6) return new THREE.Color('#ffffff');
  if (rpe <= 8) return new THREE.Color('#ffe8c0');
  return new THREE.Color('#ffaa55');
}

function createNebulaCloud(s, i, starGroup) {
  const load = s.duration * s.rpe;
  const daysAgo = Number(s.daysAgo) || 0;
  const fade = Math.max(0.4, 1 - daysAgo * 0.022);
  const baseSize = (s.rpe === 0 ? 2.0 : Math.max(1.6, 1.2 + (load / 450) * 2.2)) * fade;
  const col = rpeToColor(s.rpe);

  // Cloud size proportional to star — bigger spread, bigger particles
  const cloudSpread = baseSize * 14;
  const cloudCount = Math.floor(120 + baseSize * 40);

  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(cloudCount * 3);
  const sizes = new Float32Array(cloudCount);

  for (let j = 0; j < cloudCount; j++) {
    // Gaussian distribution centered at origin (0,0,0)
    // Cloud is added to star group so origin = star center
    const gx = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
    const gy = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
    const gz = (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
    positions[j * 3] = gx * cloudSpread;
    positions[j * 3 + 1] = gy * cloudSpread;
    positions[j * 3 + 2] = gz * cloudSpread;
    sizes[j] = 5 + Math.random() * 10;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPR: { value: renderer.getPixelRatio() },
      uCol: { value: new THREE.Vector3(col.r, col.g, col.b) },
      uOpa: { value: 0 },
    },
    vertexShader: `
      attribute float aSize; uniform float uPR;
      void main() { vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uPR*(600.0/-mv.z); gl_Position=projectionMatrix*mv; }
    `,
    fragmentShader: `
      uniform vec3 uCol; uniform float uOpa;
      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float glow = exp(-d * d * 6.0);
        gl_FragColor = vec4(uCol, glow * uOpa);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const cloud = new THREE.Points(geo, mat);
  // Add cloud as child of the session star group — guarantees centering
  starGroup.add(cloud);
  starNebulaList.push(cloud);
}

const starNebulaList = [];

const starVertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const starFragmentShader = `
  uniform vec3 uColor; uniform float uBrightness, uTime, uPhase;
  varying vec2 vUv;
  void main() {
    vec2 uv = vUv - 0.5; float dist = length(uv);
    float breathe = 1.0 + sin(uTime*1.2+uPhase)*0.12 + sin(uTime*2.7+uPhase*1.5)*0.06;
    float twinkle = 1.0 + sin(uTime*4.3+uPhase*3.0)*0.08 * sin(uTime*7.1+uPhase*2.2);
    float core = exp(-dist*18.0); float ig = exp(-dist*6.0)*0.45; float og = exp(-dist*2.5)*0.12;
    float spikes = 0.0; float sr = uTime*0.06+uPhase*0.3;
    for(int i=0;i<3;i++){float a=float(i)*1.0472+sr;float ca=cos(a),sa=sin(a);vec2 r=vec2(uv.x*ca+uv.y*sa,-uv.x*sa+uv.y*ca);spikes+=exp(-abs(r.y)*120.0)*exp(-abs(r.x)*3.5);}
    for(int i=0;i<3;i++){float a=float(i)*1.0472+0.5236+sr;float ca=cos(a),sa=sin(a);vec2 r=vec2(uv.x*ca+uv.y*sa,-uv.x*sa+uv.y*ca);spikes+=exp(-abs(r.y)*160.0)*exp(-abs(r.x)*5.5)*0.35;}
    spikes *= 0.55;
    float r1=exp(-pow(dist-0.12,2.0)*800.0)*0.08; float r2=exp(-pow(dist-0.20,2.0)*600.0)*0.04;
    float em = smoothstep(0.5,0.28,dist);
    float brightness = (core+ig+og+spikes+r1+r2)*uBrightness*em*breathe*twinkle;
    if(brightness<0.001) discard;
    vec3 w=vec3(1.0); vec3 col=mix(uColor,w,core*0.7+ig*0.3);
    vec3 sc=mix(uColor,w,0.5); col=mix(col,sc,spikes*0.4/max(brightness,0.01));
    gl_FragColor = vec4(col, brightness);
  }
`;

const sessionStars = [];

sessions.forEach((s, i) => {
  const pos = loadedPositions[i];
  const load = s.duration * s.rpe;
  const daysAgo = Number(s.daysAgo) || 0;
  const fade = Math.max(0.4, 1 - daysAgo * 0.022);
  const baseSize = (s.rpe === 0 ? 2.0 : Math.max(1.6, 1.2 + (load / 450) * 2.2)) * fade;
  const col = rpeToColor(s.rpe);

  const sg = new THREE.Group();
  sg.position.set(...pos);

  const qSz = baseSize * 24;
  const qMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: col },
      uBrightness: { value: 0.6 + baseSize * 0.1 },
      uTime: { value: 0 },
      uPhase: { value: i * 2.39 + Math.random() * 1.5 },
    },
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(qSz, qSz), qMat);
  quad.lookAt(camera.position);
  quad.raycast = () => {};
  sg.add(quad);

  sg.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(baseSize * 2.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0 }),
    ),
  );

  sg.userData = { session: s, quad };
  sessionStars.push(sg);
  sessionGroup.add(sg);

  createNebulaCloud(s, i, sessionStars[i]);
});
sessionGroup.renderOrder = 10; // always on top of black hole
scene.add(sessionGroup);

//  CONSTELLATION LINES

loadedLines.forEach(([a, b]) => {
  if (a >= loadedSessions.length || b >= loadedSessions.length) return;
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...loadedPositions[a]),
    new THREE.Vector3(...loadedPositions[b]),
  ]);
  lineGroup.add(
    new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        linewidth: 2,
      }),
    ),
  );
});
lineGroup.renderOrder = 10;
scene.add(lineGroup);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const tooltipEl = document.getElementById('tooltip');
const ttActivity = document.getElementById('tt-activity');
const ttDetail = document.getElementById('tt-detail');

window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  let hovered = null;

  for (let sg of sessionStars) {
    if (raycaster.intersectObjects(sg.children, true).length > 0) {
      hovered = sg;
      break;
    }
  }

  if (hovered) {
    const s = hovered.userData.session;

    const when = s.date
      ? s.date
      : s.daysAgo === 0
        ? 'Today'
        : s.daysAgo === 1
          ? 'Yesterday'
          : `${s.daysAgo} days ago`;

    ttActivity.textContent = s.activity;
    ttDetail.textContent =
      (Number(s.rpe) || 0) === 0
        ? `Rest day · ${when}`
        : `${s.duration} min · RPE ${s.rpe} · ${when}`;

    tooltipEl.style.left = e.clientX + 16 + 'px';
    tooltipEl.style.top = e.clientY - 10 + 'px';
    tooltipEl.classList.add('visible');
    document.body.style.cursor = 'pointer';
    hoveredSessionData = s;
  } else {
    tooltipEl.classList.remove('visible');
    document.body.style.cursor = 'default';
    hoveredSessionData = null;
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
let targetZ = camera.position.z;
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    targetZ += e.deltaY * 0.15;
    targetZ = Math.max(-350, Math.min(180, targetZ));
  },
  { passive: false },
);

//  SHOOTING STARS — frequency scales with stability

const MAX_SHOOTING_STARS = 8;
const shootingStars = [];

function createShootingStar() {
  const geo = new THREE.BufferGeometry();
  const tl = 50;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tl * 3), 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(tl), 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: `attribute float aAlpha;varying float vA;void main(){vA=aAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying float vA;void main(){gl_FragColor=vec4(0.85,0.9,1.0,vA);}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  scene.add(line);
  return {
    mesh: line,
    geo,
    tl,
    active: false,
    progress: 0,
    speed: 0,
    totalDist: 0,
    origin: new THREE.Vector3(),
    dir: new THREE.Vector3(),
  };
}

for (let i = 0; i < MAX_SHOOTING_STARS; i++) shootingStars.push(createShootingStar());

function getShootingStarInterval() {
  if (stability <= 5) return 99999;
  // stability 20 → ~16s, 50 → ~8s, 72 → ~4.5s, 100 → ~1s
  const t = stability / 100;
  return Math.max(0.8, 12 * (1 - t * t)) + Math.random() * Math.max(0.5, 4 * (1 - t));
}

let nextSS = 2; // first one fires quickly

// Recalculate next shooting star time when slider moves
sliderEl.addEventListener('input', () => {
  const t = clock.getElapsedTime();
  // If stability dropped low, push nextSS far away
  // If stability went high, allow one soon
  nextSS = t + getShootingStarInterval() * 0.3; // allow a quick one after change
});

function launchSS() {
  const s = shootingStars.find((s) => !s.active);
  if (!s) return;
  const a = Math.random() * Math.PI * 2,
    el = (Math.random() - 0.3) * 1.2,
    d = 200 + Math.random() * 400;
  s.origin.set(Math.cos(a) * d * Math.cos(el), Math.sin(el) * d * 0.6, -100 + Math.random() * -300);
  s.dir
    .set(
      -Math.sign(s.origin.x) * (0.5 + Math.random() * 0.5),
      -0.2 - Math.random() * 0.3,
      -0.1 + Math.random() * 0.2,
    )
    .normalize();
  s.totalDist = 600 + Math.random() * 400;
  s.speed = 280 + Math.random() * 180;
  s.progress = 0;
  s.active = true;
  s.mesh.visible = true;
}

function updateSS(dt) {
  shootingStars.forEach((s) => {
    if (!s.active) return;
    s.progress += s.speed * dt;
    if (s.progress > s.totalDist + s.tl * 5) {
      s.active = false;
      s.mesh.visible = false;
      return;
    }
    const p = s.geo.attributes.position.array,
      al = s.geo.attributes.aAlpha.array;
    for (let i = 0; i < s.tl; i++) {
      const td = s.progress - i * 4;
      const pt = s.origin.clone().addScaledVector(s.dir, Math.max(0, td));
      p[i * 3] = pt.x;
      p[i * 3 + 1] = pt.y;
      p[i * 3 + 2] = pt.z;
      al[i] = (td > 0 ? 1 : 0) * (1 - i / s.tl) * 0.6;
    }
    s.geo.attributes.position.needsUpdate = true;
    s.geo.attributes.aAlpha.needsUpdate = true;
  });
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta(),
    t = clock.getElapsedTime();

  // ── Smooth zoom ──
  camera.position.z += (targetZ - camera.position.z) * 0.06;

  // ── Compute dynamic values from stability ──
  const sNorm = stability / 100; // 0–1
  const density = sNorm; // star density threshold
  // Twinkle: 0 at stability 0, 0.12 at 72, 0.35 at 100
  const twinkleAmt = sNorm * 0.35;
  // Nebula opacity scale
  const nebulaScale = sNorm;

  // ── Update background star uniforms ──
  bgLayers.forEach((layer) => {
    layer.material.uniforms.uTime.value = t;
    layer.material.uniforms.uDensity.value = density;
    layer.material.uniforms.uTwinkleAmt.value = twinkleAmt;
  });

  // ── Update milky way band width ──
  // 0 = no band, 50 = reference width (1.0), 100 = double (2.0)
  const bandWidth = stability / 50;
  mwLayers.forEach((l) => {
    l.material.uniforms.uBandWidth.value = bandWidth;
  });

  // ── Update nebula opacity ──
  nebulaList.forEach((n) => {
    n.points.material.uniforms.uOpa.value = n.baseOpacity * nebulaScale;
  });

  // ── Update session star nebula clouds — forms 60→100 ──
  const cloudIntensity = stability > 60 ? (stability - 60) / 40 : 0; // 0 below 60, 1 at 100
  const cloudBaseOpa = 0.12; // max opacity at stability 100
  starNebulaList.forEach((cloud) => {
    cloud.material.uniforms.uOpa.value = cloudBaseOpa * cloudIntensity;
  });

  // ── Black hole — forms below stability 40 ──
  if (stability < 40) {
    blackHole.visible = true;
    const bhIntensity = 1 - stability / 40;
    bhMat.uniforms.uIntensity.value = bhIntensity;
    bhMat.uniforms.uTime.value = t;
    blackHole.lookAt(camera.position);
    const bhPulse = 1.0 + Math.sin(t * 0.5) * 0.03 * bhIntensity;
    blackHole.scale.setScalar(bhPulse);
  } else {
    blackHole.visible = false;
  }

  //  Constellation drift
  sessionGroup.rotation.y = Math.sin(t * 0.04) * 0.06;
  sessionGroup.rotation.x = Math.sin(t * 0.025) * 0.03;
  lineGroup.rotation.copy(sessionGroup.rotation);

  // Line shimmer
  lineGroup.children.forEach((l, i) => {
    l.material.opacity = 0.35 + Math.sin(t * 0.8 + i * 1.7) * 0.1;
  });

  // Session star twinkle and breathe
  sessionStars.forEach((sg, i) => {
    const q = sg.userData.quad;
    if (q) {
      q.lookAt(camera.position);
      q.material.uniforms.uTime.value = t;
      sg.scale.setScalar(1 + Math.sin(t * 1.2 + i * 2.39) * 0.06);
    }
  });

  //  Shooting stars
  if (stability > 5 && t > nextSS) {
    launchSS();
    // At high stability, chance to fire a second one simultaneously
    if (stability > 70 && Math.random() < (stability - 70) / 60) {
      launchSS();
    }
    // At very high stability, chance for a third
    if (stability > 90 && Math.random() < 0.3) {
      launchSS();
    }
    nextSS = t + getShootingStarInterval();
  }
  updateSS(dt);

  renderer.render(scene, camera);
}

const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settingsPanel');
const clearAllBtn = document.getElementById('clear-all-btn');
const deleteSessionBtn = document.getElementById('delete-session-btn');

if (settingsPanel) settingsPanel.style.display = 'none';

if (settingsBtn && settingsPanel) {
  settingsBtn.addEventListener('click', () => {
    const hidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';

    settingsPanel.style.display = hidden ? 'block' : 'none';
  });
}

const confirmClearModal = document.getElementById('confirmClearModal');
const confirmClearCancel = document.getElementById('confirmClearCancel');
const confirmClearConfirm = document.getElementById('confirmClearConfirm');

if (clearAllBtn) {
  clearAllBtn.addEventListener('click', () => {
    if (confirmClearModal) {
      confirmClearModal.classList.add('show');
    }
  });
}

if (confirmClearCancel) {
  confirmClearCancel.addEventListener('click', () => {
    confirmClearModal.classList.remove('show');
  });
}

if (confirmClearConfirm) {
  confirmClearConfirm.addEventListener('click', () => {
    loadedSessions = [];
    loadedPositions = [];
    loadedLines = [];
    unlockedBadges.clear();

    saveToStorage(loadedSessions, loadedPositions, loadedLines);
    syncPositionsAndLines();
    refreshStability();
    updateBadges();

    if (tooltipEl) tooltipEl.classList.remove('visible');
    if (settingsPanel) settingsPanel.style.display = 'none';
    confirmClearModal.classList.remove('show');
  });
}

if (confirmClearModal) {
  confirmClearModal.addEventListener('click', (e) => {
    if (e.target === confirmClearModal) {
      confirmClearModal.classList.remove('show');
    }
  });
}

const confirmSingleClearModal = document.getElementById('confirmSingleClearModal');
const confirmSingleClearCancel = document.getElementById('confirmSingleClearCancel');

if (deleteSessionBtn) {
  deleteSessionBtn.addEventListener('click', () => {
    if (confirmSingleClearModal) {
      const sessionList = document.getElementById('sessionList');
      sessionList.innerHTML = ''; // Clear existing list
      loadedSessions.forEach((session, index) => {
        const li = document.createElement('li');
        li.textContent = `${session.activity} - ${session.duration} min - ${session.date || 'No date'}`;
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.addEventListener('click', () => {
          // Delete the session
          loadedSessions.splice(index, 1);
          loadedPositions.splice(index, 1);
          loadedLines = loadedLines.filter(([a, b]) => a !== index && b !== index);
          // Adjust indices in lines for sessions after the deleted one
          loadedLines = loadedLines.map(([a, b]) => [a > index ? a - 1 : a, b > index ? b - 1 : b]);
          saveToStorage(loadedSessions, loadedPositions, loadedLines);
          syncPositionsAndLines();
          refreshStability();
          updateBadges();

          if (tooltipEl) tooltipEl.classList.remove('visible');
          // Refresh the list
          deleteSessionBtn.click(); // Re-populate the list
        });
        li.appendChild(deleteBtn);
        sessionList.appendChild(li);
      });
      confirmSingleClearModal.classList.add('show');
    }
  });
}

if (confirmSingleClearCancel) {
  confirmSingleClearCancel.addEventListener('click', () => {
    confirmSingleClearModal.classList.remove('show');
  });
}

if (confirmSingleClearModal) {
  confirmSingleClearModal.addEventListener('click', (e) => {
    if (e.target === confirmSingleClearModal) {
      confirmSingleClearModal.classList.remove('show');
    }
  });
}

const guideBtn = document.getElementById('guide-btn');
const guidePanel = document.getElementById('guidePanel');

if (guidePanel) guidePanel.style.display = 'none';

if (guideBtn && guidePanel) {
  guideBtn.addEventListener('click', () => {
    const hidden = guidePanel.style.display === 'none' || guidePanel.style.display === '';

    guidePanel.style.display = hidden ? 'block' : 'none';
  });
}

const resetCameraBtn = document.getElementById('reset-camera-btn');
const toggleLinesBtn = document.getElementById('toggle-lines-btn');
const exportSessionsBtn = document.getElementById('export-sessions-btn');

let rotationEnabled = true;
let linesVisible = true;

if (resetCameraBtn) {
  resetCameraBtn.addEventListener('click', () => {
    camera.position.set(0, 0, 1);
    targetZ = 1;
  });
}

if (toggleLinesBtn) {
  toggleLinesBtn.addEventListener('click', () => {
    linesVisible = !linesVisible;
    lineGroup.visible = linesVisible;
  });
}

if (exportSessionsBtn) {
  exportSessionsBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(loadedSessions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'training-sessions.json';
    a.click();

    URL.revokeObjectURL(url);
  });
}

//  Why panel
const whyPanel = document.getElementById('whyPanel');
const whyBtn = document.getElementById('why-btn');
const whyClose = document.getElementById('whyPanel-close');

if (whyPanel) whyPanel.classList.remove('show');

function openWhyPanel() {
  const b = lastBreakdown;
  document.getElementById('whyPanel-score').textContent = b.score;
  document.getElementById('why-recency').textContent = `${b.recency} / 50`;
  document.getElementById('why-consistency').textContent = `${b.consistency} / 50`;
  const gapSign = b.gapPenalty > 0 ? `−${b.gapPenalty}` : '0';
  document.getElementById('why-gap').textContent = gapSign;
  const gapSub = document.getElementById('why-gap-sub');
  gapSub.textContent =
    b.daysSinceLast !== null
      ? `(last session ${b.daysSinceLast === 0 ? 'today' : b.daysSinceLast === 1 ? 'yesterday' : `${b.daysSinceLast}d ago`})`
      : '';

  // Tip message
  const tipEl = document.getElementById('whyPanel-tip');
  if (b.score === 0 && b.recentCount === 0) {
    tipEl.textContent = 'Log your first session to start building stability.';
  } else if (b.gapPenalty >= 15) {
    tipEl.textContent = `It's been ${b.daysSinceLast} days — your constellation is fading. Log a session to recover.`;
  } else if (b.consistency < 15) {
    tipEl.textContent = 'Try spreading sessions across more days in the week to boost consistency.';
  } else if (b.recency < 20) {
    tipEl.textContent = 'Increase session load (duration × intensity) to strengthen your stars.';
  } else {
    tipEl.textContent = 'Keep training consistently to maintain a bright, stable constellation.';
  }

  if (whyPanel) {
    whyPanel.style.display = 'block';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        whyPanel.classList.add('show');
      });
    });
  }
}

if (whyBtn) whyBtn.addEventListener('click', openWhyPanel);
if (whyClose)
  whyClose.addEventListener('click', () => {
    whyPanel.classList.remove('show');
    setTimeout(() => {
      whyPanel.style.display = 'none';
    }, 50); // hide after animation
  });
// Close on outside click
document.addEventListener('click', (e) => {
  if (
    whyPanel &&
    whyPanel.classList.contains('show') &&
    !whyPanel.contains(e.target) &&
    e.target !== whyBtn
  ) {
    whyPanel.classList.remove('show');
  }
});

const unlockedBadges = new Set();

//  BADGES / ACHIEVEMENTS
// Four badges unlock based on session history (first session, 5 sessions
// across 3+ days, a balanced 28-day stretch, and taking a recovery day
// when stability is low). `updateBadges` re-evaluates all of them any
// time sessions change.

function showAchievementPopup(name, imageSrc) {
  const popup = document.getElementById('achievement-popup');
  const popupIcon = document.getElementById('achievement-popup-icon');
  const popupName = document.getElementById('achievement-name');

  if (!popup || !popupIcon || !popupName) return;

  popupIcon.src = imageSrc;
  popupName.textContent = name;

  popup.classList.add('show');

  setTimeout(() => {
    popup.classList.remove('show');
  }, 2600);
}

function lockBadge(badgeId) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;

  badge.classList.remove('unlocked');
  badge.classList.add('locked');
}

function updateBadges(showUp = false) {
  lockBadge('badge-first-light');
  lockBadge('badge-constellation-builder');
  lockBadge('badge-balanced-month');
  lockBadge('badge-recovery-master');

  if (loadedSessions.length >= 1) {
    unlockBadge('badge-first-light', 'First Light', 'badges/first-light.png', showUp);
  }

  const distinctDays = new Set(loadedSessions.filter((s) => s.date).map((s) => s.date)).size;

  if (loadedSessions.length >= 5 && distinctDays >= 3) {
    unlockBadge(
      'badge-constellation-builder',
      'Constellation Builder',
      'badges/constellation-builder.png',
      showUp,
    );
  }

  const datedSessions = loadedSessions
    .filter((s) => s.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (datedSessions.length > 0) {
    const firstDate = new Date(datedSessions[0].date);
    const lastDate = new Date(datedSessions[datedSessions.length - 1].date);
    const rangeDays = Math.round((lastDate - firstDate) / 86400000);

    const noCollapse = loadedSessions.every(() => stability > 20);

    if (rangeDays >= 27 && stability > 60 && noCollapse) {
      unlockBadge('badge-balanced-month', 'Balanced Month', 'badges/balanced-month.png', showUp);
    }
  }

  const hasRecoveryDay = loadedSessions.some((s) => Number(s.rpe) === 0);
  const restSuggested = stability < 40;

  if (hasRecoveryDay && restSuggested) {
    unlockBadge('badge-recovery-master', 'Recovery Master', 'badges/recovery-master.png', showUp);
  }
}

function unlockBadge(badgeId, badgeName, imageSrc, showPopup = true) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;

  const wasLocked = badge.classList.contains('locked');

  badge.classList.remove('locked');
  badge.classList.add('unlocked');

  if (wasLocked && !unlockedBadges.has(badgeId)) {
    unlockedBadges.add(badgeId);

    badge.classList.add('just-unlocked');
    setTimeout(() => {
      badge.classList.remove('just-unlocked');
    }, 800);

    if (showPopup) {
      showAchievementPopup(badgeName, imageSrc);
    }
  }
}
//-why-
const emptyMessage = document.getElementById('empty-message');

if (emptyMessage) {
  if (loadedSessions.length === 0) {
    emptyMessage.classList.add('show');
  } else {
    emptyMessage.classList.remove('show');
  }
}
updateBadges();
animate();
