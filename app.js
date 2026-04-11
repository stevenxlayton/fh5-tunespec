// FH5 TuneSpec v2.3 - multi-discipline tunes (drift/road/dirt/drag), fixed persistence
(function() {
  'use strict';

  const DISCIPLINES = ['drift', 'road', 'dirt', 'drag'];
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
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(key);
        let result = null;
        req.onsuccess = () => { result = req.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  function dbGetAll(store) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve([]); return; }
      try {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        let result = [];
        req.onsuccess = () => { result = req.result || []; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve([]);
        tx.onabort = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  function dbPut(store, value, key) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve(false); return; }
      try {
        const tx = db.transaction(store, 'readwrite');
        if (key !== undefined) tx.objectStore(store).put(value, key);
        else tx.objectStore(store).put(value);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => { console.error('dbPut tx error', tx.error); resolve(false); };
        tx.onabort = () => { console.error('dbPut tx abort', tx.error); resolve(false); };
      } catch (e) { console.error('dbPut threw', e); resolve(false); }
    });
  }

  function dbDelete(store, key) {
    return new Promise((resolve) => {
      if (!dbAvailable) { resolve(); return; }
      try {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
        tx.onabort = () => resolve();
      } catch { resolve(); }
    });
  }

  async function saveUserData() {
    const ok = await dbPut('userData', STATE.userData, 'all');
    if (!ok) console.warn('userData save failed');
  }
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

  function hasAnyTune(carId) {
    const ud = STATE.userData[carId];
    if (!ud || !ud.tunes) return false;
    return DISCIPLINES.some(d => ud.tunes[d]);
  }

  function matches(car) {
    const f = STATE.filter;
    if (f === 'drift' && !car.driftFriendly) return false;
    if (f === 'rwd' && car.drivetrain !== 'RWD') return false;
    if (f === 'awd' && car.drivetrain !== 'AWD') return false;
    if (f === 'fwd' && car.drivetrain !== 'FWD') return false;
    if (f === 'muscle' && car.bodyType !== 'Muscle') return false;
    if (f === 'tuned' && !hasAnyTune(car.id)) return false;
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
      const tuned = hasAnyTune(c.id) ? ' [T]' : '';
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
    if (!STATE.userData[id]) STATE.userData[id] = { weight: '', fwd: '', notes: '', tunes: {}, lastDiscipline: 'drift' };
    if (!STATE.userData[id].tunes) STATE.userData[id].tunes = {};
    const ud = STATE.userData[id];
    let activeDisc = ud.lastDiscipline || 'drift';

    const deleteBtn = car.custom ? '<button class="btn-ghost" id="del-car" style="margin-top:8px;color:#e10600;border-color:#e10600;">Delete This Custom Car</button>' : '';

    function buildDiscTabs() {
      return DISCIPLINES.map(d => {
        const active = d === activeDisc;
        const has = !!ud.tunes[d];
        return '<button class="disc-tab" data-disc="' + d + '" style="flex:1;min-width:60px;background:' + (active ? '#e10600' : '#1a1a1a') + ';color:' + (active ? '#fff' : '#888') + ';border:1px solid ' + (active ? '#e10600' : '#2a2a2a') + ';padding:8px 4px;border-radius:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;cursor:pointer;">' + d + (has ? ' *' : '') + '</button>';
      }).join('');
    }

    function renderTuneArea() {
      const tune = ud.tunes[activeDisc];
      const btnLabel = tune ? 'Regenerate ' + activeDisc.toUpperCase() + ' Tune' : 'Generate ' + activeDisc.toUpperCase() + ' Tune';
      document.getElementById('disc-tabs-wrap').innerHTML = buildDiscTabs();
      document.getElementById('gen-btn').textContent = btnLabel;
      const out = document.getElementById('tune-out');
      if (tune) { out.textContent = tune; out.classList.remove('hidden'); }
      else { out.textContent = ''; out.classList.add('hidden'); }
      attachDiscTabs();
    }

    function attachDiscTabs() {
      document.querySelectorAll('.disc-tab').forEach(btn => {
        btn.addEventListener('click', async () => {
          activeDisc = btn.dataset.disc;
          ud.lastDiscipline = activeDisc;
          await saveUserData();
          renderTuneArea();
        });
      });
    }

    modalContent.innerHTML =
      '<h2>' + car.make + ' ' + car.model + '</h2>' +
      '<p class="muted">' + car.year + ' . ' + car.bodyType + ' . ' + car.drivetrain + ' . ' + car.stockPI + ' PI</p>' +
      '<div class="field"><label>Weight (lb)</label><input type="number" id="w" value="' + (ud.weight || '') + '" inputmode="numeric"></div>' +
      '<div class="field"><label>Front Weight %</label><input type="number" id="f" value="' + (ud.fwd || '') + '" inputmode="numeric"></div>' +
      '<div class="field notes-field"><label>Notes</label><textarea id="n">' + (ud.notes || '') + '</textarea></div>' +
      '<div id="disc-tabs-wrap" style="display:flex;gap:6px;margin:14px 0 12px;overflow-x:auto;">' + buildDiscTabs() + '</div>' +
      '<button class="btn-primary" id="gen-btn">Generate Tune</button>' +
      '<div id="tune-out" class="output hidden"></div>' +
      deleteBtn;

    // Initial tune area + tab listeners
    const tune0 = ud.tunes[activeDisc];
    if (tune0) {
      document.getElementById('tune-out').textContent = tune0;
      document.getElementById('tune-out').classList.remove('hidden');
      document.getElementById('gen-btn').textContent = 'Regenerate ' + activeDisc.toUpperCase() + ' Tune';
    } else {
      document.getElementById('gen-btn').textContent = 'Generate ' + activeDisc.toUpperCase() + ' Tune';
    }
    attachDiscTabs();

    document.getElementById('gen-btn').addEventListener('click', async () => {
      const w = parseFloat(document.getElementById('w').value);
      const f = parseFloat(document.getElementById('f').value);
      if (!w || !f) { alert('Need weight and front weight %'); return; }
      const tuneText = calcTune(car, w, f, activeDisc);
      ud.weight = w;
      ud.fwd = f;
      ud.notes = document.getElementById('n').value;
      ud.tunes[activeDisc] = tuneText;
      ud.lastDiscipline = activeDisc;
      STATE.userData[id] = ud;
      await saveUserData();
      renderTuneArea();
      render();
    });

    if (car.custom) {
      document.getElementById('del-car').addEventListener('click', async () => {
        if (!confirm('Delete ' + car.make + ' ' + car.model + ' permanently?')) return;
        await deleteCustomCar(id);
        CARS = CARS.filter(c => c.id !== id);
        STATE.customCars = STATE.customCars.filter(c => c.id !== id);
        delete STATE.userData[id];
        await saveUserData();
        modal.classList.remove('open');
        render();
      });
    }

    modal.classList.add('open');
  }

  // ---- TUNE CALCULATOR ----
  function calcTune(car, weight, fwd, discipline) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const rwd = 100 - fwd;
    const fCornerWt = weight * (fwd / 100) / 2;
    const rCornerWt = weight * (rwd / 100) / 2;
    const isRWD = car.drivetrain === 'RWD', isAWD = car.drivetrain === 'AWD', isFWD = car.drivetrain === 'FWD';
    const muscle = car.bodyType === 'Muscle';
    const oldSchool = car.era === 'Vintage' || car.era === 'Early Vintage' || car.era === 'Pre-War';
    const offroad = car.bodyType === 'OffRoad' || car.bodyType === 'Rally';
    const MR = 1.4, G = 386.4;
    const muscleMul = muscle ? 1.10 : 1.0;
    const calcSpring = (cw, freq) => Math.round(cw * Math.pow(2 * Math.PI * freq, 2) / G * MR * muscleMul);

    // Discipline-specific parameters
    let p = {};
    if (discipline === 'drift') {
      p.fFreq = isFWD ? 2.0 : (isAWD ? 2.5 : 2.4);
      p.rFreq = isFWD ? 2.4 : (isAWD ? 2.25 : 2.15);
      p.fARB = isFWD ? 3 : (isAWD ? 45 : 60);
      p.rARB = isFWD ? 55 : (isAWD ? 15 : 3);
      p.camberF = -3.0; p.camberR = -1.5;
      p.toeF = -0.3; p.toeR = -0.2;
      p.caster = 7.0;
      p.tireF = 33.0; p.tireR = 29.0;
      p.height = offroad ? 5.5 : 4.0;
      p.accel = isRWD ? 100 : (isAWD ? 80 : 40);
      p.decel = isRWD ? 30 : (isAWD ? 25 : 15);
      p.brakeBal = 58; p.brakePr = 115;
      p.dampMul = { fb: 0.35, fr: 0.55, rb: 0.30, rr: 0.50 };
    } else if (discipline === 'road') {
      p.fFreq = 2.2; p.rFreq = 2.3;
      p.fARB = 35; p.rARB = 32;
      p.camberF = -1.8; p.camberR = -1.2;
      p.toeF = 0.0; p.toeR = 0.1;
      p.caster = 5.5;
      p.tireF = 30.0; p.tireR = 30.0;
      p.height = offroad ? 5.0 : 3.8;
      p.accel = isRWD ? 50 : (isAWD ? 40 : 30);
      p.decel = isRWD ? 20 : (isAWD ? 15 : 10);
      p.brakeBal = 52; p.brakePr = 110;
      p.dampMul = { fb: 0.40, fr: 0.55, rb: 0.40, rr: 0.55 };
    } else if (discipline === 'dirt') {
      p.fFreq = 1.8; p.rFreq = 1.85;
      p.fARB = 18; p.rARB = 15;
      p.camberF = -1.0; p.camberR = -0.8;
      p.toeF = 0.1; p.toeR = 0.2;
      p.caster = 6.0;
      p.tireF = 28.0; p.tireR = 28.0;
      p.height = 5.8;
      p.accel = isRWD ? 60 : (isAWD ? 55 : 35);
      p.decel = isRWD ? 35 : (isAWD ? 30 : 20);
      p.brakeBal = 50; p.brakePr = 105;
      p.dampMul = { fb: 0.45, fr: 0.60, rb: 0.45, rr: 0.60 };
    } else if (discipline === 'drag') {
      p.fFreq = 1.8; p.rFreq = 2.6;
      p.fARB = 1; p.rARB = 65;
      p.camberF = -0.5; p.camberR = 0.0;
      p.toeF = 0.0; p.toeR = 0.0;
      p.caster = 5.0;
      p.tireF = 28.0; p.tireR = 22.0;
      p.height = oldSchool ? 4.5 : 3.5;
      p.accel = isRWD ? 100 : (isAWD ? 100 : 80);
      p.decel = 0;
      p.brakeBal = 70; p.brakePr = 100;
      p.dampMul = { fb: 0.30, fr: 0.40, rb: 0.50, rr: 0.65 };
    }

    const fS = clamp(calcSpring(fCornerWt, p.fFreq), 80, 1500);
    const rS = clamp(calcSpring(rCornerWt, p.rFreq), 80, 1500);
    const fARB = clamp(oldSchool ? Math.min(p.fARB, 50) : p.fARB, 1, 65);
    const rARB = clamp(p.rARB, 1, 65);
    const fBump = clamp(fS / 100 * p.dampMul.fb, 1.0, 20.0);
    const fReb = clamp(fS / 100 * p.dampMul.fr, 1.0, 20.0);
    const rBump = clamp(rS / 100 * p.dampMul.rb, 1.0, 20.0);
    const rReb = clamp(rS / 100 * p.dampMul.rr, 1.0, 20.0);
    const fH = clamp(p.height, 3.0, 7.0);
    const rH = clamp(fH + (discipline === 'drag' ? 0.5 : 0.3), 3.0, 7.0);

    const fitness =
      discipline === 'drift' ? (isRWD && car.driftFriendly ? 'Excellent drift platform' : isRWD ? 'Driftable RWD' : isAWD ? 'AWD - consider RWD swap' : 'FWD - very hard to drift') :
      discipline === 'road' ? (isAWD ? 'AWD - great grip' : 'Tuned for grip and stability') :
      discipline === 'dirt' ? (isAWD || offroad ? 'Built for the rough stuff' : 'Not ideal but tuned for it') :
      (isRWD || isAWD ? 'Launch ready' : 'FWD drag - torque steer warning');

    return '=== ' + car.make.toUpperCase() + ' ' + car.model.toUpperCase() + ' [' + discipline.toUpperCase() + '] ===\n' +
      car.year + ' . ' + car.drivetrain + ' . ' + weight + ' lb @ ' + fwd + 'F/' + rwd + 'R\n\n' +
      fitness + '\n\n' +
      'TIRE PRESSURE  F ' + p.tireF.toFixed(1) + '  R ' + p.tireR.toFixed(1) + '\n' +
      'ALIGNMENT      Camber F ' + p.camberF.toFixed(1) + ' R ' + p.camberR.toFixed(1) + '  Toe F ' + p.toeF.toFixed(1) + ' R ' + p.toeR.toFixed(1) + '  Caster ' + p.caster.toFixed(1) + '\n' +
      'ANTI-ROLL      F ' + fARB.toFixed(2) + '  R ' + rARB.toFixed(2) + '\n' +
      'SPRINGS        F ' + fS + '  R ' + rS + '\n' +
      'RIDE HEIGHT    F ' + fH.toFixed(1) + '  R ' + rH.toFixed(1) + '\n' +
      'DAMPING Bump   F ' + fBump.toFixed(1) + '  R ' + rBump.toFixed(1) + '\n' +
      'DAMPING Reb    F ' + fReb.toFixed(1) + '  R ' + rReb.toFixed(1) + '\n' +
      'DIFFERENTIAL   Accel ' + p.accel + '%  Decel ' + p.decel + '%\n' +
      'BRAKE          ' + p.brakeBal + '% front  ' + p.brakePr + '% pressure';
  }

  loadCars();
})();
