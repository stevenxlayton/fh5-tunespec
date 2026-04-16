/* ============================================================
 * TuneSpec — Forza Horizon 5 Tuning Calculator
 * v3.0 — Research-backed rebuild
 *
 * Renders into the existing index.html DOM:
 *   #search, #filters, #count, #car-list, #modal, #modal-content
 *   header .brand-sub
 *
 * Persistence: IndexedDB ('tunespec'), stores 'userData' + 'customCars'
 * tx.oncomplete pattern preserved throughout.
 * ============================================================ */

'use strict';

/* =============================================
 * CONSTANTS
 * ============================================= */
const DB_NAME = 'tunespec';
const DB_VERSION = 2;
const STORE_USER = 'userData';
const STORE_CUSTOM = 'customCars';
const SCHEMA_VERSION = 2;
const DISCIPLINES = ['road', 'drift', 'dirt', 'drag'];

/* =============================================
 * STATE
 * ============================================= */
let db = null;
let seedCars = [];
let customCars = [];
let cars = [];
let currentCarId = null;
let currentDiscipline = 'road';
let activeFilter = 'all';
let searchQuery = '';
let tunedCarIds = new Set();

/* =============================================
 * DOM REFS (set on boot)
 * ============================================= */
let $search, $filters, $count, $carList, $modal, $modalContent, $brandSub, $closeBtn;

