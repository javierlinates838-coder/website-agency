"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { loadPipeline, loadProfile, saveProfile, upsertLead } from "@/lib/storage";
import type { StudioProfile } from "@/lib/types";
import {
  BAKERSFIELD_MARKET,
  VERIFIED_BENCH,
  VERIFIED_PARKED,
  VERIFIED_TOP5,
  canContact,
  telHref,
  verifiedToLead,
  type VerifiedLead,
} from "@/lib/verified";
import {
  buildVerifiedCallScript,
  buildVerifiedEmail,
  buildVerifiedVoicemail,
} from "@/lib/verifiedScripts";

type ScriptKind = "call" | "email" | "voicemail";

export function VerifiedDesk() {
  const [selectedId, setSelectedId] = useState(VERIFIED_TOP5[0].id);
  const [scriptKind, setScriptKind] = useState<ScriptKind>("call");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => loadPipeline().map((lead) => lead.id));
  const [profile, setProfile] = useState<StudioProfile>(() => loadProfile());
  const [showProfile, setShowProfile] = useState(false);

  const selected = useMemo(
    () => VERIFIED_TOP5.find((lead) => lead.id === selectedId) || VERIFIED_TOP5[0],
    [selectedId],
  );

  const script = useMemo(() => {
    if (scriptKind === "email") return buildVerifiedEmail(selected, profile);
    if (scriptKind === "voicemail") return buildVerifiedVoicemail(selected, profile);
    return buildVerifiedCallScript(selected, profile);
  }, [selected, scriptKind, profile]);

  function copyScript() {
    void navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function saveLead(lead: VerifiedLead) {
    if (!canContact(lead)) {
      setNotice(`${lead.name} is parked. Do not save it as outreach.`);
      return;
    }
    upsertLead(verifiedToLead(lead));
    setSavedIds((current) => {
      const id = `verified:${lead.id}`;
      return current.includes(id) ? current : [id, ...current];
    });
    setNotice(`${lead.name} is in your pipeline. Scripts stay on this desk until you send them.`);
  }

  function persistProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveProfile(profile);
    setShowProfile(false);
    setNotice("Your name is now in the scripts.");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-moss">Verified desk</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">{BAKERSFIELD_MARKET.label}</h1>
          <p className="mt-3 max-w-2xl text-mist">{BAKERSFIELD_MARKET.note}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowProfile((value) => !value)}
          className="self-start rounded-full border border-white/10 px-4 py-2 text-sm text-mist hover:text-paper"
        >
          {profile.name ? "Edit your name" : "Put your name on the scripts"}
        </button>
      </div>

      {showProfile && (
        <form
          onSubmit={persistProfile}
          className="mt-6 grid gap-3 rounded-3xl border border-white/10 bg-clay p-5 sm:grid-cols-3"
        >
          <label className="text-sm text-mist">
            Your name
            <input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Studio
            <input value={profile.studio} onChange={(event) => setProfile({ ...profile, studio: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Email
            <input value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink">
              Save
            </button>
          </div>
        </form>
      )}

      <p className="mt-6 rounded-2xl border border-white/10 bg-sand px-4 py-3 text-sm text-paper">
        {BAKERSFIELD_MARKET.sources} Johnny&apos;s Barber is HOLD. Oildale Barber is DNC. Everything in the Top 5 is
        safe to pursue — you still have to send it.
      </p>

      {notice && (
        <p className="mt-3 rounded-2xl border border-moss/30 bg-moss/10 px-4 py-3 text-sm text-paper">{notice}</p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <section className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-mist">Final Top 5 — safe to pursue</p>
          {VERIFIED_TOP5.map((lead) => {
            const active = selected.id === lead.id;
            const saved = savedIds.includes(`verified:${lead.id}`);
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
                    <p className="text-xs uppercase tracking-[0.16em] text-mist">
                      #{lead.rank} · {lead.intent}
                    </p>
                    <h2 className="mt-1 text-lg text-paper">{lead.name}</h2>
                    <p className="mt-1 text-sm text-mist">
                      {lead.trade} · {lead.address}
                    </p>
                  </div>
                  <span className="rounded-full bg-moss/15 px-3 py-1 text-[11px] uppercase tracking-wider text-moss">
                    {lead.play === "redesign" ? "Redesign" : "No website"}
                  </span>
                </div>
                {saved && <p className="mt-2 text-xs uppercase tracking-wider text-moss">In pipeline</p>}
              </button>
            );
          })}
        </section>

        <aside className="h-fit rounded-[2rem] border border-white/10 bg-clay p-5 lg:sticky lg:top-24">
          <p className="text-xs uppercase tracking-[0.16em] text-moss">
            #{selected.rank} · {selected.intent} · {selected.play}
          </p>
          <h2 className="mt-2 font-display text-3xl tracking-tight">{selected.name}</h2>
          <p className="mt-2 text-sm text-mist">{selected.why}</p>

          <dl className="mt-5 space-y-2 text-sm">
            <Row label="Call" value={selected.phone || "—"} href={selected.phone ? telHref(selected.phone) : undefined} />
            <Row label="Email" value={selected.email || "None on file — follow the call"} href={selected.email ? `mailto:${selected.email}` : undefined} />
            <Row label="Address" value={selected.address} />
            {selected.mailing && <Row label="Mail" value={selected.mailing} />}
            {selected.license && <Row label="License" value={selected.license} />}
            <Row
              label="Website"
              value={selected.websiteNote || selected.website || "None"}
              href={selected.website}
            />
          </dl>

          {selected.doNot.length > 0 && (
            <ul className="mt-5 space-y-2 rounded-2xl border border-ember/40 bg-ember/10 p-4 text-sm">
              {selected.doNot.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveLead(selected)}
              className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink"
            >
              {savedIds.includes(`verified:${selected.id}`) ? "Saved" : "Save to pipeline"}
            </button>
            {selected.phone && (
              <a className="rounded-full border border-white/15 px-4 py-2 text-sm" href={telHref(selected.phone)}>
                Dial
              </a>
            )}
            {selected.email && (
              <a className="rounded-full border border-white/15 px-4 py-2 text-sm" href={`mailto:${selected.email}`}>
                Email
              </a>
            )}
            <Link className="rounded-full border border-white/15 px-4 py-2 text-sm" href="/pipeline">
              Open pipeline
            </Link>
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap gap-2">
              {(["call", "email", "voicemail"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="chip capitalize"
                  data-active={scriptKind === kind}
                  onClick={() => setScriptKind(kind)}
                >
                  {kind} script
                </button>
              ))}
            </div>
            <textarea readOnly className="mt-3 min-h-64 text-sm leading-6" value={script} />
            <button
              type="button"
              onClick={copyScript}
              className="mt-3 whitespace-nowrap rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink"
            >
              {copied ? "Copied" : "Copy script"}
            </button>
          </div>
        </aside>
      </div>

      <section className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-ember/30 bg-clay p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-ember">Parked — no outreach</p>
          <ul className="mt-4 space-y-4">
            {VERIFIED_PARKED.map((lead) => (
              <li key={lead.id}>
                <p className="text-paper">
                  {lead.name}{" "}
                  <span className="text-xs uppercase tracking-wider text-ember">
                    {lead.status === "dnc" ? "DNC" : "HOLD"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-mist">{lead.why}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-white/10 bg-clay p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-mist">Safe, outside Top 5</p>
          <p className="mt-2 text-sm text-mist">
            Cleared, but not the first five to call. Use as replacements only if a Top 5 name parks.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {VERIFIED_BENCH.map((name) => (
              <li key={name} className="rounded-full border border-white/10 px-3 py-1 text-sm">
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-white/5 pt-2">
      <dt className="text-mist">{label}</dt>
      <dd className="text-right">
        {href ? (
          <a className="text-moss hover:underline" href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
