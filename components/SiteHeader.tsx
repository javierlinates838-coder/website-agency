import Link from "next/link";

const links = [
  { href: "/finder", label: "Finder" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/playbook", label: "Playbook" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-5">
        <Link href="/" className="group flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-moss text-ink">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" fill="currentColor" />
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="font-display text-xl tracking-tight">Beacon</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-mist sm:gap-7">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-paper">
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/finder"
          className="hidden rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-moss sm:inline-flex"
        >
          Find clients
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-mist sm:flex-row sm:items-center sm:justify-between">
        <p>Beacon is a local-client radar for web studios.</p>
        <p>Use live map data for outreach. Sample leads are labeled.</p>
      </div>
    </footer>
  );
}
