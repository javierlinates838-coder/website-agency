export type OpportunityKind =
  | "no_website"
  | "social_only"
  | "parked"
  | "outdated"
  | "not_mobile"
  | "insecure"
  | "thin"
  | "refresh"
  | "healthy";

export type LeadStatus = "new" | "contacted" | "follow_up" | "won" | "lost";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type WebsiteStatus = "NONE" | "WEAK" | "OUTDATED" | "ADEQUATE" | "UNCLEAR" | "CLOSED";
export type ContactMethod = "phone" | "phone_or_email" | "none";

export type Lead = {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  city: string;
  address: string;
  lat?: number;
  lon?: number;
  phone?: string;
  email?: string;
  website?: string;
  score: number;
  kind: OpportunityKind;
  issues: string[];
  source: "live" | "demo" | "verified";
  analyzed: boolean;
  notes?: string;
  status?: LeadStatus;
  savedAt?: string;
  followUpDate?: string;
  confidence?: Confidence;
  websiteStatus?: WebsiteStatus;
  contactMethod?: ContactMethod;
};

export type StudioProfile = {
  name: string;
  studio: string;
  email: string;
  city: string;
  offer: string;
};

export type SearchResponse = {
  cityLabel: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  leads: Lead[];
  liveCount: number;
  usedDemo: boolean;
  warning?: string;
};
