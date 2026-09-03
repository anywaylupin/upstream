'use client';

import { useState } from 'react';
import { InstructionForm } from '@/components/instruction-form';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type InstructionTab = {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  value: string;
};

/** One instruction at a time: the three stacked forms buried the last two. */
export function InstructionTabs({ tabs }: { tabs: InstructionTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];

  if (!current) return null;

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={active} onValueChange={(value) => setActive(String(value))}>
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
              {tab.value && (
                <span role="img" aria-label="has instructions" className="ml-1.5 size-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Keyed so switching tabs resets the textarea to that tab's value. */}
      <InstructionForm
        key={current.id}
        feature={current.id}
        label={current.label}
        hint={current.hint}
        placeholder={current.placeholder}
        defaultValue={current.value}
      />
    </div>
  );
}
