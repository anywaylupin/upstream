"use client";

import {
  BookMarkedIcon,
  GaugeIcon,
  LayersIcon,
  type LucideIcon,
  NewspaperIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "tailwind-variants";

type Tab = { href: string; label: string; icon: LucideIcon; count?: number };

/** The underlined tab strip GitHub puts under the header on a profile. */
export function NavTabs({
  stackCount,
  digestCount,
}: {
  stackCount: number;
  digestCount: number;
}) {
  const pathname = usePathname();

  const tabs: Tab[] = [
    { href: "/", label: "Dashboard", icon: GaugeIcon },
    {
      href: "/digest",
      label: "Digest",
      icon: NewspaperIcon,
      count: digestCount,
    },
    { href: "/stack", label: "Stack", icon: LayersIcon, count: stackCount },
    { href: "/repositories", label: "Repositories", icon: BookMarkedIcon },
  ];

  return (
    <nav className="min-w-0 flex-1">
      <div className="flex gap-0.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href) ||
                // A repo page belongs to the Stack tab.
                (tab.href === "/stack" && pathname.startsWith("/repos/"));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-muted font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <tab.icon
                className={cn(
                  "size-4 transition-transform duration-200 group-hover:scale-110",
                  active && "text-primary",
                )}
              />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
