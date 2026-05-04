import { notFound } from "next/navigation";
import { ArtifactCard } from "@/components/artifact-card";
import { fetchProfileByUsername, fetchArtifactsByOwner } from "@/lib/supabase/artifacts";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return { title: `${username} | Claude Artifacts` };
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const profile = await fetchProfileByUsername(username);
  if (!profile) notFound();

  const artifacts = await fetchArtifactsByOwner(profile.id);
  const displayName = profile.username ?? profile.github_username ?? username;

  return (
    <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-5xl tracking-wider mb-1">{displayName}</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {artifacts.length} public artifact{artifacts.length !== 1 ? "s" : ""}
        </p>
      </div>

      {artifacts.length === 0 ? (
        <p className="text-center text-neutral-400 py-12">No public artifacts.</p>
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
