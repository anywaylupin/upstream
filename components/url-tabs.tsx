'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type UrlTab = { id: string; label: string; count?: number };

/**
 * Line tabs whose panels are rendered on the server once and switched here, so changing tab never refetches.
 * The URL follows through replaceState, which keeps a tab linkable without asking the router for anything.
 * The first tab is the default and leaves the param off the URL.
 *
 * The entrance animation sits on an inner div, not the panel: base-ui waits for animations on the panel to end before hiding it, which left the old panel on screen during every switch.
 */
export function UrlTabs({
  param,
  tabs,
  initial,
  panels
}: {
  param: string;
  tabs: UrlTab[];
  initial: string;
  panels: Record<string, ReactNode>;
}) {
  const [active, setActive] = useState(initial);

  return (
    <Tabs
      value={active}
      onValueChange={(next) => {
        const value = String(next);
        setActive(value);
        const url = new URL(window.location.href);
        if (value === tabs[0]?.id) url.searchParams.delete(param);
        else url.searchParams.set(param, value);
        window.history.replaceState(null, '', url);
      }}
      className="gap-6"
    >
      <TabsList
        variant="line"
        className="w-full justify-start overflow-x-auto overflow-y-hidden border-border border-b"
      >
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="flex-none">
            {tab.label}
            {tab.count !== undefined && <span className="text-muted-foreground tabular-nums">{tab.count}</span>}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          <div className="animate-panel">{panels[tab.id]}</div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
