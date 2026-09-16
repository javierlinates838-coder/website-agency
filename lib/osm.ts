import { getIndustry } from "./industries";
import { classifyOpportunity, normalizeWebsite } from "./score";
import type { Lead } from "./types";

const USER_AGENT =
  "BeaconLeadFinder/1.0 (https://github.com/javierlinates838-coder/website-agency; client research tool)";

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
};

type OverpassElement = {
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

export function buildOverpassQuery(
  lat: number,
  lon: number,
  radius: number,
  industryId: string,
): string {
  const industry = getIndustry(industryId);
  const clauses = industry.tags
    .map((tag) => `  nwr["${tag.key}"="${tag.value}"](around:${radius},${lat},${lon});`)
    .join("\n");
  return `[out:json][timeout:25];\n(\n${clauses}\n);\nout center 50;`;
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
    if (!name) continue;
    const key = `${name.toLowerCase()}|${tags["addr:street"] || ""}|${tags.phone || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const websiteRaw = firstTag(tags, ["website", "contact:website", "url", "contact:facebook"]);
    const website = websiteRaw ? normalizeWebsite(websiteRaw) : undefined;
    const classified = classifyOpportunity({ website });
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;

    leads.push({
      id: `osm:${element.type}:${element.id}`,
      name,
      industry: industry.id,
      industryLabel: industry.label,
      city,
      address: formatAddress(tags, city),
      lat,
      lon,
      phone: firstTag(tags, ["phone", "contact:phone", "contact:mobile"]),
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
