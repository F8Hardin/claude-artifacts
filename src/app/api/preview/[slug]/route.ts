import { NextRequest, NextResponse } from "next/server";
import { fetchArtifact, getStorageUrl } from "@/lib/supabase/artifacts";
import { processJSX, buildHTML } from "@/lib/preview";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);
  if (!artifact) {
    return new NextResponse("Not found", { status: 404 });
  }

  const storageUrl = getStorageUrl(artifact.storage_path);
  const res = await fetch(storageUrl);
  if (!res.ok) {
    return new NextResponse("Failed to fetch artifact", { status: 502 });
  }

  const source = await res.text();
  const isJSX =
    artifact.storage_path.endsWith(".jsx") ||
    artifact.storage_path.endsWith(".js");

  if (!isJSX) {
    return new NextResponse(source, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const { code, componentName } = processJSX(source);
  const html = buildHTML(artifact.title, code, componentName);

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
