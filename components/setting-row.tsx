import type { ReactNode } from 'react';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';

/**
 * One setting as shadcn's responsive Field: label and help on the left, the
 * control on the right, stacking on narrow screens. Kept as a component only
 * because every settings row repeats the same four Field parts.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  children
}: {
  label: string;
  description?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <Field orientation="responsive" className="border-border border-b py-5 first:pt-0 last:border-b-0">
      <FieldContent>
        {htmlFor ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : <FieldTitle>{label}</FieldTitle>}
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      {children}
    </Field>
  );
}
