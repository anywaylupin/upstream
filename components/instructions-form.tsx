'use client';

import { SaveIcon } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { type InstructionState, saveInstruction } from '@/app/actions/ai';
import { SettingGroup, SettingRow } from '@/components/setting-row';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

const initialState: InstructionState = {};

/**
 * All three instructions on one form with one Save.
 * They used to sit behind tabs, one form each, which hid whether the other two were set and saved them separately.
 */
export function InstructionsForm({
  fields
}: {
  fields: { id: string; label: string; placeholder: string; value: string }[];
}) {
  const [state, formAction, pending] = useActionState(saveInstruction, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.success) toast.success('Instructions saved');
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SettingGroup>
        {fields.map((field) => (
          <SettingRow
            key={field.id}
            label={field.label}
            htmlFor={`instruction-${field.id}`}
            description={field.id === 'global' ? undefined : 'Blank uses All features'}
          >
            <Textarea
              id={`instruction-${field.id}`}
              name={field.id}
              rows={2}
              placeholder={field.placeholder}
              defaultValue={field.value}
              disabled={pending}
              className="sm:max-w-md"
            />
          </SettingRow>
        ))}
      </SettingGroup>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
          Save
        </Button>
      </div>
    </form>
  );
}
