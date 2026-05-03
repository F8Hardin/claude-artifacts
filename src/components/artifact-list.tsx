import { fetchAllArtifacts, searchArtifactRows } from "@/lib/supabase/artifacts";
import { ArtifactCard } from "@/components/artifact-card";

export async function ArtifactList({ query }: { query?: string }) {
  const artifacts = query
    ? await searchArtifactRows(query)
    : await fetchAllArtifacts();

  if (artifacts.length === 0) {
    return (
      <p className="text-center text-neutral-400 py-12">No artifacts found.</p>
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
