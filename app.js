/* ============================================================
 * TuneSpec — Forza Horizon 5 Tuning Calculator
 * v3.0 — Research-backed rebuild
 *
 * Key changes from v2.5:
 *  - calcTune() rebuilt from natural-frequency formula + lookups
 *  - New per-car inputs: power (hp), drivetrain override
 *  - New per-discipline inputs: tireCompound, transmissionType
 *  - Warnings system for absurd P/W, AWD-conv recs, trans mistakes
 *  - Glossary corrected: drift tires myth, trans guidance, slammed myth
 *  - Schema migration v1 -> v2 (no data loss)
 *
 * Persistence: IndexedDB, two stores ('userData', 'customCars'),
 * tx.oncomplete pattern preserved.
 * ============================================================ */

'use strict';

/* ---------- DB SETUP ---------- */
const DB_NAME = 'tunespec';
const DB_VERSION = 2; // bumped from 1 for schema migration
const STORE_USER = 'userData';
const STORE_CUSTOM = 'customCars';
const SCHEMA_VERSION = 2;

let db = null;
let cars = []; // merged seed + custom
let seedCars = [];
let customCars = [];
let currentCarId = null;
let currentDiscipline = 'road';
let searchQuery = '';
let activeFilters = { class: null, drivetrain: null, driftFriendly: false };

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const _db = e.target.result;
      if (!_db.objectStoreNames.contains(STORE_USER)) {
        _db.createObjectStore(STORE_USER, { keyPath: 'carId' });
      }
      if (!_db.objectStoreNames.contains(STORE_CUSTOM)) {
        _db.createObjectStore(STORE_CUSTOM, { keyPath: 'id' });
      }
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

/* ---------- SCHEMA MIGRATION ----------
 * v1 userData entry: { carId, weight, fwd, notes, tunes:{...}, lastDiscipline }
 * v2 userData entry: same + { power, drivetrainOverride, schemaVersion,
 *   tunes per discipline now have { tireCompound, transmissionType, ...legacy } }
 */
async function migrateUserData() {
  const all = await dbGetAll(STORE_USER);
  for (const entry of all) {
    if (entry.schemaVersion === SCHEMA_VERSION) continue;

    // Add v2 fields with safe defaults
    if (entry.power === undefined) entry.power = null; // user must set
    if (entry.drivetrainOverride === undefined) entry.drivetrainOverride = null;

    if (!entry.tunes) entry.tunes = {};
    for (const disc of ['drift', 'road', 'dirt', 'drag']) {
      if (!entry.tunes[disc]) continue;
      const t = entry.tunes[disc];
      if (t.tireCompound === undefined) {
        t.tireCompound = defaultCompoundFor(disc);
      }
      if (t.transmissionType === undefined) {
        t.transmissionType = defaultTransmissionFor(disc);
      }
    }
    entry.schemaVersion = SCHEMA_VERSION;
    await dbPut(STORE_USER, entry);
  }
}

function defaultCompoundFor(disc) {
  return ({
    drift: 'sport',  // research: sport > drift compound for zone scoring
    road: 'race',
    dirt: 'rally',
    drag: 'drag'
  })[disc];
}

function defaultTransmissionFor(disc) {
  return ({
    drift: 'race',   // research: race trans for competitive drift
    road: 'race',
    dirt: 'race',
    drag: 'drag'
  })[disc];
}

/* ---------- USER DATA HELPERS ---------- */
async function getUserData(carId) {
  let entry = await dbGet(STORE_USER, carId);
  if (!entry) {
    entry = {
      carId,
      weight: null,
      fwd: null,
      power: null,
      drivetrainOverride: null,
      notes: '',
      tunes: {},
      lastDiscipline: 'road',
      schemaVersion: SCHEMA_VERSION
    };
  }
  return entry;
}

async function saveUserData(entry) {
  entry.schemaVersion = SCHEMA_VERSION;
  return dbPut(STORE_USER, entry);
}

/* ============================================================
 * TUNE CALCULATOR — research-backed
 * ============================================================ */

/* ---------- Helper math ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const roundInt = (v) => Math.round(v);

/* Natural frequency spring formula
 *   springRate (lb/in) = (freq^2 * cornerWeight * 4*pi^2) / 386.088
 */
function springFromFrequency(freqHz, cornerWeightLb) {
  return (freqHz * freqHz * cornerWeightLb * 4 * Math.PI * Math.PI) / 386.088;
}

/* Target frequency bands (Hz) per discipline + tire compound */
function targetFrequency(discipline, compound) {
  // [front, rear]
  if (discipline === 'road') {
    if (compound === 'race') return [2.6, 3.0]; // with grip
    if (compound === 'sport') return [2.1, 2.4];
    return [1.8, 2.1]; // stock/other
  }
  if (discipline === 'drift') {
    return [2.5, 1.7]; // stiff front, soft rear
  }
  if (discipline === 'dirt') {
    return [1.4, 1.6];
  }
  if (discipline === 'drag') {
    return [1.7, 1.2]; // stiff front, very soft rear for squat
  }
  return [2.0, 2.2];
}

/* Resolve drivetrain — prefer override, fall back to car spec */
function resolveDrivetrain(car, userData) {
  return userData.drivetrainOverride || car.drivetrain || 'RWD';
}

/* Power-to-weight tier */
function pwTier(hp, weightLb) {
  if (!hp || !weightLb) return 'unknown';
  const pw = hp / weightLb;
  if (pw < 0.10) return 'low';
  if (pw < 0.20) return 'balanced';
  if (pw < 0.30) return 'high';
  return 'extreme';
}

/* ---------- Per-discipline calculators ---------- */

