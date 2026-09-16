import { NextResponse } from "next/server";
import { classifyOpportunity, normalizeWebsite } from "@/lib/score";
import { assertPublicHttpUrl } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; BeaconLeadFinder/1.0; +https://github.com/javierlinates838-coder/website-agency)",
  Accept: "text/html,application/xhtml+xml",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { website?: string };
    const website = normalizeWebsite(body.website || "");
    if (!website) {
      return NextResponse.json(classifyOpportunity({ website: "" }));
    }

    try {
      assertPublicHttpUrl(website);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid URL";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
      const response = await fetch(website, {
        headers: FETCH_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      const raw = await response.text();
      const html = raw.slice(0, 450_000);
      const result = classifyOpportunity({
        website,
        html,
        finalUrl: response.url || website,
        status: response.status,
      });
      return NextResponse.json(result);
    } catch (error) {
      const fetchError = error instanceof Error ? error.message : "fetch failed";
      return NextResponse.json(
        classifyOpportunity({
          website,
          fetchError: fetchError.slice(0, 120),
        }),
      );
    }
  } catch {
    return NextResponse.json({ error: "Could not analyze that site." }, { status: 500 });
  }
}
