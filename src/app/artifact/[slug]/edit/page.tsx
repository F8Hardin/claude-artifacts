import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fetchArtifact } from "@/lib/supabase/artifacts";
import { createClient } from "@/lib/supabase/server";
import { EditArtifactForm } from "./edit-artifact-form";

export default async function EditArtifactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const artifact = await fetchArtifact(slug);
  if (!artifact || artifact.owner_id !== user.id) notFound();

  return (
    <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Artifact</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {artifact.title}
          </p>
        </div>
        <Link
          href={`/artifact/${artifact.slug}`}
          className="shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
        >
          View
        </Link>
      </div>
      <EditArtifactForm artifact={artifact} />
    </main>
  );
}
