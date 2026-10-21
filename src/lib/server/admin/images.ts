import "server-only";
import { getUploadedFile, uploadImage } from "@/lib/server/admin/upload";

/**
 * Resolve the final image URL/alt for a record from an ImageField submission.
 * Returns { error } when upload/validation fails, otherwise the values to store.
 */
export async function resolveImage(
  formData: FormData,
  opts: {
    folder: "destinations" | "packages" | "blog";
    name?: string;
    altName?: string;
    currentUrl: string | null;
  },
): Promise<{ ok: true; url: string | null; alt: string | null } | { ok: false; field: string; error: string }> {
  const name = opts.name ?? "image";
  const altName = opts.altName ?? "image_alt";
  const altRaw = formData.get(altName);
  const alt = typeof altRaw === "string" && altRaw.trim() ? altRaw.trim().slice(0, 200) : null;
  const remove = formData.get(`${name}_remove`) === "on";

  const uploaded = await uploadImage(getUploadedFile(formData, name), opts.folder);
  if (uploaded && !uploaded.ok) return { ok: false, field: name, error: uploaded.error };

  const url = uploaded?.ok ? uploaded.url : remove ? null : opts.currentUrl;
  if (url && !alt) return { ok: false, field: altName, error: "Alt text is required when an image is set." };
  return { ok: true, url, alt: url ? alt : null };
}
