"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/** Sidebar on large screens; horizontally scrolling top nav on small screens. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-gold-400 text-forest-900" : "text-forest-50 hover:bg-forest-700 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
