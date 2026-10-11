'use client';

import { SearchIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
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

/** The three questions most people come with. Each is just a preset of params. */
const VIEWS = [
  { id: 'all', label: 'All', types: null, effort: null },
  { id: 'breaking', label: 'Breaking', types: 'breaking', effort: null },
  { id: 'work', label: 'Needs work', types: null, effort: 'medium,high' }
] as const;

/**
 * A segmented view up front, the finer selects behind a toggle. Most visits
 * want one of three answers; four dropdowns made every visit pay for the rare one.
 */
export function DigestFilters({ repos, selected }: { repos: string[]; selected: DigestFilterState }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(selected.q);

  function setParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === ALL) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setParam(key: string, value: string | null) {
    setParams({ [key]: value });
  }

  const typesKey = selected.types.join(',');
  const effortKey = selected.effort.join(',');
  const view = VIEWS.find((v) => (v.types ?? '') === typesKey && (v.effort ?? '') === effortKey)?.id ?? null;

  const refined = selected.repos.length > 0 || selected.days !== 30 || view === null;
  const [showFilters, setShowFilters] = useState(refined);

  const active =
    selected.types.length + selected.effort.length + selected.repos.length > 0 ||
    Boolean(selected.q) ||
    selected.days !== 30;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset aria-label="View" className="inline-flex rounded-md bg-muted p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setParams({ types: v.types, effort: v.effort })}
              className={cn(
                'rounded-[5px] px-2.5 py-1 font-medium text-xs transition-colors',
                view === v.id
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v.label}
            </button>
          ))}
        </fieldset>

        <Button
          type="button"
          size="sm"
          variant={showFilters ? 'secondary' : 'ghost'}
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontalIcon data-icon="inline-start" />
          Filters
        </Button>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setParam('q', query.trim() || null);
          }}
          className="relative ml-auto"
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

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selected.types[0] ?? ALL} onValueChange={(value) => setParam('types', String(value))}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue>
                {(value: string) => (
                  <Chosen tone={CHANGE_TYPE_DOT[value] ?? 'bg-muted-foreground/30'}>
                    {labelFor(value, 'All types')}
                  </Chosen>
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
              <SelectValue>
                {(value: string) => (value === ALL ? 'All repos' : (value.split('/')[1] ?? value))}
              </SelectValue>
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
        </div>
      )}
    </div>
  );
}
