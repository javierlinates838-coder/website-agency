import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Lead } from "../lib/types";
import {
  BAKERSFIELD_MARKET,
  VERIFIED_BENCH,
  VERIFIED_PARKED,
  VERIFIED_TOP5,
  annotateFinderLead,
  canContact,
  findParkedMatch,
  findVerifiedMatch,
  parkedLast,
  pipelineIdFor,
  verifiedToLead,
  type ContactMethod,
  type Confidence,
  type VerifiedLead,
  type WebsiteStatus,
} from "../lib/verified";
import {
  buildVerifiedCallScript,
  buildVerifiedEmail,
} from "../lib/verifiedScripts";

const profile = { name: "Sam", studio: "Beacon", email: "sam@beacon.test" };

const TOP5_SPEC: Array<{
  id: string;
  name: string;
  opportunityScore: number;
  confidence: Confidence;
  websiteStatus: WebsiteStatus;
  contactMethod: ContactMethod;
  phone: string;
}> = [
  {
    id: "white-lane-donuts",
    name: "White Lane Donuts",
    opportunityScore: 82,
    confidence: "HIGH",
    websiteStatus: "NONE",
    contactMethod: "phone",
    phone: "(661) 836-2906",
  },
  {
    id: "oildale-nails",
    name: "Oildale Nails",
    opportunityScore: 72,
    confidence: "MEDIUM",
    websiteStatus: "NONE",
    contactMethod: "phone",
    phone: "(661) 391-8830",
  },
  {
    id: "briceno-electric-hector",
    name: "Briceno Electric (Hector only)",
    opportunityScore: 74,
    confidence: "MEDIUM",
    websiteStatus: "NONE",
    contactMethod: "phone",
    phone: "(661) 599-9646",
  },
  {
    id: "hometown-plumbing",
    name: "Hometown Plumbing",
    opportunityScore: 68,
    confidence: "HIGH",
    websiteStatus: "OUTDATED",
    contactMethod: "phone_or_email",
    phone: "(661) 837-4569",
  },
  {
    id: "luna-electric",
    name: "Luna Electric Inc.",
    opportunityScore: 62,
    confidence: "HIGH",
    websiteStatus: "WEAK",
    contactMethod: "phone_or_email",
    phone: "(661) 461-8042",
  },
];

function byId(id: string): VerifiedLead {
  const lead = [...VERIFIED_TOP5, ...VERIFIED_PARKED].find((item) => item.id === id);
  expect(lead).toBeTruthy();
  return lead!;
}

