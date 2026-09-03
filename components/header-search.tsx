'use client';

import { SearchIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';

/** Searches the stack, its releases and GitHub. "/" focuses it, like GitHub. */
export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get('q') ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
      className="w-full max-w-xs"
    >
      <InputGroup className="h-8">
        <InputGroupAddon>
          <SearchIcon className="size-3.5" />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search repos and releases"
          aria-label="Search"
          className="text-sm"
        />
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>/</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
