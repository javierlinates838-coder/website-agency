# Grok integration plan — inspection only

**Status:** Planning / inspection. No application code changes in this PR.  
**Base:** `cursor/client-finder-website-09df` @ `1d5f749`  
**Branch:** `grok/client-finder-integration`  
**Date:** 2026-09-16  

This document answers the four inspection questions from a full read of the Beacon codebase plus the three Bakersfield research files. Do not treat this as approval to implement.

---

## Key files / paths

| Path | Role |
|------|------|
| `app/page.tsx` | Marketing home; points users at the verified desk |
| `app/desk/page.tsx` | Verified Bakersfield desk route |
| `app/finder/page.tsx` | OSM city + trade scanner UI |
| `app/pipeline/page.tsx` | Local CRM-ish board |
| `app/playbook/page.tsx` | Outreach habits + HOLD/DNC reminder |
| `app/api/search/route.ts` | Nominatim geocode + Overpass search; demo fallback |
| `app/api/analyze/route.ts` | Fetches a public homepage HTML and scores it |
| `components/VerifiedDesk.tsx` | Ranked Top 5 UI, parked HOLD/DNC, copyable scripts |
| `components/FinderApp.tsx` | Search, filters, generic pitches, CSV, save to pipeline |
| `components/PipelineBoard.tsx` | Drag/status board over `localStorage` |
| `lib/types.ts` | Shared `Lead` / `LeadStatus` / `OpportunityKind` |
| `lib/verified.ts` | Hardcoded verified records + `verifiedToLead()` |
| `lib/verifiedScripts.ts` | Per-lead call / email / voicemail copy |
| `lib/score.ts` | HTML/URL opportunity classifier |
| `lib/osm.ts` | OSM → `Lead` mapping |
| `lib/storage.ts` | `localStorage` pipeline + CSV export |
| `lib/templates.ts` | Generic finder pitches (not verified-desk scripts) |
| `lib/demo.ts` | Fake sample leads (555 numbers) |
| `lib/industries.ts` | 12 OSM tag groups |
| `lib/ssrf.ts` | Blocks private hosts on `/api/analyze` |
| `tests/verified.test.ts` | Top 5 / HOLD / DNC / script guards |
| `tests/score.test.ts` | Classifier + SSRF + demo pitches |

Tech stack: Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, Vitest. No database, no auth, no CRM vendor. Persistence is browser `localStorage` keys `beacon-pipeline` and `beacon-profile`.

---

## Data model fields (today)

### Finder / pipeline `Lead` (`lib/types.ts`)

`id`, `name`, `industry`, `industryLabel`, `city`, `address`, `lat?`, `lon?`, `phone?`, `email?`, `website?`, `score` (number), `kind` (`OpportunityKind`), `issues[]`, `source` (`live` \| `demo` \| `verified`), `analyzed`, `notes?`, `status?` (`new` \| `contacted` \| `meeting` \| `proposal` \| `won` \| `passed`), `savedAt?`.

`OpportunityKind`: `no_website` \| `social_only` \| `parked` \| `outdated` \| `not_mobile` \| `insecure` \| `thin` \| `refresh` \| `healthy`.

### Verified desk `VerifiedLead` (`lib/verified.ts`)

`id`, `rank?`, `name`, `trade`, `intent?` (`high` \| `medium`), `status` (`safe` \| `hold` \| `dnc`), `phone?`, `ignorePhones?`, `ignoreEmails?`, `ignoreSites?`, `email?`, `address`, `mailing?`, `discardAddresses?`, `website?`, `websiteNote?`, `why`, `doNot[]`, `play?` (`greenfield` \| `redesign`), `city`, `license?`.

Pipeline conversion (`verifiedToLead`) is lossy: it keeps name/phone/email/website/address/city/issues/notes, sets `source: "verified"`, maps `play` → `kind` (`redesign` → `outdated`, else `no_website`), and maps `intent` → `score` (`high` → 94, `medium` → 82, else 70). It does **not** persist rank, contact status, confidence, mailing, ignore-lists, license, or play as first-class pipeline fields.

