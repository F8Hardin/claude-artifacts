import { createClient } from "./server";
import { Artifact } from "@/lib/artifacts";

// ─── Storage ─────────────────────────────────────────────────────────────────

export async function downloadArtifactFile(
  storagePath: string
): Promise<{ data: Blob | null; error: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("artifacts").download(storagePath);
  return { data, error: error?.message ?? null };
}

function contentTypeForPath(storagePath: string): string {
  if (storagePath.endsWith(".jsx") || storagePath.endsWith(".js")) {
    return "text/plain; charset=utf-8";
  }
  return "text/html; charset=utf-8";
}

export async function uploadArtifactFile(
  storagePath: string,
  fileBuffer: ArrayBuffer,
  { upsert = false }: { upsert?: boolean } = {}
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const contentType = contentTypeForPath(storagePath);
  const blob = new Blob([fileBuffer], { type: contentType });
  const { error } = await supabase.storage
    .from("artifacts")
    .upload(storagePath, blob, { contentType, upsert });
  return { error: error?.message ?? null };
}

export async function updateArtifactStoragePath(params: {
  slug: string;
  owner_id: string;
  storage_path: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("artifacts")
    .update({ storage_path: params.storage_path, updated_at: new Date().toISOString() })
    .eq("slug", params.slug)
    .eq("owner_id", params.owner_id);
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
  author_name_visible: boolean;
  created_at: string;
  like_count: number;
};

type Profile = {
  id: string;
  username: string | null;
  github_username: string | null;
  avatar_url: string | null;
};

// Fetch profiles for a list of owner IDs and return a lookup map
async function fetchProfiles(ownerIds: string[]): Promise<Map<string, Profile>> {
  if (ownerIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, github_username, avatar_url")
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
    author_name_visible: row.author_name_visible ?? true,
    created_at: row.created_at,
    author_username: profile?.username ?? profile?.github_username ?? null,
    author_avatar: profile?.avatar_url ?? null,
    like_count: row.like_count ?? 0,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchTopRated(limit: number): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data as ArtifactRow[];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

export async function fetchLatest(limit: number): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data as ArtifactRow[];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

export async function hasUserLiked(artifactId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("likes")
    .select("id")
    .eq("artifact_id", artifactId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

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

export async function fetchArtifactsByOwner(ownerId: string): Promise<Artifact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = data as ArtifactRow[];
  const profiles = await fetchProfiles([ownerId]);
  return rows.map((row) => toArtifact(row, profiles.get(row.owner_id)));
}

export async function searchArtifactRows(query: string): Promise<Artifact[]> {
  const supabase = await createClient();
  const q = `%${query}%`;

  // Fetch title/description matches and tag matches separately, both server-side
  const [titleRes, tagRes] = await Promise.all([
    supabase
      .from("artifacts")
      .select("*")
      .or(`title.ilike.${q},description.ilike.${q}`)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("artifacts")
      .select("*")
      .contains("tags", [query.toLowerCase()])
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (titleRes.error) throw titleRes.error;

  const titleRows = titleRes.data as ArtifactRow[];
  const titleIds = new Set(titleRows.map((r) => r.id));

  const tagRows = (tagRes.data as ArtifactRow[] ?? []).filter(
    (r) => !titleIds.has(r.id)
  );

  const rows = [...titleRows, ...tagRows];
  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

export async function fetchPublicArtifactsForSitemap(): Promise<
  { slug: string; updated_at: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artifacts")
    .select("slug, updated_at")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });
  return (data ?? []) as { slug: string; updated_at: string }[];
}

export async function fetchLikedArtifacts(userId: string): Promise<Artifact[]> {
  const supabase = await createClient();

  const { data: likes } = await supabase
    .from("likes")
    .select("artifact_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!likes || likes.length === 0) return [];

  const artifactIds = likes.map((l: { artifact_id: string }) => l.artifact_id);

  const { data, error } = await supabase
    .from("artifacts")
    .select("*")
    .in("id", artifactIds);

  if (error) throw error;
  const rows = data as ArtifactRow[];

  // Preserve liked-most-recently-first order
  const idOrder = new Map(artifactIds.map((id: string, i: number) => [id, i]));
  rows.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  const profiles = await fetchProfiles([...new Set(rows.map((r) => r.owner_id))]);
  return rows.map((r) => toArtifact(r, profiles.get(r.owner_id)));
}

export async function fetchProfileByUsername(
  username: string
): Promise<{ id: string; username: string | null; github_username: string | null; avatar_url: string | null } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, github_username, avatar_url")
    .or(`username.eq.${username},github_username.eq.${username}`)
    .maybeSingle();
  return data ?? null;
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
  author_name_visible: boolean;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("artifacts").insert(params);
  return { error: error?.message ?? null };
}

export async function updateArtifact(params: {
  slug: string;
  owner_id: string;
  title: string;
  description: string;
  tags: string[];
  is_public: boolean;
  author_name_visible: boolean;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("artifacts")
    .update({
      title: params.title,
      description: params.description,
      tags: params.tags,
      is_public: params.is_public,
      author_name_visible: params.author_name_visible,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", params.slug)
    .eq("owner_id", params.owner_id);

  return { error: error?.message ?? null };
}

export async function deleteArtifact(params: {
  slug: string;
  owner_id: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("artifacts")
    .delete()
    .eq("slug", params.slug)
    .eq("owner_id", params.owner_id);

  return { error: error?.message ?? null };
}
