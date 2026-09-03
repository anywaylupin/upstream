'use client';

import { LogOutIcon, MonitorIcon, MoonIcon, PaletteIcon, SettingsIcon, SunIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { signOutAction } from '@/app/actions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { DEFAULT_MODE, DEFAULT_PALETTE, MODE_KEY, type Mode, PALETTE_KEY, PALETTES, type Palette } from '@/lib/theme';

const MODES: { id: Mode; icon: typeof SunIcon; label: string }[] = [
  { id: 'light', icon: SunIcon, label: 'Light' },
  { id: 'dark', icon: MoonIcon, label: 'Dark' },
  { id: 'system', icon: MonitorIcon, label: 'System' }
];

/**
 * Every row is a real menu item - the appearance controls used to be bespoke
 * button grids, which looked nothing like the rest of the menu.
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
    const dark = next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  useEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyMode('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode, applyMode]);

  function chooseMode(next: Mode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
    applyMode(next);
  }

  function choosePalette(next: Palette) {
    setPalette(next);
    localStorage.setItem(PALETTE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
  }

  const ModeIcon = MODES.find((m) => m.id === mode)?.icon ?? MonitorIcon;

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

      <DropdownMenuContent align="end" className="w-auto min-w-48 [&_[data-slot=dropdown-menu-item]]:whitespace-nowrap">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem render={<Link href="/settings" />}>
            <SettingsIcon />
            Settings
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {mounted ? <ModeIcon /> : <MonitorIcon />}
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-36">
              <DropdownMenuRadioGroup
                value={mounted ? mode : DEFAULT_MODE}
                onValueChange={(value) => chooseMode(String(value) as Mode)}
              >
                {MODES.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    <option.icon />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <PaletteIcon />
              Palette
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-36">
              <DropdownMenuRadioGroup
                value={mounted ? palette : DEFAULT_PALETTE}
                onValueChange={(value) => choosePalette(String(value) as Palette)}
              >
                {PALETTES.map((option) => (
                  <DropdownMenuRadioItem key={option.id} value={option.id}>
                    {/* data-theme scopes --brand-* to this swatch, and
                        background resolves against them here. */}
                    <span
                      data-theme={option.id}
                      className="size-3 rounded-full bg-[oklch(0.62_var(--brand-c)_var(--brand-h))] ring-1 ring-foreground/15"
                    />
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

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
