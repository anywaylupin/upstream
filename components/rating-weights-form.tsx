'use client';

import { SaveIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'tailwind-variants';
import { saveRatingWeights } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { CRITERIA, MAX_WEIGHT, PRESETS, presetFor, type Weights } from '@/lib/repo-rating';

export function RatingWeightsForm({ initial }: { initial: Weights }) {
  const [weights, setWeights] = useState<Weights>(initial);
  const [saving, startSaving] = useTransition();
  const preset = presetFor(weights);
  const total = CRITERIA.reduce((sum, c) => sum + weights[c.id], 0);

  function save() {
    startSaving(async () => {
      const res = await saveRatingWeights(weights);
      if (res.error) toast.error(res.error);
      else toast.success('Rating weights saved');
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset?.id === p.id ? 'default' : 'outline'}
            aria-pressed={preset?.id === p.id}
            onClick={() => setWeights(p.weights)}
          >
            {p.label}
          </Button>
        ))}
        {!preset && (
          <Button type="button" size="sm" variant="default" aria-pressed disabled>
            Custom
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-3">
        {CRITERIA.map((c) => {
          const w = weights[c.id];
          const share = total ? Math.round((w / total) * 100) : 0;
          return (
            <li key={c.id} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
              <label htmlFor={`w-${c.id}`} className="flex flex-col text-sm">
                <span className={cn('font-medium', w === 0 && 'text-muted-foreground line-through')}>{c.label}</span>
                <span className="text-muted-foreground text-xs">{c.hint}</span>
              </label>
              {/* An array value keeps the shadcn wrapper to one thumb; a bare number renders two. */}
              <Slider
                id={`w-${c.id}`}
                name={c.id}
                aria-label={`${c.label} weight`}
                min={0}
                max={MAX_WEIGHT}
                step={1}
                value={[w]}
                onValueChange={(next) =>
                  setWeights({ ...weights, [c.id]: Array.isArray(next) ? (next[0] ?? 0) : next })
                }
              />
              <span className="text-right text-muted-foreground text-xs tabular-nums">{share}%</span>
            </li>
          );
        })}
      </ul>

      <div>
        <Button type="button" size="sm" onClick={save} disabled={saving} aria-busy={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </div>
  );
}
