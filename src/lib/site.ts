export const SITE_NAME = "Yatra Travel";
export const TAGLINE = "Your Journey, Our Devotion.";
export const DEFAULT_DESCRIPTION =
  "Tirupati-based travel operator for Tirumala hill transfers, temple tours, local cabs and customisable pilgrimage packages across Tirupati and nearby destinations.";

/** Shown wherever Tirumala/temple services are mentioned. Required for compliance. */
export const TTD_DISCLAIMER =
  "Yatra Travel is a private transport and tour operator. We are not affiliated with, authorised by or acting on behalf of Tirumala Tirupati Devasthanams (TTD) or any temple administration. We do not sell darshan, seva or accommodation tickets and cannot guarantee darshan. Please book these only through official TTD channels.";

export const MAIN_NAV = [
  { href: "/packages", label: "Tour Packages" },
  { href: "/tirumala-tirupati", label: "Tirumala & Tirupati" },
  { href: "/temple-tours", label: "Temple Tours" },
  { href: "/destinations", label: "Destinations" },
  { href: "/cab-booking", label: "Cab Booking" },
  { href: "/custom-itinerary", label: "Custom Trip" },
] as const;

export const FOOTER_NAV = {
  Explore: [
    { href: "/packages", label: "Tour packages" },
    { href: "/tirumala-tirupati", label: "Tirumala & Tirupati travel" },
    { href: "/temple-tours", label: "Temple tours" },
    { href: "/destinations", label: "Destinations" },
    { href: "/blog", label: "Travel guides" },
  ],
  Book: [
    { href: "/cab-booking", label: "Cab booking" },
    { href: "/custom-itinerary", label: "Custom itinerary" },
    { href: "/account", label: "My bookings" },
    { href: "/faqs", label: "FAQs" },
  ],
  Company: [
    { href: "/about", label: "About us" },
    { href: "/contact", label: "Contact & support" },
  ],
  Policies: [
    { href: "/privacy-policy", label: "Privacy policy" },
    { href: "/terms", label: "Terms of service" },
    { href: "/cancellation-refund-policy", label: "Cancellation & refunds" },
    { href: "/cookie-policy", label: "Cookie policy" },
  ],
} as const;

export function whatsappLink(number: string, message: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
