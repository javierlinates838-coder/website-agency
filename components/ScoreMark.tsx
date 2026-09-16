import type { OpportunityKind } from "@/lib/types";
import { kindLabel, scoreTone } from "@/lib/score";

const toneClass = {
  hot: "bg-ember text-white",
  warm: "bg-orange-400 text-ink",
  cool: "bg-moss text-ink",
  cold: "bg-white/10 text-paper",
};

export function ScoreMark({ score, kind }: { score: number; kind: OpportunityKind }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`grid h-11 w-11 place-items-center rounded-2xl text-sm font-semibold ${toneClass[scoreTone(score)]}`}>
        {score}
      </span>
      <span className="text-xs uppercase tracking-[0.16em] text-mist">{kindLabel(kind)}</span>
    </div>
  );
}
