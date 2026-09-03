'use client';

import { SearchIcon, XIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { cn } from 'tailwind-variants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CHANGE_TYPE_DOT,
  CHANGE_TYPES,
  type DigestFilterState,
  EFFORT_DOT,
  EFFORTS,
  WINDOWS
} from '@/lib/digest-filters';

const ALL = 'all';

function labelFor(value: string, all: string) {
  return value === ALL ? all : value;
}

/**
 * A small colour key, so the option means something before you read it.
 *
 * `self-center` matters: shadcn's SelectItem lays its text out as a flex row
 * that defaults to `stretch`, so a fixed-height dot pins to the top of the row
 * instead of sitting level with the label.
 */
function Dot({ tone }: { tone: string | undefined }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2 shrink-0 self-center rounded-full', tone ?? 'bg-muted-foreground')}
    />
  );
}

/** Trigger content: the dot travels with the selection, not just the list. */
function Chosen({ tone, children }: { tone?: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/**
 * One row of selects. The previous chip grid supported multi-select but took
 * five rows to say what four dropdowns say here.
 */
export function DigestFilters({ repos, selected }: { repos: string[]; selected: DigestFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(selected.q);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === ALL) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const active =
    selected.types.length + selected.effort.length + selected.repos.length > 0 ||
    Boolean(selected.q) ||
    selected.days !== 30;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selected.types[0] ?? ALL} onValueChange={(value) => setParam('types', String(value))}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue>
            {(value: string) => (
              <Chosen tone={CHANGE_TYPE_DOT[value] ?? 'bg-muted-foreground/30'}>{labelFor(value, 'All types')}</Chosen>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>
            <Dot tone="bg-muted-foreground/30" />
            All types
          </SelectItem>
          {CHANGE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              <Dot tone={CHANGE_TYPE_DOT[type]} />
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selected.effort[0] ?? ALL} onValueChange={(value) => setParam('effort', String(value))}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue>
            {(value: string) => (
              <Chosen tone={EFFORT_DOT[value] ?? 'bg-muted-foreground/30'}>{labelFor(value, 'Any effort')}</Chosen>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>
            <Dot tone="bg-muted-foreground/30" />
            Any effort
          </SelectItem>
          {EFFORTS.map((effort) => (
            <SelectItem key={effort} value={effort}>
              <Dot tone={EFFORT_DOT[effort]} />
              {effort}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selected.repos[0] ?? ALL} onValueChange={(value) => setParam('repos', String(value))}>
        <SelectTrigger size="sm" className="w-48">
          <SelectValue>{(value: string) => (value === ALL ? 'All repos' : (value.split('/')[1] ?? value))}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All repos</SelectItem>
          {repos.map((repo) => (
            <SelectItem key={repo} value={repo}>
              {repo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(selected.days)}
        onValueChange={(value) => setParam('days', String(value) === '30' ? null : String(value))}
      >
        <SelectTrigger size="sm" className="w-28">
          <SelectValue>{(value: string) => `${value} days`}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {WINDOWS.map((days) => (
            <SelectItem key={days} value={String(days)}>
              {days} days
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setParam('q', query.trim() || null);
        }}
        className="relative"
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find in summaries"
          aria-label="Find in summaries"
          className="h-7 w-52 pl-8 text-sm"
        />
      </form>

      {active && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setQuery('');
            router.push(pathname);
          }}
        >
          <XIcon data-icon="inline-start" />
          Clear
        </Button>
      )}
    </div>
  );
}