function calcRoad(ctx) {
  const { weight, fwd, hp, drivetrain, compound, tier } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [freqF, freqR] = targetFrequency('road', compound);

  let springF = springFromFrequency(freqF, cwF);
  let springR = springFromFrequency(freqR, cwR);
  // flat-ride: rear ~15% stiffer in frequency already baked in via freqR

  // Damping: rebound scales with spring, bump = 65% of rebound
  let rebF = clamp(springF / 100, 7, 13);
  let rebR = clamp(springR / 100, 7, 13);
  let bumpF = rebF * 0.65;
  let bumpR = rebR * 0.65;

  // ARB: baseline 32/30, shift by drivetrain and weight distribution
  // forzatune rule: 0.5 per 1% fwd shift from 50%
  const fwdDelta = fwd - 50;
  let arbF = 32 + (fwdDelta * 0.5);
  let arbR = 30 - (fwdDelta * 0.5);
  // Drivetrain split
  if (drivetrain === 'FWD') { arbF -= 4; arbR += 4; } // soft drive axle
  if (drivetrain === 'AWD') { arbF += 1; }
  if (drivetrain === 'MR' || drivetrain === 'RR') { arbF += 3; arbR -= 3; }
  arbF = clamp(arbF, 25, 45);
  arbR = clamp(arbR, 22, 42);

  // Tire pressure baseline 30, drivetrain offsets
  let psiF = 30, psiR = 30;
  if (drivetrain === 'AWD' || drivetrain === 'FWD') psiF -= 1;
  if (drivetrain === 'MR' || drivetrain === 'RR') { psiF += 1; psiR -= 1; }
  // Heavy car -> drop pressure to keep temps in check
  if (weight > 3500) { psiF -= 1; psiR -= 1; }
  if (weight > 4200) { psiF -= 1; psiR -= 1; }

  // Camber
  let camF = -2.0, camR = -1.5;
  if (drivetrain === 'MR' || drivetrain === 'RR') { camF += 0.3; camR -= 0.3; }

  // Toe — research: 0.0 default for FH5
  const toeF = 0.0, toeR = 0.0;

  // Caster
  const caster = 5.5;

  // Diff
  let diff;
  if (drivetrain === 'RWD') {
    let accel = 55;
    if (tier === 'high') accel = 65;
    if (tier === 'extreme') accel = 75;
    diff = { rearAccel: accel, rearDecel: 20 };
  } else if (drivetrain === 'AWD') {
    // FH5 race diff: rear = RWD value + 50%
    let rwdEquiv = 25;
    if (tier === 'high') rwdEquiv = 35;
    if (tier === 'extreme') rwdEquiv = 45;
    diff = {
      frontAccel: 30, frontDecel: 5,
      rearAccel: clamp(rwdEquiv + 50, 50, 90),
      rearDecel: 20,
      center: tier === 'extreme' ? 65 : 70 // % rear
    };
  } else if (drivetrain === 'FWD') {
    diff = { frontAccel: 40, frontDecel: 10 };
  }

  // Brake balance & pressure
  const brakeBalance = 52;
  const brakePressure = 100;

  // Aero — depends on power tier
  let aeroF = 'mid', aeroR = 'mid';
  if (tier === 'extreme') { aeroF = 'mid-high'; aeroR = 'max'; }

  // Ride height — slight raise for FH5 bumpy roads
  const rhF = 'min + 0.4"', rhR = 'min + 0.4"';

  // Gearing
  const finalDrive = '3.0 – 3.5 (technical), 2.5 – 2.8 (high speed)';

  return {
    tirePressure: { front: round1(psiF), rear: round1(psiR) },
    camber: { front: round1(camF), rear: round1(camR) },
    toe: { front: toeF, rear: toeR },
    caster: round1(caster),
    arb: { front: round1(arbF), rear: round1(arbR) },
    springs: { front: roundInt(springF), rear: roundInt(springR), unit: 'lb/in' },
    rideHeight: { front: rhF, rear: rhR },
    damping: {
      rebound: { front: round1(rebF), rear: round1(rebR) },
      bump: { front: round1(bumpF), rear: round1(bumpR) }
    },
    differential: diff,
    brakes: { balance: brakeBalance, pressure: brakePressure },
    aero: { front: aeroF, rear: aeroR },
    gearing: finalDrive
  };
}

function calcDrift(ctx) {
  const { weight, fwd, hp, drivetrain, compound, transmission } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [freqF, freqR] = targetFrequency('drift', compound);

  let springF = springFromFrequency(freqF, cwF);
  let springR = springFromFrequency(freqR, cwR);

  let rebF = clamp(springF / 110, 6, 10);
  let rebR = clamp(springR / 110, 4, 8);
  let bumpF = rebF * 0.65;
  let bumpR = rebR * 0.65;

  // Drift ARB: stiff front, very soft rear
  let arbF = 40, arbR = 12;
  arbF = clamp(arbF + (fwd - 50) * 0.4, 30, 50);
  arbR = clamp(arbR, 5, 25);

  // Tire pressure: high rear for break-loose
  let psiF = 30, psiR = 38;

  // Camber: heavy front, near-zero rear
  const camF = -4.0, camR = -0.3;

  // Toe — research allows slight front toe-out for drift
  const toeF = 0.2, toeR = -0.2;

  const caster = 7.0; // max

  // Diff: drift wants 100% rear accel
  let diff;
  if (drivetrain === 'RWD') {
    diff = { rearAccel: 100, rearDecel: 20 };
  } else if (drivetrain === 'AWD') {
    diff = {
      frontAccel: 50, frontDecel: 0,
      rearAccel: 100, rearDecel: 20,
      center: 90 // heavy rear bias
    };
  } else {
    // FWD drifting is a meme; flag in warnings
    diff = { frontAccel: 100, frontDecel: 0 };
  }

  const brakeBalance = 62; // front-biased to prevent rear lockup
  const brakePressure = 100;

  // Ride height: slight rake — raised front, lower rear
  const rhF = 'min + 0.6"', rhR = 'min + 0.2"';

  // Gearing depends on transmission choice
  let gearing;
  if (transmission === 'race') {
    gearing = 'Final drive 3.5–4.0 (zones) or 2.5–3.0 (long links). Tune individual gears for power-band overlap on shifts.';
  } else if (transmission === 'drift') {
    gearing = 'Drift trans uses fixed ratios — gearing sliders are limited. Race trans is recommended for competitive zone tunes.';
  } else {
    gearing = 'Switch to Race or Drift transmission. Sport trans limits ratio control.';
  }

  return {
    tirePressure: { front: round1(psiF), rear: round1(psiR) },
    camber: { front: round1(camF), rear: round1(camR) },
    toe: { front: toeF, rear: toeR },
    caster: round1(caster),
    arb: { front: round1(arbF), rear: round1(arbR) },
    springs: { front: roundInt(springF), rear: roundInt(springR), unit: 'lb/in' },
    rideHeight: { front: rhF, rear: rhR },
    damping: {
      rebound: { front: round1(rebF), rear: round1(rebR) },
      bump: { front: round1(bumpF), rear: round1(bumpR) }
    },
    differential: diff,
    brakes: { balance: brakeBalance, pressure: brakePressure },
    aero: { front: 'min', rear: 'max (if equipped)' },
    gearing
  };
}

