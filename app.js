// FH5 TuneSpec v2.2 - frequency-based spring math, delete custom cars, persistent tunes
(function() {
  'use strict';

  let CARS = [];
  let STATE = { filter: 'all', search: '', userData: {}, customCars: [] };
  let db = null;
  let dbAvailable = false;

  const listEl = document.getElementById('car-list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');

  function openDB() {
    return new Promise((resolve) => {
      try {
        if (!window.indexedDB) { resolve(null); return; }
        const req = indexedDB.open('fh5-tunespec', 1);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('userData')) d.createObjectStore('userData');
          if (!d.objectStoreNames.contains('customCars')) d.createObjectStore('customCars', { keyPath: 'id' });
        };
        req.onsuccess = e => { db = e.target.result; dbAvailable = true; resolve(db); };
        req.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 2000);
      } catch (e) { resolve(null); }
    });
  }

  function dbGet(store, key) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve(null); return; }
      try {
        const req = db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  function dbGetAll(store) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve([]); return; }
      try {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  function dbPut(store, value, key) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve(); return; }
      try {
        const tx = db.transaction(store, 'readwrite');
        const req = key !== undefined ? tx.objectStore(store).put(value, key) : tx.objectStore(store).put(value);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  function dbDelete(store, key) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve(); return; }
      try {
        const req = db.transaction(store, 'readwrite').objectStore(store).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch { resolve(); }
    });
  }

  async function saveUserData() { await dbPut('userData', STATE.userData, 'all'); }
  async function saveCustomCar(car) { await dbPut('customCars', car); }
  async function deleteCustomCar(id) { await dbDelete('customCars', id); }

  async function loadCars() {
    await openDB();
    if (dbAvailable) {
      const ud = await dbGet('userData', 'all');
      if (ud) STATE.userData = ud;
      STATE.customCars = await dbGetAll('customCars');
    }
    try {
      const res = await fetch('cars.json');
      const seeded = await res.json();
      CARS = [...seeded, ...STATE.customCars];
      render();
    } catch (e) {
      if (listEl) listEl.innerHTML = '<div style="color:#ff6b00;padding:16px;">Failed to load cars.json: ' + e.message + '</div>';
    }
  }

  function matches(car) {
    const f = STATE.filter;
    if (f === 'drift' && !car.driftFriendly) return false;
    if (f === 'rwd' && car.drivetrain !== 'RWD') return false;
    if (f === 'awd' && car.drivetrain !== 'AWD') return false;
    if (f === 'fwd' && car.drivetrain !== 'FWD') return false;
    if (f === 'muscle' && car.bodyType !== 'Muscle') return false;
    if (f === 'tuned' && !STATE.userData[car.id]) return false;
    const q = STATE.search.toLowerCase();
    if (q) {
      const hay = (car.make + ' ' + car.model + ' ' + car.year + ' ' + car.bodyType).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function render() {
    const filtered = CARS.filter(matches);
    countEl.textContent = filtered.length + ' cars';
    const addBtn = '<div class="car-row" id="add-car-row" style="border-style:dashed;border-color:#e10600;justify-content:center;"><div style="text-align:center;color:#ff6b00;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:1px;">+ Add a Car</div></div>';
    listEl.innerHTML = addBtn + filtered.map(c => {
      const dt = (c.drivetrain || '').toLowerCase();
      const star = c.driftFriendly ? '<span class="drift-star">*</span> ' : '';
      const tuned = STATE.userData[c.id] && STATE.userData[c.id].tune ? ' [T]' : '';
      const customTag = c.custom ? ' <span style="font-size:9px;color:#ff6b00;border:1px solid #ff6b00;padding:1px 5px;border-radius:3px;">CUSTOM</span>' : '';
      return '<div class="car-row" data-id="' + c.id + '"><div><div class="name">' + star + c.make + ' ' + c.model + tuned + customTag + '</div><div class="sub">' + c.year + ' . ' + c.bodyType + ' . ' + c.stockPI + ' PI . ' + c.era + '</div></div><div class="badge ' + dt + '">' + c.drivetrain + '</div></div>';
    }).join('');
  }

  document.getElementById('filters').addEventListener('click', e => {
    if (!e.target.classList.contains('chip')) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    STATE.filter = e.target.dataset.filter;
    render();
  });

  searchEl.addEventListener('input', e => { STATE.search = e.target.value; render(); });

  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  document.getElementById('close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  listEl.addEventListener('click', e => {
    if (e.target.closest('#add-car-row')) { openAddCar(); return; }
    const row = e.target.closest('.car-row');
    if (!row || !row.dataset.id) return;
    openCar(row.dataset.id);
  });

  function openAddCar() {
    modalContent.innerHTML = '<h2>Add a Car</h2><p class="muted">Saved to your phone.</p><div class="field"><label>Make</label><input id="ac-make" placeholder="Nissan"></div><div class="field"><label>Model</label><input id="ac-model" placeholder="Silvia S15"></div><div class="field"><label>Year</label><input id="ac-year" type="number" inputmode="numeric"></div><div class="field"><label>Drivetrain</label><select id="ac-dt"><option>RWD</option><option>AWD</option><option>FWD</option></select></div><div class="field"><label>Body Type</label><select id="ac-body"><option>Sport</option><option>Muscle</option><option>Super</option><option>Classic</option><option>OffRoad</option><option>Rally</option></select></div><div class="field"><label>Era</label><select id="ac-era"><option>Modern</option><option>Retro</option><option>Classic</option><option>Vintage</option></select></div><div class="field"><label>Stock PI</label><input id="ac-pi" type="number" inputmode="numeric"></div><div class="field"><label>Engine Layout</label><select id="ac-eng"><option>Front</option><option>Mid</option><option>Rear</option></select></div><div class="field" style="display:flex;align-items:center;gap:10px;"><input type="checkbox" id="ac-drift" style="width:auto;margin:0;"> <label for="ac-drift" style="margin:0;">Drift-friendly</label></div><button class="btn-primary" id="ac-save">Save Car</button>';
    document.getElementById('ac-save').addEventListener('click', async () => {
      const make = document.getElementById('ac-make').value.trim();
      const model = document.getElementById('ac-model').value.trim();
      if (!make || !model) { alert('Need make and model'); return; }
      const car = {
        id: 'custom-' + Date.now(), make: make, model: model,
        year: parseInt(document.getElementById('ac-year').value) || 2000,
        drivetrain: document.getElementById('ac-dt').value,
        bodyType: document.getElementById('ac-body').value,
        era: document.getElementById('ac-era').value,
        stockPI: parseInt(document.getElementById('ac-pi').value) || 700,
        stockClass: 'B',
        engineLayout: document.getElementById('ac-eng').value,
        driftFriendly: document.getElementById('ac-drift').checked,
        custom: true
      };
      await saveCustomCar(car);
      CARS.push(car); STATE.customCars.push(car);
      modal.classList.remove('open'); render();
    });
    modal.classList.add('open');
  }

  function openCar(id) {
    const car = CARS.find(c => c.id === id);
    if (!car) return;
    const saved = STATE.userData[id] || {};
    const hasTune = !!saved.tune;
    const deleteBtn = car.custom ? '<button class="btn-ghost" id="del-car" style="margin-top:8px;color:#e10600;border-color:#e10600;">Delete This Custom Car</button>' : '';

    modalContent.innerHTML =
      '<h2>' + car.make + ' ' + car.model + '</h2>' +
      '<p class="muted">' + car.year + ' . ' + car.bodyType + ' . ' + car.drivetrain + ' . ' + car.stockPI + ' PI</p>' +
      '<div class="field"><label>Weight (lb)</label><input type="number" id="w" value="' + (saved.weight || '') + '" inputmode="numeric"></div>' +
      '<div class="field"><label>Front Weight %</label><input type="number" id="f" value="' + (saved.fwd || '') + '" inputmode="numeric"></div>' +
      '<div class="field notes-field"><label>Notes</label><textarea id="n">' + (saved.notes || '') + '</textarea></div>' +
      '<button class="btn-primary" id="generate">' + (hasTune ? 'Regenerate Tune' : 'Generate Drift Tune') + '</button>' +
      '<div id="tune-out" class="output ' + (hasTune ? '' : 'hidden') + '">' + (hasTune ? saved.tune : '') + '</div>' +
      deleteBtn;

    document.getElementById('generate').addEventListener('click', async () => {
      const w = parseFloat(document.getElementById('w').value);
      const f = parseFloat(document.getElementById('f').value);
      if (!w || !f) { alert('Need weight and front weight %'); return; }
      const tuneText = calcTune(car, w, f);
      STATE.userData[id] = { weight: w, fwd: f, notes: document.getElementById('n').value, tune: tuneText };
      await saveUserData();
      const el = document.getElementById('tune-out');
      el.textContent = tuneText;
      el.classList.remove('hidden');
      document.getElementById('generate').textContent = 'Regenerate Tune';
      render();
    });

    if (car.custom) {
      document.getElementById('del-car').addEventListener('click', async () => {
        if (!confirm('Delete ' + car.make + ' ' + car.model + ' permanently?')) return;
        await deleteCustomCar(id);
        CARS = CARS.filter(c => c.id !== id);
        STATE.customCars = STATE.customCars.filter(c => c.id !== id);
        if (STATE.userData[id]) { delete STATE.userData[id]; await saveUserData(); }
        modal.classList.remove('open');
        render();
      });
    }

    modal.classList.add('open');
  }

  function calcTune(car, weight, fwd) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const rwd = 100 - fwd;
    const fCornerWt = weight * (fwd / 100) / 2;
    const rCornerWt = weight * (rwd / 100) / 2;
    const isRWD = car.drivetrain === 'RWD', isAWD = car.drivetrain === 'AWD', isFWD = car.drivetrain === 'FWD';
    const muscle = car.bodyType === 'Muscle';
    const oldSchool = car.era === 'Vintage' || car.era === 'Early Vintage' || car.era === 'Pre-War';

    // SPRINGS - frequency-based, validated against known FH5 drift specs
    // Formula: spring_rate = corner_weight * (2*pi*freq)^2 / 386.4 * motion_ratio
    const MR = 1.4; // motion ratio
    const G = 386.4; // gravity in in/s^2
    let fFreq = 2.4, rFreq = 2.15; // RWD drift defaults
    if (isAWD) { fFreq = 2.5; rFreq = 2.25; }
    if (isFWD) { fFreq = 2.0; rFreq = 2.4; }
    const muscleMul = muscle ? 1.10 : 1.0;
    const calcSpring = (cw, freq) => Math.round(cw * Math.pow(2 * Math.PI * freq, 2) / G * MR * muscleMul);
    const fS = clamp(calcSpring(fCornerWt, fFreq), 80, 1200);
    const rS = clamp(calcSpring(rCornerWt, rFreq), 80, 1200);

    // ARB
    let fARB = 60, rARB = 3;
    if (isAWD) { fARB = 45; rARB = 15; }
    if (isFWD) { fARB = 3; rARB = 55; }
    if (oldSchool) fARB = Math.min(fARB, 50);
    fARB = clamp(fARB, 1, 65);
    rARB = clamp(rARB, 1, 65);

    // DAMPING - now scales properly with realistic spring rates
    const fBump = clamp(fS / 100 * 0.35, 1.0, 20.0);
    const fReb  = clamp(fS / 100 * 0.55, 1.0, 20.0);
    const rBump = clamp(rS / 100 * 0.30, 1.0, 20.0);
    const rReb  = clamp(rS / 100 * 0.50, 1.0, 20.0);

    // RIDE HEIGHT
    let fH = car.bodyType === 'OffRoad' || car.bodyType === 'Rally' ? 5.5 : (oldSchool ? 4.5 : 4.0);
    fH = clamp(fH, 3.0, 7.0);
    const rH = clamp(fH + 0.3, 3.0, 7.0);

    // DIFFERENTIAL
    const accel = isRWD ? 100 : (isAWD ? 80 : 40);
    const decel = isRWD ? 30 : (isAWD ? 25 : 15);

    const fitness = isRWD && car.driftFriendly ? 'Excellent drift platform' : isRWD ? 'Driftable RWD' : isAWD ? 'AWD - consider RWD swap' : 'FWD - very hard to drift';

    return '=== ' + car.make.toUpperCase() + ' ' + car.model.toUpperCase() + ' ===\n' +
      car.year + ' . ' + car.drivetrain + ' . ' + weight + ' lb @ ' + fwd + 'F/' + rwd + 'R\n\n' +
      fitness + '\n\n' +
      'TIRE PRESSURE  F 33.0  R 29.0\n' +
      'ALIGNMENT      Camber F -3.0 R -1.5  Toe F -0.3 R -0.2  Caster 7.0\n' +
      'ANTI-ROLL      F ' + fARB.toFixed(2) + '  R ' + rARB.toFixed(2) + '\n' +
      'SPRINGS        F ' + fS + '  R ' + rS + '\n' +
      'RIDE HEIGHT    F ' + fH.toFixed(1) + '  R ' + rH.toFixed(1) + '\n' +
      'DAMPING Bump   F ' + fBump.toFixed(1) + '  R ' + rBump.toFixed(1) + '\n' +
      'DAMPING Reb    F ' + fReb.toFixed(1) + '  R ' + rReb.toFixed(1) + '\n' +
      'DIFFERENTIAL   Accel ' + accel + '%  Decel ' + decel + '%\n' +
      'BRAKE          58% front  115% pressure';
  }

  loadCars();
})();
