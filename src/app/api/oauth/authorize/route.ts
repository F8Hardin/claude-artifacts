import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const state = formData.get("state") as string ?? "";

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // Validate client + redirect_uri
  const { data: client } = await supabase
    .from("oauth_clients")
    .select("id, redirect_uri_prefix")
    .eq("id", clientId)
    .maybeSingle();

  if (!client || !redirectUri.startsWith(client.redirect_uri_prefix)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 400 });
  }

  // Generate authorization code
  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  const { error: insertError } = await supabase
    .from("oauth_authorization_codes")
    .insert({
      code,
      client_id: clientId,
      user_id: user.id,
      redirect_uri: redirectUri,
      expires_at: expiresAt,
    });

  if (insertError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl.toString(), { status: 302 });
}
