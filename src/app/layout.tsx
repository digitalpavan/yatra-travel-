import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { CookieConsent } from "@/components/layout/CookieConsent";
import { publicEnv } from "@/lib/env";
import { DEFAULT_DESCRIPTION, SITE_NAME, TAGLINE } from "@/lib/site";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"], display: "swap" });
const heading = Playfair_Display({ variable: "--font-heading", subsets: ["latin"], display: "swap", weight: ["500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.siteUrl),
  title: { default: `${SITE_NAME} — Tirupati Temple Tours, Tirumala Cabs & Pilgrimage Packages`, template: `%s | ${SITE_NAME}` },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "en_IN", type: "website", description: `${TAGLINE} ${DEFAULT_DESCRIPTION}` },
  formatDetection: { telephone: false },
  ...(publicEnv.googleSiteVerification && { verification: { google: publicEnv.googleSiteVerification } }),
};

export const viewport: Viewport = {
  themeColor: "#0f3d2e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${body.variable} ${heading.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <CookieConsent gaMeasurementId={publicEnv.gaMeasurementId} />
      </body>
    </html>
  );
}
