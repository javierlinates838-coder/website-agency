import { describe, expect, it } from "vitest";
import { classifyOpportunity, isSocialOnlyWebsite, normalizeWebsite } from "../lib/score";
import { assertPublicHttpUrl } from "../lib/ssrf";
import { buildPitch } from "../lib/templates";
import { buildDemoLeads } from "../lib/demo";

describe("normalizeWebsite", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeWebsite("example.com")).toBe("https://example.com");
  });
});

describe("social detection", () => {
  it("treats facebook pages as social-only", () => {
    expect(isSocialOnlyWebsite("https://www.facebook.com/some-shop")).toBe(true);
    expect(isSocialOnlyWebsite("https://harbor-table.com")).toBe(false);
  });
});

describe("classifyOpportunity", () => {
  it("scores missing websites as the hottest leads", () => {
    const result = classifyOpportunity({ website: "" });
    expect(result.kind).toBe("no_website");
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("flags social profiles", () => {
    const result = classifyOpportunity({ website: "https://instagram.com/salon" });
    expect(result.kind).toBe("social_only");
  });

  it("flags dated, non-mobile homepages", () => {
    const html = `<html><head><title>Shop</title></head><body><p>Hi</p><p>Copyright 2018</p></body></html>`;
    const result = classifyOpportunity({
      website: "http://old-shop.test",
      html,
      finalUrl: "http://old-shop.test",
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.issues.join(" ")).toMatch(/HTTP|viewport|2018/i);
  });

  it("keeps healthy modern sites at a low opportunity score", () => {
    const html = `<!doctype html><html><head>
      <meta name="viewport" content="width=device-width">
      <title>Brightline Dental — Family dentistry in Austin</title>
      <meta name="description" content="Book a cleaning this week.">
    </head><body>
      <h1>Brightline Dental</h1>
      <form><input name="email"></form>
      <a href="tel:5125550100">Call</a>
      <p>Copyright 2026</p>
    </body></html>`;
    const result = classifyOpportunity({
      website: "https://brightline.test",
      html,
      finalUrl: "https://brightline.test",
    });
    expect(result.score).toBeLessThan(45);
    expect(result.kind).toBe("healthy");
  });
});

describe("ssrf guard", () => {
  it("blocks localhost and private IPs", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/admin")).toThrow();
    expect(() => assertPublicHttpUrl("http://192.168.1.8")).toThrow();
    expect(() => assertPublicHttpUrl("https://example.com")).not.toThrow();
  });
});

describe("pitches and demo leads", () => {
  it("builds an email that names the business", () => {
    const [lead] = buildDemoLeads("Austin, TX", "dentists");
    const pitch = buildPitch(lead, "email", { name: "Sam", studio: "Beacon", email: "sam@beacon.test" });
    expect(pitch).toContain(lead.name);
    expect(pitch).toContain("Sam");
  });

  it("returns demo leads sorted-ready with scores", () => {
    const leads = buildDemoLeads("Miami", "salons");
    expect(leads.length).toBeGreaterThan(5);
    expect(leads.some((lead) => lead.kind === "no_website")).toBe(true);
  });
});
