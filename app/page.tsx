import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

const signals = [
  {
    title: "No website",
    copy: "They exist on Maps and nowhere else. Highest-intent outreach if you can show what a simple site would do.",
  },
  {
    title: "Social only",
    copy: "A Facebook page is not a website. No SEO, no booking, no control over the layout.",
  },
  {
    title: "Looks abandoned",
    copy: "Copyright 2018, no HTTPS, or a parked domain. Easy to explain the gap in one sentence.",
  },
  {
    title: "Breaks on a phone",
    copy: "Most local searches happen on mobile. If the homepage is not built for a thumb, it is leaking work.",
  },
];

const steps = [
  "Start with the verified Bakersfield desk. Those five are already ranked and safe.",
  "Copy the call or email script. Contact rules stay on the card so you do not dial a burned number.",
  "Save them to the pipeline. Update status and notes there. Use Finder only when you need the next city.",
];

export default function HomePage() {
  return (
    <div className="relative">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pt-16">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-moss">Client radar for web studios</p>
            <h1 className="mt-5 max-w-xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
              Five Bakersfield shops that still need a real website.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-mist">
              The desk is already cleared against primary sources. Call scripts, emails, HOLD/DNC parks, and a map
              finder for the next city sit in one place. No outreach has been sent.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/desk" className="rounded-full bg-moss px-5 py-3 text-sm font-semibold text-ink">
                Open the Bakersfield desk
              </Link>
              <Link href="/finder" className="rounded-full border border-white/15 px-5 py-3 text-sm text-paper">
                Scan another city
              </Link>
            </div>
            <dl className="mt-12 grid max-w-lg gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-mist">Verified first</dt>
                <dd className="mt-1 text-paper">Top 5 ranked, with numbers you can actually dial</dd>
              </div>
              <div>
                <dt className="text-mist">Then writes</dt>
                <dd className="mt-1 text-paper">Call, email, and voicemail scripts with do-not rules</dd>
              </div>
              <div>
                <dt className="text-mist">You keep</dt>
                <dd className="mt-1 text-paper">A pipeline on this device, exportable to CSV</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-clay p-5 shadow-glow">
            <p className="text-xs uppercase tracking-[0.2em] text-mist">Verified desk · Bakersfield</p>
            <div className="mt-5 space-y-3">
              {[
                { name: "White Lane Donuts", tag: "No website · (661) 836-2906", rank: "HIGH" },
                { name: "Hometown Plumbing", tag: "Outdated site · public email", rank: "HIGH" },
                { name: "Luna Electric Inc.", tag: "Weak site · redesign", rank: "HIGH" },
              ].map((row) => (
                <div key={row.name} className="flex items-center justify-between rounded-2xl bg-ink px-4 py-3">
                  <div>
                    <p className="text-paper">{row.name}</p>
                    <p className="text-xs text-mist">{row.tag}</p>
                  </div>
                  <span className="rounded-full bg-ember px-2 py-1 text-[10px] font-semibold tracking-wider">
                    {row.rank}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-mist">
              Johnny&apos;s Barber stays HOLD. Oildale Barber is DNC. The rest of the Top 5 is cleared to call.
            </p>
          </div>
        </section>

        <section className="border-y border-white/5 bg-clay/40">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-4">
            {signals.map((signal) => (
              <article key={signal.title}>
                <h2 className="font-display text-2xl tracking-tight">{signal.title}</h2>
                <p className="mt-3 text-sm leading-6 text-mist">{signal.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20">
          <p className="text-xs uppercase tracking-[0.22em] text-moss">How it works</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
            A desk for finding work, not another pretty agency homepage.
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step} className="rounded-3xl border border-white/10 bg-clay p-6">
                <span className="text-moss">0{index + 1}</span>
                <p className="mt-4 text-lg leading-7 text-paper">{step}</p>
              </li>
            ))}
          </ol>
          <Link href="/desk" className="mt-10 inline-flex rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink">
            Open the desk
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
