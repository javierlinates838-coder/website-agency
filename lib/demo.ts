import { getIndustry, type Industry } from "./industries";
import { classifyOpportunity } from "./score";
import type { Lead } from "./types";

const STREETS = [
  "Harbor Ave",
  "Cedar St",
  "Third Street",
  "Maple Court",
  "River Rd",
  "Pine Avenue",
  "North Line",
  "Oak Street",
];

const WEBSITE_PATTERNS: Array<"none" | "social" | "dated" | "ok"> = [
  "none",
  "social",
  "dated",
  "none",
  "ok",
  "dated",
  "social",
  "none",
];

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function buildDemoLeads(city: string, industryId: string): Lead[] {
  const industry: Industry = getIndustry(industryId);
  const citySlug = slug(city || "your-city");

  return industry.sampleNames.map((name, index) => {
    const pattern = WEBSITE_PATTERNS[index % WEBSITE_PATTERNS.length];
    const street = STREETS[index % STREETS.length];
    const phone = `555-${String(200 + index * 13).padStart(3, "0")}-${String(1000 + index * 37).slice(-4)}`;
    let website: string | undefined;
    if (pattern === "social") website = `https://facebook.com/${slug(name)}`;
    if (pattern === "dated") website = `http://${slug(name)}.example`;
    if (pattern === "ok") website = `https://${slug(name)}.example`;

    const classified =
      pattern === "dated"
        ? classifyOpportunity({
            website,
            html: datedHtml(name),
            finalUrl: website,
          })
        : pattern === "ok"
          ? classifyOpportunity({
              website,
              html: healthyHtml(name),
              finalUrl: website,
            })
          : classifyOpportunity({ website });

    return {
      id: `demo:${industry.id}:${citySlug}:${index}`,
      name,
      industry: industry.id,
      industryLabel: industry.label,
      city,
      address: `${100 + index * 12} ${street}, ${city}`,
      phone,
      website,
      score: classified.score,
      kind: classified.kind,
      issues: classified.issues,
      source: "demo",
      analyzed: true,
    };
  });
}

function datedHtml(name: string): string {
  return `<html><head><title>${name}</title></head><body><p>Welcome</p><p>Copyright 2016 ${name}</p></body></html>`;
}

function healthyHtml(name: string): string {
  return `<!doctype html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${name} — Book an appointment in town</title>
    <meta name="description" content="${name} serves local customers with fast booking and clear hours.">
  </head><body>
    <h1>${name}</h1>
    <p>Visit us this week. Call or book online.</p>
    <form><input name="email"><button>Contact</button></form>
    <a href="tel:5550100">Call</a>
    <p>Copyright 2026 ${name}</p>
  </body></html>`;
}
