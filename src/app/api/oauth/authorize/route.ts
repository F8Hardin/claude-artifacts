import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { validateOAuthClient } from "@/lib/oauth";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const clientId = formData.get("client_id") as string;
  const redirectUri = formData.get("redirect_uri") as string;
  const state = (formData.get("state") as string) ?? "";
  const codeChallenge = (formData.get("code_challenge") as string) ?? null;
  const codeChallengeMethod =
    (formData.get("code_challenge_method") as string) ?? "";

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

  // PKCE is mandatory for these public clients. Enforce it at the point the code
  // is issued (not just on the consent page) so a NULL code_challenge can never
  // be persisted — that would disable PKCE verification at the token endpoint.
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "code_challenge with code_challenge_method=S256 is required",
      },
      { status: 400 }
    );
  }

  // Authorization-code issuance gate: the client must be registered and the
  // redirect_uri must be allow-listed for it. Without this, a code could be
  // delivered to an attacker-controlled redirect_uri and exchanged for a token.
  const client = await validateOAuthClient(clientId, redirectUri);
  if (!client) {
    return NextResponse.json(
      {
        error: "invalid_request",
        error_description: "unknown client_id or redirect_uri not allowed for this client",
      },
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

  // oauth_authorization_codes has RLS enabled with no policies, so it is only
  // writable via the service-role client (which bypasses RLS). The user-session
  // client above is used solely to authenticate the user.
  const admin = createAdminClient();
  const { error: insertError } = await admin
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
