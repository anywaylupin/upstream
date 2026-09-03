'use client';

import { KeyRoundIcon, MailIcon, SparklesIcon, TriangleAlertIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from 'tailwind-variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-sections';

/** Icons are components, so they are matched to ids here rather than shipped
 * across the server boundary with the section list. */
const ICONS: Record<SettingsSectionId, typeof UserIcon> = {
  account: UserIcon,
  digest: MailIcon,
  keys: KeyRoundIcon,
  instructions: SparklesIcon,
  danger: TriangleAlertIcon
};

/**
 * A section rail. Each entry swaps the panel beside it, one view at a time.
 * Below md the labels drop away - five of them do not fit a phone width - and
 * the tooltip carries the name instead.
 */
export function SettingsNav({ active }: { active: SettingsSectionId }) {
  return (
    <nav className="flex gap-1 md:sticky md:top-20 md:flex-col">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = ICONS[section.id];
        const isActive = active === section.id;

        return (
          <Tooltip key={section.id}>
            <TooltipTrigger
              render={
                <Link
                  href={`/settings?section=${section.id}`}
                  aria-label={section.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md p-2 text-sm transition-colors',
                    'md:flex-none md:justify-start md:px-2.5 md:py-1.5',
                    isActive
                      ? 'bg-muted font-medium text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                />
              }
            >
              <Icon className={cn('size-4 shrink-0', section.id === 'danger' && 'text-destructive')} />
              <span className="hidden md:inline">{section.label}</span>
            </TooltipTrigger>
            <TooltipContent className="md:hidden">{section.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
