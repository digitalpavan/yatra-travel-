"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The menu is open only for the path it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpenOn(open ? null : pathname)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-forest-900 hover:bg-forest-50"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="Mobile" className="absolute inset-x-0 top-16 border-b border-line bg-ivory shadow-lg">
          <ul className="mx-auto max-w-6xl px-4 py-3">
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={() => setOpenOn(null)} className="block rounded-lg px-3 py-3 font-medium text-forest-900 hover:bg-forest-50">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
