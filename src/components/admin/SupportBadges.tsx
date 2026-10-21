import { Badge } from "@/components/ui";

const TICKET_TONES: Record<string, "gold" | "green" | "gray" | "red" | "blue"> = {
  open: "gold",
  in_progress: "blue",
  resolved: "green",
  closed: "gray",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export function TicketStatusBadge({ status }: { status: string }) {
  return <Badge tone={TICKET_TONES[status] ?? "gray"}>{TICKET_STATUS_LABELS[status] ?? status}</Badge>;
}