describe("Bakersfield verified desk", () => {
  it("loads market, Top 5, parked, and bench from bakersfield.json", () => {
    const data = JSON.parse(
      readFileSync(join(process.cwd(), "data/verified/bakersfield.json"), "utf8"),
    ) as {
      market: typeof BAKERSFIELD_MARKET;
      top5: VerifiedLead[];
      parked: VerifiedLead[];
      bench: string[];
    };
    const src = readFileSync(join(process.cwd(), "lib/verified.ts"), "utf8");
    expect(src).toMatch(/data\/verified\/bakersfield\.json/);
    expect(src).not.toMatch(/white-lane-donuts/);
    expect(BAKERSFIELD_MARKET).toEqual(data.market);
    expect(VERIFIED_TOP5).toEqual(data.top5);
    expect(VERIFIED_PARKED).toEqual(data.parked);
    expect(VERIFIED_BENCH).toEqual(data.bench);
  });

  it("keeps five safe leads and two parked names", () => {
    expect(VERIFIED_TOP5).toHaveLength(5);
    expect(VERIFIED_TOP5.every(canContact)).toBe(true);
    expect(VERIFIED_PARKED.map((lead) => lead.status).sort()).toEqual(["dnc", "hold"]);
    expect(VERIFIED_PARKED.every((lead) => !canContact(lead))).toBe(true);
  });

  it("matches the flag-resolution Top 5 scores, confidence, website status, and contact method", () => {
    expect(VERIFIED_TOP5.map((lead) => lead.id)).toEqual(TOP5_SPEC.map((lead) => lead.id));
    for (const [index, spec] of TOP5_SPEC.entries()) {
      const lead = VERIFIED_TOP5[index];
      expect(lead.name).toBe(spec.name);
      expect(lead.opportunityScore).toBe(spec.opportunityScore);
      expect(lead.confidence).toBe(spec.confidence);
      expect(lead.websiteStatus).toBe(spec.websiteStatus);
      expect(lead.contactMethod).toBe(spec.contactMethod);
      expect(lead.phone).toBe(spec.phone);
      expect(lead.status).toBe("safe");
    }
  });

  it("uses only the cleared White Lane number", () => {
    const donuts = byId("white-lane-donuts");
    const call = buildVerifiedCallScript(donuts, profile);
    expect(donuts.ignorePhones).toEqual(["(661) 827-9606"]);
    expect(call).toContain("836-2906");
    expect(call).toContain("827-9606");
    expect(call).toMatch(/Call \(661\) 836-2906 only/);
  });

  it("keeps Hector's Briceno pitch off the other identity", () => {
    const hector = byId("briceno-electric-hector");
    const email = buildVerifiedEmail(hector, profile);
    const call = buildVerifiedCallScript(hector, profile);
    expect(email).toContain("Hector");
    expect(email).toContain("900822");
    expect(email).toMatch(/do not email williamb@/i);
    expect(email).not.toMatch(/^To: williamb/m);
    expect(call).toMatch(/Do not mention bricenoelectric\.com/);
    expect(call).toContain("599-9646");
    expect(hector.ignoreEmails).toEqual(["williamb@"]);
    expect(hector.ignoreSites).toEqual(["bricenoelectric.com"]);
  });

  it("routes Hometown off Norris Rd with the Empire State / PO Box license record", () => {
    const plumbing = byId("hometown-plumbing");
    expect(buildVerifiedCallScript(plumbing, profile)).toContain("Empire State");
    expect(buildVerifiedCallScript(plumbing, profile)).toContain("Norris");
    expect(plumbing.address).toMatch(/Empire State/);
    expect(plumbing.mailing).toBe("PO Box 41116");
    expect(plumbing.discardAddresses).toEqual(["Norris Rd"]);
    expect(plumbing.license).toBe("CSLB #850879");
    expect(plumbing.email).toBe("hometownplumbing@att.net");
  });

  it("records Luna as a WEAK redesign with the mirror-only license caveat", () => {
    const luna = byId("luna-electric");
    expect(luna.play).toBe("redesign");
    expect(luna.websiteStatus).toBe("WEAK");
    expect(luna.license).toBe("CSLB #1008195");
    expect(luna.doNot.join(" ")).toMatch(/mirror/i);
    expect(buildVerifiedEmail(luna, profile)).toContain("accounting@lunaelectric07.com");
  });

  it("wires verifiedToLead().score to opportunityScore instead of the 94/82 intent proxy", () => {
    expect(VERIFIED_TOP5.map((lead) => verifiedToLead(lead).score)).toEqual([82, 72, 74, 68, 62]);

    for (const lead of VERIFIED_TOP5) {
      const converted = verifiedToLead(lead);
      expect(converted.score).toBe(lead.opportunityScore);
      expect(converted.source).toBe("verified");
      expect(converted.confidence).toBe(lead.confidence);
      expect(converted.websiteStatus).toBe(lead.websiteStatus);
      expect(converted.contactMethod).toBe(lead.contactMethod);
      if (lead.intent === "high") expect(converted.score).not.toBe(94);
      if (lead.intent === "medium") expect(converted.score).not.toBe(82);
    }

    const plumbing = verifiedToLead(byId("hometown-plumbing"));
    expect(plumbing.email).toBe("hometownplumbing@att.net");
    expect(plumbing.score).toBe(68);
  });
});

describe("findParkedMatch", () => {
  it("matches parked records by normalized phone", () => {
    const parked = [{ ...byId("oildale-barber"), phone: "(661) 399-9090" }];
    expect(findParkedMatch({ name: "Other Shop", phone: "661-399-9090" }, parked)?.id).toBe("oildale-barber");
    expect(findParkedMatch({ name: "Other Shop", phone: "1 (661) 399.9090" }, parked)?.id).toBe("oildale-barber");
    expect(findParkedMatch({ name: "Other Shop", phone: "(661) 555-0100" }, parked)).toBeUndefined();
  });

  it("matches parked records by normalized name", () => {
    expect(findParkedMatch({ name: "Johnny's Barber" })?.status).toBe("hold");
    expect(findParkedMatch({ name: "johnnys barber" })?.id).toBe("johnnys-barber");
    expect(findParkedMatch({ name: "OILDALE BARBER" })?.status).toBe("dnc");
  });

  it("does not treat SAFE Top 5 as parked", () => {
    for (const lead of VERIFIED_TOP5) {
      expect(findParkedMatch({ name: lead.name, phone: lead.phone })).toBeUndefined();
    }
  });

  it("keeps canContact false for parked matches", () => {
    const johnny = findParkedMatch({ name: "Johnny's Barber" });
    const barber = findParkedMatch({ name: "Oildale Barber" });
    expect(johnny && canContact(johnny)).toBe(false);
    expect(barber && canContact(barber)).toBe(false);
  });
});

describe("findVerifiedMatch", () => {
  it("matches SAFE Top 5 by normalized phone and name", () => {
    expect(findVerifiedMatch({ name: "Other", phone: "(661) 836-2906" })?.id).toBe("white-lane-donuts");
    expect(findVerifiedMatch({ name: "hometown plumbing" })?.id).toBe("hometown-plumbing");
    expect(findVerifiedMatch({ id: "verified:luna-electric", name: "Other" })?.id).toBe("luna-electric");
  });

  it("does not treat HOLD/DNC names as verified matches", () => {
    expect(findVerifiedMatch({ name: "Johnny's Barber" })).toBeUndefined();
    expect(findVerifiedMatch({ name: "Oildale Barber" })).toBeUndefined();
    expect(findParkedMatch({ name: "Johnny's Barber" })?.status).toBe("hold");
  });
});

