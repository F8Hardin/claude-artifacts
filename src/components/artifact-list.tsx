import { getAllArtifacts, searchArtifacts } from "@/lib/artifacts";
import { ArtifactCard } from "@/components/artifact-card";

export function ArtifactList({ query }: { query?: string }) {
  const artifacts = query ? searchArtifacts(query) : getAllArtifacts();

  if (artifacts.length === 0) {
    return (
      <p className="text-center text-neutral-400 py-12">
        No artifacts found.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.slug} artifact={artifact} />
      ))}
    </div>
  );
}
