import { isSocialOnlyWebsite } from "./score";
import type {
  ActiveStatus,
  BuildBrief,
  Contactability,
  DeepQualifyResult,
  Lead,
  OpportunityKind,
  RecommendedAction,
} from "./types";
import { findParkedMatch } from "./verified";

export const FIT_STRONG = 70;
export const NEED_REAL = 55;

const HIGH_FIT_TERMS = [
  "painter",
  "painting",
  "landscaper",
  "landscaping",
  "landscape",
  "lawn care",
  "lawn",
  "roofing",
  "roofer",
  "roof",
  "concrete",
  "masonry",
  "mason",
  "fencing",
  "fence",
  "electrician",
  "electric",
  "plumber",
  "plumbing",
  "hvac",
  "heating",
  "cooling",
  "handyman",
  "general contractor",
  "contractor",
  "builder",
  "construction",
  "flooring",
  "tree service",
  "arborist",
  "junk removal",
  "junk",
  "cleaning",
  "cleaner",
  "janitorial",
  "pressure washing",
  "pressure wash",
  "mobile detailing",
  "detailing",
  "garage door",
  "pool service",
  "pool",
  "gutter",
  "siding",
  "paving",
  "locksmith",
  "pest control",
  "irrigation",
  "septic",
  "drywall",
  "tile",
];

const LOW_FIT_TERMS = [
  "franchise",
  "ecommerce",
  "e-commerce",
  "shopify",
  "amazon",
  "bank",
  "banking",
  "finance",
  "financial",
  "credit union",
  "insurance",
  "hospital",
  "health system",
  "healthcare system",
  "saas",
  "software as a service",
  "hotel",
  "motel",
  "resort",
  "portal",
  "booking engine",
  "order system",
  "marketplace",
];

const INDUSTRY_FIT: Record<string, number> = {
  plumbers: 90,
  contractors: 88,
  auto: 72,
  salons: 58,
  pets: 55,
  restaurants: 48,
  fitness: 48,
  lawyers: 44,
  realestate: 42,
  dentists: 42,
  retail: 40,
  health: 36,
};

const KIND_OPPORTUNITY: Record<OpportunityKind, string> = {
  no_website: "No owned website — local searches have nowhere to convert.",
  social_only: "Social profile only — they do not control a real site.",
  parked: "Domain looks parked or unfinished.",
  outdated: "Current site looks outdated.",
  not_mobile: "Current site is not mobile-ready.",
  insecure: "Current site is not HTTPS.",
  thin: "Current site is thin or broken.",
  refresh: "A site exists but conversion still looks weak.",
  healthy: "Site looks comparatively healthy — weaker website-need angle.",
};

export type WebsiteFitResult = {
  score: number;
  band: "high" | "low" | "mid";
  matched: string[];
};

