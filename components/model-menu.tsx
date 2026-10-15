'use client';

import { CheckIcon, ChevronDownIcon, KeyRoundIcon, LockIcon, SparklesIcon } from 'lucide-react';
import { useActionState, useEffect, useId, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type KeyState, saveAiKey, selectAiModel } from '@/app/actions/ai';
import { ProviderIcon } from '@/components/provider-icon';
import { Badge } from '@/components/ui/badge';
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
import { ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { canRun, findModel, PROVIDERS, type ProviderId, providerOf, sortedModelsByProvider } from '@/lib/ai-models';

const initialState: KeyState = {};

/**
 * Only models that will actually run: own key unlocks a provider, the shared key covers its free tier.
 * Listing a model that fails on use is worse than hiding it.
 *
 * Keyed on the provider: switching it unmounts the selected item, and base-ui resets its own value to null rather than to the new list's first entry.
 * Remounting re-seeds it from `modelId`.
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add an AI key</DialogTitle>
            <DialogDescription>Encrypted. Tested before saving.</DialogDescription>
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
                className="text-muted-foreground text-xs underline transition-colors hover:text-foreground"
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
