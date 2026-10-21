import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { Panel } from "@/components/admin/AdminUI";
import { PackageItineraryEditor } from "@/components/admin/PackageItineraryEditor";
import { Badge, Checkbox, EmptyState, Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATION_CATEGORY_LABELS, PACKAGE_CATEGORY_LABELS, type Destination, type ItineraryDay, type PackageSummary } from "@/lib/types";
import { savePackage } from "../actions";

export interface PackageFormRow {
  id: string;
  slug: string;
  title: string;
  category: PackageSummary["category"];
  summary: string;
  description: string;
  duration_days: number;
  duration_nights: number;
  min_passengers: number;
  max_passengers: number;
  inclusions: string[];
  exclusions: string[];
  highlights: string[];
  itinerary: ItineraryDay[] | null;
  default_start_time: string;
  image_url: string | null;
  image_alt: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  package_prices: { vehicle_class: string; price_paise: number }[];
  package_destinations: { destination_id: string; position: number }[];
}

export const PACKAGE_FORM_COLUMNS =
  "id, slug, title, category, summary, description, duration_days, duration_nights, min_passengers, max_passengers, inclusions, exclusions, highlights, itinerary, default_start_time, image_url, image_alt, is_published, is_featured, sort_order, seo_title, seo_description, package_prices(vehicle_class, price_paise), package_destinations(destination_id, position)";

export interface RateOption {
  vehicle_class: string;
  label: string;
  seats: number;
  is_active: boolean;
}

export interface DestinationOption {
  id: string;
  name: string;
  category: Destination["category"];
  is_published: boolean;
}

const LABELS: Record<string, string> = {
  slug: "Slug",
  title: "Title",
  category: "Category",
  summary: "Summary",
  description: "Description",
  duration_days: "Days",
  duration_nights: "Nights",
  min_passengers: "Minimum passengers",
  max_passengers: "Maximum passengers",
  inclusions: "Inclusions",
  exclusions: "Exclusions",
  highlights: "Highlights",
  itinerary: "Itinerary",
  default_start_time: "Default start time",
  image: "Image",
  image_alt: "Image alt text",
  sort_order: "Sort order",
  seo_title: "SEO title",
  seo_description: "SEO description",
  dest: "Destinations",
};

