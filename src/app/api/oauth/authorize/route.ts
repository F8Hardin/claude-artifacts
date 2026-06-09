import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const state = (formData.get("state") as string) ?? "";
  const codeChallenge = (formData.get("code_challenge") as string) ?? null;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Public clients: require HTTPS redirect_uri and PKCE
  if (!redirectUri.startsWith("https://")) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uri must use HTTPS" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from("oauth_authorization_codes")
    .insert({
      code,
      client_id: clientId,
      user_id: user.id,
      redirect_uri: redirectUri,
      expires_at: expiresAt,
      code_challenge: codeChallenge,
    });

  if (insertError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl.toString(), { status: 302 });
}
