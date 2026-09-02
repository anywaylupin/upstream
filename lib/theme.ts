export const MODES = ["light", "dark", "system"] as const;
export type Mode = (typeof MODES)[number];

export const PALETTES = [
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "violet", label: "Violet" },
  { id: "amber", label: "Amber" },
  { id: "rose", label: "Rose" },
] as const;

export type Palette = (typeof PALETTES)[number]["id"];

export const MODE_KEY = "upstream:mode";
export const PALETTE_KEY = "upstream:palette";
export const DEFAULT_MODE: Mode = "system";
export const DEFAULT_PALETTE: Palette = "teal";

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
