import type { Lead } from "./types";
import bakersfield from "../data/verified/bakersfield.json";

export type ContactStatus = "safe" | "hold" | "dnc";
export type Intent = "high" | "medium";
export type Play = "greenfield" | "redesign";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type WebsiteStatus = "NONE" | "WEAK" | "OUTDATED" | "ADEQUATE" | "UNCLEAR" | "CLOSED";
export type ContactMethod = "phone" | "phone_or_email" | "none";

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

export function canContact(lead: VerifiedLead): boolean {
  return lead.status === "safe";
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
  };
}
