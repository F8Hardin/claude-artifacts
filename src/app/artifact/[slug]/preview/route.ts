import { fetchArtifact, getStorageUrl } from "@/lib/supabase/artifacts";
import { processJSX, buildHTML } from "@/lib/preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);

  if (!artifact) {
    return new Response("Artifact not found", { status: 404 });
  }

  const storageUrl = getStorageUrl(artifact.storage_path);
  const res = await fetch(storageUrl);
  if (!res.ok) {
    return new Response("Artifact file not found", { status: 502 });
  }

  const source = await res.text();
  const isJSX =
    artifact.storage_path.endsWith(".jsx") ||
    artifact.storage_path.endsWith(".js");

  const baseHeaders = {
    "Cache-Control": "private, no-store",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com; frame-ancestors 'self'",
  };

  if (!isJSX) {
    return new Response(source, { headers: baseHeaders });
  }

  const { code, componentName } = processJSX(source);
  const html = buildHTML(artifact.title, code, componentName);

  return new Response(html, { headers: baseHeaders });
}
