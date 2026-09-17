"use client";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  buildBrief,
  contactabilityLabel,
  finalizeQualify,
  formatBuildBrief,
  isDemoCandidate,
  prefillDeepQualify,
  recommendAction,
  resolveSuggestedAction,
  websiteFitFromNiche,
} from "@/lib/qualify";
import type {
  ActiveStatus,
  Confidence,
  Contactability,
  DeepQualifyResult,
  Lead,
  RecommendedAction,
} from "@/lib/types";

const ACTIONS: RecommendedAction[] = ["PURSUE", "MAYBE", "SKIP", "HOLD", "DNC"];
const ACTIVE: ActiveStatus[] = ["active", "unclear", "inactive"];
const CONFIDENCE: Confidence[] = ["HIGH", "MEDIUM", "LOW"];

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  const editableAttr = target.getAttribute("contenteditable");
  if (target.isContentEditable || editableAttr === "" || editableAttr === "true" || editableAttr === "plaintext-only") {
    return true;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']"));
}

export function shouldCloseModalOnEscape(event: { key: string; target: EventTarget | null }): boolean {
  return event.key === "Escape" && !isEditableTarget(event.target);
}

function stopModalEvent(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function DeepQualifyPanel({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (result: DeepQualifyResult, demoCandidate: boolean) => void;
}) {
  const seeded = useMemo(() => prefillDeepQualify(lead), [lead]);
  const [draft, setDraft] = useState<DeepQualifyResult>(seeded);
  const [actionOverridden, setActionOverridden] = useState(() => Boolean(lead.deepQualify));
  const [copied, setCopied] = useState(false);
  const [qualityInput, setQualityInput] = useState(
    seeded.businessQuality === "unknown" ? "" : String(seeded.businessQuality),
  );

  const computedFit = useMemo(
    () => websiteFitFromNiche(draft.niche || lead.industryLabel, lead.industry),
    [draft.niche, lead.industry, lead.industryLabel],
  );
  const computedAction = useMemo(
    () =>
      recommendAction({
        name: draft.businessName,
        phone: draft.phone,
        activeStatus: draft.activeStatus,
        websiteFit: draft.websiteFit,
        opportunityScore: draft.opportunityScore,
        contactability: draft.contactability,
      }),
    [draft.businessName, draft.phone, draft.activeStatus, draft.websiteFit, draft.opportunityScore, draft.contactability],
  );
  const suggestedAction = resolveSuggestedAction({
    savedOrDraft: draft.recommendedAction,
    overridden: actionOverridden || Boolean(lead.deepQualify),
    computed: computedAction,
  });
  const preview: DeepQualifyResult = {
    ...draft,
    recommendedAction: suggestedAction,
  };
  const demoNow = isDemoCandidate(preview, lead);
  const brief = preview.buildBrief || (demoNow ? buildBrief(preview, lead) : undefined);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      // Backspace outside a field can trigger browser-back and unmount the modal.
      if (event.key === "Backspace") event.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleBackdropClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    onClose();
  }

  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    stopModalEvent(event);
    if (!shouldCloseModalOnEscape(event)) return;
    event.preventDefault();
    onClose();
  }

  function patch(partial: Partial<DeepQualifyResult>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function setContact(key: keyof Contactability) {
    patch({ contactability: { ...draft.contactability, [key]: !draft.contactability[key] } });
  }

  function setOpportunityAt(index: number, value: string) {
    const next = [...draft.opportunities];
    next[index] = value;
    while (next.length < 3) next.push("");
    patch({ opportunities: next.slice(0, 3) });
  }

  function save() {
    const quality = qualityInput.trim();
    const withQuality: DeepQualifyResult = {
      ...draft,
      businessQuality: quality === "" ? "unknown" : Number(quality),
    };
    const { result, demoCandidate } = finalizeQualify(
      withQuality,
      lead,
      actionOverridden || Boolean(lead.deepQualify),
    );
    onSave(result, demoCandidate);
  }

  async function copyBrief() {
    if (!brief) return;
    await navigator.clipboard.writeText(formatBuildBrief(brief, draft.businessName));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function generateBrief() {
    if (!demoNow) return;
    patch({ buildBrief: buildBrief(preview, lead) });
  }

  const opportunities = [0, 1, 2].map((index) => draft.opportunities[index] || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-3 sm:items-center"
      data-testid="deep-qualify-backdrop"
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deep-qualify-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-clay p-5 shadow-glow sm:p-6"
        onClick={stopModalEvent}
        onPointerDown={stopModalEvent}
        onMouseDown={stopModalEvent}
        onKeyDown={handlePanelKeyDown}
        onKeyUp={stopModalEvent}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-moss">Deep Qualify</p>
            <h2 id="deep-qualify-title" className="mt-1 font-display text-3xl tracking-tight">
              {lead.name}
            </h2>
            <p className="mt-1 text-sm text-mist">
              Manual check — a missing website is not enough. Confirm fit, need, and a real way to reach them.
            </p>
          </div>
          <button type="button" className="rounded-full border border-white/10 px-3 py-1 text-sm text-mist" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          <Signal label="Opportunity" value={String(draft.opportunityScore)} />
          <Signal label="Website Fit" value={String(draft.websiteFit)} />
          <Signal label="Confidence" value={draft.confidence} />
          <Signal label="Contactability" value={contactabilityLabel(draft.contactability)} />
        </div>
        {draft.businessQuality !== "unknown" && (
          <p className="mt-2 text-xs text-mist">Business Quality {draft.businessQuality} (user-supplied)</p>
        )}
        <p className="mt-3 text-sm">
          Suggested action <span className="text-moss">{suggestedAction}</span>
          {demoNow ? " · Demo candidate" : ""}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-mist">
            Business name
            <input value={draft.businessName} onChange={(event) => patch({ businessName: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Niche
            <input value={draft.niche} onChange={(event) => patch({ niche: event.target.value })} />
          </label>
          <label className="text-sm text-mist">
            Phone
            <input value={draft.phone || ""} onChange={(event) => patch({ phone: event.target.value || undefined })} />
          </label>
          <label className="text-sm text-mist">
            Official website
            <input
              value={draft.officialWebsite || ""}
              onChange={(event) => patch({ officialWebsite: event.target.value || undefined })}
            />
          </label>
          <label className="text-sm text-mist">
            Active status
            <select
              value={draft.activeStatus}
              onChange={(event) => patch({ activeStatus: event.target.value as ActiveStatus })}
            >
              {ACTIVE.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-mist">
            Confidence
            <select
              value={draft.confidence}
              onChange={(event) => patch({ confidence: event.target.value as Confidence })}
            >
              {CONFIDENCE.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-mist">
            Opportunity Score (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={draft.opportunityScore}
              onChange={(event) => patch({ opportunityScore: Number(event.target.value) })}
            />
          </label>
          <label className="text-sm text-mist">
            Website Fit (0–100)
            <input
              type="number"
              min={0}
              max={100}
              value={draft.websiteFit}
              onChange={(event) => patch({ websiteFit: Number(event.target.value) })}
            />
            <span className="mt-1 block text-[11px] text-mist/80">
              Computed {computedFit.score} ({computedFit.band}
              {computedFit.matched.length ? `: ${computedFit.matched.join(", ")}` : ", no keyword match"})
            </span>
          </label>
          <label className="text-sm text-mist">
            Business Quality (optional)
            <input
              type="number"
              min={0}
              max={100}
              placeholder="Unknown — leave blank"
              value={qualityInput}
              onChange={(event) => {
                setQualityInput(event.target.value);
                const value = event.target.value.trim();
                patch({ businessQuality: value === "" ? "unknown" : Number(value) });
              }}
            />
            <span className="mt-1 block text-[11px] text-mist/80">
              Leave blank unless you have reliable evidence. Do not guess from a missing website.
            </span>
          </label>
          <label className="text-sm text-mist">
            Recommended action
            <select
              value={suggestedAction}
              onChange={(event) => {
                setActionOverridden(true);
                patch({ recommendedAction: event.target.value as RecommendedAction });
              }}
            >
              {ACTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-wider text-mist">Contactability</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["phone", "Phone"],
              ["email", "Email"],
              ["contactForm", "Contact form"],
              ["social", "Social"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="chip"
              data-active={draft.contactability[key] ? "true" : "false"}
              onClick={() => setContact(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11px] uppercase tracking-wider text-mist">Top 3 opportunities</p>
        <div className="mt-2 space-y-2">
          {opportunities.map((value, index) => (
            <input
              key={index}
              value={value}
              placeholder={`Opportunity ${index + 1}`}
              onChange={(event) => setOpportunityAt(index, event.target.value)}
            />
          ))}
        </div>

        <label className="mt-3 block text-sm text-mist">
          Risks / conflicts
          <textarea
            className="mt-1 min-h-20"
            value={draft.risks.join("\n")}
            onChange={(event) =>
              patch({ risks: event.target.value.split("\n").map((item) => item.trimEnd()) })
            }
          />
        </label>
        <label className="mt-3 block text-sm text-mist">
          Evidence URLs (optional)
          <textarea
            className="mt-1 min-h-16"
            placeholder="One URL per line"
            value={(draft.sources || []).join("\n")}
            onChange={(event) => patch({ sources: event.target.value.split("\n") })}
          />
        </label>

        {draft.facts && draft.facts.length > 0 && (
          <details className="mt-4 text-xs text-mist">
            <summary className="cursor-pointer text-[11px] uppercase tracking-wider">Facts vs inferences</summary>
            <p className="mt-2 font-medium text-paper/80">Facts</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {draft.facts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {draft.inferences && (
              <>
                <p className="mt-2 font-medium text-paper/80">Inferences</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {draft.inferences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </details>
        )}

        <div className="mt-5 rounded-2xl border border-white/10 bg-ink/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-paper">Build brief {demoNow ? "" : "(Demo Candidate only)"}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!demoNow}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-mist disabled:opacity-40"
                onClick={generateBrief}
              >
                Generate
              </button>
              <button
                type="button"
                disabled={!brief}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-mist disabled:opacity-40"
                onClick={() => void copyBrief()}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          {brief ? (
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-mist">
              {formatBuildBrief(brief, draft.businessName)}
            </pre>
          ) : (
            <p className="mt-2 text-xs text-mist">
              Gates: active, confidence not LOW, Website Fit ≥ 70, Opportunity ≥ 55, a real contact method, and PURSUE.
              HOLD/DNC names cannot be demo candidates.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-full border border-white/10 px-4 py-2 text-sm text-mist" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink" onClick={save}>
            Save qualification
          </button>
        </div>
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-mist">{label}</p>
      <p className="mt-1 text-sm text-paper">{value}</p>
    </div>
  );
}
