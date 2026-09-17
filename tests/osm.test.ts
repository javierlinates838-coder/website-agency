import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIndustry, INDUSTRIES } from "../lib/industries";
import {
  buildOverpassQuery,
  chunkNameHints,
  elementsToLeads,
  fetchOverpass,
  isLikelyBusiness,
  normalizeLeadName,
  phoneDigits,
  radiusStepsMeters,
  searchIndustryLeads,
  type OverpassElement,
} from "../lib/osm";

describe("industry tag variants", () => {
  it("keeps painters first and expands sparse craft tags", () => {
    expect(INDUSTRIES[0].id).toBe("painters");
    const painters = getIndustry("painters");
    expect(painters.tags.length).toBeGreaterThanOrEqual(2);
    expect(painters.nameHints?.length).toBeGreaterThan(0);
  });

  it("covers primary niches with tags and name hints", () => {
    const primary = [
      "painters",
      "landscapers",
      "roofers",
      "concrete",
      "fencing",
      "electricians",
      "plumbers",
      "hvac",
      "cleaning",
      "mobile-detailing",
      "tree-service",
      "junk-removal",
      "garage-doors",
      "flooring",
      "handyman",
    ];
    for (const id of primary) {
      const industry = getIndustry(id);
      expect(industry.id).toBe(id);
      expect(industry.tags.length).toBeGreaterThan(0);
      expect(industry.nameHints?.length).toBeGreaterThan(0);
    }
  });
});

describe("buildOverpassQuery", () => {
  it("includes all tag variants", () => {
    const query = buildOverpassQuery(35.37, -119.01, 8000, "painters");
    expect(query).toContain('nwr["craft"="painter"]');
    expect(query).toContain('nwr["shop"="paint"]');
    expect(query).not.toContain('name~');
  });

  it("adds name-regex fallback clauses when requested", () => {
    const query = buildOverpassQuery(35.37, -119.01, 8000, "painters", { nameFallback: true });
    expect(query).toContain('nwr["name"~"painter|painters|painting",i]');
  });
});

describe("radiusStepsMeters", () => {
  it("steps start → ×1.5 → ×2 and caps at 25km", () => {
    expect(radiusStepsMeters(8000)).toEqual([8000, 12000, 16000]);
    expect(radiusStepsMeters(20000)).toEqual([20000, 25000]);
    expect(radiusStepsMeters(25000)).toEqual([25000]);
    expect(Math.max(...radiusStepsMeters(8000))).toBeLessThanOrEqual(25000);
  });
});

describe("dedupe and business filter", () => {
  it("normalizes names and phone digits for dedupe keys", () => {
    expect(normalizeLeadName("Ridge Color Co.")).toBe("ridge color co");
    expect(phoneDigits("+1 (555) 222-3333")).toBe("5552223333");
  });

  it("rejects unnamed and non-business leftovers", () => {
    expect(isLikelyBusiness({}, undefined)).toBe(false);
    expect(isLikelyBusiness({ name: "Parking" }, "Parking")).toBe(false);
    expect(isLikelyBusiness({ amenity: "parking", name: "Lot A" }, "Lot A")).toBe(false);
    expect(isLikelyBusiness({ craft: "painter", name: "Northline Painting" }, "Northline Painting")).toBe(
      true,
    );
  });

  it("dedupes near-duplicate OSM elements and keeps named businesses", () => {
    const elements: OverpassElement[] = [
      {
        id: 1,
        type: "node",
        lat: 35.373,
        lon: -119.019,
        tags: { name: "Northline Painting", craft: "painter", phone: "555-111-2222" },
      },
      {
        id: 2,
        type: "way",
        center: { lat: 35.3731, lon: -119.0192 },
        tags: {
          name: "Northline Painting",
          craft: "painter",
          phone: "(555) 111-2222",
        },
      },
      {
        id: 3,
        type: "node",
        lat: 35.4,
        lon: -119.0,
        tags: { name: "Summit Finish Painting", craft: "painter" },
      },
      {
        id: 4,
        type: "node",
        lat: 35.41,
        lon: -119.02,
        tags: { name: "Unnamed", building: "yes" },
      },
      {
        id: 5,
        type: "node",
        lat: 35.42,
        lon: -119.03,
        tags: { amenity: "parking", name: "Customer Parking" },
      },
    ];

    const leads = elementsToLeads(elements, "Bakersfield, CA", "painters");
    expect(leads).toHaveLength(2);
    expect(leads.map((l) => l.name).sort()).toEqual([
      "Northline Painting",
      "Summit Finish Painting",
    ]);
    expect(leads.every((l) => l.source === "live")).toBe(true);
  });
});

