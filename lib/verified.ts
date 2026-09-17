import type { Confidence, ContactMethod, Lead, WebsiteStatus } from "./types";
import bakersfield from "../data/verified/bakersfield.json";

export type ContactStatus = "safe" | "hold" | "dnc";
export type Intent = "high" | "medium";
export type Play = "greenfield" | "redesign";
export type { Confidence, ContactMethod, WebsiteStatus };

export type VerifiedLead = {
  id: string;
  rank?: number;
  name: string;
  trade: string;
  intent?: Intent;
  opportunityScore?: number;
  confidence?: Confidence;
  websiteStatus?: WebsiteStatus;
  contactMethod?: ContactMethod;
  status: ContactStatus;
  phone?: string;
  ignorePhones?: string[];
  ignoreEmails?: string[];
  ignoreSites?: string[];
  email?: string;
  address: string;
  mailing?: string;
  discardAddresses?: string[];
  website?: string;
  websiteNote?: string;
  why: string;
  doNot: string[];
  play?: Play;
  city: string;
  license?: string;
};

export const BAKERSFIELD_MARKET = bakersfield.market;
export const VERIFIED_TOP5 = bakersfield.top5 as VerifiedLead[];
export const VERIFIED_PARKED = bakersfield.parked as VerifiedLead[];
export const VERIFIED_BENCH = bakersfield.bench;

export type FinderSourceLabel = "Live" | "Sample" | "Verified" | "HOLD" | "DNC";

export type FinderAnnotation = {
  parked?: VerifiedLead;
  verified?: VerifiedLead;
  score: number;
  sourceLabel: FinderSourceLabel;
  confidence?: Confidence;
  websiteStatus?: WebsiteStatus;
  contactMethod?: ContactMethod;
};

export function canContact(lead: VerifiedLead): boolean {
  return lead.status === "safe";
}

export function phoneKey(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function matchByPhoneOrName(
  lead: { name: string; phone?: string | null },
  records: readonly VerifiedLead[],
): VerifiedLead | undefined {
  const phone = phoneKey(lead.phone);
  if (phone) {
    const byPhone = records.find((item) => phoneKey(item.phone) === phone);
    if (byPhone) return byPhone;
  }
  const name = nameKey(lead.name);
  if (!name) return undefined;
  return records.find((item) => nameKey(item.name) === name);
}

export function findParkedMatch(
  lead: { name: string; phone?: string | null },
  parked: readonly VerifiedLead[] = VERIFIED_PARKED,
): VerifiedLead | undefined {
  return matchByPhoneOrName(lead, parked);
}

export function parkedLast(
  a: { name: string; phone?: string | null },
  b: { name: string; phone?: string | null },
): number {
  return Number(Boolean(findParkedMatch(a))) - Number(Boolean(findParkedMatch(b)));
}

export function findVerifiedMatch(
  lead: { id?: string; name: string; phone?: string | null },
  safe: readonly VerifiedLead[] = VERIFIED_TOP5,
): VerifiedLead | undefined {
  if (lead.id?.startsWith("verified:")) {
    const byId = safe.find((item) => item.id === lead.id!.slice("verified:".length));
    if (byId) return byId;
  }
  return matchByPhoneOrName(lead, safe);
}

export function annotateFinderLead(lead: Lead): FinderAnnotation {
  const parked = findParkedMatch(lead);
  if (parked) {
    return {
      parked,
      score: lead.score,
      sourceLabel: statusLabel(parked.status),
      confidence: parked.confidence,
      websiteStatus: parked.websiteStatus,
      contactMethod: parked.contactMethod,
    };
  }

  const verified = findVerifiedMatch(lead);
  if (verified) {
    return {
      verified,
      score: typeof verified.opportunityScore === "number" ? verified.opportunityScore : lead.score,
      sourceLabel: "Verified",
      confidence: verified.confidence,
      websiteStatus: verified.websiteStatus,
      contactMethod: verified.contactMethod,
    };
  }

  return {
    score: lead.score,
    sourceLabel: lead.source === "demo" ? "Sample" : lead.source === "verified" ? "Verified" : "Live",
    contactMethod: lead.contactMethod,
  };
}

export function pipelineIdFor(lead: Lead): string {
  if (findParkedMatch(lead)) return lead.id;
  const verified = findVerifiedMatch(lead);
  return verified ? `verified:${verified.id}` : lead.id;
}

export function getVerifiedLead(id: string): VerifiedLead | undefined {
  return [...VERIFIED_TOP5, ...VERIFIED_PARKED].find((lead) => lead.id === id);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function contactMethodLabel(method?: ContactMethod): string {
  if (method === "phone") return "Phone";
  if (method === "phone_or_email") return "Phone or email";
  if (method === "none") return "None";
  return "—";
}

export function websiteStatusLabel(status?: WebsiteStatus): string {
  if (status === "NONE") return "No website";
  if (status === "WEAK") return "Weak site";
  if (status === "OUTDATED") return "Outdated";
  if (status === "ADEQUATE") return "Adequate";
  if (status === "UNCLEAR") return "Unclear";
  if (status === "CLOSED") return "Closed";
  return "—";
}

export function statusLabel(status: ContactStatus): "Verified" | "HOLD" | "DNC" {
  if (status === "safe") return "Verified";
  if (status === "hold") return "HOLD";
  return "DNC";
}

export function verifiedToLead(lead: VerifiedLead): Lead {
  if (!canContact(lead)) {
    throw new Error(`${lead.name} is ${lead.status.toUpperCase()} and cannot be saved to the pipeline.`);
  }
  if (typeof lead.opportunityScore !== "number") {
    throw new Error(`${lead.name} is missing opportunityScore.`);
  }
  const kind = lead.play === "redesign" ? "outdated" : "no_website";
  return {
    id: `verified:${lead.id}`,
    name: lead.name,
    industry: lead.trade.toLowerCase(),
    industryLabel: lead.trade,
    city: lead.city,
    address: lead.address,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    score: lead.opportunityScore,
    kind,
    issues: [lead.why, lead.websiteNote, ...lead.doNot].filter(Boolean) as string[],
    source: "verified",
    analyzed: true,
    notes: lead.doNot.join(" "),
    confidence: lead.confidence,
    websiteStatus: lead.websiteStatus,
    contactMethod: lead.contactMethod,
  };
}
