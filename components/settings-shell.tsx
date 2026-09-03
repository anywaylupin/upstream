'use client';

import { KeyRoundIcon, type LucideIcon, MailIcon, SparklesIcon, TriangleAlertIcon, UserIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { cn } from 'tailwind-variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SETTINGS_SECTIONS, type SettingsSectionId } from '@/lib/settings-sections';

/** Icons are components, so they are matched to ids here rather than shipped
 * across the server boundary with the section list. */
const ICONS: Record<SettingsSectionId, LucideIcon> = {
  account: UserIcon,
  digest: MailIcon,
  keys: KeyRoundIcon,
  instructions: SparklesIcon,
  danger: TriangleAlertIcon
};

/**
 * Settings sections switch entirely on the client.
 *
 * The page fetches every section's data in one pass anyway, so navigating
 * `?section=` only ever re-ran the same GitHub and database calls to render a
 * different panel - two API round trips and a loading skeleton for what is
 * really a tab change. Every panel is rendered server-side once and swapped
 * here for free.
 *
 * The entries stay real anchors so middle-click and ctrl-click still open a
 * section in a new tab; only the plain left-click is intercepted. The address
 * bar is kept honest with `history.replaceState`, which updates the URL without
 * asking the router for anything.
 */
export function SettingsShell({
  initial,
  panels
}: {
  initial: SettingsSectionId;
  panels: Record<SettingsSectionId, ReactNode>;
}) {
  const [active, setActive] = useState<SettingsSectionId>(initial);

  /**
   * Delegated from the nav rather than bound per link.
   *
   * base-ui's `TooltipTrigger render={<a .../>}` does not carry an `onClick`
   * through to the rendered anchor, so a handler placed there never ran and
   * every section click was doing a full document navigation. Listening on the
   * container sidesteps the render-prop merge entirely.
   */
  function onNavClick(event: React.MouseEvent<HTMLElement>) {
    // Leave the modified clicks to the browser so ctrl-click still opens a tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

    const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[data-section]');
    const id = anchor?.dataset.section as SettingsSectionId | undefined;
    if (!id) return;

    event.preventDefault();
    setActive(id);
    window.history.replaceState(null, '', `/settings?section=${id}`);

    // Panels differ a lot in height. Switching to a short one from a scrolled
    // position let the browser clamp scrollTop, which yanked the sticky rail
    // upward. Going back to the top is what a tab switch should do anyway.
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="mx-auto grid w-full gap-6 md:grid-cols-[13rem_minmax(0,1fr)]">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: delegation only; the real controls are the anchors inside */}
      <nav onClick={onNavClick} className="flex gap-1 md:sticky md:top-20 md:flex-col md:self-start">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = ICONS[section.id];
          const isActive = active === section.id;

          return (
            <Tooltip key={section.id}>
              <TooltipTrigger
                render={
                  // biome-ignore lint/a11y/useAnchorContent: base-ui renders the label into this anchor via TooltipTrigger
                  <a
                    href={`/settings?section=${section.id}`}
                    data-section={section.id}
                    aria-label={section.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md p-2 text-sm',
                      'transition-[background-color,color,transform] duration-200 active:scale-[0.97]',
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

      {/* A floor on the height so the page does not collapse when a short
          panel replaces a tall one, which is the other half of the jump.
          Keyed on the section so React remounts it and the entrance animation
          replays on every switch rather than only the first. */}
      <div key={active} className="flex min-h-[28rem] min-w-0 animate-panel flex-col gap-4">
        {panels[active]}
      </div>
    </div>
  );
}
