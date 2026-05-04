import { ArtifactCard } from "@/components/artifact-card";
import { fetchTopRated } from "@/lib/supabase/artifacts";

export const metadata = { title: "Top Rated | Claude Artifacts" };

export default async function TopRatedPage() {
  const artifacts = await fetchTopRated(100);

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-5xl tracking-wider mb-1">Top Rated</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          The 100 most-liked artifacts.
        </p>
      </div>

      {artifacts.length === 0 ? (
        <p className="text-center text-neutral-400 py-12">No artifacts yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <ArtifactCard key={artifact.slug} artifact={artifact} />
          ))}
        </div>
      )}
    </main>
  );
}
