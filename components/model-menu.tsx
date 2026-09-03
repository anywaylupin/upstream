'use client';

import { CheckIcon, ChevronDownIcon, KeyRoundIcon, LockIcon, SparklesIcon } from 'lucide-react';
import { useActionState, useEffect, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cn } from 'tailwind-variants';
import { type KeyState, saveAiKey, selectAiModel } from '@/app/actions';
import { ProviderIcon } from '@/components/provider-icon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { findModel, PROVIDERS, type ProviderId, providerOf, sortedModelsByProvider } from '@/lib/ai-models';

const initialState: KeyState = {};

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
  const [provider, setProvider] = useState<ProviderId>('groq');
  const [modelId, setModelId] = useState(sortedModelsByProvider('groq')[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [state, formAction, saving] = useActionState(saveAiKey, initialState);
  const apiKeyId = useId();

  const active = findModel(activeModelId);

  useEffect(() => {
    if (state.error) toast.error('Key rejected', { description: state.error });
    else if (state.success) {
      toast.success('Key saved', { description: 'Model switched.' });
      setDialogOpen(false);
    }
  }, [state]);

  function choose(id: string) {
    startTransition(async () => {
      const res = await selectAiModel(id);
      if (res.error) toast.error(res.error);
      else toast.success(`Using ${res.message}`);
    });
  }

  // Usable means there is a key to run it with: the user's own, or one in the
  // server's env. A provider with neither is not offered at all - listing a
  // model that cannot run is worse than not listing it.
  function usable(p: ProviderId) {
    return serverProviders.includes(p) || keyedProviders.includes(p);
  }

  const offered = PROVIDERS.filter((p) => usable(p.id));

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
              {sortedModelsByProvider(p.id).map((model) => (
                <DropdownMenuItem key={model.id} onClick={() => choose(model.id)} className="items-start">
                  <ProviderIcon provider={p.id} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {model.label}
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-px text-[10px] leading-4',
                          model.tier === 'free' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {model.tier}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">{model.note}</span>
                  </span>
                  {activeModelId === model.id && <CheckIcon className="mt-0.5 ml-auto size-3.5 shrink-0" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
          ))}

          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setDialogOpen(true)}>
              <KeyRoundIcon />
              Add an API key
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an AI key</DialogTitle>
            <DialogDescription>
              Your key is encrypted and only used for your own requests. It is checked against the chosen model before
              saving.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="flex flex-col gap-3">
            <input type="hidden" name="provider" value={provider} />
            <input type="hidden" name="model" value={modelId} />

            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">Provider</span>
              <Select
                value={provider}
                onValueChange={(value) => {
                  const next = String(value) as ProviderId;
                  setProvider(next);
                  // sorted, so this lands on a free model when the provider has one
                  setModelId(sortedModelsByProvider(next)[0]?.id ?? '');
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (
                      <span className="flex min-w-0 items-center gap-2">
                        <ProviderIcon provider={value as ProviderId} />
                        <span className="truncate">{providerOf(value)?.label ?? 'Choose a provider'}</span>
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <ProviderIcon provider={p.id} />
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">Model</span>
              {/* Keyed on the provider: switching it unmounts the selected item,
                  and base-ui resets its own value to null rather than to the new
                  list's first entry. Remounting re-seeds it from `modelId`. */}
              <Select key={provider} value={modelId} onValueChange={(value) => setModelId(String(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => <span className="truncate">{findModel(value)?.label ?? 'Choose a model'}</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortedModelsByProvider(provider).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={apiKeyId} className="font-medium text-sm">
                API key
              </label>
              <Input
                id={apiKeyId}
                name="apiKey"
                type="password"
                autoComplete="off"
                spellCheck={false}
                required
                placeholder={providerOf(provider)?.keyPrefix}
                className="font-mono"
                disabled={saving}
                aria-busy={saving}
              />
              <a
                href={providerOf(provider)?.keysUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground text-xs underline transition-colors hover:text-primary"
              >
                Get a {providerOf(provider)?.label} key
              </a>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving} aria-busy={saving}>
                {saving && <Spinner />}
                {saving ? 'Checking…' : 'Save key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