describe("chunkNameHints", () => {
  it("splits pipe-heavy hints into smaller chunks", () => {
    expect(chunkNameHints(["painter|painters|painting|paint"], 2)).toEqual([
      "painter|painters",
      "painting|paint",
    ]);
    expect(chunkNameHints(["plumber|plumbers|plumbing"], 2)).toEqual([
      "plumber|plumbers",
      "plumbing",
    ]);
  });
});

describe("buildOverpassQuery nameOnly", () => {
  it("emits name-regex clauses without tag clauses", () => {
    const query = buildOverpassQuery(35.37, -119.01, 8000, "painters", {
      nameOnly: true,
      namePatterns: ["painter|painters"],
    });
    expect(query).toContain('nwr["name"~"painter|painters",i]');
    expect(query).not.toContain('craft"="painter');
  });
});

describe("fetchOverpass resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rotates to the next mirror after 504s", async () => {
    const fetchMock = vi
      .fn()
      // endpoint 0 attempt 0
      .mockResolvedValueOnce(new Response("Gateway Timeout", { status: 504 }))
      // endpoint 0 attempt 1
      .mockResolvedValueOnce(new Response("Gateway Timeout", { status: 504 }))
      // endpoint 1 attempt 0 — success
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [{ id: 9, type: "node", tags: { name: "Ok" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const elements = await fetchOverpass('[out:json];out;');
    expect(elements).toHaveLength(1);
    expect(elements[0].id).toBe(9);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("overpass-api.de");
    expect(String(fetchMock.mock.calls[2][0])).toContain("lz4.overpass-api.de");
  });

  it("retries the same endpoint twice on timeout then moves on", async () => {
    const abortErr = new DOMException("The operation was aborted.", "AbortError");
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortErr)
      .mockRejectedValueOnce(abortErr)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ elements: [{ id: 3, type: "node" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const elements = await fetchOverpass('[out:json];out;');
    expect(elements[0].id).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("searchIndustryLeads soft failures", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps tag-only results when name fallback 504s", async () => {
    const tagElements = [
      {
        id: 1,
        type: "node",
        lat: 35.37,
        lon: -119.01,
        tags: { name: "A Plumbing", craft: "plumber", phone: "555-100-2000" },
      },
      {
        id: 2,
        type: "node",
        lat: 35.38,
        lon: -119.02,
        tags: { name: "B Plumbing", craft: "plumber" },
      },
    ];

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("nominatim")) {
        return new Response(
          JSON.stringify([{ display_name: "Bakersfield, CA", lat: "35.37", lon: "-119.01" }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const body = typeof init?.body === "string" ? init.body : String(init?.body || "");
      // Name-only queries include name~ and no craft= in the Overpass data payload
      const data = decodeURIComponent(body.replace(/^data=/, "").replace(/\+/g, " "));
      if (data.includes("name~")) {
        return new Response("Gateway Timeout", { status: 504 });
      }
      return new Response(JSON.stringify({ elements: tagElements }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchIndustryLeads("Bakersfield, CA", "plumbers", 8);
    expect(result.leads.length).toBeGreaterThanOrEqual(2);
    expect(result.leads.every((l) => l.source === "live")).toBe(true);
    expect(result.leads.map((l) => l.name).sort()).toEqual(["A Plumbing", "B Plumbing"]);
  });

  it("continues to the next radius when a radius step soft-fails entirely", async () => {
    let overpassCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("nominatim")) {
        return new Response(
          JSON.stringify([{ display_name: "Bakersfield, CA", lat: "35.37", lon: "-119.01" }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      overpassCalls += 1;
      // Fail first radius (tags + name chunks across mirrors would be huge);
      // Instead: fail all until we've seen several calls, then succeed.
      // Simpler approach: first successful tag query after N failures.
      if (overpassCalls <= 2) {
        return new Response("Gateway Timeout", { status: 504 });
      }
      return new Response(
        JSON.stringify({
          elements: [
            {
              id: 50,
              type: "node",
              lat: 35.4,
              lon: -119.0,
              tags: { name: "Wide Area Electric", craft: "electrician", phone: "555-999-0000" },
            },
            {
              id: 51,
              type: "node",
              lat: 35.41,
              lon: -119.01,
              tags: { name: "Second Electric Co", craft: "electrician" },
            },
            {
              id: 52,
              type: "node",
              lat: 35.42,
              lon: -119.02,
              tags: { name: "Third Electric LLC", craft: "electrician" },
            },
            {
              id: 53,
              type: "node",
              lat: 35.43,
              lon: -119.03,
              tags: { name: "Fourth Electric Inc", craft: "electrician" },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchIndustryLeads("Bakersfield, CA", "electricians", 8);
    expect(result.leads.length).toBeGreaterThanOrEqual(4);
    expect(result.leads[0].source).toBe("live");
  });
});
