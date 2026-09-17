import { getIndustry } from "./industries";
import { classifyOpportunity, normalizeWebsite } from "./score";
import type { Lead } from "./types";

const USER_AGENT =
  "BeaconLeadFinder/1.0 (https://github.com/javierlinates838-coder/website-agency; client research tool)";

export const MAX_RADIUS_METERS = 25_000;
export const MIN_USEFUL_LEADS = 4;

/** Public Overpass mirrors; rotated on 429/5xx/timeout. */
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export const OVERPASS_FETCH_TIMEOUT_MS = 22_000;
export const OVERPASS_TRIES_PER_ENDPOINT = 2;

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
};

export type OverpassElement = {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function firstTag(tags: Record<string, string> | undefined, keys: string[]): string | undefined {
  if (!tags) return undefined;
  for (const key of keys) {
    if (tags[key]) return tags[key];
  }
  return undefined;
}

function formatAddress(tags: Record<string, string> | undefined, city: string): string {
  if (!tags) return city;
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"] || city,
    tags["addr:state"],
  ].filter(Boolean);
  return parts.join(", ") || city;
}

export async function geocodeCity(query: string): Promise<{ lat: number; lon: number; label: string }> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Geocoding failed (${response.status})`);
  }
  const hits = (await response.json()) as NominatimHit[];
  if (!hits[0]) {
    throw new Error("That city could not be found. Try a city and state, like Austin TX.");
  }
  return {
    lat: Number(hits[0].lat),
    lon: Number(hits[0].lon),
    label: hits[0].display_name,
  };
}

/** Radius steps: start → ×1.5 → ×2, capped at 25km. */
export function radiusStepsMeters(startMeters: number, maxMeters = MAX_RADIUS_METERS): number[] {
  const start = Math.min(maxMeters, Math.max(1000, Math.round(startMeters)));
  const steps = [start];
  const mid = Math.min(maxMeters, Math.round(start * 1.5));
  const wide = Math.min(maxMeters, Math.round(start * 2));
  if (mid > start) steps.push(mid);
  if (wide > steps[steps.length - 1]) steps.push(wide);
  return steps;
}

export function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number,
  industryId: string,
  options?: { nameFallback?: boolean; nameOnly?: boolean; namePatterns?: string[] },
): string {
  const industry = getIndustry(industryId);
  const clauses: string[] = [];

  if (!options?.nameOnly) {
    for (const tag of industry.tags) {
      clauses.push(`  nwr["${tag.key}"="${tag.value}"](around:${radius},${lat},${lon});`);
    }
  }

  if (options?.nameFallback || options?.nameOnly) {
    const patterns = options.namePatterns?.length
      ? options.namePatterns
      : industry.nameHints || [];
    for (const hint of patterns) {
      clauses.push(`  nwr["name"~"${hint}",i](around:${radius},${lat},${lon});`);
    }
  }

  return `[out:json][timeout:25];\n(\n${clauses.join("\n")}\n);\nout center 80;`;
}

/** Split pipe-heavy nameHints into smaller sequential Overpass patterns. */
export function chunkNameHints(hints: string[], chunkSize = 2): string[] {
  const parts: string[] = [];
  for (const hint of hints) {
    const alts = hint.split("|").map((s) => s.trim()).filter(Boolean);
    if (alts.length <= chunkSize) {
      parts.push(alts.join("|") || hint);
      continue;
    }
    for (let i = 0; i < alts.length; i += chunkSize) {
      parts.push(alts.slice(i, i + chunkSize).join("|"));
    }
  }
  return parts.length ? parts : hints;
}

function isRetriableOverpassStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504 || status >= 500;
}

function overpassErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /aborted|timeout|Timeout/i.test(error.message)) {
      return "Overpass timeout";
    }
    return error.message;
  }
  return "Overpass request failed";
}

/**
 * POST a query to public Overpass mirrors.
 * Per-endpoint: up to 2 tries with ~22s AbortSignal timeout; rotate on 429/5xx/timeout.
 */
export async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: Error | null = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 0; attempt < OVERPASS_TRIES_PER_ENDPOINT; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OVERPASS_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          },
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          lastError = new Error(`Overpass ${response.status}`);
          if (isRetriableOverpassStatus(response.status)) {
            continue; // retry same endpoint, then rotate
          }
          break; // non-retriable on this host → next mirror
        }
        const json = (await response.json()) as { elements?: OverpassElement[] };
        return json.elements || [];
      } catch (error) {
        lastError = new Error(overpassErrorMessage(error));
        // timeout / network → retry then rotate
      } finally {
        clearTimeout(timer);
      }
    }
  }

  throw lastError || new Error("Overpass request failed");
}

function mergeElements(a: OverpassElement[], b: OverpassElement[]): OverpassElement[] {
  const seen = new Set<string>();
  const out: OverpassElement[] = [];
  for (const el of [...a, ...b]) {
    const key = `${el.type}:${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(el);
  }
  return out;
}

export function normalizeLeadName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function phoneDigits(phone?: string): string {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

function approxCoord(n?: number): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toFixed(3);
}

const BLOCKED_NAMES = new Set([
  "unnamed",
  "no name",
  "parking",
  "building",
  "house",
  "residential",
  "apartment",
  "toilets",
  "bench",
  "entrance",
  "yes",
]);

