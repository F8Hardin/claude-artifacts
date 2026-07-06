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
  setArtifactModerationStatus,
} from "@/lib/supabase/artifacts";
import { lintArtifactSource } from "@/lib/artifact-lint";
import { moderateArtifact } from "@/lib/moderation";

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

  // Re-screen the edited title/description. Only carry a definitive result
  // (approved/rejected) into the update — if the classifier is unavailable
  // ("pending"), leave moderation_status untouched so a metadata tweak doesn't
  // force an already-approved artifact private.
  const moderation = await moderateArtifact({ title, description });

  const { error } = await updateArtifact({
    slug,
    title,
    description,
    tags: parseTags(tagsRaw),
    is_public: isPublic,
    author_name_visible: authorNameVisible,
    owner_id: ownership.user.id,
    moderation_status:
      moderation.status === "pending" ? undefined : moderation.status,
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

  const allowedExtensions = [".html", ".jsx", ".js", ".tsx", ".ts", ".svg", ".md", ".markdown", ".mmd"];
  const fileExt = allowedExtensions.find((ext) => file?.name.endsWith(ext));

  if (!file || file.size === 0) return { error: "File is required." };
  if (!fileExt) return { error: "Only .html, .jsx, .js, .tsx, .ts, .svg, .md, .markdown, or .mmd files are allowed." };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5 MB." };

  const newStoragePath = `${user.id}/${slug}${fileExt}`;
  const pathChanged = artifact.storage_path !== newStoragePath;
  const fileBuffer = await file.arrayBuffer();

  // Delete old file first, then upload new (avoids needing storage UPDATE policy)
  await deleteArtifactFile(artifact.storage_path);

  const { error: uploadError } = await uploadArtifactFile(newStoragePath, fileBuffer);
  if (uploadError) return { error: `Upload failed: ${uploadError}` };

  const source = new TextDecoder().decode(fileBuffer);
  const lintWarnings = lintArtifactSource(source, fileExt);

  if (pathChanged) {
    const { error: dbError } = await updateArtifactStoragePath({
      slug,
      owner_id: user.id,
      storage_path: newStoragePath,
    });
    if (dbError) return { error: `Database update failed: ${dbError}` };
  }

  // Content changed, so it must be re-cleared. Unlike a metadata edit, a
  // "pending" result here (classifier unavailable) is written through: new,
  // unscreened content stays private until it can be cleared.
  const moderation = await moderateArtifact({
    title: artifact.title,
    description: artifact.description,
    content: source,
  });
  const { error: modError } = await setArtifactModerationStatus({
    slug,
    owner_id: user.id,
    moderation_status: moderation.status,
  });
  if (modError) return { error: `Database update failed: ${modError}` };

  revalidatePath(`/artifact/${slug}`);
  const params = new URLSearchParams();
  if (lintWarnings.length > 0) params.set("warn", lintWarnings.join(","));
  if (moderation.status !== "approved") params.set("review", moderation.status);
  const qs = params.toString();
  redirect(`/artifact/${slug}${qs ? `?${qs}` : ""}`);
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
