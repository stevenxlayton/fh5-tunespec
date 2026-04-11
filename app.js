// FH5 TuneSpec v2.1 — IndexedDB persistence + Add-a-Car
(function() {
‘use strict’;

let CARS = [];
let STATE = { filter: ‘all’, search: ‘’, userData: {}, customCars: [] };

// –– INDEXEDDB PERSISTENCE ––
const DB_NAME = ‘fh5-tunespec’;
const DB_VERSION = 1;
let db;

function openDB() {
return new Promise((resolve, reject) => {
const req = indexedDB.open(DB_NAME, DB_VERSION);
req.onupgradeneeded = e => {
const d = e.target.result;
if (!d.objectStoreNames.contains(‘userData’)) d.createObjectStore(‘userData’);
if (!d.objectStoreNames.contains(‘customCars’)) d.createObjectStore(‘customCars’, { keyPath: ‘id’ });
};
req.onsuccess = e => { db = e.target.result; resolve(db); };
req.onerror = e => reject(e.target.error);
});
}

function dbGet(store, key) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readonly’);
const req = tx.objectStore(store).get(key);
req.onsuccess = () => resolve(req.result);
req.onerror = () => reject(req.error);
});
}

function dbPut(store, value, key) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readwrite’);
const req = key !== undefined ? tx.objectStore(store).put(value, key) : tx.objectStore(store).put(value);
req.onsuccess = () => resolve();
req.onerror = () => reject(req.error);
});
}

function dbGetAll(store) {
return new Promise((resolve, reject) => {
const tx = db.transaction(store, ‘readonly’);
const req = tx.objectStore(store).getAll();
req.onsuccess = () => resolve(req.result || []);
req.onerror = () => reject(req.error);
});
}

async function saveUserData() {
try { await dbPut(‘userData’, STATE.userData, ‘all’); }
catch (e) { console.error(‘Save failed:’, e); }
}

async function saveCustomCar(car) {
try { await dbPut(‘customCars’, car); }
catch (e) { console.error(‘Save custom car failed:’, e); }
}

async function loadPersistedData() {
try {
const ud = await dbGet(‘userData’, ‘all’);
if (ud) STATE.userData = ud;
const customs = await dbGetAll(‘customCars’);
STATE.customCars = customs;
} catch (e) { console.error(‘Load failed:’, e); }
}

// –– LOAD CARS ––
async function loadCars() {
try { await openDB(); await loadPersistedData(); } catch (e) { console.error(e); }
const res = await fetch(‘cars.json’);
const seeded = await res.json();
CARS = […seeded, …STATE.customCars];
render();
}

// –– RENDER ––
const listEl = document.getElementById(‘car-list’);
const countEl = document.getElementById(‘count’);
const searchEl = document.getElementById(‘search’);

function matches(car) {
const f = STATE.filter;
if (f === ‘drift’ && !car.driftFriendly) return false;
if (f === ‘rwd’ && car.drivetrain !== ‘RWD’) return false;
if (f === ‘awd’ && car.drivetrain !== ‘AWD’) return false;
if (f === ‘fwd’ && car.drivetrain !== ‘FWD’) return false;
if (f === ‘muscle’ && car.bodyType !== ‘Muscle’) return false;
if (f === ‘tuned’ && !STATE.userData[car.id]) return false;
if (f === ‘custom’ && !car.custom) return false;
const q = STATE.search.toLowerCase();
if (q) {
const hay = (car.make + ’ ’ + car.model + ’ ’ + car.year + ’ ’ + car.bodyType).toLowerCase();
if (!hay.includes(q)) return false;
}
return true;
}

function render() {
const filtered = CARS.filter(matches);
countEl.textContent = `${filtered.length} cars`;
const addBtn = `<div class="car-row" id="add-car-row" style="border-style:dashed;border-color:var(--accent);justify-content:center;"> <div style="text-align:center;color:var(--accent-2);font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;">+ Add a Car</div> </div>`;
listEl.innerHTML = addBtn + filtered.map(c => {
const dt = c.drivetrain.toLowerCase();
const star = c.driftFriendly ? ‘<span class="drift-star">★</span> ’ : ‘’;
const tuned = STATE.userData[c.id] ? ’ 🔧’ : ‘’;
const customTag = c.custom ? ’ <span style="font-size:9px;color:var(--accent-2);border:1px solid var(--accent-2);padding:1px 5px;border-radius:3px;letter-spacing:0.5px;">CUSTOM</span>’ : ‘’;
return `<div class="car-row" data-id="${c.id}"> <div> <div class="name">${star}${c.make} ${c.model}${tuned}${customTag}</div> <div class="sub">${c.year} · ${c.bodyType} · ${c.stockPI} PI · ${c.era}</div> </div> <div class="badge ${dt}">${c.drivetrain}</div> </div>`;
}).join(’’);
}

