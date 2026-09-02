"use client";

import {
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "tailwind-variants";
import { signOutAction } from "@/app/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_MODE,
  DEFAULT_PALETTE,
  MODE_KEY,
  type Mode,
  PALETTE_KEY,
  PALETTES,
  type Palette,
} from "@/lib/theme";

const MODES: { id: Mode; icon: typeof SunIcon; label: string }[] = [
  { id: "light", icon: SunIcon, label: "Light" },
  { id: "dark", icon: MoonIcon, label: "Dark" },
  { id: "system", icon: MonitorIcon, label: "System" },
];

/**
 * Avatar menu. Appearance lives in here rather than in its own header button,
 * so there is one menu instead of two competing for the same corner.
 */
export function UserMenu({ name, image }: { name: string; image?: string }) {
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);
  const [palette, setPalette] = useState<Palette>(DEFAULT_PALETTE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedMode = localStorage.getItem(MODE_KEY) as Mode | null;
    const storedPalette = localStorage.getItem(PALETTE_KEY) as Palette | null;
    if (storedMode) setMode(storedMode);
    if (storedPalette) setPalette(storedPalette);
    setMounted(true);
  }, []);

  const applyMode = useCallback((next: Mode) => {
    const dark =
      next === "dark" ||
      (next === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode, applyMode]);

  function chooseMode(next: Mode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
    applyMode(next);
  }

  function choosePalette(next: Palette) {
    setPalette(next);
    localStorage.setItem(PALETTE_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Account"
      >
        <Avatar size="sm">
          <AvatarImage src={image} alt={name} />
          <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem render={<Link href="/settings" />}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Appearance</DropdownMenuLabel>

          <div className="flex gap-1 px-1.5 pb-1">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseMode(option.id)}
                aria-label={option.label}
                aria-pressed={mounted && mode === option.id}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md border py-1 text-xs transition-colors",
                  mounted && mode === option.id
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <option.icon className="size-3.5" />
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 px-1.5 pt-1 pb-1.5">
            {PALETTES.map((option) => (
              <button
                key={option.id}
                type="button"
                data-theme={option.id}
                onClick={() => choosePalette(option.id)}
                aria-label={option.label}
                aria-pressed={mounted && palette === option.id}
                className={cn(
                  "size-5 rounded-full bg-[oklch(0.62_var(--brand-c)_var(--brand-h))] transition-transform hover:scale-110",
                  mounted && palette === option.id
                    ? "ring-2 ring-foreground/60 ring-offset-1 ring-offset-popover"
                    : "ring-1 ring-foreground/15",
                )}
              />
            ))}
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              signOutAction();
            }}
          >
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
