<<<<<<< HEAD
import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createHmac, createHash, randomBytes } from "crypto";
=======
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
>>>>>>> origin/master

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
<<<<<<< HEAD
  "Access-Control-Allow-Headers": "Content-Type",
};

function decodeCode(code: string): Record<string, unknown> | null {
  const dot = code.lastIndexOf(".");
  if (dot === -1) return null;
  const data = code.slice(0, dot);
  const sig = code.slice(dot + 1);
  const expected = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(data)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function tokenError(code: string, description: string) {
  return Response.json(
    { error: code, error_description: description },
    { status: 400, headers: CORS }
  );
=======
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
>>>>>>> origin/master
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
<<<<<<< HEAD
  let params: Record<string, string>;
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/x-www-form-urlencoded")) {
    params = Object.fromEntries(new URLSearchParams(await request.text()));
  } else {
    try {
      params = await request.json();
    } catch {
      return tokenError("invalid_request", "Could not parse request body");
    }
  }

  const { grant_type, code, redirect_uri, code_verifier } = params;

  if (grant_type !== "authorization_code") {
    return tokenError(
      "unsupported_grant_type",
      "Only authorization_code is supported"
    );
  }
  if (!code || !code_verifier || !redirect_uri) {
    return tokenError("invalid_request", "Missing required parameters");
  }

  const payload = decodeCode(code);
  if (!payload) {
    return tokenError("invalid_grant", "Invalid or tampered code");
  }

  const { userId, codeChallenge, redirectUri, exp } = payload as {
    userId: string;
    codeChallenge: string;
    redirectUri: string;
    exp: number;
  };

  if (exp < Math.floor(Date.now() / 1000)) {
    return tokenError("invalid_grant", "Code has expired");
  }
  if (redirect_uri !== redirectUri) {
    return tokenError("invalid_grant", "redirect_uri mismatch");
  }

  // PKCE S256: base64url(SHA256(code_verifier)) must equal codeChallenge
  const verifierHash = createHash("sha256")
    .update(code_verifier)
    .digest("base64url");
  if (verifierHash !== codeChallenge) {
    return tokenError("invalid_grant", "PKCE verification failed");
  }

  // Issue a PAT as the bearer access token
  const raw = "cap_" + randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 12);

  const sb = createAdminClient();
  const { error } = await sb.from("personal_access_tokens").insert({
    user_id: userId,
    name: "claude.ai connector",
    token_hash: hash,
    token_prefix: prefix,
    expires_at: null,
  });

  if (error) {
    return Response.json(
      { error: "server_error", error_description: "Failed to create token" },
      { status: 500, headers: CORS }
    );
  }

  return Response.json(
    { access_token: raw, token_type: "bearer", scope: "mcp" },
=======
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

  // oauth_authorization_codes has RLS disabled — anon key is sufficient for lookup.
  const supabaseAnon = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  // Look up the authorization code by the code itself. client_id is not used as
  // a filter because public clients are inconsistent about sending it.
  // Note: the table has no `id` column — select only the columns that exist.
  const { data: authCode, error: lookupError } = await supabaseAnon
    .from("oauth_authorization_codes")
    .select("user_id, client_id, redirect_uri, expires_at, used, code_challenge")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    console.error("[oauth/token] code lookup error", lookupError);
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
  await supabaseAnon
    .from("oauth_authorization_codes")
    .update({ used: true })
    .eq("code", code);

  // Issue a PAT as the access token. The personal_access_tokens INSERT policy
  // requires auth.uid() = user_id, so we need the service-role client here.
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e) {
    console.error("[oauth/token] createAdminClient failed — SUPABASE_SERVICE_ROLE_KEY missing?", e);
    return fail(500, "server_error", "token issuance unavailable");
  }

  const rawToken = "cap_" + randomBytes(32).toString("base64url");
  const hash = sha256hex(rawToken);
  const prefix = rawToken.slice(0, 12);

  const { error: patError } = await supabaseAdmin
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
  supabaseAnon
    .from("oauth_authorization_codes")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .then(() => {});

  return NextResponse.json(
    { access_token: rawToken, token_type: "bearer", scope: "mcp" },
>>>>>>> origin/master
    { headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}
