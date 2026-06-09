import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function tokenResponse(accessToken: string) {
  return NextResponse.json({
    access_token: accessToken,
    token_type: "bearer",
    scope: "artifacts",
  });
}

export async function POST(request: NextRequest) {
  // Accept both application/json and application/x-www-form-urlencoded
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, string>;
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    const fd = await request.formData();
    body = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, String(v)])
    );
  }

  const { grant_type, code, redirect_uri, client_id, client_secret } = body;

  if (grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
  }
  if (!code || !redirect_uri || !client_id || !client_secret) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();

  // Validate client credentials
  const { data: client } = await supabase
    .from("oauth_clients")
    .select("id, secret_hash, redirect_uri_prefix")
    .eq("id", client_id)
    .maybeSingle();

  if (!client || client.secret_hash !== sha256hex(client_secret)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  if (!redirect_uri.startsWith(client.redirect_uri_prefix)) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  // Validate and consume the authorization code
  const { data: authCode } = await supabase
    .from("oauth_authorization_codes")
    .select("id, user_id, redirect_uri, expires_at, used")
    .eq("code", code)
    .eq("client_id", client_id)
    .maybeSingle();

  if (
    !authCode ||
    authCode.used ||
    new Date(authCode.expires_at) < new Date() ||
    authCode.redirect_uri !== redirect_uri
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  // Mark code as used immediately (prevent replay)
  await supabase
    .from("oauth_authorization_codes")
    .update({ used: true })
    .eq("code", code);

  // Issue a PAT for the user
  const rawToken = "cap_" + randomBytes(32).toString("base64url");
  const hash = sha256hex(rawToken);
  const prefix = rawToken.slice(0, 12);

  const { error: patError } = await supabase
    .from("personal_access_tokens")
    .insert({
      user_id: authCode.user_id,
      name: "claude.ai (connected via OAuth)",
      token_hash: hash,
      token_prefix: prefix,
    });

  if (patError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Clean up expired codes (opportunistic)
  supabase
    .from("oauth_authorization_codes")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .then(() => {});

  return tokenResponse(rawToken);
}
