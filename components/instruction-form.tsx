'use client';

import { useActionState, useEffect, useId } from 'react';
import { toast } from 'sonner';
import { type InstructionState, saveInstruction } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

const initialState: InstructionState = {};

export function InstructionForm({
  feature,
  label,
  hint,
  placeholder,
  defaultValue
}: {
  feature: string;
  label: string;
  hint: string;
  placeholder: string;
  defaultValue: string;
}) {
  const [state, formAction, pending] = useActionState(saveInstruction, initialState);
  const fieldId = useId();

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success(`${label} instructions saved`);
  }, [state, label]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="feature" value={feature} />
      <label htmlFor={fieldId} className="font-medium text-sm">
        {label}
      </label>
      <p className="text-muted-foreground text-xs">{hint}</p>
      <Textarea
        id={fieldId}
        name="text"
        rows={3}
        placeholder={placeholder}
        defaultValue={defaultValue}
        disabled={pending}
        aria-busy={pending}
      />
      <div>
        <Button type="submit" size="sm" variant="outline" disabled={pending} aria-busy={pending}>
          {pending && <Spinner />}
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
