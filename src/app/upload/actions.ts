"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  uploadArtifactFile,
  deleteArtifactFile,
  insertArtifact,
  fetchArtifactsByOwner,
} from "@/lib/supabase/artifacts";
import { lintArtifactSource } from "@/lib/artifact-lint";
import { moderateArtifact } from "@/lib/moderation";

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

  const allowedExtensions = [".html", ".jsx", ".js", ".tsx", ".ts", ".svg", ".md", ".markdown", ".mmd"];
  const fileExt = allowedExtensions.find((ext) => file?.name.endsWith(ext));

  const allowedMimes = [
    "text/html",
    "text/javascript",
    "application/javascript",
    "text/plain",
    "text/jsx",
    "image/svg+xml",
    "text/markdown",
    "text/x-typescript",
    "application/typescript",
    "text/mermaid",
    "",  // some browsers omit MIME for unknown types
  ];

  if (!title) return { error: "Title is required." };
  if (title.length > 100) return { error: "Title must be 100 characters or fewer." };
  if (!file || file.size === 0) return { error: "Artifact file is required." };
  // Validate by extension only. Browser-supplied MIME types are unreliable
  // (iOS assigns .jsx files application/octet-stream), so MIME checks cause
  // false rejections without adding real security.
  if (!fileExt) return { error: "Only .html, .jsx, .js, .tsx, .ts, .svg, .md, .markdown, or .mmd files are allowed." };
  if (file.type && !allowedMimes.includes(file.type.split(";")[0].trim())) {
    return { error: "Invalid file type." };
  }
  if (file.size > 5 * 1024 * 1024) return { error: "File must be under 5 MB." };
  if (!agreedToTerms) return { error: "You must confirm you have rights to share this content." };

  const existingArtifacts = await fetchArtifactsByOwner(user.id);
  if (existingArtifacts.length >= 100) {
    return { error: "Upload limit reached (100 artifacts maximum). Delete some artifacts to upload more." };
  }

  // Throttle uploads per user (shared budget with the MCP write tools). Fails
  // open on limiter errors so a transient DB issue can't block legitimate use.
  const admin = createAdminClient();
  const { data: allowed, error: rlError } = await admin.rpc("rate_limit_hit", {
    p_key: `mcp:write:${user.id}`,
    p_max: 40,
    p_window_seconds: 3600,
  });
  if (!rlError && allowed === false) {
    return { error: "You're uploading too fast. Please wait a bit and try again." };
  }

  const tags = tagsRaw
    ? tagsRaw
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 10)
        .map((t) => t.slice(0, 30))
    : [];

  const slug = titleToSlug(title);
  const storagePath = `${user.id}/${slug}${fileExt}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await uploadArtifactFile(storagePath, fileBuffer);
  if (uploadError) return { error: `Upload failed: ${uploadError}` };

  const source = new TextDecoder().decode(fileBuffer);
  const lintWarnings = lintArtifactSource(source, fileExt);

  // Screen before publishing. The DB trigger enforces the invariant, but we
  // also compute is_public here so the intent is explicit: public only when
  // the uploader asked for it AND the classifier approved.
  const moderation = await moderateArtifact({ title, description, content: source });

  const { error: insertError } = await insertArtifact({
    slug,
    title,
    description,
    owner_id: user.id,
    storage_path: storagePath,
    tags,
    is_public: isPublic && moderation.status === "approved",
    author_name_visible: authorNameVisible,
    moderation_status: moderation.status,
  });

  if (insertError) {
    await deleteArtifactFile(storagePath);
    return { error: `Database error: ${insertError}` };
  }

  const params = new URLSearchParams();
  if (lintWarnings.length > 0) params.set("warn", lintWarnings.join(","));
  if (moderation.status !== "approved") params.set("review", moderation.status);
  const qs = params.toString();
  redirect(`/artifact/${slug}${qs ? `?${qs}` : ""}`);
}
