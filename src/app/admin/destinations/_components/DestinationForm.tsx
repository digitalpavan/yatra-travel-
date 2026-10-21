import { ActionForm, AdminSubmit } from "@/components/admin/ActionForm";
import { ImageField } from "@/components/admin/ImageField";
import { Panel } from "@/components/admin/AdminUI";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui";
import { DESTINATION_CATEGORY_LABELS, type Destination } from "@/lib/types";
import { saveDestination } from "../actions";

export interface DestinationFormRow {
  id: string;
  slug: string;
  name: string;
  category: Destination["category"];
  region: string;
  short_description: string;
  description: string;
  image_url: string | null;
  image_alt: string | null;
  latitude: number | null;
  longitude: number | null;
  distance_from_tirupati_km: number | null;
  best_time_to_visit: string | null;
  visitor_note: string | null;
  is_published: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
}

export const DESTINATION_FORM_COLUMNS =
  "id, slug, name, category, region, short_description, description, image_url, image_alt, latitude, longitude, distance_from_tirupati_km, best_time_to_visit, visitor_note, is_published, sort_order, seo_title, seo_description";

const LABELS: Record<string, string> = {
  slug: "Slug",
  name: "Name",
  category: "Category",
  region: "Region",
  short_description: "Short description",
  description: "Description",
  image: "Image",
  image_alt: "Image alt text",
  latitude: "Latitude",
  longitude: "Longitude",
  distance_from_tirupati_km: "Distance from Tirupati",
  best_time_to_visit: "Best time to visit",
  visitor_note: "Visitor note",
  sort_order: "Sort order",
  seo_title: "SEO title",
  seo_description: "SEO description",
};

const num = (v: number | null | undefined) => (v == null ? "" : String(v));

export function DestinationForm({ dest }: { dest: DestinationFormRow | null }) {
  return (
    <ActionForm action={saveDestination} encType="multipart/form-data" labels={LABELS} className="space-y-6">
      {dest && <input type="hidden" name="id" value={dest.id} />}
      <Panel title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" name="name" required>
            <Input name="name" defaultValue={dest?.name ?? ""} required minLength={2} maxLength={120} />
          </Field>
          <Field label="Slug (URL)" name="slug" required hint="Lowercase letters, numbers and hyphens, e.g. sri-kalahasti">
            <Input
              name="slug"
              defaultValue={dest?.slug ?? ""}
              required
              maxLength={120}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              hint="Lowercase letters, numbers and hyphens, e.g. sri-kalahasti"
            />
          </Field>
          <Field label="Category" name="category" required>
            <Select name="category" defaultValue={dest?.category ?? "temple"} required>
              {Object.entries(DESTINATION_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Region" name="region" required>
            <Input name="region" defaultValue={dest?.region ?? "Tirupati"} required maxLength={120} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Short description" name="short_description" required hint="Up to 300 characters, shown on cards.">
              <Textarea
                name="short_description"
                defaultValue={dest?.short_description ?? ""}
                required
                maxLength={300}
                rows={3}
                hint="Up to 300 characters, shown on cards."
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Description" name="description">
              <Textarea name="description" defaultValue={dest?.description ?? ""} rows={8} maxLength={20000} />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Visitor information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" name="latitude" hint="-90 to 90, e.g. 13.6833">
            <Input type="number" name="latitude" step="0.000001" min={-90} max={90} defaultValue={num(dest?.latitude)} />
          </Field>
          <Field label="Longitude" name="longitude" hint="-180 to 180, e.g. 79.3474">
            <Input type="number" name="longitude" step="0.000001" min={-180} max={180} defaultValue={num(dest?.longitude)} />
          </Field>
          <Field label="Distance from Tirupati (km)" name="distance_from_tirupati_km">
            <Input type="number" name="distance_from_tirupati_km" min={0} max={5000} defaultValue={num(dest?.distance_from_tirupati_km)} />
          </Field>
          <Field label="Best time to visit" name="best_time_to_visit">
            <Input name="best_time_to_visit" defaultValue={dest?.best_time_to_visit ?? ""} maxLength={200} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Visitor note" name="visitor_note" hint="e.g. Timings vary; confirm with the temple administration.">
              <Textarea name="visitor_note" defaultValue={dest?.visitor_note ?? ""} maxLength={500} rows={2} />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="Image">
        <ImageField currentUrl={dest?.image_url} currentAlt={dest?.image_alt} label="Destination image" />
      </Panel>

      <Panel title="Publishing & SEO">
        <div className="grid gap-4 sm:grid-cols-2">
          <Checkbox name="is_published" label="Published (visible on the website)" defaultChecked={dest?.is_published ?? false} />
          <Field label="Sort order" name="sort_order" hint="Lower numbers appear first.">
            <Input type="number" name="sort_order" defaultValue={dest?.sort_order ?? 0} hint="Lower numbers appear first." />
          </Field>
          <Field label="SEO title" name="seo_title" hint="Up to 70 characters.">
            <Input name="seo_title" defaultValue={dest?.seo_title ?? ""} maxLength={70} />
          </Field>
          <Field label="SEO description" name="seo_description" hint="Up to 170 characters.">
            <Textarea name="seo_description" defaultValue={dest?.seo_description ?? ""} maxLength={170} rows={3} />
          </Field>
        </div>
      </Panel>

      <div className="flex justify-end">
        <AdminSubmit>{dest ? "Save destination" : "Create destination"}</AdminSubmit>
      </div>
    </ActionForm>
  );
}
