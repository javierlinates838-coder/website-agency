# Beacon

A small website for finding local businesses that still need a website — or a much better one.

## What it does

- Search a city and a trade (dentists, salons, plumbers, restaurants, and more).
- Pull live listings from OpenStreetMap when available.
- Score each business: no website, social-only, outdated, not mobile-ready, or fine as-is.
- Draft email, SMS, DM, and voicemail outreach.
- Save leads to a pipeline on this device and export CSV.

Sample leads are clearly labeled. Do not contact sample rows as if they were real businesses.

## Run it

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Notes

Live search uses Nominatim and Overpass. If those services are slow or empty for a town, Beacon fills the board with sample leads so you can still practice the workflow.
