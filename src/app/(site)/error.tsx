"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, Container, buttonClass } from "@/components/ui";

export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-xl text-center" role="alert">
        <p className="text-xs font-semibold tracking-[0.2em] text-gold-600 uppercase">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">We hit a bump in the road</h1>
        <p className="mt-3 text-muted">
          This page could not be loaded right now. Please try again — if the problem continues, contact us and we will help.
        </p>
        {digest && <p className="mt-2 text-xs text-muted">Error reference: {digest}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" variant="gold" size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <Link href="/" className={buttonClass("outline", "lg")}>Go to the home page</Link>
        </div>
      </div>
    </Container>
  );
}
