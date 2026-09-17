import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPlacesTextQuery,
  extractPlaceId,
  fetchPlacesTextSearch,
  getGooglePlacesApiKey,
  getPlacesIncludedType,
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_PLACES_SEARCH_URL,
  hasGooglePlacesApiKey,
  isUsableGooglePlace,
  placesToLeads,
  searchGooglePlacesIndustryLeads,
  type GooglePlace,
} from "../lib/googlePlaces";

describe("googlePlaces helpers", () => {
  it("builds text queries like painters in Bakersfield, CA", () => {
    expect(buildPlacesTextQuery("painters", "Bakersfield, CA")).toBe(
      "painters in Bakersfield, CA",
    );
    expect(buildPlacesTextQuery("plumbers", "Bakersfield, CA")).toBe(
      "plumbers in Bakersfield, CA",
    );
    expect(buildPlacesTextQuery("electricians", "Bakersfield, CA")).toBe(
      "electricians in Bakersfield, CA",
    );
  });

  it("maps useful included types for primary trades", () => {
    expect(getPlacesIncludedType("painters")).toBe("painter");
    expect(getPlacesIncludedType("plumbers")).toBe("plumber");
    expect(getPlacesIncludedType("electricians")).toBe("electrician");
  });

  it("reads API key presence without exposing the value", () => {
    expect(hasGooglePlacesApiKey({} as NodeJS.ProcessEnv)).toBe(false);
    expect(getGooglePlacesApiKey({} as NodeJS.ProcessEnv)).toBeUndefined();
    expect(
      hasGooglePlacesApiKey({ GOOGLE_PLACES_API_KEY: "  test-key  " } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      getGooglePlacesApiKey({ GOOGLE_PLACES_API_KEY: "  test-key  " } as NodeJS.ProcessEnv),
    ).toBe("test-key");
  });

  it("extracts place ids and skips permanently closed / nameless", () => {
    expect(extractPlaceId({ id: "places/ChIJ123" })).toBe("ChIJ123");
    expect(extractPlaceId({ id: "ChIJ123" })).toBe("ChIJ123");
    expect(
      isUsableGooglePlace({
        id: "ChIJ1",
        displayName: { text: "Closed Co" },
        businessStatus: "CLOSED_PERMANENTLY",
      }),
    ).toBe(false);
    expect(
      isUsableGooglePlace({
        id: "ChIJ2",
        displayName: { text: "  " },
        businessStatus: "OPERATIONAL",
      }),
    ).toBe(false);
    expect(
      isUsableGooglePlace({
        id: "ChIJ3",
        displayName: { text: "Northline Painting" },
        businessStatus: "OPERATIONAL",
      }),
    ).toBe(true);
  });

  it("maps places to leads, dedupes by id, never invents phone/website", () => {
    const places: GooglePlace[] = [
      {
        id: "places/ChIJ_A",
        displayName: { text: "Northline Painting" },
        formattedAddress: "100 Main St, Bakersfield, CA",
        location: { latitude: 35.37, longitude: -119.01 },
        nationalPhoneNumber: "(661) 555-0100",
        websiteUri: "https://northline.example",
        businessStatus: "OPERATIONAL",
        types: ["painter"],
        rating: 4.5,
        userRatingCount: 12,
      },
      {
        id: "ChIJ_A",
        displayName: { text: "Northline Painting Duplicate" },
        businessStatus: "OPERATIONAL",
      },
      {
        id: "ChIJ_B",
        displayName: { text: "Summit Finish Painting" },
        businessStatus: "OPERATIONAL",
      },
      {
        id: "ChIJ_C",
        displayName: { text: "Gone Paint Co" },
        businessStatus: "CLOSED_PERMANENTLY",
      },
      {
        id: "ChIJ_D",
        displayName: { text: "" },
        businessStatus: "OPERATIONAL",
      },
    ];

    const leads = placesToLeads(places, "Bakersfield, CA", "painters");
    expect(leads).toHaveLength(2);
    expect(leads[0]).toMatchObject({
      id: "google:ChIJ_A",
      name: "Northline Painting",
      phone: "(661) 555-0100",
      website: "https://northline.example",
      source: "live",
      industry: "painters",
    });
    expect(leads[1]).toMatchObject({
      id: "google:ChIJ_B",
      name: "Summit Finish Painting",
      source: "live",
    });
    expect(leads[1].phone).toBeUndefined();
    expect(leads[1].website).toBeUndefined();
  });
});

describe("fetchPlacesTextSearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs with field mask and api key headers (mock fetch)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          places: [
            {
              id: "ChIJ_X",
              displayName: { text: "Harbor Pipe Co." },
              businessStatus: "OPERATIONAL",
              nationalPhoneNumber: "661-555-9999",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const places = await fetchPlacesTextSearch({
      apiKey: "unit-test-key-not-real",
      textQuery: "plumbers in Bakersfield, CA",
      includedType: "plumber",
      locationBias: { lat: 35.37, lon: -119.01, radiusMeters: 8000 },
      pageSize: 10,
      includePureServiceAreaBusinesses: true,
    });

    expect(places).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOGLE_PLACES_SEARCH_URL);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("unit-test-key-not-real");
    expect(headers["X-Goog-FieldMask"]).toBe(GOOGLE_PLACES_FIELD_MASK);
    expect(GOOGLE_PLACES_FIELD_MASK).toContain("places.displayName");
    expect(GOOGLE_PLACES_FIELD_MASK).toContain("places.id");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.textQuery).toBe("plumbers in Bakersfield, CA");
    expect(body.includedType).toBe("plumber");
    expect(body.includePureServiceAreaBusinesses).toBe(true);
    expect(body.locationBias).toEqual({
      circle: {
        center: { latitude: 35.37, longitude: -119.01 },
        radius: 8000,
      },
    });
  });

  it("throws a safe error on non-OK without leaking secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "REQUEST_DENIED" } }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      fetchPlacesTextSearch({
        apiKey: "unit-test-key-not-real",
        textQuery: "painters in Bakersfield, CA",
      }),
    ).rejects.toThrow(/Google Places search failed \(403\)/);
  });
});

describe("searchGooglePlacesIndustryLeads", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("geocodes then text-searches and returns live google leads", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("nominatim")) {
        return new Response(
          JSON.stringify([
            { display_name: "Bakersfield, Kern County, California, United States", lat: "35.37", lon: "-119.01" },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("places.googleapis.com")) {
        return new Response(
          JSON.stringify({
            places: [
              {
                id: "ChIJ_P1",
                displayName: { text: "Ridge Color Co." },
                formattedAddress: "Bakersfield, CA",
                location: { latitude: 35.38, longitude: -119.02 },
                businessStatus: "OPERATIONAL",
              },
              {
                id: "ChIJ_P2",
                displayName: { text: "True Tone Painters" },
                businessStatus: "OPERATIONAL",
                websiteUri: "facebook.com/truetone",
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesIndustryLeads(
      "Bakersfield, CA",
      "painters",
      8,
      "unit-test-key-not-real",
    );

    expect(result.lat).toBeCloseTo(35.37);
    expect(result.lon).toBeCloseTo(-119.01);
    expect(result.radiusMeters).toBe(8000);
    expect(result.leads).toHaveLength(2);
    expect(result.leads.every((l) => l.source === "live")).toBe(true);
    expect(result.leads.every((l) => l.id.startsWith("google:"))).toBe(true);
    expect(result.leads.map((l) => l.name).sort()).toEqual([
      "Ridge Color Co.",
      "True Tone Painters",
    ]);
  });
});
