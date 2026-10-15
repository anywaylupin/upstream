'use client';

import { KeyRoundIcon } from 'lucide-react';
import { useActionState, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { type KeyState, saveAiKey } from '@/app/actions/ai';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { findModel, PROVIDERS, type ProviderId, providerOf, sortedModelsByProvider } from '@/lib/ai-models';

const initialState: KeyState = {};

/**
 * The bring-your-own-key form, shared by the model picker and the AI settings tab so the two cannot drift.
 *
 * The model select is keyed on the provider: switching it unmounts the selected item, and base-ui resets its own value to null rather than to the new list's first entry.
 * Remounting re-seeds it from `modelId`.
 */
export function AddKeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [provider, setProvider] = useState<ProviderId>('groq');
  const [modelId, setModelId] = useState(sortedModelsByProvider('groq')[0]?.id ?? '');
  const [state, formAction, saving] = useActionState(saveAiKey, initialState);
  const apiKeyId = useId();

  useEffect(() => {
    if (state.error) toast.error('Key rejected', { description: state.error });
    else if (state.success) {
      toast.success('Key saved', { description: 'Model switched.' });
      onOpenChange(false);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
  );
}

/** A page-level button that opens the key dialog. */
export function AddKeyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <KeyRoundIcon data-icon="inline-start" />
        Add an API key
      </Button>
      <AddKeyDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
