import { NextRequest } from "next/server";

const UPSTREAM = "https://ngpsvlvrsqmpbtmdxvfl.supabase.co/functions/v1/mcp";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Artifacts-Token",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const body = await request.arrayBuffer();

  const upstreamHeaders = new Headers();
  upstreamHeaders.set("Content-Type", request.headers.get("Content-Type") ?? "application/json");
  const auth = request.headers.get("Authorization");
  if (auth) upstreamHeaders.set("Authorization", auth);
  const xToken = request.headers.get("X-Artifacts-Token");
  if (xToken) upstreamHeaders.set("X-Artifacts-Token", xToken);

  const upstream = await fetch(UPSTREAM, { method: "POST", headers: upstreamHeaders, body });

  const responseHeaders = new Headers(CORS);
  const ct = upstream.headers.get("Content-Type");
  if (ct) responseHeaders.set("Content-Type", ct);

  // Rewrite WWW-Authenticate so as_uri always points to this Vercel origin,
  // regardless of what the Supabase edge function returns.
  if (upstream.status === 401) {
    responseHeaders.set(
      "WWW-Authenticate",
      `Bearer realm="claude-artifacts", as_uri="https://claude-artifacts-mu.vercel.app"`
    );
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