describe("parkedLast", () => {
  it("keeps HOLD/DNC names after contactable results", () => {
    expect(parkedLast({ name: "Johnny's Barber" }, { name: "White Lane Donuts" })).toBeGreaterThan(0);
    expect(parkedLast({ name: "White Lane Donuts" }, { name: "Oildale Barber" })).toBeLessThan(0);
    expect(parkedLast({ name: "Maple Court Dental" }, { name: "Harbor Table" })).toBe(0);
  });
});

describe("annotateFinderLead", () => {
  function osmLead(over: Partial<Lead> = {}): Lead {
    return {
      id: "osm:1",
      name: "Maple Court Dental",
      industry: "dentists",
      industryLabel: "Dentists",
      city: "Austin, TX",
      address: "1 Maple",
      phone: "512-555-0100",
      score: 94,
      kind: "no_website",
      issues: ["No website listed"],
      source: "live",
      analyzed: true,
      ...over,
    };
  }

  it("does not invent confidence for OSM-only leads", () => {
    const meta = annotateFinderLead(osmLead());
    expect(meta.sourceLabel).toBe("Live");
    expect(meta.confidence).toBeUndefined();
    expect(meta.verified).toBeUndefined();
    expect(meta.parked).toBeUndefined();
    expect(meta.score).toBe(94);
  });

  it("surfaces verified score, confidence, website status, and contact method on SAFE matches", () => {
    const meta = annotateFinderLead(osmLead({ name: "White Lane Donuts", phone: "661-836-2906" }));
    expect(meta.sourceLabel).toBe("Verified");
    expect(meta.score).toBe(82);
    expect(meta.confidence).toBe("HIGH");
    expect(meta.websiteStatus).toBe("NONE");
    expect(meta.contactMethod).toBe("phone");
    expect(pipelineIdFor(osmLead({ name: "White Lane Donuts", phone: "661-836-2906" }))).toBe(
      "verified:white-lane-donuts",
    );
  });

  it("keeps HOLD/DNC parked and does not promote them to verified", () => {
    const hold = annotateFinderLead(osmLead({ name: "Johnny's Barber", phone: undefined, score: 88 }));
    expect(hold.sourceLabel).toBe("HOLD");
    expect(hold.parked?.status).toBe("hold");
    expect(hold.verified).toBeUndefined();
    expect(hold.confidence).toBe("LOW");
    const dnc = annotateFinderLead(osmLead({ name: "Oildale Barber" }));
    expect(dnc.sourceLabel).toBe("DNC");
    expect(dnc.parked?.status).toBe("dnc");
  });
});

describe("HOLD / DNC cannot be saved", () => {
  it("treats only safe as contactable and throws on HOLD/DNC conversion", () => {
    const safe = VERIFIED_TOP5[0];
    expect(canContact(safe)).toBe(true);
    expect(canContact({ ...safe, status: "hold" })).toBe(false);
    expect(canContact({ ...safe, status: "dnc" })).toBe(false);
    expect(() => verifiedToLead({ ...safe, status: "hold" })).toThrow(/HOLD/i);
    expect(() => verifiedToLead({ ...safe, status: "dnc" })).toThrow(/DNC/i);
  });

  it("parks Johnny's Barber as HOLD LOW and blocks save/scripts", () => {
    const johnny = byId("johnnys-barber");
    expect(johnny.status).toBe("hold");
    expect(johnny.confidence).toBe("LOW");
    expect(johnny.contactMethod).toBe("none");
    expect(canContact(johnny)).toBe(false);
    expect(buildVerifiedCallScript(johnny)).toMatch(/HOLD/);
    expect(() => verifiedToLead(johnny)).toThrow(/HOLD/i);
  });

  it("parks Oildale Barber as DNC and blocks save/scripts", () => {
    const barber = byId("oildale-barber");
    expect(barber.status).toBe("dnc");
    expect(barber.contactMethod).toBe("none");
    expect(canContact(barber)).toBe(false);
    expect(buildVerifiedEmail(barber)).toMatch(/DO NOT CONTACT/);
    expect(() => verifiedToLead(barber)).toThrow(/DNC/i);
  });
});

describe("no send endpoints", () => {
  it("exposes only search and analyze API routes", () => {
    const apiRoot = join(process.cwd(), "app/api");
    const names = readdirSync(apiRoot).filter((name) => statSync(join(apiRoot, name)).isDirectory());
    expect(names.sort()).toEqual(["analyze", "search"]);
    expect(names.some((name) => /send|mail|sms|twilio|outreach/i.test(name))).toBe(false);
  });

  it("does not add mail, sms, or sequencer packages", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of [
      "nodemailer",
      "twilio",
      "sendgrid",
      "@sendgrid/mail",
      "postmark",
      "mailgun",
      "resend",
      "plivo",
    ]) {
      expect(deps[name], name).toBeUndefined();
    }
  });
});
