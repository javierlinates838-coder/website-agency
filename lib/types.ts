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
export type ActiveStatus = "active" | "unclear" | "inactive";
export type RecommendedAction = "PURSUE" | "MAYBE" | "SKIP" | "HOLD" | "DNC";
export type BusinessQuality = number | "unknown";

export type Contactability = {
  phone: boolean;
  email: boolean;
  contactForm: boolean;
  social: boolean;
};

export type BuildBrief = {
  businessType: string;
  goals: string[];
  recommendedPages: string[];
  homepageStructure: string[];
  services: string[];
  trustSignals: string[];
  cta: string;
  visualDirection: string;
  improvementsVsCurrent: string[];
  featuresNotNeeded: string[];
};

export type DeepQualifyResult = {
  businessName: string;
  niche: string;
  activeStatus: ActiveStatus;
  officialWebsite?: string;
  phone?: string;
  contactability: Contactability;
  opportunityScore: number;
  websiteFit: number;
  businessQuality: BusinessQuality;
  confidence: Confidence;
  websiteStatus?: WebsiteStatus;
  opportunities: string[];
  risks: string[];
  recommendedAction: RecommendedAction;
  sources?: string[];
  facts?: string[];
  inferences?: string[];
  buildBrief?: BuildBrief;
  qualifiedAt?: string;
};

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
  deepQualify?: DeepQualifyResult;
  demoCandidate?: boolean;
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
