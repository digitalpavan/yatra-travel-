"use client";

import { Button } from "@/components/ui";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      Print / save as PDF
    </Button>
  );
}
