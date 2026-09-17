import { describe, expect, it } from "vitest";
import { getIndustry, INDUSTRIES } from "../lib/industries";
import {
  buildOverpassQuery,
  elementsToLeads,
  isLikelyBusiness,
  normalizeLeadName,
  phoneDigits,
  radiusStepsMeters,
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
