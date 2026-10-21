/**
 * In-process Postgres (PGlite) harness for database tests.
 *
 * It stubs the small part of Supabase the migrations depend on (API roles,
 * auth.users/auth.uid(), storage tables, the `extensions` schema), then applies
 * the real migrations from supabase/migrations in order, plus the demo seed.
 *
 * For a full-fidelity run against the real Supabase stack, use
 * `npx supabase start && npx supabase test db` (requires Docker).
 */
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

export type Db = PGlite & {
  /** Run `fn` as an API role, optionally impersonating a user (sets auth.uid()). */
  as<T>(role: "anon" | "authenticated" | "service_role", userId: string | null, fn: () => Promise<T>): Promise<T>;
  createUser(email: string, meta?: Record<string, unknown>): Promise<string>;
  makeStaff(userId: string, role: "owner" | "admin" | "booking_staff" | "driver"): Promise<void>;
};

export async function createTestDb({ seed = true }: { seed?: boolean } = {}): Promise<Db> {
  const pg = (await PGlite.create({ extensions: { btree_gist, pgcrypto } })) as unknown as Db;
  await pg.exec(SUPABASE_STUB);

  const migrationsDir = join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await pg.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }
  if (seed) {
    await pg.exec(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf8"));
  }

  pg.as = async (role, userId, fn) => {
    await pg.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false); set role ${role};`);
    try {
      return await fn();
    } finally {
      await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
    }
  };

  pg.createUser = async (email, meta = {}) => {
    const { rows } = await pg.query<{ id: string }>(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify(meta)],
    );
    return rows[0].id;
  };

  pg.makeStaff = async (userId, role) => {
    await pg.query("insert into public.staff_members (user_id, role) values ($1, $2)", [userId, role]);
  };

  return pg;
}