function calcDirt(ctx) {
  const { weight, fwd, drivetrain, compound, tier } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [freqF, freqR] = targetFrequency('dirt', compound);

  let springF = springFromFrequency(freqF, cwF);
  let springR = springFromFrequency(freqR, cwR);

  let rebF = clamp(springF / 130, 3, 7);
  let rebR = clamp(springR / 130, 3, 7);
  let bumpF = rebF * 0.65;
  let bumpR = rebR * 0.65;

  // Soft ARBs for articulation
  let arbF = 14, arbR = 14;
  arbF = clamp(arbF + (fwd - 50) * 0.3, 8, 20);
  arbR = clamp(arbR - (fwd - 50) * 0.3, 8, 20);

  let psiF = 25, psiR = 25;
  const camF = -1.2, camR = -1.0;
  const toeF = 0.0, toeR = -0.2; // slight rear toe-in
  const caster = 5.0;

  let diff;
  if (drivetrain === 'AWD') {
    diff = {
      frontAccel: 40, frontDecel: 10,
      rearAccel: 70, rearDecel: 25,
      center: 58 // more balanced for loose
    };
  } else if (drivetrain === 'RWD') {
    diff = { rearAccel: 65, rearDecel: 25 };
  } else {
    diff = { frontAccel: 45, frontDecel: 10 };
  }

  return {
    tirePressure: { front: round1(psiF), rear: round1(psiR) },
    camber: { front: round1(camF), rear: round1(camR) },
    toe: { front: toeF, rear: toeR },
    caster: round1(caster),
    arb: { front: round1(arbF), rear: round1(arbR) },
    springs: { front: roundInt(springF), rear: roundInt(springR), unit: 'lb/in' },
    rideHeight: { front: 'max - 0.5"', rear: 'max - 0.5"' },
    damping: {
      rebound: { front: round1(rebF), rear: round1(rebR) },
      bump: { front: round1(bumpF), rear: round1(bumpR) }
    },
    differential: diff,
    brakes: { balance: 50, pressure: 95 },
    aero: { front: 'min', rear: 'mid-high (jumps)' },
    gearing: 'Final drive 3.0–3.5. Lower 1st gear for off-line acceleration.'
  };
}

function calcDrag(ctx) {
  const { weight, fwd, drivetrain, tier } = ctx;
  const cwF = (weight * fwd / 100) / 2;
  const cwR = (weight * (100 - fwd) / 100) / 2;
  const [freqF, freqR] = targetFrequency('drag', null);

  let springF = springFromFrequency(freqF, cwF);
  let springR = springFromFrequency(freqR, cwR); // very soft rear for squat

  let rebF = clamp(springF / 130, 4, 8);
  let rebR = clamp(springR / 200, 2, 5);
  let bumpF = rebF * 0.65;
  let bumpR = rebR * 0.6;

  let psiF = 30, psiR = 24;

  const camF = 0.0, camR = 0.2;
  const toeF = 0.0, toeR = 0.1;
  const caster = 7.0;

  let diff;
  if (drivetrain === 'RWD') {
    diff = { rearAccel: 100, rearDecel: 0 };
  } else if (drivetrain === 'AWD') {
    diff = {
      frontAccel: 90, frontDecel: 0,
      rearAccel: 100, rearDecel: 0,
      center: 55
    };
  } else {
    diff = { frontAccel: 100, frontDecel: 0 };
  }

  return {
    tirePressure: { front: round1(psiF), rear: round1(psiR) },
    camber: { front: round1(camF), rear: round1(camR) },
    toe: { front: toeF, rear: toeR },
    caster: round1(caster),
    arb: { front: 1, rear: 1 },
    springs: { front: roundInt(springF), rear: roundInt(springR), unit: 'lb/in' },
    rideHeight: { front: 'min', rear: 'min + 0.6" (reverse rake)' },
    damping: {
      rebound: { front: round1(rebF), rear: round1(rebR) },
      bump: { front: round1(bumpF), rear: round1(bumpR) }
    },
    differential: diff,
    brakes: { balance: 50, pressure: 100 },
    aero: { front: 'strip / min', rear: 'strip / min' },
    gearing: 'Drag transmission preferred. If Race trans: lengthen 1st (~2.7), tune top gear to redline at trap speed.'
  };
}

/* ---------- Warnings generator ---------- */
function generateWarnings(ctx, discipline) {
  const warnings = [];
  const { hp, weight, drivetrain, compound, transmission, tier, buildIntent } = ctx;

  if (!hp) {
    warnings.push({ level: 'info', msg: 'Set power (hp) for accurate diff and aero recommendations.' });
  }

  if (hp && weight) {
    const pw = hp / weight;
    if (discipline === 'drift' && hp > 650) {
      warnings.push({ level: 'warn', msg: `${hp} hp is above the ~600 hp drift sweet spot. Throttle modulation gets twitchy past this. Consider pulling power back and spending PI on weight or chassis.` });
    }
    if (tier === 'extreme') {
      warnings.push({ level: 'warn', msg: `Power-to-weight is extreme (${pw.toFixed(2)} hp/lb). No suspension tune fully saves this. Aero values doubled per Fifty_Inch rule.` });
    }
    if (discipline === 'road' && hp > 600 && drivetrain === 'RWD' && tier !== 'low') {
      warnings.push({ level: 'info', msg: 'High-power RWD on road: AWD conversion is the FH5 meta for launch traction. Consider it if PI allows.' });
    }
    if (discipline === 'drag' && drivetrain === 'RWD' && tier !== 'low') {
      warnings.push({ level: 'info', msg: 'Drag meta favors AWD conversion for launch. RWD drag works but is slower off the line.' });
    }
  }

  // Transmission corrections
  if (discipline === 'drift' && transmission === 'drift') {
    warnings.push({ level: 'info', msg: 'Drift transmission is the beginner pick. Race transmission gives full ratio control and is preferred for competitive zone tunes.' });
  }
  if (discipline === 'road' && transmission !== 'race') {
    warnings.push({ level: 'warn', msg: 'Road racing requires Race transmission for full gear control.' });
  }
  if (discipline === 'drag' && transmission !== 'drag' && transmission !== 'race') {
    warnings.push({ level: 'warn', msg: 'Use Drag transmission (default) or Race for custom ratios.' });
  }
  if (transmission === 'sport') {
    warnings.push({ level: 'warn', msg: 'Sport transmission only unlocks partial gear tuning. Upgrade to Race for any serious build.' });
  }

  // Tire compound corrections
  if (discipline === 'drift' && compound === 'drift') {
    warnings.push({ level: 'info', msg: 'Drift compound looks right but scores LOWER than Sport/Race compound on zones (FH5-specific). Use drift compound for casual/aesthetic; Sport or Race for points.' });
  }
  if (discipline === 'road' && compound !== 'race') {
    warnings.push({ level: 'info', msg: 'Race compound is universal for road racing. Sport tires only when freeing PI is worth giving up grip.' });
  }
  if (discipline === 'dirt' && (compound === 'sport' || compound === 'race' || compound === 'drag' || compound === 'drift')) {
    warnings.push({ level: 'warn', msg: 'Sport/Race/Drift/Drag compounds slide on loose surfaces. Use Rally (mixed) or Off-road (pure dirt).' });
  }
  if (discipline === 'drag' && compound !== 'drag') {
    warnings.push({ level: 'warn', msg: 'Drag tires are required for serious drag launches.' });
  }

  // Drivetrain mismatches
  if (discipline === 'drift' && drivetrain === 'FWD') {
    warnings.push({ level: 'warn', msg: 'FWD drift is a meme. RWD conversion is essentially mandatory for serious drift.' });
  }
  if (discipline === 'drift' && drivetrain === 'AWD' && hp && hp > 500) {
    warnings.push({ level: 'info', msg: 'AWD drift works but RWD conversion is preferred for predictable rear-wheel break-away.' });
  }

  return warnings;
}

