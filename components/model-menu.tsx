'use client';

import { CheckIcon, ChevronDownIcon, KeyRoundIcon, LockIcon, SparklesIcon } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { selectAiModel } from '@/app/actions/ai';
import { AddKeyDialog } from '@/components/add-key-dialog';
import { ProviderIcon } from '@/components/provider-icon';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canRun, findModel, PROVIDERS, type ProviderId, sortedModelsByProvider } from '@/lib/ai-models';

/**
 * Only models that will actually run: own key unlocks a provider, the shared key covers its free tier.
 * Listing a model that fails on use is worse than hiding it.
 */
export function ModelMenu({
  activeModelId,
  keyedProviders,
  serverProviders
}: {
  activeModelId: string;
  /** Providers this user already has a key for. */
  keyedProviders: string[];
  /** Providers the server has an env key for, usable without BYOK. */
  serverProviders: string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = findModel(activeModelId);

  function choose(id: string) {
    startTransition(async () => {
      const res = await selectAiModel(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Using ${res.message}`);
    });
  }

  const keys = { own: keyedProviders, server: serverProviders };
  const runnable = (p: ProviderId) => sortedModelsByProvider(p).filter((m) => canRun(m, keys));
  const offered = PROVIDERS.filter((p) => runnable(p.id).length > 0);

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={<DropdownMenuTrigger render={<Button variant="outline" size="sm" />} aria-label="AI model" />}
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : active ? (
              <ProviderIcon provider={active.provider} data-icon="inline-start" />
            ) : (
              <SparklesIcon data-icon="inline-start" />
            )}
            <span className="hidden lg:inline">{active?.label ?? 'Model'}</span>
            <ChevronDownIcon className="size-3 opacity-60" />
          </TooltipTrigger>
          <TooltipContent>AI model and keys</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="max-h-[70vh] w-80 overflow-y-auto">
          {offered.length === 0 && (
            <DropdownMenuGroup>
              <DropdownMenuLabel>No models available</DropdownMenuLabel>
              <DropdownMenuItem disabled>
                <LockIcon className="opacity-60" />
                <span className="text-muted-foreground text-xs">Add a key to unlock a provider.</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          )}

          {offered.map((p) => (
            <DropdownMenuGroup key={p.id}>
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ProviderIcon provider={p.id} className="size-3.5" />
                {p.label}
                {keyedProviders.includes(p.id) && <span className="text-muted-foreground">· your key</span>}
              </DropdownMenuLabel>
              {runnable(p.id).map((model) => (
                <DropdownMenuItem key={model.id} onClick={() => choose(model.id)} className="items-start">
                  <ProviderIcon provider={p.id} className="mt-0.5" />
                  <ItemContent className="min-w-0 gap-0.5">
                    <ItemTitle>
                      {model.label}
                      <Badge variant={model.tier === 'free' ? 'secondary' : 'outline'}>{model.tier}</Badge>
                    </ItemTitle>
                    <ItemDescription className="text-xs">{model.note}</ItemDescription>
                  </ItemContent>
                  {activeModelId === model.id && <CheckIcon className="mt-0.5 ml-auto size-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          ))}

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <KeyRoundIcon />
              <span className="flex flex-col">
                Add an API key
                <span className="text-muted-foreground text-xs">Unlocks paid models</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddKeyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
