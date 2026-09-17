import { NextResponse } from "next/server";
import { buildDemoLeads } from "@/lib/demo";
import { getIndustry } from "@/lib/industries";
import { searchIndustryLeads } from "@/lib/osm";
import { compareLeads } from "@/lib/score";
import type { SearchResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      city?: string;
      industry?: string;
      radiusKm?: number;
      demo?: boolean;
    };
    const city = (body.city || "").trim();
    const industryId = (body.industry || "painters").trim();
    const radiusKm = Math.min(25, Math.max(2, Number(body.radiusKm) || 8));
    getIndustry(industryId);

    if (!city) {
      return NextResponse.json({ error: "Add a city to search." }, { status: 400 });
    }

    // Samples only when explicitly requested — never mixed into live.
    if (body.demo) {
      const payload: SearchResponse = {
        cityLabel: city,
        lat: 0,
        lon: 0,
        radiusMeters: radiusKm * 1000,
        leads: buildDemoLeads(city, industryId).sort(compareLeads),
        liveCount: 0,
        usedDemo: true,
        warning: "Sample leads so you can learn the workflow. Turn off demo mode for live map data.",
      };
      return NextResponse.json(payload);
    }

    try {
      const result = await searchIndustryLeads(city, industryId, radiusKm);
      const liveLeads = result.leads.sort(compareLeads);

      const payload: SearchResponse = {
        cityLabel: result.cityLabel,
        lat: result.lat,
        lon: result.lon,
        radiusMeters: result.radiusMeters,
        leads: liveLeads,
        liveCount: liveLeads.length,
        usedDemo: false,
        warning:
          liveLeads.length === 0
            ? "Live map data returned no named businesses in this area. Widen the radius, try a nearby city, or turn on demo mode for sample leads."
            : liveLeads.length < 4
              ? "Only a few live listings came back from OpenStreetMap. Try a wider radius or a denser nearby city — demo mode is separate and was not mixed in."
              : undefined,
      };
      return NextResponse.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed";
      const payload: SearchResponse = {
        cityLabel: city,
        lat: 0,
        lon: 0,
        radiusMeters: radiusKm * 1000,
        leads: [],
        liveCount: 0,
        usedDemo: false,
        warning: `${message} No live results. Turn on demo mode if you want sample leads to practice with.`,
      };
      return NextResponse.json(payload);
    }
  } catch {
    return NextResponse.json({ error: "Could not run that search." }, { status: 500 });
  }
}
