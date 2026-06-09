import { type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createHmac, createHash, randomBytes } from "crypto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
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
    { headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}
