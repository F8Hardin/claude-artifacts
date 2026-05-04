"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Artifact } from "@/lib/artifacts";
import { createClient } from "@/lib/supabase/server";
import {
  deleteArtifact,
  deleteArtifactFile,
  fetchArtifact,
  updateArtifact,
  uploadArtifactFile,
  updateArtifactStoragePath,
} from "@/lib/supabase/artifacts";

function parseTags(tagsRaw: string): string[] {
  return [
    ...new Set(
      tagsRaw
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

type OwnershipResult =
  | { artifact: Artifact; user: { id: string } }
  | { error: string };

async function requireArtifactOwner(slug: string): Promise<OwnershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated." };

  const artifact = await fetchArtifact(slug);
  if (!artifact) return { error: "Artifact not found." };
  if (artifact.owner_id !== user.id) return { error: "Not authorized." };

  return { artifact, user };
}

export async function updateArtifactDetails(
  slug: string,
  formData: FormData
): Promise<{ error: string } | void> {
  const ownership = await requireArtifactOwner(slug);
  if ("error" in ownership) return { error: ownership.error };

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() ?? "";
  const tagsRaw = (formData.get("tags") as string)?.trim() ?? "";
  const isPublic = formData.getAll("is_public").includes("true");
  const authorNameVisible = formData
    .getAll("author_name_visible")
    .includes("true");

  if (!title) return { error: "Title is required." };

  const { error } = await updateArtifact({
    slug,
    title,
    description,
    tags: parseTags(tagsRaw),
    is_public: isPublic,
    author_name_visible: authorNameVisible,
    owner_id: ownership.user.id,
  });

  if (error) return { error: `Update failed: ${error}` };

  revalidatePath("/");
  revalidatePath(`/artifact/${slug}`);
  revalidatePath(`/artifact/${slug}/edit`);
  redirect(`/artifact/${slug}`);
}

export async function replaceArtifactFile(
  slug: string,
  formData: FormData
): Promise<{ error: string } | void> {
  const ownership = await requireArtifactOwner(slug);
  if ("error" in ownership) return { error: ownership.error };

  const { artifact, user } = ownership;
  const file = formData.get("file") as File | null;

  const allowedExtensions = [".html", ".jsx", ".js"];
  const fileExt = allowedExtensions.find((ext) => file?.name.endsWith(ext));

  if (!file || file.size === 0) return { error: "File is required." };
  if (!fileExt) return { error: "Only .html, .jsx, or .js files are allowed." };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5 MB." };

  const newStoragePath = `${slug}${fileExt}`;
  const pathChanged = artifact.storage_path !== newStoragePath;

  // Upload with upsert if same path, normal upload if new path
  const { error: uploadError } = await uploadArtifactFile(
    newStoragePath,
    await file.arrayBuffer(),
    { upsert: !pathChanged }
  );
  if (uploadError) return { error: `Upload failed: ${uploadError}` };

  if (pathChanged) {
    await deleteArtifactFile(artifact.storage_path);
    const { error: dbError } = await updateArtifactStoragePath({
      slug,
      owner_id: user.id,
      storage_path: newStoragePath,
    });
    if (dbError) return { error: `Database update failed: ${dbError}` };
  }

  revalidatePath(`/artifact/${slug}`);
  redirect(`/artifact/${slug}`);
}

export async function deleteArtifactDetails(
  slug: string
): Promise<{ error: string } | void> {
  const ownership = await requireArtifactOwner(slug);
  if ("error" in ownership) return { error: ownership.error };

  const { artifact, user } = ownership;
  const { error } = await deleteArtifact({ slug, owner_id: user.id });

  if (error) return { error: `Delete failed: ${error}` };

  await deleteArtifactFile(artifact.storage_path);
  revalidatePath("/");
  revalidatePath(`/artifact/${slug}`);
  redirect("/");
}
