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

  const baseHeaders = {
    "Cache-Control": "private, no-store",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.tailwindcss.com; frame-ancestors 'self'",
  };

  if (path.endsWith(".svg")) {
    return new Response(source, {
      headers: {
        ...baseHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8",
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
