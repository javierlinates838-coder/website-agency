import { NextResponse } from "next/server";
import { buildDemoLeads } from "@/lib/demo";
import { getIndustry } from "@/lib/industries";
import { buildOverpassQuery, elementsToLeads, fetchOverpass, geocodeCity } from "@/lib/osm";
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
    const industryId = (body.industry || "restaurants").trim();
    const radiusKm = Math.min(25, Math.max(2, Number(body.radiusKm) || 8));
    getIndustry(industryId);

    if (!city) {
      return NextResponse.json({ error: "Add a city to search." }, { status: 400 });
    }

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
      const geo = await geocodeCity(city);
      const query = buildOverpassQuery(geo.lat, geo.lon, radiusKm * 1000, industryId);
      const elements = await fetchOverpass(query);
      const liveLeads = elementsToLeads(elements, city, industryId).sort(compareLeads);

      const usedDemo = liveLeads.length < 4;
      const leads = usedDemo
        ? [...liveLeads, ...buildDemoLeads(city, industryId)].slice(0, 14).sort(compareLeads)
        : liveLeads;

      const payload: SearchResponse = {
        cityLabel: geo.label,
        lat: geo.lat,
        lon: geo.lon,
        radiusMeters: radiusKm * 1000,
        leads,
        liveCount: liveLeads.length,
        usedDemo,
        warning: usedDemo
          ? liveLeads.length === 0
            ? "Live map data returned no named businesses here, so sample leads are included so you can still practice outreach."
            : "Only a few live listings came back. Sample leads were added so the board is usable."
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
        leads: buildDemoLeads(city, industryId).sort(compareLeads),
        liveCount: 0,
        usedDemo: true,
        warning: `${message} Sample leads are shown instead.`,
      };
      return NextResponse.json(payload);
    }
  } catch {
    return NextResponse.json({ error: "Could not run that search." }, { status: 500 });
  }
}