export function PackageForm({
  pkg,
  rates,
  destinations,
}: {
  pkg: PackageFormRow | null;
  rates: RateOption[];
  destinations: DestinationOption[];
}) {
  const priceOf = new Map((pkg?.package_prices ?? []).map((p) => [p.vehicle_class, p.price_paise]));
  const posOf = new Map((pkg?.package_destinations ?? []).map((d) => [d.destination_id, d.position]));
  const labels: Record<string, string> = { ...LABELS };
  for (const r of rates) labels[`price_${r.vehicle_class}`] = `Price (${r.label})`;
  for (const d of destinations) labels[`dest_pos_${d.id}`] = `Position (${d.name})`;
  const itinerary = Array.isArray(pkg?.itinerary) ? pkg.itinerary : [];

  return (
    <ActionForm action={savePackage} encType="multipart/form-data" labels={labels} className="space-y-6">
      {pkg && <input type="hidden" name="id" value={pkg.id} />}

      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" name="title" required>
            <Input name="title" defaultValue={pkg?.title ?? ""} required minLength={3} maxLength={140} />
          </Field>
          <Field label="Slug (URL)" name="slug" required hint="Lowercase letters, numbers and hyphens, e.g. tirumala-darshan-1-day">
            <Input
              name="slug"
              defaultValue={pkg?.slug ?? ""}
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              hint="Lowercase letters, numbers and hyphens, e.g. tirumala-darshan-1-day"
            />
          </Field>
          <Field label="Category" name="category" required>
            <Select name="category" defaultValue={pkg?.category ?? "tirumala"} required>
              {Object.entries(PACKAGE_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default start time" name="default_start_time" required>
            <Input type="time" name="default_start_time" defaultValue={(pkg?.default_start_time ?? "05:00").slice(0, 5)} required />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Summary" name="summary" required hint="Up to 300 characters, shown on package cards.">
              <Textarea name="summary" defaultValue={pkg?.summary ?? ""} required maxLength={300} rows={3} hint="Up to 300 characters, shown on package cards." />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" name="description">
              <Textarea name="description" defaultValue={pkg?.description ?? ""} rows={8} maxLength={20000} />
            </Field>
          </div>
          <Field label="Duration (days)" name="duration_days" required>
            <Input type="number" name="duration_days" min={1} max={30} defaultValue={pkg?.duration_days ?? 1} required />
          </Field>
          <Field label="Duration (nights)" name="duration_nights" required>
            <Input type="number" name="duration_nights" min={0} max={30} defaultValue={pkg?.duration_nights ?? 0} required />
          </Field>
          <Field label="Minimum passengers" name="min_passengers" required>
            <Input type="number" name="min_passengers" min={1} max={60} defaultValue={pkg?.min_passengers ?? 1} required />
          </Field>
          <Field label="Maximum passengers" name="max_passengers" required>
            <Input type="number" name="max_passengers" min={1} max={60} defaultValue={pkg?.max_passengers ?? 7} required />
          </Field>
        </div>
      </Panel>

      <Panel title="Details" description="One item per line.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Highlights" name="highlights">
            <Textarea name="highlights" rows={6} defaultValue={(pkg?.highlights ?? []).join("\n")} />
          </Field>
          <Field label="Inclusions" name="inclusions">
            <Textarea name="inclusions" rows={6} defaultValue={(pkg?.inclusions ?? []).join("\n")} />
          </Field>
          <Field label="Exclusions" name="exclusions">
            <Textarea name="exclusions" rows={6} defaultValue={(pkg?.exclusions ?? []).join("\n")} />
          </Field>
        </div>
        <div className="mt-4">
          <PackageItineraryEditor initial={itinerary.map((d) => ({ title: d.title ?? "", details: d.details ?? "" }))} />
        </div>
      </Panel>

      <Panel title="Prices per vehicle" description="Total price in rupees for the whole vehicle. Leave blank if the vehicle is not offered for this package.">
        {rates.length === 0 ? (
          <EmptyState title="No vehicle classes">Add vehicle rates in Fleet first.</EmptyState>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rates.map((r) => {
              const paise = priceOf.get(r.vehicle_class);
              const name = `price_${r.vehicle_class}`;
              return (
                <Field key={r.vehicle_class} label={`${r.label} (${r.seats} seats)${r.is_active ? "" : " — inactive"}`} name={name}>
                  <Input name={name} inputMode="decimal" placeholder="Not offered" defaultValue={paise ? (paise / 100).toString() : ""} />
                </Field>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Destinations" description="Tick the places this package visits. Lower position numbers are shown first.">
        {destinations.length === 0 ? (
          <EmptyState title="No destinations yet">Create destinations first.</EmptyState>
        ) : (
          <ul className="divide-y divide-line/70">
            {destinations.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    name="dest"
                    id={`dest_${d.id}`}
                    value={d.id}
                    defaultChecked={posOf.has(d.id)}
                    label={
                      <>
                        {d.name} <span className="text-xs text-muted">· {DESTINATION_CATEGORY_LABELS[d.category]}</span>
                      </>
                    }
                  />
                  {!d.is_published && <Badge tone="gray">Draft</Badge>}
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Position
                  <input
                    type="number"
                    name={`dest_pos_${d.id}`}
                    min={0}
                    max={999}
                    defaultValue={posOf.get(d.id) ?? ""}
                    className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm text-charcoal"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Image">
        <ImageField currentUrl={pkg?.image_url} currentAlt={pkg?.image_alt} label="Package image" />
      </Panel>

      <Panel title="Publishing & SEO">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Checkbox name="is_published" label="Published (visible on the website)" defaultChecked={pkg?.is_published ?? false} />
            <Checkbox name="is_featured" label="Featured on the home page" defaultChecked={pkg?.is_featured ?? false} />
          </div>
          <Field label="Sort order" name="sort_order" hint="Lower numbers appear first.">
            <Input type="number" name="sort_order" defaultValue={pkg?.sort_order ?? 0} hint="Lower numbers appear first." />
          </Field>
          <Field label="SEO title" name="seo_title" hint="Up to 70 characters.">
            <Input name="seo_title" defaultValue={pkg?.seo_title ?? ""} maxLength={70} />
          </Field>
          <Field label="SEO description" name="seo_description" hint="Up to 170 characters.">
            <Textarea name="seo_description" defaultValue={pkg?.seo_description ?? ""} maxLength={170} rows={3} />
          </Field>
        </div>
      </Panel>

      <div className="flex justify-end">
        <AdminSubmit>{pkg ? "Save package" : "Create package"}</AdminSubmit>
      </div>
    </ActionForm>
  );
}
