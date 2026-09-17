import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/osm", () => ({
  searchIndustryLeads: vi.fn(),
}));

vi.mock("@/lib/demo", () => ({
  buildDemoLeads: vi.fn(() => [
    {
      id: "demo:painters:test:0",
      name: "Sample Painter Co.",
      industry: "painters",
      industryLabel: "Painters",
      city: "Bakersfield, CA",
      address: "1 Main, Bakersfield, CA",
      score: 95,
      kind: "no_website",
      issues: ["No website"],
      source: "demo",
      analyzed: true,
    },
  ]),
}));

import { buildDemoLeads } from "@/lib/demo";
import { searchIndustryLeads } from "@/lib/osm";
import { POST } from "../app/api/search/route";

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns demo leads only when demo:true", async () => {
    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ city: "Bakersfield, CA", industry: "painters", demo: true }),
      }),
    );
    const json = await response.json();
    expect(json.usedDemo).toBe(true);
    expect(json.leads.every((l: { source: string }) => l.source === "demo")).toBe(true);
    expect(searchIndustryLeads).not.toHaveBeenCalled();
    expect(buildDemoLeads).toHaveBeenCalled();
  });

  it("never mixes demo into live responses, even when live is empty", async () => {
    vi.mocked(searchIndustryLeads).mockResolvedValue({
      cityLabel: "Bakersfield, California, United States",
      lat: 35.37,
      lon: -119.01,
      radiusMeters: 16000,
      leads: [],
    });

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ city: "Bakersfield, CA", industry: "painters", demo: false }),
      }),
    );
    const json = await response.json();
    expect(json.usedDemo).toBe(false);
    expect(json.liveCount).toBe(0);
    expect(json.leads).toEqual([]);
    expect(json.warning).toMatch(/no named businesses/i);
    expect(buildDemoLeads).not.toHaveBeenCalled();
  });

  it("returns live leads without demo padding when few results", async () => {
    vi.mocked(searchIndustryLeads).mockResolvedValue({
      cityLabel: "Bakersfield, California, United States",
      lat: 35.37,
      lon: -119.01,
      radiusMeters: 12000,
      leads: [
        {
          id: "osm:node:1",
          name: "Northline Painting",
          industry: "painters",
          industryLabel: "Painters",
          city: "Bakersfield, CA",
          address: "Bakersfield, CA",
          score: 92,
          kind: "no_website",
          issues: ["No website listed"],
          source: "live",
          analyzed: true,
        },
      ],
    });

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ city: "Bakersfield, CA", industry: "painters" }),
      }),
    );
    const json = await response.json();
    expect(json.usedDemo).toBe(false);
    expect(json.liveCount).toBe(1);
    expect(json.leads).toHaveLength(1);
    expect(json.leads[0].source).toBe("live");
    expect(json.warning).toMatch(/few live listings/i);
    expect(buildDemoLeads).not.toHaveBeenCalled();
  });

  it("defaults missing industry to painters, not restaurants", async () => {
    vi.mocked(searchIndustryLeads).mockResolvedValue({
      cityLabel: "Austin",
      lat: 30,
      lon: -97,
      radiusMeters: 8000,
      leads: [],
    });

    await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ city: "Austin, TX" }),
      }),
    );

    expect(searchIndustryLeads).toHaveBeenCalledWith("Austin, TX", "painters", 8);
  });

  it("on hard failure returns empty live + warning, not demo names", async () => {
    vi.mocked(searchIndustryLeads).mockRejectedValue(new Error("Overpass 504"));

    const response = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        body: JSON.stringify({ city: "Bakersfield, CA", industry: "painters" }),
      }),
    );
    const json = await response.json();
    expect(json.usedDemo).toBe(false);
    expect(json.leads).toEqual([]);
    expect(json.warning).toMatch(/Overpass 504/);
    expect(json.warning).toMatch(/demo mode/i);
    expect(buildDemoLeads).not.toHaveBeenCalled();
  });
});
