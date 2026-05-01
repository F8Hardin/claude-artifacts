import { notFound } from "next/navigation";
import { getAllArtifacts, getArtifact } from "@/lib/artifacts";
import { ArtifactViewer } from "@/components/artifact-viewer";

export function generateStaticParams() {
  return getAllArtifacts().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const artifact = getArtifact(slug);
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
  const artifact = getArtifact(slug);
  if (!artifact) notFound();

  return (
    <main className="flex-1 flex flex-col">
      <div className="max-w-5xl mx-auto w-full px-4 py-4">
        <div className="mb-2">
          <h1 className="text-2xl font-bold">{artifact.title}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            by {artifact.author} &middot; {artifact.createdAt}
          </p>
        </div>
        <p className="text-neutral-600 dark:text-neutral-300 mb-4">
          {artifact.description}
        </p>
      </div>
      <ArtifactViewer file={artifact.file} title={artifact.title} />
    </main>
  );
}
