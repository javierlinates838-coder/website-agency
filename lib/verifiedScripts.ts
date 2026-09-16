import type { StudioProfile } from "./types";
import { canContact, type VerifiedLead } from "./verified";

function who(profile?: Partial<StudioProfile> | null) {
  return {
    name: profile?.name?.trim() || "[your name]",
    studio: profile?.studio?.trim() || "[your studio]",
    email: profile?.email?.trim() || "[your email]",
  };
}

function blocked(lead: VerifiedLead): string {
  if (lead.status === "dnc") {
    return `DO NOT CONTACT ${lead.name}. ${lead.why}`;
  }
  return `HOLD — do not outreach ${lead.name} yet. ${lead.why}`;
}

function signoff(profile?: Partial<StudioProfile> | null): string {
  const { name, studio, email } = who(profile);
  return `— ${name}\n${studio}\n${email}`;
}

export function buildVerifiedCallScript(
  lead: VerifiedLead,
  profile?: Partial<StudioProfile> | null,
): string {
  if (!canContact(lead)) return blocked(lead);
  const { name, studio } = who(profile);

  switch (lead.id) {
    case "white-lane-donuts":
      return `Call ${lead.phone} only. If anyone quotes ${lead.ignorePhones?.[0]}, hang up and redial the 836 number.

Hi, is this White Lane Donuts on White Lane? This is ${name} with ${studio}. I help bakeries in Bakersfield get found when people search donuts nearby. I couldn’t find a website for the shop — just the listing — and the reviews look current. If it’s useful, I can sketch a simple page with hours, the menu, and a tap-to-call button this week. No pitch deck. Is the owner around for thirty seconds?`;

    case "oildale-nails":
      return `Call ${lead.phone}.

Hi, is this Oildale Nails on North Chester? This is ${name} with ${studio}. I build booking sites for salons that are still living on a phone number and a Maps pin. I didn’t find a site for you, so walk-ins and Google are doing all the work. I can mock a page with hours, services, and a book-now button if you want to see it first. Is the owner in?`;

    case "briceno-electric-hector":
      return `Call ${lead.phone} only. Ask for Hector. Do not mention bricenoelectric.com or any William / williamb@ contact.

Hi, I’m looking for Hector at Briceno Electric. This is ${name} with ${studio}. I work with licensed trades in Bakersfield who don’t have their own site yet. I’m not calling about the other Briceno page online — this is for Hector’s company. A one-page site with the license, service area, and a click-to-call number is usually enough. Can I send a sketch to look at, no obligation?`;

    case "hometown-plumbing":
      return `Call ${lead.phone}. Use Empire State Drive / PO Box 41116 only — not Norris Road.

Hi, is this Hometown Plumbing? This is ${name} with ${studio}. I looked at hometownplumbingbakersfield.com. The shop is clearly real, but the testimonials on the site are dated January 1, 1970, which makes the page feel abandoned to anyone searching from a phone. I can rebuild the homepage around the work you already do and keep ${lead.email} as the inbox. Would the owner look at a before/after this week?`;

    case "luna-electric":
      return `Call ${lead.phone}.

Hi, is this Luna Electric? This is ${name} with ${studio}. I found lunaelectric07.com. The company looks solid, but the homepage title reads like directory spam and there are typos, which is a quiet way to lose the next commercial job. This is a redesign, not a brand-new site. I can send a cleaned-up homepage mock to ${lead.email} if that’s the right inbox. Is the owner available?`;

    default:
      return `Call ${lead.phone || "the listed number"} and ask for the owner. This is ${name} with ${studio}. ${lead.why}`;
  }
}

export function buildVerifiedEmail(
  lead: VerifiedLead,
  profile?: Partial<StudioProfile> | null,
): string {
  if (!canContact(lead)) return blocked(lead);
  const { name, studio } = who(profile);

  switch (lead.id) {
    case "white-lane-donuts":
      return `To: owner (no public email on file — follow the call)
Subject: A simple site for White Lane Donuts

Hi —

I’m ${name} at ${studio}. I was looking at bakeries in Bakersfield that people already search for, and White Lane Donuts at 1561 White Lane doesn’t have a website I can find. The shop looks active. That’s the whole note.

A one-page site with hours, what you’re known for, photos, and a tap-to-call button (${lead.phone}) is usually enough. I can sketch it this week so you can see it before we talk money.

If this isn’t useful, ignore the message.

${signoff(profile)}`;

    case "oildale-nails":
      return `To: owner (no public email on file — follow the call)
Subject: Booking page for Oildale Nails

Hi —

I’m ${name} at ${studio}. Oildale Nails at 2509 N Chester still doesn’t have a site, which means Google and the phone are doing 100% of the booking. That’s a gap I can close with a short page: hours, services, photos, and a book/call button to ${lead.phone}.

Happy to send a mock first. No contract attached.

${signoff(profile)}`;

    case "briceno-electric-hector":
      return `To: Hector at Briceno Electric (call ${lead.phone} — do not email williamb@ or use bricenoelectric.com)
Subject: A page for Hector / Briceno Electric

Hi Hector —

I’m ${name} at ${studio}. I’m writing you directly, not the other Briceno presence online. CSLB #900822 lines up with your company, and I couldn’t confirm a website that is actually yours.

For a licensed electrician, a clean page with the license, what you take, the service area, and ${lead.phone} as a tap-to-call is the whole product. I can send a one-screen sketch if you want to see it.

${signoff(profile)}`;

    case "hometown-plumbing":
      return `To: ${lead.email}
Subject: hometownplumbingbakersfield.com is costing you trust

Hi Hometown Plumbing —

I’m ${name} at ${studio}. I looked at your site. The business is clearly operating (9502 Empire State Dr), but the testimonials are timestamped 1/01/1970, which reads as an abandoned page to anyone on a phone.

This is a redesign, not a new brand. Keep the name, keep ${lead.email}, replace the dead proof with current work and a tap-to-call for ${lead.phone}. I can send a homepage mock before we talk.

${signoff(profile)}`;

    case "luna-electric":
      return `To: ${lead.email}
Subject: lunaelectric07.com — cleanup, not a rebuild from zero

Hi Luna Electric —

I’m ${name} at ${studio}. Contacts for the company line up (3700 Easton Dr #20, ${lead.phone}, this inbox). The site itself is the weak point: the title reads like SEO spam, and the typos don’t match a licensed shop.

I’d treat this as a redesign. Same company, cleaner homepage, obvious call path. I can send a mock to this address if that’s right.

${signoff(profile)}`;

    default:
      return `Subject: Website note for ${lead.name}\n\n${lead.why}\n\n${signoff(profile)}`;
  }
}

export function buildVerifiedVoicemail(
  lead: VerifiedLead,
  profile?: Partial<StudioProfile> | null,
): string {
  if (!canContact(lead)) return blocked(lead);
  const { name, studio, email } = who(profile);
  const angle =
    lead.play === "redesign"
      ? "the site that’s up is quietly costing you calls"
      : "I couldn’t find a website for the shop";
  return `Hi, this is ${name} with ${studio}, leaving a note for ${lead.name}. I work with ${lead.trade.toLowerCase()} shops around Bakersfield. ${angle}. I’ll follow up by email at ${email}. If you want a short homepage sketch, call me back.`;
}
