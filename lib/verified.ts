import type { Lead } from "./types";

export type ContactStatus = "safe" | "hold" | "dnc";
export type Intent = "high" | "medium";
export type Play = "greenfield" | "redesign";

export type VerifiedLead = {
  id: string;
  rank?: number;
  name: string;
  trade: string;
  intent?: Intent;
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

export const BAKERSFIELD_MARKET = {
  id: "bakersfield",
  label: "Bakersfield / Oildale",
  areaCode: "661",
  sources: "CSLB, SOS, BBB, FMCSA, and official pages first. Directories only as backup.",
  note: "Flags cleared against primary sources. No outreach has been sent from this desk.",
};

export const VERIFIED_TOP5: VerifiedLead[] = [
  {
    id: "white-lane-donuts",
    rank: 1,
    name: "White Lane Donuts",
    trade: "Bakery / donuts",
    intent: "high",
    status: "safe",
    phone: "(661) 836-2906",
    ignorePhones: ["(661) 827-9606"],
    address: "1561 White Ln, Bakersfield, CA",
    websiteNote: "None found — true greenfield.",
    why: "Confirmed active (2025 reviews). True greenfield. Junk directory data discarded.",
    doNot: ["Do not call (661) 827-9606."],
    play: "greenfield",
    city: "Bakersfield, CA",
  },
  {
    id: "oildale-nails",
    rank: 2,
    name: "Oildale Nails",
    trade: "Nail salon",
    intent: "medium",
    status: "safe",
    phone: "(661) 391-8830",
    address: "2509 N Chester Ave, Oildale, CA",
    websiteNote: "None found.",
    why: "No open conflicts. Salon booking gap. Clean phone and address.",
    doNot: [],
    play: "greenfield",
    city: "Oildale, CA",
  },
  {
    id: "briceno-electric-hector",
    rank: 3,
    name: "Briceno Electric (Hector only)",
    trade: "Electrician",
    intent: "medium",
    status: "safe",
    phone: "(661) 599-9646",
    ignoreEmails: ["williamb@"],
    ignoreSites: ["bricenoelectric.com"],
    address: "Street candidate: 1305 Camino Del Oeste",
    mailing: "PO Box 11034",
    websiteNote: "None confirmed for Hector. The live site belongs to a different Briceno identity.",
    why: "CSLB #900822 and BBB align on Hector. Pitch as a no-site trades lead for Hector only.",
    doNot: [
      "Do not use williamb@ or bricenoelectric.com — that site is not Hector’s.",
      "Pitch Hector only. Do not treat the other Briceno identity as this lead.",
    ],
    play: "greenfield",
    city: "Bakersfield, CA",
    license: "CSLB #900822",
  },
  {
    id: "hometown-plumbing",
    rank: 4,
    name: "Hometown Plumbing",
    trade: "Plumbing",
    intent: "high",
    status: "safe",
    phone: "(661) 837-4569",
    email: "hometownplumbing@att.net",
    address: "9502 Empire State Dr, Bakersfield, CA",
    mailing: "PO Box 41116",
    discardAddresses: ["Norris Rd"],
    website: "https://hometownplumbingbakersfield.com",
    websiteNote: "OUTDATED / WEAK — testimonials dated 1/01/1970.",
    why: "Address cleared via FMCSA. Clear redesign pitch with a public email.",
    doNot: ["Discard the Norris Rd address."],
    play: "redesign",
    city: "Bakersfield, CA",
  },
  {
    id: "luna-electric",
    rank: 5,
    name: "Luna Electric Inc.",
    trade: "Electrician",
    intent: "high",
    status: "safe",
    phone: "(661) 461-8042",
    email: "accounting@lunaelectric07.com",
    address: "3700 Easton Dr #20, Bakersfield, CA",
    website: "https://lunaelectric07.com",
    websiteNote: "WEAK — SEO-spam title and typos. Redesign, not greenfield.",
    why: "Contacts consistent across sources. Redesign, not a from-scratch site.",
    doNot: [],
    play: "redesign",
    city: "Bakersfield, CA",
  },
];

export const VERIFIED_PARKED: VerifiedLead[] = [
  {
    id: "johnnys-barber",
    name: "Johnny's Barber",
    trade: "Barber",
    status: "hold",
    address: "Bakersfield / Oildale — identity unresolved",
    why: "HOLD. Multi-shop / trade-name conflict. Do not outreach until the shop identity is unstuck.",
    doNot: ["No calls, emails, or DMs until the conflict is cleared."],
    city: "Bakersfield, CA",
  },
  {
    id: "oildale-barber",
    name: "Oildale Barber",
    trade: "Barber",
    status: "dnc",
    address: "Closed / Norris Barber Shop",
    why: "DO NOT CONTACT. Closed, or it is Norris Barber Shop — not an open lead.",
    doNot: ["Do not call. Do not email. Do not visit as a prospect."],
    city: "Oildale, CA",
  },
];

export const VERIFIED_BENCH = [
  "Hybrid Health",
  "JJ Concrete",
  "Able Auto",
  "Brimhall",
  "24th Street Cafe",
];

export function canContact(lead: VerifiedLead): boolean {
  return lead.status === "safe";
}

export function getVerifiedLead(id: string): VerifiedLead | undefined {
  return [...VERIFIED_TOP5, ...VERIFIED_PARKED].find((lead) => lead.id === id);
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function verifiedToLead(lead: VerifiedLead): Lead {
  const kind = lead.play === "redesign" ? "outdated" : "no_website";
  const score = lead.intent === "high" ? 94 : lead.intent === "medium" ? 82 : 70;
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
    score,
    kind,
    issues: [lead.why, lead.websiteNote, ...lead.doNot].filter(Boolean) as string[],
    source: "verified",
    analyzed: true,
    notes: lead.doNot.join(" "),
  };
}
