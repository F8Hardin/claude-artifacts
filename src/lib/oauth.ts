import { createAdminClient } from "@/lib/supabase/server";

export interface OAuthClient {
  id: string;
  name: string;
  redirect_uri_prefix: string;
}

// Boundary-safe check that a redirect_uri belongs to a registered client.
//
// A naive `redirectUri.startsWith(prefix)` is exploitable: with prefix
// "https://claude.ai" it would also accept "https://claude.ai.evil.com/cb".
// We require the URI to either equal the prefix exactly or continue with a
// path separator, so the host boundary can't be spoofed.
export function isRedirectUriAllowed(
  redirectUri: string,
  prefix: string
): boolean {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (redirectUri === prefix) return true;
  const prefixWithSlash = prefix.endsWith("/") ? prefix : prefix + "/";
  return redirectUri.startsWith(prefixWithSlash);
}

// Validate an OAuth request's client against the registry. Returns the
// registered client only when client_id exists AND redirect_uri is allow-listed
// for it; otherwise null. oauth_clients is RLS-locked, so this reads via the
// service-role admin client.
export async function validateOAuthClient(
  clientId: string | null | undefined,
  redirectUri: string | null | undefined
): Promise<OAuthClient | null> {
  if (!clientId || !redirectUri) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("oauth_clients")
    .select("id, name, redirect_uri_prefix")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) return null;
  if (!isRedirectUriAllowed(redirectUri, data.redirect_uri_prefix)) return null;
  return data as OAuthClient;
}
