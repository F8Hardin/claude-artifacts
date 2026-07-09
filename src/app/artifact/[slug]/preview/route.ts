import { fetchArtifact, downloadArtifactFile } from "@/lib/supabase/artifacts";
import { processJSX, buildHTML, buildMarkdownHTML, buildMermaidHTML } from "@/lib/preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);

  if (!artifact) {
    return new Response("Artifact not found", { status: 404 });
  }

  const { data: fileBlob, error: downloadError } = await downloadArtifactFile(artifact.storage_path);
  if (downloadError || !fileBlob) {
    return new Response("Artifact file not found", { status: 502 });
  }

  const source = await fileBlob.text();
  const path = artifact.storage_path;

  // The `sandbox` CSP directive forces this response into an opaque (null)
  // origin even when the URL is opened directly, not just inside the
  // sandboxed <iframe> on the artifact page. Without it, an attacker could
  // upload a malicious .html/.svg/.md artifact and send a victim the raw
  // /preview URL, executing script on our own origin with the victim's
  // session. `allow-scripts allow-modals` mirrors the iframe's sandbox attr
  // so legitimate artifacts still run. See the security review.
  const baseHeaders = {
    "Cache-Control": "private, no-store",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com; frame-ancestors 'self'; sandbox allow-scripts allow-modals",
  };

  if (path.endsWith(".svg")) {
    return new Response(source, {
      headers: {
        ...baseHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8",
        // SVG is rendered as an image and never needs to execute script.
        // Drop `allow-scripts` entirely: opaque origin + no scripting.
        "Content-Security-Policy": "sandbox",
      },
    });
  }

  if (path.endsWith(".md") || path.endsWith(".markdown")) {
    return new Response(buildMarkdownHTML(artifact.title, source), { headers: baseHeaders });
  }

  if (path.endsWith(".mmd")) {
    return new Response(buildMermaidHTML(artifact.title, source), { headers: baseHeaders });
  }

  const isJSX =
    path.endsWith(".jsx") ||
    path.endsWith(".js") ||
    path.endsWith(".tsx") ||
    path.endsWith(".ts");

  if (!isJSX) {
    return new Response(source, { headers: baseHeaders });
  }

  const { code, componentName } = processJSX(source);
  const html = buildHTML(artifact.title, code, componentName);

  return new Response(html, { headers: baseHeaders });
}
