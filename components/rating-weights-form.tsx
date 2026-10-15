'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { SaveIcon, Trash2Icon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'tailwind-variants';
import { deleteRatingPreset, saveRatingPreset, saveRatingWeights } from '@/app/actions/settings';
import { Button } from '@/components/ui/button';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CRITERIA, type CustomPreset, MAX_WEIGHT, PRESETS, sameWeights, type Weights } from '@/lib/repo-rating';

type Preset = { id: string; label: string; description: string; weights: Weights; custom: boolean };

/**
 * Presets plus fine-tuning.
 * The four built-ins are code and never change: once the sliders move off the selected preset, plain Save gives way to "Save as new preset", and "Update" when the selected one is the user's own.
 *
 * The selection is inferred from matching weights until a slider moves, then pinned: otherwise the first nudge matched nothing, cleared the radio, and hid "Update".
 *
 * The slider is composed from base-ui parts rather than the shadcn wrapper, because the wrapper gives its thumb no accessible name: a screen reader announced only "slider, 2".
 */
export function RatingWeightsForm({ initial, custom }: { initial: Weights; custom: CustomPreset[] }) {
  const presets: Preset[] = [
    ...PRESETS.map((p) => ({ ...p, custom: false })),
    ...custom.map((p) => ({ ...p, description: 'Your preset', custom: true }))
  ];

  const [weights, setWeights] = useState<Weights>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, startSaving] = useTransition();

  const selected = presets.find((p) => p.id === selectedId) ?? presets.find((p) => sameWeights(p.weights, weights));
  const edited = !selected || !sameWeights(selected.weights, weights);
  const total = CRITERIA.reduce((sum, c) => sum + weights[c.id], 0);

  function run(action: () => Promise<{ error?: string; message?: string }>, done?: () => void) {
    startSaving(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.message ?? 'Rating saved');
        done?.();
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <RadioGroup
        aria-label="Preset"
        className="grid gap-2 sm:grid-cols-2"
        value={selected?.id ?? ''}
        onValueChange={(id) => {
          const picked = presets.find((p) => p.id === id);
          if (!picked) return;
          setSelectedId(picked.id);
          setWeights(picked.weights);
        }}
      >
        {presets.map((p) => (
          <FieldLabel key={p.id} htmlFor={`preset-${p.id}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{p.label}</FieldTitle>
                <FieldDescription>{p.description}</FieldDescription>
              </FieldContent>
              {p.custom && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${p.label}`}
                  disabled={saving}
                  onClick={(event) => {
                    event.preventDefault();
                    run(
                      () => deleteRatingPreset(p.id).then((res) => ({ ...res, message: `Deleted "${p.label}"` })),
                      () => selectedId === p.id && setSelectedId(null)
                    );
                  }}
                >
                  <Trash2Icon />
                </Button>
              )}
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
              <SliderPrimitive.Root
                min={0}
                max={MAX_WEIGHT}
                step={1}
                value={w}
                thumbAlignment="edge"
                onValueChange={(next) => {
                  if (!selectedId && selected) setSelectedId(selected.id);
                  setWeights({ ...weights, [c.id]: Array.isArray(next) ? (next[0] ?? 0) : next });
                }}
              >
                <SliderPrimitive.Control className="relative flex w-full touch-none select-none items-center">
                  <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
                    <SliderPrimitive.Indicator className="h-full bg-brand" />
                  </SliderPrimitive.Track>
                  <SliderPrimitive.Thumb
                    aria-label={`${c.label} weight`}
                    className="relative block size-3.5 shrink-0 rounded-full border border-ring bg-card ring-ring/40 after:absolute after:-inset-2.5 hover:ring-3 focus-visible:outline-hidden focus-visible:ring-3"
                  />
                </SliderPrimitive.Control>
              </SliderPrimitive.Root>
              <span className="text-right text-muted-foreground text-xs tabular-nums">{share}%</span>
            </li>
          );
        })}
      </ul>

      {edited ? (
        <form
          className="flex flex-wrap items-center justify-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () => saveRatingPreset({ weights, name }),
              () => {
                setName('');
                setSelectedId(null);
              }
            );
          }}
        >
          {selected?.custom && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => run(() => saveRatingPreset({ weights, overrideId: selected.id }))}
            >
              Update {selected.label}
            </Button>
          )}
          <Input
            name="presetName"
            type="text"
            autoComplete="off"
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Preset name"
            aria-label="Preset name"
            className="h-8 w-44"
          />
          <Button type="submit" size="sm" disabled={saving || !name.trim()} aria-busy={saving}>
            {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            Save as new preset
          </Button>
        </form>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={saving}
            aria-busy={saving}
            onClick={() => run(() => saveRatingWeights(weights))}
          >
            {saving ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
