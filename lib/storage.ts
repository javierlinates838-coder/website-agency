import type { Lead, LeadStatus, StudioProfile } from "./types";

export type LeadPatch = Partial<Pick<Lead, "notes" | "followUpDate" | "status" | "deepQualify" | "demoCandidate">>;
import { findParkedMatch } from "./verified";

const LEADS_KEY = "beacon-pipeline";
const PROFILE_KEY = "beacon-profile";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function migrateLeadStatus(status: unknown): LeadStatus {
  if (status === "meeting" || status === "proposal") return "follow_up";
  if (status === "passed") return "lost";
  if (status === "new" || status === "contacted" || status === "follow_up" || status === "won" || status === "lost") {
    return status;
  }
  return "new";
}

export function loadPipeline(): Lead[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Lead[];
    if (!Array.isArray(parsed)) return [];
    let changed = false;
    const leads = parsed.map((lead) => {
      const status = migrateLeadStatus(lead.status);
      if (status !== lead.status) changed = true;
      return { ...lead, status };
    });
    if (changed) savePipeline(leads);
    return leads;
  } catch {
    return [];
  }
}

export function savePipeline(leads: Lead[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function defaultProfile(): StudioProfile {
  return {
    name: "",
    studio: "",
    email: "",
    city: "",
    offer: "a fast, mobile site that turns searches into booked work",
  };
}

export function upsertLead(lead: Lead, status: LeadStatus = "new"): Lead[] {
  if (findParkedMatch(lead)) {
    return loadPipeline();
  }
  const current = loadPipeline();
  const next: Lead = {
    ...lead,
    status: migrateLeadStatus(lead.status || status),
    savedAt: lead.savedAt || new Date().toISOString(),
  };
  const index = current.findIndex((item) => item.id === next.id);
  if (index >= 0) {
    const existing = current[index];
    current[index] = {
      ...existing,
      ...next,
      status: migrateLeadStatus(existing.status || next.status),
      notes: existing.notes ?? next.notes,
      followUpDate: existing.followUpDate ?? next.followUpDate,
      savedAt: existing.savedAt || next.savedAt,
      deepQualify: existing.deepQualify ?? next.deepQualify,
      demoCandidate: existing.demoCandidate ?? next.demoCandidate,
    };
  } else {
    current.unshift(next);
  }
  savePipeline(current);
  return current;
}

export function updateLead(id: string, patch: LeadPatch): Lead[] {
  const current = loadPipeline().map((lead) => {
    if (lead.id !== id) return lead;
    const next = { ...lead, ...patch };
    if (patch.status !== undefined) next.status = migrateLeadStatus(patch.status);
    return next;
  });
  savePipeline(current);
  return current;
}

export function updateLeadStatus(id: string, status: LeadStatus): Lead[] {
  return updateLead(id, { status });
}

export function removeLead(id: string): Lead[] {
  const current = loadPipeline().filter((lead) => lead.id !== id);
  savePipeline(current);
  return current;
}

export function loadProfile(): StudioProfile {
  const fallback = defaultProfile();
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as StudioProfile) };
  } catch {
    return fallback;
  }
}

export function saveProfile(profile: StudioProfile): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function toCsv(leads: Lead[]): string {
  const header = [
    "Name",
    "Industry",
    "City",
    "Address",
    "Phone",
    "Email",
    "Website",
    "Score",
    "Opportunity",
    "Issues",
    "Status",
    "Notes",
    "Follow-up",
  ];
  const rows = leads.map((lead) =>
    [
      lead.name,
      lead.industryLabel,
      lead.city,
      lead.address,
      lead.phone || "",
      lead.email || "",
      lead.website || "",
      String(lead.score),
      lead.kind,
      lead.issues.join("; "),
      lead.status || "new",
      lead.notes || "",
      lead.followUpDate || "",
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
