"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Buildings,
  HouseLine,
  MapPin,
  Package,
  QrCode,
  SquaresFour,
  UsersThree,
} from "@phosphor-icons/react";
import { getAdminNavItems } from "@/lib/constants";

const ICON_MAP = {
  SquaresFour,
  Package,
  QrCode,
  UsersThree,
  Buildings,
  MapPin,
  BookOpenText,
};

export function AdminSidebar({ role }) {
  const pathname = usePathname();
  const navItems = getAdminNavItems(role);

  return (
    <aside className="sticky top-0 hidden min-h-[100dvh] w-[16.5rem] shrink-0 self-start border-r border-[color:var(--cb-line)] bg-[color:var(--cb-panel)] lg:flex lg:flex-col">
      <div className="border-b border-[color:var(--cb-line)] px-4 pb-4 pt-5">
        <Link href="/admin/dashboard" className="inline-flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent)]">
            <HouseLine size={18} weight="fill" />
          </span>
          <div>
            <div className="text-sm font-semibold text-[color:var(--cb-text)]">CoopBuy</div>
            <div className="mt-1 text-sm text-[color:var(--cb-text-soft)]">
              {role === "OPERATOR" ? "Оператор" : "Администратор"}
            </div>
          </div>
        </Link>

      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive =
            item.href === "/admin/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "border-[color:rgba(var(--cb-accent-rgb),0.16)] bg-[color:var(--cb-accent-soft)] text-[color:var(--cb-accent-strong)]"
                  : "border-transparent text-[color:var(--cb-text-soft)] hover:border-[color:var(--cb-line)] hover:bg-[color:var(--cb-bg-soft)] hover:text-[color:var(--cb-text)]"
              }`}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--cb-line)] bg-white">
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[color:var(--cb-line)] px-4 py-4 text-xs text-[color:var(--cb-text-soft)]">
        Организация совместных закупок
      </div>
    </aside>
  );
}
