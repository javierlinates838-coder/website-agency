import { getIndustry } from "./industries";
import { geocodeCity, MAX_RADIUS_METERS } from "./osm";
import { classifyOpportunity, normalizeWebsite } from "./score";
import type { Lead } from "./types";

export const GOOGLE_PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

export const GOOGLE_PLACES_FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.types",
  "places.rating",
  "places.userRatingCount",
  "places.id",
].join(",");

/** Human text-query noun for "{noun} in {city}". */
const TEXT_QUERY_NOUN: Record<string, string> = {
  painters: "painters",
  landscapers: "landscapers",
  roofers: "roofers",
  concrete: "concrete contractors",
  fencing: "fence companies",
  electricians: "electricians",
  plumbers: "plumbers",
  hvac: "HVAC contractors",
  cleaning: "cleaning companies",
  "mobile-detailing": "mobile car detailing",
  "tree-service": "tree service",
  "junk-removal": "junk removal",
  "garage-doors": "garage door companies",
  flooring: "flooring companies",
  handyman: "handyman",
  "pressure-washing": "pressure washing",
  auto: "auto repair",
  towing: "towing",
  "pest-control": "pest control",
  "windows-doors": "window and door installers",
  "pool-service": "pool service",
  solar: "solar installers",
  salons: "hair salons",
  nails: "nail salons",
  fitness: "gyms",
  dentists: "dentists",
  realestate: "real estate agents",
};

/**
 * Optional Places Table A `includedType` (singular).
 * Only set where Google has a clear matching type.
 */
const INCLUDED_TYPE: Record<string, string> = {
  painters: "painter",
  landscapers: "landscaper",
  roofers: "roofing_contractor",
  electricians: "electrician",
  plumbers: "plumber",
  hvac: "hvac_contractor",
  cleaning: "cleaning_service",
  "tree-service": "tree_service",
  "junk-removal": "moving_company",
  flooring: "flooring_store",
  handyman: "general_contractor",
  auto: "car_repair",
  towing: "tow_provider",
  "pest-control": "pest_control_service",
  "pool-service": "swimming_pool_repair",
  solar: "solar_energy_company",
  salons: "hair_salon",
  nails: "nail_salon",
  fitness: "gym",
  dentists: "dentist",
  realestate: "real_estate_agency",
};

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  googleMapsUri?: string;
  types?: string[];
  rating?: number;
  userRatingCount?: number;
};

export type GoogleTextSearchResponse = {
  places?: GooglePlace[];
};

export function hasGooglePlacesApiKey(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.GOOGLE_PLACES_API_KEY?.trim());
}

export function getGooglePlacesApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.GOOGLE_PLACES_API_KEY?.trim();
  return key || undefined;
}

export function buildPlacesTextQuery(industryId: string, city: string): string {
  const industry = getIndustry(industryId);
  const noun = TEXT_QUERY_NOUN[industry.id] || industry.label.toLowerCase();
  return `${noun} in ${city.trim()}`;
}

export function getPlacesIncludedType(industryId: string): string | undefined {
  const industry = getIndustry(industryId);
  return INCLUDED_TYPE[industry.id];
}

export function extractPlaceId(place: GooglePlace): string | undefined {
  const raw = place.id?.trim();
  if (!raw) return undefined;
  // API may return "places/ChIJ..." or bare ChIJ...
  return raw.replace(/^places\//, "");
}

/** Skip permanently closed; require a display name. */
export function isUsableGooglePlace(place: GooglePlace): boolean {
  if (place.businessStatus === "CLOSED_PERMANENTLY") return false;
  const name = place.displayName?.text?.trim();
  return Boolean(name && name.length >= 2);
}

export function placesToLeads(places: GooglePlace[], city: string, industryId: string): Lead[] {
  const industry = getIndustry(industryId);
  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const place of places) {
    if (!isUsableGooglePlace(place)) continue;
    const placeId = extractPlaceId(place);
    if (!placeId || seen.has(placeId)) continue;
    seen.add(placeId);

    const name = place.displayName!.text!.trim();
    const phone = place.nationalPhoneNumber?.trim() || undefined;
    const websiteRaw = place.websiteUri?.trim();
    const website = websiteRaw ? normalizeWebsite(websiteRaw) : undefined;
    const classified = classifyOpportunity({ website });

    leads.push({
      id: `google:${placeId}`,
      name,
      industry: industry.id,
      industryLabel: industry.label,
      city,
      address: place.formattedAddress?.trim() || city,
      lat: place.location?.latitude,
      lon: place.location?.longitude,
      phone,
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

export type FetchTextSearchOptions = {
  apiKey: string;
  textQuery: string;
  includedType?: string;
  /** Circle bias radius in meters (default from search radius). */
  locationBias?: { lat: number; lon: number; radiusMeters: number };
  pageSize?: number;
  includePureServiceAreaBusinesses?: boolean;
};

/**
 * POST places:searchText. Never logs the API key.
 */
export async function fetchPlacesTextSearch(
  options: FetchTextSearchOptions,
): Promise<GooglePlace[]> {
  const body: Record<string, unknown> = {
    textQuery: options.textQuery,
    pageSize: Math.min(20, Math.max(1, options.pageSize ?? 20)),
    languageCode: "en",
    regionCode: "US",
  };

  if (options.includedType) {
    body.includedType = options.includedType;
  }

  if (options.includePureServiceAreaBusinesses) {
    body.includePureServiceAreaBusinesses = true;
  }

  if (options.locationBias) {
    body.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.lat,
          longitude: options.locationBias.lon,
        },
        radius: options.locationBias.radiusMeters,
      },
    };
  }

  const response = await fetch(GOOGLE_PLACES_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": options.apiKey,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errJson = (await response.json()) as { error?: { message?: string } };
      detail = errJson.error?.message ? `: ${errJson.error.message}` : "";
    } catch {
      // ignore body parse errors
    }
    throw new Error(`Google Places search failed (${response.status})${detail}`);
  }

  const json = (await response.json()) as GoogleTextSearchResponse;
  return json.places || [];
}

/**
 * Primary live Finder source when GOOGLE_PLACES_API_KEY is set.
 * Geocodes city for map center / location bias; maps Places → Lead.
 */
export async function searchGooglePlacesIndustryLeads(
  city: string,
  industryId: string,
  radiusKm: number,
  apiKey: string,
): Promise<{
  cityLabel: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  leads: Lead[];
}> {
  const geo = await geocodeCity(city);
  const radiusMeters = Math.min(
    MAX_RADIUS_METERS,
    Math.max(2000, Math.round(radiusKm * 1000)),
  );
  const textQuery = buildPlacesTextQuery(industryId, city);
  const includedType = getPlacesIncludedType(industryId);

  const places = await fetchPlacesTextSearch({
    apiKey,
    textQuery,
    includedType,
    locationBias: { lat: geo.lat, lon: geo.lon, radiusMeters },
    pageSize: 20,
    includePureServiceAreaBusinesses: true,
  });

  return {
    cityLabel: geo.label,
    lat: geo.lat,
    lon: geo.lon,
    radiusMeters,
    leads: placesToLeads(places, city, industryId),
  };
}
