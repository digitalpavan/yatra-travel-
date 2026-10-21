import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const EXTENSIONS: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/** Detect the real image type from magic bytes (never trust the browser's MIME type alone). */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (bytes.length >= 12 && ascii(4, 8) === "ftyp") {
    // ISO-BMFF: major brand at 8..12, compatible brands follow until the box size.
    const boxSize = Math.min(bytes.length, (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]);
    for (let i = 8; i + 4 <= Math.max(12, boxSize); i += 4) {
      if (i === 12) continue; // minor version
      const brand = ascii(i, i + 4);
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  return null;
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string } | null;

/** Read a file input from FormData; null when no file was chosen. */
export function getUploadedFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  if (!value || typeof value === "string") return null;
  if (value.size === 0 && !value.name) return null;
  if (value.size === 0) return null;
  return value;
}

/**
 * Validate and upload an image to the public "media" bucket using the
 * signed-in user's client (storage RLS allows catalog/content managers).
 * Returns null when no file was provided.
 */
export async function uploadImage(file: File | null, folder: "destinations" | "packages" | "blog"): Promise<UploadResult> {
  if (!file) return null;
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Image must be a JPEG, PNG, WebP or AVIF file." };
  }
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image must be 5 MB or smaller." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes.subarray(0, 64));
  if (!sniffed) return { ok: false, error: "The file does not look like a valid JPEG, PNG, WebP or AVIF image." };
  if (sniffed !== file.type) return { ok: false, error: "The file's contents do not match its image type." };

  const path = `${folder}/${randomUUID()}.${EXTENSIONS[sniffed]}`;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage.from("media").upload(path, bytes, {
    contentType: sniffed,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) {
    console.error("[admin:upload]", error.message);
    return { ok: false, error: "The image could not be uploaded. Please try again." };
  }
  const { data } = supabase.storage.from("media").getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
