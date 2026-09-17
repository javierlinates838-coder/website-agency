# Beacon

A small website for finding local businesses that still need a website — or a much better one.

## Verified desk (start here)

The Bakersfield / Oildale desk is already ranked:

1. White Lane Donuts — no website
2. Oildale Nails — no website
3. Briceno Electric (Hector only) — no website for Hector
4. Hometown Plumbing — outdated site
5. Luna Electric Inc. — weak site, redesign

Johnny's Barber is HOLD. Oildale Barber is DNC. Call and email scripts include the numbers to use and the ones to ignore.

## Also included

- City + trade finder from OpenStreetMap
- Opportunity scoring (no website, social-only, outdated, not mobile)
- Pipeline on this device: New / Contacted / Follow Up / Won / Lost, with notes and a follow-up date
- CSV export

Sample finder rows are labeled **Sample**. Do not contact those as real businesses.

No environment variables are required. Nominatim and Overpass are called from the Next.js server with the app’s user agent.

## Run it

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and go to **Desk**. Use **Finder** for the next city, then **Pipeline** for saved work.

## Deploy

No environment variables are required. Do not add API keys, CRM tokens, or mail credentials — Beacon does not send outreach.

**Runtime:** Node.js 20+ with Next.js 15. Build with `npm run build`, serve with `npm start` (binds `0.0.0.0:3000`). Any host that can run `next start` works.

**Network:** Live Finder calls OpenStreetMap Nominatim and Overpass from the server. Homepage analysis fetches public URLs. If those are blocked, Finder falls back to labeled **Sample** leads.

**State:** Pipeline and outreach profile are stored in the visitor’s browser (`localStorage` keys `beacon-pipeline` and `beacon-profile`), not on the server. That is per-device, not a shared CRM.

Do not deploy secrets. None are used.
