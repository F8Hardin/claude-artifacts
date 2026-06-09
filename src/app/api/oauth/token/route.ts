import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
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

  const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier } = body;

  if (grant_type !== "authorization_code") {
    return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS });
  }
  if (!code || !redirect_uri || !client_id) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: CORS });
  }

  if (!redirect_uri.startsWith("https://")) {
    return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri must use HTTPS" }, { status: 400, headers: CORS });
  }

  const supabase = await createClient();

  // Validate and consume the authorization code
  const { data: authCode } = await supabase
    .from("oauth_authorization_codes")
    .select("id, user_id, redirect_uri, expires_at, used, code_challenge")
    .eq("code", code)
    .eq("client_id", client_id)
    .maybeSingle();

  if (
    !authCode ||
    authCode.used ||
    new Date(authCode.expires_at) < new Date() ||
    authCode.redirect_uri !== redirect_uri
  ) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400, headers: CORS });
  }

  // Verify PKCE if a code_challenge was stored (public client flow)
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return NextResponse.json({ error: "invalid_grant", error_description: "code_verifier required" }, { status: 400, headers: CORS });
    }
    const verifierHash = createHash("sha256").update(code_verifier).digest("base64url");
    if (verifierHash !== authCode.code_challenge) {
      return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400, headers: CORS });
    }
  }

  // Mark code as used (prevent replay)
  await supabase
    .from("oauth_authorization_codes")
    .update({ used: true })
    .eq("code", code);

  // Issue a PAT as the access token
  const rawToken = "cap_" + randomBytes(32).toString("base64url");
  const hash = sha256hex(rawToken);
  const prefix = rawToken.slice(0, 12);

  const { error: patError } = await supabase
    .from("personal_access_tokens")
    .insert({
      user_id: authCode.user_id,
      name: "claude.ai connector",
      token_hash: hash,
      token_prefix: prefix,
    });

  if (patError) {
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: CORS });
  }

  supabase
    .from("oauth_authorization_codes")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .then(() => {});

  return NextResponse.json(
    { access_token: rawToken, token_type: "bearer", scope: "mcp" },
    { headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}