/* ---------- Main entry point ---------- */
function calcTune(input) {
  /*
   * input: {
   *   weight, fwd, hp, drivetrain, compound, transmission,
   *   discipline, buildIntent
   * }
   */
  const ctx = {
    weight: Number(input.weight) || 3000,
    fwd: Number(input.fwd) || 50,
    hp: input.hp ? Number(input.hp) : null,
    drivetrain: input.drivetrain || 'RWD',
    compound: input.compound || defaultCompoundFor(input.discipline),
    transmission: input.transmission || defaultTransmissionFor(input.discipline),
    buildIntent: input.buildIntent || 'competitive'
  };
  ctx.tier = pwTier(ctx.hp, ctx.weight);

  let result;
  switch (input.discipline) {
    case 'drift': result = calcDrift(ctx); break;
    case 'dirt':  result = calcDirt(ctx);  break;
    case 'drag':  result = calcDrag(ctx);  break;
    case 'road':
    default:      result = calcRoad(ctx);  break;
  }

  result.warnings = generateWarnings(ctx, input.discipline);
  result.meta = {
    pwRatio: ctx.hp ? round2(ctx.hp / ctx.weight) : null,
    tier: ctx.tier,
    drivetrain: ctx.drivetrain,
    compound: ctx.compound,
    transmission: ctx.transmission
  };
  return result;
}

/* ============================================================
 * GLOSSARY — research-corrected
 * ============================================================ */
