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

export async function deleteArtifactFile(
  storagePath: string
): Promise<void> {
  const supabase = await createClient();
  await supabase.storage.from("artifacts").remove([storagePath]);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

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
  profiles: { github_username: string | null; avatar_url: string | null } | null;
};

function toArtifact(row: ArtifactRow): Artifact {
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
    author_username: row.profiles?.github_username ?? null,
    author_avatar: row.profiles?.avatar_url ?? null,
  };
}

export async function fetchAllArtifacts(): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*, profiles(github_username, avatar_url)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ArtifactRow[]).map(toArtifact);
}

export async function fetchArtifact(slug: string): Promise<Artifact | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*, profiles(github_username, avatar_url)")
    .eq("slug", slug)
    .single();

  if (error) return null;
  return toArtifact(data as ArtifactRow);
}

export async function searchArtifactRows(query: string): Promise<Artifact[]> {
  const supabase = await createClient();
  const q = query.toLowerCase();

  const { data, error } = await supabase
    .from("artifacts")
    .select("*, profiles(github_username, avatar_url)")
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = data as ArtifactRow[];
  return rows
    .filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        (r.profiles?.github_username?.toLowerCase().includes(q) ?? false)
    )
    .map(toArtifact);
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