// –– FILTERS ––
document.getElementById(‘filters’).addEventListener(‘click’, e => {
if (!e.target.classList.contains(‘chip’)) return;
document.querySelectorAll(’.chip’).forEach(c => c.classList.remove(‘active’));
e.target.classList.add(‘active’);
STATE.filter = e.target.dataset.filter;
render();
});

searchEl.addEventListener(‘input’, e => {
STATE.search = e.target.value;
render();
});

// –– MODAL ––
const modal = document.getElementById(‘modal’);
const modalContent = document.getElementById(‘modal-content’);
document.getElementById(‘close’).addEventListener(‘click’, () => modal.classList.remove(‘open’));
modal.addEventListener(‘click’, e => { if (e.target === modal) modal.classList.remove(‘open’); });

listEl.addEventListener(‘click’, e => {
if (e.target.closest(’#add-car-row’)) { openAddCar(); return; }
const row = e.target.closest(’.car-row’);
if (!row || !row.dataset.id) return;
openCar(row.dataset.id);
});

// –– ADD CAR FORM ––
function openAddCar() {
modalContent.innerHTML = `<h2>Add a Car</h2> <p class="muted">Cars not in the seed database. Saved to your phone.</p> <div class="field"><label>Make</label><input id="ac-make" placeholder="e.g. Nissan"></div> <div class="field"><label>Model</label><input id="ac-model" placeholder="e.g. Silvia S15"></div> <div class="field"><label>Year</label><input id="ac-year" type="number" inputmode="numeric" placeholder="e.g. 2002"></div> <div class="field"><label>Drivetrain</label> <select id="ac-dt"><option>RWD</option><option>AWD</option><option>FWD</option></select> </div> <div class="field"><label>Body Type</label> <select id="ac-body"><option>Sport</option><option>Muscle</option><option>Super</option><option>Classic</option><option>OffRoad</option><option>Rally</option><option>Track</option></select> </div> <div class="field"><label>Era</label> <select id="ac-era"><option>Modern</option><option>Retro</option><option>Classic</option><option>Vintage</option><option>Early Vintage</option><option>Pre-War</option></select> </div> <div class="field"><label>Stock PI (optional)</label><input id="ac-pi" type="number" inputmode="numeric" placeholder="e.g. 750"></div> <div class="field"><label>Engine Layout</label> <select id="ac-eng"><option>Front</option><option>Mid</option><option>Rear</option></select> </div> <div class="field" style="display:flex;align-items:center;gap:10px;"> <input type="checkbox" id="ac-drift" style="width:auto;margin:0;"> <label for="ac-drift" style="margin:0;">Mark as drift-friendly ★</label> </div> <button class="btn-primary" id="ac-save">Save Car</button>`;
document.getElementById(‘ac-save’).addEventListener(‘click’, async () => {
const make = document.getElementById(‘ac-make’).value.trim();
const model = document.getElementById(‘ac-model’).value.trim();
if (!make || !model) { alert(‘Need make and model’); return; }
const car = {
id: ‘custom-’ + Date.now(),
make, model,
year: parseInt(document.getElementById(‘ac-year’).value) || 2000,
drivetrain: document.getElementById(‘ac-dt’).value,
bodyType: document.getElementById(‘ac-body’).value,
era: document.getElementById(‘ac-era’).value,
stockPI: parseInt(document.getElementById(‘ac-pi’).value) || 700,
stockClass: ‘B’,
engineLayout: document.getElementById(‘ac-eng’).value,
driftFriendly: document.getElementById(‘ac-drift’).checked,
custom: true
};
await saveCustomCar(car);
CARS.push(car);
STATE.customCars.push(car);
modal.classList.remove(‘open’);
render();
});
modal.classList.add(‘open’);
}

// –– CAR DETAIL ––
function openCar(id) {
const car = CARS.find(c => c.id === id);
if (!car) return;
const saved = STATE.userData[id] || {};
const weight = saved.weight || ‘’;
const fwd = saved.fwd || ‘’;
const notes = saved.notes || ‘’;

```
modalContent.innerHTML = `
  <h2>${car.make} ${car.model}</h2>
  <p class="muted">${car.year} · ${car.bodyType} · ${car.drivetrain} · ${car.engineLayout}-engine · ${car.stockPI} PI</p>
  <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent-2);margin:18px 0 10px;border-bottom:1px solid var(--border);padding-bottom:6px;">Your Build</h3>
  <div class="field"><label>Current Weight (lb)</label><input type="number" id="w" value="${weight}" placeholder="e.g. 2800" inputmode="numeric"></div>
  <div class="field"><label>Front Weight %</label><input type="number" id="f" value="${fwd}" placeholder="e.g. 52" inputmode="numeric"></div>
  <div class="field notes-field"><label>Notes</label><textarea id="n" placeholder="e.g. feels loose at 80mph">${notes}</textarea></div>
  <button class="btn-primary" id="generate">Generate Drift Tune</button>
  <div id="tune-out" class="output hidden"></div>
`;

document.getElementById('generate').addEventListener('click', async () => {
  const w = parseFloat(document.getElementById('w').value);
  const f = parseFloat(document.getElementById('f').value);
  const n = document.getElementById('n').value;
  if (!w || !f) { alert('Need weight and front weight %'); return; }
  STATE.userData[id] = { weight: w, fwd: f, notes: n };
  await saveUserData();
  const out = calcTune(car, w, f);
  const el = document.getElementById('tune-out');
  el.textContent = out;
  el.classList.remove('hidden');
  render();
});

modal.classList.add('open');
```

}

// –– TUNE CALCULATOR (unchanged from v2) ––
function calcTune(car, weight, fwd) {
const rwd = 100 - fwd;
const fw = weight * (fwd / 100);
const rw = weight * (rwd / 100);
const isRWD = car.drivetrain === ‘RWD’;
const isAWD = car.drivetrain === ‘AWD’;
const isFWD = car.drivetrain === ‘FWD’;
const muscle = car.bodyType === ‘Muscle’;
const oldSchool = car.era === ‘Vintage’ || car.era === ‘Early Vintage’ || car.era === ‘Pre-War’;

```
let fMul = 1.15, rMul = 0.80;
if (isAWD) { fMul = 1.10; rMul = 0.95; }
if (isFWD) { fMul = 0.90; rMul = 1.10; }
if (muscle) { fMul *= 1.10; rMul *= 1.05; }

const frontSpring = Math.round((fw / 14) * fMul);
const rearSpring  = Math.round((rw / 14) * rMul);

let fARB = 60, rARB = 3;
if (isAWD) { fARB = 45; rARB = 15; }
if (isFWD) { fARB = 3;  rARB = 55; }
if (oldSchool) fARB = Math.min(fARB, 50);

const fBump = ((frontSpring / 100) * 0.35).toFixed(1);
const fReb  = ((frontSpring / 100) * 0.55).toFixed(1);
const rBump = ((rearSpring  / 100) * 0.30).toFixed(1);
const rReb  = ((rearSpring  / 100) * 0.50).toFixed(1);

const fH = car.bodyType === 'OffRoad' || car.bodyType === 'Rally' ? 5.5 : (oldSchool ? 4.5 : 4.0);
const rH = fH + 0.3;

let accel = isRWD ? 100 : (isAWD ? 80 : 40);
let decel = isRWD ? 30  : (isAWD ? 25 : 15);

let fitness;
if (isRWD && car.driftFriendly) fitness = '✓ Excellent drift platform';
else if (isRWD) fitness = '○ Driftable RWD but not a community favorite';
else if (isAWD) fitness = '△ AWD — consider RWD conversion for pure drift';
else fitness = '✗ FWD — very hard to drift, rotates on lift-off only';

return `━━━ ${car.make.toUpperCase()} ${car.model.toUpperCase()} ━━━
```

${car.year} · ${car.drivetrain} · ${car.bodyType} · ${weight} lb @ ${fwd}F/${rwd}R

${fitness}

▸ TIRE PRESSURE
Front: 33.0 psi   Rear: 29.0 psi

▸ ALIGNMENT
Camber:  F -3.0°  R -1.5°
Toe:     F -0.3°  R -0.2°
Caster:  7.0°

▸ ANTI-ROLL BARS
Front: ${fARB}.00   Rear: ${rARB}.00

▸ SPRINGS (lb/in)
Front: ${frontSpring}   Rear: ${rearSpring}

▸ RIDE HEIGHT (in)
Front: ${fH.toFixed(1)}   Rear: ${rH.toFixed(1)}

▸ DAMPING
Bump:    F ${fBump}   R ${rBump}
Rebound: F ${fReb}   R ${rReb}

▸ DIFFERENTIAL (${car.drivetrain})
Accel: ${accel}%   Decel: ${decel}%

▸ BRAKE
Balance: 58% front   Pressure: 115%

━━━ NOTES ━━━
• Understeer on entry → drop front ARB 5 or stiffen front springs
• Rear snaps too fast → soften rear rebound or drop diff accel to 90%
• Your notes: ${STATE.userData[car.id]?.notes || ‘(none yet)’}`;
}

loadCars();
})(); 
