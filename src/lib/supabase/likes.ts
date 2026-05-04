"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "./server";

export async function toggleLike(artifactId: string, artifactSlug: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("likes")
    .select("id")
    .eq("artifact_id", artifactId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("likes").delete().eq("id", existing.id);
  } else {
    await supabase.from("likes").insert({ artifact_id: artifactId, user_id: user.id });
  }

  revalidatePath("/");
  revalidatePath(`/artifact/${artifactSlug}`);
  revalidatePath("/top-rated");
}
