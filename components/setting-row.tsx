import type { ReactNode } from 'react';
import { cn } from 'tailwind-variants';
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldTitle } from '@/components/ui/field';

/**
 * One bordered block of settings rows.
 * It has to be a `FieldGroup`: shadcn's responsive `Field` only lays out side by side inside that container query, and without it every row stacked label over control.
 */
export function SettingGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <FieldGroup className={cn('gap-0 divide-y divide-border rounded-xl border px-5', className)}>{children}</FieldGroup>
  );
}

/** One setting: label and an optional short hint on the left, the control on the right. */
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
    <Field orientation="responsive" className="py-4">
      <FieldContent>
        {htmlFor ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : <FieldTitle>{label}</FieldTitle>}
        {description && <FieldDescription>{description}</FieldDescription>}
      </FieldContent>
      {children}
    </Field>
  );
}
