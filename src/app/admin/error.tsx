"use client";

import { useEffect } from "react";
import { Alert, Button } from "@/components/ui";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Alert tone="error" title="Something went wrong">
        This admin page could not be displayed. Please try again; if the problem continues, check the server logs.
      </Alert>
      <Button type="button" variant="outline" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