/* =============================================
 * IndexedDB
 * ============================================= */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains(STORE_USER)) _db.createObjectStore(STORE_USER, { keyPath: 'carId' });
      if (!_db.objectStoreNames.contains(STORE_CUSTOM)) _db.createObjectStore(STORE_CUSTOM, { keyPath: 'id' });
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGet(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbGetAll(store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

function dbPut(store, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

function dbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

/* =============================================
 * SCHEMA MIGRATION v1 -> v2
 * Adds power, drivetrainOverride, per-discipline tireCompound/transmissionType.
 * Zero data loss -- existing tunes preserved.
 * ============================================= */
async function migrateUserData() {
  const all = await dbGetAll(STORE_USER);
  for (const entry of all) {
    if (entry.schemaVersion === SCHEMA_VERSION) continue;
    if (entry.power === undefined) entry.power = null;
    if (entry.drivetrainOverride === undefined) entry.drivetrainOverride = null;
    if (!entry.tunes) entry.tunes = {};
    for (const disc of DISCIPLINES) {
      if (!entry.tunes[disc]) continue;
      const t = entry.tunes[disc];
      if (t.tireCompound === undefined) t.tireCompound = defaultCompound(disc);
      if (t.transmissionType === undefined) t.transmissionType = defaultTrans(disc);
    }
    entry.schemaVersion = SCHEMA_VERSION;
    await dbPut(STORE_USER, entry);
  }
}

function defaultCompound(disc) {
  return ({ drift: 'sport', road: 'race', dirt: 'rally', drag: 'drag' })[disc];
}

function defaultTrans(disc) {
  return ({ drift: 'race', road: 'race', dirt: 'race', drag: 'drag' })[disc];
}

/* =============================================
 * USER DATA HELPERS
 * ============================================= */
async function getUserData(carId) {
  let e = await dbGet(STORE_USER, carId);
  if (!e) {
    e = { carId, weight: null, fwd: null, power: null, drivetrainOverride: null, notes: '', tunes: {}, lastDiscipline: 'road', schemaVersion: SCHEMA_VERSION };
  }
  return e;
}

async function saveUserData(entry) {
  entry.schemaVersion = SCHEMA_VERSION;
  return dbPut(STORE_USER, entry);
}

async function buildTunedSet() {
  const all = await dbGetAll(STORE_USER);
  tunedCarIds = new Set(all.filter(e => e.weight && e.fwd).map(e => e.carId));
}

/* =============================================
 * TUNE CALCULATOR
 * ============================================= */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const ri = (v) => Math.round(v);

function springFromFreq(hz, cornerWt) {
  return (hz * hz * cornerWt * 4 * Math.PI * Math.PI) / 386.088;
}

function targetFreqs(disc, compound) {
  if (disc === 'road') {
    if (compound === 'race') return [2.6, 3.0];
    if (compound === 'sport') return [2.1, 2.4];
    return [1.8, 2.1];
  }
  if (disc === 'drift') return [2.5, 1.7];
  if (disc === 'dirt') return [1.4, 1.6];
  if (disc === 'drag') return [1.7, 1.2];
  return [2.0, 2.2];
}

function pwTier(hp, wt) {
  if (!hp || !wt) return 'unknown';
  const r = hp / wt;
  if (r < 0.10) return 'low';
  if (r < 0.20) return 'balanced';
  if (r < 0.30) return 'high';
  return 'extreme';
}

/* --- Road --- */
function calcRoad(ctx) {
  const { weight, fwd, hp, drivetrain, compound, tier } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [fF, fR] = targetFreqs('road', compound);

  const springF = ri(springFromFreq(fF, cwF));
  const springR = ri(springFromFreq(fR, cwR));

  let rebF = clamp(springF / 100, 7, 13);
  let rebR = clamp(springR / 100, 7, 13);
  let bumpF = rebF * 0.65, bumpR = rebR * 0.65;

  const fwdD = fwd - 50;
  let arbF = 32 + fwdD * 0.5;
  let arbR = 30 - fwdD * 0.5;
  if (drivetrain === 'FWD') { arbF -= 4; arbR += 4; }
  if (drivetrain === 'AWD') { arbF += 1; }
  if (drivetrain === 'MR' || drivetrain === 'RR') { arbF += 3; arbR -= 3; }
  arbF = clamp(arbF, 22, 45); arbR = clamp(arbR, 20, 42);

  let psiF = 30, psiR = 30;
  if (drivetrain === 'AWD' || drivetrain === 'FWD') psiF -= 1;
  if (drivetrain === 'MR' || drivetrain === 'RR') { psiF += 1; psiR -= 1; }
  if (weight > 3500) { psiF -= 1; psiR -= 1; }
  if (weight > 4200) { psiF -= 1; psiR -= 1; }

  let camF = -2.0, camR = -1.5;
  if (drivetrain === 'MR' || drivetrain === 'RR') { camF += 0.3; camR -= 0.3; }

  let diff;
  if (drivetrain === 'RWD' || drivetrain === 'MR' || drivetrain === 'RR') {
    let a = 55; if (tier === 'high') a = 65; if (tier === 'extreme') a = 75;
    diff = { rearAccel: a, rearDecel: 20 };
  } else if (drivetrain === 'AWD') {
    let rwd = 25; if (tier === 'high') rwd = 35; if (tier === 'extreme') rwd = 45;
    diff = { frontAccel: 30, frontDecel: 5, rearAccel: clamp(rwd + 50, 50, 90), rearDecel: 20, center: tier === 'extreme' ? 65 : 70 };
  } else {
    diff = { frontAccel: 40, frontDecel: 10 };
  }

  let aeroF = 'mid', aeroR = 'mid';
  if (tier === 'extreme') { aeroF = 'mid-high'; aeroR = 'max'; }

  return {
    tirePressure: { front: r1(psiF), rear: r1(psiR) },
    camber: { front: r1(camF), rear: r1(camR) }, toe: { front: 0.0, rear: 0.0 }, caster: 5.5,
    arb: { front: r1(arbF), rear: r1(arbR) },
    springs: { front: springF, rear: springR, unit: 'lb/in' },
    rideHeight: { front: 'min + 0.4"', rear: 'min + 0.4"' },
    damping: { rebound: { front: r1(rebF), rear: r1(rebR) }, bump: { front: r1(bumpF), rear: r1(bumpR) } },
    differential: diff,
    brakes: { balance: 52, pressure: 100 },
    aero: { front: aeroF, rear: aeroR },
    gearing: '3.0\u20133.5 (technical), 2.5\u20132.8 (high speed)'
  };
}

/* --- Drift --- */
function calcDrift(ctx) {
  const { weight, fwd, hp, drivetrain, compound, transmission } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [fF, fR] = targetFreqs('drift', compound);

  const springF = ri(springFromFreq(fF, cwF));
  const springR = ri(springFromFreq(fR, cwR));

  let rebF = clamp(springF / 110, 6, 10);
  let rebR = clamp(springR / 110, 4, 8);
  let bumpF = rebF * 0.65, bumpR = rebR * 0.65;

  let arbF = clamp(40 + (fwd - 50) * 0.4, 30, 50);
  let arbR = 12;

  let diff;
  if (drivetrain === 'RWD' || drivetrain === 'MR' || drivetrain === 'RR') {
    diff = { rearAccel: 100, rearDecel: 20 };
  } else if (drivetrain === 'AWD') {
    diff = { frontAccel: 50, frontDecel: 0, rearAccel: 100, rearDecel: 20, center: 90 };
  } else {
    diff = { frontAccel: 100, frontDecel: 0 };
  }

  let gearing;
  if (transmission === 'race') gearing = 'Final 3.5\u20134.0 (zones), 2.5\u20133.0 (links). Tune ratios for power-band overlap.';
  else if (transmission === 'drift') gearing = 'Drift trans has fixed ratios. Race trans recommended for competitive tunes.';
  else gearing = 'Use Race or Drift transmission. Sport limits ratio control.';

  return {
    tirePressure: { front: 30, rear: 38 },
    camber: { front: -4.0, rear: -0.3 }, toe: { front: 0.2, rear: -0.2 }, caster: 7.0,
    arb: { front: r1(arbF), rear: r1(arbR) },
    springs: { front: springF, rear: springR, unit: 'lb/in' },
    rideHeight: { front: 'min + 0.6"', rear: 'min + 0.2"' },
    damping: { rebound: { front: r1(rebF), rear: r1(rebR) }, bump: { front: r1(bumpF), rear: r1(bumpR) } },
    differential: diff,
    brakes: { balance: 62, pressure: 100 },
    aero: { front: 'min', rear: 'max (if equipped)' },
    gearing
  };
}

/* --- Dirt --- */
function calcDirt(ctx) {
  const { weight, fwd, drivetrain } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [fF, fR] = targetFreqs('dirt', null);

  const springF = ri(springFromFreq(fF, cwF));
  const springR = ri(springFromFreq(fR, cwR));

  let rebF = clamp(springF / 130, 3, 7);
  let rebR = clamp(springR / 130, 3, 7);
  let bumpF = rebF * 0.65, bumpR = rebR * 0.65;

  let arbF = clamp(14 + (fwd - 50) * 0.3, 8, 20);
  let arbR = clamp(14 - (fwd - 50) * 0.3, 8, 20);

  let diff;
  if (drivetrain === 'AWD') {
    diff = { frontAccel: 40, frontDecel: 10, rearAccel: 70, rearDecel: 25, center: 58 };
  } else if (drivetrain === 'RWD' || drivetrain === 'MR' || drivetrain === 'RR') {
    diff = { rearAccel: 65, rearDecel: 25 };
  } else {
    diff = { frontAccel: 45, frontDecel: 10 };
  }

  return {
    tirePressure: { front: 25, rear: 25 },
    camber: { front: -1.2, rear: -1.0 }, toe: { front: 0.0, rear: -0.2 }, caster: 5.0,
    arb: { front: r1(arbF), rear: r1(arbR) },
    springs: { front: springF, rear: springR, unit: 'lb/in' },
    rideHeight: { front: 'max \u2212 0.5"', rear: 'max \u2212 0.5"' },
    damping: { rebound: { front: r1(rebF), rear: r1(rebR) }, bump: { front: r1(bumpF), rear: r1(bumpR) } },
    differential: diff,
    brakes: { balance: 50, pressure: 95 },
    aero: { front: 'min', rear: 'mid-high (jumps)' },
    gearing: 'Final 3.0\u20133.5. Lower 1st for off-line acceleration.'
  };
}

/* --- Drag --- */
function calcDrag(ctx) {
  const { weight, fwd, drivetrain } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [fF, fR] = targetFreqs('drag', null);

  const springF = ri(springFromFreq(fF, cwF));
  const springR = ri(springFromFreq(fR, cwR));

  let rebF = clamp(springF / 130, 4, 8);
  let rebR = clamp(springR / 200, 2, 5);
  let bumpF = rebF * 0.65, bumpR = rebR * 0.6;

  let diff;
  if (drivetrain === 'RWD' || drivetrain === 'MR' || drivetrain === 'RR') diff = { rearAccel: 100, rearDecel: 0 };
  else if (drivetrain === 'AWD') diff = { frontAccel: 90, frontDecel: 0, rearAccel: 100, rearDecel: 0, center: 55 };
  else diff = { frontAccel: 100, frontDecel: 0 };

  return {
    tirePressure: { front: 30, rear: 24 },
    camber: { front: 0.0, rear: 0.2 }, toe: { front: 0.0, rear: 0.1 }, caster: 7.0,
    arb: { front: 1, rear: 1 },
    springs: { front: springF, rear: springR, unit: 'lb/in' },
    rideHeight: { front: 'min', rear: 'min + 0.6" (reverse rake)' },
    damping: { rebound: { front: r1(rebF), rear: r1(rebR) }, bump: { front: r1(bumpF), rear: r1(bumpR) } },
    differential: diff,
    brakes: { balance: 50, pressure: 100 },
    aero: { front: 'strip / min', rear: 'strip / min' },
    gearing: 'Drag trans preferred. If Race: lengthen 1st (~2.7), tune top gear to redline at trap speed.'
  };
}

/* --- Warnings --- */
function generateWarnings(ctx, disc) {
  const w = [];
  const { hp, weight, drivetrain, compound, transmission, tier } = ctx;

  if (!hp) w.push({ lv: 'info', msg: 'Set power (hp) for diff, aero, and P/W recommendations.' });

  if (hp && weight) {
    const pw = hp / weight;
    if (disc === 'drift' && hp > 650)
      w.push({ lv: 'warn', msg: hp + ' hp is above the ~600 hp drift sweet spot. Throttle modulation gets twitchy. Consider pulling power back.' });
    if (tier === 'extreme')
      w.push({ lv: 'warn', msg: 'P/W is extreme (' + pw.toFixed(2) + ' hp/lb). No suspension tune fully saves this. Aero doubled per Fifty_Inch rule.' });
    if (disc === 'road' && hp > 600 && (drivetrain === 'RWD' || drivetrain === 'MR'))
      w.push({ lv: 'info', msg: 'High-power RWD on road: AWD conversion is the FH5 meta for launch traction.' });
    if (disc === 'drag' && drivetrain === 'RWD')
      w.push({ lv: 'info', msg: 'Drag meta favors AWD conversion for launch. RWD drag works but slower off the line.' });
  }

  if (disc === 'drift' && transmission === 'drift')
    w.push({ lv: 'info', msg: 'Drift trans = beginner pick. Race trans gives full ratio control for competitive zone tunes.' });
  if (disc === 'road' && transmission !== 'race')
    w.push({ lv: 'warn', msg: 'Road racing needs Race transmission for full gear control.' });
  if (disc === 'drag' && transmission !== 'drag' && transmission !== 'race')
    w.push({ lv: 'warn', msg: 'Use Drag trans (default) or Race for custom ratios.' });
  if (transmission === 'sport')
    w.push({ lv: 'warn', msg: 'Sport trans only unlocks partial gear tuning. Never use for serious builds.' });

  if (disc === 'drift' && compound === 'drift')
    w.push({ lv: 'info', msg: 'Drift compound scores LOWER than Sport/Race on zones (FH5-specific). Sport = recommended for points. Drift = casual/smoke aesthetic.' });
  if (disc === 'road' && compound !== 'race' && compound !== 'sport')
    w.push({ lv: 'info', msg: 'Race compound is universal for road racing.' });
  if (disc === 'dirt' && ['sport', 'race', 'drag', 'drift'].includes(compound))
    w.push({ lv: 'warn', msg: 'That compound slides on loose surfaces. Use Rally (mixed) or Off-road (pure dirt).' });
  if (disc === 'drag' && compound !== 'drag')
    w.push({ lv: 'warn', msg: 'Drag tires required for serious drag launches.' });

  if (disc === 'drift' && drivetrain === 'FWD')
    w.push({ lv: 'warn', msg: 'FWD drift is a meme. RWD conversion is mandatory for serious drift.' });

  return w;
}

/* --- Main entry --- */
function calcTune(input) {
  const ctx = {
    weight: Number(input.weight) || 3000,
    fwd: Number(input.fwd) || 50,
    hp: input.hp ? Number(input.hp) : null,
    drivetrain: input.drivetrain || 'RWD',
    compound: input.compound || defaultCompound(input.discipline),
    transmission: input.transmission || defaultTrans(input.discipline)
  };
  ctx.tier = pwTier(ctx.hp, ctx.weight);

  let result;
  switch (input.discipline) {
    case 'drift': result = calcDrift(ctx); break;
    case 'dirt':  result = calcDirt(ctx);  break;
    case 'drag':  result = calcDrag(ctx);  break;
    default:      result = calcRoad(ctx);  break;
  }

  result.warnings = generateWarnings(ctx, input.discipline);
  result.meta = {
    pwRatio: ctx.hp ? r2(ctx.hp / ctx.weight) : null,
    tier: ctx.tier, drivetrain: ctx.drivetrain, compound: ctx.compound, transmission: ctx.transmission
  };
  return result;
}

/* =============================================
 * GLOSSARY
 * ============================================= */
const GLOSSARY = [
  { key: 'TIRE_COMPOUND', title: 'Tire Compound',
    body: "BIG FH5 CORRECTION FOR DRIFT: drift compound is NOT optimal for zone scoring. Sport or Race + drift trans + drift diff scores HIGHER because the car holds a deeper stable slip angle for more points.\n\n\u2022 Drift compound: easy to break loose, max smoke, \"looks right.\" Use for casual/aesthetic.\n\u2022 Sport compound: holds higher slip angle = more zone points. RECOMMENDED for serious drift.\n\u2022 Race compound: highest sustained grip = deepest stable angle. High-skill max-points tunes.\n\nRoad race: Race compound universal. Dirt: Rally (mixed) or Off-road (pure dirt). Drag: Drag compound, period." },
  { key: 'TIRE_PRESSURE', title: 'Tire Pressure',
    body: "Lower psi = larger contact patch = more grip but more heat. Higher psi = less grip, cooler. Goal: keep tire temps out of the red on telemetry. Heavy cars heat faster \u2014 drop 1\u20132 psi.\n\nDrift: high rear (35\u201340+ psi) reduces rear contact patch for easier rotation.\nDrag: low rear (~24) for launch grip.\nDirt: low both (~25) for loose-surface contact patch." },
  { key: 'CAMBER', title: 'Camber',
    body: "MYTH: \"max negative camber = max grip.\" NO. Excessive camber kills braking and acceleration. Road race sweet spot: \u22121.5\u00b0 to \u22122.5\u00b0 front. The telemetry test: outside-front camber should be near 0\u00b0 at apex.\n\nDrift: heavy front camber (\u22123\u00b0 to \u22125\u00b0) for steering angle. Rear stays near zero (\u22120.5\u00b0 max) \u2014 heavy rear camber kills grip you need for transitions." },
  { key: 'TOE', title: 'Toe',
    body: "FH5-SPECIFIC: leave toe at 0.0\u00b0 in nearly all cases. The \"front toe-out, rear toe-in\" advice is from older Forza titles. ForzaTune's ML model leaves toe at zero.\n\nWhen to deviate:\n\u2022 Front toe-out (+0.1\u20130.3\u00b0): sharper turn-in, but twitchy.\n\u2022 Rear toe-in (\u22120.1 to \u22120.3\u00b0): more stability.\nDrift uses small front toe-out (+0.2\u00b0) for sharper initiation." },
  { key: 'CASTER', title: 'Caster',
    body: "Positive caster (1.0\u20137.0, front only) = straight-line stability + steering self-center. Higher helps hold drift angle.\n\nMost tunes: ~5.5\u00b0. Drift and drag often max it (7.0\u00b0). Dirt lower (~5.0\u00b0) to reduce steering effort on rough terrain." },
  { key: 'ARB', title: 'Anti-Roll Bars',
    body: "ARBs are the FIRST lever for over/understeer correction in FH5 \u2014 more responsive than springs.\n\n\u2022 Soften FRONT ARB to reduce understeer.\n\u2022 Soften REAR ARB to reduce oversteer.\n\u2022 forzatune rule: shift 0.5 per 1% weight distribution change from stock.\n\nDrivetrain rule: the DRIVE axle wants softer ARB (maintain traction). Non-drive wants stiffer (control body roll).\n\nDrift: stiff front (30\u201350), very soft rear (5\u201325)." },
  { key: 'SPRINGS', title: 'Springs',
    body: "Spring rates use the natural frequency formula:\n  Rate (lb/in) = (freq\u00b2 \u00d7 cornerWeight \u00d7 4\u03c0\u00b2) / 386.088\n\nTarget frequencies (Hz):\n\u2022 Street: 1.5\u20132.0\n\u2022 Road race no aero: 2.0\u20132.5\n\u2022 Road race with aero: 2.5\u20133.5\n\u2022 Drift: 2.0\u20133.0 front, 1.5\u20132.0 rear\n\u2022 Rally/CC: 1.2\u20131.8\n\u2022 Drag: 1.5\u20132.0 front, 1.0\u20131.5 rear\n\nFlat-ride convention: rear ~15% stiffer in frequency for smooth weight transfer." },
  { key: 'RIDE_HEIGHT', title: 'Ride Height',
    body: "MYTH: \"slammed = always fastest.\" NO. The Mexico map has constant bumps. Most road tunes: min + 0.3\" to min + 0.7\".\n\nDRIFT MYTH: \"slam it for drift.\" NO. Slight RAKE (raised front, lower rear) helps weight transfer for initiation. Slammed cars bottom out mid-drift.\n\nDirt/CC: max or near-max for travel.\nDrag: min front, raised rear (reverse rake for launch)." },
  { key: 'DAMPING', title: 'Damping',
    body: "UNIVERSAL RULE: Bump = 60\u201370% of Rebound. Equal values feel harsh and skitter over bumps.\n\nRebound scales with spring rate: stiffer spring \u2192 more rebound to control return motion.\n\nv3.0 uses spring/100 for rebound base, then 65% ratio for bump." },
  { key: 'DIFFERENTIAL', title: 'Differential',
    body: "IN-GAME HELP TEXT IS WRONG: it implies higher decel reduces lift-throttle oversteer. The correct model:\n\n\u2022 Higher decel = wheels more locked off-throttle = LESS rotation = MORE stability.\n\u2022 Lower decel = more wheel-speed difference = MORE rotation.\n\nFH5 AWD MATH (Fifty_Inch):\n\u2022 Race diff rear accel = RWD value + 50%\n\u2022 Rally diff = RWD + 26%\n\u2022 Off-road diff = RWD + 14%\nThis is why FH4 tunes misbehave on FH5 AWD cars.\n\nDrift: 100% accel rear, 0\u201330% decel.\nDrag: 100% accel, 0% decel." },
  { key: 'BRAKES', title: 'Brakes',
    body: "Balance = % to front. 50\u201355% for road race. Trail-brakers: 48\u201350% for rotation under braking.\n\nDrift: front-bias (55\u201370%) prevents rear lockup that kills the slide.\nDirt: ~50% because less load transfer on loose.\nPressure: 100% default. Higher for stopping power, lower if locking without ABS." },
  { key: 'AERO', title: 'Aero',
    body: "Aero scales with speed\u00b2. Below ~60 mph it does nothing \u2014 mechanical grip handles all the work.\n\n\u2022 Avg corner speed < 80 mph: strip downforce for top speed.\n\u2022 Avg corner speed > 100 mph: max downforce.\n\nEXTREME POWER (>2\u00d7 stock hp): double front/rear downforce (Fifty_Inch rule).\nDrag: strip everything." },
  { key: 'GEARING', title: 'Gearing & Transmission',
    body: "TRANSMISSION CHOICE:\n\u2022 Race trans: Road, Dirt, COMPETITIVE DRIFT. Full gear/final-drive control.\n\u2022 Drift trans: Beginner/casual drift. Fixed ratios, limited sliders.\n\u2022 Drag trans: Drag default. Purpose-built ratios.\n\u2022 Sport trans: NEVER for serious builds. Partial tuning only.\n\nFinal drive:\n\u2022 Road technical: 3.0\u20133.5\n\u2022 Road high-speed: 2.4\u20132.8\n\u2022 Drift zones: 3.5\u20134.5 (stay in 2nd)\n\u2022 Drift links: 2.5\u20133.5 (3rd\u20134th gear)\n\u2022 Highway drift: 2.0\u20132.8\n\u2022 Drag: tune top gear to redline at trap speed." },
  { key: 'POWER_TO_WEIGHT', title: 'Power-to-Weight',
    body: "P/W ratio (hp/lb) drives tune decisions:\n\n\u2022 < 0.10: soft springs, low ARBs, can run high diff lock\n\u2022 0.10\u20130.20: balanced S1, standard formulas apply\n\u2022 0.20\u20130.30: high-power S2, stiffen rear, more rear downforce, lower rear diff\n\u2022 > 0.30: extreme. 2\u00d7 downforce, AWD-conv strongly recommended\n\nDRIFT: keep peak power \u2264 ~600 hp. Past that, throttle modulation gets twitchy under clutch-kick." },
  { key: 'CONTROLLER', title: 'Controller Linearity',
    body: "COMMONLY MISUNDERSTOOD. Per FH5 official docs:\n\n\u2022 Linearity < 50: LESS sensitive at center, MORE at full lock. This is what controller players want.\n\u2022 Linearity > 50: MORE sensitive at center, LESS at full lock. Twitchy.\n\u2022 50 = linear/default.\n\nMost guides have this BACKWARDS.\n\nRecommended: 45 for road/dirt, 50 for drift/drag." }
];

/* =============================================
 * UI -- CAR LIST (renders into existing DOM)
 * ============================================= */
function renderCarList() {
  let list = cars.slice();

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c => (c.make + ' ' + c.model + ' ' + c.year).toLowerCase().includes(q));
  }

  if (activeFilter === 'drift') list = list.filter(c => c.driftFriendly);
  else if (activeFilter === 'rwd') list = list.filter(c => c.drivetrain === 'RWD');
  else if (activeFilter === 'awd') list = list.filter(c => c.drivetrain === 'AWD');
  else if (activeFilter === 'fwd') list = list.filter(c => c.drivetrain === 'FWD');
  else if (activeFilter === 'muscle') list = list.filter(c => (c.bodyType || '').toLowerCase().includes('muscle'));
  else if (activeFilter === 'tuned') list = list.filter(c => tunedCarIds.has(c.id));

  list.sort((a, b) => (a.make + ' ' + a.model).localeCompare(b.make + ' ' + b.model));

  $count.textContent = list.length + ' car' + (list.length !== 1 ? 's' : '');

  if (list.length === 0) {
    $carList.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px 0;">No cars match.</div>';
    return;
  }

  $carList.innerHTML = list.map(c => {
    const dtClass = (c.drivetrain || 'rwd').toLowerCase();
    const star = c.driftFriendly ? ' <span class="drift-star">\u2605</span>' : '';
    return '<div class="car-row" data-id="' + c.id + '">' +
      '<div><div class="name">' + esc(c.year) + ' ' + esc(c.make) + ' ' + esc(c.model) + star + '</div>' +
      '<div class="sub">' + esc(c.stockClass || '') + ' \u00b7 ' + esc(c.bodyType || '') + '</div></div>' +
      '<span class="badge ' + dtClass + '">' + esc(c.drivetrain) + '</span></div>';
  }).join('');

  $carList.querySelectorAll('.car-row').forEach(el => {
    el.addEventListener('click', () => openCarModal(el.dataset.id));
  });
}

/* =============================================
 * UI -- CAR DETAIL MODAL
 * ============================================= */
async function openCarModal(carId) {
  currentCarId = carId;
  const car = cars.find(c => c.id === carId);
  if (!car) return;
  const ud = await getUserData(carId);
  if (ud.lastDiscipline) currentDiscipline = ud.lastDiscipline;

  renderModalContent(car, ud);
  $modal.classList.add('open');
}

function renderModalContent(car, ud) {
  const disc = currentDiscipline;
  const tune = ud.tunes[disc] || {};
  const compound = tune.tireCompound || defaultCompound(disc);
  const transmission = tune.transmissionType || defaultTrans(disc);
  const drivetrain = ud.drivetrainOverride || car.drivetrain;

  const hasInputs = ud.weight && ud.fwd;
  const result = hasInputs ? calcTune({
    weight: ud.weight, fwd: ud.fwd, hp: ud.power,
    drivetrain, compound, transmission, discipline: disc
  }) : null;

  const deleteBtn = car.custom ? ' <button class="btn-sm btn-danger" id="md-delete">Delete Car</button>' : '';

  $modalContent.innerHTML =
    '<h2>' + esc(car.year) + ' ' + esc(car.make) + ' ' + esc(car.model) + '</h2>' +
    '<div class="sub" style="margin:-8px 0 12px;font-size:12px;color:var(--text-dim);">' +
      esc(car.stockClass || '') + ' \u00b7 ' + esc(car.drivetrain) + ' \u00b7 ' + esc(car.bodyType || '') + ' \u00b7 ' + esc(car.engineLayout || '') +
      deleteBtn +
    '</div>' +

    /* --- Inputs --- */
    '<div class="input-grid">' +
      inputField('Weight (lb)', 'md-weight', ud.weight, '3000') +
      inputField('Front wt %', 'md-fwd', ud.fwd, '52') +
      inputField('Power (hp)', 'md-power', ud.power, '550') +
      selectField('Drivetrain', 'md-drivetrain', ud.drivetrainOverride || '', [
        ['', car.drivetrain + ' (stock)'],
        ['RWD', 'RWD (conv)'], ['AWD', 'AWD (conv)'], ['FWD', 'FWD'],
        ['MR', 'Mid-engine RWD'], ['RR', 'Rear-engine RWD']
      ]) +
    '</div>' +

    /* --- Discipline tabs --- */
    '<div class="disc-tabs">' +
      DISCIPLINES.map(d =>
        '<button class="disc-tab' + (d === disc ? ' active' : '') + '" data-disc="' + d + '">' + d.toUpperCase() + '</button>'
      ).join('') +
    '</div>' +

    /* --- Per-discipline inputs --- */
    '<div class="disc-inputs">' +
      selectField('Tire compound', 'md-compound', compound, [
        ['stock','Stock'],['sport','Sport'],['race','Race'],['drift','Drift'],
        ['rally','Rally'],['offroad','Off-road'],['drag','Drag']
      ]) +
      selectField('Transmission', 'md-trans', transmission, [
        ['sport','Sport (limited)'],['race','Race'],['drift','Drift'],['drag','Drag']
      ]) +
    '</div>' +

    /* --- Tune output --- */
    '<div class="tune-output" id="tune-output">' +
      (result ? renderTuneOutput(result) : '<div style="color:var(--text-dim);padding:20px 0;text-align:center;">Enter weight and front wt % to calculate.</div>') +
    '</div>' +

    /* --- Notes --- */
    '<div class="notes-field"><label style="font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.6px;">Notes</label>' +
      '<textarea id="md-notes" rows="3" placeholder="Personal notes...">' + esc(ud.notes || '') + '</textarea></div>';

  /* --- Wire events --- */
  // Discipline tabs
  $modalContent.querySelectorAll('.disc-tab').forEach(t => {
    t.addEventListener('click', async () => {
      currentDiscipline = t.dataset.disc;
      const fresh = await getUserData(currentCarId);
      fresh.lastDiscipline = currentDiscipline;
      await saveUserData(fresh);
      renderModalContent(car, fresh);
    });
  });

  // Input changes -> save + recalc
  const changeIds = ['md-weight','md-fwd','md-power','md-drivetrain','md-compound','md-trans'];
  const saveFn = debounce(async () => {
    const fresh = await getUserData(currentCarId);
    fresh.weight = parseNum('md-weight');
    fresh.fwd = parseNum('md-fwd');
    fresh.power = parseNum('md-power');
    fresh.drivetrainOverride = document.getElementById('md-drivetrain').value || null;
    if (!fresh.tunes[currentDiscipline]) fresh.tunes[currentDiscipline] = {};
    fresh.tunes[currentDiscipline].tireCompound = document.getElementById('md-compound').value;
    fresh.tunes[currentDiscipline].transmissionType = document.getElementById('md-trans').value;
    fresh.lastDiscipline = currentDiscipline;
    await saveUserData(fresh);
    await buildTunedSet();
    renderModalContent(car, fresh);
  }, 350);

  changeIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', saveFn);
    if (el.tagName === 'INPUT') el.addEventListener('input', saveFn);
  });

  // Notes: save without full re-render (avoids losing textarea focus)
  const notesEl = document.getElementById('md-notes');
  if (notesEl) {
    notesEl.addEventListener('input', debounce(async () => {
      const fresh = await getUserData(currentCarId);
      fresh.notes = notesEl.value;
      await saveUserData(fresh);
    }, 500));
  }

  // Delete custom car
  const delBtn = document.getElementById('md-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('Delete this custom car and all its saved tunes?')) return;
      await dbDelete(STORE_CUSTOM, currentCarId);
      await dbDelete(STORE_USER, currentCarId);
      customCars = customCars.filter(c => c.id !== currentCarId);
      cars = seedCars.concat(customCars);
      currentCarId = null;
      $modal.classList.remove('open');
      await buildTunedSet();
      renderCarList();
    });
  }

  // Inline glossary buttons
  $modalContent.querySelectorAll('.gl-btn').forEach(b => {
    b.addEventListener('click', (e) => { e.stopPropagation(); showGlossary(b.dataset.key); });
  });
}

