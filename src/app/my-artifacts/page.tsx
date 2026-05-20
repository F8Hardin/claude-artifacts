import { redirect } from "next/navigation";
import { ArtifactCard } from "@/components/artifact-card";
import { DownloadAllButton } from "@/components/download-all-button";
import { createClient } from "@/lib/supabase/server";
import { fetchArtifactsByOwner } from "@/lib/supabase/artifacts";

export default async function MyArtifactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const artifacts = await fetchArtifactsByOwner(user.id);

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl tracking-wider mb-2">
            My Artifacts
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">
            Artifacts you have uploaded, including private ones.
          </p>
        </div>
        {artifacts.length > 0 && <DownloadAllButton />}
      </div>

      {artifacts.length === 0 ? (
        <p className="text-center text-neutral-400 py-12">
          You have not uploaded any artifacts yet.
        </p>
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
