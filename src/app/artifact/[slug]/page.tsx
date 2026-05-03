import { notFound } from "next/navigation";
import { fetchArtifact, getStorageUrl } from "@/lib/supabase/artifacts";
import { ArtifactViewer } from "@/components/artifact-viewer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = await fetchArtifact(slug);
  if (!artifact) return {};
  return {
    title: `${artifact.title} | Claude Artifacts`,
    description: artifact.description,
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

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-5xl mx-auto w-full px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          {!artifact.is_public && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
              Private
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
          by {artifact.author_username ?? "Unknown"} &middot;{" "}
          {new Date(artifact.created_at).toLocaleDateString()}
        </p>
        <p className="text-neutral-600 dark:text-neutral-300 mb-4">
          {artifact.description}
        </p>
        {artifact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {artifact.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <ArtifactViewer
        storageUrl={getStorageUrl(artifact.storage_path)}
        title={artifact.title}
      />
    </main>
  );
}