function renderTuneOutput(r) {
  let html = '';

  // Warnings
  if (r.warnings.length) {
    html += '<div class="warnings">' +
      r.warnings.map(w => '<div class="warn-' + w.lv + '">' + esc(w.msg) + '</div>').join('') +
      '</div>';
  }

  // Meta bar
  html += '<div class="tune-meta">' +
    (r.meta.pwRatio ? 'P/W: ' + r.meta.pwRatio + ' hp/lb (' + r.meta.tier + ')' : 'P/W: not set') +
    ' \u00b7 ' + r.meta.drivetrain + ' \u00b7 ' + r.meta.compound + ' tires \u00b7 ' + r.meta.transmission + ' trans</div>';

  // Sections
  html += tuneSection('Tires', 'TIRE_PRESSURE', [
    tuneRow('Front pressure', r.tirePressure.front + ' psi'),
    tuneRow('Rear pressure', r.tirePressure.rear + ' psi')
  ]);
  html += tuneSection('Alignment', 'CAMBER', [
    tuneRow('Camber F / R', r.camber.front + '\u00b0 / ' + r.camber.rear + '\u00b0'),
    tuneRow('Toe F / R', r.toe.front + '\u00b0 / ' + r.toe.rear + '\u00b0'),
    tuneRow('Caster', r.caster + '\u00b0')
  ]);
  html += tuneSection('Anti-Roll Bars', 'ARB', [
    tuneRow('Front', r.arb.front), tuneRow('Rear', r.arb.rear)
  ]);
  html += tuneSection('Springs', 'SPRINGS', [
    tuneRow('Front', r.springs.front + ' ' + r.springs.unit),
    tuneRow('Rear', r.springs.rear + ' ' + r.springs.unit),
    tuneRow('Ride Height F / R', esc(r.rideHeight.front) + ' / ' + esc(r.rideHeight.rear))
  ]);
  html += tuneSection('Damping', 'DAMPING', [
    tuneRow('Rebound F / R', r.damping.rebound.front + ' / ' + r.damping.rebound.rear),
    tuneRow('Bump F / R', r.damping.bump.front + ' / ' + r.damping.bump.rear)
  ]);

  const d = r.differential;
  const dRows = [];
  if (d.frontAccel !== undefined) dRows.push(tuneRow('Front Accel', d.frontAccel + '%'));
  if (d.frontDecel !== undefined) dRows.push(tuneRow('Front Decel', d.frontDecel + '%'));
  if (d.rearAccel !== undefined) dRows.push(tuneRow('Rear Accel', d.rearAccel + '%'));
  if (d.rearDecel !== undefined) dRows.push(tuneRow('Rear Decel', d.rearDecel + '%'));
  if (d.center !== undefined) dRows.push(tuneRow('Center (% rear)', d.center + '%'));
  html += tuneSection('Differential', 'DIFFERENTIAL', dRows);

  html += tuneSection('Brakes', 'BRAKES', [
    tuneRow('Balance', r.brakes.balance + '% front'),
    tuneRow('Pressure', r.brakes.pressure + '%')
  ]);
  html += tuneSection('Aero', 'AERO', [
    tuneRow('Front', esc(r.aero.front)), tuneRow('Rear', esc(r.aero.rear))
  ]);
  html += tuneSection('Gearing', 'GEARING', [
    '<div style="padding:6px 10px;font-size:13px;">' + esc(r.gearing) + '</div>'
  ]);

  return html;
}

