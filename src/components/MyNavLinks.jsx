"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Package, ShoppingCart } from "@phosphor-icons/react";
import { MY_NAV_ITEMS } from "@/lib/constants";

export function MyNavLinks({ unreadCount = 0 }) {
  const pathname = usePathname();

  const iconMap = { ShoppingCart, Package, Bell };
  const links = MY_NAV_ITEMS.map((item) => ({
    ...item,
    icon: iconMap[item.icon],
    badge:
      item.href === "/my/notifications" && unreadCount > 0
        ? unreadCount > 9
          ? "9+"
          : String(unreadCount)
        : null,
  }));

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex min-h-9 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
              isActive
                ? "border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent-strong)]"
                : "border-transparent text-[color:var(--cb-text-soft)] hover:border-[color:var(--cb-line)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Icon size={16} weight={isActive ? "fill" : "regular"} />
              {link.label}
            </span>
            {link.badge && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-[color:var(--cb-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
