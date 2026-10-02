"use client";

import { useApp } from "@/components/app/AppContext";
import { useEvaluationData } from "@/data/evaluation";
import { defaultCriteria } from "@/domain/team/evaluation";
import { localeTags } from "@/i18n/config";
import { cn } from "@/lib/cn";

/** The team's evaluation data and the criteria in use (the language's defaults until the coach saves). */
export function useEvaluation(workspaceId: string | undefined) {
  const { t } = useApp();
  const data = useEvaluationData(workspaceId);
  const criteria = data.criteria ?? defaultCriteria(t.evaluation.defaultCriteria);
  return { data, criteria };
}

export function useRatingFormat() {
  const { locale } = useApp();
  const f = new Intl.NumberFormat(localeTags[locale].intl, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (n: number) => f.format(n);
}

/** A mean out of five as five segments, the last one filled in part. */
export function RatingMeter({ value, className }: { value: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex gap-0.5", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="relative h-1.5 w-4 overflow-hidden rounded-full bg-chalk/12">
          <span className="absolute inset-y-0 left-0 bg-volt" style={{ width: `${Math.max(0, Math.min(1, value - i)) * 100}%` }} />
        </span>
      ))}
    </span>
  );
}
