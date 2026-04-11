# FH5 TuneSpec v2

Drift tuning workbench for Forza Horizon 5. Mobile-first PWA. 81 cars seeded, tap any car to generate a tailored drift tune.

## Files

- `index.html` — single-screen app shell
- `app.js` — car list, search, filters, tune calculator
- `styles.css` — Forza-vibes dark theme
- `cars.json` — 81-car database (make, model, year, drivetrain, body type, era, PI, drift flag)
- `manifest.json` — PWA manifest

## Deploy (same as TuneSpec)

1. Go to github.com → **+** → **New repository**
2. Name: `fh5-tunespec` · Public · Add README · **Create**
3. On the repo page: **Add file → Upload files** → drag all 5 files in → **Commit changes**
4. **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**
5. Wait 1–2 minutes, refresh. Site goes live at **stevenxlayton.github.io/fh5-tunespec**
6. Open on phone → Share → Add to Home Screen

## How to use

1. Scroll or search for your car ("supra", "panamera", "miata")
2. Use filter chips to narrow down (🏁 Drift Picks / RWD / Muscle / etc.)
3. Tap a car → enter the weight and front weight % from Forza's upgrade screen → tap **Generate Drift Tune**
4. Copy the numbers into Forza's tuning menu

## Known limits (v2.0)

- **No save between sessions.** Weights and notes disappear on refresh. IndexedDB persistence is the #1 priority for v2.1.
- **81 cars only.** Some cars missing due to Gemini doc formatting quirks. Manual "add car" fallback coming in v2.1.
- **Drift only.** Road/dirt/cross-country tune presets come later.

## Next chat to-do

When you start a fresh chat with me about this, tell me to build:
1. IndexedDB persistence so saved weights survive refresh
2. "Add a car" button for cars not in the database
3. Multi-discipline tune presets (road/dirt/drag)
