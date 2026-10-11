'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** A command or snippet with a copy button in the corner, the way shadcn's docs do it. */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <figure className="flex flex-col gap-1.5">
      {label && <figcaption className="text-muted-foreground text-sm">{label}</figcaption>}
      <div className="group relative">
        <pre className="overflow-x-auto rounded-lg bg-muted px-4 py-3 pr-12 font-mono text-[13px] leading-relaxed">
          <code>{code}</code>
        </pre>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </figure>
  );
}
