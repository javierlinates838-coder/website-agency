import type { Lead, OpportunityKind } from "./types";

const SOCIAL_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "yelp.com",
  "tripadvisor.com",
  "linktr.ee",
  "linktree.com",
  "tiktok.com",
  "nextdoor.com",
  "threads.net",
];

const PARKED_HINTS = [
  "domain is for sale",
  "buy this domain",
  "this domain is parked",
  "parked free",
  "website coming soon",
  "under construction",
  "opening soon",
  "placeholder page",
  "godaddy.com",
  "default web site page",
  "apache2 ubuntu default",
  "welcome to nginx",
];

export function hostnameOf(url: string): string {
  try {
    return new URL(normalizeWebsite(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeWebsite(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isSocialOnlyWebsite(url: string): boolean {
  const host = hostnameOf(url);
  return SOCIAL_HOSTS.some((social) => host === social || host.endsWith(`.${social}`));
}

function pickKind(issues: { kind: OpportunityKind; weight: number }[]): OpportunityKind {
  if (issues.length === 0) return "healthy";
  return [...issues].sort((a, b) => b.weight - a.weight)[0].kind;
}

function yearFromHtml(html: string): number | null {
  const matches = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:20\d{2}\s*[-–—]\s*)?(20\d{2})/gi)];
  if (matches.length === 0) return null;
  const years = matches
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1995 && year <= 2035);
  if (years.length === 0) return null;
  return Math.max(...years);
}

export function classifyOpportunity(input: {
  website?: string | null;
  html?: string | null;
  finalUrl?: string | null;
  fetchError?: string | null;
  status?: number | null;
}): { score: number; kind: OpportunityKind; issues: string[] } {
  const website = input.website?.trim() || "";
  const issues: string[] = [];
  const flags: { kind: OpportunityKind; weight: number }[] = [];
  let score = 28;

  if (!website) {
    return {
      score: 94,
      kind: "no_website",
      issues: ["No website listed — they are invisible beyond Maps and word of mouth."],
    };
  }

  if (isSocialOnlyWebsite(website) || (input.finalUrl && isSocialOnlyWebsite(input.finalUrl))) {
    return {
      score: 88,
      kind: "social_only",
      issues: ["The only web presence is a social profile, not a real website."],
    };
  }

  if (input.fetchError) {
    issues.push(`Could not load the site (${input.fetchError}). That is often a broken or abandoned domain.`);
    flags.push({ kind: "thin", weight: 18 });
    score += 22;
  }

  if (input.status && input.status >= 400) {
    issues.push(`The site responded with HTTP ${input.status}.`);
    flags.push({ kind: "thin", weight: 16 });
    score += 18;
  }

  const html = input.html || "";
  const lower = html.toLowerCase();
  const finalUrl = input.finalUrl || website;

  if (finalUrl.startsWith("http://")) {
    issues.push("Serves over HTTP instead of HTTPS — browsers now warn visitors.");
    flags.push({ kind: "insecure", weight: 20 });
    score += 16;
  }

  if (html) {
    if (PARKED_HINTS.some((hint) => lower.includes(hint))) {
      issues.push("Looks parked, default, or still 'coming soon'.");
      flags.push({ kind: "parked", weight: 32 });
      score += 36;
    }

    if (!/name\s*=\s*["']viewport["']/i.test(html)) {
      issues.push("No mobile viewport tag — the layout likely breaks on phones.");
      flags.push({ kind: "not_mobile", weight: 24 });
      score += 18;
    }

    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
    if (!title || title.length < 8 || /untitled|default title|just another wordpress/i.test(title)) {
      issues.push("Missing or generic page title — a quiet SEO leak.");
      flags.push({ kind: "refresh", weight: 8 });
      score += 8;
    }

    if (!/name=["']description["']/i.test(html)) {
      issues.push("No meta description, so search snippets are left to chance.");
      flags.push({ kind: "refresh", weight: 6 });
      score += 6;
    }

    if (!/<h1\b/i.test(html)) {
      issues.push("No H1 heading on the homepage.");
      flags.push({ kind: "refresh", weight: 5 });
      score += 4;
    }

    const year = yearFromHtml(html);
    if (year && year <= 2022) {
      issues.push(`Copyright still shows ${year} — the site reads as abandoned.`);
      flags.push({ kind: "outdated", weight: 22 });
      score += 14;
    }

    if (html.length < 280) {
      issues.push("Homepage is extremely thin — not enough content to convert a visitor.");
      flags.push({ kind: "thin", weight: 18 });
      score += 14;
    }

    if (/wordpress\.org|powered by wordpress/i.test(html) && year && year <= 2021) {
      issues.push("Older WordPress install with a stale copyright year.");
      score += 6;
    }

    if (/(wix\.com|weebly\.com|squarespace\.com|godaddysites\.com)/i.test(html) && html.length < 8000) {
      issues.push("Template builder site with little unique content.");
      flags.push({ kind: "refresh", weight: 10 });
      score += 8;
    }

    if (!/<form\b/i.test(html) && !/tel:/i.test(html) && !/mailto:/i.test(html)) {
      issues.push("No obvious contact form, click-to-call, or email on the homepage.");
      flags.push({ kind: "refresh", weight: 9 });
      score += 7;
    }
  }

  score = Math.max(12, Math.min(98, score));
  let kind = pickKind(flags);
  if (kind === "healthy" && score >= 48) kind = "refresh";
  if (kind === "healthy" && score < 40 && issues.length === 0) {
    issues.push("Site looks reasonably current — a weaker outreach angle.");
  }

  return { score, kind, issues: issues.slice(0, 5) };
}

export function kindLabel(kind: OpportunityKind): string {
  switch (kind) {
    case "no_website":
      return "Needs a website";
    case "social_only":
      return "Social only";
    case "parked":
      return "Parked / unfinished";
    case "outdated":
      return "Outdated site";
    case "not_mobile":
      return "Not mobile-ready";
    case "insecure":
      return "No HTTPS";
    case "thin":
      return "Thin or broken";
    case "refresh":
      return "Ready for a refresh";
    default:
      return "Looks healthy";
  }
}

export function scoreTone(score: number): "hot" | "warm" | "cool" | "cold" {
  if (score >= 80) return "hot";
  if (score >= 62) return "warm";
  if (score >= 45) return "cool";
  return "cold";
}

export function compareLeads(a: Lead, b: Lead): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.name.localeCompare(b.name);
}