function tuneSection(title, glossaryKey, rows) {
  return '<div class="tune-sect"><div class="tune-sect-head">' +
    '<span>' + esc(title) + '</span>' +
    '<button class="gl-btn" data-key="' + glossaryKey + '">?</button>' +
    '</div>' + rows.join('') + '</div>';
}

function tuneRow(label, value) {
  return '<div class="tune-row"><span>' + esc(label) + '</span><span>' + value + '</span></div>';
}

/* =============================================
 * UI -- GLOSSARY OVERLAY
 * ============================================= */
function showGlossary(focusKey) {
  const g = document.createElement('div');
  g.className = 'modal open';
  g.style.zIndex = '200';
  g.style.alignItems = 'flex-end';
  g.innerHTML = '<div class="modal-body" style="max-height:90vh;">' +
    '<button class="close-x" id="gl-close">\u2715</button>' +
    '<h2>Glossary</h2>' +
    GLOSSARY.map(entry =>
      '<div class="glossary-entry" id="gl-' + entry.key + '">' +
        '<h3 style="margin:16px 0 4px;font-size:15px;color:var(--accent-2,#e10600);">' + esc(entry.title) + '</h3>' +
        '<div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">' + esc(entry.body) + '</div>' +
      '</div>'
    ).join('') +
    '</div>';
  document.body.appendChild(g);
  g.querySelector('#gl-close').addEventListener('click', () => g.remove());
  g.addEventListener('click', (e) => { if (e.target === g) g.remove(); });
  if (focusKey) {
    const el = g.querySelector('#gl-' + focusKey);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 50);
  }
}

