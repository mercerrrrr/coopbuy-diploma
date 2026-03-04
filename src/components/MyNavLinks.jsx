"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MyNavLinks({ unreadCount = 0 }) {
  const pathname = usePathname();

  const links = [
    { href: "/my/procurements", label: "Закупки" },
    { href: "/my/orders", label: "Заявки" },
    {
      href: "/my/notifications",
      label: "Уведомления",
      badge: unreadCount > 0 ? (unreadCount > 9 ? "9+" : String(unreadCount)) : null,
    },
  ];

  return (
    <div className="flex gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "bg-zinc-900 text-white"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",
            ].join(" ")}
          >
            {link.label}
            {link.badge && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold min-w-4.5 h-4.5 px-1 leading-none">
                {link.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
