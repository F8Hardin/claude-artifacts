import { redirect } from "next/navigation";
import { ArtifactCard } from "@/components/artifact-card";
import { createClient } from "@/lib/supabase/server";
import { fetchLikedArtifacts } from "@/lib/supabase/artifacts";

export const metadata = { title: "Liked Artifacts | Claude Artifacts" };

export default async function LikedArtifactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const artifacts = await fetchLikedArtifacts(user.id);

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-5xl tracking-wider mb-2">
          Liked Artifacts
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400">
          Artifacts you have liked, most recent first.
        </p>
      </div>

      {artifacts.length === 0 ? (
        <p className="text-center text-neutral-400 py-12">
          You have not liked any artifacts yet.
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
