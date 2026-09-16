"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { INDUSTRIES } from "@/lib/industries";
import { compareLeads, kindLabel } from "@/lib/score";
import { loadPipeline, loadProfile, saveProfile, toCsv, upsertLead } from "@/lib/storage";
import { buildPitch } from "@/lib/templates";
import type { Lead, OpportunityKind, SearchResponse, StudioProfile } from "@/lib/types";
import { ScoreMark } from "./ScoreMark";

const FILTERS: { id: "all" | OpportunityKind; label: string }[] = [
  { id: "all", label: "All" },
  { id: "no_website", label: "No website" },
  { id: "social_only", label: "Social only" },
  { id: "outdated", label: "Outdated" },
  { id: "not_mobile", label: "Not mobile" },
  { id: "refresh", label: "Refresh" },
];

const SUGGESTIONS = [
  { city: "Austin, TX", industry: "dentists" },
  { city: "Miami, FL", industry: "salons" },
  { city: "Phoenix, AZ", industry: "plumbers" },
  { city: "Nashville, TN", industry: "restaurants" },
  { city: "Denver, CO", industry: "lawyers" },
  { city: "Dallas, TX", industry: "auto" },
];

async function analyzeLead(lead: Lead): Promise<Lead> {
  if (!lead.website || lead.kind === "social_only" || lead.kind === "no_website") {
    return { ...lead, analyzed: true };
  }
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ website: lead.website }),
  });
  if (!response.ok) return { ...lead, analyzed: true };
  const result = (await response.json()) as { score: number; kind: OpportunityKind; issues: string[] };
  return { ...lead, ...result, analyzed: true };
}

