"use client";

import { ChartPieIcon, ScaleIcon, SettingsIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Tableau de bord", icon: ChartPieIcon },
  { href: "/holdings", label: "Mes lignes", icon: WalletIcon },
  { href: "/rebalance", label: "Rééquilibrage", icon: ScaleIcon },
  { href: "/settings", label: "Réglages", icon: SettingsIcon },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