CSV columns (`toCsv`): Name, Industry, City, Address, Phone, Email, Website, Score, Opportunity, Issues, Status.

---

## How scoring works today

Two different scoring systems exist.

### 1. Live finder classifier (`classifyOpportunity` in `lib/score.ts`)

Starts at **28**. Short-circuits:

- No website → **94**, kind `no_website`
- Social host (Facebook, Instagram, Yelp, etc.) → **88**, kind `social_only`

Otherwise adds points for fetch errors, HTTP 4xx/5xx, HTTP (not HTTPS), parked/default HTML hints, missing viewport, weak title/meta/H1, copyright year ≤ 2022, thin HTML, old WordPress, thin builder templates, missing contact CTA. Clamped **12–98**. Dominant flag becomes `kind`. Tone: ≥80 hot, ≥62 warm, ≥45 cool, else cold.

OSM search (`lib/osm.ts`) scores from the listed URL only (no HTML) until the client later POSTs `/api/analyze` in batches of 3. Demo leads (`lib/demo.ts`) are pre-scored with synthetic HTML.

### 2. Verified-desk proxy scores (`verifiedToLead`)

Research opportunity scores (82 / 72 / 74 / 68 / 62 …) are **not** stored. The desk UI ranks by hardcoded `rank`. Pipeline cards get the intent proxy above, so Hometown (research 68, redesign) becomes 94 in the pipeline, while Oildale Nails (research 72, greenfield) becomes 82. That inverts research ranking if someone sorts the pipeline by `score`.

---

## What the app currently does

Beacon is a **client-finder for a web studio**, not a generic agency brochure.

1. **Verified Bakersfield desk (`/desk`)** — already shipped on the Cursor branch. Hardcoded Top 5 matching the flag-resolution file:
   1. White Lane Donuts — greenfield, `(661) 836-2906`, ignore `(661) 827-9606`
   2. Oildale Nails — greenfield, `(661) 391-8830`
   3. Briceno Electric (Hector only) — greenfield, `(661) 599-9646`, ignore `williamb@` and `bricenoelectric.com`, CSLB `#900822`
   4. Hometown Plumbing — redesign, `(661) 837-4569`, `hometownplumbing@att.net`, Empire State + PO Box 41116, discard Norris Rd
   5. Luna Electric Inc. — redesign, `(661) 461-8042`, `accounting@lunaelectric07.com`
2. **HOLD / DNC parks** — Johnny's Barber is HOLD; Oildale Barber is DNC. `canContact()` blocks saving them as outreach. Scripts return HOLD / DO NOT CONTACT text instead of a pitch.
3. **Manual scripts only** — call / email / voicemail are copy-to-clipboard. `tel:` and `mailto:` links exist. There is **no send API, no SMS, no sequencer, no auto-outreach**.
4. **City + trade finder (`/finder`)** — OpenStreetMap Nominatim + Overpass. 12 industries. Optional demo/sample rows labeled Sample. Filters by opportunity kind. Generic pitches via `buildPitch`.
5. **Website analyzer (`/api/analyze`)** — public HTTP(S) fetch with SSRF guard; feeds `classifyOpportunity`.
6. **Pipeline (`/pipeline`)** — six columns, drag or tap, device-local. CSV export. Clear board.
7. **Playbook (`/playbook`)** — outreach habits; reminds operators to honor HOLD/DNC.
8. **Studio profile** — name / studio / email / offer stored locally and interpolated into scripts.

No outreach has been sent from the product. Research files confirm no calls/emails/forms/DMs were made during verification.

---

## What is missing (relative to using researched / verified local leads)

The first integration **already exists as hardcoded TypeScript**, not as an import of the research markdown. Remaining gaps:

1. **Research scores and confidence are not first-class.** Desk uses `intent` + `rank`. Pipeline uses proxy 94/82. Research `Opportunity Score` and `Confidence` (HIGH/MEDIUM/LOW) are distinct and currently collapsed.
2. **Website-status vocabulary differs.** Research: NONE / OUTDATED / WEAK / ADEQUATE / UNCLEAR / CLOSED. App `kind` + `play` (greenfield/redesign) cannot say “WEAK redesign” vs “OUTDATED” vs “ADEQUATE / low gap.”
3. **No recommended contact method field.** Encoded only in script copy (“Call X only”, “phone or email”).
4. **Bench of 5 SAFE-but-not-Top-5 names is names only** (`VERIFIED_BENCH`): Hybrid Health, JJ Concrete, Able Auto, Brimhall, 24th Street Cafe. No phones, emails, do-not rules, scores, or scripts. Original list also had richer source URLs.
5. **FLAGS are partial.** Ignore lists exist on Top 5, but not a structured flag log (claim vs counterclaim, sources, resolved vs unresolved). Luna CSLB `#1008195` (mirror-only caveat) is not on the record. Hometown CSLB `#850879` is missing. White Lane Facebook numeric URL is missing. Zips are often dropped.
6. **HOLD/DNC records are thin.** Johnny’s conflicting addresses/phones and Oildale Barber’s stale `(661) 399-9090` are not stored as “do not use” lists on those parked cards.
7. **No import path.** Research lives outside the repo (uploaded markdown). Adding another city means editing `lib/verified.ts` by hand. No JSON/CSV import, no admin UI, no validation beyond unit tests.
8. **Finder can contradict the desk.** A Bakersfield OSM scan can surface the same shops (or Norris / Johnny’s variants) without HOLD/DNC, using live/demo scoring and generic pitches.
9. **Pipeline is not a verification CRM.** Saving a verified lead drops mailing vs street, ignore rules, license, rank, and contact eligibility. CSV cannot round-trip verified fields. No activity log (copying a script does not mark `contacted`). No import of CSV back in.
10. **Original vs verified ranking is not shown.** First-pass Top 5 (Cafe, JJ, Hometown, Able, Oildale Barber) was superseded; the app shows only the verified ranking, which is correct, but an operator cannot see why Cafe/Able were demoted without leaving the product.

---

## How you would integrate the verified leads we researched

Do **not** auto-email, auto-text, or auto-dial. Keep copy/tel/mailto as the only send path.

### Recommended data shape (map research → existing models)

Keep `VerifiedLead` as the source of truth for the desk. Extend it (later, after approval) rather than stuffing everything into finder `Lead`.

Proposed additive fields (no need to break current `Lead` consumers):

| Research field | Proposed `VerifiedLead` field | Pipeline `Lead` mapping |
|----------------|-------------------------------|-------------------------|
| Rank | `rank` (already) | `notes` or new optional `rank` |
| Opportunity Score 0–100 | `opportunityScore` | `score` (replace the 94/82 proxy) |
| Confidence HIGH/MEDIUM/LOW | `confidence` | `notes` or optional field |
| Website Status NONE/WEAK/OUTDATED/ADEQUATE/UNCLEAR/CLOSED | `websiteStatus` | map to `kind`: NONE→`no_website`, WEAK/OUTDATED→`outdated` or `refresh`, ADEQUATE→`healthy`/`refresh`, CLOSED→do not save |
| Play greenfield/redesign | `play` (already) | keep |
| SAFE / HOLD / DNC | `status` (already) | never upsert HOLD/DNC (`canContact` already) |
| Phone / ignore phones | `phone`, `ignorePhones` | `phone`; ignore list → `notes` |
| Email / ignore emails | `email`, `ignoreEmails` | `email` |
| Address / mailing / discard | already present | concatenate into `address` + `notes` |
| Recommended contact method | `contactMethod`: `phone` \| `phone_or_email` \| `none` | `notes` |
| FLAGS | `flags: { id, severity, text, resolved }[]` | first unresolved flag → `issues` |
| Sources | `sources: { label, url }[]` | omit from CSV by default |
| License | `license` (already, incomplete) | `notes` |

`verifiedToLead` should copy `opportunityScore` → `score`, keep `source: "verified"`, and prepend do-not rules to `issues`/`notes` so the pipeline cannot lose HOLD semantics if a future bug allows a save.

