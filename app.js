// FH5 TuneSpec v2 — car picker + drift tune calculator
(function() {
  'use strict';

  let CARS = [];
  let STATE = { filter: 'all', search: '', userData: {} };

  // ---- PERSISTENCE (in-memory, with manual export; no localStorage to keep PWA-safe) ----
  // On load, try to pull from a global set by a service worker later. For now, session-only.
  // Future: wire to IndexedDB.

  async function loadCars() {
    const res = await fetch('cars.json');
    CARS = await res.json();
    render();
  }

  // ---- RENDER ----
  const listEl = document.getElementById('car-list');
  const countEl = document.getElementById('count');
  const searchEl = document.getElementById('search');

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
    countEl.textContent = `${filtered.length} cars`;
    listEl.innerHTML = filtered.map(c => {
      const dt = c.drivetrain.toLowerCase();
      const star = c.driftFriendly ? '<span class="drift-star">★</span> ' : '';
      const tuned = STATE.userData[c.id] ? ' 🔧' : '';
      return `<div class="car-row" data-id="${c.id}">
        <div>
          <div class="name">${star}${c.make} ${c.model}${tuned}</div>
          <div class="sub">${c.year} · ${c.bodyType} · ${c.stockPI} PI · ${c.era}</div>
        </div>
        <div class="badge ${dt}">${c.drivetrain}</div>
      </div>`;
    }).join('');
  }

  // ---- FILTERS ----
  document.getElementById('filters').addEventListener('click', e => {
    if (!e.target.classList.contains('chip')) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    e.target.classList.add('active');
    STATE.filter = e.target.dataset.filter;
    render();
  });

  searchEl.addEventListener('input', e => {
    STATE.search = e.target.value;
    render();
  });

  // ---- CAR DETAIL MODAL ----
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modal-content');
  document.getElementById('close').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  listEl.addEventListener('click', e => {
    const row = e.target.closest('.car-row');
    if (!row) return;
    openCar(row.dataset.id);
  });

  function openCar(id) {
    const car = CARS.find(c => c.id === id);
    if (!car) return;
    const saved = STATE.userData[id] || {};
    const weight = saved.weight || '';
    const fwd = saved.fwd || '';
    const notes = saved.notes || '';
    const hasData = weight && fwd;

    modalContent.innerHTML = `
      <h2>${car.make} ${car.model}</h2>
      <p class="muted">${car.year} · ${car.bodyType} · ${car.drivetrain} · ${car.engineLayout}-engine · ${car.stockPI} PI (${car.stockClass})</p>

      <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:var(--accent-2);margin:18px 0 10px;border-bottom:1px solid var(--border);padding-bottom:6px;">Your Build</h3>
      <div class="field">
        <label>Current Weight (lb) — from Forza upgrade screen</label>
        <input type="number" id="w" value="${weight}" placeholder="e.g. 2800" inputmode="numeric">
      </div>
      <div class="field">
        <label>Front Weight % — from Forza upgrade screen</label>
        <input type="number" id="f" value="${fwd}" placeholder="e.g. 52" inputmode="numeric">
      </div>
      <div class="field notes-field">
        <label>Notes (saves with car)</label>
        <textarea id="n" placeholder="e.g. feels loose at 80mph, geared too short for Baja">${notes}</textarea>
      </div>
      <button class="btn-primary" id="generate">Generate Drift Tune</button>
      <div id="tune-out" class="output hidden"></div>
    `;

    document.getElementById('generate').addEventListener('click', () => {
      const w = parseFloat(document.getElementById('w').value);
      const f = parseFloat(document.getElementById('f').value);
      const n = document.getElementById('n').value;
      if (!w || !f) { alert('Need weight and front weight %'); return; }
      STATE.userData[id] = { weight: w, fwd: f, notes: n };
      const out = calcTune(car, w, f);
      const el = document.getElementById('tune-out');
      el.textContent = out;
      el.classList.remove('hidden');
      render(); // refresh list to show 🔧 indicator
    });

    modal.classList.add('open');
  }

  // ---- TUNE CALCULATOR ----
  function calcTune(car, weight, fwd) {
    const rwd = 100 - fwd;
    const fw = weight * (fwd / 100);
    const rw = weight * (rwd / 100);
    const isRWD = car.drivetrain === 'RWD';
    const isAWD = car.drivetrain === 'AWD';
    const isFWD = car.drivetrain === 'FWD';
    const muscle = car.bodyType === 'Muscle';
    const oldSchool = car.era === 'Vintage' || car.era === 'Early Vintage' || car.era === 'Pre-War';

    // Spring base rate — drift: stiff front, soft rear for RWD; flipped for FWD; balanced for AWD
    let fMul = 1.15, rMul = 0.80;
    if (isAWD) { fMul = 1.10; rMul = 0.95; }
    if (isFWD) { fMul = 0.90; rMul = 1.10; } // not ideal for drift but tuned for rotation
    if (muscle) { fMul *= 1.10; rMul *= 1.05; } // stiffen flexy muscle chassis

    const frontSpring = Math.round((fw / 14) * fMul);
    const rearSpring  = Math.round((rw / 14) * rMul);

    // ARB: 1/65 meta for RWD drift; less extreme for AWD; inverted for FWD
    let fARB = 60, rARB = 3;
    if (isAWD) { fARB = 45; rARB = 15; }
    if (isFWD) { fARB = 3;  rARB = 55; }
    if (oldSchool) fARB = Math.min(fARB, 50); // old chassis can't handle max ARB

    // Damping — rebound > bump for drift recovery
    const fBump = ((frontSpring / 100) * 0.35).toFixed(1);
    const fReb  = ((frontSpring / 100) * 0.55).toFixed(1);
    const rBump = ((rearSpring  / 100) * 0.30).toFixed(1);
    const rReb  = ((rearSpring  / 100) * 0.50).toFixed(1);

    // Ride height
    const fH = car.bodyType === 'OffRoad' || car.bodyType === 'Rally' ? 5.5 : (oldSchool ? 4.5 : 4.0);
    const rH = fH + 0.3;

    // Differential
    let accel = isRWD ? 100 : (isAWD ? 80 : 40);
    let decel = isRWD ? 30  : (isAWD ? 25 : 15);

    // Drift-fitness note
    let fitness;
    if (isRWD && car.driftFriendly) fitness = '✓ Excellent drift platform';
    else if (isRWD) fitness = '○ Driftable RWD but not a community favorite';
    else if (isAWD) fitness = '△ AWD — consider RWD conversion in upgrades for pure drift';
    else fitness = '✗ FWD — very hard to drift, this tune rotates on lift-off only';

    return `━━━ ${car.make.toUpperCase()} ${car.model.toUpperCase()} ━━━
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
• Built for: ${car.bodyType}, ${car.era} era, ${car.drivetrain}
• Your notes: ${STATE.userData[car.id]?.notes || '(none yet)'}`;
  }

  loadCars();
})();
