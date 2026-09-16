import { describe, expect, it } from "vitest";
import {
  buildBrief,
  contactabilityFromLead,
  finalizeQualify,
  formatBuildBrief,
  isDemoCandidate,
  parkedAction,
  prefillDeepQualify,
  recommendAction,
  websiteFitFromNiche,
} from "../lib/qualify";
import type { DeepQualifyResult, Lead } from "../lib/types";

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "live:roof",
    name: "Ridge Line Roofing",
    industry: "contractors",
    industryLabel: "Roofing",
    city: "Bakersfield, CA",
    address: "100 Main",
    phone: "661-555-0100",
    score: 82,
    kind: "no_website",
    issues: ["No website found"],
    source: "live",
    analyzed: true,
    ...over,
  };
}

function qualify(over: Partial<DeepQualifyResult> = {}): DeepQualifyResult {
  return {
    businessName: "Ridge Line Roofing",
    niche: "Roofing",
    activeStatus: "active",
    phone: "661-555-0100",
    contactability: { phone: true, email: false, contactForm: false, social: false },
    opportunityScore: 82,
    websiteFit: 88,
    businessQuality: "unknown",
    confidence: "MEDIUM",
    websiteStatus: "NONE",
    opportunities: ["No owned website — local searches have nowhere to convert."],
    risks: [],
    recommendedAction: "PURSUE",
    ...over,
  };
}

describe("websiteFitFromNiche", () => {
  it("scores high-fit local trades toward 80–95", () => {
    const roofing = websiteFitFromNiche("Roofing", "contractors");
    const hvac = websiteFitFromNiche("Plumbers & HVAC", "plumbers");
    const painter = websiteFitFromNiche("house painter");
    expect(roofing.band).toBe("high");
    expect(roofing.score).toBeGreaterThanOrEqual(80);
    expect(roofing.score).toBeLessThanOrEqual(95);
    expect(hvac.score).toBeGreaterThanOrEqual(80);
    expect(painter.score).toBeGreaterThanOrEqual(80);
    expect(painter.matched.join(" ")).toMatch(/paint/i);
  });

  it("scores low-fit systems toward 10–35", () => {
    const bank = websiteFitFromNiche("regional bank / finance");
    const saas = websiteFitFromNiche("B2B SaaS portal");
    const hotel = websiteFitFromNiche("hotel booking engine");
    const ecommerce = websiteFitFromNiche("ecommerce shopify store");
    for (const result of [bank, saas, hotel, ecommerce]) {
      expect(result.band).toBe("low");
      expect(result.score).toBeGreaterThanOrEqual(10);
      expect(result.score).toBeLessThanOrEqual(35);
    }
  });

  it("does not treat dentists or generic retail as high-fit trades", () => {
    expect(websiteFitFromNiche("Dentists", "dentists").band).not.toBe("high");
    expect(websiteFitFromNiche("Local shops", "retail").score).toBeLessThan(70);
  });
});

describe("recommendAction and parked gates", () => {
  const reachable = { phone: true, email: false, contactForm: false, social: false };
  const none = { phone: false, email: false, contactForm: false, social: false };

  it("returns PURSUE for an active high-fit trade with real need and a phone", () => {
    expect(
      recommendAction({
        name: "Ridge Line Roofing",
        phone: "661-555-0100",
        activeStatus: "active",
        websiteFit: 88,
        opportunityScore: 82,
        contactability: reachable,
      }),
    ).toBe("PURSUE");
  });

  it("returns MAYBE when the business might be a fit but is not confirmed active", () => {
    expect(
      recommendAction({
        name: "Ridge Line Roofing",
        phone: "661-555-0100",
        activeStatus: "unclear",
        websiteFit: 88,
        opportunityScore: 82,
        contactability: reachable,
      }),
    ).toBe("MAYBE");
  });

  it("returns SKIP for inactive, low-fit, or unreachable leads", () => {
    expect(
      recommendAction({
        name: "Shop",
        activeStatus: "inactive",
        websiteFit: 90,
        opportunityScore: 90,
        contactability: reachable,
      }),
    ).toBe("SKIP");
    expect(
      recommendAction({
        name: "City Bank",
        activeStatus: "active",
        websiteFit: 18,
        opportunityScore: 90,
        contactability: reachable,
      }),
    ).toBe("SKIP");
    expect(
      recommendAction({
        name: "Ridge Line Roofing",
        activeStatus: "active",
        websiteFit: 88,
        opportunityScore: 82,
        contactability: none,
      }),
    ).toBe("SKIP");
  });

  it("forces HOLD and DNC from parked verified records", () => {
    expect(parkedAction({ name: "Johnny's Barber" })).toBe("HOLD");
    expect(parkedAction({ name: "Oildale Barber" })).toBe("DNC");
    expect(
      recommendAction({
        name: "Johnny's Barber",
        activeStatus: "active",
        websiteFit: 90,
        opportunityScore: 90,
        contactability: reachable,
      }),
    ).toBe("HOLD");
    expect(
      recommendAction({
        name: "Oildale Barber",
        activeStatus: "active",
        websiteFit: 90,
        opportunityScore: 90,
        contactability: reachable,
      }),
    ).toBe("DNC");
  });
});

