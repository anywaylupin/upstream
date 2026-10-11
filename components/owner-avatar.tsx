'use client';

import { useState } from 'react';

/**
 * The repo's homepage icon when ingest found one, else the owner's avatar,
 * which GitHub serves at /{owner}.png with no API call. A dead icon falls back.
 */
export function OwnerAvatar({ owner, icon, size = 20 }: { owner: string; icon?: string | null; size?: number }) {
  const [broken, setBroken] = useState(false);
  const useIcon = icon && !broken;
  return (
    // biome-ignore lint/performance/noImgElement: remote avatar, no next/image domain config wanted
    <img
      src={useIcon ? icon : `https://github.com/${owner}.png?size=${size * 2}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`shrink-0 ring-1 ring-foreground/10 ${useIcon ? 'rounded-md bg-white object-contain p-0.5' : 'rounded-full'}`}
    />
  );
}
