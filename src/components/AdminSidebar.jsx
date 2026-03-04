"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  MapPin,
  BookOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/procurements", label: "Закупки", icon: ShoppingCart },
  { href: "/admin/suppliers", label: "Поставщики", icon: Building2 },
  { href: "/admin/locations", label: "Локации", icon: MapPin },
  { href: "/admin/dictionaries", label: "Справочники", icon: BookOpen },
];

export function AdminSidebar({ role }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-zinc-950 min-h-screen sticky top-0 self-start h-screen">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-zinc-800/60">
        <Link href="/" className="font-bold text-white text-base tracking-tight hover:opacity-80 transition-opacity">
          <span className="text-indigo-400">Coop</span>Buy
        </Link>
        <div className="text-xs text-zinc-500 mt-1">
          {role === "OPERATOR" ? "Оператор" : "Администратор"}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/admin/dashboard"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/70",
              ].join(" ")}
            >
              <Icon size={16} className="shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-4 border-t border-zinc-800/60">
        <div className="text-xs text-zinc-600">CoopBuy &copy; 2026</div>
      </div>
    </aside>
  );
}
