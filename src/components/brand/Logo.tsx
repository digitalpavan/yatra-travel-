/**
 * Yatra Travel logo concept: a stylised temple gopuram (tiered tower) with a
 * kalasam finial, set inside an arch that doubles as a road curving onward —
 * devotion and journey in one mark.
 */
export function LogoMark({ className = "h-10 w-10", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <circle cx="32" cy="32" r="31" fill="#0f3d2e" />
      <circle cx="32" cy="32" r="27.5" fill="none" stroke="#d9a83a" strokeWidth="1.5" />
      {/* kalasam */}
      <path d="M32 9.5c1.6 0 2.6 1.2 2.6 2.6 0 1-.6 1.7-1.3 2.1h1.2v1.6h-5v-1.6h1.2c-.7-.4-1.3-1.1-1.3-2.1 0-1.4 1-2.6 2.6-2.6z" fill="#f2d98f" />
      {/* gopuram tiers */}
      <path d="M27.5 17h9l1.2 5h-11.4z" fill="#d9a83a" />
      <path d="M25.5 22h13l1.4 6h-15.8z" fill="#c18e26" />
      <path d="M23.5 28h17l1.6 7h-20.2z" fill="#d9a83a" />
      <path d="M21.5 35h21l1.8 8h-24.6z" fill="#c18e26" />
      {/* doorway */}
      <path d="M29.6 43v-3.4a2.4 2.4 0 0 1 4.8 0V43z" fill="#0f3d2e" />
      {/* road */}
      <path d="M12 52c6-5.5 13-8.3 20-8.3S46 46.5 52 52" fill="none" stroke="#f2d98f" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M32 46.5v2.2M32 51v2" stroke="#0f3d2e" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "", tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-10 w-10 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl font-semibold text-forest-800">
          Yatra <span className="text-gold-600">Travel</span>
        </span>
        {tagline && <span className="mt-1 text-[11px] tracking-wide text-muted">Your Journey, Our Devotion.</span>}
      </span>
    </span>
  );
}
