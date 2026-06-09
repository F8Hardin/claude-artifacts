import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const origin = new URL(request.url).origin;

  const formData = await request.formData();
  const rawNext = formData.get("next") as string | null;
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "";

  const callbackUrl = new URL("/auth/callback", origin);
  if (next) callbackUrl.searchParams.set("next", next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  }

  return NextResponse.redirect(data.url, { status: 302 });
}