describe("isDemoCandidate", () => {
  it("is true only when every gate passes", () => {
    expect(isDemoCandidate(qualify())).toBe(true);
  });

  it("fails on inactive, low confidence, weak fit, weak need, no contact, or non-PURSUE", () => {
    expect(isDemoCandidate(qualify({ activeStatus: "inactive" }))).toBe(false);
    expect(isDemoCandidate(qualify({ activeStatus: "unclear" }))).toBe(false);
    expect(isDemoCandidate(qualify({ confidence: "LOW" }))).toBe(false);
    expect(isDemoCandidate(qualify({ websiteFit: 69 }))).toBe(false);
    expect(isDemoCandidate(qualify({ opportunityScore: 54 }))).toBe(false);
    expect(
      isDemoCandidate(
        qualify({ contactability: { phone: false, email: false, contactForm: false, social: false } }),
      ),
    ).toBe(false);
    expect(isDemoCandidate(qualify({ recommendedAction: "MAYBE" }))).toBe(false);
    expect(isDemoCandidate(qualify({ recommendedAction: "SKIP" }))).toBe(false);
  });

  it("blocks parked HOLD/DNC names even if scores look strong", () => {
    expect(isDemoCandidate(qualify({ businessName: "Johnny's Barber", recommendedAction: "PURSUE" }))).toBe(false);
    expect(isDemoCandidate(qualify({ businessName: "Oildale Barber", recommendedAction: "HOLD" }))).toBe(false);
  });
});

describe("buildBrief grounding", () => {
  it("stays inside known inputs and never invents proof or a service menu", () => {
    const result = qualify({ niche: "Roofing", officialWebsite: undefined, websiteStatus: "NONE" });
    const brief = buildBrief(result, lead());
    const text = formatBuildBrief(brief, result.businessName).toLowerCase();
    expect(brief.businessType).toMatch(/Roofing/);
    expect(brief.services.join(" ")).toMatch(/Roofing/);
    expect(text).toMatch(/do not invent awards, years in business, testimonials, certifications, or prices/);
    expect(text).not.toMatch(/award-winning/);
    expect(text).not.toMatch(/established in \d{4}/);
    expect(text).not.toMatch(/5-star/);
    expect(text).not.toMatch(/\$\d/);
    expect(text).toMatch(/do not invent/);
    expect(brief.cta).toMatch(/661-555-0100/);
    expect(brief.featuresNotNeeded.some((item) => /ecommerce/i.test(item))).toBe(true);
  });
});

describe("prefill and finalize", () => {
  it("prefills opportunity from the lead score and leaves business quality unknown", () => {
    const draft = prefillDeepQualify(lead({ score: 74, website: "https://facebook.com/ridge" }));
    expect(draft.opportunityScore).toBe(74);
    expect(draft.businessQuality).toBe("unknown");
    expect(draft.websiteFit).toBeGreaterThanOrEqual(80);
    expect(contactabilityFromLead(lead({ website: "https://facebook.com/ridge" })).social).toBe(true);
    expect(draft.activeStatus).toBe("unclear");
  });

  it("does not treat a missing website as a manufactured quality score", () => {
    const draft = prefillDeepQualify(lead({ score: 96, kind: "no_website", website: undefined }));
    expect(draft.businessQuality).toBe("unknown");
    expect(draft.inferences?.join(" ")).toMatch(/unknown/i);
  });

  it("writes a brief only for demo candidates and keeps HOLD/DNC protections", () => {
    const saved = finalizeQualify(qualify(), lead(), false);
    expect(saved.demoCandidate).toBe(true);
    expect(saved.result.buildBrief).toBeTruthy();

    const skipped = finalizeQualify(qualify({ websiteFit: 20, recommendedAction: "SKIP" }), lead(), true);
    expect(skipped.demoCandidate).toBe(false);
    expect(skipped.result.buildBrief).toBeUndefined();

    const parked = finalizeQualify(qualify({ businessName: "Johnny's Barber" }), lead({ name: "Johnny's Barber" }), true);
    expect(parked.result.recommendedAction).toBe("HOLD");
    expect(parked.demoCandidate).toBe(false);
  });
});
