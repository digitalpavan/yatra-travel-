"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";

interface Tier {
  min_hours_before: number;
  refund_bps: number;
}

interface Row {
  key: number;
  hours: string;
  refund: string;
}

/**
 * Repeatable rows for the cancellation refund tiers. Each row submits
 * `tier_hours` and `tier_refund` (percent); the server action pairs them by index.
 */
export function SettingsTiersEditor({ initial }: { initial: Tier[] }) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length ? initial : [undefined]).map((t, i) => ({
      key: i,
      hours: t ? String(t.min_hours_before) : "",
      refund: t ? String(t.refund_bps / 100) : "",
    })),
  );
  const addRow = () =>
    setRows((r) => [...r, { key: r.reduce((m, x) => Math.max(m, x.key), -1) + 1, hours: "", refund: "" }]);

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-forest-900">Refund tiers</legend>
      <p className="text-xs text-muted">
        A cancellation made at least the given number of hours before pickup refunds the given percentage. The tier with the highest
        matching hours applies; include a 0-hour tier for late cancellations.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:gap-3">
            <div className="space-y-1">
              <label htmlFor={`tier-hours-${row.key}`} className="block text-xs font-medium text-forest-900">
                Row {i + 1}: hours before trip
              </label>
              <Input
                name="tier_hours"
                id={`tier-hours-${row.key}`}
                type="number"
                min={0}
                max={8760}
                step={1}
                required
                defaultValue={row.hours}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`tier-refund-${row.key}`} className="block text-xs font-medium text-forest-900">
                Refund (%)
              </label>
              <Input
                name="tier_refund"
                id={`tier-refund-${row.key}`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                required
                defaultValue={row.refund}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={rows.length <= 1}
              onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
              aria-label={`Remove row ${i + 1}`}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" disabled={rows.length >= 20} onClick={addRow}>
        + Add tier
      </Button>
    </fieldset>
  );
}
