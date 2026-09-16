"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { kindLabel } from "@/lib/score";
import { loadPipeline, removeLead, savePipeline, toCsv, updateLead, updateLeadStatus } from "@/lib/storage";
import type { Lead, LeadStatus } from "@/lib/types";
import { ScoreMark } from "./ScoreMark";

const COLUMNS: { id: LeadStatus; label: string; hint: string }[] = [
  { id: "new", label: "New", hint: "Not contacted" },
  { id: "contacted", label: "Contacted", hint: "You reached out" },
  { id: "follow_up", label: "Follow Up", hint: "Waiting on them" },
  { id: "won", label: "Won", hint: "Booked work" },
  { id: "lost", label: "Lost", hint: "Not a fit" },
];

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PipelineBoard() {
  const [leads, setLeads] = useState<Lead[]>(() => loadPipeline());
  const [dragging, setDragging] = useState<string | null>(null);

  const grouped = useMemo(() => {
    return COLUMNS.reduce(
      (acc, column) => {
        acc[column.id] = leads.filter((lead) => (lead.status || "new") === column.id);
        return acc;
      },
      {} as Record<LeadStatus, Lead[]>,
    );
  }, [leads]);

  function move(id: string, status: LeadStatus) {
    setLeads(updateLeadStatus(id, status));
  }

  function drop(status: LeadStatus) {
    if (!dragging) return;
    move(dragging, status);
    setDragging(null);
  }

  function clear(id: string) {
    setLeads(removeLead(id));
  }

  function patch(id: string, fields: Partial<Pick<Lead, "notes" | "followUpDate">>) {
    setLeads(updateLead(id, fields));
  }

  function exportAll() {
    const blob = new Blob([toCsv(leads)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "beacon-pipeline.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    savePipeline([]);
    setLeads([]);
  }

  if (leads.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-white/15 px-6 py-16 text-center">
        <p className="font-display text-3xl">No saved businesses yet.</p>
        <p className="mx-auto mt-3 max-w-md text-mist">
          Start on the verified desk, or find the next city. Save a name and it lands here so you can update status,
          notes, and a follow-up date.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/desk" className="inline-flex rounded-full bg-moss px-4 py-2 text-sm font-medium text-ink">
            Open the desk
          </Link>
          <Link href="/finder" className="inline-flex rounded-full border border-white/15 px-4 py-2 text-sm">
            Find leads
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">{leads.length} businesses on the board</p>
        <div className="flex gap-3 text-sm">
          <button type="button" className="text-moss hover:underline" onClick={exportAll}>
            Export CSV
          </button>
          <button type="button" className="text-mist hover:text-paper" onClick={reset}>
            Clear board
          </button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <section
            key={column.id}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => drop(column.id)}
            className="min-h-48 rounded-3xl border border-white/10 bg-clay/70 p-3"
          >
            <div className="mb-3 flex items-baseline justify-between px-1">
              <h2 className="text-sm uppercase tracking-[0.16em] text-paper">{column.label}</h2>
              <span className="text-xs text-mist">{grouped[column.id].length}</span>
            </div>
            <p className="mb-3 px-1 text-xs text-mist">{column.hint}</p>
            <div className="space-y-2">
              {grouped[column.id].map((lead) => {
                const overdue = Boolean(lead.followUpDate && lead.followUpDate < todayStamp() && lead.status === "follow_up");
                return (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={() => setDragging(lead.id)}
                    className="cursor-grab rounded-2xl border border-white/10 bg-ink p-3 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm text-paper">{lead.name}</h3>
                        <p className="text-xs text-mist">
                          {lead.city} · {kindLabel(lead.kind)}
                          {lead.source === "verified" ? " · Verified" : lead.source === "demo" ? " · Sample" : " · Live"}
                        </p>
                      </div>
                      <ScoreMark score={lead.score} kind={lead.kind} compact />
                    </div>
                    {lead.phone && <p className="mt-2 text-xs text-mist">{lead.phone}</p>}
                    <label className="mt-3 block text-[11px] uppercase tracking-wider text-mist">
                      Status
                      <select
                        className="mt-1 py-1.5 text-xs"
                        value={lead.status || "new"}
                        onChange={(event) => move(lead.id, event.target.value as LeadStatus)}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        {COLUMNS.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-2 block text-[11px] uppercase tracking-wider text-mist">
                      Follow-up
                      <input
                        type="date"
                        className={`mt-1 py-1.5 text-xs ${overdue ? "border-ember/50" : ""}`}
                        value={lead.followUpDate || ""}
                        onChange={(event) => patch(lead.id, { followUpDate: event.target.value || undefined })}
                        onPointerDown={(event) => event.stopPropagation()}
                      />
                    </label>
                    {overdue && <p className="mt-1 text-[11px] text-ember">Follow-up is due</p>}
                    <label className="mt-2 block text-[11px] uppercase tracking-wider text-mist">
                      Notes
                      <textarea
                        className="mt-1 min-h-16 py-1.5 text-xs leading-5"
                        value={lead.notes || ""}
                        onChange={(event) => patch(lead.id, { notes: event.target.value })}
                        onPointerDown={(event) => event.stopPropagation()}
                        placeholder="What you said, what they said"
                      />
                    </label>
                    <button
                      type="button"
                      className="mt-2 rounded-full border border-white/10 px-2 py-1 text-[11px] text-ember"
                      onClick={() => clear(lead.id)}
                    >
                      Remove
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