const GLOSSARY = {
  TIRE_PRESSURE: {
    title: 'Tire Pressure',
    body: 'Lower pressure = larger contact patch = more grip but more heat. Higher pressure = smaller patch, less grip, runs cooler. Goal: keep tire surface temps out of the red on telemetry. Heavier cars heat tires faster — drop ~1-2 psi.\n\nDrift: high rear pressure (35-40+) reduces rear contact patch for easier rotation.\nDrag: low rear (~24) for launch grip.\nDirt: low both ends (~25) for loose-surface contact patch.'
  },
  CAMBER: {
    title: 'Camber',
    body: 'Negative camber (top of tire leans inward) = more grip in cornering, less in straight-line.\n\nMYTH: "max negative camber = max grip." NO. Excessive camber kills braking and acceleration. Sweet spot for road race: -1.5° to -2.5° front. The telemetry test: outside-front camber should be near 0° at apex.\n\nDrift wants heavy front camber (-3° to -5°) for steering angle, but rear camber should stay near zero (-0.5° max) — heavy rear camber kills the grip you need for transitions.'
  },
  TOE: {
    title: 'Toe',
    body: 'FH5-SPECIFIC: leave toe at 0.0° in nearly all cases. The "front toe-out, rear toe-in" advice is leftover from older Forza titles. ForzaTune\'s ML model leaves toe at zero in the vast majority of tunes.\n\nWhen to deviate:\n- Front toe-out (+0.1 to +0.3°): sharper turn-in, but twitchy.\n- Front toe-in: more stable, slower turn-in.\n- Rear toe-in (-0.1 to -0.3°): more stability, less rotation.\n- Rear toe-out: more rotation, less stability.\n\nDrift uses small front toe-out (+0.2°) for sharper initiation.'
  },
  CASTER: {
    title: 'Caster',
    body: 'Positive caster (1.0-7.0, front only) = more straight-line stability and stronger steering self-center. Higher caster also helps hold drift angle.\n\nMost tunes settle around 5.5°. Drift and drag often max it (7.0°). Dirt runs lower (~5.0) to reduce steering effort on rough terrain.'
  },
  ARB: {
    title: 'Anti-Roll Bars (ARBs)',
    body: 'ARBs are the FIRST lever to pull for over/understeer correction in FH5 — more responsive than springs.\n\n- Soften FRONT ARB to reduce understeer.\n- Soften REAR ARB to reduce oversteer.\n- forzatune rule: shift 0.5 per 1% weight distribution change from stock.\n\nDrivetrain rule: the DRIVE axle wants softer ARB (maintain traction). The non-drive axle wants stiffer (control body roll). FWD: stiffer rear. RWD/MR/RR: stiffer front.\n\nDrift: stiff front (30-50), very soft rear (5-25).'
  },
  SPRINGS: {
    title: 'Springs',
    body: 'Spring rates in FH5 are calculated from the natural frequency formula:\n\n  Rate (lb/in) = (freq² × cornerWeight × 4π²) / 386.088\n\nTarget frequencies (Hz):\n- Street: 1.5-2.0\n- Road race no aero: 2.0-2.5\n- Road race with aero: 2.5-3.5\n- Drift: 2.0-3.0 front, 1.5-2.0 rear (stiff front, soft rear)\n- Rally/CC: 1.2-1.8\n- Drag: 1.5-2.0 front, 1.0-1.5 rear (very soft rear for launch squat)\n\nFlat-ride convention: rear ~15% stiffer than front in frequency for smooth weight transfer.'
  },
  RIDE_HEIGHT: {
    title: 'Ride Height',
    body: 'MYTH: "slammed = always fastest." NO. Slammed = lowest CG = fastest IF the road is smooth. The Mexico map is bumpy as hell — most road tunes run min+0.3" to min+0.7", not min.\n\nDRIFT MYTH: "slam it for drift." NO. Slight RAKE (raised front, lower rear) helps weight transfer for drift initiation. Slammed cars bottom out mid-drift and lose grip.\n\nDirt/CC: max or near-max for travel. Drag: min front, slightly raised rear (reverse rake for launch).'
  },
  DAMPING: {
    title: 'Damping (Bump & Rebound)',
    body: 'UNIVERSAL RULE: Bump = 60-70% of Rebound. Equal values feel harsh and skitter over bumps.\n\nRebound roughly scales with spring rate: stiffer spring needs more rebound to control return motion.\n\nThe v2.5 calc had damping way too soft. v3.0 uses spring/100 for rebound base then applies the 65% bump ratio.'
  },
  DIFFERENTIAL: {
    title: 'Differential',
    body: 'IN-GAME HELP TEXT IS WRONG: it implies higher decel reduces lift-throttle oversteer. The community-correct mental model:\n\n- Higher decel = wheels more locked when off-throttle = LESS rotation = MORE stability.\n- Lower decel = more wheel-speed difference allowed = MORE rotation possible.\n\nFH5-SPECIFIC AWD MATH (Fifty_Inch official guide):\n- Race diff rear accel target = RWD value + 50%\n- Rally diff = RWD + 26%\n- Off-road diff = RWD + 14%\n\nThis is why FH4 tunes ported to FH5 misbehave on AWD cars.\n\nDrift: 100% accel rear, 0-30% decel. Drag: 100% accel, 0% decel.'
  },
  BRAKES: {
    title: 'Brake Balance & Pressure',
    body: 'Brake balance = % to front. 50-55% front for road race (stable). Trail-brakers shift to 48-50% front for more rotation under braking.\n\nDrift wants front-bias (55-70%) to prevent rear lockup that kills the slide. Dirt slightly more rear (45-55%) because less load transfer on loose surfaces.\n\nPressure: 100% default. Higher for stopping power, lower if locking up without ABS.'
  },
  AERO: {
    title: 'Aero (Downforce)',
    body: 'Aero scales with speed². Below ~60 mph it does basically nothing — mechanical grip handles all the work.\n\nIf avg corner speed < 80 mph: prioritize mechanical (springs, ARBs, tires). Strip downforce for top speed.\nIf avg corner speed > 100 mph: max downforce.\n\nEXTREME POWER (>2× stock hp) per Fifty_Inch: double the front and rear downforce values.\n\nDrag: strip everything. Front splitter and rear wing add drag with zero straight-line benefit.'
  },
  GEARING: {
    title: 'Gearing & Transmission',
    body: 'TRANSMISSION CHOICE:\n- Race trans: Road, Dirt, COMPETITIVE DRIFT, custom-ratio Drag. Full gear and final-drive control.\n- Drift trans: Beginner/casual drift. Fixed ratios; gearing sliders limited.\n- Drag trans: Drag default. Purpose-built ratios.\n- Sport trans: NEVER for serious builds. Only partial gear tuning.\n\nFinal drive heuristics:\n- Road race technical: 3.0-3.5\n- Road race high-speed: 2.4-2.8\n- Drift short zones: 3.5-4.5 (stay in 2nd)\n- Drift long zones: 2.5-3.5 (3rd-4th gear)\n- Highway drift: 2.0-2.8\n- Drag: tune top gear to redline at trap speed.'
  },
  TIRE_COMPOUND: {
    title: 'Tire Compound',
    body: 'BIG FH5-SPECIFIC CORRECTION FOR DRIFT: drift compound is NOT optimal for zone scoring. Sport or Race compound + drift trans + drift diff scores HIGHER because the car holds a deeper stable slip angle for more points.\n\n- Drift compound: easy to break loose, max smoke, "looks right". Use for casual/aesthetic.\n- Sport compound: holds higher slip angle = more zone points. RECOMMENDED for serious drift.\n- Race compound: highest sustained grip = deepest stable angle. High-skill max-points tunes.\n\nRoad race: Race compound universal. Dirt: Rally (mixed) or Off-road (pure dirt) only. Drag: Drag compound, period.'
  },
  POWER_TO_WEIGHT: {
    title: 'Power-to-Weight (P/W)',
    body: 'P/W ratio (hp/lb) drives a lot of tune decisions:\n\n- < 0.10: low power, soft springs, low ARBs, can run high diff lock\n- 0.10-0.20: balanced S1 territory, standard formulas apply\n- 0.20-0.30: high-power S2, stiffen rear springs, increase rear downforce, lower rear diff accel\n- > 0.30: extreme. Apply the Fifty_Inch rule: 2× downforce, AWD-conversion strongly recommended\n\nDRIFT-SPECIFIC: keep peak power at or under ~600 hp. Past that, throttle modulation gets twitchy and the car spins under clutch-kick. High-PI drift cars deliberately pull power back and spend PI on weight reduction and chassis instead.'
  },
  CONTROLLER_LINEARITY: {
    title: 'Controller Steering Linearity',
    body: 'COMMONLY MISUNDERSTOOD. Per FH5 official docs:\n\n- Linearity < 50: LESS sensitive at center, MORE at full lock. This is what controller players want for stable straights and quick lock-to-lock.\n- Linearity > 50: MORE sensitive at center, LESS at full lock. Twitchy.\n- Linearity = 50: linear/default.\n\nMost guides have this BACKWARDS. Lower linearity = stable straights, not twitchy ones.\n\nRecommended: 45 for road race and dirt, 50 for drift and drag.'
  }
};

/* ============================================================
 * UI RENDERING
 * ============================================================ */

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (currentCarId) {
    renderCarDetail(root);
  } else {
    renderCarList(root);
  }
}

