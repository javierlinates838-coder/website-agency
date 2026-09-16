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
    title: "Do not spray a hundred names in a night",
    copy: "Ten honest notes beat a blast. If Beacon labeled a row as sample data, do not pretend it is a live business.",
  },
];

const week = [
  "Monday: scan one city × one trade. Save the top ten.",
  "Tuesday: send five emails and two DMs. Log them as Reached.",
  "Wednesday: follow up anyone quiet. Offer a 15-minute call.",
  "Thursday: build one free homepage mock for the warmest lead.",
  "Friday: send the mock, then scan a second neighborhood.",
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
        <Link href="/finder" className="mt-10 inline-flex rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ink">
          Back to the finder
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
