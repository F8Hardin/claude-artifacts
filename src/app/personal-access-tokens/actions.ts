"use server";

import { createHash, randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type TokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
};

export async function listTokens(): Promise<TokenRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("personal_access_tokens")
    .select("id, name, token_prefix, created_at, last_used_at, expires_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TokenRow[];
}

export async function createToken(
  name: string,
  expiresAt: string | null
): Promise<{ rawToken: string; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rawToken: "", error: "Not authenticated" };

  const raw = "cap_" + randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);

  const { error } = await supabase.from("personal_access_tokens").insert({
    user_id: user.id,
    name: name.trim(),
    token_hash: hash,
    token_prefix: prefix,
    expires_at: expiresAt ?? null,
  });

  if (error) return { rawToken: "", error: error.message };
  revalidatePath("/personal-access-tokens");
  return { rawToken: raw, error: null };
}

export async function revokeToken(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("personal_access_tokens")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/personal-access-tokens");
  return { error: null };
}

export async function revokeAllTokens(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("personal_access_tokens")
    .delete()
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/personal-access-tokens");
  return { error: null };
}
