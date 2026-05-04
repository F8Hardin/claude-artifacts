"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  uploadArtifactFile,
  deleteArtifactFile,
  insertArtifact,
} from "@/lib/supabase/artifacts";

function titleToSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) +
    "-" +
    Date.now().toString(36)
  );
}

export async function uploadArtifact(
  formData: FormData
): Promise<{ error: string } | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() ?? "";
  const tagsRaw = (formData.get("tags") as string)?.trim() ?? "";
  const isPublic = formData.getAll("is_public").includes("true");
  const authorNameVisible = formData
    .getAll("author_name_visible")
    .includes("true");
  const agreedToTerms = formData.get("agree_terms") === "true";
  const file = formData.get("file") as File | null;

  if (!title) return { error: "Title is required." };
  if (!file || file.size === 0) return { error: "HTML file is required." };
  if (!file.name.endsWith(".html")) return { error: "Only .html files are allowed." };
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5 MB." };
  if (!agreedToTerms) return { error: "You must confirm you have rights to share this content." };

  const tags = tagsRaw
    ? tagsRaw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
    : [];

  const slug = titleToSlug(title);
  const storagePath = `${slug}.html`;

  const { error: uploadError } = await uploadArtifactFile(
    storagePath,
    await file.arrayBuffer()
  );
  if (uploadError) return { error: `Upload failed: ${uploadError}` };

  const { error: insertError } = await insertArtifact({
    slug,
    title,
    description,
    owner_id: user.id,
    storage_path: storagePath,
    tags,
    is_public: isPublic,
    author_name_visible: authorNameVisible,
  });

  if (insertError) {
    await deleteArtifactFile(storagePath);
    return { error: `Database error: ${insertError}` };
  }

  redirect(`/artifact/${slug}`);
}