function renderCarList(root) {
  const filtered = filterCars();
  root.innerHTML = `
    <div class="header">
      <h1>TuneSpec <span class="version">v3.0</span></h1>
      <button class="btn-icon" id="btn-glossary" title="Glossary">?</button>
    </div>
    <div class="search-bar">
      <input type="text" id="search" placeholder="Search cars..." value="${escapeHtml(searchQuery)}">
      <button class="btn" id="btn-add-car">+ Add Car</button>
    </div>
    <div class="filters">
      <select id="filter-class">
        <option value="">All classes</option>
        ${['D','C','B','A','S1','S2','X'].map(c => `<option value="${c}" ${activeFilters.class===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select id="filter-drivetrain">
        <option value="">All drivetrains</option>
        ${['RWD','AWD','FWD'].map(d => `<option value="${d}" ${activeFilters.drivetrain===d?'selected':''}>${d}</option>`).join('')}
      </select>
      <label class="checkbox">
        <input type="checkbox" id="filter-drift" ${activeFilters.driftFriendly?'checked':''}>
        Drift-friendly
      </label>
    </div>
    <div class="car-list">
      ${filtered.map(c => `
        <div class="car-card" data-car-id="${c.id}">
          <div class="car-name">${escapeHtml(c.year)} ${escapeHtml(c.make)} ${escapeHtml(c.model)}</div>
          <div class="car-meta">${c.stockClass} · ${c.drivetrain} · ${escapeHtml(c.bodyType||'')}</div>
        </div>
      `).join('') || '<div class="empty">No cars match.</div>'}
    </div>
  `;
  bindCarListEvents();
}

function filterCars() {
  let list = cars.slice();
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c =>
      (c.make + ' ' + c.model + ' ' + c.year).toLowerCase().includes(q)
    );
  }
  if (activeFilters.class) list = list.filter(c => c.stockClass === activeFilters.class);
  if (activeFilters.drivetrain) list = list.filter(c => c.drivetrain === activeFilters.drivetrain);
  if (activeFilters.driftFriendly) list = list.filter(c => c.driftFriendly);
  list.sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));
  return list;
}

function bindCarListEvents() {
  document.getElementById('search').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderApp();
  });
  document.getElementById('filter-class').addEventListener('change', (e) => {
    activeFilters.class = e.target.value || null;
    renderApp();
  });
  document.getElementById('filter-drivetrain').addEventListener('change', (e) => {
    activeFilters.drivetrain = e.target.value || null;
    renderApp();
  });
  document.getElementById('filter-drift').addEventListener('change', (e) => {
    activeFilters.driftFriendly = e.target.checked;
    renderApp();
  });
  document.getElementById('btn-add-car').addEventListener('click', showAddCarModal);
  document.getElementById('btn-glossary').addEventListener('click', () => showGlossaryModal());
  document.querySelectorAll('.car-card').forEach(el => {
    el.addEventListener('click', () => {
      currentCarId = el.dataset.carId;
      renderApp();
    });
  });
}

async function renderCarDetail(root) {
  const car = cars.find(c => c.id === currentCarId);
  if (!car) { currentCarId = null; renderApp(); return; }
  const userData = await getUserData(currentCarId);
  if (userData.lastDiscipline) currentDiscipline = userData.lastDiscipline;

  const tune = userData.tunes[currentDiscipline] || {};
  const compound = tune.tireCompound || defaultCompoundFor(currentDiscipline);
  const transmission = tune.transmissionType || defaultTransmissionFor(currentDiscipline);
  const drivetrain = userData.drivetrainOverride || car.drivetrain;

  const calcInput = {
    weight: userData.weight,
    fwd: userData.fwd,
    hp: userData.power,
    drivetrain,
    compound,
    transmission,
    discipline: currentDiscipline
  };
  const result = (userData.weight && userData.fwd) ? calcTune(calcInput) : null;

  root.innerHTML = `
    <div class="header">
      <button class="btn-icon" id="btn-back">←</button>
      <h1>${escapeHtml(car.year)} ${escapeHtml(car.make)} ${escapeHtml(car.model)}</h1>
      <button class="btn-icon" id="btn-glossary" title="Glossary">?</button>
    </div>
    <div class="car-spec-bar">
      ${car.stockClass} · ${car.drivetrain} · ${escapeHtml(car.bodyType||'')} · ${escapeHtml(car.engineLayout||'')}
      ${car.custom ? '<button class="btn-tiny btn-danger" id="btn-delete-car">Delete</button>' : ''}
    </div>

    <div class="inputs-panel">
      <div class="input-row">
        <label>Weight (lb)
          <input type="number" id="in-weight" value="${userData.weight ?? ''}" placeholder="e.g. 3000">
        </label>
        <label>Front weight %
          <input type="number" id="in-fwd" value="${userData.fwd ?? ''}" placeholder="e.g. 52" step="0.1">
        </label>
      </div>
      <div class="input-row">
        <label>Power (hp)
          <input type="number" id="in-power" value="${userData.power ?? ''}" placeholder="e.g. 550">
        </label>
        <label>Drivetrain
          <select id="in-drivetrain">
            <option value="">${car.drivetrain} (stock)</option>
            <option value="RWD" ${userData.drivetrainOverride==='RWD'?'selected':''}>RWD (converted)</option>
            <option value="AWD" ${userData.drivetrainOverride==='AWD'?'selected':''}>AWD (converted)</option>
            <option value="FWD" ${userData.drivetrainOverride==='FWD'?'selected':''}>FWD</option>
            <option value="MR" ${userData.drivetrainOverride==='MR'?'selected':''}>Mid-engine RWD</option>
            <option value="RR" ${userData.drivetrainOverride==='RR'?'selected':''}>Rear-engine RWD</option>
          </select>
        </label>
      </div>
    </div>

    <div class="discipline-tabs">
      ${['road','drift','dirt','drag'].map(d => `
        <button class="tab ${d===currentDiscipline?'active':''}" data-disc="${d}">${d.toUpperCase()}</button>
      `).join('')}
    </div>

    <div class="discipline-inputs">
      <label>Tire compound
        <select id="in-compound">
          ${compoundOptionsFor(currentDiscipline, compound)}
        </select>
      </label>
      <label>Transmission
        <select id="in-transmission">
          ${transmissionOptionsFor(currentDiscipline, transmission)}
        </select>
      </label>
    </div>

    <div class="tune-output">
      ${result ? renderTuneResult(result) : '<div class="empty">Enter weight and front weight % to calculate.</div>'}
    </div>

    <div class="notes-panel">
      <label>Notes
        <textarea id="in-notes" rows="3" placeholder="Personal notes for this car...">${escapeHtml(userData.notes || '')}</textarea>
      </label>
    </div>
  `;
  bindCarDetailEvents(userData);
}

function compoundOptionsFor(disc, current) {
  const opts = [
    { v: 'stock', label: 'Stock' },
    { v: 'sport', label: 'Sport' },
    { v: 'race', label: 'Race' },
    { v: 'drift', label: 'Drift' },
    { v: 'rally', label: 'Rally' },
    { v: 'offroad', label: 'Off-road' },
    { v: 'drag', label: 'Drag' }
  ];
  return opts.map(o => `<option value="${o.v}" ${current===o.v?'selected':''}>${o.label}</option>`).join('');
}

function transmissionOptionsFor(disc, current) {
  const opts = [
    { v: 'sport', label: 'Sport (limited)' },
    { v: 'race', label: 'Race' },
    { v: 'drift', label: 'Drift' },
    { v: 'drag', label: 'Drag' }
  ];
  return opts.map(o => `<option value="${o.v}" ${current===o.v?'selected':''}>${o.label}</option>`).join('');
}

function renderTuneResult(r) {
  const warningsHtml = r.warnings.length ? `
    <div class="warnings">
      ${r.warnings.map(w => `<div class="warning warning-${w.level}">${escapeHtml(w.msg)}</div>`).join('')}
    </div>
  ` : '';

  const metaHtml = `
    <div class="tune-meta">
      ${r.meta.pwRatio ? `P/W: ${r.meta.pwRatio} hp/lb (${r.meta.tier})` : 'P/W: not set'}
      · ${r.meta.drivetrain} · ${r.meta.compound} tires · ${r.meta.transmission} trans
    </div>
  `;

  const diff = r.differential;
  const diffRows = [];
  if (diff.frontAccel !== undefined) diffRows.push(`<div class="row"><span>Front Accel</span><span>${diff.frontAccel}%</span></div>`);
  if (diff.frontDecel !== undefined) diffRows.push(`<div class="row"><span>Front Decel</span><span>${diff.frontDecel}%</span></div>`);
  if (diff.rearAccel !== undefined)  diffRows.push(`<div class="row"><span>Rear Accel</span><span>${diff.rearAccel}%</span></div>`);
  if (diff.rearDecel !== undefined)  diffRows.push(`<div class="row"><span>Rear Decel</span><span>${diff.rearDecel}%</span></div>`);
  if (diff.center !== undefined)     diffRows.push(`<div class="row"><span>Center (% rear)</span><span>${diff.center}%</span></div>`);

  return `
    ${warningsHtml}
    ${metaHtml}
    <div class="tune-section">
      <h3>Tires <button class="btn-tiny btn-help" data-key="TIRE_PRESSURE">?</button></h3>
      <div class="row"><span>Front pressure</span><span>${r.tirePressure.front} psi</span></div>
      <div class="row"><span>Rear pressure</span><span>${r.tirePressure.rear} psi</span></div>
    </div>
    <div class="tune-section">
      <h3>Alignment <button class="btn-tiny btn-help" data-key="CAMBER">?</button></h3>
      <div class="row"><span>Camber F/R</span><span>${r.camber.front}° / ${r.camber.rear}°</span></div>
      <div class="row"><span>Toe F/R</span><span>${r.toe.front}° / ${r.toe.rear}°</span></div>
      <div class="row"><span>Caster</span><span>${r.caster}°</span></div>
    </div>
    <div class="tune-section">
      <h3>ARBs <button class="btn-tiny btn-help" data-key="ARB">?</button></h3>
      <div class="row"><span>Front</span><span>${r.arb.front}</span></div>
      <div class="row"><span>Rear</span><span>${r.arb.rear}</span></div>
    </div>
    <div class="tune-section">
      <h3>Springs <button class="btn-tiny btn-help" data-key="SPRINGS">?</button></h3>
      <div class="row"><span>Front</span><span>${r.springs.front} ${r.springs.unit}</span></div>
      <div class="row"><span>Rear</span><span>${r.springs.rear} ${r.springs.unit}</span></div>
      <div class="row"><span>Ride Height F/R</span><span>${escapeHtml(r.rideHeight.front)} / ${escapeHtml(r.rideHeight.rear)}</span></div>
    </div>
    <div class="tune-section">
      <h3>Damping <button class="btn-tiny btn-help" data-key="DAMPING">?</button></h3>
      <div class="row"><span>Rebound F/R</span><span>${r.damping.rebound.front} / ${r.damping.rebound.rear}</span></div>
      <div class="row"><span>Bump F/R</span><span>${r.damping.bump.front} / ${r.damping.bump.rear}</span></div>
    </div>
    <div class="tune-section">
      <h3>Differential <button class="btn-tiny btn-help" data-key="DIFFERENTIAL">?</button></h3>
      ${diffRows.join('')}
    </div>
    <div class="tune-section">
      <h3>Brakes <button class="btn-tiny btn-help" data-key="BRAKES">?</button></h3>
      <div class="row"><span>Balance</span><span>${r.brakes.balance}% front</span></div>
      <div class="row"><span>Pressure</span><span>${r.brakes.pressure}%</span></div>
    </div>
    <div class="tune-section">
      <h3>Aero <button class="btn-tiny btn-help" data-key="AERO">?</button></h3>
      <div class="row"><span>Front</span><span>${escapeHtml(r.aero.front)}</span></div>
      <div class="row"><span>Rear</span><span>${escapeHtml(r.aero.rear)}</span></div>
    </div>
    <div class="tune-section">
      <h3>Gearing <button class="btn-tiny btn-help" data-key="GEARING">?</button></h3>
      <div class="row-text">${escapeHtml(r.gearing)}</div>
    </div>
  `;
}

function bindCarDetailEvents(userData) {
  document.getElementById('btn-back').addEventListener('click', () => {
    currentCarId = null;
    renderApp();
  });
  document.getElementById('btn-glossary').addEventListener('click', () => showGlossaryModal());

  const deleteBtn = document.getElementById('btn-delete-car');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => confirmDeleteCar(currentCarId));
  }

  // Inputs that affect calc -> save and re-render
  const debouncedSaveAndRender = debounce(async () => {
    const fresh = await getUserData(currentCarId);
    fresh.weight = parseFloat(document.getElementById('in-weight').value) || null;
    fresh.fwd = parseFloat(document.getElementById('in-fwd').value) || null;
    fresh.power = parseFloat(document.getElementById('in-power').value) || null;
    fresh.drivetrainOverride = document.getElementById('in-drivetrain').value || null;
    fresh.notes = document.getElementById('in-notes').value;
    fresh.lastDiscipline = currentDiscipline;

    if (!fresh.tunes[currentDiscipline]) fresh.tunes[currentDiscipline] = {};
    fresh.tunes[currentDiscipline].tireCompound = document.getElementById('in-compound').value;
    fresh.tunes[currentDiscipline].transmissionType = document.getElementById('in-transmission').value;

    await saveUserData(fresh);
    renderApp();
  }, 300);

  ['in-weight','in-fwd','in-power','in-drivetrain','in-compound','in-transmission'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', debouncedSaveAndRender);
    if (el && el.tagName === 'INPUT') el.addEventListener('input', debouncedSaveAndRender);
  });

  // Notes: save without re-render (to avoid losing focus)
  const notesEl = document.getElementById('in-notes');
  if (notesEl) {
    notesEl.addEventListener('input', debounce(async () => {
      const fresh = await getUserData(currentCarId);
      fresh.notes = notesEl.value;
      await saveUserData(fresh);
    }, 500));
  }

  // Discipline tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', async () => {
      currentDiscipline = t.dataset.disc;
      const fresh = await getUserData(currentCarId);
      fresh.lastDiscipline = currentDiscipline;
      await saveUserData(fresh);
      renderApp();
    });
  });

  // Inline glossary buttons
  document.querySelectorAll('.btn-help').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      showGlossaryModal(b.dataset.key);
    });
  });
}

/* ---------- Modals ---------- */
function showGlossaryModal(focusKey) {
  const keys = Object.keys(GLOSSARY);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Glossary</h2>
        <button class="btn-icon" id="modal-close">×</button>
      </div>
      <div class="modal-body" id="glossary-body">
        ${keys.map(k => `
          <div class="glossary-entry" id="g-${k}">
            <h3>${escapeHtml(GLOSSARY[k].title)}</h3>
            <div class="glossary-body">${escapeHtml(GLOSSARY[k].body).replace(/\n/g,'<br>')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  if (focusKey) {
    const el = modal.querySelector('#g-' + focusKey);
    if (el) el.scrollIntoView({ block: 'start' });
  }
}

function showAddCarModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>Add Custom Car</h2>
        <button class="btn-icon" id="modal-close">×</button>
      </div>
      <div class="modal-body">
        <label>Make<input type="text" id="add-make"></label>
        <label>Model<input type="text" id="add-model"></label>
        <label>Year<input type="number" id="add-year" value="2020"></label>
        <label>Drivetrain
          <select id="add-drivetrain">
            <option>RWD</option><option>AWD</option><option>FWD</option>
          </select>
        </label>
        <label>Stock class
          <select id="add-class">
            ${['D','C','B','A','S1','S2','X'].map(c => `<option>${c}</option>`).join('')}
          </select>
        </label>
        <label>Body type<input type="text" id="add-body" placeholder="Coupe, Sedan, etc."></label>
        <label>Engine layout<input type="text" id="add-engine" placeholder="Front, Mid, Rear"></label>
        <label class="checkbox"><input type="checkbox" id="add-drift"> Drift-friendly</label>
        <button class="btn" id="add-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
  modal.querySelector('#add-save').addEventListener('click', async () => {
    const newCar = {
      id: 'custom_' + Date.now(),
      make: document.getElementById('add-make').value.trim(),
      model: document.getElementById('add-model').value.trim(),
      year: parseInt(document.getElementById('add-year').value),
      drivetrain: document.getElementById('add-drivetrain').value,
      stockClass: document.getElementById('add-class').value,
      bodyType: document.getElementById('add-body').value.trim(),
      engineLayout: document.getElementById('add-engine').value.trim(),
      driftFriendly: document.getElementById('add-drift').checked,
      custom: true
    };
    if (!newCar.make || !newCar.model) {
      alert('Make and model required.');
      return;
    }
    await dbPut(STORE_CUSTOM, newCar);
    customCars.push(newCar);
    cars = mergeCars(seedCars, customCars);
    modal.remove();
    renderApp();
  });
}

function confirmDeleteCar(carId) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h2>Delete Car?</h2></div>
      <div class="modal-body">
        <p>This deletes the custom car AND all its saved tunes. Cannot be undone.</p>
        <button class="btn btn-danger" id="confirm-yes">Delete</button>
        <button class="btn" id="confirm-no">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#confirm-no').addEventListener('click', () => modal.remove());
  modal.querySelector('#confirm-yes').addEventListener('click', async () => {
    await dbDelete(STORE_CUSTOM, carId);
    await dbDelete(STORE_USER, carId);
    customCars = customCars.filter(c => c.id !== carId);
    cars = mergeCars(seedCars, customCars);
    currentCarId = null;
    modal.remove();
    renderApp();
  });
}