/* =============================================
 * UI -- ADD CAR
 * ============================================= */
function showAddCarModal() {
  $modalContent.innerHTML =
    '<h2>Add Custom Car</h2>' +
    '<div class="input-grid">' +
      inputField('Make', 'ac-make', '', 'Nissan') +
      inputField('Model', 'ac-model', '', 'Silvia K\'s') +
      inputField('Year', 'ac-year', 2020, '1994') +
      selectField('Drivetrain', 'ac-dt', 'RWD', [['RWD','RWD'],['AWD','AWD'],['FWD','FWD']]) +
      selectField('Stock class', 'ac-class', 'A', [['D','D'],['C','C'],['B','B'],['A','A'],['S1','S1'],['S2','S2'],['X','X']]) +
      inputField('Body type', 'ac-body', '', 'Coupe') +
      inputField('Engine layout', 'ac-engine', '', 'Front') +
    '</div>' +
    '<label style="display:flex;align-items:center;gap:8px;margin:12px 0;font-size:13px;"><input type="checkbox" id="ac-drift"> Drift-friendly</label>' +
    '<button class="btn-primary" id="ac-save">Save Car</button>';

  $modal.classList.add('open');

  document.getElementById('ac-save').addEventListener('click', async () => {
    const make = document.getElementById('ac-make').value.trim();
    const model = document.getElementById('ac-model').value.trim();
    if (!make || !model) { alert('Make and model required.'); return; }
    const nc = {
      id: 'custom_' + Date.now(), make, model,
      year: parseInt(document.getElementById('ac-year').value) || 2020,
      drivetrain: document.getElementById('ac-dt').value,
      stockClass: document.getElementById('ac-class').value,
      bodyType: document.getElementById('ac-body').value.trim(),
      engineLayout: document.getElementById('ac-engine').value.trim(),
      driftFriendly: document.getElementById('ac-drift').checked,
      custom: true
    };
    await dbPut(STORE_CUSTOM, nc);
    customCars.push(nc);
    cars = seedCars.concat(customCars);
    $modal.classList.remove('open');
    renderCarList();
  });
}

