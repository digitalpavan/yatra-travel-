import { Checkbox, Field, Input } from "@/components/ui";

/**
 * Image upload + alt text inputs, used by destinations, packages and blog covers.
 * Server action side: getUploadedFile(formData, name) + uploadImage(...) from
 * src/lib/server/admin/upload.ts; `${name}_remove` = "on" clears the image.
 */
export function ImageField({
  name = "image",
  altName = "image_alt",
  label = "Image",
  currentUrl,
  currentAlt,
}: {
  name?: string;
  altName?: string;
  label?: string;
  currentUrl?: string | null;
  currentAlt?: string | null;
}) {
  return (
    <fieldset className="space-y-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-medium text-forest-900">{label}</legend>
      {currentUrl && (
        <div className="flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a user-uploaded image */}
          <img src={currentUrl} alt={currentAlt ?? ""} className="h-24 w-36 rounded-lg border border-line object-cover" />
          <Checkbox name={`${name}_remove`} label="Remove current image" />
        </div>
      )}
      <Field label={currentUrl ? "Replace image" : "Upload image"} name={name} hint="JPEG, PNG, WebP or AVIF, up to 4 MB.">
        <Input type="file" name={name} accept="image/jpeg,image/png,image/webp,image/avif" hint="JPEG, PNG, WebP or AVIF, up to 4 MB." />
      </Field>
      <Field label="Alt text (describe the image)" name={altName} hint="Required when an image is set. Describe what is shown for screen-reader users.">
        <Input name={altName} defaultValue={currentAlt ?? ""} maxLength={200} hint="Required when an image is set." />
      </Field>
    </fieldset>
  );
}
