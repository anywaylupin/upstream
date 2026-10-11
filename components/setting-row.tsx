import type { ReactNode } from 'react';

/**
 * One setting: label and a line of help on the left, the control on the right.
 * Rows stack with a divider, the GitHub/Vercel settings layout.
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
    <div className="grid gap-3 border-border border-b py-5 first:pt-0 last:border-b-0 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] md:gap-8">
      <div className="flex flex-col gap-1">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="font-medium text-sm">
            {label}
          </label>
        ) : (
          <span className="font-medium text-sm">{label}</span>
        )}
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
