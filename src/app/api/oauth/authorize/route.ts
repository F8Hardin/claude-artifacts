import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";

function issueCode(
  userId: string,
  codeChallenge: string,
  redirectUri: string,
  clientId: string
): string {
  const payload = {
    userId,
    codeChallenge,
    redirectUri,
    clientId,
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;

  const responseType = searchParams.get("response_type");
  const clientId = searchParams.get("client_id") ?? "";
  const redirectUri = searchParams.get("redirect_uri") ?? "";
  const state = searchParams.get("state") ?? "";
  const codeChallenge = searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = searchParams.get("code_challenge_method") ?? "";

  if (
    responseType !== "code" ||
    !redirectUri ||
    !codeChallenge ||
    codeChallengeMethod !== "S256"
  ) {
    return new Response("Invalid OAuth request parameters", { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const authorizeRelative = url.pathname + url.search;
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("next", authorizeRelative);
    return NextResponse.redirect(loginUrl);
  }

  const code = issueCode(user.id, codeChallenge, redirectUri, clientId);
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set("code", code);
  if (state) callbackUrl.searchParams.set("state", state);

  return NextResponse.redirect(callbackUrl);
}
