import { NextRequest, NextResponse } from "next/server";
import { fetchArtifact, downloadArtifactFile } from "@/lib/supabase/artifacts";
import { processJSX, buildHTML, buildMarkdownHTML, buildMermaidHTML } from "@/lib/preview";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);
  if (!artifact) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: fileBlob, error: downloadError } = await downloadArtifactFile(artifact.storage_path);
  if (downloadError || !fileBlob) {
    return new NextResponse("Failed to fetch artifact", { status: 502 });
  }

  const source = await fileBlob.text();
  const path = artifact.storage_path;

  // Force an opaque (null) origin even on direct navigation so uploaded
  // artifact content can never execute script against our own origin. See
  // the matching comment in /artifact/[slug]/preview/route.ts.
  const SANDBOX_CSP = "sandbox allow-scripts allow-modals";
  const htmlHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": SANDBOX_CSP,
  };

  if (path.endsWith(".svg")) {
    return new NextResponse(source, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        // Images never need scripting: opaque origin + no scripts.
        "Content-Security-Policy": "sandbox",
      },
    });
  }

  if (path.endsWith(".md") || path.endsWith(".markdown")) {
    return new NextResponse(buildMarkdownHTML(artifact.title, source), {
      headers: htmlHeaders,
    });
  }

  if (path.endsWith(".mmd")) {
    return new NextResponse(buildMermaidHTML(artifact.title, source), {
      headers: htmlHeaders,
    });
  }

  const isJSX =
    path.endsWith(".jsx") ||
    path.endsWith(".js") ||
    path.endsWith(".tsx") ||
    path.endsWith(".ts");

  if (!isJSX) {
    return new NextResponse(source, {
      headers: htmlHeaders,
    });
  }

  const { code, componentName } = processJSX(source);
  const html = buildHTML(artifact.title, code, componentName);

  return new NextResponse(html, {
    headers: htmlHeaders,
  });
}
