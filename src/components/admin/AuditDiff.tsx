/** Read-only before/after view for an audit_logs row (server-safe). */

type Json = Record<string, unknown> | null;

const NOISE = new Set(["updated_at"]);
const MAX = 300;

function show(value: unknown): string {
  if (value === undefined) return "—";
  const s = JSON.stringify(value) ?? "null";
  return s.length > MAX ? `${s.slice(0, MAX)}…` : s;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function asObject(v: unknown): Json {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function AuditDiff({ action, before, after }: { action: string; before: unknown; after: unknown }) {
  const b = asObject(before);
  const a = asObject(after);
  const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})])).sort();

  const rows =
    action === "update" && b && a
      ? keys.filter((k) => !NOISE.has(k) && !same(b[k], a[k]))
      : keys;
  const mode = action === "update" && b && a ? "update" : action === "delete" ? "delete" : "insert";

  if (rows.length === 0) {
    return <p className="text-xs text-muted">{mode === "update" ? "No field changes (timestamp only)." : "No data recorded."}</p>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium text-forest-800">
        {mode === "update" ? `${rows.length} changed field${rows.length === 1 ? "" : "s"}` : `${rows.length} field${rows.length === 1 ? "" : "s"}`}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 pr-3 font-semibold">Field</th>
              {mode === "update" ? (
                <>
                  <th scope="col" className="py-1 pr-3 font-semibold">Before</th>
                  <th scope="col" className="py-1 font-semibold">After</th>
                </>
              ) : (
                <th scope="col" className="py-1 font-semibold">{mode === "delete" ? "Deleted value" : "Value"}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k} className="border-t border-line/60 align-top">
                <td className="py-1 pr-3 font-mono font-semibold whitespace-nowrap">{k}</td>
                {mode === "update" ? (
                  <>
                    <td className="py-1 pr-3 font-mono break-all text-red-800">{show(b?.[k])}</td>
                    <td className="py-1 font-mono break-all text-forest-800">{show(a?.[k])}</td>
                  </>
                ) : (
                  <td className="py-1 font-mono break-all">{show((mode === "delete" ? b : a)?.[k])}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
