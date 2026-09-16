import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../lib/types";
import { migrateLeadStatus, loadPipeline, savePipeline, updateLead, upsertLead } from "../lib/storage";
import { verifiedToLead, VERIFIED_TOP5 } from "../lib/verified";

const memory = new Map<string, string>();

function installStorage() {
  memory.clear();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
}

function liveLead(over: Partial<Lead> = {}): Lead {
  return {
    id: "osm:shop",
    name: "Cedar Street Salon",
    industry: "salons",
    industryLabel: "Salons",
    city: "Austin, TX",
    address: "12 Cedar St",
    phone: "512-555-0199",
    score: 88,
    kind: "social_only",
    issues: ["Social only"],
    source: "live",
    analyzed: true,
    ...over,
  };
}

describe("migrateLeadStatus", () => {
  it("maps old pipeline columns onto the five user-facing statuses", () => {
    expect(migrateLeadStatus("meeting")).toBe("follow_up");
    expect(migrateLeadStatus("proposal")).toBe("follow_up");
    expect(migrateLeadStatus("passed")).toBe("lost");
    expect(migrateLeadStatus("new")).toBe("new");
    expect(migrateLeadStatus("contacted")).toBe("contacted");
    expect(migrateLeadStatus("won")).toBe("won");
    expect(migrateLeadStatus("follow_up")).toBe("follow_up");
    expect(migrateLeadStatus("lost")).toBe("lost");
    expect(migrateLeadStatus("mystery")).toBe("new");
  });
});

describe("pipeline persistence", () => {
  beforeEach(() => {
    installStorage();
  });

  it("migrates old statuses once on load", () => {
    const stale = (status: string, over: Partial<Lead> = {}): Omit<Lead, "status"> & { status: string } => ({
      ...liveLead(over),
      status,
    });
    window.localStorage.setItem(
      "beacon-pipeline",
      JSON.stringify([
        stale("meeting", { id: "a" }),
        stale("proposal", { id: "b", name: "Two" }),
        stale("passed", { id: "c", name: "Three" }),
      ]),
    );
    const loaded = loadPipeline();
    expect(loaded.map((lead) => lead.status)).toEqual(["follow_up", "follow_up", "lost"]);
    expect(JSON.parse(window.localStorage.getItem("beacon-pipeline") || "[]").map((lead: Lead) => lead.status)).toEqual([
      "follow_up",
      "follow_up",
      "lost",
    ]);
  });

  it("persists notes and follow-up dates", () => {
    upsertLead(liveLead({ status: "new" }));
    updateLead("osm:shop", { notes: "Left voicemail", followUpDate: "2026-09-20", status: "follow_up" });
    const loaded = loadPipeline();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].notes).toBe("Left voicemail");
    expect(loaded[0].followUpDate).toBe("2026-09-20");
    expect(loaded[0].status).toBe("follow_up");
  });

  it("does not reset notes, follow-up, or status when the same lead is saved again", () => {
    upsertLead(liveLead({ status: "new" }));
    updateLead("osm:shop", { notes: "Keep me", followUpDate: "2026-09-22", status: "contacted" });
    upsertLead(liveLead({ status: "new", notes: "do not replace" }));
    const loaded = loadPipeline();
    expect(loaded[0].notes).toBe("Keep me");
    expect(loaded[0].followUpDate).toBe("2026-09-22");
    expect(loaded[0].status).toBe("contacted");
  });

  it("blocks HOLD/DNC names from being saved", () => {
    const before = upsertLead(liveLead({ name: "Johnny's Barber", phone: undefined }));
    expect(before).toEqual([]);
    upsertLead(liveLead({ id: "dnc", name: "Oildale Barber" }));
    expect(loadPipeline()).toEqual([]);
    upsertLead(verifiedToLead(VERIFIED_TOP5[0]));
    expect(loadPipeline()).toHaveLength(1);
    expect(loadPipeline()[0].id).toBe("verified:white-lane-donuts");
  });

  it("migrates stale statuses on upsert so old columns cannot be written back", () => {
    upsertLead({ ...liveLead(), status: "meeting" } as unknown as Lead);
    expect(loadPipeline()[0].status).toBe("follow_up");
    upsertLead({ ...liveLead(), id: "two", name: "Two", status: "passed" } as unknown as Lead);
    expect(loadPipeline().find((lead) => lead.id === "two")?.status).toBe("lost");
  });

  it("round-trips a cleared board", () => {
    upsertLead(liveLead());
    savePipeline([]);
    expect(loadPipeline()).toEqual([]);
  });
});
