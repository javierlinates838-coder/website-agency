import type { Lead, StudioProfile } from "./types";
import { kindLabel } from "./score";

const DEFAULT_PROFILE: StudioProfile = {
  name: "Alex",
  studio: "your studio",
  email: "hello@studio.test",
  city: "",
  offer: "a modern site that actually brings in calls",
};

export function withProfile(profile?: Partial<StudioProfile> | null): StudioProfile {
  return { ...DEFAULT_PROFILE, ...profile };
}

export function issueSummary(lead: Lead): string {
  if (lead.issues[0]) return lead.issues[0].replace(/\s+/g, " ").trim();
  return `${kindLabel(lead.kind).toLowerCase()} is the opening.`;
}

export function buildPitch(
  lead: Lead,
  style: "email" | "sms" | "dm" | "voicemail",
  profile?: Partial<StudioProfile> | null,
): string {
  const who = withProfile(profile);
  const studio = who.studio || "my studio";
  const offer = who.offer || "a cleaner website that turns search traffic into booked work";
  const hook = issueSummary(lead);
  const cityBit = lead.city ? ` in ${lead.city}` : "";

  if (style === "sms") {
    return `Hi, this is ${who.name} from ${studio}. I was looking at local ${lead.industryLabel.toLowerCase()}${cityBit} and noticed ${lead.name}: ${hook} Happy to sketch a simple site this week if useful — ${who.email}`;
  }

  if (style === "dm") {
    return `Hey ${lead.name.split(" ")[0]} — I’m ${who.name}. I help ${lead.industryLabel.toLowerCase()} ${cityBit.trim()} get found by people already searching. Quick look at ${lead.name}: ${hook} If you want, I can send a 3-screen mock before we talk.`;
  }

  if (style === "voicemail") {
    return `Hi, this is ${who.name} with ${studio}. I’m leaving a note for ${lead.name}. I work with ${lead.industryLabel.toLowerCase()} ${cityBit.trim()} whose sites are costing them calls. ${hook} I’ll follow up by email at ${who.email}. If you want a fast redesign quote, just call me back.`;
  }

  return `Subject: A small website fix for ${lead.name}

Hi ${lead.name} team,

I’m ${who.name} at ${studio}. I build sites for ${lead.industryLabel.toLowerCase()}${cityBit}, and I looked you up while researching businesses that are easy to help.

What I noticed: ${hook}

People already search for what you do. A site that loads on a phone, explains the offer, and makes it obvious how to call or book is usually enough — ${offer}.

If you’re open to it, I can send a short mock of a homepage built around ${lead.name} (no obligation). Worst case you get a free sketch of how the shop could look.

— ${who.name}
${studio}
${who.email}`;
}
