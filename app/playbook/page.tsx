import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

const rules = [
  {
    title: "Lead with the problem you actually saw",
    copy: "“Your Google listing has no website” is better than “I make amazing websites.” Specific beats flattery.",
  },
  {
    title: "Offer a sketch, not a 12-page proposal",
    copy: "A three-screen mock of their shop is a concrete gift. It is harder to ignore than a rate card.",
  },
  {
    title: "Stay in one trade long enough to get good",
    copy: "Dentists in two cities will teach you more than twenty random industries. Reuse the pitch. Improve the proof.",
  },
  {
    title: "Honor HOLD and DNC",
    copy: "Johnny's Barber is parked on a name conflict. Oildale Barber is closed. A cleared Top 5 is useless if you also call the names that were parked for a reason.",
  },
];

const week = [
  "Today: open the Bakersfield desk. Call White Lane Donuts, then Hometown Plumbing.",
  "Same day: email Luna Electric and save every attempt as Contacted.",
  "Tomorrow: Oildale Nails and Hector at Briceno — ask for the owner, follow the do-not rules.",
  "Thursday: one free homepage mock for whoever answered.",
  "Friday: only then scan a second neighborhood in the finder.",
];

export default function PlaybookPage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 pb-20 pt-10">
        <p className="text-xs uppercase tracking-[0.22em] text-moss">Playbook</p>
        <h1 className="mt-3 font-display text-5xl tracking-tight">Turn a list into booked work.</h1>
        <p className="mt-5 text-lg leading-8 text-mist">
          Beacon finds the opening. You still have to be useful. These are the habits that keep outreach from sounding like
          spam.
        </p>
        <div className="mt-12 space-y-8">
          {rules.map((rule) => (
            <article key={rule.title} className="border-t border-white/10 pt-6">
              <h2 className="font-display text-2xl tracking-tight">{rule.title}</h2>
              <p className="mt-3 leading-7 text-mist">{rule.copy}</p>
            </article>
          ))}
        </div>
        <section className="mt-14 rounded-[2rem] bg-clay p-6">
          <h2 className="font-display text-2xl">A quiet week of prospecting</h2>
          <ol className="mt-4 space-y-3 text-mist">
            {week.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
        <Link href="/desk" className="mt-10 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ink">
          Open the Bakersfield desk
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
