import { PipelineBoard } from "@/components/PipelineBoard";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function PipelinePage() {
  return (
    <div>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">
        <p className="text-xs uppercase tracking-[0.22em] text-moss">Pipeline</p>
        <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-5xl">Work the list.</h1>
        <p className="mt-3 max-w-xl text-mist">
          Saved businesses stay on this device. Drag a card, or tap a status, as the conversation moves.
        </p>
        <div className="mt-8">
          <PipelineBoard />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