### Import path

1. **Authoritative file:** `data/verified/bakersfield.json` (or similar) checked into the repo, typed by `VerifiedLead`.
2. **One-time conversion** from the three markdown research files into that JSON (hand-reviewed, not scraped live).
3. `lib/verified.ts` becomes a loader + helpers, not a second copy of the facts.
4. Finder CSV remains export-only. Optional later: “Import verified JSON” on the desk for a new market file. Reject rows with `status: dnc` from pipeline upsert.
5. Do not ingest the original unverified list as callable leads. Original file is hypothesis-only; flag-resolution Top 5 + HOLD/DNC is the allowlist.

### Scoring fields

- Desk sort: `rank` (human verified), not OSM HTML score.
- Display both `opportunityScore` and `confidence` on the card.
- Do not re-run `/api/analyze` on verified rows in a way that overwrites research status (e.g. Luna would score as “refresh/healthy” on viewport+HTTPS and could lose the WEAK pitch). If a live scan is added, store it as `liveScan` alongside research, never as the outreach truth.

### Contact method + FLAGS / HOLD / DNC

- Top 5: phone first; email only where verified (Hometown, Luna). Never use ignore-lists.
- Johnny’s: HOLD, no scripts that look like a pitch.
- Oildale Barber: DNC; do not pitch Norris without a separate verified record.
- Finder should hide or badge OSM hits whose name/phone match a parked verified id.

### No auto-outreach

Scripts stay copy-only. Saving to pipeline does not send. Playbook remains the “you still send it” reminder.

---

## What you recommend building next

Prioritized small steps. **Do not start until the user approves.**

### First PR after approval (tight)

1. Introduce `opportunityScore`, `confidence`, `websiteStatus`, `contactMethod` on `VerifiedLead`.
2. Point `verifiedToLead().score` at `opportunityScore` so pipeline rank matches research.
3. Add Luna license `#1008195` (mirror caveat in `doNot`) and Hometown `#850879`.
4. Tests: Top 5 scores/confidence match the flag-resolution file; HOLD/DNC still cannot be saved; no send endpoints added.

Out of scope for that first PR: finder de-dupe, bench records, JSON file extraction, activity log.

### Later PRs (separate, still small)

5. Promote `VERIFIED_BENCH` from names to full SAFE records **without** call scripts (or scripts behind an “alternate, not first five” label).
6. Move constants into `data/verified/bakersfield.json`.
7. Finder: suppress or warn when an OSM row matches a DNC/HOLD verified id.
8. Pipeline: show verified badge + do-not snippet; optional “mark contacted” when copying a desk script.
9. CSV columns for confidence, websiteStatus, contactMethod, source.

### Explicitly not next

- Contacting businesses, email/SMS APIs, sequencers, paid data, production deploys, deleting pipeline data remotely, editing external accounts.
- Treating the original-list Top 5 (including Oildale Barber) as callable.
- Auto-updating scores from live HTML for verified rows.

---

## Risks / assumptions

- **Assumption:** Flag-resolution file (Sep 15–16, 2026) is the allowlist; original list is historical. The Cursor desk already follows that.
- **Assumption:** “Integrate verified leads” now means deepen the existing desk, not invent a second lead store.
- **Risk:** Dual scoring (OSM HTML vs research) will confuse operators if both appear as the same `score` field.
- **Risk:** `localStorage` is per-browser; CSV is the only backup. No multi-device CRM.
- **Risk:** OSM + analyze can still fetch third-party sites; SSRF is guarded, but live scans are not verification.
- **Risk:** License numbers are mirror-corroborated, not live CSLB HTML. Sales copy must not claim board confirmation until rechecked.
- **Risk:** Empty-diff branch vs this docs-only commit — this file exists only so the inspection branch can open a planning PR without touching app source.
- **No outreach, no spend, no production deploy in this run.**

---

## Success check for this inspection run

- Branch `grok/client-finder-integration` is based on `cursor/client-finder-website-09df`.
- Application source/UI/API unchanged except this planning doc.
- The four sections above are from the real tree, not guesses.
