# Status

Append entries: time, who (Claude or Codex), what finished, what is next, notes for the other side.

## Scaffold
- Vite + React app with suncalc and vitest. Run npm install after cloning.
- AGENTS.md is the brief. CLAUDE.md imports it.
- Next: Claude on `engine` branch, Codex on `ui` branch.

## 2026-09-26 01:39 UTC — Claude — effectiveDusk
- Done: `src/engine/sky.js` with `effectiveDusk(date, lat, lon)` + 16 unit tests in `src/engine/__tests__/sky.test.js` (all passing).
- Formula: cloudCover = average hourly cloud_cover over the 2h before sunset; shift = round(cloudCover / 100 * 30) min; effectiveDusk = sunset - shift.
- Contract (new `src/engine/index.js`): `effectiveDusk(date, lat, lon)` is **async** and resolves to
  `{ sunset: Date, cloudCover: number|null, shiftMinutes: number, effectiveDusk: Date, source: 'open-meteo'|'offline' }`.
  If Open-Meteo is unreachable it falls back to SunCalc sunset with no cloud shift and `source: 'offline'` (UI may want to show "offline, no cloud data").
  Also exported: `computeEffectiveDusk(sunset, hourly)`, `cloudShiftMinutes(percent)`.
- Note: suncalc 2.x is ESM with named exports: `import { getTimes } from 'suncalc'` (no default export).
- Next: `moonriseStart(effectiveDusk, logs)`.
