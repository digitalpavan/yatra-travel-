"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "yt_consent_v1";
const CHANGE_EVENT = "yt:consent-change";
type Choice = { analytics: boolean; decidedAt: string };

// Fallback when localStorage is blocked: the choice lasts for this page session.
let memoryChoice: string | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readRaw(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? memoryChoice ?? "";
  } catch {
    return memoryChoice ?? "";
  }
}

function parse(raw: string): Choice | null {
  try {
    return raw ? (JSON.parse(raw) as Choice) : null;
  } catch {
    return null;
  }
}

function anonymousId(): string {
  try {
    let id = localStorage.getItem("yt_anon_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("yt_anon_id", id);
    }
    return id;
  } catch {
    return "unavailable";
  }
}

/**
 * Cookie banner. Only strictly necessary cookies (auth session) are set without
 * consent. Analytics loads only if configured AND the visitor opts in.
 */
export function CookieConsent({ gaMeasurementId }: { gaMeasurementId: string }) {
  // null on the server / first render → banner hidden until the browser value is known.
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  const choice = raw ? parse(raw) : null;
  const [reopened, setReopened] = useState(false);

  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener("yt:open-cookie-settings", reopen);
    return () => window.removeEventListener("yt:open-cookie-settings", reopen);
  }, []);

  function decide(analytics: boolean) {
    const next = JSON.stringify({ analytics, decidedAt: new Date().toISOString() } satisfies Choice);
    memoryChoice = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked — memoryChoice applies */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setReopened(false);
    void fetch("/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anonymous_id: anonymousId(), analytics }),
    }).catch(() => undefined);
  }

  const analyticsOn = Boolean(gaMeasurementId && choice?.analytics);
  const showBanner = raw !== null && (!choice || reopened);

  return (
    <>
      {analyticsOn && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaMeasurementId}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {showBanner && (
        <div role="dialog" aria-live="polite" aria-label="Cookie preferences" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white p-4 shadow-2xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md sm:rounded-2xl sm:border">
          <p className="text-sm text-charcoal">
            We use essential cookies to keep you signed in and secure your bookings.
            {gaMeasurementId ? " With your permission, we also use analytics cookies to understand how the site is used." : ""}{" "}
            <Link href="/cookie-policy" className="underline">
              Cookie policy
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {gaMeasurementId ? (
              <>
                <button type="button" onClick={() => decide(true)} className="rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white">
                  Accept analytics
                </button>
                <button type="button" onClick={() => decide(false)} className="rounded-full border border-forest-800/30 px-4 py-2 text-sm font-semibold text-forest-800">
                  Essential only
                </button>
              </>
            ) : (
              <button type="button" onClick={() => decide(false)} className="rounded-full bg-forest-800 px-4 py-2 text-sm font-semibold text-white">
                OK
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function CookieSettingsButton() {
  return (
    <button type="button" className="underline" onClick={() => window.dispatchEvent(new Event("yt:open-cookie-settings"))}>
      Change cookie settings
    </button>
  );
}
