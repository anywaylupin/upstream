'use client';

import { ChevronDownIcon, CompassIcon, DownloadIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AddRepoDialog } from '@/components/add-repo-dialog';
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
/**
 * The header "+" menu. Owns the add-repo dialog so there is exactly one place
 * in the app that starts this action.
 */
export function CreateMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" />} aria-label="Add">
          <PlusIcon />
          <ChevronDownIcon className="size-3 opacity-60" />
        </DropdownMenuTrigger>
        {/* Auto width with nowrap items: a fixed width wrapped the longest label. */}
        <DropdownMenuContent
          align="end"
          className="w-auto min-w-52 [&_[data-slot=dropdown-menu-item]]:whitespace-nowrap"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Add to stack</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <PlusIcon />
              Repo by URL
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/repositories?source=search" />}>
              <CompassIcon />
              Search GitHub
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/repositories?source=owned" />}>
              <DownloadIcon />
              Browse your GitHub repos
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddRepoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
