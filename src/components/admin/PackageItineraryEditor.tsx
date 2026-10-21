"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui";

interface Row {
  key: number;
  title: string;
  details: string;
}

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-charcoal focus:border-forest-500 focus:outline-none focus:ring-2 focus:ring-forest-100";

/**
 * Repeatable itinerary day rows. Submits itinerary_title[] / itinerary_details[];
 * the server assigns day numbers in order and drops fully blank rows.
 */
export function PackageItineraryEditor({ initial }: { initial: { title: string; details: string }[] }) {
  const nextKey = useRef(Math.max(initial.length, 1));
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length ? initial.map((r, i) => ({ key: i, title: r.title, details: r.details })) : [{ key: 0, title: "", details: "" }],
  );

  const add = () => setRows((rs) => [...rs, { key: nextKey.current++, title: "", details: "" }]);
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const move = (index: number, delta: number) =>
    setRows((rs) => {
      const target = index + delta;
      if (target < 0 || target >= rs.length) return rs;
      const copy = [...rs];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const update = (key: number, field: "title" | "details", value: string) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium text-forest-900">Itinerary</legend>
      <p className="text-xs text-muted">Day numbers follow the order below. Rows left completely blank are ignored.</p>
      {rows.length === 0 && <p className="text-sm text-muted">No itinerary days.</p>}
      <ol className="space-y-4">
        {rows.map((row, i) => (
          <li key={row.key} className="rounded-lg border border-line/70 bg-ivory/40 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-forest-900">Day {i + 1}</span>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move day ${i + 1} up`}>
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(i, 1)}
                  disabled={i === rows.length - 1}
                  aria-label={`Move day ${i + 1} down`}
                >
                  ↓
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(row.key)} aria-label={`Remove day ${i + 1}`}>
                  Remove
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-forest-900">Title</span>
                <input
                  name="itinerary_title"
                  value={row.title}
                  maxLength={160}
                  onChange={(e) => update(row.key, "title", e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-forest-900">Details</span>
                <textarea
                  name="itinerary_details"
                  value={row.details}
                  maxLength={3000}
                  rows={3}
                  onChange={(e) => update(row.key, "details", e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
          </li>
        ))}
      </ol>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        + Add day
      </Button>
    </fieldset>
  );
}
