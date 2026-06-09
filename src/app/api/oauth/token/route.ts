import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function sha256hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// Public PKCE clients (e.g. claude.ai) may send client_id in the body or via
// HTTP Basic auth, or omit it entirely. Pull it from wherever it is.
function clientIdFromBasicAuth(header: string | null): string | undefined {
  if (!header?.startsWith("Basic ")) return undefined;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [id] = decoded.split(":");
    return id || undefined;
  } catch {
    return undefined;
  }
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
    body = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  }

  const { grant_type, code, redirect_uri, code_verifier } = body;
  const client_id =
    body.client_id || clientIdFromBasicAuth(request.headers.get("authorization"));

  const fail = (status: number, error: string, description?: string) => {
    console.error("[oauth/token] reject", {
      error,
      description,
      grant_type,
      has_code: !!code,
      has_verifier: !!code_verifier,
      client_id,
    });
    return NextResponse.json(
      description ? { error, error_description: description } : { error },
      { status, headers: CORS }
    );
  };

  if (grant_type !== "authorization_code") {
    return fail(400, "unsupported_grant_type");
  }
  if (!code) {
    return fail(400, "invalid_request", "code is required");
  }

  const supabase = createAdminClient();

  // Look up the authorization code by the code itself. client_id is not used as
  // a filter because public clients are inconsistent about sending it.
  const { data: authCode, error: lookupError } = await supabase
    .from("oauth_authorization_codes")
    .select("id, user_id, client_id, redirect_uri, expires_at, used, code_challenge")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    return fail(500, "server_error", "code lookup failed");
  }
  if (!authCode || authCode.used || new Date(authCode.expires_at) < new Date()) {
    return fail(400, "invalid_grant", "code is invalid, used, or expired");
  }
  // If a redirect_uri was supplied, it must match the one used at authorization.
  if (redirect_uri && authCode.redirect_uri !== redirect_uri) {
    return fail(400, "invalid_grant", "redirect_uri mismatch");
  }

  // PKCE: every authorization in this server is created with a code_challenge,
  // so a matching code_verifier is mandatory.
  if (authCode.code_challenge) {
    if (!code_verifier) {
      return fail(400, "invalid_grant", "code_verifier required");
    }
    const verifierHash = createHash("sha256")
      .update(code_verifier)
      .digest("base64url");
    if (verifierHash !== authCode.code_challenge) {
      return fail(400, "invalid_grant", "PKCE verification failed");
    }
  }

  // Consume the code (single use) before issuing the token.
  await supabase
    .from("oauth_authorization_codes")
    .update({ used: true })
    .eq("code", code);

  // Issue a PAT as the access token (service role bypasses RLS on insert).
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
    console.error("[oauth/token] PAT insert failed", patError);
    return fail(500, "server_error", "could not issue token");
  }

  // Best-effort cleanup of expired codes.
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