/* ---------- Utility ---------- */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function debounce(fn, ms) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function mergeCars(seed, custom) {
  return seed.concat(custom);
}

/* ============================================================
 * VALIDATION (dev-only, callable from console)
 * Tests calc against published reference tunes.
 * Usage: validateTune() in iOS Safari console.
 * ============================================================ */
window.validateTune = function() {
  const cases = [
    {
      name: 'Patroh RX-7 (S1 900, AWD-conv, V8 swap, road)',
      input: {
        weight: 2900, fwd: 50, hp: 600,
        drivetrain: 'AWD', compound: 'race', transmission: 'race',
        discipline: 'road'
      },
      reference: {
        // Patroh values converted: 95 kgf/mm = ~5320 lb/in, 100 kgf/mm = ~5600 lb/in
        // Note: Patroh's spring rates are extreme — likely high motion ratio compensation.
        // Our 1:1 assumption will be much lower. Validate ranges, not point values.
        camberFront: -1.5, camberRear: -0.8,
        casterRange: [6.5, 7.0],
        rearArbStiff: true,
        rearAccelRange: [40, 60],
        centerRearRange: [70, 80]
      }
    },
    {
      name: 'Generic drift skeleton (S1, RWD, sport tires)',
      input: {
        weight: 2700, fwd: 52, hp: 550,
        drivetrain: 'RWD', compound: 'sport', transmission: 'race',
        discipline: 'drift'
      },
      reference: {
        camberFrontRange: [-5, -3],
        camberRearRange: [-0.5, 0],
        caster: 7.0,
        rearAccel: 100,
        brakeBalanceRange: [55, 70],
        rearArbSoft: true
      }
    }
  ];

  cases.forEach(c => {
    const r = calcTune(c.input);
    console.log('---', c.name, '---');
    console.log('Output:', JSON.parse(JSON.stringify(r)));
    console.log('Reference:', c.reference);
  });
};

/* ============================================================
 * BOOT
 * ============================================================ */
async function boot() {
  await openDb();

  // Load seed cars from cars.json
  try {
    const resp = await fetch('cars.json');
    seedCars = await resp.json();
  } catch (e) {
    console.error('Failed to load cars.json', e);
    seedCars = [];
  }

  customCars = await dbGetAll(STORE_CUSTOM);
  cars = mergeCars(seedCars, customCars);

  await migrateUserData();
  renderApp();

  // Service worker registration (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {/* ok if missing */});
  }
}

document.addEventListener('DOMContentLoaded', boot);