/** Drop unnamed / obvious non-business leftovers from Overpass. */
export function isLikelyBusiness(tags: Record<string, string> | undefined, name: string | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (/^\d+$/.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (BLOCKED_NAMES.has(lower)) return false;

  const t = tags || {};
  if (t.amenity === "parking" || t.amenity === "toilets" || t.highway || t.barrier) return false;
  if (t.building && !t.shop && !t.craft && !t.office && !t.amenity && !t.leisure) {
    // Named building alone is weak unless it has contact info
    const hasContact = Boolean(
      t.phone || t["contact:phone"] || t.website || t.email || t["addr:street"],
    );
    if (!hasContact) return false;
  }

  const hasBusinessTag = Boolean(t.shop || t.craft || t.office || t.amenity || t.leisure);
  const hasContact = Boolean(
    t.phone || t["contact:phone"] || t.website || t["contact:website"] || t.email || t["addr:street"],
  );

  if (!hasBusinessTag && !hasContact) {
    // Name-regex leftovers need a company-ish cue
    if (
      !/\b(llc|inc|co|company|services?|painting|roofing|plumbing|electric|hvac|salon|clinic|contractors?)\b/i.test(
        trimmed,
      )
    ) {
      return false;
    }
  }

  return true;
}

export function elementsToLeads(
  elements: OverpassElement[],
  city: string,
  industryId: string,
): Lead[] {
  const industry = getIndustry(industryId);
  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const element of elements) {
    const tags = element.tags || {};
    const name = tags.name?.trim();
    if (!isLikelyBusiness(tags, name)) continue;

    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const phone = firstTag(tags, ["phone", "contact:phone", "contact:mobile"]);
    const dedupeKey = `${normalizeLeadName(name!)}|${phoneDigits(phone)}|${approxCoord(lat)}|${approxCoord(lon)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const websiteRaw = firstTag(tags, ["website", "contact:website", "url", "contact:facebook"]);
    const website = websiteRaw ? normalizeWebsite(websiteRaw) : undefined;
    const classified = classifyOpportunity({ website });

    leads.push({
      id: `osm:${element.type}:${element.id}`,
      name: name!,
      industry: industry.id,
      industryLabel: industry.label,
      city,
      address: formatAddress(tags, city),
      lat,
      lon,
      phone,
      email: firstTag(tags, ["email", "contact:email"]),
      website,
      score: classified.score,
      kind: classified.kind,
      issues: classified.issues,
      source: "live",
      analyzed: !website || classified.kind === "social_only",
    });
  }

  return leads;
}

/** Name-regex only queries, chunked sequentially; failures skip that chunk. */
async function fetchNameFallbackElements(
  lat: number,
  lon: number,
  radius: number,
  industryId: string,
  existingNamedCount: number,
): Promise<OverpassElement[]> {
  const industry = getIndustry(industryId);
  const hints = industry.nameHints || [];
  if (!hints.length) return [];

  const chunks = chunkNameHints(hints);
  let merged: OverpassElement[] = [];

  for (const pattern of chunks) {
    try {
      const query = buildOverpassQuery(lat, lon, radius, industryId, {
        nameOnly: true,
        namePatterns: [pattern],
      });
      const els = await fetchOverpass(query);
      merged = mergeElements(merged, els);
      const namedFromNames = elementsToLeads(merged, "probe", industryId).length;
      if (existingNamedCount + namedFromNames >= MIN_USEFUL_LEADS) break;
    } catch {
      // keep going with remaining chunks / tag-only results
    }
  }

  return merged;
}

async function fetchElementsForRadius(
  lat: number,
  lon: number,
  radius: number,
  industryId: string,
): Promise<OverpassElement[]> {
  const industry = getIndustry(industryId);
  let elements: OverpassElement[] = [];

  // Tags-first (cheaper). Soft-fail so name fallback / next radius can still run.
  try {
    elements = await fetchOverpass(
      buildOverpassQuery(lat, lon, radius, industryId, { nameFallback: false }),
    );
  } catch {
    elements = [];
  }

  const named = elementsToLeads(elements, "probe", industryId).length;

  if (named < MIN_USEFUL_LEADS && industry.nameHints?.length) {
    try {
      const withNames = await fetchNameFallbackElements(
        lat,
        lon,
        radius,
        industryId,
        named,
      );
      elements = mergeElements(elements, withNames);
    } catch {
      // Keep tag-only results instead of throwing on name-regex 504/timeout
    }
  }

  // If both tags and names yielded nothing and tags had hard-failed with empty,
  // still return [] rather than throw — caller expands radius / soft-fails.
  return elements;
}

/**
 * Geocode + Overpass with tag variants, optional name fallbacks, and bounded radius expand.
 * Per-radius Overpass failures are caught so later radius steps can still succeed.
 */
export async function searchIndustryLeads(
  city: string,
  industryId: string,
  radiusKm: number,
): Promise<{
  cityLabel: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  leads: Lead[];
}> {
  const geo = await geocodeCity(city);
  const startMeters = Math.min(MAX_RADIUS_METERS, Math.max(2000, Math.round(radiusKm * 1000)));
  const steps = radiusStepsMeters(startMeters);

  let bestLeads: Lead[] = [];
  let usedRadius = steps[0];
  let lastRadiusError: Error | null = null;
  let anyRadiusOk = false;

  for (const radius of steps) {
    try {
      const elements = await fetchElementsForRadius(geo.lat, geo.lon, radius, industryId);
      anyRadiusOk = true;
      const leads = elementsToLeads(elements, city, industryId);
      if (leads.length >= bestLeads.length) {
        bestLeads = leads;
        usedRadius = radius;
      }
      if (leads.length >= MIN_USEFUL_LEADS) break;
    } catch (error) {
      lastRadiusError = error instanceof Error ? error : new Error("Overpass request failed");
      // continue to next radius step
    }
  }

  if (!anyRadiusOk && bestLeads.length === 0 && lastRadiusError) {
    throw lastRadiusError;
  }

  return {
    cityLabel: geo.label,
    lat: geo.lat,
    lon: geo.lon,
    radiusMeters: usedRadius,
    leads: bestLeads,
  };
}
