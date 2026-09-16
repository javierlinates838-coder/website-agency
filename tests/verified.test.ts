import { describe, expect, it } from "vitest";
import {
  VERIFIED_PARKED,
  VERIFIED_TOP5,
  canContact,
  verifiedToLead,
} from "../lib/verified";
import {
  buildVerifiedCallScript,
  buildVerifiedEmail,
} from "../lib/verifiedScripts";

const profile = { name: "Sam", studio: "Beacon", email: "sam@beacon.test" };

describe("Bakersfield verified desk", () => {
  it("keeps five safe leads and two parked names", () => {
    expect(VERIFIED_TOP5).toHaveLength(5);
    expect(VERIFIED_TOP5.every(canContact)).toBe(true);
    expect(VERIFIED_PARKED.map((lead) => lead.status).sort()).toEqual(["dnc", "hold"]);
    expect(VERIFIED_PARKED.every((lead) => !canContact(lead))).toBe(true);
  });

  it("uses only the cleared White Lane number", () => {
    const donuts = VERIFIED_TOP5[0];
    const call = buildVerifiedCallScript(donuts, profile);
    expect(call).toContain("836-2906");
    expect(call).toContain("827-9606");
    expect(call).toMatch(/Call \(661\) 836-2906 only/);
  });

  it("keeps Hector's Briceno pitch off the other identity", () => {
    const hector = VERIFIED_TOP5.find((lead) => lead.id === "briceno-electric-hector");
    expect(hector).toBeTruthy();
    const email = buildVerifiedEmail(hector!, profile);
    const call = buildVerifiedCallScript(hector!, profile);
    expect(email).toContain("Hector");
    expect(email).toContain("900822");
    expect(email).toMatch(/do not email williamb@/i);
    expect(email).not.toMatch(/^To: williamb/m);
    expect(call).toMatch(/Do not mention bricenoelectric\.com/);
    expect(call).toContain("599-9646");
  });

  it("blocks scripts for HOLD and DNC", () => {
    const hold = VERIFIED_PARKED.find((lead) => lead.status === "hold")!;
    const dnc = VERIFIED_PARKED.find((lead) => lead.status === "dnc")!;
    expect(buildVerifiedCallScript(hold)).toMatch(/HOLD/);
    expect(buildVerifiedEmail(dnc)).toMatch(/DO NOT CONTACT/);
  });

  it("routes Hometown off Norris Rd and Luna as a redesign", () => {
    const plumbing = VERIFIED_TOP5.find((lead) => lead.id === "hometown-plumbing")!;
    const luna = VERIFIED_TOP5.find((lead) => lead.id === "luna-electric")!;
    expect(buildVerifiedCallScript(plumbing, profile)).toContain("Empire State");
    expect(buildVerifiedCallScript(plumbing, profile)).toContain("Norris");
    expect(buildVerifiedEmail(luna, profile)).toContain("accounting@lunaelectric07.com");
    expect(luna.play).toBe("redesign");
    const asLead = verifiedToLead(plumbing);
    expect(asLead.source).toBe("verified");
    expect(asLead.email).toBe("hometownplumbing@att.net");
  });
});
