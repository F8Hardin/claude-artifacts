"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function createDefaultUsername(): string {
  return `user-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUsername(value: string | null): string {
  const username = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);

  if (username.length >= 3) return username;
  return createDefaultUsername();
}

export async function signInWithEmail(
  formData: FormData
): Promise<{ error: string } | void> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/");
}

export async function signUpWithEmail(
  formData: FormData
): Promise<{ error: string; success?: never } | { success: string; error?: never }> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm_password") as string;
  const username = normalizeUsername(formData.get("username") as string | null);

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002"}/auth/callback`,
      data: {
        username,
      },
    },
  });

  if (error) return { error: error.message };

  return { success: "Check your email for a confirmation link." };
}