export type ActionInput = {
  name?: string;
  phone?: string;
  activeStatus: ActiveStatus;
  websiteFit: number;
  opportunityScore: number;
  contactability: Contactability;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function haystackOf(niche: string, industryId?: string): string {
  return `${industryId || ""} ${niche}`.toLowerCase().replace(/[_/]+/g, " ");
}

function hasTerm(haystack: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (term.includes(" ")) return haystack.includes(term);
  return new RegExp(`(?:^|[^a-z0-9])${escaped}`, "i").test(haystack);
}

function matchedTerms(haystack: string, terms: string[]): string[] {
  return terms.filter((term) => hasTerm(haystack, term));
}

/** Transparent niche map: high local trades ~80–95, low-fit systems ~10–35, else mid. */
export function websiteFitFromNiche(niche: string, industryId?: string): WebsiteFitResult {
  const haystack = haystackOf(niche, industryId);
  const high = matchedTerms(haystack, HIGH_FIT_TERMS);
  const low = matchedTerms(haystack, LOW_FIT_TERMS);

  if (low.length && low.length >= high.length) {
    return {
      score: Math.min(35, 10 + low.length * 8),
      band: "low",
      matched: low,
    };
  }
  if (high.length) {
    return {
      score: Math.min(95, 80 + high.length * 4),
      band: "high",
      matched: high,
    };
  }
  if (industryId && INDUSTRY_FIT[industryId] != null) {
    const score = INDUSTRY_FIT[industryId];
    return {
      score,
      band: score >= FIT_STRONG ? "high" : score <= 35 ? "low" : "mid",
      matched: [`industry:${industryId}`],
    };
  }
  return { score: 50, band: "mid", matched: [] };
}

export function hasContactMethod(contactability: Contactability): boolean {
  return Boolean(
    contactability.phone || contactability.email || contactability.contactForm || contactability.social,
  );
}

export function contactabilityLabel(contactability: Contactability): string {
  const parts = [
    contactability.phone ? "Phone" : null,
    contactability.email ? "Email" : null,
    contactability.contactForm ? "Form" : null,
    contactability.social ? "Social" : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "None";
}

export function contactabilityFromLead(lead: Pick<Lead, "phone" | "email" | "website" | "contactMethod">): Contactability {
  const trustworthyPhone = Boolean(lead.phone?.trim()) && lead.contactMethod !== "none";
  return {
    phone: trustworthyPhone,
    email: Boolean(lead.email?.trim()),
    contactForm: false,
    social: Boolean(lead.website && isSocialOnlyWebsite(lead.website)),
  };
}

export function activeStatusFromLead(lead: Pick<Lead, "source" | "websiteStatus">): ActiveStatus {
  if (lead.websiteStatus === "CLOSED") return "inactive";
  if (lead.source === "verified") return "active";
  return "unclear";
}

export function parkedAction(lead: { name: string; phone?: string | null }): RecommendedAction | null {
  const parked = findParkedMatch(lead);
  if (!parked) return null;
  return parked.status === "dnc" ? "DNC" : "HOLD";
}

export function recommendAction(input: ActionInput): RecommendedAction {
  const parked = parkedAction({ name: input.name || "", phone: input.phone });
  if (parked) return parked;
  if (input.activeStatus === "inactive") return "SKIP";

  const contactable = hasContactMethod(input.contactability);
  const strongFit = input.websiteFit >= FIT_STRONG;
  const realNeed = input.opportunityScore >= NEED_REAL;
  const weakFit = input.websiteFit <= 35;

  if (input.activeStatus === "active" && strongFit && realNeed && contactable) return "PURSUE";
  if (weakFit) return "SKIP";
  if (!contactable) return "SKIP";
  return "MAYBE";
}

export function isDemoCandidate(
  result: DeepQualifyResult,
  lead?: { name: string; phone?: string | null },
): boolean {
  if (result.activeStatus !== "active") return false;
  if (result.confidence === "LOW") return false;
  if (result.websiteFit < FIT_STRONG) return false;
  if (result.opportunityScore < NEED_REAL) return false;
  if (!hasContactMethod(result.contactability)) return false;
  if (result.recommendedAction !== "PURSUE") return false;
  if (parkedAction({ name: lead?.name || result.businessName, phone: lead?.phone ?? result.phone })) {
    return false;
  }
  return true;
}

export function opportunitiesFromLead(
  lead: Pick<Lead, "kind" | "issues" | "websiteStatus">,
): string[] {
  const out: string[] = [];
  const fromKind = KIND_OPPORTUNITY[lead.kind];
  if (fromKind) out.push(fromKind);
  for (const issue of lead.issues) {
    if (out.length >= 3) break;
    const text = issue.trim();
    if (!text) continue;
    if (out.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
  }
  return out.slice(0, 3);
}

export function risksFromQualify(result: Pick<
  DeepQualifyResult,
  "activeStatus" | "websiteFit" | "contactability" | "businessQuality" | "recommendedAction"
>, lead?: Pick<Lead, "source" | "name" | "phone">): string[] {
  const risks: string[] = [];
  const parked = parkedAction({ name: lead?.name || "", phone: lead?.phone });
  if (parked) risks.push(`Parked record forces ${parked}. Do not outreach.`);
  if (result.activeStatus === "inactive") risks.push("Marked inactive.");
  if (result.activeStatus === "unclear") risks.push("Active status is unconfirmed.");
  if (result.websiteFit <= 35) risks.push("Low website fit — not a simple local-trade site.");
  if (!hasContactMethod(result.contactability)) risks.push("No realistic contact method on file.");
  if (result.businessQuality === "unknown") {
    risks.push("Business Quality unknown — no reliable evidence supplied.");
  }
  if (lead?.source === "demo") risks.push("Sample lead — do not contact as a real business.");
  return risks;
}

function inferConfidence(lead: Lead): DeepQualifyResult["confidence"] {
  if (lead.confidence) return lead.confidence;
  if (lead.source === "verified") return "MEDIUM";
  if (lead.source === "live" && lead.phone) return "MEDIUM";
  return "LOW";
}

function fitInference(fit: WebsiteFitResult): string {
  if (fit.matched.length === 0) {
    return `Website Fit ${fit.score} is a mid default — no high/low niche keywords matched.`;
  }
  if (fit.band === "high") {
    return `Website Fit ${fit.score} from high-fit niche terms: ${fit.matched.join(", ")}.`;
  }
  if (fit.band === "low") {
    return `Website Fit ${fit.score} from low-fit niche terms: ${fit.matched.join(", ")}.`;
  }
  return `Website Fit ${fit.score} from ${fit.matched.join(", ")}.`;
}

export function prefillDeepQualify(lead: Lead): DeepQualifyResult {
  if (lead.deepQualify) return { ...lead.deepQualify, contactability: { ...lead.deepQualify.contactability } };

  const niche = lead.industryLabel || lead.industry || "";
  const fit = websiteFitFromNiche(niche, lead.industry);
  const contactability = contactabilityFromLead(lead);
  const activeStatus = activeStatusFromLead(lead);
  const opportunityScore = clampScore(lead.score);
  const websiteFit = clampScore(fit.score);
  const facts = [
    `Name: ${lead.name}`,
    lead.city ? `City: ${lead.city}` : null,
    niche ? `Industry: ${niche}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.website ? `Website: ${lead.website}` : null,
  ].filter((item): item is string => Boolean(item));

  const draft: DeepQualifyResult = {
    businessName: lead.name,
    niche,
    activeStatus,
    officialWebsite: lead.website,
    phone: lead.phone,
    contactability,
    opportunityScore,
    websiteFit,
    businessQuality: "unknown",
    confidence: inferConfidence(lead),
    websiteStatus: lead.websiteStatus,
    opportunities: opportunitiesFromLead(lead),
    risks: [],
    recommendedAction: "MAYBE",
    facts,
    inferences: [
      fitInference(fit),
      `Opportunity Score ${opportunityScore} prefilled from the existing lead score.`,
      "Business Quality left unknown — do not invent a score from weak proxies.",
      lead.source === "verified"
        ? "Active status prefilled as active because this is a verified desk lead."
        : `Active status prefilled as ${activeStatus} — confirm before treating as a live business.`,
    ],
  };
  draft.recommendedAction = recommendAction({
    name: draft.businessName,
    phone: draft.phone,
    activeStatus: draft.activeStatus,
    websiteFit: draft.websiteFit,
    opportunityScore: draft.opportunityScore,
    contactability: draft.contactability,
  });
  draft.risks = risksFromQualify(draft, lead);
  return draft;
}

export function buildBrief(result: DeepQualifyResult, lead?: Pick<Lead, "city" | "kind" | "websiteStatus" | "issues">): BuildBrief {
  const niche = result.niche.trim() || "local service business";
  const city = lead?.city?.trim();
  const siteNote =
    result.websiteStatus === "NONE" || !result.officialWebsite
      ? "No official website on file — greenfield brochure site, not a rip of an existing one."
      : result.websiteStatus === "OUTDATED" || result.websiteStatus === "WEAK"
        ? "Replace the weak/outdated site with a clearer mobile-first brochure."
        : "Improve only what the current site evidence supports. Do not invent extra product surface.";

  const cta = result.contactability.phone && result.phone
    ? `Call ${result.phone}`
    : result.contactability.email
      ? "Email from the contact page"
      : result.contactability.contactForm
        ? "Submit the contact form"
        : result.contactability.social
          ? "Message on the known social profile"
          : "Contact — method not yet verified";

  return {
    businessType: city ? `${niche} in ${city}` : niche,
    goals: [
      "Make the business easy to find and contact on mobile.",
      "Show what they do using only verified inputs — do not invent offerings.",
      "Give one clear next step (call, email, or form).",
    ],
    recommendedPages: ["Home", "Services", "About", "Contact"],
    homepageStructure: [
      "Who they are and the known category in one sentence",
      "Primary CTA",
      "Services list copied from materials they already use",
      city ? `Service area: ${city}` : "Service area only if already known",
      "Contact details that are on this lead",
    ],
    services: [
      `Known category only: ${niche}`,
      "Do not invent a service menu, packages, or prices.",
    ],
    trustSignals: [
      "Do not invent awards, years in business, testimonials, certifications, or prices.",
      "Use license numbers, photos, or reviews only if they are already on this lead or supplied by the user.",
    ],
    cta,
    visualDirection:
      "Clean, mobile-first, photo-led local business site. Avoid stock-heavy corporate or SaaS styling.",
    improvementsVsCurrent: [siteNote, ...(lead?.issues || []).slice(0, 2)],
    featuresNotNeeded: [
      "Ecommerce checkout",
      "Customer portals or account dashboards",
      "SaaS-style app UI",
      "Advanced booking/order systems unless already in evidence",
      "Multi-location CMS or franchise locator",
    ],
  };
}

export function formatBuildBrief(brief: BuildBrief, businessName: string): string {
  const list = (title: string, items: string[]) => `## ${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
  return [
    `# Build brief: ${businessName}`,
    `**Type:** ${brief.businessType}`,
    `**CTA:** ${brief.cta}`,
    `**Visual:** ${brief.visualDirection}`,
    list("Goals", brief.goals),
    list("Pages", brief.recommendedPages),
    list("Homepage structure", brief.homepageStructure),
    list("Services", brief.services),
    list("Trust signals", brief.trustSignals),
    list("Improvements vs current site", brief.improvementsVsCurrent),
    list("Do not build", brief.featuresNotNeeded),
  ].join("\n\n");
}

function uniqueLines(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function finalizeQualify(
  draft: DeepQualifyResult,
  lead: Pick<Lead, "name" | "phone" | "source" | "city" | "kind" | "websiteStatus" | "issues">,
  actionOverridden: boolean,
): { result: DeepQualifyResult; demoCandidate: boolean } {
  const parked = parkedAction({ name: draft.businessName || lead.name, phone: draft.phone ?? lead.phone });
  const recommendedAction = parked || (actionOverridden ? draft.recommendedAction : recommendAction({
    name: draft.businessName,
    phone: draft.phone,
    activeStatus: draft.activeStatus,
    websiteFit: clampScore(draft.websiteFit),
    opportunityScore: clampScore(draft.opportunityScore),
    contactability: draft.contactability,
  }));

  const result: DeepQualifyResult = {
    ...draft,
    opportunityScore: clampScore(draft.opportunityScore),
    websiteFit: clampScore(draft.websiteFit),
    businessQuality:
      draft.businessQuality === "unknown" ||
      draft.businessQuality == null ||
      (typeof draft.businessQuality === "number" && !Number.isFinite(draft.businessQuality))
        ? "unknown"
        : clampScore(Number(draft.businessQuality)),
    opportunities: draft.opportunities.map((item) => item.trim()).filter(Boolean).slice(0, 3),
    sources: (draft.sources || []).map((item) => item.trim()).filter(Boolean),
    recommendedAction,
    risks: uniqueLines([
      ...draft.risks.map((item) => item.trim()).filter(Boolean),
      ...risksFromQualify({ ...draft, recommendedAction }, lead),
    ]),
    qualifiedAt: new Date().toISOString(),
  };

  const demoCandidate = isDemoCandidate(result, lead);
  if (demoCandidate && !result.buildBrief) {
    result.buildBrief = buildBrief(result, lead);
  }
  if (!demoCandidate) {
    result.buildBrief = undefined;
  }
  return { result, demoCandidate };
}
