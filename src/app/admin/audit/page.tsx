import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/server/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, istDateTime } from "@/lib/dates";
import { Alert, Badge, EmptyState, Field, Input, Select, buttonClass } from "@/components/ui";
import { AdminHeader, LoadError, Pagination, Panel, TableWrap, Td, Th, pageParam, sp } from "@/components/admin/AdminUI";
import { AuditDiff } from "@/components/admin/AuditDiff";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

const PAGE_SIZE = 50;
const ENTITY_TYPES = [
  "staff_members",
  "destinations",
  "packages",
  "package_prices",
  "vehicle_rates",
  "cab_routes",
  "pricing_rules",
  "coupons",
  "site_settings",
  "blog_posts",
  "faqs",
  "vehicles",
  "drivers",
  "bookings",
  "vehicle_assignments",
  "payments",
  "refunds",
  "reviews",
  "data_requests",
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  created_at: string;
}

const ACTION_TONES: Record<string, "green" | "blue" | "red" | "gray"> = { insert: "green", update: "blue", delete: "red" };

function istDay(value: string | undefined): Date | null {
  if (!value || !DATE_RE.test(value)) return null;
  try {
    return istDateTime(value);
  } catch {
    return null;
  }
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit.read", "/admin/audit");
  const params = await searchParams;
  const entityParam = sp(params.entity);
  const entity = (ENTITY_TYPES as readonly string[]).includes(entityParam ?? "") ? entityParam : undefined;
  const actor = sp(params.actor, 254);
  const entityId = sp(params.entity_id, 120);
  const fromStr = sp(params.from, 10);
  const toStr = sp(params.to, 10);
  const page = pageParam(params.page);

  const fromDate = istDay(fromStr);
  const toDate = istDay(toStr);
  const problems: string[] = [];
  if (fromStr && !fromDate) problems.push("The “from” date is invalid and was ignored.");
  if (toStr && !toDate) problems.push("The “to” date is invalid and was ignored.");

  const supabase = await createSupabaseServerClient();

  // Resolve the actor filter: a raw uuid, or an email looked up in profiles.
  let actorId: string | null | undefined;
  let actorLookupFailed = false;
  if (actor) {
    if (UUID_RE.test(actor)) actorId = actor.toLowerCase();
    else {
      const { data, error } = await supabase.from("profiles").select("id").ilike("email", escapeLike(actor.toLowerCase())).limit(1);
      if (error) actorLookupFailed = true;
      actorId = (data?.[0] as { id: string } | undefined)?.id ?? null;
    }
  }

  let rows: AuditRow[] = [];
  let count: number | null = null;
  let loadError = false;
  const emails = new Map<string, string>();

  if (actorId !== null) {
    let q = supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, before_data, after_data, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (entity) q = q.eq("entity_type", entity);
    if (entityId) q = q.eq("entity_id", entityId);
    if (actorId) q = q.eq("actor_id", actorId);
    if (fromDate) q = q.gte("created_at", fromDate.toISOString());
    if (toDate) q = q.lt("created_at", new Date(toDate.getTime() + 86_400_000).toISOString());
    const res = await q;
    loadError = Boolean(res.error);
    rows = (res.data ?? []) as unknown as AuditRow[];
    count = res.count ?? null;

    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v))));
    if (actorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", actorIds);
      for (const p of (profiles ?? []) as { id: string; email: string | null }[]) if (p.email) emails.set(p.id, p.email);
    }
  }

  const filterParams = { entity, actor, entity_id: entityId, from: fromDate ? fromStr : undefined, to: toDate ? toStr : undefined };
  const hasFilters = Object.values(filterParams).some(Boolean);

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Audit log"
        back={{ href: "/admin", label: "Overview" }}
        intro="Every change to staff, catalog, pricing, fleet, bookings, payments, refunds, reviews and privacy requests is recorded here. The log is read-only. Times are IST."
      />

      <Panel title="Filters">
        <form method="get" action="/admin/audit" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <Field label="Entity" name="entity">
            <Select name="entity" defaultValue={entity ?? ""}>
              <option value="">All entities</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Actor (email or user id)" name="actor">
            <Input name="actor" defaultValue={actor ?? ""} autoComplete="off" maxLength={254} />
          </Field>
          <Field label="Entity id" name="entity_id">
            <Input name="entity_id" defaultValue={entityId ?? ""} autoComplete="off" maxLength={120} />
          </Field>
          <Field label="From (IST)" name="from">
            <Input name="from" type="date" defaultValue={fromDate ? fromStr : ""} />
          </Field>
          <Field label="To (IST, inclusive)" name="to">
            <Input name="to" type="date" defaultValue={toDate ? toStr : ""} />
          </Field>
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            <button type="submit" className={buttonClass("primary", "sm")}>
              Apply filters
            </button>
            {hasFilters && (
              <Link href="/admin/audit" className={buttonClass("ghost", "sm")}>
                Clear
              </Link>
            )}
          </div>
        </form>
      </Panel>

      {problems.length > 0 && (
        <Alert tone="warning" title="Some filters were ignored">
          {problems.join(" ")}
        </Alert>
      )}

      <Panel>
        {actorLookupFailed || loadError ? (
          <LoadError what="the audit log" />
        ) : actorId === null ? (
          <EmptyState title="No account with that email">Check the spelling, or paste the user id instead.</EmptyState>
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries">{hasFilters ? "Nothing matches these filters." : "No changes have been recorded yet."}</EmptyState>
        ) : (
          <>
            <TableWrap label="Audit log entries">
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Changes</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{formatDateTime(r.created_at)}</Td>
                    <Td className="max-w-[14rem] break-all">
                      {r.actor_id ? (
                        <Link className="text-forest-800 hover:underline" href={`/admin/audit?actor=${r.actor_id}`} title={r.actor_id}>
                          {emails.get(r.actor_id) ?? <span className="font-mono text-xs">{r.actor_id}</span>}
                        </Link>
                      ) : (
                        <span className="text-muted">System</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={ACTION_TONES[r.action] ?? "gray"}>{r.action}</Badge>
                    </Td>
                    <Td>
                      <Link className="text-forest-800 hover:underline" href={`/admin/audit?entity=${r.entity_type}`}>
                        {r.entity_type.replace(/_/g, " ")}
                      </Link>
                      {r.entity_id && (
                        <Link
                          className="block font-mono text-xs break-all text-muted hover:underline"
                          href={`/admin/audit?entity=${r.entity_type}&entity_id=${encodeURIComponent(r.entity_id)}`}
                        >
                          {r.entity_id}
                        </Link>
                      )}
                    </Td>
                    <Td className="min-w-[20rem]">
                      <AuditDiff action={r.action} before={r.before_data} after={r.after_data} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <Pagination page={page} pageSize={PAGE_SIZE} total={count} basePath="/admin/audit" params={filterParams} />
          </>
        )}
      </Panel>
    </div>
  );
}
