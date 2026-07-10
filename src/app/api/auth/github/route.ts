import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/safe-redirect";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const origin = new URL(request.url).origin;

  const formData = await request.formData();
  // Only allow internal redirects (rejects "//host", "/\\host", etc.)
  const safeNext = sanitizeNextPath(formData.get("next") as string | null);

  const callbackUrl = `${origin}/auth/callback${safeNext !== "/" ? `?next=${encodeURIComponent(safeNext)}` : ""}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callbackUrl },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
