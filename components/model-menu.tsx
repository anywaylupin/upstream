'use client';

import { CheckIcon, ChevronDownIcon, KeyRoundIcon, LockIcon, SparklesIcon } from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { type KeyState, saveAiKey, selectAiModel } from '@/app/actions';
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
import { findModel, modelsByProvider, PROVIDERS, type ProviderId, providerOf } from '@/lib/ai-models';

const initialState: KeyState = {};

export function ModelMenu({
  activeModelId,
  keyedProviders
}: {
  activeModelId: string;
  /** Providers this user already has a key for. */
  keyedProviders: string[];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>('groq');
  const [modelId, setModelId] = useState(modelsByProvider('groq')[0]?.id ?? '');
  const [pending, startTransition] = useTransition();
  const [state, formAction, saving] = useActionState(saveAiKey, initialState);

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

  // The server key covers Google only; everything else needs the user's key.
  function usable(p: ProviderId) {
    return p === 'google' || keyedProviders.includes(p);
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={<DropdownMenuTrigger render={<Button variant="ghost" size="sm" />} aria-label="AI model" />}
          >
            {pending ? <Spinner data-icon="inline-start" /> : <SparklesIcon data-icon="inline-start" />}
            <span className="hidden lg:inline">{active?.label ?? 'Model'}</span>
            <ChevronDownIcon className="size-3 opacity-60" />
          </TooltipTrigger>
          <TooltipContent>AI model and keys</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-72">
          {PROVIDERS.map((p) => (
            <DropdownMenuGroup key={p.id}>
              <DropdownMenuLabel>
                {p.label}
                {!usable(p.id) && <span className="ml-1 text-muted-foreground">· key needed</span>}
              </DropdownMenuLabel>
              {modelsByProvider(p.id).map((model) => (
                <DropdownMenuItem key={model.id} disabled={!usable(p.id)} onClick={() => choose(model.id)}>
                  {usable(p.id) ? <SparklesIcon className="opacity-60" /> : <LockIcon className="opacity-60" />}
                  <span className="flex flex-col">
                    <span>{model.label}</span>
                    <span className="text-muted-foreground text-xs">{model.free}</span>
                  </span>
                  {activeModelId === model.id && <CheckIcon className="ml-auto size-3.5" />}
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
                  setModelId(modelsByProvider(next)[0]?.id ?? '');
                }}
              >
                <SelectTrigger>
                  <SelectValue>{(value: string) => providerOf(value)?.label ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">Model</span>
              <Select value={modelId} onValueChange={(value) => setModelId(String(value))}>
                <SelectTrigger>
                  <SelectValue>{(value: string) => findModel(value)?.label ?? value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {modelsByProvider(provider).map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm">API key</span>
              <Input
                name="apiKey"
                type="password"
                autoComplete="off"
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
