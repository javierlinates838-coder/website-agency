import { getIndustry } from "./industries";
import { classifyOpportunity, normalizeWebsite } from "./score";
import type { Lead } from "./types";

const USER_AGENT =
  "BeaconLeadFinder/1.0 (https://github.com/javierlinates838-coder/website-agency; client research tool)";

export const MAX_RADIUS_METERS = 25_000;
export const MIN_USEFUL_LEADS = 4;

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
  options?: { nameFallback?: boolean },
): string {
  const industry = getIndustry(industryId);
  const clauses = industry.tags.map(
    (tag) => `  nwr["${tag.key}"="${tag.value}"](around:${radius},${lat},${lon});`,
  );

  if (options?.nameFallback && industry.nameHints?.length) {
    for (const hint of industry.nameHints) {
      clauses.push(`  nwr["name"~"${hint}",i](around:${radius},${lat},${lon});`);
    }
  }

  return `[out:json][timeout:25];\n(\n${clauses.join("\n")}\n);\nout center 80;`;
}

export async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": USER_AGENT,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (!response.ok) {
        lastError = new Error(`Overpass ${response.status}`);
        continue;
      }
      const json = (await response.json()) as { elements?: OverpassElement[] };
      return json.elements || [];
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Overpass request failed");
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

async function fetchElementsForRadius(
  lat: number,
  lon: number,
  radius: number,
  industryId: string,
): Promise<OverpassElement[]> {
  const industry = getIndustry(industryId);
  let elements = await fetchOverpass(buildOverpassQuery(lat, lon, radius, industryId, { nameFallback: false }));
  const named = elementsToLeads(elements, "probe", industryId).length;

  if (named < MIN_USEFUL_LEADS && industry.nameHints?.length) {
    const withNames = await fetchOverpass(
      buildOverpassQuery(lat, lon, radius, industryId, { nameFallback: true }),
    );
    elements = mergeElements(elements, withNames);
  }

  return elements;
}

/**
 * Geocode + Overpass with tag variants, optional name fallbacks, and bounded radius expand.
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

  for (const radius of steps) {
    const elements = await fetchElementsForRadius(geo.lat, geo.lon, radius, industryId);
    const leads = elementsToLeads(elements, city, industryId);
    bestLeads = leads;
    usedRadius = radius;
    if (leads.length >= MIN_USEFUL_LEADS) break;
  }

  return {
    cityLabel: geo.label,
    lat: geo.lat,
    lon: geo.lon,
    radiusMeters: usedRadius,
    leads: bestLeads,
  };
}
