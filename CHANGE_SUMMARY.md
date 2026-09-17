# Client Finder — live OSM search reliability

Branch intent: `grok/finder-live-search` from tip `56330aeb` (`cursor/client-finder-website-09df`).

## Problem

Live Finder searches for sparse craft niches (especially Painters) often returned zero named OSM businesses. When live named results were &lt; 4, `/api/search` **appended sample/demo leads into the live response**, so samples looked like real businesses.

## What changed

### `lib/industries.ts`
- Kept dropdown **order and labels**.
- Expanded OSM **tag variants** on primary niches (e.g. painters: `craft=painter` + `shop=paint`; landscapers add `shop=garden_centre`; roofers add `shop=roofing`; etc.).
- Added optional **`nameHints`** (Overpass `name~` patterns) for primary trades so thin tag coverage can fall back to light name matches.

### `lib/osm.ts`
- `buildOverpassQuery` — all tag variants; optional `nameFallback` clauses from `nameHints`.
- `radiusStepsMeters` — start → ×1.5 → ×2, **capped at 25 km**.
- `searchIndustryLeads` — geocode + Overpass; if few named leads, retry with name fallback; then expand radius steps until enough leads or max radius.
- Stronger **dedupe** in `elementsToLeads`: normalized name + phone digits + ~0.001° lat/lon.
- **`isLikelyBusiness`** filter — drops unnamed / parking / non-business leftovers.

### `app/api/search/route.ts`
- Default industry `"restaurants"` → **`"painters"`**.
- **`demo: true`** → sample leads only (`usedDemo: true`).
- Live mode → **live leads only** (even if empty). Never mixes demo into live.
- Hard Overpass/geocode failure → empty live + warning (suggests demo mode); does not invent names.
- Clear empty / sparse-live warning copy.

### Tests
- `tests/osm.test.ts` — tag variants, name fallback query, radius steps, dedupe, non-business filter.
- `tests/search.test.ts` — demo-only when `demo:true`; no demo mix on live/empty/failure; default industry painters.
- `vitest.config.ts` — `@/` alias for route tests.

## Out of scope (preserved)

- No UI redesign, no `score.ts` changes, no paid APIs.
- Deep Qualify, HOLD/DNC, verified desk data, Pipeline, Website Fit, scoring, visuals untouched.

## How to verify

```bash
cd /workspace/finder-live-search
npm test
npm run build
npm run dev
# Finder: Bakersfield + Painters with demo OFF → live only (may be sparse; no sample rows mixed in)
# Same with demo ON → sample leads labeled Sample
```

## npm results (2026-09-16 PT)

- **`npm test`**: 6 files, **67 passed**
- **`npm run build`**: Next.js 15.5.25 — compiled successfully

## Patch

`/workspace/finder-live-search.patch` (vs tip tarball)

## Files touched

- `lib/industries.ts`
- `lib/osm.ts`
- `app/api/search/route.ts`
- `tests/osm.test.ts` (new)
- `tests/search.test.ts` (new)
- `vitest.config.ts`
- `CHANGE_SUMMARY.md` (this file)
