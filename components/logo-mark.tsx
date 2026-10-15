import type { ComponentProps } from 'react';

/**
 * Upstream's mark: a U drawn as two map contour lines, with a dot where the outer line would close, for the source.
 * Chosen from six explorations; a literal arrow over water read as clip art, a fork as the letter Y, a gauge staff as an E.
 * Same 24 grid and round strokes as the icon set. `app/icon.svg` is this drawing on a tile; change both together.
 */
export function LogoMark(props: ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M5 4V12a7 7 0 0 0 14 0V9" stroke="currentColor" />
      <path d="M9.2 4V12a2.8 2.8 0 0 0 5.6 0V4" stroke="currentColor" />
      <circle cx="19" cy="4.8" r="2.1" className="fill-brand" />
    </svg>
  );
}
