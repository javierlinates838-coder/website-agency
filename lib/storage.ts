import type { Lead, LeadStatus, StudioProfile } from "./types";

const LEADS_KEY = "beacon-pipeline";
const PROFILE_KEY = "beacon-profile";

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function loadPipeline(): Lead[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LEADS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Lead[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePipeline(leads: Lead[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
}

export function upsertLead(lead: Lead, status: LeadStatus = "new"): Lead[] {
  const current = loadPipeline();
  const next: Lead = {
    ...lead,
    status: lead.status || status,
    savedAt: lead.savedAt || new Date().toISOString(),
  };
  const index = current.findIndex((item) => item.id === next.id);
  if (index >= 0) current[index] = { ...current[index], ...next };
  else current.unshift(next);
  savePipeline(current);
  return current;
}

export function updateLeadStatus(id: string, status: LeadStatus): Lead[] {
  const current = loadPipeline().map((lead) => (lead.id === id ? { ...lead, status } : lead));
  savePipeline(current);
  return current;
}

export function removeLead(id: string): Lead[] {
  const current = loadPipeline().filter((lead) => lead.id !== id);
  savePipeline(current);
  return current;
}

export function loadProfile(): StudioProfile {
  const fallback: StudioProfile = {
    name: "",
    studio: "",
    email: "",
    city: "",
    offer: "a fast, mobile site that turns searches into booked work",
  };
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
    ].map(csvCell).join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
