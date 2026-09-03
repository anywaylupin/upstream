export const MODES = ['light', 'dark', 'system'] as const;
export type Mode = (typeof MODES)[number];

/**
 * The shadcn accent ramps. Each is only a hue and a chroma: every themed
 * token in globals.css is derived from `--brand-h` / `--brand-c`, so a new
 * palette is two numbers rather than a whole set of colour variables.
 */
export const PALETTES = [
  { id: 'slate', label: 'Slate' },
  { id: 'red', label: 'Red' },
  { id: 'orange', label: 'Orange' },
  { id: 'amber', label: 'Amber' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'lime', label: 'Lime' },
  { id: 'green', label: 'Green' },
  { id: 'emerald', label: 'Emerald' },
  { id: 'teal', label: 'Teal' },
  { id: 'cyan', label: 'Cyan' },
  { id: 'sky', label: 'Sky' },
  { id: 'blue', label: 'Blue' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'violet', label: 'Violet' },
  { id: 'purple', label: 'Purple' },
  { id: 'fuchsia', label: 'Fuchsia' },
  { id: 'pink', label: 'Pink' },
  { id: 'rose', label: 'Rose' }
] as const;

export type Palette = (typeof PALETTES)[number]['id'];

export const MODE_KEY = 'upstream:mode';
export const PALETTE_KEY = 'upstream:palette';
export const DEFAULT_MODE: Mode = 'system';
export const DEFAULT_PALETTE: Palette = 'teal';

/**
 * Applies the stored theme to <html> before first paint, so there is no flash.
 * Rendered as a plain inline script from the server layout - keeping it out of a
 * client component is what avoids React 19's "script tag while rendering" warning.
 */
export const THEME_SCRIPT = `(function(){try{
var m=localStorage.getItem(${JSON.stringify(MODE_KEY)})||${JSON.stringify(DEFAULT_MODE)};
var p=localStorage.getItem(${JSON.stringify(PALETTE_KEY)})||${JSON.stringify(DEFAULT_PALETTE)};
var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var e=document.documentElement;
e.classList.toggle("dark",d);
e.setAttribute("data-theme",p);
}catch(_){}})();`;
