'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type RepoTab = 'overview' | 'releases' | 'alternatives';

/**
 * Panels are rendered on the server once and switched here, so changing tab
 * never refetches. The URL follows via replaceState, which keeps a tab
 * linkable without asking the router for anything - same as Settings.
 */
export function RepoTabs({
  initial,
  counts,
  panels
}: {
  initial: RepoTab;
  counts: { releases: number; alternatives: number };
  panels: Record<RepoTab, ReactNode>;
}) {
  const [tab, setTab] = useState<RepoTab>(initial);

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => {
        const value = String(next) as RepoTab;
        setTab(value);
        const url = new URL(window.location.href);
        if (value === 'overview') url.searchParams.delete('tab');
        else url.searchParams.set('tab', value);
        window.history.replaceState(null, '', url);
      }}
      className="gap-5"
    >
      {/* The entrance animation sits on an inner div, not the panel: base-ui waits
          for animations on the panel to end before hiding it, which left the old
          panel on screen during every switch. */}
      <TabsList variant="line" className="w-full justify-start border-border border-b">
        <TabsTrigger value="overview" className="flex-none">
          Overview
        </TabsTrigger>
        <TabsTrigger value="releases" className="flex-none">
          Releases <span className="text-muted-foreground tabular-nums">{counts.releases}</span>
        </TabsTrigger>
        <TabsTrigger value="alternatives" className="flex-none">
          Alternatives <span className="text-muted-foreground tabular-nums">{counts.alternatives}</span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="animate-panel">{panels.overview}</div>
      </TabsContent>
      <TabsContent value="releases">
        <div className="animate-panel">{panels.releases}</div>
      </TabsContent>
      <TabsContent value="alternatives">
        <div className="animate-panel">{panels.alternatives}</div>
      </TabsContent>
    </Tabs>
  );
}
