import Link from "next/link";
import { DataRequestForm } from "@/components/account/AccountForms";
import { Badge, Card, SectionHeading, buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { requireUser } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Privacy & data", robots: { index: false, follow: false } };

const TYPE_LABELS: Record<string, string> = {
  access: "Access",
  correction: "Correction",
  deletion: "Deletion",
  withdraw_consent: "Withdraw consent",
};

export default async function PrivacyPage() {
  const viewer = await requireUser("/account/privacy");
  const supabase = await createSupabaseServerClient();
  const [{ data: requests }, { data: consents }] = await Promise.all([
    supabase.from("data_requests").select("id, request_type, status, response_note, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }),
    supabase.from("consent_records").select("id, purpose, granted, source, policy_version, created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <div className="space-y-6">
      <SectionHeading
        as="h1"
        title="Privacy & your data"
        intro={<>Your rights are explained in our <Link href="/privacy-policy" className="underline">privacy policy</Link>. You can update most details yourself on the <Link href="/account/profile" className="underline">profile page</Link>.</>}
      />
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Download your data</h2>
        <p className="mt-1 text-sm text-muted">A machine-readable copy of your profile, bookings, payments, support requests and consent history.</p>
        <a href="/api/account/export" className={`${buttonClass("outline")} mt-3`} download>
          Download (JSON)
        </a>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Make a request</h2>
        <p className="mb-3 text-sm text-muted">
          Deletion removes your account and personal details. Booking and payment records are kept (with your personal details removed) for the period required by tax and accounting law.
        </p>
        <DataRequestForm />
      </Card>
      {requests && requests.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
                <span>{TYPE_LABELS[r.request_type]} · {formatDateTime(r.created_at)}</span>
                <Badge tone={r.status === "completed" ? "green" : r.status === "rejected" ? "red" : "gold"}>{r.status.replace("_", " ")}</Badge>
                {r.response_note && <p className="w-full text-muted">{r.response_note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {consents && consents.length > 0 && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-semibold">Consent history</h2>
          <ul className="space-y-1 text-sm">
            {consents.map((c) => (
              <li key={c.id}>
                {formatDateTime(c.created_at)} — {c.purpose.replace("_", " ")}: <strong>{c.granted ? "given" : "withdrawn"}</strong> ({c.source.replace("_", " ")}, policy {c.policy_version})
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
