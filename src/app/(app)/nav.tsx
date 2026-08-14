"use client";

import {
  BookOpen,
  FileText,
  LayoutDashboard,
  Library,
  Settings,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useT } from "@/components/locale-provider";
import type { MessageKey } from "@/lib/i18n";

type NavItem = {
  href: string;
  labelKey: MessageKey;
  icon: typeof LayoutDashboard;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/tracks", labelKey: "nav.tracks", icon: BookOpen },
  { href: "/proposals", labelKey: "nav.proposals", icon: FileText },
  { href: "/library", labelKey: "nav.library", icon: Library },
  { href: "/settings", labelKey: "nav.settings", icon: Settings },
];

const ADMIN_ITEM: NavItem = {
  href: "/admin",
  labelKey: "nav.admin",
  icon: ShieldCheck,
};

function useItems(isAdmin: boolean): NavItem[] {
  return isAdmin ? [...ITEMS, ADMIN_ITEM] : ITEMS;
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar navigation. Rendered inside the `lg:` aside. */
export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  const items = useItems(isAdmin);
  const isActive = useIsActive();

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1">
        {items.map(({ href, labelKey, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm transition-colors",
                isActive(href)
                  ? "bg-violet-100 font-semibold text-primary"
                  : "text-ink-muted hover:bg-violet-100/60 hover:text-primary",
              )}
            >
              <Icon className="size-4.5 shrink-0" />
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Mobile bottom tab bar.
 *
 * Settings is dropped here so the bar never exceeds four targets on a 390px
 * screen; it stays reachable from the sidebar on desktop and from the dashboard.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useT();
  const items = useItems(isAdmin).filter((item) => item.href !== "/settings");
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex">
        {items.map(({ href, labelKey, icon: Icon }) => (
          <li key={href} className="flex-1">
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                isActive(href) ? "font-semibold text-accent" : "text-ink-muted",
              )}
            >
              <Icon className="size-5" />
              <span className="truncate">{t(labelKey)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
