import type { OpportunityKind } from "@/lib/types";
import { kindLabel, scoreTone } from "@/lib/score";

const toneClass = {
  hot: "bg-ember text-white",
  warm: "bg-orange-400 text-ink",
  cool: "bg-moss text-ink",
  cold: "bg-white/10 text-paper",
};

export function ScoreMark({
  score,
  kind,
  compact,
}: {
  score: number;
  kind: OpportunityKind;
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        className={`grid place-items-center font-semibold ${
          compact ? "h-8 w-8 rounded-xl text-xs" : "h-11 w-11 rounded-2xl text-sm"
        } ${toneClass[scoreTone(score)]}`}
      >
        {score}
      </span>
      {!compact && (
        <span className="text-xs uppercase tracking-[0.16em] text-mist">{kindLabel(kind)}</span>
      )}
    </div>
  );
}
