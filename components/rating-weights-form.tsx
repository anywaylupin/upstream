'use client';

import { SaveIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'tailwind-variants';
import { saveRatingWeights } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CRITERIA, MAX_WEIGHT, PRESETS, presetFor, type Weights } from '@/lib/repo-rating';

/** An array value keeps the shadcn wrapper to one thumb; a bare number renders two. */
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
      <RadioGroup
        aria-label="Preset"
        className="grid gap-2 sm:grid-cols-2"
        value={preset?.id ?? ''}
        onValueChange={(id) => {
          const picked = PRESETS.find((p) => p.id === id);
          if (picked) setWeights(picked.weights);
        }}
      >
        {PRESETS.map((p) => (
          <FieldLabel key={p.id} htmlFor={`preset-${p.id}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{p.label}</FieldTitle>
                <FieldDescription>{p.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem value={p.id} id={`preset-${p.id}`} />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>
      <ul className="flex flex-col gap-3 rounded-xl border p-5">
        {CRITERIA.map((c) => {
          const w = weights[c.id];
          const share = total ? Math.round((w / total) * 100) : 0;
          return (
            <li key={c.id} className="grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-3">
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  className={cn(
                    'w-fit cursor-help text-left font-medium text-sm underline decoration-muted-foreground/50 decoration-dotted underline-offset-4',
                    w === 0 && 'text-muted-foreground line-through'
                  )}
                >
                  {c.label}
                </TooltipTrigger>
                <TooltipContent>{c.hint}</TooltipContent>
              </Tooltip>
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

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={saving} aria-busy={saving}>
          {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </div>
  );
}
