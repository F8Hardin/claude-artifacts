import { notFound } from "next/navigation";
import { fetchArtifact, hasUserLiked } from "@/lib/supabase/artifacts";
import { createClient } from "@/lib/supabase/server";
import { ArtifactInfoPanel } from "@/components/artifact-info-panel";
import { ArtifactViewer } from "@/components/artifact-viewer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);
  if (!artifact) return {};

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const url = `${siteUrl}/artifact/${slug}`;
  const description = artifact.description || undefined;

  return {
    title: `${artifact.title} | Claude Artifacts`,
    description,
    keywords: artifact.tags.length > 0 ? artifact.tags : undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: artifact.title,
      description,
    },
  };
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);
  if (!artifact) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = user?.id === artifact.owner_id;
  const userLiked = user ? await hasUserLiked(artifact.id, user.id) : false;

  return (
    <main className="relative h-[calc(100dvh-3.5rem)] min-h-[calc(100dvh-3.5rem)] flex-1 overflow-hidden bg-white dark:bg-black">
      <ArtifactViewer
        previewUrl={`/artifact/${artifact.slug}/preview`}
        title={artifact.title}
      />
      <ArtifactInfoPanel
        artifact={artifact}
        canEdit={canEdit}
        currentUserId={user?.id ?? null}
        userHasLiked={userLiked}
      />
    </main>
  );
}