/* =============================================
 * HELPERS
 * ============================================= */
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function debounce(fn, ms) {
  let t;
  return function() {
    const args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), ms);
  };
}

function parseNum(id) {
  const v = document.getElementById(id);
  return v ? (parseFloat(v.value) || null) : null;
}

function inputField(label, id, value, placeholder) {
  const v = (value !== null && value !== undefined) ? value : '';
  const type = (typeof value === 'number' || (placeholder && placeholder.match(/^\d/))) ? 'number' : 'text';
  return '<label class="field"><span class="field-label">' + esc(label) + '</span>' +
    '<input type="' + type + '" id="' + id + '" value="' + esc(String(v)) + '" placeholder="' + esc(placeholder) + '"></label>';
}

function selectField(label, id, value, options) {
  return '<label class="field"><span class="field-label">' + esc(label) + '</span><select id="' + id + '">' +
    options.map(o => '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select></label>';
}

/* =============================================
 * DEV VALIDATOR (console only)
 * ============================================= */
window.validateTune = function() {
  const cases = [
    { name: 'RX-7 S1 AWD road', input: { weight:2900,fwd:50,hp:600,drivetrain:'AWD',compound:'race',transmission:'race',discipline:'road' },
      ref: { camberF: -1.5, caster: '5-7', rearAccelRange: '50-90', center: '~70' } },
    { name: 'Generic drift RWD sport', input: { weight:2700,fwd:52,hp:550,drivetrain:'RWD',compound:'sport',transmission:'race',discipline:'drift' },
      ref: { camberFront: '-3 to -5', caster: 7, rearAccel: 100, brakeBalance: '55-70' } }
  ];
  cases.forEach(c => {
    console.log('---', c.name, '---');
    console.log('Output:', calcTune(c.input));
    console.log('Reference:', c.ref);
  });
};

/* =============================================
 * INLINE STYLES for tune output + new inputs
 * Injected once on boot -- complements styles.css
 * ============================================= */
function injectTuneStyles() {
  if (document.getElementById('ts-v3-css')) return;
  const s = document.createElement('style');
  s.id = 'ts-v3-css';
  s.textContent =
    '.input-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}' +
    '.field{display:flex;flex-direction:column;gap:3px}' +
    '.field-label{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.6px}' +
    '.field input,.field select{background:var(--bg-card);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:8px 10px;font-size:14px;font-family:var(--mono)}' +
    '.field input:focus,.field select:focus{border-color:var(--accent);outline:none}' +
    '.disc-tabs{display:flex;gap:4px;margin:14px 0 10px}' +
    '.disc-tab{flex:1;padding:8px 4px;border:1px solid var(--border);background:var(--bg-card);color:var(--text-dim);border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.8px;cursor:pointer;text-align:center}' +
    '.disc-tab.active{background:var(--accent);border-color:var(--accent);color:#fff;box-shadow:0 0 10px var(--accent-glow)}' +
    '.disc-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}' +
    '.tune-meta{font-size:11px;color:var(--text-dim);background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:8px 10px;margin-bottom:10px;font-family:var(--mono)}' +
    '.warnings{margin-bottom:10px}' +
    '.warn-info{background:rgba(0,150,255,0.1);border:1px solid rgba(0,150,255,0.25);color:#6cb4ff;border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:6px;line-height:1.4}' +
    '.warn-warn{background:rgba(255,170,0,0.1);border:1px solid rgba(255,170,0,0.25);color:#ffb84d;border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:6px;line-height:1.4}' +
    '.tune-sect{margin-bottom:8px;border:1px solid var(--border);border-radius:6px;overflow:hidden}' +
    '.tune-sect-head{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--bg-card);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-dim)}' +
    '.gl-btn{background:none;border:1px solid var(--border);color:var(--accent-2,#e10600);border-radius:50%;width:22px;height:22px;font-size:12px;font-weight:700;cursor:pointer;padding:0;line-height:20px;text-align:center}' +
    '.gl-btn:active{background:var(--accent);color:#fff}' +
    '.tune-row{display:flex;justify-content:space-between;padding:6px 10px;font-size:13px;border-top:1px solid var(--border)}' +
    '.tune-row span:last-child{font-family:var(--mono);font-weight:700;color:var(--text)}' +
    '.btn-sm{font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid;cursor:pointer;background:none;margin-left:8px}' +
    '.btn-danger{border-color:var(--accent);color:var(--accent)}' +
    '.btn-danger:active{background:var(--accent);color:#fff}' +
    '.btn-primary{width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px}' +
    '.glossary-entry{border-bottom:1px solid var(--border);padding-bottom:12px}' +
    '.glossary-entry:last-child{border-bottom:none}' +
    '.topbar-actions{display:flex;gap:8px;margin-left:auto}' +
    '.topbar-btn{background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:6px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}' +
    '.topbar-btn:active{border-color:var(--accent);color:var(--accent)}';
  document.head.appendChild(s);
}

/* =============================================
 * BOOT
 * ============================================= */
async function boot() {
  injectTuneStyles();

  // DOM refs
  $search = document.getElementById('search');
  $filters = document.getElementById('filters');
  $count = document.getElementById('count');
  $carList = document.getElementById('car-list');
  $modal = document.getElementById('modal');
  $modalContent = document.getElementById('modal-content');
  $closeBtn = document.getElementById('close');
  $brandSub = document.querySelector('.brand-sub');

  // Open DB
  await openDb();

  // Load seed cars
  try {
    const resp = await fetch('cars.json');
    seedCars = await resp.json();
  } catch (e) {
    console.error('Failed to load cars.json', e);
    seedCars = [];
  }

  customCars = await dbGetAll(STORE_CUSTOM);
  cars = seedCars.concat(customCars);

  await migrateUserData();
  await buildTunedSet();

  // Update subtitle to reflect all-discipline support
  if ($brandSub) $brandSub.textContent = 'Tuning Calculator \u00b7 Pick a Car';

  // Add action buttons to header
  const header = document.querySelector('.topbar');
  if (header && !document.getElementById('topbar-actions')) {
    const actions = document.createElement('div');
    actions.id = 'topbar-actions';
    actions.className = 'topbar-actions';
    actions.innerHTML = '<button class="topbar-btn" id="btn-glossary">?</button><button class="topbar-btn" id="btn-add-car">+ Car</button>';
    header.appendChild(actions);
    document.getElementById('btn-glossary').addEventListener('click', () => showGlossary());
    document.getElementById('btn-add-car').addEventListener('click', () => showAddCarModal());
  }

  // Render car list
  renderCarList();

  // Search
  $search.addEventListener('input', debounce(() => {
    searchQuery = $search.value;
    renderCarList();
  }, 200));

  // Filter chips
  $filters.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $filters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      renderCarList();
    });
  });

  // Close modal
  $closeBtn.addEventListener('click', () => {
    $modal.classList.remove('open');
    currentCarId = null;
    renderCarList();
  });
  $modal.addEventListener('click', (e) => {
    if (e.target === $modal) {
      $modal.classList.remove('open');
      currentCarId = null;
      renderCarList();
    }
  });

  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