export function FinderApp() {
  const [city, setCity] = useState("Austin, TX");
  const [industry, setIndustry] = useState("dentists");
  const [radiusKm, setRadiusKm] = useState(8);
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [cityLabel, setCityLabel] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadPipeline().map((lead) => lead.id));
  const [pitchStyle, setPitchStyle] = useState<"email" | "sms" | "dm" | "voicemail">("email");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudioProfile>(() => loadProfile());
  const [showProfile, setShowProfile] = useState(false);

  const selected = leads.find((lead) => lead.id === selectedId) || leads[0] || null;

  const visible = useMemo(() => {
    const filtered = filter === "all" ? leads : leads.filter((lead) => lead.kind === filter);
    return [...filtered].sort(compareLeads);
  }, [leads, filter]);

  async function runSearch(nextCity = city, nextIndustry = industry, nextDemo = demo) {
    setLoading(true);
    setWarning(null);
    setNotice(null);
    setAnalyzing(0);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: nextCity, industry: nextIndustry, radiusKm, demo: nextDemo }),
      });
      const payload = (await response.json()) as SearchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Search failed");
      setLeads(payload.leads);
      setCityLabel(payload.cityLabel);
      setWarning(payload.warning || null);
      setSelectedId(payload.leads[0]?.id || null);
      setFilter("all");

      const pending = payload.leads.filter((lead) => !lead.analyzed && lead.website);
      if (pending.length > 0) {
        const next = [...payload.leads];
        for (let i = 0; i < pending.length; i += 3) {
          const batch = pending.slice(i, i + 3);
          setAnalyzing(Math.min(pending.length, i + batch.length));
          const scanned = await Promise.all(batch.map(analyzeLead));
          for (const updated of scanned) {
            const index = next.findIndex((lead) => lead.id === updated.id);
            if (index >= 0) next[index] = updated;
          }
          setLeads([...next].sort(compareLeads));
        }
      }
    } catch (error) {
      setWarning(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
      setAnalyzing(0);
    }
  }

  function saveSelected(lead: Lead) {
    upsertLead({ ...lead, status: "new" });
    setSavedIds((current) => (current.includes(lead.id) ? current : [lead.id, ...current]));
    setNotice(`${lead.name} is in your pipeline.`);
  }

  function copyPitch(lead: Lead) {
    const text = buildPitch(lead, pitchStyle, profile);
    void navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(visible)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `beacon-leads-${city.replace(/\s+/g, "-").toLowerCase()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function persistProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProfile(profile);
    setShowProfile(false);
    setNotice("Outreach profile saved on this device.");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-moss">Client finder</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Who needs a better website?</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowProfile((value) => !value)}
          className="self-start rounded-full border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper"
        >
          {profile.name || profile.studio ? "Edit outreach profile" : "Add your name to pitches"}
        </button>
      </div>

      {showProfile && (
        <form onSubmit={persistProfile} className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-clay p-5 sm:grid-cols-2">
          <label className="text-sm text-mist">
            Your name
            <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Studio name
            <input value={profile.studio} onChange={(event) => setProfile({ ...profile, studio: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Email
            <input value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Offer in one line
            <input value={profile.offer} onChange={(event) => setProfile({ ...profile, offer: event.target.value })} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink">
              Save profile
            </button>
          </div>
        </form>
      )}

      <form
        className="mt-8 grid gap-3 rounded-3xl border border-white/10 bg-clay/80 p-4 sm:grid-cols-12"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <label className="text-sm text-mist sm:col-span-4">
          City
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Austin, TX" />
        </label>
        <label className="text-sm text-mist sm:col-span-4">
          Trade
          <select value={industry} onChange={(event) => setIndustry(event.target.value)}>
            {INDUSTRIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-mist sm:col-span-2">
          Radius
          <select value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))}>
            {[5, 8, 12, 20].map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-moss px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
          >
            {loading ? "Scanning…" : "Find leads"}
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-mist sm:col-span-12">
          <input
            type="checkbox"
            className="h-4 w-4 accent-moss"
            checked={demo}
            onChange={(event) => setDemo(event.target.checked)}
          />
          Use sample leads only (skip live map data)
        </label>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((item) => (
          <button
            key={`${item.city}-${item.industry}`}
            type="button"
            className="chip"
            onClick={() => {
              setCity(item.city);
              setIndustry(item.industry);
              void runSearch(item.city, item.industry, demo);
            }}
          >
            {INDUSTRIES.find((row) => row.id === item.industry)?.label} in {item.city.split(",")[0]}
          </button>
        ))}
      </div>

      {(warning || notice) && (
        <p className="mt-5 rounded-2xl border border-white/10 bg-sand px-4 py-3 text-sm text-paper">
          {notice || warning}
        </p>
      )}

      {leads.length === 0 && !loading && (
        <div className="mt-10 rounded-[2rem] border border-dashed border-white/15 px-6 py-16 text-center">
          <p className="font-display text-3xl">Pick a city and a trade.</p>
          <p className="mx-auto mt-3 max-w-lg text-mist">
            Beacon will look up local businesses, score who still needs a website, and draft a message you can send today.
          </p>
        </div>
      )}

      {loading && (
        <p className="mt-8 text-sm text-mist">{analyzing > 0 ? `Reading websites… ${analyzing}` : "Looking up local businesses…"}</p>
      )}

      {leads.length > 0 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-mist">
                {visible.length} opportunities{cityLabel ? ` near ${cityLabel.split(",")[0]}` : ""}
              </p>
              <button type="button" onClick={exportCsv} className="text-sm text-moss hover:underline">
                Export CSV
              </button>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="chip"
                  data-active={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {visible.map((lead) => {
                const active = selected?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={`w-full rounded-3xl border p-4 text-left transition ${
                      active ? "border-moss/40 bg-clay shadow-glow" : "border-white/10 bg-clay/50 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg text-paper">{lead.name}</h2>
                          {lead.source === "demo" && (
                            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-mist">
                              Sample
                            </span>
                          )}
                          {savedIds.includes(lead.id) && (
                            <span className="rounded-full bg-moss/15 px-2 py-0.5 text-[10px] uppercase tracking-wider text-moss">
                              Saved
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-mist">
                          {lead.industryLabel} · {lead.address}
                        </p>
                      </div>
                      <ScoreMark score={lead.score} kind={lead.kind} />
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-paper/80">{lead.issues[0]}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {selected && (
            <aside className="h-fit rounded-[2rem] border border-white/10 bg-clay p-5 lg:sticky lg:top-6">
              <ScoreMark score={selected.score} kind={selected.kind} />
              <h2 className="mt-4 font-display text-3xl tracking-tight">{selected.name}</h2>
              <p className="mt-2 text-sm text-mist">
                {selected.industryLabel} · {selected.address}
              </p>
              <dl className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-mist">Phone</dt>
                  <dd>{selected.phone || "Not listed"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-mist">Website</dt>
                  <dd className="truncate text-right">
                    {selected.website ? (
                      <a className="text-moss hover:underline" href={selected.website} target="_blank" rel="noreferrer">
                        {selected.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "None listed"
                    )}
                  </dd>
                </div>
              </dl>
              <ul className="mt-5 space-y-2 text-sm text-paper/85">
                {selected.issues.map((issue) => (
                  <li key={issue} className="border-t border-white/5 pt-2">
                    {issue}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveSelected(selected)}
                  className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink"
                >
                  {savedIds.includes(selected.id) ? "Saved" : "Save to pipeline"}
                </button>
                <a
                  className="rounded-full border border-white/15 px-4 py-2 text-sm"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.name} ${selected.address}`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Maps
                </a>
                {selected.phone && (
                  <a className="rounded-full border border-white/15 px-4 py-2 text-sm" href={`tel:${selected.phone}`}>
                    Call
                  </a>
                )}
                <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" href="/pipeline">
                  Open pipeline
                </Link>
              </div>

              <div className="mt-8">
                <div className="flex flex-wrap gap-2">
                  {(["email", "sms", "dm", "voicemail"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      className="chip capitalize"
                      data-active={pitchStyle === style}
                      onClick={() => setPitchStyle(style)}
                    >
                      {style}
                    </button>
                  ))}
                </div>
                <textarea
                  readOnly
                  className="mt-3 min-h-48 text-sm leading-6"
                  value={buildPitch(selected, pitchStyle, profile)}
                />
                <button
                  type="button"
                  onClick={() => copyPitch(selected)}
                  className="mt-3 whitespace-nowrap rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink"
                >
                  {copied ? "Copied" : "Copy pitch"}
                </button>
                <p className="mt-3 text-xs text-mist">
                  {kindLabel(selected.kind)} is the angle. Keep it specific and short — nobody wants a spray of cold spam.
                </p>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
