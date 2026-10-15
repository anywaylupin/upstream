import Link from 'next/link';
import type { ReactNode } from 'react';
import { OwnerAvatar } from '@/components/owner-avatar';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

/**
 * The one repo row every list uses: avatar, name and description, one muted fact, then badges and actions.
 * Four hand-built variants had drifted apart (no avatar in search, three buttons on Following), which is what made the tabs feel like different apps.
 *
 * The name is a stretched link, so the whole row navigates while the trailing controls stay real buttons.
 * Keyboard focus rings the whole row, since the browser outline only hugged the name text.
 */
export function RepoRow({
  owner,
  name,
  iconUrl,
  tag,
  description,
  meta,
  children
}: {
  owner: string;
  name: string;
  iconUrl?: string | null;
  tag?: string;
  description: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Item
      variant="outline"
      className="relative bg-card hover:bg-muted/50 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
    >
      <ItemMedia>
        <OwnerAvatar owner={owner} icon={iconUrl} size={32} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full">
          <Link
            href={`/repos/${owner}/${name}`}
            className="truncate outline-none after:absolute after:inset-0 hover:underline"
          >
            {owner}/{name}
          </Link>
          {tag && <span className="shrink-0 font-mono font-normal text-muted-foreground text-xs">{tag}</span>}
        </ItemTitle>
        <ItemDescription className="truncate">{description}</ItemDescription>
      </ItemContent>
      {meta && <span className="hidden shrink-0 text-muted-foreground text-sm sm:block">{meta}</span>}
      {children && <ItemActions className="relative z-10">{children}</ItemActions>}
    </Item>
  );
}
