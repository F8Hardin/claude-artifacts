import { createClient } from "./server";
import { Artifact } from "@/lib/artifacts";

// ─── Storage ─────────────────────────────────────────────────────────────────

export function getStorageUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artifacts/${storagePath}`;
}

export async function uploadArtifactFile(
  storagePath: string,
  fileBuffer: ArrayBuffer
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("artifacts")
    .upload(storagePath, fileBuffer, {
      contentType: "text/html",
      upsert: false,
    });
  return { error: error?.message ?? null };
}

export async function deleteArtifactFile(storagePath: string): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from("artifacts").remove([storagePath]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type ArtifactRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  owner_id: string;
  storage_path: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  github_username: string | null;
  avatar_url: string | null;
};

// Fetch profiles for a list of owner IDs and return a lookup map
async function fetchProfiles(ownerIds: string[]): Promise<Map<string, Profile>> {
  if (ownerIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, github_username, avatar_url")
    .in("id", ownerIds);
  return new Map((data ?? []).map((p: Profile) => [p.id, p]));
}

function toArtifact(row: ArtifactRow, profile: Profile | undefined): Artifact {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    owner_id: row.owner_id,
    storage_path: row.storage_path,
    tags: row.tags,
    is_public: row.is_public,
    created_at: row.created_at,
    author_username: profile?.github_username ?? null,
    author_avatar: profile?.avatar_url ?? null,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchAllArtifacts(): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data as ArtifactRow[];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

export async function fetchArtifact(slug: string): Promise<Artifact | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return null;
  const row = data as ArtifactRow;
  const profiles = await fetchProfiles([row.owner_id]);
  return toArtifact(row, profiles.get(row.owner_id));
}

export async function searchArtifactRows(query: string): Promise<Artifact[]> {
  const supabase = await createClient();
  const q = query.toLowerCase();

  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data as ArtifactRow[]).filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
  );

  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function insertArtifact(params: {
  slug: string;
  title: string;
  description: string;
  owner_id: string;
  storage_path: string;
  tags: string[];
  is_public: boolean;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("artifacts").insert(params);
  return { error: error?.message ?? null };
}
