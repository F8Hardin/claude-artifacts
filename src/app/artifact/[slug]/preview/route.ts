import { fetchArtifact } from "@/lib/supabase/artifacts";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);

  if (!artifact) {
    return new Response("Artifact not found", { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("artifacts")
    .download(artifact.storage_path);

  if (error || !data) {
    return new Response("Artifact file not found", { status: 404 });
  }

  const html = await data.text();

  return new Response(html, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
